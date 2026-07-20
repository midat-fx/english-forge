import { invoke, isTauri } from '@tauri-apps/api/core'
import type { ForgeData } from '../domain/types'

export const MAX_RECORDING_BYTES = 25 * 1024 * 1024

const AUDIO_DATABASE = 'english-forge-audio-v1'
const AUDIO_STORE = 'recordings'
const RECORDING_ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/
let databasePromise: Promise<IDBDatabase> | undefined
const pendingRecordingRegistrations = new Set<string>()

function assertRecordingId(recordingId: string): void {
  if (!RECORDING_ID_PATTERN.test(recordingId)) {
    throw new Error('Recording IDs must contain 1-96 ASCII letters, numbers, hyphens, or underscores.')
  }
}

function assertRecordingSize(blob: Blob): void {
  if (blob.size === 0) throw new Error('An empty recording cannot be saved.')
  if (blob.size > MAX_RECORDING_BYTES) throw new Error('A single recording cannot exceed the 25 MiB local-audio limit.')
}

/**
 * Protects the write-bytes → commit-metadata window from orphan cleanup.
 * A crashed registration is intentionally forgotten on next launch, when the
 * unreferenced file can safely be reconciled.
 */
export function reserveRecordingRegistration(recordingId: string): () => void {
  assertRecordingId(recordingId)
  if (pendingRecordingRegistrations.has(recordingId)) throw new Error('This recording is already being registered.')
  pendingRecordingRegistrations.add(recordingId)
  let active = true
  return () => {
    if (!active) return
    active = false
    pendingRecordingRegistrations.delete(recordingId)
  }
}

function openAudioDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('This browser cannot provide local recording storage.'))
  }
  if (databasePromise) return databasePromise
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(AUDIO_DATABASE, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(AUDIO_STORE)) database.createObjectStore(AUDIO_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Cannot open local recording storage.'))
    request.onblocked = () => reject(new Error('Local recording storage is blocked by another English Forge window.'))
  })
  databasePromise = opening.catch((error) => {
    databasePromise = undefined
    throw error
  })
  return databasePromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('A local recording storage operation failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('A local recording transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('A local recording transaction was cancelled.'))
  })
}

async function writeBrowserRecording(recordingId: string, blob: Blob): Promise<void> {
  const database = await openAudioDatabase()
  const transaction = database.transaction(AUDIO_STORE, 'readwrite')
  transaction.objectStore(AUDIO_STORE).put(blob, recordingId)
  await transactionComplete(transaction)
}

async function readBrowserRecording(recordingId: string, mimeType: string): Promise<Blob> {
  const database = await openAudioDatabase()
  const transaction = database.transaction(AUDIO_STORE, 'readonly')
  const stored = await requestResult(transaction.objectStore(AUDIO_STORE).get(recordingId))
  if (stored instanceof Blob) return stored.type || !mimeType ? stored : stored.slice(0, stored.size, mimeType)
  if (stored instanceof ArrayBuffer) return new Blob([stored], { type: mimeType })
  throw new Error('The requested recording does not exist in this browser.')
}

async function deleteBrowserRecording(recordingId: string): Promise<void> {
  const database = await openAudioDatabase()
  const transaction = database.transaction(AUDIO_STORE, 'readwrite')
  transaction.objectStore(AUDIO_STORE).delete(recordingId)
  await transactionComplete(transaction)
}

async function listBrowserRecordingIds(): Promise<string[]> {
  const database = await openAudioDatabase()
  const transaction = database.transaction(AUDIO_STORE, 'readonly')
  const keys = await requestResult(transaction.objectStore(AUDIO_STORE).getAllKeys())
  return keys.filter((key): key is string => typeof key === 'string' && RECORDING_ID_PATTERN.test(key)).sort()
}

/** Store audio bytes outside the portable ForgeData JSON profile. */
export async function writeRecording(recordingId: string, blob: Blob): Promise<void> {
  assertRecordingId(recordingId)
  assertRecordingSize(blob)
  if (!isTauri()) return writeBrowserRecording(recordingId, blob)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  await invoke<void>('write_recording', bytes, { headers: { 'recording-id': recordingId } })
}

/** Load a local recording. The MIME type is metadata owned by the caller's profile record. */
// Без контейнерного ярлыка по умолчанию: байты, записанные на этой машине,
// могут быть mp4 (WKWebView) или webm (Chromium в разработке). Неверный ярлык
// заставляет WKWebView молча отказаться декодировать, поэтому при неизвестном
// mime отдаём блоб без типа — движок определит контейнер по сигнатуре.
export async function readRecording(recordingId: string, mimeType = ''): Promise<Blob> {
  assertRecordingId(recordingId)
  if (!isTauri()) return readBrowserRecording(recordingId, mimeType)
  const response = await invoke<ArrayBuffer | Uint8Array | number[]>('read_recording', { recordingId })
  const bytes = response instanceof ArrayBuffer
    ? new Uint8Array(response)
    : response instanceof Uint8Array
      ? response
      : Uint8Array.from(response)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: mimeType })
}

/** Delete audio bytes only; callers should separately remove their profile metadata. */
export async function deleteRecording(recordingId: string): Promise<void> {
  assertRecordingId(recordingId)
  if (!isTauri()) return deleteBrowserRecording(recordingId)
  await invoke<void>('delete_recording', { recordingId })
}

export async function listRecordingIds(): Promise<string[]> {
  if (!isTauri()) return listBrowserRecordingIds()
  return invoke<string[]>('list_recording_ids')
}

type RecordingReferenceData = Pick<ForgeData, 'listeningClips' | 'speakingAttempts'>

export function referencedRecordingIds(data: RecordingReferenceData): string[] {
  return [...new Set([
    ...data.listeningClips.map((clip) => clip.recordingId),
    ...data.speakingAttempts.map((attempt) => attempt.recordingId).filter((id): id is string => Boolean(id)),
  ])]
}

export async function assertProfileRecordingsAvailable(data: RecordingReferenceData): Promise<void> {
  const available = new Set(await listRecordingIds())
  const missing = referencedRecordingIds(data).filter((recordingId) => !available.has(recordingId))
  if (missing.length) throw new Error(`This profile references ${missing.length} local audio file${missing.length === 1 ? '' : 's'} that ${missing.length === 1 ? 'is' : 'are'} not present on this device. Import was not applied.`)
}

/**
 * Reconcile the shared, un-namespaced recording store against the recordings
 * referenced by EVERY local profile. The audio directory is one flat namespace,
 * so orphan cleanup must see all tenants' references — passing only the active
 * profile would silently delete other learners' audio.
 */
export async function reconcileAudioLibrary(referencedIds: Iterable<string>): Promise<{ removed: number; failed: number; missing: number }> {
  const referenced = new Set(referencedIds)
  const available = new Set(await listRecordingIds())
  const orphaned = [...available].filter((recordingId) => !referenced.has(recordingId) && !pendingRecordingRegistrations.has(recordingId))
  const results = await Promise.allSettled(orphaned.map((recordingId) => deleteRecording(recordingId)))
  return {
    removed: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
    missing: [...referenced].filter((recordingId) => !available.has(recordingId)).length,
  }
}

/** Explicit profile deletion must remove media even before the app shell mounts. */
export async function purgeAudioLibrary(): Promise<number> {
  const recordingIds = await listRecordingIds()
  const results = await Promise.allSettled(recordingIds.map((recordingId) => deleteRecording(recordingId)))
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length) throw new Error(`Could not remove ${failures.length} local audio recording${failures.length === 1 ? '' : 's'}. Retry profile deletion before starting over.`)
  return recordingIds.length
}
