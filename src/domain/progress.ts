import { isAfter, startOfDay } from 'date-fns'
import { isDue } from './scheduler'
import { completedMissionEvidenceIsValid, missionTargetsWereEligibleAt } from './mission'
import { speakingEvidencePhraseIds } from './speaking'
import { isIndependentWrittenProductiveEvidence } from './reviewEvidence'
import { isPracticeReadyPhrase } from './dailyVocabulary'
import { hasQualifiedActivationThrough } from './activation'
import type { ForgeData, ProgressMetrics } from './types'

const DAY_MS = 86_400_000
const PRODUCTIVE_EVIDENCE_GAP_MS = 12 * 60 * 60 * 1000

export interface PhraseEvidence {
  productivePasses: number
  spokenPasses: number
  missionCompletedAt?: number
  activatedAt?: number
  retained: boolean
}

export type PhraseEvidenceData = Pick<ForgeData, 'phrases' | 'reviews' | 'speakingAttempts' | 'missions'>
export type ProgressData = PhraseEvidenceData & Pick<ForgeData, 'skillStates' | 'errors'>

export function calculatePhraseEvidence(data: PhraseEvidenceData, phraseId: string, now = new Date()): PhraseEvidence {
  const nowTime = now.getTime()
  const phrase = data.phrases.find((item) => item.id === phraseId)
  const evidenceResetAt = phrase?.evidenceResetAt ? new Date(phrase.evidenceResetAt).getTime() : Number.NEGATIVE_INFINITY
  const productive = data.reviews
    .filter((review) => Boolean(phrase && isIndependentWrittenProductiveEvidence(review, phrase, data.reviews, now)))
    .map((review) => new Date(review.reviewedAt).getTime())
  const spoken = data.speakingAttempts
    .filter((attempt) => speakingEvidencePhraseIds(attempt, data.phrases, now).includes(phraseId))
    .reduce<Map<string, number>>((families, attempt) => {
      const family = `${attempt.mode}:${attempt.sessionId}`
      const attemptedAt = new Date(attempt.createdAt).getTime()
      families.set(family, Math.min(families.get(family) ?? Number.POSITIVE_INFINITY, attemptedAt))
      return families
    }, new Map())
  const spokenTimes = [...spoken.values()]
  const missionCompletedAt = data.missions
    .filter((mission) => mission.supportUsed === false
      && completedMissionEvidenceIsValid(mission, data.phrases)
      && missionTargetsWereEligibleAt(mission, data.phrases, data.reviews)
      && new Date(mission.completedAt!).getTime() >= evidenceResetAt
      && new Date(mission.completedAt!).getTime() <= nowTime
      && mission.targetResults.some((target) => target.phraseId === phraseId && target.confirmed))
    .reduce<number | undefined>((earliest, mission) => {
      const completedAt = new Date(mission.completedAt!).getTime()
      return earliest === undefined ? completedAt : Math.min(earliest, completedAt)
    }, undefined)
  const allProductive = [...productive, ...spokenTimes, ...(missionCompletedAt === undefined ? [] : [missionCompletedAt])].sort((a, b) => a - b)
  const spacedProductive = allProductive.reduce<number[]>((accepted, attemptedAt) => {
    if (!accepted.length || attemptedAt - accepted.at(-1)! >= PRODUCTIVE_EVIDENCE_GAP_MS) accepted.push(attemptedAt)
    return accepted
  }, [])
  const activationCycleDone = (phrase?.activationStage ?? 0) >= 8
  const activationCycleAt = activationCycleDone ? new Date(phrase?.activationUpdatedAt ?? phrase?.updatedAt ?? 0).getTime() : undefined
  const activatedAt = activationCycleDone && activationCycleAt !== undefined && spacedProductive.length >= 2 ? Math.max(spacedProductive[1], activationCycleAt) : undefined
  const retained = activatedAt !== undefined && spacedProductive.some((reviewedAt) => reviewedAt >= activatedAt + 30 * DAY_MS && reviewedAt <= nowTime)
  return { productivePasses: spacedProductive.length, spokenPasses: spokenTimes.length, missionCompletedAt, activatedAt, retained }
}

export function calculateProgress(data: ProgressData, now = new Date()): ProgressMetrics {
  const capturedPhrases = data.phrases.filter((phrase) => phrase.status !== 'archived')
  const practicePhrases = capturedPhrases.filter(isPracticeReadyPhrase)
  const reviewsToday = data.reviews.filter((review) => isAfter(new Date(review.reviewedAt), startOfDay(now)) && new Date(review.reviewedAt) <= now)
  const rollingWeekStart = new Date(now.getTime() - 7 * DAY_MS)
  const reviewsThisWeek = data.reviews.filter((review) => isAfter(new Date(review.reviewedAt), rollingWeekStart) && new Date(review.reviewedAt) <= now)
  const missionCompletion = new Map<string, number>()
  for (const mission of data.missions) {
    if (mission.supportUsed !== false || !completedMissionEvidenceIsValid(mission, data.phrases) || !missionTargetsWereEligibleAt(mission, data.phrases, data.reviews) || new Date(mission.completedAt!) > now) continue
    for (const target of mission.targetResults) {
      if (!target.confirmed) continue
      const completedAt = new Date(mission.completedAt!).getTime()
      const resetAt = data.phrases.find((phrase) => phrase.id === target.phraseId)?.evidenceResetAt
      if (resetAt && completedAt < new Date(resetAt).getTime()) continue
      missionCompletion.set(target.phraseId, Math.min(missionCompletion.get(target.phraseId) ?? Number.POSITIVE_INFINITY, completedAt))
    }
  }
  const evidence = practicePhrases.map((phrase) => calculatePhraseEvidence(data, phrase.id, now))
  const retained = evidence.filter((item) => item.retained).length
  const provisional = evidence.filter((item) => item.activatedAt !== undefined && !item.retained).length
  const speakingAttempts = data.speakingAttempts.filter((attempt) => new Date(attempt.createdAt) <= now)
  const recordedSpeakingAttempts = speakingAttempts.filter((attempt) => Boolean(attempt.recordingId))
  const phrasesUsedInSpeech = new Set(speakingAttempts.flatMap((attempt) => speakingEvidencePhraseIds(attempt, data.phrases, now)))
  const dueSkillStates = data.skillStates.filter((state) => practicePhrases.some((phrase) => phrase.id === state.phraseId
    && (phrase.activationStage ?? 0) >= 7
    && hasQualifiedActivationThrough(phrase, 6, now)) && isDue(state, now))

  return {
    captured: capturedPhrases.length,
    due: dueSkillStates.length,
    spokenDue: dueSkillStates.filter((state) => state.skill === 'spoken_productive').length,
    reviewedToday: reviewsToday.length,
    reviewedThisWeek: reviewsThisWeek.length,
    successfulProductiveRecalls: evidence.reduce((sum, item) => sum + item.productivePasses, 0),
    phrasesUsedInMissions: missionCompletion.size,
    provisional,
    retained,
    recurringErrors: data.errors.filter((error) => error.status !== 'resolved').length,
    speakingAttempts: speakingAttempts.length,
    speakingMinutes: Math.round(recordedSpeakingAttempts.reduce((sum, attempt) => sum + attempt.durationSeconds, 0) / 6) / 10,
    phrasesUsedInSpeech: phrasesUsedInSpeech.size,
  }
}
