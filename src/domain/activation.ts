import { catalogItemIdsFromTags, isPracticeReadyPhrase, localDayKey } from './dailyVocabulary'
import { PERSONAL_CATALOG_ENRICHMENT_TAG } from './lexicalCatalog'
import { normalizePhrase } from './normalization'
import { activationErrorResponseMatches, activationRecognitionLabel, buildActivationErrorPrompt, clozeExpectedAnswer, redactAcceptedForms, responseMatchesPractice } from './practice'
import type { CEFRLevel, DailyVocabularyAssignment, Phrase, Skill } from './types'

export type ActivationMode = 'recognition' | 'context_choice' | 'cloze' | 'russian_recall' | 'own_sentence' | 'error_repair'

export interface ActivationQueueItem {
  phraseId: string
  skill: Skill
  mode: ActivationMode
}

const STEPS: readonly { skill: Skill; mode: ActivationMode }[] = [
  { skill: 'meaning_recall', mode: 'recognition' },
  { skill: 'cloze', mode: 'context_choice' },
  { skill: 'cloze', mode: 'cloze' },
  { skill: 'meaning_recall', mode: 'russian_recall' },
  { skill: 'written_productive', mode: 'own_sentence' },
  { skill: 'cloze', mode: 'error_repair' },
]

export const ACTIVATION_STEPS_BEFORE_SPEAKING = 6

export type ActivationLearningStage = 1 | 2 | 3 | 4 | 5 | 6

export type ActivationEvidencePhrase = Pick<Phrase,
  'canonical' | 'meaning' | 'context' | 'acceptedForms' | 'depth' | 'activationError' | 'activationEvents' | 'createdAt' | 'evidenceResetAt' | 'tags'>

export function canEnterActivationStepSix(phrase: Pick<Phrase, 'canonical' | 'context' | 'meaning' | 'acceptedForms' | 'depth' | 'activationError' | 'tags'>): boolean {
  const hasUsableErrorPrompt = buildActivationErrorPrompt(phrase as Phrase).kind === 'typical'
  if (!phrase.tags.includes(PERSONAL_CATALOG_ENRICHMENT_TAG)) return hasUsableErrorPrompt
  return Boolean(phrase.activationError) && hasUsableErrorPrompt
}

/** Deterministic valid response used by bundled demo evidence and fixtures. */
export function activationEvidenceResponseForStage(phrase: Phrase, stage: ActivationLearningStage): string {
  if (stage === 1) return activationRecognitionLabel(phrase)
  if (stage === 2) return redactAcceptedForms(phrase.context, phrase.canonical, phrase.acceptedForms)
  if (stage === 3) return clozeExpectedAnswer(phrase)
  if (stage === 4) return phrase.canonical
  if (stage === 5) return `Today I used ${phrase.canonical} in a clear new example.`
  return buildActivationErrorPrompt(phrase).expectedCorrection
}

/** Recomputes a stage result from the phrase snapshot and saved raw response. */
export function activationResponseMatches(phrase: ActivationEvidencePhrase, stage: ActivationLearningStage, response: string): boolean {
  const fullPhrase = phrase as Phrase
  if (!response.trim()) return false
  if (stage === 1) return normalizePhrase(response) === normalizePhrase(activationRecognitionLabel(fullPhrase))
  if (stage === 2) return normalizePhrase(response) === normalizePhrase(redactAcceptedForms(phrase.context, phrase.canonical, phrase.acceptedForms))
  if (stage === 3) return normalizePhrase(response) === normalizePhrase(clozeExpectedAnswer(fullPhrase))
  if (stage === 4) return responseMatchesPractice(fullPhrase, 'meaning_recall', response)
  if (stage === 5) return responseMatchesPractice(fullPhrase, 'written_productive', response)
  const prompt = buildActivationErrorPrompt(fullPhrase)
  return canEnterActivationStepSix(fullPhrase) && prompt.kind === 'typical' && activationErrorResponseMatches(prompt, fullPhrase, response)
}

/**
 * Rebuilds activation provenance from the append-only raw events. Persisted
 * summary counters are convenient UI state, but imports must not be able to
 * create evidence by changing `activationStage` alone.
 */
export function qualifiedActivationStageAt(phrase: ActivationEvidencePhrase, at = new Date()): number {
  const cutoff = at.getTime()
  const createdAt = new Date(phrase.createdAt).getTime()
  const resetAt = phrase.evidenceResetAt
    ? Math.max(createdAt, new Date(phrase.evidenceResetAt).getTime())
    : createdAt
  const events = [...(phrase.activationEvents ?? [])]
    .filter((event) => event.qualified !== false
      && event.supportUsed !== true
      && event.stage <= ACTIVATION_STEPS_BEFORE_SPEAKING
      && event.evidenceVersion === 1
      && typeof event.response === 'string'
      && (event.stage !== 5 || event.selfConfirmed === true)
      && activationResponseMatches(phrase, event.stage as ActivationLearningStage, event.response)
      && new Date(event.completedAt).getTime() >= resetAt
      && new Date(event.completedAt).getTime() <= cutoff)
    .sort((left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime())
  let stage = 0
  let lastAcceptedAt: number | undefined
  for (const event of events) {
    const eventAt = new Date(event.completedAt).getTime()
    if (event.stage === stage + 1 && (lastAcceptedAt === undefined || eventAt - lastAcceptedAt >= 12 * 60 * 60 * 1000)) {
      stage = event.stage
      lastAcceptedAt = eventAt
    }
    if (stage >= ACTIVATION_STEPS_BEFORE_SPEAKING) break
  }
  return stage
}

export function hasQualifiedActivationThrough(phrase: ActivationEvidencePhrase, stage: number, at = new Date()): boolean {
  return stage >= 0 && qualifiedActivationStageAt(phrase, at) >= stage
}

export function activationCapacityForMinutes(minutes: number): number {
  // This is a per-day task budget, not the number of stages in one phrase's
  // learning cycle. Keep it aligned with the Practice session capacity so a
  // five-minute plan contains three tasks rather than silently overflowing it.
  return Math.max(3, Math.min(20, Math.floor(minutes / 1.5)))
}

export function activationNewAdmissionLimit(minutes: number, dueReviews = 0): number {
  // One admitted expression creates six activation steps and, once it reaches
  // production, recurring delayed reviews. Pause fresh admissions whenever
  // the reserved SRS lane is already full; this makes the rate responsive to
  // the learner's real forgetting history instead of assuming one review.
  const total = activationCapacityForMinutes(minutes)
  const reviewReserve = total - activationTaskBudgetForMinutes(minutes)
  if (Math.max(0, dueReviews) >= reviewReserve) return 0
  return Math.max(1, Math.floor(total / (ACTIVATION_STEPS_BEFORE_SPEAKING + 3)))
}

/** Caps new catalog enrollment without preventing old stage-zero work from draining. */
export function activationNewEnrollmentLimit(minutes: number, dueReviews = 0, activationBacklog = 0): number {
  if (Math.max(0, activationBacklog) >= activationTaskBudgetForMinutes(minutes)) return 0
  return activationNewAdmissionLimit(minutes, dueReviews)
}

export function activationTaskBudgetForMinutes(minutes: number): number {
  const total = activationCapacityForMinutes(minutes)
  const reviewReserve = Math.max(1, Math.ceil(total * 0.35))
  return Math.max(0, total - reviewReserve)
}

export function activationStageIsSpaced(phrase: Pick<Phrase, 'activationEvents'>, now = new Date()): boolean {
  const latest = [...(phrase.activationEvents ?? [])]
    .filter((event) => event.stage <= ACTIVATION_STEPS_BEFORE_SPEAKING)
    .map((event) => new Date(event.completedAt).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0]
  return latest === undefined || now.getTime() - latest >= 12 * 60 * 60 * 1000
}

function atLevel(phrases: readonly Phrase[], level?: CEFRLevel): readonly Phrase[] {
  return level ? phrases.filter((phrase) => phrase.cefr === level) : phrases
}

export function activationWorkDoneToday(phrases: readonly Phrase[], now = new Date(), level?: CEFRLevel): number {
  const today = localDayKey(now)
  return atLevel(phrases, level).reduce((count, phrase) => {
    const events = phrase.activationEvents?.some((event) => event.stage <= 6 && localDayKey(new Date(event.completedAt)) === today)
    if (events) return count + 1
    const legacyStepToday = !phrase.activationEvents?.length && (phrase.activationStage ?? 0) >= 1 && (phrase.activationStage ?? 0) <= 6 && phrase.activationUpdatedAt && localDayKey(new Date(phrase.activationUpdatedAt)) === today
    return count + (legacyStepToday ? 1 : 0)
  }, 0)
}

export function activationDailyQuota(phrases: readonly Phrase[], assignment: DailyVocabularyAssignment | null, dailyMinutes: number, now = new Date(), level: CEFRLevel | undefined = assignment?.level, dueReviews = 0): number {
  const done = activationWorkDoneToday(phrases, now, level)
  const capacity = activationTaskBudgetForMinutes(dailyMinutes)
  const remaining = buildDailyActivationQueue(phrases, assignment, now, Math.max(0, capacity - done), activationNewAdmissionLimit(dailyMinutes, dueReviews), level).length
  return done + remaining
}

export function activationBacklogSize(phrases: readonly Phrase[], level?: CEFRLevel): number {
  return atLevel(phrases, level).filter((phrase) => {
    const stage = phrase.activationStage ?? 0
    return phrase.status !== 'archived'
      && phrase.status !== 'needs_enrichment'
      && stage <= 6
      && (stage !== 5 || canEnterActivationStepSix(phrase))
  }).length
}

export function activationBlockedByMissingErrorPattern(phrases: readonly Phrase[], level?: CEFRLevel): number {
  return atLevel(phrases, level).filter((phrase) => phrase.status !== 'archived' && phrase.status !== 'needs_enrichment' && (phrase.activationStage ?? 0) === 5 && !canEnterActivationStepSix(phrase)).length
}

export function buildDailyActivationQueue(
  phrases: readonly Phrase[],
  assignment: DailyVocabularyAssignment | null,
  now = new Date(),
  limit = 20,
  newAdmissionLimit = Math.floor(limit / (ACTIVATION_STEPS_BEFORE_SPEAKING + 3)),
  level: CEFRLevel | undefined = assignment?.level,
): ActivationQueueItem[] {
  const today = localDayKey(now)
  const assigned = new Set(assignment?.enrolledIds ?? [])
  const scopedPhrases = atLevel(phrases, level)
  const eligible = scopedPhrases
    .filter((phrase) => phrase.status !== 'archived' && isPracticeReadyPhrase(phrase) && (phrase.activationStage ?? 0) < 6)
    // Recognition through original production use only reviewed bilingual
    // fields. The authored error pair is required precisely when Step 6 is
    // reached, so a personal reference can make safe progress without being
    // misrepresented as a complete activation route.
    .filter((phrase) => (phrase.activationStage ?? 0) !== 5 || canEnterActivationStepSix(phrase))
    .filter((phrase) => {
      const completedToday = phrase.activationEvents?.some((event) => event.stage <= 6 && localDayKey(new Date(event.completedAt)) === today)
      if (completedToday) return false
      return phrase.activationEvents?.length
        ? activationStageIsSpaced(phrase, now)
        : (phrase.activationStage ?? 0) === 0 || !phrase.activationUpdatedAt || localDayKey(new Date(phrase.activationUpdatedAt)) !== today
    })
  const sortEligible = (left: Phrase, right: Phrase) => {
      const leftAssigned = catalogItemIdsFromTags(left.tags).some((id) => assigned.has(id)) ? 0 : 1
      const rightAssigned = catalogItemIdsFromTags(right.tags).some((id) => assigned.has(id)) ? 0 : 1
      return leftAssigned - rightAssigned || (left.activationUpdatedAt ?? left.createdAt).localeCompare(right.activationUpdatedAt ?? right.createdAt) || left.id.localeCompare(right.id)
  }
  const started = eligible.filter((phrase) => (phrase.activationStage ?? 0) > 0).sort(sortEligible)
  const admissionsToday = scopedPhrases.filter((phrase) => phrase.activationEvents?.some((event) => event.stage === 1 && localDayKey(new Date(event.completedAt)) === today)).length
  const newSlots = Math.max(0, newAdmissionLimit - admissionsToday)
  const fresh = eligible.filter((phrase) => (phrase.activationStage ?? 0) === 0).sort(sortEligible).slice(0, newSlots)
  return [...started, ...fresh]
    .slice(0, Math.max(0, limit))
    .map((phrase) => ({ phraseId: phrase.id, ...STEPS[phrase.activationStage ?? 0] }))
}

/** A direct phrase route obeys the same spacing rule and can expose only one next step. */
export function buildTargetedActivationQueue(phrase: Phrase, now = new Date()): ActivationQueueItem[] {
  return buildDailyActivationQueue([phrase], null, now, 1, 1)
}
