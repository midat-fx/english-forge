import { afterEach, describe, expect, it, vi } from 'vitest'

const tauriApi = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
}))

vi.mock('@tauri-apps/api/core', () => tauriApi)
import { createSeedData } from './seed'
import { allProfilesReferencedRecordingIds, clearStorageError, createProfileEntry, discardPersistedProfile, enterProfileRecovery, getProfileAccess, getProfilesSnapshot, profileStorage, replacePersistedProfile, resetProfileContainerForTests, retryPendingProfileWrite, STORAGE_ERROR_EVENT, zustandProfileStorage } from './profileStorage'
import { PROFILE_STORAGE_KEY } from './serialization'

describe('profile persistence health', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    tauriApi.invoke.mockReset()
    tauriApi.isTauri.mockReset()
    tauriApi.isTauri.mockReturnValue(false)
    localStorage.clear()
    resetProfileContainerForTests()
    clearStorageError()
  })

  const clipWith = (recordingId: string) => ({ id: `clip-${recordingId}`, title: 'Clip', source: '', transcript: '', recordingId, mimeType: 'audio/webm', durationSeconds: 5, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' })

  it('references recordings from every profile so shared-audio reconciliation cannot delete another profile’s audio', async () => {
    const dataA = createSeedData()
    dataA.listeningClips = [clipWith('listen_a')]
    dataA.speakingAttempts = []
    await replacePersistedProfile(dataA)

    await createProfileEntry('Друг')
    const dataB = createSeedData()
    dataB.listeningClips = [clipWith('listen_b')]
    dataB.speakingAttempts = []
    await replacePersistedProfile(dataB)

    expect(allProfilesReferencedRecordingIds().sort()).toEqual(['listen_a', 'listen_b'])
  })

  it('recovery discard removes only the active profile and keeps the others', async () => {
    await replacePersistedProfile(createSeedData())
    await createProfileEntry('Друг')
    await replacePersistedProfile(createSeedData())
    expect(getProfilesSnapshot().profiles).toHaveLength(2)

    const outcome = await discardPersistedProfile()
    expect(outcome.fullWipe).toBe(false)
    expect(getProfileAccess()).toBe('ready')
    // The other learner's profile survives and becomes active.
    const remaining = getProfilesSnapshot()
    expect(remaining.profiles).toHaveLength(1)
    expect(remaining.profiles[0].name).toBe('Мой профиль')
    expect(remaining.activeId).toBe(remaining.profiles[0].id)
  })

  it('wipes the whole document only when it is the last profile', async () => {
    await replacePersistedProfile(createSeedData())
    const outcome = await discardPersistedProfile()
    expect(outcome.fullWipe).toBe(true)
  })

  it('surfaces browser quota failures instead of reporting a silent save', async () => {
    const errors: string[] = []
    window.addEventListener(STORAGE_ERROR_EVENT, (event) => errors.push((event as CustomEvent<string>).detail), { once: true })
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => { throw new Error('Quota exceeded') })
    await expect(profileStorage.setItem('profile', '{}')).rejects.toThrow('Quota exceeded')
    expect(errors).toEqual(['Quota exceeded'])
    await expect(retryPendingProfileWrite()).resolves.toBe(true)
    expect(localStorage.getItem('profile')).toBe('{}')
  })

  it('turns a Zustand async write rejection into a retryable visible failure', async () => {
    const errors: string[] = []
    window.addEventListener(STORAGE_ERROR_EVENT, (event) => errors.push((event as CustomEvent<string>).detail), { once: true })
    const originalSetItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem')
      .mockImplementationOnce(() => { throw new Error('Zustand quota failure') })
      .mockImplementation((name, value) => originalSetItem(name, value))

    await expect(zustandProfileStorage.setItem('profile', 'latest-snapshot')).resolves.toBeUndefined()
    expect(errors).toEqual(['Zustand quota failure'])
    await expect(retryPendingProfileWrite()).resolves.toBe(true)
    expect(localStorage.getItem('profile')).toBe('latest-snapshot')
  })

  it('reports explicit durable replacement failures to the global alert', async () => {
    const errors: string[] = []
    window.addEventListener(STORAGE_ERROR_EVENT, (event) => errors.push((event as CustomEvent<string>).detail), { once: true })
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => { throw new Error('Durable commit failed') })

    await expect(replacePersistedProfile(createSeedData())).rejects.toThrow('Durable commit failed')
    expect(errors).toEqual(['Durable commit failed'])
  })

  it('round-trips the browser fallback profile exactly', async () => {
    await profileStorage.setItem('profile', '{"state":"complete"}')
    await expect(profileStorage.getItem('profile')).resolves.toBe('{"state":"complete"}')
  })

  it('never retries an older failed snapshot over a newer successful write', async () => {
    const originalSetItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem')
      .mockImplementationOnce(() => { throw new Error('Temporary write failure') })
      .mockImplementation((name, value) => originalSetItem(name, value))

    await expect(profileStorage.setItem('profile', 'snapshot-a')).rejects.toThrow('Temporary write failure')
    await expect(profileStorage.setItem('profile', 'snapshot-b')).resolves.toBeUndefined()
    await expect(retryPendingProfileWrite()).resolves.toBe(true)

    expect(localStorage.getItem('profile')).toBe('snapshot-b')
    expect(localStorage.setItem).toHaveBeenCalledTimes(2)
  })

  it('never queues a failed native snapshot ahead of a newer native write', async () => {
    tauriApi.isTauri.mockReturnValue(true)
    tauriApi.invoke
      .mockRejectedValueOnce(new Error('Temporary native write failure'))
      .mockResolvedValue(undefined)

    await expect(profileStorage.setItem('profile', 'snapshot-a')).rejects.toThrow('Temporary native write failure')
    const retry = retryPendingProfileWrite()
    const newerWrite = profileStorage.setItem('profile', 'snapshot-b')

    await expect(retry).resolves.toBe(true)
    await expect(newerWrite).resolves.toBeUndefined()
    expect(tauriApi.invoke).toHaveBeenCalledTimes(2)
    expect(tauriApi.invoke.mock.calls).toEqual([
      ['write_profile', { contents: 'snapshot-a' }],
      ['write_profile', { contents: 'snapshot-b' }],
    ])
  })

  it('preserves the original profile while recovery mode locks ordinary writes', async () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, 'original-profile')
    enterProfileRecovery(new Error('Unreadable profile'))
    await expect(profileStorage.setItem(PROFILE_STORAGE_KEY, 'accidental-overwrite')).rejects.toThrow('locked')
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBe('original-profile')
    await replacePersistedProfile(createSeedData())
    expect(getProfileAccess()).toBe('ready')
    const restored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? '{}')
    expect(restored.profiles[restored.activeId].envelope.version).toBe(6)
  })
})
