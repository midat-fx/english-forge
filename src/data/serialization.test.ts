import { describe, expect, it } from 'vitest'
import { speakingEvidencePhraseIds } from '../domain/speaking'
import { DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT } from '../domain/dailyVocabulary'
import { normalizePhrase } from '../domain/normalization'
import { activationEventsThrough as qualifiedActivationEventsThrough } from '../test/activationEvidence'
import { grammarAcademyLessons, grammarQuizForAttempt } from './grammarAcademy'
import { createSeedData } from './seed'
import { PLACEMENT_LISTENING_PROMPTS } from './listeningPromptBank'
import { PLACEMENT_QUESTIONS, PLACEMENT_QUESTION_SET_VERSION, placementAnswers, scorePlacement } from './placementTest'
import { exportJson, exportPhrasesCsv, MAX_IMPORT_BYTES, parseForgeJson, validateForgeData } from './serialization'

function correctGrammarAnswers(lessonId: string, attemptNumber: number) {
  const lesson = grammarAcademyLessons.find((candidate) => candidate.id === lessonId)
  if (!lesson) throw new Error(`Unknown grammar lesson: ${lessonId}`)
  return grammarQuizForAttempt(lesson, attemptNumber).map((question) => ({ questionId: question.id, selectedIndex: question.answerIndex }))
}

describe('profile portability', () => {
  it('returns independent demo snapshots', () => {
    const first = createSeedData()
    const second = createSeedData()
    first.phrases[0].canonical = 'changed only here'
    expect(second.phrases[0].canonical).toBe('fall short of expectations')
  })

  it('round-trips the complete profile without losing ids or history', () => {
    const original = createSeedData()
    original.phrases[0].activationError = {
      incorrectContext: 'The result fell short from expectations.',
      expectedCorrection: 'The result fell short of expectations.',
      cue: 'Верните предлог of.',
    }
    original.phrases[0].practiceExposures = [{
      id: 'portable-feedback-exposure',
      skill: 'meaning_recall',
      exposedAt: '2026-07-19T08:00:00.000Z',
      source: 'feedback',
      sessionKey: 'portable-session',
    }]
    original.dailyVocabularyAssignment = { dayKey: '2026-07-20', level: 'B1', itemIds: ['lex-b1-one', 'lex-b1-two'], enrolledIds: ['lex-b1-one'] }
    const restored = parseForgeJson(exportJson(original))
    expect(restored.phrases.map((item) => item.id)).toEqual(original.phrases.map((item) => item.id))
    expect(restored.reviews).toEqual(original.reviews)
    expect(restored.skillStates).toEqual(original.skillStates)
    expect(restored.dailyVocabularyAssignment).toEqual(original.dailyVocabularyAssignment)
    expect(restored.missions).toEqual(original.missions)
    expect(restored.phrases[0].activationError).toEqual(original.phrases[0].activationError)
    expect(restored.phrases[0].practiceExposures).toEqual(original.phrases[0].practiceExposures)
  })

  it('accepts an older V4 profile without a daily assignment', () => {
    const { dailyVocabularyAssignment: _assignment, ...current } = createSeedData()
    const legacyV4 = { ...current, schemaVersion: 4 }
    expect(validateForgeData(legacyV4).dailyVocabularyAssignment).toBeNull()
  })

  it('accepts exactly the bounded Daily Ten history and rejects an oversized import', () => {
    const data = createSeedData()
    const levels = ['A2', 'B1', 'B2', 'C1'] as const
    data.dailyVocabularyAssignment = null
    data.dailyVocabularyAssignments = Array.from({ length: DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT }, (_, index) => ({
      dayKey: new Date(Date.UTC(2026, 0, 1 + Math.floor(index / levels.length))).toISOString().slice(0, 10),
      level: levels[index % levels.length],
      itemIds: [],
      enrolledIds: [],
    }))

    expect(validateForgeData(data).dailyVocabularyAssignments).toHaveLength(DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT)
    const oversized = structuredClone(data)
    oversized.dailyVocabularyAssignments.push({ dayKey: '2026-03-22', level: 'A2', itemIds: [], enrolledIds: [] })
    expect(() => validateForgeData(oversized)).toThrow('dailyVocabularyAssignments')
  })

  it('normalizes unsupported legacy recording-retention promises to explicit retention', () => {
    const legacyV4 = { ...createSeedData(), schemaVersion: 4 as const }
    legacyV4.preferences.keepRecordings = '7_days'
    expect(validateForgeData(legacyV4).preferences.keepRecordings).toBe('forever')
  })

  it('round-trips a compact backup at the portable-data boundary', () => {
    const original = createSeedData()
    const baseSize = new Blob([exportJson(original)]).size
    original.phrases[0].note = 'x'.repeat(MAX_IMPORT_BYTES - baseSize - 1)
    const backup = exportJson(original)
    expect(new Blob([backup]).size).toBe(MAX_IMPORT_BYTES - 1)
    expect(parseForgeJson(backup).phrases[0].note).toHaveLength(MAX_IMPORT_BYTES - baseSize - 1)
    original.phrases[0].note += 'xx'
    expect(() => exportJson(original)).toThrow('portable-backup limit')
    expect(() => parseForgeJson(`${JSON.stringify(original)}${' '.repeat(MAX_IMPORT_BYTES)}`)).toThrow('profile-data safety limit')
  })

  it('rejects malformed JSON without returning partial data', () => {
    expect(() => parseForgeJson('{bad json')).toThrow('valid JSON')
  })

  it('rejects future schema versions', () => {
    expect(() => validateForgeData({ ...createSeedData(), schemaVersion: 7 })).toThrow('Unsupported profile version')
  })

  it('rejects tampered normalized keys and canonical fingerprint collisions', () => {
    const tampered = createSeedData()
    tampered.phrases[0].normalizedKey = 'unrelated imported key'
    expect(() => validateForgeData(tampered)).toThrow('normalized key must match')

    const duplicate = createSeedData()
    duplicate.phrases.push({
      ...structuredClone(duplicate.phrases[0]),
      id: 'phrase-fingerprint-collision',
      canonical: 'fall-short of expectations',
      normalizedKey: 'fall-short of expectations',
    })
    expect(() => validateForgeData(duplicate)).toThrow('Duplicate phrase fingerprint')
  })

  it('migrates a strict V1 profile to V6 without losing ids or review evidence', () => {
    const current = createSeedData()
    const legacy = {
      schemaVersion: 1,
      phrases: current.phrases.map(({ depth: _depth, ...phrase }) => phrase),
      skillStates: current.skillStates.filter((state) => state.skill !== 'spoken_productive'),
      reviews: current.reviews,
      errors: current.errors,
      missions: current.missions,
      preferences: (({ keepRecordings: _keep, currentLevel: _current, targetLevel: _target, placementCompletedAt: _placed, ...preferences }) => preferences)(current.preferences),
    }
    const migrated = validateForgeData(legacy)
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.phrases.map((phrase) => phrase.id)).toEqual(current.phrases.map((phrase) => phrase.id))
    expect(migrated.reviews).toEqual(current.reviews)
    expect(migrated.skillStates.filter((state) => state.skill === 'spoken_productive')).toHaveLength(current.phrases.length)
    expect(migrated.preferences.keepRecordings).toBe('forever')
    expect(migrated.preferences.currentLevel).toBe('A2')
    expect(migrated.placementAttempts).toEqual([])
  })

  it('migrates a strict V2 profile and requires a fresh diagnostic', () => {
    const current = createSeedData()
    const { placementAttempts: _placement, grammarProgress: _grammar, dailyVocabularyAssignment: _assignment, dailyVocabularyAssignments: _assignments, listeningAttempts: _listeningAttempts, ...withoutV3 } = current
    const legacy = {
      ...withoutV3,
      schemaVersion: 2,
      preferences: (({ currentLevel: _current, targetLevel: _target, placementCompletedAt: _placed, ...preferences }) => preferences)(current.preferences),
    }
    const migrated = validateForgeData(legacy)
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.preferences.placementCompletedAt).toBeUndefined()
    expect(migrated.preferences.targetLevel).toBe('B1')
    expect(migrated.grammarProgress).toEqual([])
  })

  it('migrates V3 placement and grammar evidence without re-scoring a reordered legacy key', () => {
    const current = createSeedData()
    const { dailyVocabularyAssignment: _assignment, dailyVocabularyAssignments: _assignments, listeningAttempts: _listeningAttempts, ...legacyBase } = current
    const oldAnswerPositions: Record<string, number> = {
      'a2-03': 1, 'a2-04': 1, 'a2-06': 0,
      'b1-02': 0, 'b1-05': 1, 'b1-06': 0,
      'b2-02': 1, 'b2-05': 1, 'b2-08': 1,
      'c1-03': 1, 'c1-07': 2, 'c1-08': 1,
    }
    const answers = PLACEMENT_QUESTIONS.map((question) => ({ questionId: question.id, selectedIndex: oldAnswerPositions[question.id] ?? question.correctIndex, correct: true }))
    const completedAt = '2026-07-15T12:00:00.000Z'
    const legacy = {
      ...legacyBase,
      schemaVersion: 3,
      placementAttempts: [{
        id: 'old-placement',
        answers,
        score: 32,
        maxScore: 32,
        suggestedLevel: 'C1',
        bandScores: { A2: { correct: 8, total: 8 }, B1: { correct: 8, total: 8 }, B2: { correct: 8, total: 8 }, C1: { correct: 8, total: 8 } },
        completedAt,
      }],
      grammarProgress: [{
        lessonId: 'a2-present-simple',
        attempts: 1,
        bestScore: 3,
        totalQuestions: 3,
        lastAttemptedAt: completedAt,
        completedAt,
      }],
      preferences: { ...current.preferences, currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: completedAt },
    }

    const migrated = validateForgeData(legacy)
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.placementAttempts[0]).toMatchObject({ suggestedLevel: 'C1', score: 32, answers })
    expect(migrated.preferences).toMatchObject({ currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: completedAt })
    expect(migrated.grammarProgress[0]).toMatchObject({ passes: 0, passHistory: [], legacyPasses: 2, legacyLastPassedAt: completedAt, legacyCompletedAt: completedAt })
    expect(migrated.grammarProgress[0].completedAt).toBeUndefined()
  })

  it('repairs inconsistent exact-set V3 summaries, preserves them as legacy history, and activates the newest attempt', () => {
    const current = createSeedData()
    const { dailyVocabularyAssignment: _assignment, dailyVocabularyAssignments: _assignments, listeningAttempts: _listeningAttempts, ...legacyBase } = current
    const allCorrect = PLACEMENT_QUESTIONS.map((question) => ({ questionId: question.id, selectedIndex: question.correctIndex, correct: true }))
    const allIncorrect = PLACEMENT_QUESTIONS.map((question) => ({ questionId: question.id, selectedIndex: question.correctIndex, correct: false }))
    const olderAt = '2026-07-15T12:00:00.000Z'
    const newerAt = '2026-07-16T12:00:00.000Z'
    const forgedBands = { A2: { correct: 8, total: 8 }, B1: { correct: 8, total: 8 }, B2: { correct: 8, total: 8 }, C1: { correct: 8, total: 8 } }
    const migrated = validateForgeData({
      ...legacyBase,
      schemaVersion: 3,
      placementAttempts: [
        { id: 'older-v3', answers: allCorrect, score: 32, maxScore: 32, suggestedLevel: 'C1', bandScores: forgedBands, completedAt: olderAt },
        { id: 'newer-v3', answers: allIncorrect, score: 32, maxScore: 31, suggestedLevel: 'C1', bandScores: forgedBands, completedAt: newerAt },
      ],
      grammarProgress: [],
      preferences: { ...current.preferences, currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: olderAt },
    })

    expect(migrated.placementAttempts.map((attempt) => attempt.id)).toEqual(['newer-v3', 'older-v3'])
    expect(migrated.placementAttempts[0]).toMatchObject({
      legacyQuestionSet: true,
      score: 0,
      maxScore: 32,
      suggestedLevel: 'A2',
      bandScores: { A2: { correct: 0, total: 8 }, B1: { correct: 0, total: 8 }, B2: { correct: 0, total: 8 }, C1: { correct: 0, total: 8 } },
    })
    expect(migrated.preferences).toMatchObject({ currentLevel: 'A2', targetLevel: 'B1', placementCompletedAt: newerAt })
  })

  it('retains transitional V3 pass counters as history without treating them as verified events', () => {
    const current = createSeedData()
    const { dailyVocabularyAssignment: _assignment, dailyVocabularyAssignments: _assignments, listeningAttempts: _listeningAttempts, ...legacyBase } = current
    const passedAt = '2026-07-16T06:00:00.000Z'
    const legacy = {
      ...legacyBase,
      schemaVersion: 3,
      grammarProgress: [{
        lessonId: 'b1-present-perfect-v-past',
        attempts: 1,
        passes: 1,
        bestScore: 3,
        totalQuestions: 3,
        lastAttemptedAt: passedAt,
        lastPassedAt: passedAt,
      }],
    }

    expect(validateForgeData(legacy).grammarProgress[0]).toMatchObject({ passes: 0, passHistory: [], legacyPasses: 1, legacyLastPassedAt: passedAt })
  })

  it('preserves an old V4 completion date without claiming current transfer evidence', () => {
    const current = createSeedData()
    current.grammarProgress = [{
      lessonId: 'a2-present-simple', attempts: 2, passes: 2, bestScore: 3, totalQuestions: 3,
      lastAttemptedAt: '2026-07-16T12:00:00.000Z', lastPassedAt: '2026-07-16T12:00:00.000Z',
      completedAt: '2026-07-16T12:00:00.000Z', productionDraft: 'I usually work from home on Fridays.',
      productionSavedAt: '2026-07-16T12:00:00.000Z', correctionPassedAt: '2026-07-16T12:00:00.000Z', masteryEvidenceVersion: 2,
    }]

    const migrated = validateForgeData({ ...current, schemaVersion: 4 })
    expect(migrated.grammarProgress[0]).toMatchObject({ legacyCompletedAt: '2026-07-16T12:00:00.000Z', legacyPasses: 2, passHistory: [] })
    expect(migrated.grammarProgress[0].masteryEvidenceVersion).toBeUndefined()
    expect(migrated.grammarProgress[0].completedAt).toBeUndefined()
  })

  it('downgrades unverifiable V5 grammar mastery while preserving learner drafts and legacy dates', () => {
    const data = createSeedData()
    const firstPass = '2026-07-15T08:00:00.000Z'
    const secondPass = '2026-07-16T08:00:00.000Z'
    const transferAt = '2026-07-17T08:00:00.000Z'
    const legacy = {
      ...data,
      schemaVersion: 5,
      grammarProgress: [{
        lessonId: 'a2-present-simple', attempts: 2, passes: 2, bestScore: 3, totalQuestions: 3,
        lastAttemptedAt: secondPass, lastPassedAt: secondPass, completedAt: transferAt,
        productionDraft: 'I usually work from home every Friday morning.', productionSavedAt: firstPass, productionSelfConfirmedAt: firstPass,
        transferDraft: 'Our team checks each request before Monday afternoon.', transferSavedAt: transferAt, transferSelfConfirmedAt: transferAt,
        correctionPassedAt: secondPass, masteryEvidenceVersion: 3,
      }],
    }

    const migrated = validateForgeData(legacy)
    expect(migrated.grammarProgress[0]).toMatchObject({
      passes: 0,
      passHistory: [],
      legacyPasses: 2,
      legacyLastPassedAt: secondPass,
      legacyCompletedAt: transferAt,
      productionDraft: legacy.grammarProgress[0].productionDraft,
      transferDraft: legacy.grammarProgress[0].transferDraft,
    })
    expect(migrated.grammarProgress[0].completedAt).toBeUndefined()
    expect(migrated.grammarProgress[0].masteryEvidenceVersion).toBeUndefined()
  })

  it('rejects forged current grammar evidence and accepts a recomputable mastery chain', () => {
    const data = createSeedData()
    const firstPass = '2026-07-15T08:00:00.000Z'
    const secondPass = '2026-07-16T08:00:00.000Z'
    const transferAt = '2026-07-17T08:00:00.000Z'
    const quizPassEvidence = [
      { evidenceVersion: 1 as const, attemptNumber: 0, answers: correctGrammarAnswers('a2-present-simple', 0), completedAt: firstPass },
      { evidenceVersion: 1 as const, attemptNumber: 1, answers: correctGrammarAnswers('a2-present-simple', 1), completedAt: secondPass },
    ]
    const valid = {
      lessonId: 'a2-present-simple', attempts: 2, passes: 2, passHistory: [firstPass, secondPass], bestScore: 3, totalQuestions: 3,
      quizPassEvidence,
      lastAttemptedAt: secondPass, lastPassedAt: secondPass, completedAt: transferAt,
      productionDraft: 'I usually work from home every Friday morning.', productionSavedAt: firstPass, productionSelfConfirmedAt: firstPass,
      transferDraft: 'Our team checks each request before Monday afternoon.', transferSavedAt: transferAt, transferSelfConfirmedAt: transferAt,
      transferCheckEvidence: { evidenceVersion: 1 as const, attemptNumber: 2, answers: correctGrammarAnswers('a2-present-simple', 2), completedAt: transferAt },
      correctionPassedAt: secondPass, correctionEvidence: { evidenceVersion: 1 as const, response: 'He works from home.', completedAt: secondPass }, masteryEvidenceVersion: 6 as const,
    }
    expect(() => validateForgeData({ ...data, grammarProgress: [valid] })).not.toThrow()
    const { transferCheckEvidence: _legacyTransferCheck, ...earlyV6Mastery } = { ...valid, masteryEvidenceVersion: 5 as const }
    const downgraded = validateForgeData({ ...data, grammarProgress: [earlyV6Mastery] }).grammarProgress[0]
    expect(downgraded.completedAt).toBeUndefined()
    expect(downgraded.masteryEvidenceVersion).toBeUndefined()
    expect(downgraded.legacyCompletedAt).toBe(transferAt)
    expect(downgraded.transferDraft).toBe(valid.transferDraft)
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, passHistory: [firstPass, '2026-07-15T12:00:00.000Z'], lastPassedAt: '2026-07-15T12:00:00.000Z' }] })).toThrow('spaced by at least 12 hours')
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, productionDraft: 'Too short now.' }] })).toThrow('at least six words')
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, productionDraft: grammarAcademyLessons.find((lesson) => lesson.id === valid.lessonId)!.examples[0] }] })).toThrow('learner-authored')
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, transferDraft: grammarAcademyLessons.find((lesson) => lesson.id === valid.lessonId)!.examples[2] }] })).toThrow('learner-authored')
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, transferDraft: valid.productionDraft }] })).toThrow('distinct from production')
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, productionSelfConfirmedAt: secondPass }] })).toThrow('self-confirmation must match')
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, completedAt: secondPass }] })).toThrow('cannot precede')
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, productionTargetPhraseId: data.phrases[0].id }] })).toThrow('must contain its persisted lexical target')
    const forgedAnswers = structuredClone(quizPassEvidence)
    forgedAnswers[0].answers[0].selectedIndex = ((forgedAnswers[0].answers[0].selectedIndex + 1) % 3) as 0 | 1 | 2
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, quizPassEvidence: forgedAnswers }] })).toThrow('versioned lesson answer key')
    const repeatedVariantEvidence = [
      quizPassEvidence[0],
      { ...quizPassEvidence[1], attemptNumber: 3, answers: correctGrammarAnswers('a2-present-simple', 3) },
    ]
    expect(() => validateForgeData({ ...data, grammarProgress: [{ ...valid, attempts: 4, quizPassEvidence: repeatedVariantEvidence }] })).toThrow('distinct answer-choice layouts')
    const { quizPassEvidence: _rawPasses, correctionEvidence: _rawCorrection, ...forgedSummaryOnly } = valid
    expect(() => validateForgeData({ ...data, grammarProgress: [forgedSummaryOnly] })).toThrow('versioned raw quiz evidence')
  })

  it('rejects schedules that refer to missing phrases', () => {
    const data = createSeedData()
    expect(() => validateForgeData({ ...data, phrases: [] })).toThrow('missing phrase')
  })

  it('rejects malformed nested mission data before it can be persisted', () => {
    const data = createSeedData()
    const malformed = { ...data, missions: [{ ...data.missions[0], targetResults: null }] }
    expect(() => validateForgeData(malformed)).toThrow('missions.0.targetResults')
  })

  it('recomputes completed mission evidence from the saved draft and current phrase forms', () => {
    const data = createSeedData()
    // Derive completion from the seed mission's own creation time so the test is
    // independent of the wall clock (seed dates are now-relative).
    const completedAt = new Date(Date.parse(data.missions[0].createdAt) + 3_600_000).toISOString()
    const createdAfterCompletion = new Date(Date.parse(completedAt) + 86_400_000).toISOString()
    const response = 'The first release fell short of expectations because the schedule compressed testing and several teams received incomplete guidance. The underlying concept remains useful, and customer interviews still show a clear need for the service. With that said, we should not approve a broad rollout until the support process is stable. I recommend a smaller pilot with two regions, weekly quality reviews, and a published list of measurable exit criteria. This approach gives engineers enough time to resolve the known defects while allowing researchers to collect reliable feedback from real users. We cannot rule out another short delay if the audit identifies a serious security issue, but that possibility should be managed openly rather than hidden. Leadership should receive a concise update every Friday, including delivery risks, customer impact, staffing needs, and decisions required for the following week. After four weeks, the group can compare outcomes against the agreed baseline and decide whether expansion is justified.'
    const complete = {
      ...data.missions[0],
      draft: response,
      response,
      status: 'done' as const,
      completedAt,
      selfConfirmedAt: completedAt,
      targetResults: data.missions[0].targetPhraseIds.map((phraseId) => ({ phraseId, confirmed: true })),
    }
    expect(response.split(/\s+/u).length).toBeGreaterThanOrEqual(complete.minWords)
    expect(response.split(/\s+/u).length).toBeLessThanOrEqual(complete.maxWords)
    expect(() => validateForgeData({ ...data, missions: [complete] })).not.toThrow()
    expect(() => validateForgeData({ ...data, missions: [{ ...complete, response: `${response} Later.` }] })).toThrow('must match its saved draft')
    expect(() => validateForgeData({ ...data, missions: [{ ...complete, createdAt: createdAfterCompletion }] })).toThrow('cannot precede mission creation')
    expect(() => validateForgeData({ ...data, missions: [{ ...complete, response: 'This forged response is far too short and contains none of the required material.' }] })).toThrow('word-count contract')
    expect(() => validateForgeData({ ...data, missions: [{ ...complete, draft: response.replace('rule out', 'exclude'), response: response.replace('rule out', 'exclude') }] })).toThrow('does not contain target')
  })

  it('normalizes legacy missions to their original writing contract', () => {
    const data = createSeedData()
    const legacy = {
      ...data,
      missions: data.missions.map(({ level: _level, minWords: _minWords, maxWords: _maxWords, targetPhraseCount: _targetPhraseCount, ...mission }) => mission),
    }

    expect(validateForgeData(legacy).missions[0]).toMatchObject({ level: 'B2', minWords: 120, maxWords: 180, targetPhraseCount: 3, legacyContract: true })
  })

  it.each(['level', 'minWords', 'maxWords', 'targetPhraseCount', 'supportUsed'] as const)(
    'quarantines a mission missing v0.5 %s provenance',
    (field) => {
      const data = createSeedData()
      const mission = { ...data.missions[0] } as Record<string, unknown>
      delete mission[field]

      expect(validateForgeData({ ...data, missions: [mission] }).missions[0]).toMatchObject({
        id: data.missions[0].id,
        draft: data.missions[0].draft,
        targetResults: data.missions[0].targetResults,
        legacyContract: true,
      })
    },
  )

  it('preserves and quarantines an active pre-v0.5 mission targeting C2 phrases', () => {
    const data = createSeedData()
    const targetIds = new Set(data.missions[0].targetPhraseIds)
    data.phrases = data.phrases.map((phrase) => targetIds.has(phrase.id) ? { ...phrase, cefr: 'C2' as const } : phrase)
    const legacyMission = (({
      level: _level,
      minWords: _minWords,
      maxWords: _maxWords,
      targetPhraseCount: _targetPhraseCount,
      supportUsed: _supportUsed,
      ...mission
    }) => ({ ...mission, status: 'active' as const, draft: 'The learner\'s C2 draft remains intact.' }))(data.missions[0])

    const migrated = validateForgeData({ ...data, missions: [legacyMission] }).missions[0]
    expect(migrated).toMatchObject({
      status: 'active',
      draft: "The learner's C2 draft remains intact.",
      targetPhraseIds: data.missions[0].targetPhraseIds,
      targetResults: data.missions[0].targetResults,
      legacyContract: true,
    })
  })

  it('preserves and quarantines an old active mission whose target was archived', () => {
    const data = createSeedData()
    const archivedTargetId = data.missions[0].targetPhraseIds[0]
    data.phrases = data.phrases.map((phrase) => phrase.id === archivedTargetId
      ? { ...phrase, status: 'archived' as const, archivedAt: phrase.updatedAt }
      : phrase)
    const legacyMission = (({ supportUsed: _supportUsed, ...mission }) => ({
      ...mission,
      status: 'active' as const,
      draft: 'Keep this archived-target draft and its history.',
    }))(data.missions[0])

    const migrated = validateForgeData({ ...data, missions: [legacyMission] }).missions[0]
    expect(migrated).toMatchObject({
      status: 'active',
      draft: 'Keep this archived-target draft and its history.',
      targetPhraseIds: data.missions[0].targetPhraseIds,
      targetResults: data.missions[0].targetResults,
      legacyContract: true,
    })
  })

  it('quarantines an invalid unfinished mixed-level legacy mission without losing its draft', () => {
    const data = createSeedData()
    const mixedTarget = data.missions[0].targetPhraseIds[0]
    data.phrases = data.phrases.map((phrase) => phrase.id === mixedTarget ? { ...phrase, cefr: 'C1' as const } : phrase)
    data.preferences = { ...data.preferences, currentLevel: 'A2', targetLevel: 'B1' }
    const legacy = {
      ...data,
      missions: data.missions.map(({ level: _level, minWords: _minWords, maxWords: _maxWords, targetPhraseCount: _count, supportUsed: _support, ...mission }) => mission),
    }

    const migrated = validateForgeData(legacy)
    expect(migrated.missions).toHaveLength(1)
    expect(migrated.missions[0]).toMatchObject({ status: data.missions[0].status, draft: data.missions[0].draft, legacyContract: true })
    expect(migrated.phrases).toHaveLength(data.phrases.length)
  })

  it('preserves completed mixed-level legacy mission history without treating it as current evidence', () => {
    const data = createSeedData()
    const mixedTarget = data.missions[0].targetPhraseIds[0]
    data.phrases = data.phrases.map((phrase) => phrase.id === mixedTarget ? { ...phrase, cefr: 'C1' as const } : phrase)
    const completedAt = '2026-07-10T12:00:00.000Z'
    const legacy = {
      ...data,
      missions: data.missions.map(({ level: _level, supportUsed: _support, ...mission }) => ({
        ...mission,
        status: 'done' as const,
        response: mission.prompt,
        completedAt,
      })),
    }

    const migrated = validateForgeData(legacy).missions[0]
    expect(migrated).toMatchObject({ status: 'done', legacyContract: true })
    expect(migrated.supportUsed).toBeUndefined()
  })

  it('rejects contradictory persisted mission constraints', () => {
    const data = createSeedData()
    expect(() => validateForgeData({ ...data, missions: [{ ...data.missions[0], minWords: 181, maxWords: 180 }] })).toThrow('maximum')
    expect(() => validateForgeData({ ...data, missions: [{ ...data.missions[0], targetPhraseCount: 2 }] })).toThrow('target count')
    const targetId = data.missions[0].targetPhraseIds[0]
    expect(() => validateForgeData({ ...data, phrases: data.phrases.map((phrase) => phrase.id === targetId ? { ...phrase, cefr: 'C1' as const } : phrase) })).toThrow('CEFR level')
  })

  it('quarantines only untouched legacy generated B1 cards and preserves edits or evidence', () => {
    const untouched = createSeedData()
    const untouchedId = 'phrase-little-did'
    untouched.phrases = untouched.phrases.map((phrase) => phrase.id === untouchedId ? {
      ...phrase,
      tags: [...phrase.tags, 'catalog-item:lex-b1-x999'],
      activationStage: 0,
      activationEvents: [],
      updatedAt: phrase.createdAt,
    } : phrase)
    const quarantined = validateForgeData(untouched)
    expect(quarantined.phrases.find((phrase) => phrase.id === untouchedId)).toMatchObject({ status: 'archived' })
    expect(quarantined.skillStates.filter((state) => state.phraseId === untouchedId).every((state) => state.phase === 'suspended')).toBe(true)

    const edited = createSeedData()
    edited.phrases = edited.phrases.map((phrase) => phrase.id === untouchedId ? { ...phrase, tags: [...phrase.tags, 'catalog-item:lex-b1-x999'] } : phrase)
    expect(validateForgeData(edited).phrases.find((phrase) => phrase.id === untouchedId)?.status).not.toBe('archived')

    const practiced = createSeedData()
    practiced.phrases = practiced.phrases.map((phrase) => phrase.id === untouchedId ? {
      ...phrase,
      tags: [...phrase.tags, 'catalog-item:lex-b1-x999'],
      activationStage: 0,
      activationEvents: [],
      updatedAt: phrase.createdAt,
    } : phrase)
    practiced.reviews.push({ ...practiced.reviews[0], id: 'legacy-b1-evidence', idempotencyKey: 'legacy-b1-evidence', targetId: untouchedId })
    expect(validateForgeData(practiced).phrases.find((phrase) => phrase.id === untouchedId)?.status).not.toBe('archived')
  })

  it('rejects daily enrollment outside the assigned item set', () => {
    const data = createSeedData()
    data.dailyVocabularyAssignment = { dayKey: '2026-07-20', level: 'B1', itemIds: ['lex-b1-one'], enrolledIds: ['lex-b1-other'] }
    expect(() => validateForgeData(data)).toThrow('unique subset')
  })

  it('rejects divergent active and historical packs with the same day and level', () => {
    const data = createSeedData()
    data.dailyVocabularyAssignment = {
      dayKey: '2026-07-20', level: 'B1',
      itemIds: ['lex-b1-visible'], enrolledIds: [], previewedIds: ['lex-b1-visible'],
    }
    data.dailyVocabularyAssignments = [{
      dayKey: '2026-07-20', level: 'B1',
      itemIds: ['lex-b1-hidden'], enrolledIds: ['lex-b1-hidden'], previewedIds: ['lex-b1-hidden'],
    }]

    expect(() => validateForgeData(data)).toThrow('active daily vocabulary pack must match')
    expect(() => parseForgeJson(JSON.stringify(data))).toThrow('active daily vocabulary pack must match')
  })

  it('round-trips matching active and historical daily packs without changing progress', () => {
    const data = createSeedData()
    const assignment = {
      dayKey: '2026-07-20', level: 'B1' as const,
      itemIds: ['lex-b1-one', 'lex-b1-two'], enrolledIds: ['lex-b1-one'],
      previewedIds: ['lex-b1-one', 'lex-b1-two'], deferredIds: ['lex-b1-deferred'],
    }
    data.dailyVocabularyAssignment = assignment
    data.dailyVocabularyAssignments = [structuredClone(assignment)]

    const restored = parseForgeJson(exportJson(data))
    expect(restored.dailyVocabularyAssignment).toEqual(assignment)
    expect(restored.dailyVocabularyAssignments).toEqual([assignment])
  })

  it('rejects duplicate review idempotency keys and invalid preferences', () => {
    const data = createSeedData()
    data.reviews.push({ ...data.reviews[0], id: 'duplicate-review' })
    expect(() => validateForgeData(data)).toThrow('Duplicate review idempotency key')
    const invalidPreferences = { ...createSeedData(), preferences: { ...createSeedData().preferences, dailyMinutes: Number.NaN } }
    expect(() => validateForgeData(invalidPreferences)).toThrow('preferences.dailyMinutes')
  })

  it('rejects unsafe or duplicate recording ids and malformed 4/3/2 families', () => {
    const data = createSeedData()
    const phraseId = data.phrases[0].id
    data.speakingAttempts.push({
      id: 'voice-1', idempotencyKey: 'voice-1', sessionId: 'family', mode: 'fluency_432', round: 2, prompt: 'Respond.',
      targetPhraseIds: [phraseId], detectedPhraseIds: [], confirmedPhraseIds: [], transcript: 'Response', durationSeconds: 5,
      recordingId: '../unsafe', mimeType: 'audio/webm', supportUsed: false, selfRating: { clarity: 3, flow: 3 }, createdAt: new Date().toISOString(),
    })
    expect(() => validateForgeData(data)).toThrow('unsafe')
    data.speakingAttempts[0].recordingId = 'safe_recording'
    expect(() => validateForgeData(data)).toThrow('ordered')
  })

  it('rejects imported 4/3/2 rounds that clear inherited speaking provenance', () => {
    const makeRound = (round: 1 | 2 | 3, supportUsed: boolean, targetFormVisible: boolean) => ({
      id: `sticky-round-${round}`,
      idempotencyKey: `sticky-round-${round}`,
      sessionId: 'sticky-family',
      mode: 'fluency_432' as const,
      round,
      prompt: 'Give a short project update.',
      targetPhraseIds: ['phrase-bear-in-mind'],
      detectedPhraseIds: ['phrase-bear-in-mind'],
      confirmedPhraseIds: ['phrase-bear-in-mind'],
      evidenceEligiblePhraseIds: ['phrase-bear-in-mind'],
      transcript: 'Please bear in mind that our project plan may change tomorrow.',
      durationSeconds: 8,
      recordingId: `sticky_round_${round}`,
      mimeType: 'audio/webm',
      targetFormVisible,
      supportUsed,
      selfRating: { clarity: 4 as const, flow: 4 as const },
      createdAt: `2026-07-18T08:0${round}:00.000Z`,
    })

    const clearedSupport = createSeedData()
    clearedSupport.speakingAttempts = [makeRound(2, false, false), makeRound(1, true, false)]
    expect(() => validateForgeData(clearedSupport)).toThrow('cannot clear support provenance')

    const clearedExposure = createSeedData()
    clearedExposure.speakingAttempts = [makeRound(2, false, false), makeRound(1, false, true)]
    expect(() => validateForgeData(clearedExposure)).toThrow('cannot clear target-form exposure')

    const unknownLegacyExposure = createSeedData()
    const { targetFormVisible: _missingLegacyProvenance, ...legacyFirstRound } = makeRound(1, false, false)
    unknownLegacyExposure.speakingAttempts = [makeRound(2, false, false), legacyFirstRound]
    expect(() => validateForgeData(unknownLegacyExposure)).toThrow('cannot clear target-form exposure')

    const sticky = createSeedData()
    sticky.speakingAttempts = [makeRound(3, true, true), makeRound(2, true, true), makeRound(1, true, true)]
    const imported = validateForgeData(sticky)
    expect(speakingEvidencePhraseIds(imported.speakingAttempts[0], imported.phrases, new Date('2026-07-19T08:00:00.000Z'))).toEqual([])
  })

  it('keeps imported speaking evidence fail-closed when eligibility provenance is absent', () => {
    const data = createSeedData()
    data.speakingAttempts = [{
      id: 'legacy-speaking-without-eligibility',
      idempotencyKey: 'legacy-speaking-without-eligibility',
      sessionId: 'legacy-speaking-without-eligibility',
      mode: 'targeted_response',
      prompt: 'Give a short project update.',
      targetPhraseIds: ['phrase-bear-in-mind'],
      detectedPhraseIds: ['phrase-bear-in-mind'],
      confirmedPhraseIds: ['phrase-bear-in-mind'],
      transcript: 'Please bear in mind that our project plan may change tomorrow.',
      durationSeconds: 8,
      recordingId: 'legacy_without_eligibility',
      mimeType: 'audio/webm',
      targetFormVisible: false,
      supportUsed: false,
      selfRating: { clarity: 4, flow: 4 },
      createdAt: '2026-07-18T08:00:00.000Z',
    }]

    const imported = validateForgeData(data)
    expect(imported.speakingAttempts[0].evidenceEligiblePhraseIds).toEqual([])
    expect(speakingEvidencePhraseIds(imported.speakingAttempts[0], imported.phrases, new Date('2026-07-19T08:00:00.000Z'))).toEqual([])

    const forgedSummary = createSeedData()
    forgedSummary.phrases = forgedSummary.phrases.map((phrase) => phrase.id === 'phrase-bear-in-mind'
      ? { ...phrase, activationStage: 6, activationEvents: undefined, activationError: undefined }
      : phrase)
    forgedSummary.speakingAttempts = [{ ...data.speakingAttempts[0], evidenceEligiblePhraseIds: ['phrase-bear-in-mind'] }]
    const sanitized = validateForgeData(forgedSummary)
    expect(sanitized.speakingAttempts[0].evidenceEligiblePhraseIds).toEqual([])
    expect(sanitized.phrases.find((phrase) => phrase.id === 'phrase-bear-in-mind')?.activationStage).toBe(0)
  })

  it('derives imported activation summaries from raw events and quarantines missions without target provenance', () => {
    const data = createSeedData()
    const referenceId = 'phrase-bear-in-mind'
    const targetId = data.missions[0].targetPhraseIds[0]
    data.phrases = data.phrases.map((phrase) => {
      if (phrase.id === referenceId) return { ...phrase, activationStage: 5 as const, activationEvents: undefined, activationError: undefined }
      if (phrase.id === targetId) return { ...phrase, activationEvents: undefined }
      return phrase
    })

    const imported = validateForgeData(data)
    expect(imported.phrases.find((phrase) => phrase.id === referenceId)?.activationStage).toBe(0)
    expect(imported.phrases.find((phrase) => phrase.id === referenceId)?.legacyActivationStage).toBe(5)
    expect(imported.phrases.find((phrase) => phrase.id === referenceId)?.activationEvents).toBeUndefined()
    expect(imported.missions[0]).toMatchObject({ legacyContract: true })
  })

  it('preserves early V6 activation history while downgrading its unbound summary', () => {
    const data = createSeedData()
    const phraseId = data.phrases[0].id
    const legacyEvents = ([1, 2, 3, 4, 5] as const).map((stage, index) => ({
      stage,
      completedAt: `2026-07-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
    }))
    data.phrases = data.phrases.map((phrase) => phrase.id === phraseId
      ? { ...phrase, activationStage: 5, activationEvents: legacyEvents }
      : phrase)

    const imported = validateForgeData(data).phrases.find((phrase) => phrase.id === phraseId)!
    expect(imported.activationStage).toBe(0)
    expect(imported.legacyActivationStage).toBe(5)
    expect(imported.activationEvents).toEqual(legacyEvents)
  })

  it('downgrades imported Stage 8 when another same-phrase review exposed the answer minutes earlier', () => {
    const buildStageEightProfile = (includePriorExposure: boolean) => {
      const data = createSeedData()
      const original = { ...data.phrases[0], createdAt: '2026-07-01T08:00:00.000Z' }
      const phraseId = original.id
      const stageSevenAt = '2026-07-17T08:00:00.000Z'
      const writtenAt = '2026-07-18T09:00:00.000Z'
      const phrase = {
        ...original,
        activationStage: 8 as const,
        activationUpdatedAt: writtenAt,
        practiceExposures: undefined,
        activationEvents: [
          ...qualifiedActivationEventsThrough(original, 6),
          { stage: 7 as const, completedAt: stageSevenAt, evidenceId: 'stage-seven-speaking' },
          { stage: 8 as const, completedAt: writtenAt, evidenceId: 'stage-eight-written' },
        ],
      }
      const writtenReview = {
        ...data.reviews[0],
        id: 'stage-eight-written',
        idempotencyKey: 'stage-eight-written',
        targetId: phraseId,
        skill: 'written_productive' as const,
        exerciseType: 'constrained_sentence' as const,
        response: 'The final release may fall short of expectations despite careful work.',
        grade: 2 as const,
        hintsUsed: 0,
        revealUsed: false,
        supportUsed: false,
        reviewedAt: writtenAt,
        dueBefore: '2026-07-18T08:00:00.000Z',
        dueAfter: '2026-07-21T09:00:00.000Z',
      }
      const priorExposure = {
        ...writtenReview,
        id: 'prior-meaning-exposure',
        idempotencyKey: 'prior-meaning-exposure',
        skill: 'meaning_recall' as const,
        exerciseType: 'meaning_to_chunk' as const,
        response: phrase.canonical,
        reviewedAt: '2026-07-18T08:55:00.000Z',
      }
      data.phrases = data.phrases.map((candidate) => candidate.id === phraseId ? phrase : candidate)
      data.reviews = includePriorExposure ? [writtenReview, priorExposure] : [writtenReview]
      data.speakingAttempts = [{
        id: 'stage-seven-speaking',
        idempotencyKey: 'stage-seven-speaking',
        sessionId: 'stage-seven-speaking',
        mode: 'targeted_response',
        prompt: 'Explain why the final result was disappointing.',
        targetPhraseIds: [phraseId],
        detectedPhraseIds: [phraseId],
        confirmedPhraseIds: [phraseId],
        evidenceEligiblePhraseIds: [phraseId],
        transcript: 'Our final release may fall short of expectations unless everyone reviews the evidence carefully today.',
        durationSeconds: 8,
        recordingId: 'stage_seven_speaking_audio',
        mimeType: 'audio/webm',
        targetFormVisible: false,
        supportUsed: false,
        selfRating: { clarity: 4, flow: 4 },
        createdAt: stageSevenAt,
      }]
      return data
    }

    const contaminated = validateForgeData(buildStageEightProfile(true)).phrases[0]
    expect(contaminated.activationStage).toBe(7)
    expect(contaminated.legacyActivationStage).toBe(8)

    const independent = validateForgeData(buildStageEightProfile(false)).phrases[0]
    expect(independent.activationStage).toBe(8)
    expect(independent.legacyActivationStage).toBeUndefined()
  })

  it('rejects forged current listening results by recomputing dictation and comprehension', () => {
    const data = createSeedData()
    const base = {
      id: 'current-listening', sourceId: 'daily-a2', mode: 'dictation' as const,
      response: 'The train leaves at quarter past seven.', answerMatched: true, revealUsed: false,
      playbackCompleted: true, referenceTranscript: 'The train leaves at quarter past seven.',
      listeningEvidenceVersion: 1 as const, durationSeconds: 8, createdAt: '2026-07-18T08:00:00.000Z',
    }
    expect(() => validateForgeData({ ...data, listeningAttempts: [base] })).not.toThrow()
    expect(() => validateForgeData({ ...data, listeningAttempts: [{ ...base, response: 'An unrelated forged answer.' }] })).toThrow('must be recomputed')

    const comprehension = {
      ...base,
      answerMatched: false,
      comprehensionQuestion: 'When does the train leave?',
      comprehensionResponse: 'At eight.',
      comprehensionExpectedResponse: 'At quarter past seven.',
      comprehensionMatched: true,
    }
    expect(() => validateForgeData({ ...data, listeningAttempts: [comprehension] })).toThrow('Comprehension match must be recomputed')
  })

  it('downgrades unverifiable V5 comprehension claims but preserves their text', () => {
    const data = createSeedData()
    const legacyAttempt = {
      id: 'legacy-listening', sourceId: 'daily-a2', mode: 'dictation' as const,
      response: 'The train leaves at quarter past seven.', answerMatched: true, revealUsed: false,
      playbackCompleted: true, referenceTranscript: 'The train leaves at quarter past seven.',
      comprehensionQuestion: 'When does the train leave?', comprehensionResponse: 'At quarter past seven.', comprehensionMatched: true,
      durationSeconds: 8, createdAt: '2026-07-18T08:00:00.000Z',
    }
    const migrated = validateForgeData({ ...data, schemaVersion: 5, listeningAttempts: [legacyAttempt] })
    expect(migrated.listeningAttempts[0]).toMatchObject({
      response: legacyAttempt.response,
      comprehensionQuestion: legacyAttempt.comprehensionQuestion,
      comprehensionResponse: legacyAttempt.comprehensionResponse,
      answerMatched: false,
      comprehensionMatched: false,
      legacyComprehensionMatched: true,
    })
    expect(migrated.listeningAttempts[0].listeningEvidenceVersion).toBeUndefined()

    const dictationOnly = validateForgeData({
      ...data,
      schemaVersion: 5,
      listeningAttempts: [(({ comprehensionQuestion: _question, comprehensionResponse: _response, comprehensionMatched: _matched, ...attempt }) => attempt)(legacyAttempt)],
    }).listeningAttempts[0]
    expect(dictationOnly).toMatchObject({ answerMatched: true, listeningEvidenceVersion: 1 })

    const { playbackCompleted: _playback, comprehensionQuestion: _question, comprehensionResponse: _response, comprehensionMatched: _matched, ...prePlaybackAttempt } = legacyAttempt
    const prePlayback = validateForgeData({
      ...data,
      schemaVersion: 5,
      listeningAttempts: [{ ...prePlaybackAttempt, answerMatched: false }],
    }).listeningAttempts[0]
    expect(prePlayback).toMatchObject({ response: legacyAttempt.response, answerMatched: false })
    expect(prePlayback.listeningEvidenceVersion).toBeUndefined()
  })

  it('repairs original unversioned V6 listening records without entering recovery', () => {
    const data = createSeedData()
    const legacyAttempt = {
      id: 'early-v6-listening', sourceId: 'daily-a2', mode: 'dictation' as const,
      response: 'The train leaves at quarter past seven.', answerMatched: true, revealUsed: false,
      playbackCompleted: true, referenceTranscript: 'The train leaves at quarter past seven.',
      comprehensionQuestion: 'When does the train leave?', comprehensionResponse: 'At quarter past seven.', comprehensionMatched: true,
      durationSeconds: 8, createdAt: '2026-07-18T08:00:00.000Z',
    }
    const comprehension = validateForgeData({ ...data, listeningAttempts: [legacyAttempt] }).listeningAttempts[0]
    expect(comprehension).toMatchObject({
      response: legacyAttempt.response,
      answerMatched: false,
      comprehensionMatched: false,
      legacyComprehensionMatched: true,
    })
    expect(comprehension.listeningEvidenceVersion).toBeUndefined()

    const { comprehensionQuestion: _question, comprehensionResponse: _response, comprehensionMatched: _matched, ...dictationOnly } = legacyAttempt
    expect(validateForgeData({ ...data, listeningAttempts: [dictationOnly] }).listeningAttempts[0]).toMatchObject({
      answerMatched: true,
      listeningEvidenceVersion: 1,
    })
  })

  it('rebuilds imported skill schedules from raw current evidence', () => {
    const data = createSeedData()
    const phrase = data.phrases[0]
    data.reviews = data.reviews.filter((review) => review.targetId !== phrase.id)
    data.speakingAttempts = []
    data.skillStates = data.skillStates.map((state) => state.phraseId === phrase.id
      ? { ...state, attempts: 99, mastery: 1, phase: 'suspended' as const, dueAt: '2099-01-01T00:00:00.000Z' }
      : state)

    const rebuilt = validateForgeData(data).skillStates.filter((state) => state.phraseId === phrase.id)
    expect(rebuilt).toHaveLength(4)
    expect(rebuilt.every((state) => state.attempts === 0 && state.mastery === 0 && state.phase === 'new')).toBe(true)
  })

  it('validates stored placement evidence and binds it to the active timestamp', () => {
    const data = createSeedData()
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    const result = scorePlacement(selected)
    const completedAt = '2026-07-16T12:00:00.000Z'
    data.placementAttempts = [{ id: 'placement-test', questionSetVersion: PLACEMENT_QUESTION_SET_VERSION, answers: placementAnswers(selected), score: result.score, maxScore: result.maxScore, suggestedLevel: result.suggestedLevel, bandScores: result.bandScores, completedAt }]
    data.preferences = { ...data.preferences, currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: completedAt }
    expect(() => validateForgeData(data)).not.toThrow()
    expect(() => validateForgeData({ ...data, placementAttempts: [{ ...data.placementAttempts[0], suggestedLevel: 'A2' }] })).toThrow('versioned raw selections')
    expect(() => validateForgeData({ ...data, preferences: { ...data.preferences, placementCompletedAt: '2026-07-17T12:00:00.000Z' } })).toThrow('active placement timestamp')
    expect(() => validateForgeData({ ...data, preferences: { ...data.preferences, currentLevel: 'B2' } })).toThrow('active learning route')
    expect(() => validateForgeData({ ...data, placementAttempts: [{ ...data.placementAttempts[0], answers: data.placementAttempts[0].answers.map((answer, index) => index === 0 ? { ...answer, questionId: 'fake-question' } : answer) }] })).toThrow('versioned answer key')
    expect(() => validateForgeData({
      ...data,
      placementAttempts: [{
        ...data.placementAttempts[0],
        answers: data.placementAttempts[0].answers.map((answer, index) => index === 0
          ? { ...answer, selectedIndex: (answer.selectedIndex + 1) % 4 }
          : answer),
      }],
    })).toThrow('versioned answer key')
  })

  it('recomputes unversioned early-V6 placement evidence, orders it newest-first, and derives the active route', () => {
    const data = createSeedData()
    const correctSelections = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    const wrongSelections = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, (question.correctIndex + 1) % question.choices.length]))
    const correctResult = scorePlacement(correctSelections)
    const wrongResult = scorePlacement(wrongSelections)
    const olderAt = '2026-07-15T12:00:00.000Z'
    const newerAt = '2026-07-16T12:00:00.000Z'
    data.placementAttempts = [
      {
        id: 'older-early-v6',
        answers: placementAnswers(wrongSelections).map((answer) => ({ ...answer, correct: true })),
        score: correctResult.score,
        maxScore: correctResult.maxScore,
        suggestedLevel: correctResult.suggestedLevel,
        bandScores: correctResult.bandScores,
        completedAt: olderAt,
      },
      {
        id: 'newer-early-v6',
        answers: placementAnswers(correctSelections).map((answer) => ({ ...answer, correct: false })),
        score: wrongResult.score,
        maxScore: wrongResult.maxScore,
        suggestedLevel: wrongResult.suggestedLevel,
        bandScores: wrongResult.bandScores,
        completedAt: newerAt,
      },
    ]
    data.preferences = { ...data.preferences, currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: olderAt }

    const repaired = validateForgeData(data)
    expect(repaired.placementAttempts.map((attempt) => attempt.id)).toEqual(['newer-early-v6', 'older-early-v6'])
    expect(repaired.placementAttempts[0]).toMatchObject({ questionSetVersion: PLACEMENT_QUESTION_SET_VERSION, score: 32, suggestedLevel: 'C1' })
    expect(repaired.placementAttempts[0].legacyQuestionSet).toBeUndefined()
    expect(repaired.placementAttempts[0].answers.every((answer) => answer.correct)).toBe(true)
    expect(repaired.placementAttempts[1]).toMatchObject({ questionSetVersion: PLACEMENT_QUESTION_SET_VERSION, score: 0, suggestedLevel: 'A2' })
    expect(repaired.preferences).toMatchObject({ currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: newerAt })
  })

  it('quarantines incomplete unversioned early-V6 placement data instead of routing from claimed correctness', () => {
    const data = createSeedData()
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    const result = scorePlacement(selected)
    data.placementAttempts = [{
      id: 'incomplete-early-v6',
      answers: placementAnswers(selected).slice(0, -1),
      score: result.score,
      maxScore: result.maxScore,
      suggestedLevel: result.suggestedLevel,
      bandScores: result.bandScores,
      completedAt: '2026-07-16T12:00:00.000Z',
    }]
    data.preferences = { ...data.preferences, currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: data.placementAttempts[0].completedAt }

    const repaired = validateForgeData(data)
    expect(repaired.placementAttempts).toEqual([])
    expect(repaired.preferences).toMatchObject({ currentLevel: 'A2', targetLevel: 'B1' })
    expect(repaired.preferences.placementCompletedAt).toBeUndefined()
  })

  it('rejects current placement history that is not ordered newest-first', () => {
    const data = createSeedData()
    const correctSelections = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    const wrongSelections = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, (question.correctIndex + 1) % question.choices.length]))
    const correctResult = scorePlacement(correctSelections)
    const wrongResult = scorePlacement(wrongSelections)
    data.placementAttempts = [
      { id: 'older-current', questionSetVersion: PLACEMENT_QUESTION_SET_VERSION, answers: placementAnswers(correctSelections), score: correctResult.score, maxScore: correctResult.maxScore, suggestedLevel: correctResult.suggestedLevel, bandScores: correctResult.bandScores, completedAt: '2026-07-15T12:00:00.000Z' },
      { id: 'newer-current', questionSetVersion: PLACEMENT_QUESTION_SET_VERSION, answers: placementAnswers(wrongSelections), score: wrongResult.score, maxScore: wrongResult.maxScore, suggestedLevel: wrongResult.suggestedLevel, bandScores: wrongResult.bandScores, completedAt: '2026-07-16T12:00:00.000Z' },
    ]
    data.preferences = { ...data.preferences, currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: data.placementAttempts[0].completedAt }

    expect(() => validateForgeData(data)).toThrow('newest first')
  })

  it('persists only raw recomputable optional listening evidence without changing core placement', () => {
    const data = createSeedData()
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    const result = scorePlacement(selected)
    const completedAt = '2026-07-18T12:10:00.000Z'
    const listeningDiagnostic = {
      evidenceVersion: 1 as const,
      promptSetVersion: 1 as const,
      answers: PLACEMENT_LISTENING_PROMPTS.map((prompt) => ({
        promptId: prompt.id,
        selectedIndex: prompt.answerIndex,
        dictation: prompt.text,
        playbackCompleted: true as const,
        replayCount: 0,
      })),
      completedAt: '2026-07-18T12:00:00.000Z',
    }
    data.placementAttempts = [{ id: 'placement-with-listening', questionSetVersion: PLACEMENT_QUESTION_SET_VERSION, answers: placementAnswers(selected), score: result.score, maxScore: result.maxScore, suggestedLevel: result.suggestedLevel, bandScores: result.bandScores, listeningDiagnostic, completedAt }]
    data.preferences = { ...data.preferences, currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: completedAt }

    const validated = validateForgeData(data)
    expect(validated.placementAttempts[0]).toMatchObject({ suggestedLevel: result.suggestedLevel, listeningDiagnostic })
    const duplicatePrompt = listeningDiagnostic.answers.map((answer, index) => index === 1 ? { ...answer, promptId: listeningDiagnostic.answers[0].promptId } : answer)
    expect(() => validateForgeData({ ...data, placementAttempts: [{ ...data.placementAttempts[0], listeningDiagnostic: { ...listeningDiagnostic, answers: duplicatePrompt } }] })).toThrow('exact versioned prompt set')
    expect(() => validateForgeData({ ...data, placementAttempts: [{ ...data.placementAttempts[0], listeningDiagnostic: { ...listeningDiagnostic, completedAt: '2026-07-18T12:11:00.000Z' } }] })).toThrow('cannot be completed after')
    expect(() => validateForgeData({ ...data, placementAttempts: [{ ...data.placementAttempts[0], listeningDiagnostic: { ...listeningDiagnostic, derivedScore: 8 } }] })).toThrow('Unrecognized key')
  })

  it('conditionally repairs accidental catalog tags without rewriting the retired meaning', () => {
    const accidental = createSeedData()
    accidental.phrases[0] = {
      ...accidental.phrases[0],
      canonical: 'fall over',
      normalizedKey: normalizePhrase('fall over'),
      tags: ['personal', 'catalog-item:lex-b1-turn-out'],
    }
    const migrated = validateForgeData({ ...accidental, schemaVersion: 5 })
    expect(migrated.phrases[0].tags).toContain('catalog-item:lex-b1-fall-over')
    expect(migrated.phrases[0].tags).not.toContain('catalog-item:lex-b1-turn-out')

    const retired = createSeedData()
    retired.phrases[0] = {
      ...retired.phrases[0],
      canonical: 'turn out',
      normalizedKey: normalizePhrase('turn out'),
      tags: ['personal', 'catalog-item:lex-b1-turn-out'],
    }
    expect(validateForgeData({ ...retired, schemaVersion: 5 }).phrases[0].tags).toContain('catalog-item:lex-b1-turn-out')
  })

  it('keeps V4 placement attempts readable after answer choices are reordered', () => {
    const data = createSeedData()
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    const result = scorePlacement(selected)
    const completedAt = '2026-07-15T12:00:00.000Z'
    const answers = placementAnswers(selected).map((answer) =>
      answer.questionId === 'a2-06'
        ? { ...answer, selectedIndex: 0, correct: true }
        : answer,
    )
    data.placementAttempts = [{ id: 'pre-reorder-placement', answers, score: result.score, maxScore: result.maxScore, suggestedLevel: result.suggestedLevel, bandScores: result.bandScores, completedAt }]
    data.preferences = { ...data.preferences, currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: completedAt }

    expect(() => validateForgeData({ ...data, schemaVersion: 4 })).not.toThrow()
  })

  it('sorts legacy V4 placement history and derives its route from the newest attempt', () => {
    const data = createSeedData()
    const correctSelections = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    const wrongSelections = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, (question.correctIndex + 1) % question.choices.length]))
    const correctResult = scorePlacement(correctSelections)
    const wrongResult = scorePlacement(wrongSelections)
    data.placementAttempts = [
      { id: 'older-v4', answers: placementAnswers(correctSelections), score: correctResult.score, maxScore: correctResult.maxScore, suggestedLevel: correctResult.suggestedLevel, bandScores: correctResult.bandScores, completedAt: '2026-07-15T12:00:00.000Z' },
      { id: 'newer-v4', answers: placementAnswers(wrongSelections), score: wrongResult.score, maxScore: wrongResult.maxScore, suggestedLevel: wrongResult.suggestedLevel, bandScores: wrongResult.bandScores, completedAt: '2026-07-16T12:00:00.000Z' },
    ]
    data.preferences = { ...data.preferences, currentLevel: 'C1', targetLevel: 'C1', placementCompletedAt: data.placementAttempts[0].completedAt }

    const migrated = validateForgeData({ ...data, schemaVersion: 4 })
    expect(migrated.placementAttempts.map((attempt) => attempt.id)).toEqual(['newer-v4', 'older-v4'])
    expect(migrated.preferences).toMatchObject({ currentLevel: 'A2', targetLevel: 'B1', placementCompletedAt: '2026-07-16T12:00:00.000Z' })
  })

  it('quarantines an oversized V4 listening clip without losing its recording reference or metadata', () => {
    const current = createSeedData()
    const legacyClip = {
      id: 'legacy-long-clip',
      title: 'Legacy long interview',
      source: 'Local archive',
      transcript: 'Preserved transcript',
      recordingId: 'legacy_long_audio',
      mimeType: 'audio/webm',
      durationSeconds: 421.75,
      createdAt: '2026-07-10T08:00:00.000Z',
      updatedAt: '2026-07-10T08:00:00.000Z',
    }

    const migrated = validateForgeData({
      ...current,
      schemaVersion: 4,
      listeningClips: [legacyClip],
      listeningAttempts: [{
        id: 'legacy-long-attempt', sourceId: legacyClip.id, mode: 'blind_listen', response: 'A preserved note',
        answerMatched: false, revealUsed: true, playbackCompleted: true, durationSeconds: 300,
        createdAt: '2026-07-10T08:10:00.000Z',
      }],
    })

    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.listeningClips[0]).toMatchObject({
      ...legacyClip,
      durationSeconds: 300,
      quarantine: { reason: 'duration_limit', originalDurationSeconds: 421.75 },
    })
    expect(migrated.listeningAttempts).toHaveLength(1)
    expect(parseForgeJson(exportJson(migrated)).listeningClips[0]).toEqual(migrated.listeningClips[0])
  })

  it('rejects an active V6 listening clip over five minutes or forged quarantine metadata', () => {
    const current = createSeedData()
    const clip = {
      id: 'invalid-current-clip', title: 'Invalid clip', source: '', transcript: '', recordingId: 'invalid_current_audio',
      mimeType: 'audio/webm', durationSeconds: 301, createdAt: '2026-07-10T08:00:00.000Z', updatedAt: '2026-07-10T08:00:00.000Z',
    }
    expect(() => validateForgeData({ ...current, listeningClips: [clip] })).toThrow('<=300')
    expect(() => validateForgeData({
      ...current,
      listeningClips: [{ ...clip, durationSeconds: 300, quarantine: { reason: 'duration_limit', originalDurationSeconds: 300 } }],
    })).toThrow('>300')
  })

  it('escapes commas, multiline content and spreadsheet formula prefixes in CSV', () => {
    const data = createSeedData()
    data.phrases[0] = { ...data.phrases[0], canonical: '=HYPERLINK("bad")', context: 'Line one, detail\nLine two' }
    data.phrases[1] = { ...data.phrases[1], meaning: '  @SUM(1+1)', source: '\t-CMD' }
    const csv = exportPhrasesCsv(data)
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain("'  @SUM")
    expect(csv).toContain("'\t-CMD")
    expect(csv).toContain('Line one, detail\nLine two')
  })

  it('exports the evidence-derived lifecycle instead of the mutable cache status', () => {
    const data = createSeedData()
    const phrase = data.phrases[0]
    phrase.status = 'new'
    phrase.createdAt = '2026-06-01T12:00:00.000Z'
    phrase.activationStage = 8
    phrase.activationUpdatedAt = '2026-07-03T12:00:00.000Z'
    const base = data.reviews[0]
    data.reviews.push(
      { ...base, id: 'csv-active-1', idempotencyKey: 'csv-active-1', targetId: phrase.id, response: 'The first result may fall short of expectations this year.', reviewedAt: '2026-07-01T12:00:00.000Z', dueBefore: '2026-06-30T12:00:00.000Z' },
      { ...base, id: 'csv-active-2', idempotencyKey: 'csv-active-2', targetId: phrase.id, response: 'Our final result may fall short of expectations this year.', reviewedAt: '2026-07-02T12:00:00.000Z', dueBefore: '2026-07-01T12:00:00.000Z' },
    )
    data.missions[0] = { ...data.missions[0], status: 'done', completedAt: '2026-07-03T12:00:00.000Z', selfConfirmedAt: '2026-07-03T12:00:00.000Z', response: 'A self-checked mission response.', targetPhraseIds: [phrase.id], targetResults: [{ phraseId: phrase.id, confirmed: true }] }
    expect(exportPhrasesCsv(data)).toContain('"active"')
  })
})
