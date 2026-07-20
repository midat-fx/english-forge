import { responseMatchesPractice } from './practice'
import { phraseHasRecentPracticeExposure } from './queue'
import { effectiveGrade, initialSkillState, scheduleReview } from './scheduler'
import { speakingEvidencePhraseIds } from './speaking'
import type { ForgeData, Grade, Phrase, Skill, SkillState } from './types'

const DAY_MS = 86_400_000
const SKILLS = ['meaning_recall', 'cloze', 'written_productive', 'spoken_productive'] as const satisfies readonly Skill[]
const INITIAL_DELAYS: Readonly<Record<(typeof SKILLS)[number], number>> = {
  meaning_recall: 0,
  cloze: DAY_MS,
  written_productive: 3 * DAY_MS,
  spoken_productive: 3 * DAY_MS,
}

export function initialPhraseSkillStates(phrase: Pick<Phrase, 'id' | 'createdAt' | 'evidenceResetAt'>): SkillState[] {
  const baseline = new Date(phrase.evidenceResetAt ?? phrase.createdAt)
  return SKILLS.map((skill) => ({
    ...initialSkillState(phrase.id, skill, baseline),
    dueAt: new Date(baseline.getTime() + INITIAL_DELAYS[skill]).toISOString(),
  }))
}

interface RawSkillEvent {
  id: string
  phraseId: string
  skill: Skill
  grade: Grade
  at: number
}

/**
 * Rebuilds mutable SRS summaries from current, recomputable review and voice
 * evidence. Imported phase/mastery/due fields can therefore never hide work
 * or block a legitimate new response on their own.
 */
export function rebuildSkillStates(data: Pick<ForgeData, 'phrases' | 'reviews' | 'speakingAttempts' | 'skillStates'>, now = new Date()): SkillState[] {
  const phrasesById = new Map(data.phrases.map((phrase) => [phrase.id, phrase]))
  const events: RawSkillEvent[] = []
  for (const review of data.reviews) {
    if (review.targetType !== 'phrase' || review.skill === 'spoken_productive') continue
    const phrase = phrasesById.get(review.targetId)
    const at = new Date(review.reviewedAt).getTime()
    const createdAt = phrase ? new Date(phrase.createdAt).getTime() : Number.POSITIVE_INFINITY
    const resetAt = phrase?.evidenceResetAt ? Math.max(createdAt, new Date(phrase.evidenceResetAt).getTime()) : createdAt
    if (!phrase || !Number.isFinite(at) || at < resetAt || at > now.getTime()) continue
    const answerMatched = responseMatchesPractice(phrase, review.skill, review.response)
    const inheritedExposure = phraseHasRecentPracticeExposure(phrase, data.reviews, new Date(at), review.idempotencyKey)
    const supportPenalty = review.supportUsed === false && !inheritedExposure ? 0 : 1
    events.push({
      id: review.id,
      phraseId: phrase.id,
      skill: review.skill,
      grade: effectiveGrade(review.grade, review.hintsUsed + supportPenalty, review.revealUsed, answerMatched),
      at,
    })
  }
  for (const attempt of data.speakingAttempts) {
    const at = new Date(attempt.createdAt).getTime()
    if (!Number.isFinite(at) || at > now.getTime()) continue
    for (const phraseId of speakingEvidencePhraseIds(attempt, data.phrases, now)) {
      events.push({ id: attempt.id, phraseId, skill: 'spoken_productive', grade: 2, at })
    }
  }
  events.sort((left, right) => left.at - right.at || left.id.localeCompare(right.id) || left.skill.localeCompare(right.skill))

  const stateByKey = new Map<string, SkillState>()
  for (const phrase of data.phrases) {
    for (const state of initialPhraseSkillStates(phrase)) stateByKey.set(`${phrase.id}:${state.skill}`, state)
  }
  for (const event of events) {
    const key = `${event.phraseId}:${event.skill}`
    const state = stateByKey.get(key)
    if (!state || (state.attempts > 0 && event.at < new Date(state.dueAt).getTime())) continue
    stateByKey.set(key, scheduleReview(state, event.grade, new Date(event.at)))
  }

  const importedByKey = new Map(data.skillStates.map((state) => [`${state.phraseId}:${state.skill}`, state]))
  return data.phrases.flatMap((phrase) => SKILLS.map((skill) => {
    const key = `${phrase.id}:${skill}`
    const derived = stateByKey.get(key)!
    const imported = importedByKey.get(key)
    const resumedAfterAutomaticSuspension = derived.phase === 'suspended'
      && imported?.phase === 'relearning'
      && imported.attempts === derived.attempts
      && imported.lastReviewedAt === derived.lastReviewedAt
    if (phrase.status === 'archived') return { ...derived, phase: 'suspended' as const }
    // A manual "soft relearning" resume forgives up to two lapses; carry that lower
    // count forward so the buffer survives a reload instead of snapping back to a
    // one-mistake re-suspend.
    if (resumedAfterAutomaticSuspension) return { ...derived, phase: 'relearning' as const, learningStep: 0, lapses: Math.min(imported.lapses, derived.lapses), consecutiveSuccesses: 0, dueAt: new Date(Math.min(new Date(imported.dueAt).getTime(), now.getTime())).toISOString() }
    return derived
  }))
}
