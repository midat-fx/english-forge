import { discardPersistedProfile } from '../data/profileStorage'
import { deleteRecording, purgeAudioLibrary } from './audioStorage'

interface ProfileDeletionDependencies {
  discardProfile: () => Promise<{ fullWipe: boolean; recordingIds: string[] }>
  purgeAllMedia: () => Promise<number>
  removeRecording: (recordingId: string) => Promise<void>
}

export interface ProfileDeletionResult {
  removedRecordings: number
  mediaCleanupError?: Error
}

/**
 * Commit the durable profile deletion before removing referenced media. If
 * profile deletion fails, every recording remains recoverable. When only the
 * active profile is removed (other learners remain) only its own recordings are
 * deleted; a full wipe of the last profile purges all audio. A later media
 * failure leaves only unreferenced orphans, which startup reconciliation can
 * retry without reviving or corrupting a surviving profile.
 */
export async function discardProfileThenPurgeMedia(
  dependencies: ProfileDeletionDependencies = {
    discardProfile: discardPersistedProfile,
    purgeAllMedia: purgeAudioLibrary,
    removeRecording: deleteRecording,
  },
): Promise<ProfileDeletionResult> {
  const outcome = await dependencies.discardProfile()
  try {
    if (outcome.fullWipe) return { removedRecordings: await dependencies.purgeAllMedia() }
    let removedRecordings = 0
    for (const recordingId of outcome.recordingIds) {
      await dependencies.removeRecording(recordingId)
      removedRecordings += 1
    }
    return { removedRecordings }
  } catch (error) {
    return {
      removedRecordings: 0,
      mediaCleanupError: error instanceof Error ? error : new Error(String(error)),
    }
  }
}
