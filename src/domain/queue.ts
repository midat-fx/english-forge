import { isDue } from './scheduler'
import { hasQualifiedActivationThrough } from './activation'
import { catalogItemIdsFromTags, DAILY_NEW_ITEM_COUNT, isDailyVocabularyAssignmentFor, isPracticeReadyPhrase } from './dailyVocabulary'
import type { DailyVocabularyAssignment, Phrase, Preferences, ReviewEvent, Skill, SkillState } from './types'

export interface PracticeQueueItem { phraseId: string; skill: Skill }
export const PRACTICE_MINUTES_PER_TASK = 1.5
export const PRACTICE_EXPOSURE_GAP_MS = 12 * 60 * 60 * 1000

export function practiceTaskCapacityForMinutes(minutes: number): number {
  return Math.min(30, Math.max(3, Math.floor(minutes / PRACTICE_MINUTES_PER_TASK)))
}

export function estimatePracticeMinutes(taskCount: number): number {
  return Math.ceil(taskCount * PRACTICE_MINUTES_PER_TASK)
}

export function dailyReviewPlan(dueNow: number, reviewedToday: number, dailyMinutes: number, reservedTasks = 0) {
  const totalLimit = practiceTaskCapacityForMinutes(dailyMinutes)
  const estimatedDueAtDayStart = Math.max(0, dueNow) + Math.max(0, reviewedToday)
  const minimumReviewLane = estimatedDueAtDayStart > 0 ? 1 : 0
  const limit = Math.max(minimumReviewLane, totalLimit - Math.max(0, reservedTasks))
  const quota = Math.min(estimatedDueAtDayStart, limit)
  const completed = Math.min(quota, Math.max(0, reviewedToday))
  return { quota, completed, remaining: Math.max(0, quota - completed), backlog: Math.max(0, dueNow) }
}

/**
 * Feedback is an exposure even when the learner closes the page before rating.
 * Review history remains a compatibility fallback for profiles created before
 * explicit exposure events were introduced.
 */
export function phraseHasRecentPracticeExposure(
  phrase: Pick<Phrase, 'id' | 'createdAt' | 'evidenceResetAt' | 'practiceExposures'>,
  reviews: readonly ReviewEvent[],
  now = new Date(),
  ignoredSessionKey?: string,
): boolean {
  const nowTime = now.getTime()
  const createdAt = new Date(phrase.createdAt).getTime()
  const resetAt = phrase.evidenceResetAt
    ? Math.max(createdAt, new Date(phrase.evidenceResetAt).getTime())
    : createdAt
  const recent = (value: string) => {
    const at = new Date(value).getTime()
    return Number.isFinite(at) && at >= resetAt && at <= nowTime && nowTime - at < PRACTICE_EXPOSURE_GAP_MS
  }
  return (phrase.practiceExposures ?? []).some((exposure) => exposure.sessionKey !== ignoredSessionKey && recent(exposure.exposedAt))
    || reviews.some((review) => review.targetType === 'phrase' && review.targetId === phrase.id && review.idempotencyKey !== ignoredSessionKey && recent(review.reviewedAt))
}

export function wasDueWhenReviewed(review: Pick<ReviewEvent, 'dueBefore' | 'reviewedAt'>): boolean {
  return new Date(review.dueBefore).getTime() <= new Date(review.reviewedAt).getTime()
}

export function buildPracticeQueue(
  skillStates: SkillState[],
  phrases: Phrase[],
  preferences: Preferences,
  now = new Date(),
  allowedSkills?: Skill[],
  dailyAssignment?: DailyVocabularyAssignment | null,
  reviews: readonly ReviewEvent[] = [],
): PracticeQueueItem[] {
  const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]))
  const assignedToday = isDailyVocabularyAssignmentFor(dailyAssignment, preferences.currentLevel, now)
    ? new Set(dailyAssignment.enrolledIds)
    : new Set<string>()
  const isAssignedToday = (phraseId: string) => {
    const phrase = phraseById.get(phraseId)
    const catalogItemIds = phrase ? catalogItemIdsFromTags(phrase.tags) : []
    return catalogItemIds.some((itemId) => assignedToday.has(itemId))
  }
  const due = skillStates
    .filter((state) => {
      const phrase = phraseById.get(state.phraseId)
      if (!phrase || (phrase.activationStage ?? 0) < 7 || !hasQualifiedActivationThrough(phrase, 6, now) || state.skill === 'spoken_productive' || (allowedSkills && !allowedSkills.includes(state.skill)) || phrase.status === 'archived' || !isPracticeReadyPhrase(phrase) || !isDue(state, now) || phraseHasRecentPracticeExposure(phrase, reviews, now)) return false
      return true
    })
    .sort((a, b) => Number(isAssignedToday(b.phraseId)) - Number(isAssignedToday(a.phraseId)) || a.dueAt.localeCompare(b.dueAt))

  const allowedNewIds = new Set<string>()
  if (assignedToday.size) {
    for (const state of due) if (phraseById.get(state.phraseId)?.status === 'new' && isAssignedToday(state.phraseId)) allowedNewIds.add(state.phraseId)
  } else {
    for (const state of due) {
      const phrase = phraseById.get(state.phraseId)
      if (phrase?.status === 'new' && !allowedNewIds.has(phrase.id) && allowedNewIds.size < DAILY_NEW_ITEM_COUNT) allowedNewIds.add(phrase.id)
    }
  }
  const filtered = due.filter((state) => phraseById.get(state.phraseId)?.status !== 'new' || allowedNewIds.has(state.phraseId))
  const buckets = new Map<string, SkillState[]>()
  for (const state of filtered) buckets.set(state.phraseId, [...(buckets.get(state.phraseId) ?? []), state])
  let bucketIndex = 0
  for (const [phraseId, states] of buckets) {
    if (states.length > 1) {
      const offset = bucketIndex % states.length
      buckets.set(phraseId, [...states.slice(offset), ...states.slice(0, offset)])
    }
    bucketIndex += 1
  }

  const limit = practiceTaskCapacityForMinutes(preferences.dailyMinutes)
  // Feedback exposes the target form. A second skill for the same phrase in
  // this session would therefore be supported practice, not delayed retrieval.
  // Keep at most one due skill per phrase and leave its siblings due for a
  // later session; the per-bucket rotation still varies the selected skill.
  return [...buckets.entries()]
    .slice(0, limit)
    .flatMap(([phraseId, states]) => states[0] ? [{ phraseId, skill: states[0].skill }] : [])
}
