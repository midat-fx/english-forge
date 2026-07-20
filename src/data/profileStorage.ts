import { invoke, isTauri } from '@tauri-apps/api/core'
import type { StateStorage } from 'zustand/middleware'
import type { ForgeData } from '../domain/types'
import { MAX_IMPORT_BYTES, PROFILE_STORAGE_KEY } from './serialization'

export const STORAGE_ERROR_EVENT = 'english-forge-storage-error'
export type ProfileAccess = 'loading' | 'ready' | 'recovery'
let lastStorageError = ''
let writeQueue = Promise.resolve()
let profileAccess: ProfileAccess = 'loading'
let pendingProfileWrite: { name: string; value: string; generation: number } | undefined
let profileWriteGeneration = 0
const accessListeners = new Set<() => void>()
const PERSISTED_ENVELOPE_BYTES = 22

function setProfileAccess(next: ProfileAccess) {
  profileAccess = next
  for (const listener of accessListeners) listener()
}

function reportStorageError(error: unknown): Error {
  const normalized = error instanceof Error ? error : new Error(String(error))
  lastStorageError = normalized.message
  window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: lastStorageError }))
  return normalized
}

export function notifyStorageError(error: unknown): void {
  reportStorageError(error)
}

export function enterProfileRecovery(error: unknown): void {
  reportStorageError(error)
  setProfileAccess('recovery')
}

export function beginProfileHydration(): void {
  setProfileAccess('loading')
}

export function markProfileReady(): void {
  if (profileAccess === 'loading') setProfileAccess('ready')
}

export function getProfileAccess(): ProfileAccess {
  return profileAccess
}

export function subscribeProfileAccess(listener: () => void): () => void {
  accessListeners.add(listener)
  return () => accessListeners.delete(listener)
}

export function getLastStorageError(): string {
  return lastStorageError
}

export function clearStorageError(): void {
  lastStorageError = ''
  window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: '' }))
}

async function nativeGetItem(name: string): Promise<string | null> {
  const stored = await invoke<string | null>('read_profile')
  if (stored !== null) return stored
  const legacy = localStorage.getItem(name)
  if (legacy) {
    await invoke('write_profile', { contents: legacy })
    localStorage.removeItem(name)
  }
  return legacy
}

function enqueueNativeWrite(contents: string): Promise<void> {
  const operation = writeQueue.catch(() => undefined).then(() => invoke<void>('write_profile', { contents }))
  writeQueue = operation
  return operation
}

async function setRawItem(name: string, value: string, recoveryWrite = false): Promise<void> {
  if (profileAccess === 'recovery' && !recoveryWrite) throw new Error('Profile writes are locked until you import a backup or discard the unreadable profile.')
  // The 9 MiB cap bounds the whole profile document (all profiles share it), mirroring the native MAX_PROFILE_BYTES.
  if (new Blob([value]).size > MAX_IMPORT_BYTES + PERSISTED_ENVELOPE_BYTES) throw new Error('Все профили вместе превышают локальный лимит 9 МБ. Удалите лишний профиль или очистите старую историю.')
  if (isTauri()) await enqueueNativeWrite(value)
  else localStorage.setItem(name, value)
}

async function removeRawItem(name: string, recoveryWrite = false): Promise<void> {
  if (profileAccess === 'recovery' && !recoveryWrite) throw new Error('Profile deletion requires an explicit recovery action.')
  if (isTauri()) {
    await writeQueue.catch(() => undefined)
    await invoke('delete_profile')
  }
  localStorage.removeItem(name)
}

/* ------------------------------------------------------------------ *
 *  Profile container — several named local profiles inside the single
 *  secure profile document. The native storage layer is unchanged: it
 *  still reads/writes one file; the container is a pure-frontend layer
 *  above the verbatim key/value store, so every atomicity, recovery and
 *  path-safety guarantee is preserved untouched.
 * ------------------------------------------------------------------ */

const CONTAINER_VERSION = 1
export interface ProfileSummary { id: string; name: string; level: string; placementCompleted: boolean }
// The envelope is the Zustand {state, version} object stored inline (not a JSON
// string) so re-serializing the container does not double-escape it — keeping a
// near-limit profile from inflating past the shared 9 MiB document cap. A bare
// string is kept only for a corrupt legacy value, so Zustand hydration surfaces
// it and enters recovery.
type ProfileEnvelope = { state?: Record<string, unknown>; version?: number }
interface ContainerProfile { name: string; level: string; placementCompleted: boolean; envelope: ProfileEnvelope | string | null }
interface ProfileContainer { containerVersion: number; activeId: string; order: string[]; profiles: Record<string, ContainerProfile> }

let container: ProfileContainer | null = null
let profileChosenThisSession = false
const registryListeners = new Set<() => void>()
let registrySnapshot: { activeId: string; chosen: boolean; profiles: ProfileSummary[] } = { activeId: '', chosen: false, profiles: [] }

function newProfileId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `profile-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

/** The learner state inside an envelope, whether the envelope is an object or a legacy string. */
function envelopeState(envelope: ContainerProfile['envelope']): Record<string, unknown> | undefined {
  if (!envelope) return undefined
  if (typeof envelope === 'string') { try { return JSON.parse(envelope)?.state } catch { return undefined } }
  return envelope.state
}

/** The string form Zustand expects from getItem, or null when the slot is empty. */
function envelopeToString(envelope: ContainerProfile['envelope']): string | null {
  if (envelope == null) return null
  return typeof envelope === 'string' ? envelope : JSON.stringify(envelope)
}

function readMeta(envelope: ContainerProfile['envelope']): { level: string; placementCompleted: boolean } {
  const preferences = (envelopeState(envelope)?.preferences ?? undefined) as { currentLevel?: unknown; placementCompletedAt?: unknown } | undefined
  return { level: typeof preferences?.currentLevel === 'string' ? preferences.currentLevel : 'A2', placementCompleted: Boolean(preferences?.placementCompletedAt) }
}

/** Normalize a profile whose envelope was persisted as a JSON string (older format) into an inline object. */
function normalizeEnvelope(envelope: unknown): ContainerProfile['envelope'] {
  if (envelope == null) return null
  if (typeof envelope === 'string') { try { return JSON.parse(envelope) as ProfileEnvelope } catch { return envelope } }
  return envelope as ProfileEnvelope
}

function migrateToContainer(raw: string | null): ProfileContainer {
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && parsed.containerVersion && parsed.profiles && parsed.activeId) {
        const restored = parsed as ProfileContainer
        for (const profile of Object.values(restored.profiles)) profile.envelope = normalizeEnvelope(profile.envelope)
        // Repair a container whose pointers drifted (external edit): every profile is
        // in `order`, and activeId points at a real profile — otherwise writes would
        // silently target a missing slot and be lost.
        restored.order = restored.order.filter((id) => restored.profiles[id])
        for (const id of Object.keys(restored.profiles)) if (!restored.order.includes(id)) restored.order.push(id)
        if (!restored.profiles[restored.activeId]) restored.activeId = restored.order[0] ?? newProfileId()
        if (!restored.order.length) { const id = restored.activeId; restored.order = [id]; restored.profiles[id] = { name: 'Мой профиль', level: 'A2', placementCompleted: false, envelope: null } }
        return restored
      }
    } catch {
      // Not JSON / corrupt: keep the raw string as the sole profile's envelope so
      // Zustand's hydration surfaces it and enters recovery, exactly as before.
    }
    const id = newProfileId()
    const envelope = normalizeEnvelope(raw)
    const meta = readMeta(envelope)
    return { containerVersion: CONTAINER_VERSION, activeId: id, order: [id], profiles: { [id]: { name: 'Мой профиль', level: meta.level, placementCompleted: meta.placementCompleted, envelope } } }
  }
  const id = newProfileId()
  return { containerVersion: CONTAINER_VERSION, activeId: id, order: [id], profiles: { [id]: { name: 'Мой профиль', level: 'A2', placementCompleted: false, envelope: null } } }
}

function rebuildRegistrySnapshot(): void {
  const current = container
  registrySnapshot = current
    ? { activeId: current.activeId, chosen: profileChosenThisSession, profiles: current.order.filter((id) => current.profiles[id]).map((id) => ({ id, name: current.profiles[id].name, level: current.profiles[id].level, placementCompleted: current.profiles[id].placementCompleted })) }
    : { activeId: '', chosen: profileChosenThisSession, profiles: [] }
}

function notifyRegistry(): void {
  rebuildRegistrySnapshot()
  for (const listener of registryListeners) listener()
}

async function loadContainer(): Promise<ProfileContainer> {
  if (container) return container
  const raw = isTauri() ? await nativeGetItem(PROFILE_STORAGE_KEY) : localStorage.getItem(PROFILE_STORAGE_KEY)
  container = migrateToContainer(raw)
  // A solo learner who has already finished the diagnostic skips the launch picker
  // (no daily extra click); the sidebar switcher can still reopen it. Once a second
  // profile exists this auto-skip no longer applies.
  if (container.order.length === 1 && container.profiles[container.activeId]?.placementCompleted) profileChosenThisSession = true
  rebuildRegistrySnapshot()
  return container
}

async function persistContainer(force: boolean): Promise<void> {
  if (!container) return
  const value = JSON.stringify(container)
  if (force) {
    profileWriteGeneration += 1
    pendingProfileWrite = undefined
    await setRawItem(PROFILE_STORAGE_KEY, value, true)
    pendingProfileWrite = undefined
    clearStorageError()
    setProfileAccess('ready')
  } else {
    await profileStorage.setItem(PROFILE_STORAGE_KEY, value)
  }
  notifyRegistry()
}

/** Zustand persist adapter: reads/writes the active profile's envelope within the container. */
export const profileContainerStorage: StateStorage = {
  getItem: async () => {
    try {
      const loaded = await loadContainer()
      return envelopeToString(loaded.profiles[loaded.activeId]?.envelope ?? null)
    } catch (error) {
      enterProfileRecovery(error)
      throw error
    }
  },
  setItem: async (_name, value) => {
    // During a profile switch the store is being torn down/rehydrated; a stray
    // persist write here would target the wrong profile's slot, so it is dropped
    // (the durable write for the previous profile already landed before the switch).
    if (profileWriteBarrier) return
    try {
      const loaded = await loadContainer()
      const entry = loaded.profiles[loaded.activeId]
      if (entry) {
        let parsed: ProfileEnvelope | string
        try { parsed = JSON.parse(value) as ProfileEnvelope } catch { parsed = value }
        entry.envelope = parsed
        const meta = readMeta(parsed)
        entry.level = meta.level
        entry.placementCompleted = meta.placementCompleted
      }
      await persistContainer(false)
    } catch {
      // profileStorage.setItem already reported and retained the snapshot for retry.
    }
  },
  removeItem: async () => {
    if (profileWriteBarrier) return
    try {
      const loaded = await loadContainer()
      const entry = loaded.profiles[loaded.activeId]
      if (entry) entry.envelope = null
      await persistContainer(false)
    } catch {
      // Reported by the strict adapter.
    }
  },
}

/** Guards the container against misdirected persist writes during a profile switch. */
let profileWriteBarrier = false
export function setProfileWriteBarrier(active: boolean): void {
  profileWriteBarrier = active
}

/** Test seam: drop the in-memory container so a test starts from disk state. */
export function resetProfileContainerForTests(): void {
  container = null
  profileChosenThisSession = false
  profileWriteBarrier = false
  rebuildRegistrySnapshot()
}

// ---- Profile registry (list / create / switch / rename / delete) ----

export function subscribeProfiles(listener: () => void): () => void {
  registryListeners.add(listener)
  return () => registryListeners.delete(listener)
}

export function getProfilesSnapshot(): { activeId: string; chosen: boolean; profiles: ProfileSummary[] } {
  return registrySnapshot
}

export function getActiveProfileId(): string {
  return container?.activeId ?? ''
}

export function isProfileChosen(): boolean {
  return profileChosenThisSession
}

export function markProfileChosen(): void {
  profileChosenThisSession = true
  notifyRegistry()
}

export function resetProfileChoice(): void {
  profileChosenThisSession = false
  notifyRegistry()
}

export async function ensureProfilesLoaded(): Promise<{ activeId: string; profiles: ProfileSummary[] }> {
  await loadContainer()
  return registrySnapshot
}

/** Recording ids referenced by one profile's stored envelope (best-effort). */
function recordingIdsFromEnvelope(envelope: ContainerProfile['envelope']): string[] {
  const state = envelopeState(envelope) as { listeningClips?: { recordingId?: unknown }[]; speakingAttempts?: { recordingId?: unknown }[] } | undefined
  if (!state) return []
  const ids: string[] = []
  for (const clip of state.listeningClips ?? []) if (typeof clip?.recordingId === 'string') ids.push(clip.recordingId)
  for (const attempt of state.speakingAttempts ?? []) if (typeof attempt?.recordingId === 'string') ids.push(attempt.recordingId)
  return [...new Set(ids)]
}

/**
 * Recordings referenced by EVERY local profile. Startup audio reconciliation
 * must use this union — the recording store is one shared namespace, so reconciling
 * against a single profile would delete other learners' audio.
 */
export function allProfilesReferencedRecordingIds(): string[] {
  if (!container) return []
  const ids = new Set<string>()
  for (const profile of Object.values(container.profiles)) {
    for (const id of recordingIdsFromEnvelope(profile.envelope)) ids.add(id)
  }
  return [...ids]
}

export async function createProfileEntry(name: string): Promise<string> {
  const loaded = await loadContainer()
  const id = newProfileId()
  loaded.profiles[id] = { name: name.trim() || 'Новый профиль', level: 'A2', placementCompleted: false, envelope: null }
  loaded.order.push(id)
  loaded.activeId = id
  await persistContainer(false)
  return id
}

export async function switchProfileEntry(id: string): Promise<void> {
  const loaded = await loadContainer()
  if (!loaded.profiles[id] || loaded.activeId === id) return
  loaded.activeId = id
  await persistContainer(false)
}

export async function renameProfileEntry(id: string, name: string): Promise<void> {
  const loaded = await loadContainer()
  const entry = loaded.profiles[id]
  if (!entry) return
  entry.name = name.trim() || entry.name
  await persistContainer(false)
}

export async function deleteProfileEntry(id: string): Promise<{ activeId: string; wasActive: boolean; recordingIds: string[] } | undefined> {
  const loaded = await loadContainer()
  if (!loaded.profiles[id] || loaded.order.length <= 1) return undefined
  const wasActive = loaded.activeId === id
  const removedRecordingIds = recordingIdsFromEnvelope(loaded.profiles[id].envelope)
  delete loaded.profiles[id]
  loaded.order = loaded.order.filter((entryId) => entryId !== id)
  if (wasActive) loaded.activeId = loaded.order[0]
  await persistContainer(false)
  // Only orphan recordings not referenced by any surviving profile are the deleted
  // profile's own; keep anything a sibling still uses (recording ids are unique per profile).
  const survivorReferenced = new Set(allProfilesReferencedRecordingIds())
  return { activeId: loaded.activeId, wasActive, recordingIds: removedRecordingIds.filter((recordingId) => !survivorReferenced.has(recordingId)) }
}

export const profileStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return isTauri() ? await nativeGetItem(name) : localStorage.getItem(name)
    } catch (error) {
      enterProfileRecovery(error)
      throw error
    }
  },
  setItem: async (name, value) => {
    const generation = ++profileWriteGeneration
    // The new snapshot supersedes any older retry before its asynchronous
    // write starts, so a retry can never be queued behind newer state.
    pendingProfileWrite = undefined
    try {
      await setRawItem(name, value)
      // A later successful write supersedes every older failed snapshot. Keeping
      // the older snapshot retryable would let the retry button roll durable
      // state backwards after the newer value has already reached disk.
      if (generation === profileWriteGeneration) pendingProfileWrite = undefined
      clearStorageError()
    } catch (error) {
      if (generation === profileWriteGeneration) pendingProfileWrite = { name, value, generation }
      throw reportStorageError(error)
    }
  },
  removeItem: async (name) => {
    try {
      await removeRawItem(name)
    } catch (error) {
      throw reportStorageError(error)
    }
  },
}

/**
 * Zustand's action setter is synchronous even when its persistence adapter is
 * asynchronous. The middleware therefore returns a Promise that most actions
 * cannot expose to their callers. Keep the strict `profileStorage` API for
 * explicit durable transactions, but absorb middleware write rejections here
 * after `profileStorage` has reported them and retained the latest snapshot for
 * retry. This prevents an unhandled rejection without hiding the failure from
 * the global storage alert.
 */
export const zustandProfileStorage: StateStorage = {
  getItem: (name) => profileStorage.getItem(name),
  setItem: async (name, value) => {
    try {
      await profileStorage.setItem(name, value)
    } catch {
      // `profileStorage.setItem` already emitted STORAGE_ERROR_EVENT and kept
      // the newest failed snapshot for an explicit retry.
    }
  },
  removeItem: async (name) => {
    try {
      await profileStorage.removeItem(name)
    } catch {
      // Deletion errors are reported by the strict adapter as well.
    }
  },
}

export async function retryPendingProfileWrite(): Promise<boolean> {
  const pending = pendingProfileWrite
  if (!pending) {
    clearStorageError()
    return true
  }
  try {
    if (isTauri()) {
      const retryOperation = writeQueue.catch(() => undefined).then(async () => {
        if (pendingProfileWrite !== pending || pending.generation !== profileWriteGeneration) return
        await invoke<void>('write_profile', { contents: pending.value })
      })
      writeQueue = retryOperation
      await retryOperation
    } else if (pendingProfileWrite === pending && pending.generation === profileWriteGeneration) {
      await setRawItem(pending.name, pending.value)
    }
    if (pendingProfileWrite === pending) pendingProfileWrite = undefined
    clearStorageError()
    return true
  } catch (error) {
    reportStorageError(error)
    return false
  }
}

export async function replacePersistedProfile(data: ForgeData): Promise<void> {
  try {
    const loaded = await loadContainer()
    const envelope: ProfileEnvelope = { state: data as unknown as Record<string, unknown>, version: 6 }
    const entry = loaded.profiles[loaded.activeId]
    const meta = readMeta(envelope)
    if (entry) {
      entry.envelope = envelope
      entry.level = meta.level
      entry.placementCompleted = meta.placementCompleted
    } else {
      const id = loaded.activeId || newProfileId()
      loaded.activeId = id
      if (!loaded.order.includes(id)) loaded.order.push(id)
      loaded.profiles[id] = { name: 'Мой профиль', level: meta.level, placementCompleted: meta.placementCompleted, envelope }
    }
    await persistContainer(true)
  } catch (error) {
    throw reportStorageError(error)
  }
}

/**
 * Recovery discard. With several profiles it removes ONLY the active (unreadable)
 * one and returns its recordings for targeted cleanup, leaving the other learners'
 * data and audio intact. With a single profile it wipes the whole document, and
 * the caller purges all audio.
 */
export async function discardPersistedProfile(): Promise<{ fullWipe: boolean; recordingIds: string[] }> {
  profileWriteGeneration += 1
  pendingProfileWrite = undefined
  try {
    const loaded = await loadContainer()
    if (loaded.order.length > 1) {
      const removedId = loaded.activeId
      const removedRecordingIds = recordingIdsFromEnvelope(loaded.profiles[removedId]?.envelope ?? null)
      delete loaded.profiles[removedId]
      loaded.order = loaded.order.filter((id) => id !== removedId)
      loaded.activeId = loaded.order[0]
      await persistContainer(true)
      pendingProfileWrite = undefined
      clearStorageError()
      setProfileAccess('ready')
      const survivorReferenced = new Set(allProfilesReferencedRecordingIds())
      return { fullWipe: false, recordingIds: removedRecordingIds.filter((recordingId) => !survivorReferenced.has(recordingId)) }
    }
    await removeRawItem(PROFILE_STORAGE_KEY, true)
    container = null
    pendingProfileWrite = undefined
    clearStorageError()
    setProfileAccess('ready')
    notifyRegistry()
    return { fullWipe: true, recordingIds: [] }
  } catch (error) {
    throw reportStorageError(error)
  }
}
