import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedData } from '../data/seed'

const tauri = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}))

vi.mock('@tauri-apps/api/core', () => tauri)

import { assertProfileRecordingsAvailable, deleteRecording, listRecordingIds, MAX_RECORDING_BYTES, purgeAudioLibrary, readRecording, reconcileAudioLibrary, referencedRecordingIds, reserveRecordingRegistration, writeRecording } from './audioStorage'

describe('local audio persistence boundary', () => {
  beforeEach(() => {
    tauri.invoke.mockReset()
    tauri.isTauri.mockReturnValue(true)
  })

  it('rejects unsafe IDs, empty clips, and oversized clips before native IPC', async () => {
    await expect(writeRecording('../escape', new Blob(['audio']))).rejects.toThrow('Recording IDs')
    await expect(writeRecording('empty', new Blob([]))).rejects.toThrow('empty recording')
    await expect(writeRecording('huge', new Blob([new Uint8Array(MAX_RECORDING_BYTES + 1)]))).rejects.toThrow('25 MiB')
    expect(tauri.invoke).not.toHaveBeenCalled()
  })

  it('uses raw bytes for native writes and reconstructs a typed Blob on read', async () => {
    tauri.invoke.mockResolvedValueOnce(undefined)
    await writeRecording('attempt_01', new Blob([new Uint8Array([7, 8, 9])], { type: 'audio/webm' }))
    expect(tauri.invoke).toHaveBeenCalledWith(
      'write_recording',
      new Uint8Array([7, 8, 9]),
      { headers: { 'recording-id': 'attempt_01' } },
    )

    tauri.invoke.mockResolvedValueOnce(new Uint8Array([4, 5]).buffer)
    const recording = await readRecording('attempt_01', 'audio/mp4')
    expect(recording.size).toBe(2)
    expect(recording.type).toBe('audio/mp4')
  })

  it('keeps recording deletion idempotence in the native layer', async () => {
    tauri.invoke.mockResolvedValueOnce(undefined)
    await deleteRecording('attempt_01')
    expect(tauri.invoke).toHaveBeenCalledWith('delete_recording', { recordingId: 'attempt_01' })
  })

  it('enumerates media, rejects missing import references, and reconciles orphaned audio', async () => {
    const data = createSeedData()
    data.listeningClips.push({
      id: 'clip', title: 'Clip', source: '', transcript: '', recordingId: 'kept', mimeType: 'audio/webm', durationSeconds: 5,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    tauri.invoke.mockImplementation(async (command: string) => command === 'list_recording_ids' ? ['kept', 'orphan'] : undefined)
    expect(await listRecordingIds()).toEqual(['kept', 'orphan'])
    await expect(assertProfileRecordingsAvailable(data)).resolves.toBeUndefined()
    const result = await reconcileAudioLibrary(referencedRecordingIds(data))
    expect(result).toEqual({ removed: 1, failed: 0, missing: 0 })
    expect(tauri.invoke).toHaveBeenCalledWith('delete_recording', { recordingId: 'orphan' })

    tauri.invoke.mockResolvedValueOnce([])
    await expect(assertProfileRecordingsAvailable(data)).rejects.toThrow('not present')
  })

  it('does not reconcile audio while its profile metadata registration is pending', async () => {
    const data = createSeedData()
    const release = reserveRecordingRegistration('pending_clip')
    tauri.invoke.mockImplementation(async (command: string) => command === 'list_recording_ids' ? ['pending_clip', 'old_orphan'] : undefined)

    await expect(reconcileAudioLibrary(referencedRecordingIds(data))).resolves.toEqual({ removed: 1, failed: 0, missing: 0 })
    expect(tauri.invoke).toHaveBeenCalledWith('delete_recording', { recordingId: 'old_orphan' })
    expect(tauri.invoke).not.toHaveBeenCalledWith('delete_recording', { recordingId: 'pending_clip' })

    release()
    await expect(reconcileAudioLibrary(referencedRecordingIds(data))).resolves.toEqual({ removed: 2, failed: 0, missing: 0 })
  })

  it('purges every local recording during an explicit profile deletion', async () => {
    tauri.invoke.mockImplementation(async (command: string) => command === 'list_recording_ids' ? ['voice_one', 'listen_two'] : undefined)
    await expect(purgeAudioLibrary()).resolves.toBe(2)
    expect(tauri.invoke).toHaveBeenCalledWith('delete_recording', { recordingId: 'voice_one' })
    expect(tauri.invoke).toHaveBeenCalledWith('delete_recording', { recordingId: 'listen_two' })
  })
})
