import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedData } from '../data/seed'
import { grammarAcademyLessons, grammarQuizForAttempt } from '../data/grammarAcademy'
import { PLACEMENT_LISTENING_PROMPTS } from '../data/listeningPromptBank'
import { PLACEMENT_QUESTIONS } from '../data/placementTest'
import { loadLexicalCatalogLevel } from '../data/lexicalCatalogLoader'
import { getActiveProfileId, replacePersistedProfile } from '../data/profileStorage'
import { validateForgeData } from '../data/serialization'
import { activationEvidenceResponseForStage, buildDailyActivationQueue } from '../domain/activation'
import { catalogItemTag, createDailyVocabularyAssignment, DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT, localDayKey } from '../domain/dailyVocabulary'
import { PERSONAL_CATALOG_ENRICHMENT_TAG, type LexicalCatalogItem } from '../domain/lexicalCatalog'
import { phraseFingerprint } from '../domain/normalization'
import { calculatePhraseEvidence } from '../domain/progress'
import type { DailyVocabularyAssignment, Phrase } from '../domain/types'
import { activationEventsThrough as qualifiedEventsThrough } from '../test/activationEvidence'
import { useForgeStore } from './useForgeStore'

const catalogItem: LexicalCatalogItem = {
  id: 'lex-b1-deal-with', level: 'B1', expression: 'deal with', kind: 'phrasal_verb',
  translationRu: 'справляться с', meaningEn: 'take action to solve a problem or manage a situation',
  example: 'The support team dealt with my request within an hour.', exampleTranslationRu: 'Служба поддержки разобралась с моим запросом в течение часа.',
  topic: 'problems', register: 'neutral', activationReady: true,
  activationError: {
    incorrectContext: 'The support team dealed with my request within an hour.',
    expectedCorrection: 'The support team dealt with my request within an hour.',
    cue: 'Исправьте неверную форму прошедшего времени deal перед with: нужна форма dealt.',
  },
}

let trustedB1Catalog: readonly LexicalCatalogItem[]
let trustedA2Catalog: readonly LexicalCatalogItem[]
let referenceCatalogItem: LexicalCatalogItem

function persistCurrentDailyAssignment(assignment: DailyVocabularyAssignment): void {
  useForgeStore.setState((state) => ({
    preferences: { ...state.preferences, currentLevel: assignment.level },
    dailyVocabularyAssignment: assignment,
    dailyVocabularyAssignments: [assignment],
  }))
}

function simulateLegacyBundledReference(item: LexicalCatalogItem): { id: string; activationError: NonNullable<Phrase['activationError']> } {
  const saved = useForgeStore.getState().saveReferenceCatalogItem(item)
  const activationError = {
    incorrectContext: `A legacy bundled card used ${item.expression} incorrectly here.`,
    expectedCorrection: item.example,
    cue: 'Use the former bundled correction contract.',
  }
  useForgeStore.setState((state) => ({
    phrases: state.phrases.map((phrase) => phrase.id === saved.id ? {
      ...phrase,
      tags: phrase.tags.filter((tag) => tag !== PERSONAL_CATALOG_ENRICHMENT_TAG),
      activationError,
    } : phrase),
  }))
  return { id: saved.id!, activationError }
}

const grammarReferenceTexts = [
  'She works at the library every weekday.',
  'He do not work here.',
  'He does not work here.',
]

function grammarAnswers(lessonId: string, attemptNumber: number, correctCount: number) {
  const lesson = grammarAcademyLessons.find((candidate) => candidate.id === lessonId)
  if (!lesson) throw new Error(`Unknown grammar lesson: ${lessonId}`)
  return grammarQuizForAttempt(lesson, attemptNumber).map((question, index) => ({
    questionId: question.id,
    selectedIndex: index < correctCount ? question.answerIndex : (question.answerIndex + 1) % question.choices.length,
  }))
}

describe('forge store transactions', () => {
  beforeAll(async () => {
    [trustedB1Catalog, trustedA2Catalog] = await Promise.all([
      loadLexicalCatalogLevel('B1'),
      loadLexicalCatalogLevel('A2'),
    ])
    referenceCatalogItem = trustedA2Catalog.find((item) => item.activationReady !== true)!
  })
  beforeEach(async () => { await useForgeStore.getState().resetToDemo() })

  it('creates one phrase with four independent skill states', () => {
    const result = useForgeStore.getState().addPhrase({
      canonical: 'draw a distinction', meaning: 'separate ideas clearly', context: 'We draw a distinction between price and value.', source: 'Test',
      kind: 'collocation', cefr: 'C1', register: ['formal'], tags: ['writing'], note: '',
    })
    expect(result.id).toBeTruthy()
    expect(useForgeStore.getState().phrases.filter((phrase) => phrase.id === result.id)).toHaveLength(1)
    expect(useForgeStore.getState().skillStates.filter((state) => state.phraseId === result.id)).toHaveLength(4)
    const scheduled = useForgeStore.getState().skillStates.filter((state) => state.phraseId === result.id)
    const recallDue = new Date(scheduled.find((state) => state.skill === 'meaning_recall')!.dueAt).getTime()
    const clozeDue = new Date(scheduled.find((state) => state.skill === 'cloze')!.dueAt).getTime()
    const productiveDue = new Date(scheduled.find((state) => state.skill === 'written_productive')!.dueAt).getTime()
    expect(clozeDue - recallDue).toBe(86_400_000)
    expect(productiveDue - recallDue).toBe(3 * 86_400_000)
  })

  it('admits a manually authored card through the real activation queue including Step 6', () => {
    const result = useForgeStore.getState().addPhrase({
      canonical: 'make room for', meaning: 'create enough space for something', context: 'We can make room for one more chair.', source: 'Notebook',
      kind: 'collocation', cefr: 'B1', register: ['neutral'], tags: ['personal'], note: '',
      activationError: {
        incorrectContext: 'We can make a room for one more chair.',
        expectedCorrection: 'We can make room for one more chair.',
        cue: 'Remove the article from the fixed expression.',
      },
    })
    expect(result.id).toBeTruthy()
    expect(buildDailyActivationQueue(
      useForgeStore.getState().phrases.filter((phrase) => phrase.id === result.id),
      null,
      new Date('2026-07-18T12:00:00.000Z'),
      1,
      1,
    )).toEqual([{ phraseId: result.id, skill: 'meaning_recall', mode: 'recognition' }])

    useForgeStore.setState((state) => ({ phrases: state.phrases.map((phrase) => phrase.id === result.id ? {
      ...phrase,
      activationStage: 5 as const,
      activationUpdatedAt: '2026-07-17T12:00:00.000Z',
      activationEvents: [{ stage: 5 as const, completedAt: '2026-07-17T12:00:00.000Z' }],
    } : phrase) }))
    expect(buildDailyActivationQueue(
      useForgeStore.getState().phrases.filter((phrase) => phrase.id === result.id),
      null,
      new Date('2026-07-18T12:00:00.000Z'),
      1,
      1,
    )).toEqual([{ phraseId: result.id, skill: 'cloze', mode: 'error_repair' }])
  })

  it('warns about a case and spacing duplicate without mutating data', () => {
    const before = useForgeStore.getState().phrases.length
    const result = useForgeStore.getState().addPhrase({
      canonical: '  FALL  SHORT OF EXPECTATIONS ', meaning: '', context: '', source: 'Test',
      kind: 'collocation', cefr: 'C1', register: ['neutral'], tags: [], note: '',
    })
    expect(result.duplicateId).toBe('phrase-fall-short')
    expect(useForgeStore.getState().phrases).toHaveLength(before)
  })

  it('does not create a second personal record when the matching phrase is archived', () => {
    useForgeStore.getState().archivePhrase('phrase-fall-short')
    const before = useForgeStore.getState().phrases.length
    const result = useForgeStore.getState().addPhrase({
      canonical: 'FALL SHORT OF EXPECTATIONS', meaning: 'duplicate', context: '', source: 'Test',
      kind: 'collocation', cefr: 'C1', register: ['neutral'], tags: [], note: '',
    })
    expect(result.duplicateId).toBe('phrase-fall-short')
    expect(useForgeStore.getState().phrases).toHaveLength(before)
  })

  it('restores an archived phrase into relearning with its history intact', () => {
    const phraseId = 'phrase-fall-short'
    const reviewCount = useForgeStore.getState().reviews.filter((review) => review.targetId === phraseId).length
    useForgeStore.getState().archivePhrase(phraseId)
    expect(useForgeStore.getState().skillStates.filter((state) => state.phraseId === phraseId).every((state) => state.phase === 'suspended')).toBe(true)

    useForgeStore.getState().restorePhrase(phraseId)

    const state = useForgeStore.getState()
    expect(state.phrases.find((phrase) => phrase.id === phraseId)).toMatchObject({ status: 'learning', archivedAt: undefined })
    expect(state.skillStates.filter((skill) => skill.phraseId === phraseId).every((skill) => skill.phase === 'relearning')).toBe(true)
    expect(state.reviews.filter((review) => review.targetId === phraseId)).toHaveLength(reviewCount)
  })

  it('rejects blank and duplicate canonical values during edit', () => {
    const blank = useForgeStore.getState().updatePhrase('phrase-fall-short', { canonical: '   ' })
    const duplicate = useForgeStore.getState().updatePhrase('phrase-fall-short', { canonical: 'bear in mind' })
    expect(blank.error).toContain('blank')
    expect(duplicate.duplicateId).toBe('phrase-bear-in-mind')
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === 'phrase-fall-short')?.canonical).toBe('fall short of expectations')
  })

  it('moves a card with no meaning or context out of every practice queue', () => {
    const phraseId = 'phrase-fall-short'
    useForgeStore.getState().updatePhrase(phraseId, { meaning: '   ', context: '' })
    const phrase = useForgeStore.getState().phrases.find((item) => item.id === phraseId)!
    expect(phrase.status).toBe('needs_enrichment')
    expect(buildDailyActivationQueue([phrase], null, new Date('2026-07-19T12:00:00.000Z'))).toEqual([])
  })

  it.each([
    ['meaning only', 'remember a useful distinction', ''],
    ['context only', '', 'We draw a distinction between price and value.'],
    ['context without target', 'separate two ideas clearly', 'The report compares price and value.'],
  ])('keeps a personal card with %s in enrichment until the full activation contract exists', (_case, meaning, context) => {
    const result = useForgeStore.getState().addPhrase({
      canonical: 'draw a distinction', meaning, context, source: 'Test',
      kind: 'collocation', cefr: 'B2', register: ['neutral'], tags: [], note: '',
    })
    const phrase = useForgeStore.getState().phrases.find((item) => item.id === result.id)!
    expect(phrase.status).toBe('needs_enrichment')
    expect(buildDailyActivationQueue([phrase], null, new Date('2026-07-19T12:00:00.000Z'))).toEqual([])
  })

  it('preserves old history but resets counted evidence when a phrase sense changes', () => {
    const phraseId = 'phrase-bear-in-mind'
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase) => phrase.id === phraseId ? { ...phrase, activationStage: 8, activationUpdatedAt: '2026-07-01T08:00:00.000Z' } : phrase),
      skillStates: state.skillStates.map((skill) => skill.phraseId === phraseId ? { ...skill, attempts: 4, mastery: 0.9 } : skill),
      grammarProgress: [{ lessonId: 'a2-present-simple', attempts: 1, passes: 0, bestScore: 1, totalQuestions: 3, lastAttemptedAt: '2026-07-01T08:00:00.000Z', productionTargetPhraseId: phraseId }],
    }))
    const reviewsBefore = useForgeStore.getState().reviews.length
    const attemptsBefore = useForgeStore.getState().speakingAttempts.length

    useForgeStore.getState().updatePhrase(phraseId, { meaning: 'a materially different sense for this card' })
    const state = useForgeStore.getState()
    const phrase = state.phrases.find((item) => item.id === phraseId)!
    expect(phrase).toMatchObject({ activationStage: 0, status: 'new' })
    expect(phrase.evidenceResetAt).toBeTruthy()
    expect(state.reviews).toHaveLength(reviewsBefore)
    expect(state.speakingAttempts).toHaveLength(attemptsBefore)
    expect(state.skillStates.filter((skill) => skill.phraseId === phraseId).every((skill) => skill.attempts === 0)).toBe(true)
    expect(state.grammarProgress[0].productionTargetPhraseId).toBeUndefined()
    expect(calculatePhraseEvidence(state, phraseId).productivePasses).toBe(0)
  })

  it('treats removal of an accepted form as an evidence-affecting revision', () => {
    const phraseId = 'phrase-bear-in-mind'
    useForgeStore.setState((state) => ({ phrases: state.phrases.map((phrase) => phrase.id === phraseId ? { ...phrase, activationStage: 8 } : phrase) }))
    const current = useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)!
    useForgeStore.getState().updatePhrase(phraseId, { acceptedForms: current.acceptedForms.slice(1) })
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)).toMatchObject({ activationStage: 0 })
  })

  it('preserves reviewed Step-6 authoring for context edits and clears it for canonical edits', () => {
    const phraseId = 'phrase-fall-short'
    const activationError = {
      incorrectContext: 'The result may fall short from expectations.',
      expectedCorrection: 'The result may fall short of expectations.',
      cue: 'Исправьте предлог внутри целевого выражения.',
    }
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase) => phrase.id === phraseId ? { ...phrase, activationError } : phrase),
    }))

    useForgeStore.getState().updatePhrase(phraseId, { context: 'My personal example changed.' })
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)?.activationError).toEqual(activationError)

    useForgeStore.getState().updatePhrase(phraseId, { canonical: 'fall below expectations' })
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)?.activationError).toBeUndefined()
  })

  it('protects stable ids and rejects an edit that collides with an archived record', () => {
    useForgeStore.getState().archivePhrase('phrase-bear-in-mind')
    const duplicate = useForgeStore.getState().updatePhrase('phrase-fall-short', { canonical: 'bear in mind' })
    useForgeStore.getState().updatePhrase('phrase-fall-short', { id: 'changed-id', createdAt: '2030-01-01T00:00:00.000Z' })
    const phrase = useForgeStore.getState().phrases.find((item) => item.id === 'phrase-fall-short')!
    expect(duplicate.duplicateId).toBe('phrase-bear-in-mind')
    expect(phrase.id).toBe('phrase-fall-short')
    expect(phrase.createdAt).not.toBe('2030-01-01T00:00:00.000Z')
  })

  it('uses idempotency keys so a double rating creates one event', () => {
    const before = useForgeStore.getState().reviews.length
    const input = {
      phraseId: 'phrase-fall-short', skill: 'meaning_recall' as const, response: 'fall short of expectations',
      answerMatched: true, requestedGrade: 2 as const, hintsUsed: 0, revealUsed: false, idempotencyKey: 'double-click-test',
    }
    useForgeStore.getState().recordReview(input)
    useForgeStore.getState().recordReview(input)
    expect(useForgeStore.getState().reviews).toHaveLength(before + 1)
    expect(useForgeStore.getState().reviews.find((review) => review.idempotencyKey === input.idempotencyKey)?.supportUsed).toBe(false)
  })

  it('bounds the review history so a long-lived profile cannot exhaust the write limit', () => {
    const filler = Array.from({ length: 20_000 }, (_, index) => ({
      id: `old-${index}`, idempotencyKey: `old-${index}`, targetType: 'phrase' as const, targetId: 'phrase-fall-short',
      skill: 'meaning_recall' as const, exerciseType: 'meaning_to_chunk' as const, response: 'x', grade: 2 as const,
      hintsUsed: 0, revealUsed: false, reviewedAt: '2020-01-01T00:00:00.000Z', dueBefore: '2020-01-01T00:00:00.000Z', dueAfter: '2020-01-01T00:00:00.000Z',
    }))
    useForgeStore.setState({ reviews: filler })
    useForgeStore.getState().recordReview({
      phraseId: 'phrase-fall-short', skill: 'meaning_recall', response: 'fall short of expectations',
      answerMatched: true, requestedGrade: 2, hintsUsed: 0, revealUsed: false, idempotencyKey: 'fresh-review',
    })
    const reviews = useForgeStore.getState().reviews
    expect(reviews.length).toBeLessThanOrEqual(20_000)
    expect(reviews[0].idempotencyKey).toBe('fresh-review')
    expect(reviews.some((review) => review.idempotencyKey === 'old-19999')).toBe(false)
  })

  it('persists feedback exposure idempotently and rejects invalid exposure targets', () => {
    const phraseId = 'phrase-fall-short'
    useForgeStore.getState().recordPracticeExposure(phraseId, 'meaning_recall', '   ', 'feedback')
    useForgeStore.getState().recordPracticeExposure('missing-phrase', 'meaning_recall', 'missing-session', 'feedback')
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)?.practiceExposures).toBeUndefined()

    useForgeStore.getState().recordPracticeExposure(phraseId, 'meaning_recall', 'feedback-session', 'feedback')
    const once = useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)!
    useForgeStore.getState().recordPracticeExposure(phraseId, 'meaning_recall', 'feedback-session', 'feedback')
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)).toBe(once)
    expect(once.practiceExposures).toHaveLength(1)

    useForgeStore.getState().archivePhrase(phraseId)
    useForgeStore.getState().recordPracticeExposure(phraseId, 'meaning_recall', 'archived-session', 'reveal')
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)?.practiceExposures).toHaveLength(1)
  })

  it('allows the rating tied to current feedback but caps a second immediate skill as supported', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const phraseId = 'phrase-fall-short'
    const original = useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)!
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase) => phrase.id === phraseId ? {
        ...phrase,
        activationStage: 7 as const,
        activationUpdatedAt: '2026-07-19T08:00:00.000Z',
        activationEvents: qualifiedEventsThrough(original, 6),
        practiceExposures: [],
      } : phrase),
      skillStates: state.skillStates.map((skill) => skill.phraseId === phraseId && (skill.skill === 'meaning_recall' || skill.skill === 'written_productive')
        ? { ...skill, dueAt: '2026-07-19T08:00:00.000Z' }
        : skill),
      reviews: state.reviews.filter((review) => review.targetId !== phraseId),
    }))

    useForgeStore.getState().recordPracticeExposure(phraseId, 'meaning_recall', 'current-feedback', 'feedback')
    const currentGrade = useForgeStore.getState().recordReview({
      phraseId, skill: 'meaning_recall', response: original.canonical, answerMatched: true,
      requestedGrade: 3, hintsUsed: 0, revealUsed: false, idempotencyKey: 'current-feedback',
    })
    const immediateGrade = useForgeStore.getState().recordReview({
      phraseId, skill: 'written_productive', response: 'This release may fall short of expectations again.', answerMatched: true,
      requestedGrade: 3, hintsUsed: 0, revealUsed: false, idempotencyKey: 'immediate-second-skill',
    })

    const state = useForgeStore.getState()
    expect(currentGrade).toBe(3)
    expect(state.reviews.find((review) => review.idempotencyKey === 'current-feedback')?.supportUsed).toBe(false)
    expect(immediateGrade).toBe(1)
    expect(state.reviews.find((review) => review.idempotencyKey === 'immediate-second-skill')).toMatchObject({ grade: 1, supportUsed: true })
    expect(state.phrases.find((phrase) => phrase.id === phraseId)?.activationStage).toBe(7)
    vi.useRealTimers()
  })

  it('does not persist a review for a missing or archived phrase', () => {
    const before = useForgeStore.getState().reviews.length
    const input = {
      skill: 'meaning_recall' as const, response: 'answer', answerMatched: true,
      requestedGrade: 3 as const, hintsUsed: 0, revealUsed: false,
    }
    expect(useForgeStore.getState().recordReview({ ...input, phraseId: 'missing', idempotencyKey: 'missing-review' })).toBe(0)
    useForgeStore.getState().archivePhrase('phrase-fall-short')
    expect(useForgeStore.getState().recordReview({ ...input, phraseId: 'phrase-fall-short', idempotencyKey: 'archived-review' })).toBe(0)
    expect(useForgeStore.getState().reviews).toHaveLength(before)
  })

  it('caps a cross-route supported review and never turns it into delayed activation evidence', () => {
    const phraseId = 'phrase-fall-short'
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase) => phrase.id === phraseId
        ? { ...phrase, activationStage: 7, activationUpdatedAt: '2026-07-01T08:00:00.000Z' }
        : phrase),
      skillStates: state.skillStates.filter((skill) => !(skill.phraseId === phraseId && skill.skill === 'written_productive')),
    }))

    const grade = useForgeStore.getState().recordReview({
      phraseId,
      skill: 'written_productive',
      response: 'The outcome may fall short of expectations this quarter.',
      answerMatched: true,
      requestedGrade: 3,
      hintsUsed: 0,
      revealUsed: false,
      supportUsed: true,
      idempotencyKey: 'supported-route-review',
    })

    const state = useForgeStore.getState()
    expect(grade).toBe(1)
    expect(state.reviews.find((review) => review.idempotencyKey === 'supported-route-review')?.supportUsed).toBe(true)
    expect(state.phrases.find((phrase) => phrase.id === phraseId)?.activationStage).toBe(7)
  })

  it('only advances activation through contiguous stages', () => {
    const phraseId = useForgeStore.getState().phrases[0].id
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T08:00:00.000Z'))
    useForgeStore.setState((state) => ({ phrases: state.phrases.map((phrase) => phrase.id === phraseId ? { ...phrase, activationStage: 0 as const, activationEvents: [], activationUpdatedAt: undefined } : phrase) }))
    const firstPhrase = useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)!
    useForgeStore.getState().advancePhraseActivation(phraseId, 2, activationEvidenceResponseForStage(firstPhrase, 2))
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)?.activationStage ?? 0).toBe(0)
    useForgeStore.getState().advancePhraseActivation(phraseId, 1, activationEvidenceResponseForStage(firstPhrase, 1))
    vi.setSystemTime(new Date('2026-07-19T08:00:00.000Z'))
    const afterFirst = useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)!
    useForgeStore.getState().advancePhraseActivation(phraseId, 2, activationEvidenceResponseForStage(afterFirst, 2))
    const phrase = useForgeStore.getState().phrases.find((item) => item.id === phraseId)!
    expect(phrase.activationStage).toBe(2)
    expect(phrase.activationEvents?.map((event) => event.stage)).toEqual([1, 2])
    vi.useRealTimers()
  })

  it('persists a supported activation attempt as training without advancing or allowing a same-day retry', () => {
    const phraseId = 'phrase-fall-short'
    const attemptedAt = new Date('2026-07-18T08:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(attemptedAt)
    useForgeStore.setState((state) => ({ phrases: state.phrases.map((phrase) => phrase.id === phraseId ? { ...phrase, activationStage: 0 as const, activationEvents: [] } : phrase) }))

    useForgeStore.getState().recordUnqualifiedActivationAttempt(phraseId, 1, true)
    const phrase = useForgeStore.getState().phrases.find((item) => item.id === phraseId)!
    expect(phrase.activationStage).toBe(0)
    expect(phrase.activationEvents).toEqual([expect.objectContaining({ stage: 1, qualified: false, supportUsed: true })])
    expect(buildDailyActivationQueue([phrase], null, new Date('2026-07-18T12:00:00.000Z'))).toEqual([])
    expect(buildDailyActivationQueue([phrase], null, new Date('2026-07-19T12:00:00.000Z'))).toHaveLength(1)
    vi.useRealTimers()
  })

  it('deletes unreferenced phrase history and clears grammar target links without orphans', () => {
    const phraseId = 'phrase-bear-in-mind'
    useForgeStore.setState((state) => ({
      grammarProgress: [{ lessonId: 'a2-present-simple', attempts: 1, passes: 0, bestScore: 1, totalQuestions: 3, lastAttemptedAt: '2026-07-18T08:00:00.000Z', productionTargetPhraseId: phraseId, transferTargetPhraseId: phraseId }],
      speakingAttempts: [{
        id: 'deletion-attempt', idempotencyKey: 'deletion-attempt', sessionId: 'deletion-attempt', mode: 'targeted_response', prompt: 'Give advice.',
        targetPhraseIds: [phraseId], detectedPhraseIds: [phraseId], confirmedPhraseIds: [phraseId], evidenceEligiblePhraseIds: [phraseId],
        transcript: 'Please bear in mind that this plan may change.', durationSeconds: 8, recordingId: 'deletion_audio', mimeType: 'audio/webm',
        targetFormVisible: false, supportUsed: false, selfRating: { clarity: 4, flow: 4 }, createdAt: '2026-07-18T08:00:00.000Z',
      }, ...state.speakingAttempts],
    }))
    expect(useForgeStore.getState().deletePhrase(phraseId)).toEqual({ id: phraseId })
    const state = useForgeStore.getState()
    expect(state.phrases.some((phrase) => phrase.id === phraseId)).toBe(false)
    expect(state.skillStates.some((skill) => skill.phraseId === phraseId)).toBe(false)
    expect(state.reviews.some((review) => review.targetId === phraseId)).toBe(false)
    expect(state.grammarProgress[0].productionTargetPhraseId).toBeUndefined()
    expect(state.grammarProgress[0].transferTargetPhraseId).toBeUndefined()
    expect(state.speakingAttempts.flatMap((attempt) => [attempt.targetPhraseIds, attempt.detectedPhraseIds, attempt.confirmedPhraseIds, attempt.evidenceEligiblePhraseIds ?? []]).flat()).not.toContain(phraseId)
    expect(() => validateForgeData({ schemaVersion: state.schemaVersion, dailyVocabularyAssignment: state.dailyVocabularyAssignment, dailyVocabularyAssignments: state.dailyVocabularyAssignments, phrases: state.phrases, skillStates: state.skillStates, reviews: state.reviews, errors: state.errors, missions: state.missions, speakingAttempts: state.speakingAttempts, listeningClips: state.listeningClips, listeningAttempts: state.listeningAttempts, placementAttempts: state.placementAttempts, grammarProgress: state.grammarProgress, preferences: state.preferences })).not.toThrow()
  })

  it('blocks deletion of a phrase referenced by mission history so no draft is lost', () => {
    const mission = useForgeStore.getState().missions[0]
    const result = useForgeStore.getState().deletePhrase(mission.targetPhraseIds[0])
    const state = useForgeStore.getState()
    expect(result.error).toContain('задания на перенос')
    expect(state.missions.some((item) => item.id === mission.id)).toBe(true)
    expect(state.phrases.some((phrase) => phrase.id === mission.targetPhraseIds[0])).toBe(true)
    expect(() => validateForgeData({ schemaVersion: state.schemaVersion, dailyVocabularyAssignment: state.dailyVocabularyAssignment, phrases: state.phrases, skillStates: state.skillStates, reviews: state.reviews, errors: state.errors, missions: state.missions, speakingAttempts: state.speakingAttempts, listeningClips: state.listeningClips, listeningAttempts: state.listeningAttempts, placementAttempts: state.placementAttempts, grammarProgress: state.grammarProgress, preferences: state.preferences })).not.toThrow()
  })

  it('creates a fresh mission after the current mission is completed', () => {
    useForgeStore.setState((state) => ({
      missions: state.missions.map((mission) => ({ ...mission, status: 'done' as const, completedAt: new Date().toISOString() })),
      phrases: state.phrases.map((phrase, index) => index < 3 ? { ...phrase, cefr: 'C1' as const, activationStage: 5 as const, activationEvents: qualifiedEventsThrough(phrase, 5) } : phrase),
      preferences: { ...state.preferences, currentLevel: 'C1' },
    }))
    const id = useForgeStore.getState().createSuggestedMission()
    expect(id).toBeTruthy()
    expect(useForgeStore.getState().missions.find((mission) => mission.id === id)).toMatchObject({ status: 'planned', minWords: 120, maxWords: 180, targetPhraseCount: 3 })
  })

  it.each([
    ['A2', 40, 70, 2],
    ['B1', 80, 120, 2],
    ['B2', 120, 180, 3],
    ['C1', 120, 180, 3],
  ] as const)('persists adaptive %s mission limits and selects studied targets only', (level, minWords, maxWords, targetCount) => {
    const data = createSeedData()
    const phraseTemplate = data.phrases[0]
    const skillTemplate = data.skillStates.find((state) => state.skill === 'written_productive')!
    const phrases: Phrase[] = Array.from({ length: targetCount + 1 }, (_, index) => ({
      ...phraseTemplate,
      id: `${level.toLowerCase()}-mission-${index}`,
      cefr: level,
      canonical: `mission phrase ${index}`,
      normalizedKey: `mission phrase ${index}`,
      activationStage: index < targetCount ? 5 as const : undefined,
      activationEvents: undefined,
    }))
    for (const phrase of phrases.slice(0, targetCount)) phrase.activationEvents = qualifiedEventsThrough(phrase, 5)
    const skillStates = phrases.map((phrase, index) => ({ ...skillTemplate, phraseId: phrase.id, attempts: index > 0 && index < targetCount ? 1 : 0 }))
    useForgeStore.setState((state) => ({
      phrases,
      skillStates,
      reviews: [],
      missions: [],
      preferences: { ...state.preferences, currentLevel: level },
    }))

    const id = useForgeStore.getState().createSuggestedMission()
    const mission = useForgeStore.getState().missions.find((item) => item.id === id)
    expect(mission).toMatchObject({ minWords, maxWords, targetPhraseCount: targetCount, supportUsed: false })
    expect(mission?.targetPhraseIds).toHaveLength(targetCount)
    expect(mission?.targetPhraseIds[0]).toBe(`${level.toLowerCase()}-mission-0`)
    expect(mission?.targetPhraseIds).not.toContain(`${level.toLowerCase()}-mission-${targetCount}`)
  })

  it('allows one A2 target but waits for the full target load at higher levels', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], id: 'single-studied', cefr: 'A2' as const, activationStage: 5 as const }
    phrase.activationEvents = qualifiedEventsThrough(phrase, 5)
    useForgeStore.setState((state) => ({ phrases: [phrase], skillStates: [], reviews: [], missions: [], preferences: { ...state.preferences, currentLevel: 'A2' } }))
    const a2Id = useForgeStore.getState().createSuggestedMission()
    expect(useForgeStore.getState().missions.find((item) => item.id === a2Id)).toMatchObject({ targetPhraseCount: 1, minWords: 40, maxWords: 70 })

    useForgeStore.setState((state) => ({ missions: [], phrases: [{ ...phrase, cefr: 'B1' as const }], preferences: { ...state.preferences, currentLevel: 'B1' } }))
    expect(useForgeStore.getState().createSuggestedMission()).toBeUndefined()
    expect(useForgeStore.getState().missions).toEqual([])
  })

  it('enforces the word range stored with the mission', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], cefr: 'A2' as const, activationStage: 5 as const }
    phrase.activationEvents = qualifiedEventsThrough(phrase, 5)
    const mission = { ...data.missions[0], level: 'A2' as const, targetPhraseIds: [phrase.id], targetResults: [{ phraseId: phrase.id, confirmed: false }], minWords: 40, maxWords: 70, targetPhraseCount: 1 }
    useForgeStore.setState({ phrases: data.phrases.map((item) => item.id === phrase.id ? phrase : item), missions: [mission] })
    useForgeStore.getState().updateMissionDraft(mission.id, `${phrase.canonical} ${Array.from({ length: 36 }, () => 'word').join(' ')}`)
    expect(useForgeStore.getState().completeMission(mission.id, [phrase.id], true)).toBe(false)
    useForgeStore.getState().updateMissionDraft(mission.id, `Our first plan may ${phrase.canonical}, but the team can improve it. We will check every step, ask customers for clear feedback, fix the main problems, and share a better result with everyone before Friday. This new approach gives us enough time to work carefully together.`)
    expect(useForgeStore.getState().completeMission(mission.id, [phrase.id], false)).toBe(false)
    expect(useForgeStore.getState().completeMission(mission.id, [phrase.id], true)).toBe(true)
    expect(useForgeStore.getState().missions[0]).toMatchObject({ status: 'done', targetPhraseCount: 1 })
    useForgeStore.getState().updatePhrase(phrase.id, { meaning: 'a revised meaning that changes the saved target contract' })
    expect(useForgeStore.getState().missions[0]).toMatchObject({ status: 'done', legacyContract: true })
    expect(calculatePhraseEvidence(useForgeStore.getState(), phrase.id).missionCompletedAt).toBeUndefined()
  })

  it('stores an auditable placement result and builds the next-level route', async () => {
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.level === 'A2' || question.level === 'B1' ? question.correctIndex : (question.correctIndex + 1) % 4]))
    const listeningDiagnostic = {
      evidenceVersion: 1 as const,
      promptSetVersion: 1 as const,
      answers: PLACEMENT_LISTENING_PROMPTS.map((prompt) => ({ promptId: prompt.id, selectedIndex: prompt.answerIndex, dictation: prompt.text, playbackCompleted: true as const, replayCount: 0 })),
      completedAt: '2026-07-18T08:00:00.000Z',
    }
    expect(await useForgeStore.getState().completePlacement(selected, listeningDiagnostic)).toBe(true)
    const state = useForgeStore.getState()
    expect(state.preferences.currentLevel).toBe('B1')
    expect(state.preferences.targetLevel).toBe('B2')
    expect(state.preferences.placementCompletedAt).toBeTruthy()
    expect(state.placementAttempts[0].answers[0]).toEqual({ questionId: 'a2-01', selectedIndex: 1, correct: true })
    expect(state.placementAttempts[0].listeningDiagnostic).toEqual(listeningDiagnostic)
    expect(state.placementAttempts[0].suggestedLevel).toBe('B1')
    const forgedListening = { ...listeningDiagnostic, answers: listeningDiagnostic.answers.map((answer, index) => index === 1 ? { ...answer, promptId: listeningDiagnostic.answers[0].promptId } : answer) }
    expect(await useForgeStore.getState().completePlacement(selected, forgedListening)).toBe(false)
    expect(useForgeStore.getState().placementAttempts).toHaveLength(1)
    expect(await useForgeStore.getState().completePlacement({ fake: 0 })).toBe(false)
  })

  it('keeps the best grammar score and requires two successful checks', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T08:00:00.000Z'))
    const store = useForgeStore.getState()
    await store.recordGrammarProgress('a2-present-simple', 0, grammarAnswers('a2-present-simple', 0, 2))
    expect(useForgeStore.getState().grammarProgress[0].completedAt).toBeUndefined()
    await useForgeStore.getState().recordGrammarProgress('a2-present-simple', 1, grammarAnswers('a2-present-simple', 1, 3))
    expect(useForgeStore.getState().grammarProgress[0].completedAt).toBeUndefined()
    await useForgeStore.getState().recordGrammarProgress('a2-present-simple', 2, grammarAnswers('a2-present-simple', 2, 1))
    await useForgeStore.getState().recordGrammarProgress('a2-present-simple', 3, grammarAnswers('a2-present-simple', 3, 3))
    expect(useForgeStore.getState().grammarProgress[0].passes).toBe(1)
    vi.setSystemTime(new Date('2026-07-17T08:00:00.000Z'))
    await useForgeStore.getState().recordGrammarProgress('a2-present-simple', 4, grammarAnswers('a2-present-simple', 4, 3))
    expect(useForgeStore.getState().grammarProgress[0].passes).toBe(1)
    await useForgeStore.getState().recordGrammarProgress('a2-present-simple', 5, grammarAnswers('a2-present-simple', 5, 3))
    const progress = useForgeStore.getState().grammarProgress[0]
    expect(progress.bestScore).toBe(3)
    expect(progress.attempts).toBe(6)
    expect(progress.passes).toBe(2)
    expect(progress.completedAt).toBeUndefined()
    expect(useForgeStore.getState().saveGrammarProduction('a2-present-simple', 'I work from home every Friday.', 3, true, undefined, grammarReferenceTexts)).toBe(true)
    expect(useForgeStore.getState().grammarProgress[0].completedAt).toBeUndefined()
    await useForgeStore.getState().recordGrammarCorrection('a2-present-simple', 'He works from home.')
    expect(useForgeStore.getState().grammarProgress[0].completedAt).toBeUndefined()
    expect(useForgeStore.getState().saveGrammarTransfer('a2-present-simple', 'Our team checks every request on Monday.', 3, true, undefined, grammarReferenceTexts)).toBe(false)
    vi.setSystemTime(new Date('2026-07-18T08:00:00.000Z'))
    expect(await useForgeStore.getState().recordGrammarTransferCheck('a2-present-simple', 6, grammarAnswers('a2-present-simple', 6, 2))).toBe(false)
    expect(useForgeStore.getState().saveGrammarTransfer('a2-present-simple', 'Our team checks every request on Monday.', 3, true, undefined, grammarReferenceTexts)).toBe(false)
    expect(await useForgeStore.getState().recordGrammarTransferCheck('a2-present-simple', 6, grammarAnswers('a2-present-simple', 6, 3))).toBe(true)
    expect(useForgeStore.getState().saveGrammarTransfer('a2-present-simple', 'Our team checks every request on Monday.', 3, true, undefined, grammarReferenceTexts)).toBe(true)
    expect(useForgeStore.getState().grammarProgress[0]).toMatchObject({ masteryEvidenceVersion: 6, productionDraft: 'I work from home every Friday.', transferDraft: 'Our team checks every request on Monday.', transferCheckEvidence: { attemptNumber: 6 } })
    expect(useForgeStore.getState().grammarProgress[0].completedAt).toBeTruthy()
    const completed = structuredClone(useForgeStore.getState().grammarProgress[0])
    vi.setSystemTime(new Date('2026-07-19T08:00:00.000Z'))
    await useForgeStore.getState().recordGrammarProgress('a2-present-simple', 6, grammarAnswers('a2-present-simple', 6, 3))
    await useForgeStore.getState().recordGrammarCorrection('a2-present-simple', 'He works from home.')
    expect(useForgeStore.getState().saveGrammarTransfer('a2-present-simple', 'Our team checks every request on Monday.', 3, true, undefined, grammarReferenceTexts)).toBe(true)
    expect(useForgeStore.getState().grammarProgress[0]).toMatchObject({
      passHistory: completed.passHistory,
      correctionPassedAt: completed.correctionPassedAt,
      transferSavedAt: completed.transferSavedAt,
      completedAt: completed.completedAt,
    })
    vi.useRealTimers()
  })

  it('rejects copied grammar examples and checkpoint ids outside the loaded curriculum', () => {
    expect(useForgeStore.getState().saveGrammarProduction(
      'a2-present-simple',
      grammarReferenceTexts[0],
      3,
      true,
      undefined,
      grammarReferenceTexts,
    )).toBe(false)
    expect(useForgeStore.getState().recordGrammarCheckpoint(
      [{ lessonId: 'invented-lesson', correct: true }],
      ['a2-present-simple'],
    )).toBe(false)
  })

  it('captures a personal error and does not promote a supported repair', () => {
    const result = useForgeStore.getState().addError({ label: 'Personal pattern', category: 'prepositions', original: 'I listened him.', correction: 'I listened to him.', hint: 'Check the preposition.', rule: 'Listen takes to before an object.', transferPrompt: 'We listened the guide.', transferAnswer: 'We listened to the guide.' })
    expect(result.id).toBeTruthy()
    useForgeStore.getState().recordErrorAttempt(result.id!, 'I listened to him.', true, true, false)
    expect(useForgeStore.getState().errors.find((error) => error.id === result.id)?.status).toBe('active')
  })

  it('records a repeated capture as another occurrence and reopens the pattern', () => {
    const input = { label: 'Repeated article', category: 'articles' as const, original: 'I bought car.', correction: 'I bought a car.', hint: 'Check the article.', rule: 'Use an article with a singular count noun.', transferPrompt: 'She rented flat.', transferAnswer: 'She rented a flat.' }
    const first = useForgeStore.getState().addError(input)
    useForgeStore.getState().updateError(first.id!, { status: 'resolved' })
    const repeated = useForgeStore.getState().addError(input)
    const error = useForgeStore.getState().errors.find((item) => item.id === first.id)!
    expect(repeated.duplicateId).toBe(first.id)
    expect(error).toMatchObject({ occurrences: 2, status: 'active' })
  })

  it('does not count old-cycle successes after a resolved error recurs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T08:00:00.000Z'))
    const input = { label: 'Repeated article', category: 'articles' as const, original: 'I bought car.', correction: 'I bought a car.', hint: 'Check the article.', rule: 'Use an article with a singular count noun.', transferPrompt: 'She rented flat.', transferAnswer: 'She rented a flat.' }
    const first = useForgeStore.getState().addError(input)
    useForgeStore.setState((state) => ({ errors: state.errors.map((error) => error.id === first.id ? {
      ...error,
      status: 'resolved' as const,
      attempts: [{ id: 'old-transfer', response: input.transferAnswer, correct: true, supportUsed: false, transfer: true, attemptedAt: '2026-07-01T08:00:00.000Z' }],
    } : error) }))

    useForgeStore.getState().addError(input)
    useForgeStore.getState().recordErrorAttempt(first.id!, input.correction, true, false, false)
    const reopened = useForgeStore.getState().errors.find((error) => error.id === first.id)!
    expect(reopened.attempts).toHaveLength(2)
    expect(reopened.status).toBe('active')
    vi.useRealTimers()
  })

  it('reopens mastery when an accepted error-repair contract changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T08:00:00.000Z'))
    const result = useForgeStore.getState().addError({
      label: 'Article repair', category: 'articles', original: 'I bought car.', correction: 'I bought a car.',
      hint: 'Check the article.', rule: 'Use an article with a singular count noun.',
      transferPrompt: 'She rented flat.', transferAnswer: 'She rented a flat.',
    })
    useForgeStore.setState((state) => ({ errors: state.errors.map((error) => error.id === result.id ? {
      ...error,
      status: 'resolved' as const,
      dueAt: '2026-08-18T08:00:00.000Z',
      attempts: [{ id: 'old-success', response: error.correction, correct: true, supportUsed: false, transfer: true, attemptedAt: '2026-07-17T08:00:00.000Z' }],
    } : error) }))

    useForgeStore.getState().updateError(result.id!, { correction: 'I bought the car.' })
    const revised = useForgeStore.getState().errors.find((error) => error.id === result.id)!
    expect(revised).toMatchObject({ status: 'active', correction: 'I bought the car.', dueAt: '2026-07-18T08:00:00.000Z', cycleStartedAt: '2026-07-18T08:00:00.000Z' })
    expect(revised.attempts).toHaveLength(1)
    vi.useRealTimers()
  })

  it('persists cumulative grammar evidence and resets to a short recovery interval after a lapse', () => {
    vi.useFakeTimers()
    const lessonIds = ['a2-be-forms', 'a2-present-simple']
    useForgeStore.setState({ grammarProgress: lessonIds.map((lessonId) => ({ lessonId, attempts: 2, passes: 2, passHistory: ['2026-05-31T08:00:00.000Z', '2026-06-01T08:00:00.000Z'], bestScore: 3, totalQuestions: 3, lastAttemptedAt: '2026-06-01T08:00:00.000Z', lastPassedAt: '2026-06-01T08:00:00.000Z' })) })
    vi.setSystemTime(new Date('2026-07-01T08:00:00.000Z'))
    expect(useForgeStore.getState().recordGrammarCheckpoint(lessonIds.map((lessonId) => ({ lessonId, correct: true })), lessonIds)).toBe(true)
    let topic = useForgeStore.getState().grammarProgress.find((item) => item.lessonId === lessonIds[0])!
    expect(topic).toMatchObject({ cumulativeAttempts: 1, cumulativeCorrect: 1, lastCumulativeReviewedAt: '2026-07-01T08:00:00.000Z', nextCumulativeDueAt: '2026-07-08T08:00:00.000Z' })
    expect(useForgeStore.getState().grammarProgress[0]).toMatchObject({ bestScore: 2, totalQuestions: 2, lastScore: 2 })

    vi.setSystemTime(new Date('2026-07-08T08:00:00.000Z'))
    useForgeStore.getState().recordGrammarCheckpoint(lessonIds.map((lessonId) => ({ lessonId, correct: true })), lessonIds)
    topic = useForgeStore.getState().grammarProgress.find((item) => item.lessonId === lessonIds[0])!
    expect(topic.nextCumulativeDueAt).toBe('2026-07-22T08:00:00.000Z')

    vi.setSystemTime(new Date('2026-07-22T08:00:00.000Z'))
    useForgeStore.getState().recordGrammarCheckpoint(lessonIds.map((lessonId) => ({ lessonId, correct: false })), lessonIds)
    topic = useForgeStore.getState().grammarProgress.find((item) => item.lessonId === lessonIds[0])!
    expect(topic.nextCumulativeDueAt).toBe('2026-07-23T08:00:00.000Z')

    vi.setSystemTime(new Date('2026-07-23T08:00:00.000Z'))
    useForgeStore.getState().recordGrammarCheckpoint(lessonIds.map((lessonId) => ({ lessonId, correct: true })), lessonIds)
    topic = useForgeStore.getState().grammarProgress.find((item) => item.lessonId === lessonIds[0])!
    expect(topic.nextCumulativeDueAt).toBe('2026-07-30T08:00:00.000Z')
    const state = useForgeStore.getState()
    expect(() => validateForgeData({ schemaVersion: state.schemaVersion, dailyVocabularyAssignment: state.dailyVocabularyAssignment, phrases: state.phrases, skillStates: state.skillStates, reviews: state.reviews, errors: state.errors, missions: state.missions, speakingAttempts: state.speakingAttempts, listeningClips: state.listeningClips, listeningAttempts: state.listeningAttempts, placementAttempts: state.placementAttempts, grammarProgress: state.grammarProgress, preferences: state.preferences })).not.toThrow()
    vi.useRealTimers()
  })

  it('resolves an error only after spaced unaided repairs and a due transfer', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T08:00:00.000Z'))
    const result = useForgeStore.getState().addError({
      label: 'Listen pattern', category: 'prepositions', original: 'I listened him.', correction: 'I listened to him.',
      hint: 'Check the preposition.', rule: 'Listen takes to before an object.',
      transferPrompt: 'Repair: We listened the speaker.', transferAnswer: 'We listened to the speaker.',
    })
    useForgeStore.getState().recordErrorAttempt(result.id!, 'I listened to him.', true, false, false)
    useForgeStore.getState().recordErrorAttempt(result.id!, 'I listened to him.', true, false, false)
    expect(useForgeStore.getState().errors.find((error) => error.id === result.id)?.attempts).toHaveLength(1)
    vi.setSystemTime(new Date('2026-07-19T08:00:00.000Z'))
    useForgeStore.getState().recordErrorAttempt(result.id!, 'I listened to him.', true, false, false)
    expect(useForgeStore.getState().errors.find((error) => error.id === result.id)?.status).toBe('improving')
    vi.setSystemTime(new Date('2026-07-26T08:00:00.000Z'))
    useForgeStore.getState().recordErrorAttempt(result.id!, 'We listened to the speaker.', true, false, true)
    const resolved = useForgeStore.getState().errors.find((error) => error.id === result.id)!
    expect(resolved.status).toBe('resolved')
    expect(resolved.attempts[0].transfer).toBe(true)
    vi.useRealTimers()
  })

  it('stages an unenriched quick capture outside practice until details are added', () => {
    const result = useForgeStore.getState().addPhrase({
      canonical: 'at odds with', meaning: '', context: '', source: 'Dashboard quick capture',
      kind: 'collocation', cefr: 'B1', register: ['neutral'], tags: [], note: '',
    })
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === result.id)?.status).toBe('needs_enrichment')
    useForgeStore.getState().updatePhrase(result.id!, { meaning: 'conflict with something', context: 'The findings are at odds with the original claim.' })
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === result.id)?.status).toBe('new')
    const unlocked = useForgeStore.getState().skillStates.filter((state) => state.phraseId === result.id)
    expect(new Date(unlocked.find((state) => state.skill === 'meaning_recall')!.dueAt).getTime()).toBeLessThanOrEqual(Date.now() + 1_000)
    expect(new Date(unlocked.find((state) => state.skill === 'cloze')!.dueAt).getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1_000)
    expect(new Date(unlocked.find((state) => state.skill === 'written_productive')!.dueAt).getTime()).toBeGreaterThan(Date.now() + 71 * 60 * 60 * 1_000)
  })

  it('enriches an incomplete catalog duplicate and records daily enrollment atomically', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const quickCapture = useForgeStore.getState().addPhrase({
      canonical: catalogItem.expression, meaning: '', context: '', source: 'Quick capture', kind: 'collocation', cefr: 'B1', register: ['neutral'], tags: [], note: '',
    })
    const assignment = { dayKey: '2026-07-20', level: 'B1' as const, itemIds: [catalogItem.id], enrolledIds: [], previewedIds: [catalogItem.id] }
    persistCurrentDailyAssignment(assignment)
    const result = useForgeStore.getState().enrollCatalogItem(catalogItem, { ...assignment, previewedIds: [catalogItem.id] })
    const state = useForgeStore.getState()
    const phrase = state.phrases.find((item) => item.id === result.id)!
    expect(result.id).toBe(quickCapture.id)
    expect(phrase).toMatchObject({ status: 'new', context: catalogItem.example, cefr: 'B1' })
    expect(phrase.meaning).toContain(catalogItem.translationRu)
    expect(phrase.tags).toContain(`catalog-item:${catalogItem.id}`)
    expect(phrase.activationError).toEqual(catalogItem.activationError)
    expect(state.dailyVocabularyAssignment?.enrolledIds).toEqual([catalogItem.id])
    expect(state.skillStates.filter((skill) => skill.phraseId === phrase.id)).toHaveLength(4)
    expect(() => validateForgeData({ schemaVersion: state.schemaVersion, dailyVocabularyAssignment: state.dailyVocabularyAssignment, phrases: state.phrases, skillStates: state.skillStates, reviews: state.reviews, errors: state.errors, missions: state.missions, speakingAttempts: state.speakingAttempts, listeningClips: state.listeningClips, listeningAttempts: state.listeningAttempts, placementAttempts: state.placementAttempts, grammarProgress: state.grammarProgress, preferences: state.preferences })).not.toThrow()
    vi.useRealTimers()
  })

  it('rejects a reference-only catalog row without mutating the profile', () => {
    useForgeStore.setState((state) => ({ preferences: { ...state.preferences, currentLevel: referenceCatalogItem.level } }))
    const before = useForgeStore.getState()
    const assignment = { dayKey: '2026-07-20', level: referenceCatalogItem.level, itemIds: [referenceCatalogItem.id], enrolledIds: [] }
    const result = useForgeStore.getState().enrollCatalogItem(referenceCatalogItem, assignment)

    expect(result.error).toContain('справочный')
    expect(useForgeStore.getState().phrases).toBe(before.phrases)
    expect(useForgeStore.getState().dailyVocabularyAssignment).toBe(before.dailyVocabularyAssignment)
  })

  it('rejects deep enrollment before Discovery and after the daily admission limit', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const undiscovered = {
      dayKey: '2026-07-20', level: 'B1' as const,
      itemIds: [catalogItem.id], enrolledIds: [], previewedIds: [],
    }
    useForgeStore.setState((state) => ({
      preferences: { ...state.preferences, currentLevel: 'B1' },
      dailyVocabularyAssignment: undiscovered,
      dailyVocabularyAssignments: [undiscovered],
    }))
    expect(useForgeStore.getState().enrollCatalogItem(catalogItem, undiscovered).error).toContain('Знакомство')
    expect(useForgeStore.getState().phrases.some((phrase) => phrase.tags.includes(catalogItemTag(catalogItem.id)))).toBe(false)

    useForgeStore.setState((state) => ({ preferences: { ...state.preferences, maxNewPhrases: 1 } }))
    const full = {
      ...undiscovered,
      itemIds: [catalogItem.id, 'already-enrolled'],
      enrolledIds: ['already-enrolled'],
      previewedIds: [catalogItem.id],
    }
    useForgeStore.setState({ dailyVocabularyAssignment: full, dailyVocabularyAssignments: [full] })
    expect(useForgeStore.getState().enrollCatalogItem(catalogItem, full).error).toContain('лимит')
    expect(useForgeStore.getState().phrases.some((phrase) => phrase.tags.includes(catalogItemTag(catalogItem.id)))).toBe(false)
    vi.useRealTimers()
  })

  it('does not let a forged proposal bypass a persisted legacy assignment without Discovery provenance', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const legacyAssignment = {
      dayKey: '2026-07-20', level: 'B1' as const,
      itemIds: [catalogItem.id], enrolledIds: [],
    }
    useForgeStore.setState({
      preferences: { ...useForgeStore.getState().preferences, currentLevel: 'B1' },
      dailyVocabularyAssignment: legacyAssignment,
      dailyVocabularyAssignments: [legacyAssignment],
    })

    const result = useForgeStore.getState().enrollCatalogItem(catalogItem, {
      ...legacyAssignment,
      previewedIds: [catalogItem.id],
    })
    expect(result.error).toContain('Знакомство')
    expect(useForgeStore.getState().dailyVocabularyAssignment).toBe(legacyAssignment)
    expect(useForgeStore.getState().phrases.some((phrase) => phrase.tags.includes(catalogItemTag(catalogItem.id)))).toBe(false)
    vi.useRealTimers()
  })

  it('rejects stale-day, wrong-level, and unpersisted forged Daily Ten proposals', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const today = {
      dayKey: '2026-07-20', level: 'B1' as const,
      itemIds: [catalogItem.id], enrolledIds: [], previewedIds: [catalogItem.id],
    }
    useForgeStore.setState((state) => ({
      preferences: { ...state.preferences, currentLevel: 'B1' },
      dailyVocabularyAssignment: today,
      dailyVocabularyAssignments: [today],
    }))
    const beforePhrases = useForgeStore.getState().phrases

    expect(useForgeStore.getState().enrollCatalogItem(catalogItem, { ...today, dayKey: '2026-07-19' }).error).toContain('сегодняшнего')
    expect(useForgeStore.getState().enrollCatalogItem(catalogItem, { ...today, level: 'B2' }).error).toContain('текущего уровня')

    useForgeStore.setState({ dailyVocabularyAssignment: null, dailyVocabularyAssignments: [] })
    expect(useForgeStore.getState().enrollCatalogItem(catalogItem, today).error).toContain('сохранённый ежедневный набор')
    expect(useForgeStore.getState().phrases).toBe(beforePhrases)
    expect(useForgeStore.getState().phrases.some((phrase) => phrase.tags.includes(catalogItemTag(catalogItem.id)))).toBe(false)
    vi.useRealTimers()
  })

  it('uses trusted canonical metadata when enrollment receives a forged row with a real id', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const assignment = {
      dayKey: '2026-07-20', level: 'B1' as const,
      itemIds: [catalogItem.id], enrolledIds: [], previewedIds: [catalogItem.id],
    }
    persistCurrentDailyAssignment(assignment)
    const forgedSameId: LexicalCatalogItem = {
      ...catalogItem,
      expression: 'forged same-id expression',
      translationRu: 'поддельный перевод',
      meaningEn: 'forged meaning',
      example: 'A forged example must never be persisted.',
      activationError: {
        incorrectContext: 'Forged incorrect context.',
        expectedCorrection: 'A forged example must never be persisted.',
        cue: 'Forged cue.',
      },
    }

    const result = useForgeStore.getState().enrollCatalogItem(forgedSameId, assignment)
    const phrase = useForgeStore.getState().phrases.find((item) => item.id === result.id)!

    expect(result.error).toBeUndefined()
    expect(phrase.canonical).toBe(catalogItem.expression)
    expect(phrase.canonical).not.toBe(forgedSameId.expression)
    expect(phrase.activationError).toEqual(catalogItem.activationError)
    expect(phrase.context).toBe(catalogItem.example)
    vi.useRealTimers()
  })

  it('does not promote stale or forged preview proposals into the current Daily Ten', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const today = {
      dayKey: '2026-07-20', level: 'B1' as const,
      itemIds: [catalogItem.id], enrolledIds: [],
    }
    persistCurrentDailyAssignment(today)
    const persisted = useForgeStore.getState().dailyVocabularyAssignment

    useForgeStore.getState().markDailyVocabularyPreviewed(catalogItem.id, { ...today, dayKey: '2026-07-19' })
    useForgeStore.getState().markDailyVocabularyPreviewed('forged-item', { ...today, itemIds: ['forged-item'] })
    expect(useForgeStore.getState().dailyVocabularyAssignment).toBe(persisted)
    expect(useForgeStore.getState().dailyVocabularyAssignment?.previewedIds).toBeUndefined()

    useForgeStore.setState({ dailyVocabularyAssignment: null, dailyVocabularyAssignments: [] })
    useForgeStore.getState().markDailyVocabularyPreviewed(catalogItem.id, today)
    expect(useForgeStore.getState().dailyVocabularyAssignment).toBeNull()
    expect(useForgeStore.getState().dailyVocabularyAssignments).toEqual([])
    vi.useRealTimers()
  })

  it('saves a complete reference row for personal enrichment without enrolling it in Daily Ten', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const referenceItem: LexicalCatalogItem = {
      ...catalogItem,
      id: 'lex-b1-reference-personal',
      expression: 'keep steady progress',
      translationRu: 'поддерживать устойчивый прогресс',
      meaningEn: 'continue improving at a consistent rate',
      example: 'Short daily sessions help us keep steady progress.',
      exampleTranslationRu: 'Короткие ежедневные занятия помогают поддерживать устойчивый прогресс.',
      activationReady: false,
      activationError: undefined,
    }
    const assignment = { dayKey: '2026-07-20', level: 'B1' as const, itemIds: [catalogItem.id], enrolledIds: [] }
    useForgeStore.getState().ensureDailyVocabularyAssignment(assignment)
    const beforeAssignment = useForgeStore.getState().dailyVocabularyAssignment
    const beforeAssignments = useForgeStore.getState().dailyVocabularyAssignments

    const result = useForgeStore.getState().saveReferenceCatalogItem(referenceItem)
    const state = useForgeStore.getState()
    const phrase = state.phrases.find((item) => item.id === result.id)!

    expect(result.id).toBeTruthy()
    expect(state.dailyVocabularyAssignment).toBe(beforeAssignment)
    expect(state.dailyVocabularyAssignments).toBe(beforeAssignments)
    expect(referenceItem.activationReady).toBe(false)
    expect(phrase).toMatchObject({
      canonical: referenceItem.expression,
      meaning: `${referenceItem.translationRu} · ${referenceItem.meaningEn}`,
      context: referenceItem.example,
      cefr: referenceItem.level,
      status: 'new',
      activationStage: 0,
      activationError: undefined,
    })
    expect(phrase.tags).toEqual(expect.arrayContaining([catalogItemTag(referenceItem.id), PERSONAL_CATALOG_ENRICHMENT_TAG]))
    expect(phrase.note).toContain(referenceItem.exampleTranslationRu)
    expect(phrase.examples).toContainEqual(expect.objectContaining({ text: referenceItem.example }))
    expect(phrase.depth.grammarFrame).toBe(referenceItem.pattern ?? '')
    expect(state.skillStates.filter((skill) => skill.phraseId === phrase.id)).toHaveLength(4)
    expect(buildDailyActivationQueue([phrase], null, new Date('2026-07-20T12:00:00.000Z'), 1, 1)).toEqual([{ phraseId: phrase.id, skill: 'meaning_recall', mode: 'recognition' }])
    vi.useRealTimers()
  })

  it('keeps personal Step-6 authoring when a reference save enriches an existing duplicate', () => {
    const personal = useForgeStore.getState().addPhrase({
      canonical: 'keep steady progress', meaning: 'my own gloss', context: 'We keep steady progress through regular review.', source: 'Notebook',
      kind: 'collocation', cefr: 'B1', register: ['neutral'], tags: ['personal'], note: '',
      activationError: {
        incorrectContext: 'We make steady progress through regular review.',
        expectedCorrection: 'We keep steady progress through regular review.',
        cue: 'Use keep with this personal learning expression.',
      },
    })
    const referenceItem: LexicalCatalogItem = {
      ...catalogItem,
      id: 'lex-b1-reference-duplicate',
      expression: 'keep steady progress',
      example: 'Short daily sessions help us keep steady progress.',
      activationReady: false,
      activationError: undefined,
    }
    const beforeAssignments = useForgeStore.getState().dailyVocabularyAssignments

    const result = useForgeStore.getState().saveReferenceCatalogItem(referenceItem)
    const phrase = useForgeStore.getState().phrases.find((item) => item.id === personal.id)!

    expect(result.id).toBe(personal.id)
    expect(phrase.meaning).toBe('my own gloss')
    expect(phrase.activationError).toEqual({
      incorrectContext: 'We make steady progress through regular review.',
      expectedCorrection: 'We keep steady progress through regular review.',
      cue: 'Use keep with this personal learning expression.',
    })
    expect(useForgeStore.getState().dailyVocabularyAssignments).toBe(beforeAssignments)
  })

  it('invalidates attached Step-6 authoring when the canonical expression changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const assignment = { dayKey: '2026-07-20', level: 'B1' as const, itemIds: [catalogItem.id], enrolledIds: [] }
    const discoveredAssignment = { ...assignment, previewedIds: [catalogItem.id] }
    persistCurrentDailyAssignment(discoveredAssignment)
    const enrolled = useForgeStore.getState().enrollCatalogItem(catalogItem, discoveredAssignment)
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === enrolled.id)?.activationError).toBeDefined()

    useForgeStore.getState().updatePhrase(enrolled.id!, { canonical: 'maintain a daily record' })
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === enrolled.id)?.activationError).toBeUndefined()
    vi.useRealTimers()
  })

  it('resets completed activation when catalog enrollment changes a manual Step-6 contract', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const manual = useForgeStore.getState().addPhrase({
      canonical: catalogItem.expression,
      meaning: 'personal meaning',
      context: 'Support teams deal with difficult requests every day.',
      source: 'Notebook', kind: 'collocation', cefr: 'B1', register: ['neutral'], tags: [], note: '',
      activationError: {
        incorrectContext: 'Support teams solve with difficult requests every day.',
        expectedCorrection: 'Support teams deal with difficult requests every day.',
        cue: 'Use the learner-authored phrasal verb.',
      },
    })
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase) => phrase.id === manual.id ? { ...phrase, activationStage: 8 as const } : phrase),
      skillStates: state.skillStates.map((skill) => skill.phraseId === manual.id ? { ...skill, attempts: 4, consecutiveSuccesses: 3 } : skill),
    }))
    const assignment = { dayKey: '2026-07-20', level: 'B1' as const, itemIds: [catalogItem.id], enrolledIds: [] }
    const discoveredAssignment = { ...assignment, previewedIds: [catalogItem.id] }
    persistCurrentDailyAssignment(discoveredAssignment)

    useForgeStore.getState().enrollCatalogItem(catalogItem, discoveredAssignment)
    const state = useForgeStore.getState()
    const revised = state.phrases.find((phrase) => phrase.id === manual.id)!
    expect(revised.activationError).toEqual(catalogItem.activationError)
    expect(revised).toMatchObject({ activationStage: 0, status: 'new', evidenceResetAt: '2026-07-20T09:00:00.000Z' })
    expect(state.skillStates.filter((skill) => skill.phraseId === manual.id).every((skill) => skill.attempts === 0)).toBe(true)
    vi.useRealTimers()
  })

  it('ignores forged same-id reconciliation rows and restores canonical metadata with an evidence reset', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const assignment = { dayKey: '2026-07-20', level: 'B1' as const, itemIds: [catalogItem.id], enrolledIds: [] }
    const discoveredAssignment = { ...assignment, previewedIds: [catalogItem.id] }
    persistCurrentDailyAssignment(discoveredAssignment)
    const enrolled = useForgeStore.getState().enrollCatalogItem(catalogItem, discoveredAssignment)
    const forgedItem = {
      ...catalogItem,
      activationError: {
        incorrectContext: 'I keep daily record of every practice session.',
        expectedCorrection: catalogItem.example,
        cue: 'Repair the fixed expression.',
      },
    }
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase) => phrase.id === enrolled.id ? {
        ...phrase,
        activationStage: 8 as const,
        activationError: forgedItem.activationError,
      } : phrase),
      skillStates: state.skillStates.map((skill) => skill.phraseId === enrolled.id ? { ...skill, attempts: 4 } : skill),
    }))

    const legacyCaller = useForgeStore.getState().reconcileCatalogReadiness as unknown as (items: readonly LexicalCatalogItem[]) => void
    legacyCaller([forgedItem])
    const state = useForgeStore.getState()
    expect(state.phrases.find((phrase) => phrase.id === enrolled.id)).toMatchObject({
      activationStage: 0,
      activationError: catalogItem.activationError,
      evidenceResetAt: '2026-07-20T09:00:00.000Z',
    })
    expect(state.skillStates.filter((skill) => skill.phraseId === enrolled.id).every((skill) => skill.attempts === 0)).toBe(true)
    vi.useRealTimers()
  })

  it('reconciles a downgraded catalog card outside the currently selected CEFR level', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const legacy = simulateLegacyBundledReference(referenceCatalogItem)
    useForgeStore.setState((state) => ({
      preferences: { ...state.preferences, currentLevel: 'B2' },
      phrases: state.phrases.map((phrase) => phrase.id === legacy.id ? { ...phrase, activationStage: 8 as const, status: 'active' as const } : phrase),
      skillStates: state.skillStates.map((skill) => skill.phraseId === legacy.id ? { ...skill, attempts: 4, consecutiveSuccesses: 3 } : skill),
      missions: state.missions.map((mission, index) => index === 0 ? { ...mission, targetPhraseIds: [legacy.id], legacyContract: false } : mission),
      grammarProgress: [{
        lessonId: 'b1-past-perfect', attempts: 1, passes: 0, bestScore: 1, totalQuestions: 3,
        lastAttemptedAt: '2026-07-19T09:00:00.000Z', productionTargetPhraseId: legacy.id, transferTargetPhraseId: legacy.id,
      }],
    }))

    useForgeStore.getState().reconcileCatalogReadiness()
    const state = useForgeStore.getState()
    const phrase = state.phrases.find((candidate) => candidate.id === legacy.id)!

    expect(state.preferences.currentLevel).toBe('B2')
    expect(phrase).toMatchObject({
      activationStage: 0,
      legacyActivationStage: 8,
      status: 'new',
      activationError: undefined,
      legacyActivationError: legacy.activationError,
      evidenceResetAt: '2026-07-20T09:00:00.000Z',
    })
    expect(phrase.tags).toContain(PERSONAL_CATALOG_ENRICHMENT_TAG)
    expect(state.skillStates.filter((skill) => skill.phraseId === legacy.id).every((skill) => skill.attempts === 0)).toBe(true)
    expect(state.missions[0].legacyContract).toBe(true)
    expect(state.grammarProgress[0].productionTargetPhraseId).toBeUndefined()
    expect(state.grammarProgress[0].transferTargetPhraseId).toBeUndefined()
    vi.useRealTimers()
  })

  it('preserves a learner-authored Step-6 pair when its bundled catalog row is downgraded', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const enrolled = useForgeStore.getState().saveReferenceCatalogItem(referenceCatalogItem)
    const personalError = {
      incorrectContext: `I used ${referenceCatalogItem.expression} incorrectly in this sentence.`,
      expectedCorrection: referenceCatalogItem.example,
      cue: 'Use the learner-authored personal contrast.',
    }

    expect(useForgeStore.getState().updatePhrase(enrolled.id!, { activationError: personalError }).error).toBeUndefined()
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase) => phrase.id === enrolled.id ? { ...phrase, activationStage: 5 as const } : phrase),
    }))
    useForgeStore.getState().reconcileCatalogReadiness()
    const phrase = useForgeStore.getState().phrases.find((candidate) => candidate.id === enrolled.id)!

    expect(phrase.tags).toContain(PERSONAL_CATALOG_ENRICHMENT_TAG)
    expect(phrase.activationError).toEqual(personalError)
    expect(phrase.activationStage).toBe(5)
    expect(phrase.legacyActivationError).toBeUndefined()
    vi.useRealTimers()
  })

  it('does not relabel unchanged bundled Step-6 metadata as personal during a note edit', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const legacy = simulateLegacyBundledReference(referenceCatalogItem)
    const current = useForgeStore.getState().phrases.find((phrase) => phrase.id === legacy.id)!

    useForgeStore.getState().updatePhrase(legacy.id, { note: 'A personal memory note.', activationError: current.activationError })
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === legacy.id)?.tags).not.toContain(PERSONAL_CATALOG_ENRICHMENT_TAG)
    useForgeStore.setState((state) => ({ phrases: state.phrases.map((phrase) => phrase.id === legacy.id ? { ...phrase, activationStage: 5 as const } : phrase) }))
    useForgeStore.getState().reconcileCatalogReadiness()
    const downgraded = useForgeStore.getState().phrases.find((phrase) => phrase.id === legacy.id)!

    expect(downgraded.activationStage).toBe(0)
    expect(downgraded.activationError).toBeUndefined()
    expect(downgraded.legacyActivationError).toEqual(legacy.activationError)
    vi.useRealTimers()
  })

  it('fills a partially complete manual duplicate while preserving personal fields and safely unlocking schedules', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const manual = useForgeStore.getState().addPhrase({
      canonical: catalogItem.expression, meaning: 'my concise personal gloss', context: '', source: 'Notebook',
      kind: 'collocation', cefr: 'C1', register: ['informal'], tags: ['personal'], note: 'My association',
    })
    const beforeSchedules = structuredClone(useForgeStore.getState().skillStates.filter((state) => state.phraseId === manual.id))
    const assignment = { dayKey: '2026-07-20', level: 'B1' as const, itemIds: [catalogItem.id], enrolledIds: [] }
    const discoveredAssignment = { ...assignment, previewedIds: [catalogItem.id] }
    persistCurrentDailyAssignment(discoveredAssignment)

    const result = useForgeStore.getState().enrollCatalogItem(catalogItem, discoveredAssignment)
    const state = useForgeStore.getState()
    const enriched = state.phrases.find((phrase) => phrase.id === manual.id)!

    expect(result.id).toBe(manual.id)
    expect(state.phrases.filter((phrase) => phraseFingerprint(phrase.canonical) === phraseFingerprint(catalogItem.expression))).toHaveLength(1)
    expect(enriched.meaning).toBe('my concise personal gloss')
    expect(enriched.context).toBe(catalogItem.example)
    expect(enriched.examples[0]?.text).toBe(catalogItem.example)
    expect(enriched.tags).toEqual(expect.arrayContaining(['personal', catalogItemTag(catalogItem.id)]))
    expect(enriched.note).toContain('My association')
    expect(state.skillStates.filter((skill) => skill.phraseId === manual.id)).not.toEqual(beforeSchedules)
    expect(state.skillStates.filter((skill) => skill.phraseId === manual.id).every((skill) => skill.attempts === 0)).toBe(true)
    vi.useRealTimers()
  })

  it('restores an archived catalog duplicate instead of creating a second record', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const manual = useForgeStore.getState().addPhrase({
      canonical: catalogItem.expression, meaning: 'complete meaning', context: `I ${catalogItem.expression} in a complete personal example.`, source: 'Notebook',
      kind: 'collocation', cefr: 'B1', register: ['neutral'], tags: [], note: '',
    })
    useForgeStore.getState().archivePhrase(manual.id!)
    const before = useForgeStore.getState().phrases.length
    const assignment = { dayKey: '2026-07-20', level: 'B1' as const, itemIds: [catalogItem.id], enrolledIds: [] }
    const discoveredAssignment = { ...assignment, previewedIds: [catalogItem.id] }
    persistCurrentDailyAssignment(discoveredAssignment)

    const result = useForgeStore.getState().enrollCatalogItem(catalogItem, discoveredAssignment)
    const restored = useForgeStore.getState().phrases.find((phrase) => phrase.id === manual.id)!

    expect(result.id).toBe(manual.id)
    expect(useForgeStore.getState().phrases).toHaveLength(before)
    expect(restored.status).toBe('new')
    expect(restored.archivedAt).toBeUndefined()
    expect(restored.tags).toContain(catalogItemTag(catalogItem.id))
    vi.useRealTimers()
  })

  it('removes a deleted phrase from daily enrollment while preserving the assigned slot', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const assignment = { dayKey: '2026-07-20', level: 'B1' as const, itemIds: [catalogItem.id], enrolledIds: [], previewedIds: [catalogItem.id] }
    persistCurrentDailyAssignment(assignment)
    const enrolled = useForgeStore.getState().enrollCatalogItem(catalogItem, assignment)
    useForgeStore.getState().deletePhrase(enrolled.id!)
    expect(useForgeStore.getState().dailyVocabularyAssignment).toEqual({ ...assignment, enrolledIds: [] })
    vi.useRealTimers()
  })

  it('persists a one-slot daily replacement through the store action', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T09:00:00.000Z')
    vi.setSystemTime(now)
    const catalog = Array.from({ length: 14 }, (_, index): LexicalCatalogItem => ({
      ...catalogItem, id: `replacement-${index}`, expression: `replacement phrase ${index}`,
    }))
    const assignment = {
      dayKey: localDayKey(now), level: 'B1' as const,
      itemIds: catalog.slice(0, 10).map((item) => item.id), enrolledIds: [catalog[0].id],
    }
    useForgeStore.setState((state) => ({ preferences: { ...state.preferences, currentLevel: 'B1' }, dailyVocabularyAssignment: assignment }))

    const result = useForgeStore.getState().replaceDailyVocabularyItem(catalog[0].id, catalog, now)
    const replaced = useForgeStore.getState().dailyVocabularyAssignment!

    expect(result.replacementId).toBeTruthy()
    expect(replaced.itemIds[0]).toBe(result.replacementId)
    expect(replaced.itemIds.slice(1)).toEqual(assignment.itemIds.slice(1))
    expect(replaced.enrolledIds).not.toContain(catalog[0].id)
    vi.useRealTimers()
  })

  it('blocks forged replace to preview to enroll composition with the trusted catalog', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T09:00:00.000Z')
    vi.setSystemTime(now)
    const assignment = createDailyVocabularyAssignment(trustedB1Catalog, 'B1', [], now, 10)
    persistCurrentDailyAssignment(assignment)
    const forgedItem: LexicalCatalogItem = {
      ...catalogItem,
      id: 'forged-replacement-item',
      expression: 'forged replacement expression',
    }
    const forgedCatalog = [...trustedB1Catalog.slice(0, 10), forgedItem]

    const replacement = useForgeStore.getState().replaceDailyVocabularyItem(
      assignment.itemIds[0],
      forgedCatalog,
      new Date('2026-07-19T09:00:00.000Z'),
    )
    const persisted = useForgeStore.getState().dailyVocabularyAssignment!
    expect(replacement.replacementId).toBeTruthy()
    expect(replacement.replacementId).not.toBe(forgedItem.id)
    expect(persisted.itemIds).not.toContain(forgedItem.id)

    const forgedProposal = { ...persisted, itemIds: [...persisted.itemIds, forgedItem.id] }
    useForgeStore.getState().markDailyVocabularyPreviewed(forgedItem.id, forgedProposal)
    expect(useForgeStore.getState().dailyVocabularyAssignment?.previewedIds ?? []).not.toContain(forgedItem.id)
    expect(useForgeStore.getState().enrollCatalogItem(forgedItem, forgedProposal).error).toContain('проверенный каталог')
    expect(useForgeStore.getState().phrases.some((phrase) => phrase.canonical === forgedItem.expression)).toBe(false)
    vi.useRealTimers()
  })

  it('rejects a stale active pack even when the caller supplies its old date', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T09:00:00.000Z')
    vi.setSystemTime(now)
    const catalog = Array.from({ length: 14 }, (_, index): LexicalCatalogItem => ({
      ...catalogItem, id: `stale-replacement-${index}`, expression: `stale replacement phrase ${index}`,
    }))
    const stale = {
      dayKey: '2026-07-19', level: 'B1' as const,
      itemIds: catalog.slice(0, 10).map((item) => item.id), enrolledIds: [],
    }
    persistCurrentDailyAssignment(stale)

    const result = useForgeStore.getState().replaceDailyVocabularyItem(
      catalog[0].id,
      catalog,
      new Date('2026-07-19T09:00:00.000Z'),
    )

    expect(result.error).toContain('today’s current-level')
    expect(useForgeStore.getState().dailyVocabularyAssignment).toBe(stale)
    expect(useForgeStore.getState().dailyVocabularyAssignments).toEqual([stale])
    vi.useRealTimers()
  })

  it('restores a replaced pack after switching levels and back on the same day', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T09:00:00.000Z')
    vi.setSystemTime(now)
    const b1 = createDailyVocabularyAssignment(trustedB1Catalog, 'B1', [], now, 10)
    persistCurrentDailyAssignment(b1)
    const replacement = useForgeStore.getState().replaceDailyVocabularyItem(b1.itemIds[0], trustedB1Catalog, now).replacementId!
    const replacedB1 = useForgeStore.getState().dailyVocabularyAssignment!
    expect(replacedB1.itemIds[0]).toBe(replacement)

    const a2 = { dayKey: localDayKey(now), level: 'A2' as const, itemIds: ['forged-a2'], enrolledIds: [] }
    useForgeStore.setState((state) => ({ preferences: { ...state.preferences, currentLevel: 'A2' } }))
    useForgeStore.getState().ensureDailyVocabularyAssignment(a2, [], true)
    expect(useForgeStore.getState().dailyVocabularyAssignment?.itemIds.every((id) => trustedA2Catalog.some((item) => item.id === id))).toBe(true)
    useForgeStore.setState((state) => ({ preferences: { ...state.preferences, currentLevel: 'B1' } }))
    useForgeStore.getState().ensureDailyVocabularyAssignment(b1)

    expect(useForgeStore.getState().dailyVocabularyAssignment?.itemIds[0]).toBe(replacement)
    expect(useForgeStore.getState().dailyVocabularyAssignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'A2' }),
      expect.objectContaining({ level: 'B1', itemIds: replacedB1.itemIds }),
    ]))
    vi.useRealTimers()
  })

  it('keeps a too-simple card out of future packs after archive and replacement', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T09:00:00.000Z')
    vi.setSystemTime(now)
    const assignment = createDailyVocabularyAssignment(trustedB1Catalog, 'B1', [], now, 10)
    const target = trustedB1Catalog.find((item) => assignment.itemIds.includes(item.id) && item.activationReady === true)!
    const discoveredAssignment = { ...assignment, previewedIds: [target.id] }
    persistCurrentDailyAssignment(discoveredAssignment)

    const enrolled = useForgeStore.getState().enrollCatalogItem(target, discoveredAssignment)
    useForgeStore.getState().archivePhrase(enrolled.id!)
    useForgeStore.getState().replaceDailyVocabularyItem(target.id, trustedB1Catalog, now)

    const state = useForgeStore.getState()
    expect(state.phrases.find((phrase) => phrase.id === enrolled.id)?.status).toBe('archived')
    expect(state.dailyVocabularyAssignment?.itemIds).not.toContain(target.id)
    const tomorrow = new Date('2026-07-21T09:00:00.000Z')
    const nextPack = createDailyVocabularyAssignment(trustedB1Catalog, 'B1', state.phrases, tomorrow, 10)
    expect(nextPack.itemIds).not.toContain(target.id)
    vi.useRealTimers()
  })

  it('tags and prioritizes a complete manual same-day duplicate as its catalog item', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T09:00:00.000Z')
    vi.setSystemTime(now)
    const generated = createDailyVocabularyAssignment(trustedB1Catalog, 'B1', [], now, 10)
    const target = trustedB1Catalog.find((item) => generated.itemIds.includes(item.id) && item.activationReady === true && !item.expression.includes('...'))!
    const manual = useForgeStore.getState().addPhrase({
      canonical: target.expression, meaning: 'my existing meaning', context: target.example,
      source: 'Manual entry', kind: 'collocation', cefr: 'B1', register: ['neutral'], tags: [], note: '',
    })

    useForgeStore.setState((state) => ({ preferences: { ...state.preferences, currentLevel: 'B1' } }))
    useForgeStore.getState().ensureDailyVocabularyAssignment(generated, trustedB1Catalog)

    const state = useForgeStore.getState()
    const phrase = state.phrases.find((entry) => entry.id === manual.id)!
    expect(phrase.tags).toContain(catalogItemTag(target.id))
    const queue = buildDailyActivationQueue([phrase], state.dailyVocabularyAssignment, now, 1, 1, 'B1')
    expect(queue[0]?.phraseId).toBe(manual.id)
    vi.useRealTimers()
  })

  it('derives ensure membership canonically despite forged, stale, wrong-level, and replaceSameDay proposals', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    useForgeStore.setState((state) => ({ preferences: { ...state.preferences, currentLevel: 'B1' } }))
    const forgedItem = { ...catalogItem, id: 'forged-ensure-item', expression: 'forged ensure expression' }
    const forged = {
      dayKey: '2026-07-20', level: 'B1' as const,
      itemIds: [forgedItem.id], enrolledIds: [forgedItem.id], previewedIds: [forgedItem.id], deferredIds: [catalogItem.id],
    }

    useForgeStore.getState().ensureDailyVocabularyAssignment(forged, [forgedItem], true)
    const canonical = useForgeStore.getState().dailyVocabularyAssignment!
    expect(canonical.itemIds).not.toContain(forgedItem.id)
    expect(canonical.enrolledIds).not.toContain(forgedItem.id)
    expect(canonical.previewedIds ?? []).not.toContain(forgedItem.id)
    expect(canonical.deferredIds ?? []).not.toContain(catalogItem.id)

    useForgeStore.getState().ensureDailyVocabularyAssignment({ ...forged, dayKey: '2026-07-19' }, [forgedItem], true)
    useForgeStore.getState().ensureDailyVocabularyAssignment({ ...forged, level: 'B2' }, [forgedItem], true)
    expect(useForgeStore.getState().dailyVocabularyAssignment).toBe(canonical)

    useForgeStore.getState().markDailyVocabularyPreviewed(forgedItem.id, forged)
    expect(useForgeStore.getState().enrollCatalogItem(forgedItem, forged).error).toContain('проверенный каталог')
    expect(useForgeStore.getState().dailyVocabularyAssignment).toBe(canonical)
    expect(useForgeStore.getState().phrases.some((phrase) => phrase.canonical === forgedItem.expression)).toBe(false)
    vi.useRealTimers()
  })

  it('persists explicit first-pass progress for a Daily Ten card idempotently', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
    const assignment = { dayKey: '2026-07-20', level: 'B1' as const, itemIds: [catalogItem.id], enrolledIds: [] }
    persistCurrentDailyAssignment(assignment)
    useForgeStore.getState().markDailyVocabularyPreviewed(catalogItem.id, assignment)
    const once = useForgeStore.getState().dailyVocabularyAssignment
    useForgeStore.getState().markDailyVocabularyPreviewed(catalogItem.id, assignment)

    expect(once?.previewedIds).toEqual([catalogItem.id])
    expect(useForgeStore.getState().dailyVocabularyAssignment).toBe(once)
    expect(useForgeStore.getState().dailyVocabularyAssignments.find((item) => item.dayKey === assignment.dayKey && item.level === assignment.level)?.previewedIds).toEqual([catalogItem.id])
    vi.useRealTimers()
  })

  it('bounds Daily Ten history without evicting any of the preceding eighty four-level days', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T09:00:00.000Z')
    vi.setSystemTime(now)
    const levels = ['A2', 'B1', 'B2', 'C1'] as const
    const history = Array.from({ length: DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1 - Math.floor(index / levels.length), 9)
      return { dayKey: localDayKey(date), level: levels[index % levels.length], itemIds: [], enrolledIds: [] }
    })
    const oldest = history.at(-1)!
    useForgeStore.setState((state) => ({
      preferences: { ...state.preferences, currentLevel: 'B1' },
      dailyVocabularyAssignment: null,
      dailyVocabularyAssignments: history,
    }))

    useForgeStore.getState().ensureDailyVocabularyAssignment()

    const persisted = useForgeStore.getState().dailyVocabularyAssignments
    expect(persisted).toHaveLength(DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT)
    expect(persisted[0]).toBe(useForgeStore.getState().dailyVocabularyAssignment)
    expect(persisted).not.toContain(oldest)
    expect(persisted.slice(1)).toEqual(history.slice(0, -1))
    vi.useRealTimers()
  })

  it('rehydrates a validated persisted profile in a fresh-state simulation', async () => {
    const profile = createSeedData()
    profile.preferences.dailyMinutes = 37
    profile.dailyVocabularyAssignment = { dayKey: '2026-07-20', level: 'A2', itemIds: ['lex-a2-test'], enrolledIds: ['lex-a2-test'] }
    useForgeStore.setState({ preferences: { ...profile.preferences, dailyMinutes: 10 } })
    await replacePersistedProfile(profile)
    await useForgeStore.persist.rehydrate()
    expect(useForgeStore.getState().preferences.dailyMinutes).toBe(37)
    expect(useForgeStore.getState().dailyVocabularyAssignment).toEqual(profile.dailyVocabularyAssignment)
  })

  it('records spoken evidence only when a detected target is confirmed without support', async () => {
    useForgeStore.setState((state) => ({ phrases: state.phrases.map((phrase) => phrase.id === 'phrase-bear-in-mind' ? { ...phrase, activationStage: 6, activationEvents: qualifiedEventsThrough(phrase, 6) } : phrase) }))
    const before = useForgeStore.getState().skillStates.find((state) => state.phraseId === 'phrase-bear-in-mind' && state.skill === 'spoken_productive')!
    const result = await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'spoken-1', sessionId: 'session-1', mode: 'targeted_response', prompt: 'Give advice.',
      targetPhraseIds: ['phrase-bear-in-mind'], confirmedPhraseIds: ['phrase-bear-in-mind'],
      transcript: 'Please bear in mind that this is only an early estimate.', durationSeconds: 8,
      recordingId: 'test_recording', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false, selfRating: { clarity: 4, flow: 3 },
    })
    expect(result.id).toBeTruthy()
    const attempt = useForgeStore.getState().speakingAttempts[0]
    expect(attempt.detectedPhraseIds).toEqual(['phrase-bear-in-mind'])
    expect(attempt.confirmedPhraseIds).toEqual(['phrase-bear-in-mind'])
    const after = useForgeStore.getState().skillStates.find((state) => state.phraseId === 'phrase-bear-in-mind' && state.skill === 'spoken_productive')!
    expect(after.attempts).toBe(before.attempts + 1)
  })

  it('fails closed when a speaking prompt itself exposes the target form', async () => {
    const phraseId = 'phrase-bear-in-mind'
    const before = useForgeStore.getState().skillStates.find((state) => state.phraseId === phraseId && state.skill === 'spoken_productive')!
    await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'prompt-exposes-target', sessionId: 'prompt-exposes-target', mode: 'targeted_response', prompt: 'Please bear in mind the deadline.',
      targetPhraseIds: [phraseId], confirmedPhraseIds: [phraseId], transcript: 'Please bear in mind that this estimate may change tomorrow.', durationSeconds: 8,
      recordingId: 'prompt_exposes_target_audio', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false, selfRating: { clarity: 4, flow: 4 },
    })
    const attempt = useForgeStore.getState().speakingAttempts.find((item) => item.idempotencyKey === 'prompt-exposes-target')!
    expect(attempt.targetFormVisible).toBe(true)
    const after = useForgeStore.getState().skillStates.find((state) => state.phraseId === phraseId && state.skill === 'spoken_productive')!
    expect(after.attempts).toBe(before.attempts)
  })

  it('removes stage-seven evidence when its sole saved voice attempt is deleted', async () => {
    const phraseId = 'phrase-bear-in-mind'
    useForgeStore.setState((state) => ({ phrases: state.phrases.map((phrase) => phrase.id === phraseId ? { ...phrase, activationStage: 6, activationUpdatedAt: '2026-07-17T08:00:00.000Z', activationEvents: qualifiedEventsThrough(phrase, 6) } : phrase) }))
    const saved = await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'spoken-delete-evidence', sessionId: 'spoken-delete-evidence', mode: 'targeted_response', prompt: 'Give advice.',
      targetPhraseIds: [phraseId], confirmedPhraseIds: [phraseId], transcript: 'Please bear in mind that this estimate may still change tomorrow.', durationSeconds: 8,
      recordingId: 'spoken_delete_evidence', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false, selfRating: { clarity: 4, flow: 4 },
    })
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === phraseId)?.activationStage).toBe(7)
    await useForgeStore.getState().deleteSpeakingAttempt(saved.id!)
    const phrase = useForgeStore.getState().phrases.find((item) => item.id === phraseId)!
    expect(phrase.activationStage).toBe(6)
    expect(phrase.activationEvents?.some((event) => event.stage >= 7)).toBe(false)
  })

  it('drops delayed step eight when the surviving oral evidence happened after it', async () => {
    const phraseId = 'phrase-bear-in-mind'
    const makeAttempt = (id: string, createdAt: string) => ({
      id, idempotencyKey: id, sessionId: id, mode: 'targeted_response' as const, prompt: 'Give advice.',
      targetPhraseIds: [phraseId], detectedPhraseIds: [phraseId], confirmedPhraseIds: [phraseId],
      evidenceEligiblePhraseIds: [phraseId],
      transcript: 'Please bear in mind that this estimate may still change tomorrow.', durationSeconds: 8,
      recordingId: `${id}_audio`, mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false, selfRating: { clarity: 4 as const, flow: 4 as const }, createdAt,
    })
    const first = makeAttempt('oral-before-review', '2026-07-17T08:00:00.000Z')
    const later = makeAttempt('oral-after-review', '2026-07-17T22:00:00.000Z')
    useForgeStore.setState((state) => ({
      speakingAttempts: [later, first],
      phrases: state.phrases.map((phrase) => phrase.id === phraseId ? {
        ...phrase, activationStage: 8, activationUpdatedAt: '2026-07-17T21:00:00.000Z', createdAt: '2026-07-01T08:00:00.000Z',
        activationEvents: [
          ...qualifiedEventsThrough({ ...phrase, createdAt: '2026-07-01T08:00:00.000Z' }, 6),
          { stage: 7 as const, completedAt: first.createdAt, evidenceId: first.id },
          { stage: 8 as const, completedAt: '2026-07-17T21:00:00.000Z', evidenceId: 'delayed-review' },
        ],
      } : phrase),
    }))
    await useForgeStore.getState().deleteSpeakingAttempt(first.id)
    const phrase = useForgeStore.getState().phrases.find((item) => item.id === phraseId)!
    expect(phrase.activationStage).toBe(7)
    expect(phrase.activationEvents?.some((event) => event.stage === 8)).toBe(false)
    expect(phrase.activationEvents?.find((event) => event.stage === 7)?.evidenceId).toBe(later.id)
  })

  it('treats the first two fluency ladder rounds as practice and only schedules the final round', async () => {
    useForgeStore.setState((state) => ({ phrases: state.phrases.map((phrase) => phrase.id === 'phrase-bear-in-mind' ? { ...phrase, activationStage: 6 as const, activationEvents: qualifiedEventsThrough(phrase, 6) } : phrase) }))
    const stateBefore = useForgeStore.getState().skillStates.find((state) => state.phraseId === 'phrase-bear-in-mind' && state.skill === 'spoken_productive')!.attempts
    for (const round of [1, 2] as const) await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: `ladder-${round}`, sessionId: 'ladder-family', mode: 'fluency_432', round, prompt: 'Give advice.',
      targetPhraseIds: ['phrase-bear-in-mind'], confirmedPhraseIds: ['phrase-bear-in-mind'], transcript: 'Please bear in mind that these plans may still change.',
      durationSeconds: 5, recordingId: `ladder_recording_${round}`, mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false, selfRating: { clarity: 3, flow: 3 },
    })
    expect(useForgeStore.getState().skillStates.find((state) => state.phraseId === 'phrase-bear-in-mind' && state.skill === 'spoken_productive')!.attempts).toBe(stateBefore)
    const finalRound = await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'ladder-3', sessionId: 'ladder-family', mode: 'fluency_432', round: 3, prompt: 'Give advice.',
      targetPhraseIds: ['phrase-bear-in-mind'], confirmedPhraseIds: ['phrase-bear-in-mind'], transcript: 'Please bear in mind that these plans may still change.',
      durationSeconds: 5, recordingId: 'ladder_recording_3', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false, selfRating: { clarity: 3, flow: 3 },
    })
    expect(useForgeStore.getState().skillStates.find((state) => state.phraseId === 'phrase-bear-in-mind' && state.skill === 'spoken_productive')!.attempts).toBe(stateBefore + 1)
    expect(await useForgeStore.getState().deleteSpeakingAttempt(finalRound.id!)).toHaveLength(3)
    expect(useForgeStore.getState().skillStates.find((state) => state.phraseId === 'phrase-bear-in-mind' && state.skill === 'spoken_productive')!.attempts).toBe(stateBefore)
  })

  it('rejects out-of-order or changed 4/3/2 families', async () => {
    const rejected = await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'bad-ladder', sessionId: 'bad-family', mode: 'fluency_432', round: 3, prompt: 'Give advice.',
      targetPhraseIds: ['phrase-bear-in-mind'], confirmedPhraseIds: [], transcript: 'Plans change.', durationSeconds: 5,
      recordingId: 'bad_ladder_3', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false, selfRating: { clarity: 3, flow: 3 },
    })
    expect(rejected.error).toContain('in order')
  })

  it('rejects media durations outside the task-specific limits', async () => {
    const longSpeaking = await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'too-long-speaking', sessionId: 'too-long-speaking', mode: 'targeted_response', prompt: 'Respond.',
      targetPhraseIds: [], confirmedPhraseIds: [], transcript: 'A response.', durationSeconds: 181,
      targetFormVisible: false, supportUsed: false, selfRating: { clarity: 3, flow: 3 },
    })
    expect(longSpeaking.error).toContain('180 seconds')

    const longFluency = await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'too-long-fluency', sessionId: 'too-long-fluency', mode: 'fluency_432', round: 1, prompt: 'Respond.',
      targetPhraseIds: [], confirmedPhraseIds: [], transcript: 'A response.', durationSeconds: 61,
      recordingId: 'too_long_fluency', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false, selfRating: { clarity: 3, flow: 3 },
    })
    expect(longFluency.error).toContain('60 seconds')

    await expect(useForgeStore.getState().addListeningClip({
      title: 'Too long', source: '', transcript: '', recordingId: 'too_long_listening', mimeType: 'audio/webm', durationSeconds: 301,
    })).rejects.toThrow('between 1 and 300 seconds')
  })

  it('requires completed playback and snapshots the listening reference', async () => {
    const base = {
      sourceId: 'daily-b1-2026-07-18', mode: 'dictation' as const,
      response: 'The train leaves at quarter past seven.', answerMatched: true, revealUsed: false,
      referenceTranscript: 'The train leaves at quarter past seven.', durationSeconds: 8,
    }
    await expect(useForgeStore.getState().recordListeningAttempt(base)).rejects.toThrow('Finish playing the audio')
    expect(useForgeStore.getState().listeningAttempts).toHaveLength(0)

    const id = await useForgeStore.getState().recordListeningAttempt({ ...base, playbackCompleted: true, sourceUpdatedAt: '2026-07-18T08:00:00.000Z' })
    expect(useForgeStore.getState().listeningAttempts.find((attempt) => attempt.id === id)).toMatchObject({
      playbackCompleted: true,
      referenceTranscript: base.referenceTranscript,
      sourceUpdatedAt: '2026-07-18T08:00:00.000Z',
      listeningEvidenceVersion: 1,
    })
    await expect(useForgeStore.getState().recordListeningAttempt({ ...base, playbackCompleted: true, response: 'A forged mismatch.' })).rejects.toThrow('must match the saved responses')
  })

  it('does not expose speaking metadata when the durable profile commit fails', async () => {
    const before = useForgeStore.getState().speakingAttempts.length
    const storageFailure = vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => { throw new Error('disk full') })
    await expect(useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'failed-commit', sessionId: 'failed-session', mode: 'targeted_response', prompt: 'Give advice.',
      targetPhraseIds: ['phrase-bear-in-mind'], confirmedPhraseIds: [], transcript: 'Plans change.', durationSeconds: 5,
      recordingId: 'failed_commit_audio', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false, selfRating: { clarity: 3, flow: 3 },
    })).rejects.toThrow('disk full')
    expect(useForgeStore.getState().speakingAttempts).toHaveLength(before)
    storageFailure.mockRestore()
  })

  it('rebases a durable media commit over a synchronous profile change', async () => {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    let injected = false
    const storage = vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      originalSetItem(key, value)
      if (!injected) {
        injected = true
        useForgeStore.getState().updatePreferences({ dailyMinutes: 44 })
      }
    })
    await useForgeStore.getState().addListeningClip({ title: 'Concurrent clip', source: '', transcript: '', recordingId: 'concurrent_clip', mimeType: 'audio/webm', durationSeconds: 5 })
    expect(useForgeStore.getState().preferences.dailyMinutes).toBe(44)
    expect(useForgeStore.getState().listeningClips.some((clip) => clip.recordingId === 'concurrent_clip')).toBe(true)
    const container = JSON.parse(window.localStorage.getItem('english-forge-profile-v1')!) as { activeId: string; profiles: Record<string, { envelope: { state: ReturnType<typeof createSeedData> } }> }
    const persisted = container.profiles[container.activeId].envelope
    expect(persisted.state.preferences.dailyMinutes).toBe(44)
    expect(persisted.state.listeningClips.some((clip) => clip.recordingId === 'concurrent_clip')).toBe(true)
    storage.mockRestore()
  })

  it('serializes overlapping media deletions without restoring a deleted reference', async () => {
    const first = await useForgeStore.getState().addListeningClip({ title: 'First', source: '', transcript: '', recordingId: 'delete_first', mimeType: 'audio/webm', durationSeconds: 5 })
    const second = await useForgeStore.getState().addListeningClip({ title: 'Second', source: '', transcript: '', recordingId: 'delete_second', mimeType: 'audio/webm', durationSeconds: 5 })
    await Promise.all([useForgeStore.getState().deleteListeningClip(first), useForgeStore.getState().deleteListeningClip(second)])
    expect(useForgeStore.getState().listeningClips.some((clip) => clip.id === first || clip.id === second)).toBe(false)
  })

  it('keeps transcript-only voice logs out of spoken evidence', async () => {
    const before = useForgeStore.getState().skillStates.find((state) => state.phraseId === 'phrase-bear-in-mind' && state.skill === 'spoken_productive')!.attempts
    await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'manual-log', sessionId: 'manual-session', mode: 'targeted_response', prompt: 'Give advice.',
      targetPhraseIds: ['phrase-bear-in-mind'], confirmedPhraseIds: ['phrase-bear-in-mind'], transcript: 'Bear in mind that plans change.',
      durationSeconds: 5, targetFormVisible: false, supportUsed: false, selfRating: { clarity: 3, flow: 3 },
    })
    expect(useForgeStore.getState().skillStates.find((state) => state.phraseId === 'phrase-bear-in-mind' && state.skill === 'spoken_productive')!.attempts).toBe(before)
  })

  it('deleting a practice-only voice note leaves every spoken schedule unchanged', async () => {
    const before = structuredClone(useForgeStore.getState().skillStates.filter((state) => state.skill === 'spoken_productive'))
    const saved = await useForgeStore.getState().recordSpeakingAttempt({
      idempotencyKey: 'note-delete', sessionId: 'note-delete', mode: 'targeted_response', prompt: 'Note.',
      targetPhraseIds: [], confirmedPhraseIds: [], transcript: 'A manual note without local audio.', durationSeconds: 5,
      targetFormVisible: false, supportUsed: false, selfRating: { clarity: 3, flow: 3 },
    })
    await useForgeStore.getState().deleteSpeakingAttempt(saved.id!)
    expect(useForgeStore.getState().skillStates.filter((state) => state.skill === 'spoken_productive')).toEqual(before)
  })

  it('keeps multiple local profiles isolated when creating and switching', async () => {
    const demoPhraseCount = useForgeStore.getState().phrases.length
    expect(demoPhraseCount).toBeGreaterThan(0)
    const firstId = getActiveProfileId()

    // A new profile becomes active and starts empty (routes the friend to placement).
    await useForgeStore.getState().createProfile('Друг')
    const secondId = getActiveProfileId()
    expect(secondId).not.toBe(firstId)
    expect(useForgeStore.getState().phrases.length).toBe(0)
    expect(useForgeStore.getState().preferences.placementCompletedAt).toBeUndefined()

    // Switching back restores the first learner's data untouched.
    await useForgeStore.getState().switchProfile(firstId)
    expect(getActiveProfileId()).toBe(firstId)
    expect(useForgeStore.getState().phrases.length).toBe(demoPhraseCount)

    // Switching forward keeps the second profile independent.
    await useForgeStore.getState().switchProfile(secondId)
    expect(useForgeStore.getState().phrases.length).toBe(0)

    // Clean up so later tests see a single profile again.
    await useForgeStore.getState().switchProfile(firstId)
    await useForgeStore.getState().deleteProfile(secondId)
  })
})
