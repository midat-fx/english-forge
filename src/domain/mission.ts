import { includesPhrase, normalizePhrase } from './normalization'
import { hasQualifiedActivationThrough } from './activation'
import { isIndependentWrittenProductiveEvidence } from './reviewEvidence'
import { isPracticeReadyPhrase } from './dailyVocabulary'
import type { CEFRLevel, Mission, Phrase, ReviewEvent, SkillState } from './types'

export interface MissionRequirements {
  minWords: number
  maxWords: number
  minTargetPhrases: number
  maxTargetPhrases: number
}

export const MISSION_REQUIREMENTS_BY_LEVEL: Readonly<Record<CEFRLevel, MissionRequirements>> = {
  A2: { minWords: 40, maxWords: 70, minTargetPhrases: 1, maxTargetPhrases: 2 },
  B1: { minWords: 80, maxWords: 120, minTargetPhrases: 2, maxTargetPhrases: 2 },
  B2: { minWords: 120, maxWords: 180, minTargetPhrases: 3, maxTargetPhrases: 3 },
  C1: { minWords: 120, maxWords: 180, minTargetPhrases: 3, maxTargetPhrases: 3 },
}

export function missionRequirementsForLevel(level: CEFRLevel): MissionRequirements {
  return MISSION_REQUIREMENTS_BY_LEVEL[level]
}

export function missionDraftHasLexicalVariety(draft: string): boolean {
  const words = draft.toLocaleLowerCase('en-US').match(/[a-z]+(?:['’][a-z]+)*/gu) ?? []
  if (!words.length) return false
  const counts = new Map<string, number>()
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)
  const requiredUnique = Math.min(12, Math.ceil(words.length * 0.25))
  const dominantShare = Math.max(...counts.values()) / words.length
  return counts.size >= requiredUnique && dominantShare <= 0.2
}

export function missionWordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/u).length : 0
}

/** Recomputes current mission completion from the saved response and phrase forms. */
export function completedMissionEvidenceIsValid(mission: Mission, phrases: readonly Phrase[]): boolean {
  if (mission.legacyContract || mission.status !== 'done' || !mission.completedAt || mission.selfConfirmedAt !== mission.completedAt || !mission.response?.trim()) return false
  if (new Date(mission.completedAt).getTime() < new Date(mission.createdAt).getTime()) return false
  if (normalizePhrase(mission.response) !== normalizePhrase(mission.draft)) return false
  const words = missionWordCount(mission.response)
  if (words < mission.minWords || words > mission.maxWords || !missionDraftHasLexicalVariety(mission.response)) return false
  if (mission.targetResults.length !== mission.targetPhraseIds.length || mission.targetResults.some((result) => !result.confirmed)) return false
  return mission.targetPhraseIds.every((phraseId) => {
    const phrase = phrases.find((candidate) => candidate.id === phraseId)
    return Boolean(phrase && includesPhrase(mission.response!, phrase.canonical, phrase.acceptedForms))
  })
}

export function missionConfigurationIsValid(
  mission: Pick<Mission, 'level' | 'minWords' | 'maxWords' | 'targetPhraseCount' | 'targetPhraseIds'>,
  phrases: readonly Phrase[],
): boolean {
  const requirements = missionRequirementsForLevel(mission.level)
  const targets = new Set(mission.targetPhraseIds)
  if (mission.minWords !== requirements.minWords || mission.maxWords !== requirements.maxWords) return false
  if (mission.targetPhraseCount !== mission.targetPhraseIds.length || targets.size !== mission.targetPhraseIds.length) return false
  if (targets.size < requirements.minTargetPhrases || targets.size > requirements.maxTargetPhrases) return false
  return [...targets].every((id) => phrases.some((phrase) => phrase.id === id && phrase.cefr === mission.level && phrase.status !== 'needs_enrichment'))
}

export function missionTargetWasEligibleAt(
  phrase: Phrase,
  reviews: readonly ReviewEvent[],
  at: Date,
): boolean {
  if (hasQualifiedActivationThrough(phrase, 5, at)) return true
  return reviews.some((review) => isIndependentWrittenProductiveEvidence(review, phrase, reviews, at))
}

export function missionTargetsWereEligibleAt(
  mission: Pick<Mission, 'targetPhraseIds' | 'createdAt'>,
  phrases: readonly Phrase[],
  reviews: readonly ReviewEvent[],
): boolean {
  const createdAt = new Date(mission.createdAt)
  return mission.targetPhraseIds.every((id) => {
    const phrase = phrases.find((candidate) => candidate.id === id)
    return Boolean(phrase && missionTargetWasEligibleAt(phrase, reviews, createdAt))
  })
}

/**
 * Missions transfer material that the learner has already encountered; they
 * must not silently introduce untouched library items. Activation-cycle
 * evidence is ranked first, then other attempted items that are due for
 * written production.
 */
export function selectMissionTargetIds(
  phrases: readonly Phrase[],
  skillStates: readonly SkillState[],
  reviews: readonly ReviewEvent[],
  level: CEFRLevel,
  limit: number,
  now = new Date(),
): string[] {
  if (limit <= 0) return []
  const statesByPhrase = new Map<string, SkillState[]>()
  for (const state of skillStates) statesByPhrase.set(state.phraseId, [...(statesByPhrase.get(state.phraseId) ?? []), state])
  const latestIndependentProductiveReview = new Map<string, number>()
  for (const review of reviews) {
    const phrase = phrases.find((candidate) => candidate.id === review.targetId)
    if (!phrase || !isIndependentWrittenProductiveEvidence(review, phrase, reviews, now)) continue
    const reviewedAt = new Date(review.reviewedAt).getTime()
    latestIndependentProductiveReview.set(review.targetId, Math.max(latestIndependentProductiveReview.get(review.targetId) ?? Number.NEGATIVE_INFINITY, reviewedAt))
  }

  return phrases
    .filter((phrase) => {
      if (phrase.cefr !== level || phrase.status === 'archived' || phrase.status === 'needs_enrichment') return false
      if (!isPracticeReadyPhrase(phrase)) return false
      const states = statesByPhrase.get(phrase.id) ?? []
      if (states.length && states.every((state) => state.phase === 'suspended')) return false
      const resetAt = phrase.evidenceResetAt ? new Date(phrase.evidenceResetAt).getTime() : Number.NEGATIVE_INFINITY
      const latestProductiveAt = latestIndependentProductiveReview.get(phrase.id)
      const productiveEvidence = latestProductiveAt !== undefined && latestProductiveAt >= resetAt
      return hasQualifiedActivationThrough(phrase, 5, now) || productiveEvidence
    })
    .map((phrase) => {
      const states = statesByPhrase.get(phrase.id) ?? []
      const productiveState = states.find((state) => state.skill === 'written_productive' && state.phase !== 'suspended')
      return {
        phrase,
        activationEvidence: hasQualifiedActivationThrough(phrase, 5, now),
        activationStage: phrase.activationStage ?? 0,
        productiveDue: Boolean(productiveState && new Date(productiveState.dueAt).getTime() <= now.getTime()),
        productiveDueAt: productiveState?.dueAt ?? '9999-12-31T23:59:59.999Z',
      }
    })
    .sort((left, right) => Number(right.activationEvidence) - Number(left.activationEvidence)
      || right.activationStage - left.activationStage
      || Number(right.productiveDue) - Number(left.productiveDue)
      || left.productiveDueAt.localeCompare(right.productiveDueAt)
      || left.phrase.createdAt.localeCompare(right.phrase.createdAt)
      || left.phrase.id.localeCompare(right.phrase.id))
    .slice(0, limit)
    .map(({ phrase }) => phrase.id)
}

export function reconcileConfirmedTargets(current: string[], previousDetected: string[], nextDetected: string[]): string[] {
  return Array.from(new Set([
    ...current.filter((id) => !previousDetected.includes(id)),
    ...nextDetected,
  ]))
}
