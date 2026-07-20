import { describe, expect, it, vi } from 'vitest'
import { discardProfileThenPurgeMedia } from './profileDeletion'

describe('durable profile deletion order', () => {
  it('purges all media only on a full wipe of the last profile', async () => {
    const order: string[] = []
    const result = await discardProfileThenPurgeMedia({
      discardProfile: vi.fn(async () => { order.push('profile'); return { fullWipe: true, recordingIds: [] } }),
      purgeAllMedia: vi.fn(async () => { order.push('media'); return 3 }),
      removeRecording: vi.fn(async () => { order.push('single') }),
    })
    expect(order).toEqual(['profile', 'media'])
    expect(result).toEqual({ removedRecordings: 3 })
  })

  it('removes only the deleted profile’s recordings when other profiles remain', async () => {
    const purgeAllMedia = vi.fn(async () => 99)
    const removed: string[] = []
    const result = await discardProfileThenPurgeMedia({
      discardProfile: vi.fn(async () => ({ fullWipe: false, recordingIds: ['voice_a', 'listen_b'] })),
      purgeAllMedia,
      removeRecording: vi.fn(async (id: string) => { removed.push(id) }),
    })
    expect(removed).toEqual(['voice_a', 'listen_b'])
    expect(purgeAllMedia).not.toHaveBeenCalled()
    expect(result).toEqual({ removedRecordings: 2 })
  })

  it('keeps every recording when durable profile deletion fails', async () => {
    const purgeAllMedia = vi.fn(async () => 1)
    await expect(discardProfileThenPurgeMedia({
      discardProfile: vi.fn(async () => { throw new Error('profile still exists') }),
      purgeAllMedia,
      removeRecording: vi.fn(async () => undefined),
    })).rejects.toThrow('profile still exists')
    expect(purgeAllMedia).not.toHaveBeenCalled()
  })

  it('reports media cleanup as retryable after the profile is already gone', async () => {
    const result = await discardProfileThenPurgeMedia({
      discardProfile: vi.fn(async () => ({ fullWipe: true, recordingIds: [] })),
      purgeAllMedia: vi.fn(async () => { throw new Error('retry orphan cleanup') }),
      removeRecording: vi.fn(async () => undefined),
    })
    expect(result.removedRecordings).toBe(0)
    expect(result.mediaCleanupError).toEqual(new Error('retry orphan cleanup'))
  })
})
