import { z } from 'zod'
import { migrateCatalogIdentityProfile } from './catalogIdentityMigration'
import { PLACEMENT_QUESTION_IDS, PLACEMENT_QUESTION_LEVELS } from './placementBlueprint'
import { PLACEMENT_QUESTIONS, PLACEMENT_QUESTION_SET_VERSION, scorePlacement } from './placementTest'
import { grammarAcademyLessons, grammarQuizForAttempt, grammarQuizVariantKey } from './grammarAcademy'
import { derivePhraseStatus } from '../domain/lifecycle'
import { canEnterActivationStepSix, hasQualifiedActivationThrough, qualifiedActivationStageAt } from '../domain/activation'
import { deriveErrorEvidence } from '../domain/errorEvidence'
import { deriveListeningResults, LISTENING_EVIDENCE_VERSION } from '../domain/listening'
import { isIndependentWrittenProductiveEvidence } from '../domain/reviewEvidence'
import { rebuildSkillStates } from '../domain/skillEvidence'
import { GRAMMAR_EVIDENCE_VERSION, grammarCorrectionMatches, grammarDraftIsOriginal, scoreGrammarQuizSelections } from '../domain/grammarEvidence'
import { missionDraftHasLexicalVariety, missionRequirementsForLevel, missionTargetsWereEligibleAt, missionWordCount } from '../domain/mission'
import { includesPhrase, normalizePhrase, phraseFingerprint } from '../domain/normalization'
import { speakingEvidencePhraseIds } from '../domain/speaking'
import { isCompletePlacementListeningDiagnostic, PLACEMENT_LISTENING_EVIDENCE_VERSION, PLACEMENT_LISTENING_PROMPT_SET_VERSION } from '../domain/placementListening'
import { DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT } from '../domain/dailyVocabulary'
import type { CEFRLevel, ForgeData, PhraseDepth, PlacementAttempt } from '../domain/types'

export const MAX_IMPORT_BYTES = 9 * 1024 * 1024
// Keep the storage key stable so V0.1 desktop profiles are discovered and migrated.
export const PROFILE_STORAGE_KEY = 'english-forge-profile-v1'

const isoDate = z.string().datetime({ offset: true })
const nonEmpty = z.string().trim().min(1)
const recordingId = z.string().regex(/^[A-Za-z0-9_-]{1,96}$/, 'Recording id contains unsafe characters.')
const skillV1 = z.enum(['meaning_recall', 'cloze', 'written_productive', 'grammar_repair'])
const skillV2 = z.enum(['meaning_recall', 'cloze', 'written_productive', 'spoken_productive', 'grammar_repair'])

const exampleSchema = z.object({ id: nonEmpty, text: nonEmpty, source: z.string().optional() }).strict()
const depthSchema = z.object({
  grammarFrame: z.string(),
  collocates: z.array(z.string()),
  constraints: z.array(z.string()),
  contrasts: z.array(z.object({ alternative: nonEmpty, distinction: z.string() }).strict()),
  connotation: z.string(),
  pronunciationNote: z.string(),
}).strict()

const activationErrorSchema = z.object({
  incorrectContext: nonEmpty,
  expectedCorrection: nonEmpty,
  cue: nonEmpty,
}).strict()

const phraseBase = {
  id: nonEmpty,
  canonical: nonEmpty,
  normalizedKey: nonEmpty,
  meaning: z.string(),
  kind: z.enum(['word', 'collocation', 'phrasal_verb', 'idiom', 'discourse_marker', 'grammar_frame', 'register_formula']),
  cefr: z.enum(['A2', 'B1', 'B2', 'C1', 'C2']),
  register: z.array(z.enum(['neutral', 'formal', 'informal', 'academic', 'spoken'])).min(1),
  context: z.string(),
  source: z.string(),
  tags: z.array(z.string()),
  note: z.string(),
  acceptedForms: z.array(z.string()),
  examples: z.array(exampleSchema),
  status: z.enum(['needs_enrichment', 'new', 'learning', 'active', 'retained', 'archived']),
  createdAt: isoDate,
  updatedAt: isoDate,
  archivedAt: isoDate.optional(),
  activationStage: z.number().int().min(0).max(8).optional(),
  legacyActivationStage: z.number().int().min(0).max(8).optional(),
  activationUpdatedAt: isoDate.optional(),
  evidenceResetAt: isoDate.optional(),
  activationEvents: z.array(z.object({
    stage: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8)]),
    completedAt: isoDate,
    evidenceId: nonEmpty.optional(),
    evidenceVersion: z.literal(1).optional(),
    response: z.string().max(10_000).optional(),
    selfConfirmed: z.boolean().optional(),
    qualified: z.boolean().optional(),
    supportUsed: z.boolean().optional(),
  }).strict()).max(100).optional(),
  practiceExposures: z.array(z.object({
    id: nonEmpty,
    skill: skillV2,
    exposedAt: isoDate,
    source: z.enum(['feedback', 'reveal']),
    sessionKey: nonEmpty,
  }).strict()).max(100).optional(),
  activationError: activationErrorSchema.optional(),
  legacyActivationError: activationErrorSchema.optional(),
}
const phraseV1Schema = z.object(phraseBase).strict()
const phraseV2Schema = z.object({ ...phraseBase, depth: depthSchema }).strict()

function skillStateSchema(skill: typeof skillV1 | typeof skillV2) {
  return z.object({
    phraseId: nonEmpty,
    skill,
    phase: z.enum(['new', 'learning', 'review', 'relearning', 'suspended']),
    mastery: z.number().finite().min(0).max(1),
    ease: z.number().finite().min(1.3).max(2.5),
    intervalDays: z.number().finite().min(0).max(180),
    learningStep: z.number().int().min(0).max(10),
    dueAt: isoDate,
    lastReviewedAt: isoDate.optional(),
    attempts: z.number().int().min(0),
    firstTrySuccesses: z.number().int().min(0),
    lapses: z.number().int().min(0),
    consecutiveSuccesses: z.number().int().min(0),
    transferPasses: z.number().int().min(0),
  }).strict()
}

function reviewSchema(skill: typeof skillV1 | typeof skillV2, v2: boolean) {
  const exercises = v2
    ? z.enum(['meaning_to_chunk', 'cloze_chunk', 'constrained_sentence', 'spoken_response', 'past_error_replay'])
    : z.enum(['meaning_to_chunk', 'cloze_chunk', 'constrained_sentence', 'past_error_replay'])
  return z.object({
    id: nonEmpty,
    idempotencyKey: nonEmpty,
    targetType: z.enum(['phrase', 'error']),
    targetId: nonEmpty,
    skill,
    exerciseType: exercises,
    response: z.string(),
    grade: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    hintsUsed: z.number().int().min(0).max(10),
    revealUsed: z.boolean(),
    supportUsed: z.boolean().optional(),
    reviewedAt: isoDate,
    dueBefore: isoDate,
    dueAfter: isoDate,
  }).strict()
}

const errorAttemptSchema = z.object({
  id: nonEmpty,
  response: z.string(),
  correct: z.boolean(),
  supportUsed: z.boolean(),
  transfer: z.boolean().default(false),
  attemptedAt: isoDate,
  evidenceVersion: z.literal(1).optional(),
  answerContractFingerprint: nonEmpty.optional(),
  expectedResponse: z.string().optional(),
}).strict()

const errorObservationSchema = z.object({
  id: nonEmpty,
  observedAt: isoDate,
  evidenceVersion: z.literal(1),
}).strict()

const errorSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  category: z.enum(['articles', 'prepositions', 'tense_aspect', 'word_order', 'collocation', 'register', 'other']),
  original: nonEmpty,
  correction: nonEmpty,
  hint: z.string(),
  rule: z.string(),
  transferPrompt: z.string(),
  transferAnswer: z.string().optional(),
  occurrences: z.number().int().min(1),
  observations: z.array(errorObservationSchema).optional(),
  legacyOccurrences: z.number().int().min(1).optional(),
  status: z.enum(['observed', 'active', 'improving', 'resolved']),
  dueAt: isoDate,
  cycleStartedAt: isoDate.optional(),
  evidenceVersion: z.literal(1).optional(),
  answerContractFingerprint: nonEmpty.optional(),
  answerContractUpdatedAt: isoDate.optional(),
  attempts: z.array(errorAttemptSchema),
  createdAt: isoDate,
  updatedAt: isoDate,
}).strict()

const missionSchema = z.object({
  id: nonEmpty,
  level: z.enum(['A2', 'B1', 'B2', 'C1']),
  title: nonEmpty,
  prompt: nonEmpty,
  targetPhraseIds: z.array(nonEmpty).min(1).max(8),
  minWords: z.number().int().min(20).max(300),
  maxWords: z.number().int().min(20).max(300),
  targetPhraseCount: z.number().int().min(1).max(8),
  supportUsed: z.boolean().optional(),
  legacyContract: z.boolean().optional(),
  grammarTarget: z.string().optional(),
  draft: z.string(),
  response: z.string().optional(),
  targetResults: z.array(z.object({ phraseId: nonEmpty, confirmed: z.boolean() }).strict()),
  status: z.enum(['planned', 'active', 'done']),
  createdAt: isoDate,
  completedAt: isoDate.optional(),
  selfConfirmedAt: isoDate.optional(),
}).strict()

const preferencesV1Schema = z.object({
  dailyMinutes: z.number().int().min(5).max(90),
  maxNewPhrases: z.number().int().min(0).max(20),
  dailyNewWords: z.number().int().min(1).max(30).optional(),
  englishVariant: z.enum(['International', 'UK', 'US']),
  explanationLanguage: z.enum(['English', 'Russian']),
  theme: z.enum(['dark', 'light', 'system']),
  reducedMotion: z.boolean(),
}).strict()
const preferencesV2Schema = preferencesV1Schema.extend({ keepRecordings: z.enum(['session', '7_days', 'forever']) }).strict()
const preferencesV3Schema = preferencesV2Schema.extend({
  currentLevel: z.enum(['A2', 'B1', 'B2', 'C1']),
  targetLevel: z.enum(['A2', 'B1', 'B2', 'C1']),
  placementCompletedAt: isoDate.optional(),
}).strict()

const speakingAttemptSchema = z.object({
  id: nonEmpty,
  idempotencyKey: nonEmpty,
  sessionId: nonEmpty,
  mode: z.enum(['targeted_response', 'fluency_432', 'shadowing']),
  prompt: nonEmpty,
  round: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  targetPhraseIds: z.array(nonEmpty).max(8),
  detectedPhraseIds: z.array(nonEmpty).max(8),
  confirmedPhraseIds: z.array(nonEmpty).max(8),
  evidenceEligiblePhraseIds: z.array(nonEmpty).max(8).optional(),
  transcript: z.string(),
  durationSeconds: z.number().finite().min(1).max(7_200),
  recordingId: recordingId.optional(),
  mimeType: z.string().optional(),
  targetFormVisible: z.boolean().optional(),
  supportUsed: z.boolean(),
  selfRating: z.object({
    clarity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    flow: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  }).strict(),
  createdAt: isoDate,
}).strict()

const legacyListeningClipSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  source: z.string(),
  transcript: z.string(),
  recordingId,
  mimeType: nonEmpty,
  durationSeconds: z.number().finite().min(1).max(7_200),
  createdAt: isoDate,
  updatedAt: isoDate,
}).strict()

const listeningClipSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  source: z.string(),
  transcript: z.string(),
  recordingId,
  mimeType: nonEmpty,
  durationSeconds: z.number().finite().min(1).max(300),
  quarantine: z.object({
    reason: z.literal('duration_limit'),
    originalDurationSeconds: z.number().finite().gt(300).max(7_200),
  }).strict().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
}).strict().superRefine((clip, context) => {
  if (clip.quarantine && clip.durationSeconds !== 300) {
    context.addIssue({ code: 'custom', path: ['durationSeconds'], message: 'A quarantined legacy clip must use the 300-second practice cap.' })
  }
})

const listeningAttemptV4Schema = z.object({
  id: nonEmpty,
  sourceId: nonEmpty,
  mode: z.enum(['blind_listen', 'dictation']),
  response: nonEmpty,
  answerMatched: z.boolean(),
  revealUsed: z.boolean(),
  playbackCompleted: z.boolean().optional(),
  referenceTranscript: z.string().max(20_000).optional(),
  sourceUpdatedAt: isoDate.optional(),
  comprehensionQuestion: nonEmpty.optional(),
  comprehensionResponse: nonEmpty.optional(),
  comprehensionMatched: z.boolean().optional(),
  durationSeconds: z.number().finite().min(1).max(300),
  createdAt: isoDate,
}).strict()

const listeningAttemptV6Schema = listeningAttemptV4Schema.extend({
  comprehensionExpectedResponse: nonEmpty.optional(),
  legacyComprehensionMatched: z.boolean().optional(),
  listeningEvidenceVersion: z.literal(LISTENING_EVIDENCE_VERSION).optional(),
}).strict()

const placementListeningDiagnosticSchema = z.object({
  evidenceVersion: z.literal(PLACEMENT_LISTENING_EVIDENCE_VERSION),
  promptSetVersion: z.literal(PLACEMENT_LISTENING_PROMPT_SET_VERSION),
  answers: z.array(z.object({
    promptId: nonEmpty,
    selectedIndex: z.number().int().min(0).max(2),
    dictation: nonEmpty.max(2_000),
    playbackCompleted: z.literal(true),
    replayCount: z.number().int().min(0).max(5),
  }).strict()).length(8),
  completedAt: isoDate,
}).strict().superRefine((diagnostic, context) => {
  if (!isCompletePlacementListeningDiagnostic(diagnostic)) context.addIssue({ code: 'custom', message: 'Placement listening evidence must contain the exact versioned prompt set and raw completed answers.' })
})

const placementAttemptSchema = z.object({
  id: nonEmpty,
  questionSetVersion: z.literal(PLACEMENT_QUESTION_SET_VERSION).optional(),
  legacyQuestionSet: z.literal(true).optional(),
  answers: z.array(z.object({
    questionId: nonEmpty,
    selectedIndex: z.number().int().min(0).max(3),
    correct: z.boolean(),
  }).strict()).min(1).max(160),
  score: z.number().int().min(0).max(160),
  maxScore: z.number().int().min(1).max(160),
  suggestedLevel: z.enum(['A2', 'B1', 'B2', 'C1']),
  bandScores: z.object({
    A2: z.object({ correct: z.number().int().min(0), total: z.number().int().min(1) }).strict(),
    B1: z.object({ correct: z.number().int().min(0), total: z.number().int().min(1) }).strict(),
    B2: z.object({ correct: z.number().int().min(0), total: z.number().int().min(1) }).strict(),
    C1: z.object({ correct: z.number().int().min(0), total: z.number().int().min(1) }).strict(),
  }).strict(),
  listeningDiagnostic: placementListeningDiagnosticSchema.optional(),
  completedAt: isoDate,
}).strict()

const grammarProgressV3Schema = z.object({
  lessonId: nonEmpty,
  attempts: z.number().int().min(1),
  passes: z.number().int().min(0).optional(),
  bestScore: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
  lastAttemptedAt: isoDate,
  lastPassedAt: isoDate.optional(),
  completedAt: isoDate.optional(),
}).strict()

const grammarProgressV4Schema = z.object({
  lessonId: nonEmpty,
  attempts: z.number().int().min(0),
  passes: z.number().int().min(0).default(0),
  bestScore: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
  lastScore: z.number().int().min(0).optional(),
  lastAttemptedAt: isoDate,
  lastPassedAt: isoDate.optional(),
  completedAt: isoDate.optional(),
  legacyCompletedAt: isoDate.optional(),
  productionDraft: z.string().max(2_000).optional(),
  productionSavedAt: isoDate.optional(),
  productionSelfConfirmedAt: isoDate.optional(),
  productionTargetPhraseId: nonEmpty.optional(),
  transferDraft: z.string().max(2_000).optional(),
  transferSavedAt: isoDate.optional(),
  transferSelfConfirmedAt: isoDate.optional(),
  transferTargetPhraseId: nonEmpty.optional(),
  correctionPassedAt: isoDate.optional(),
  cumulativeAttempts: z.number().int().min(0).optional(),
  cumulativeCorrect: z.number().int().min(0).optional(),
  lastCumulativeReviewedAt: isoDate.optional(),
  nextCumulativeDueAt: isoDate.optional(),
  masteryEvidenceVersion: z.union([z.literal(2), z.literal(3)]).optional(),
}).strict()

const grammarProgressV6Schema = grammarProgressV4Schema.extend({
  passHistory: z.array(isoDate).max(2).default([]),
  quizPassEvidence: z.array(z.object({
    evidenceVersion: z.literal(1),
    attemptNumber: z.number().int().min(0).max(100_000),
    answers: z.array(z.object({ questionId: nonEmpty, selectedIndex: z.number().int().min(0).max(2) }).strict()).length(3),
    completedAt: isoDate,
  }).strict()).max(2).default([]),
  legacyPasses: z.number().int().min(0).optional(),
  legacyLastPassedAt: isoDate.optional(),
  correctionEvidence: z.object({ evidenceVersion: z.literal(1), response: nonEmpty.max(2_000), completedAt: isoDate }).strict().optional(),
  transferCheckEvidence: z.object({
    evidenceVersion: z.literal(1),
    attemptNumber: z.number().int().min(0).max(100_000),
    answers: z.array(z.object({ questionId: nonEmpty, selectedIndex: z.number().int().min(0).max(2) }).strict()).length(3),
    completedAt: isoDate,
  }).strict().optional(),
  legacyCorrectionPassedAt: isoDate.optional(),
  masteryEvidenceVersion: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).optional(),
}).strict()

const dailyVocabularyAssignmentSchema = z.object({
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  level: z.enum(['A2', 'B1', 'B2', 'C1']),
  itemIds: z.array(nonEmpty).max(10),
  enrolledIds: z.array(nonEmpty).max(10),
  previewedIds: z.array(nonEmpty).max(10).optional(),
  deferredIds: z.array(nonEmpty).max(1_000).optional(),
}).strict()

type DailyVocabularyAssignmentRecord = z.infer<typeof dailyVocabularyAssignmentSchema>

function sameDailyVocabularyAssignment(
  left: DailyVocabularyAssignmentRecord,
  right: DailyVocabularyAssignmentRecord,
): boolean {
  const sameIds = (leftIds: readonly string[] | undefined, rightIds: readonly string[] | undefined) => {
    const normalizedLeft = leftIds ?? []
    const normalizedRight = rightIds ?? []
    return normalizedLeft.length === normalizedRight.length
      && normalizedLeft.every((id, index) => id === normalizedRight[index])
  }
  return left.dayKey === right.dayKey
    && left.level === right.level
    && sameIds(left.itemIds, right.itemIds)
    && sameIds(left.enrolledIds, right.enrolledIds)
    && sameIds(left.previewedIds, right.previewedIds)
    && sameIds(left.deferredIds, right.deferredIds)
}

const forgeDataV1Schema = z.object({
  schemaVersion: z.literal(1),
  phrases: z.array(phraseV1Schema),
  skillStates: z.array(skillStateSchema(skillV1)),
  reviews: z.array(reviewSchema(skillV1, false)),
  errors: z.array(errorSchema),
  missions: z.array(missionSchema),
  preferences: preferencesV1Schema,
}).strict()

const forgeDataV2Base = z.object({
  schemaVersion: z.literal(2),
  phrases: z.array(phraseV2Schema),
  skillStates: z.array(skillStateSchema(skillV2)),
  reviews: z.array(reviewSchema(skillV2, true)),
  errors: z.array(errorSchema),
  missions: z.array(missionSchema),
  speakingAttempts: z.array(speakingAttemptSchema),
  listeningClips: z.array(legacyListeningClipSchema),
  preferences: preferencesV2Schema,
}).strict()

function refineForgeData(data: z.infer<typeof forgeDataV2Base>, context: z.RefinementCtx): void {
  const phraseIds = new Set<string>()
  const phraseFingerprints = new Set<string>()
  const phrasesById = new Map(data.phrases.map((phrase) => [phrase.id, phrase]))
  for (const [index, phrase] of data.phrases.entries()) {
    if (phraseIds.has(phrase.id)) context.addIssue({ code: 'custom', path: ['phrases', index, 'id'], message: `Duplicate phrase id: ${phrase.id}` })
    const expectedNormalizedKey = normalizePhrase(phrase.canonical)
    if (phrase.normalizedKey !== expectedNormalizedKey) context.addIssue({ code: 'custom', path: ['phrases', index, 'normalizedKey'], message: 'A phrase normalized key must match its canonical form.' })
    const fingerprint = phraseFingerprint(phrase.canonical)
    if (phraseFingerprints.has(fingerprint)) context.addIssue({ code: 'custom', path: ['phrases', index, 'canonical'], message: `Duplicate phrase fingerprint: ${fingerprint}` })
    phraseIds.add(phrase.id)
    phraseFingerprints.add(fingerprint)
  }

  const errorIds = new Set<string>()
  for (const [index, error] of data.errors.entries()) {
    if (errorIds.has(error.id)) context.addIssue({ code: 'custom', path: ['errors', index, 'id'], message: `Duplicate error id: ${error.id}` })
    errorIds.add(error.id)
  }

  const skillKeys = new Set<string>()
  for (const [index, state] of data.skillStates.entries()) {
    const key = `${state.phraseId}:${state.skill}`
    if (!phraseIds.has(state.phraseId)) context.addIssue({ code: 'custom', path: ['skillStates', index, 'phraseId'], message: 'A review schedule refers to a missing phrase.' })
    if (skillKeys.has(key)) context.addIssue({ code: 'custom', path: ['skillStates', index], message: `Duplicate skill state: ${key}` })
    skillKeys.add(key)
  }

  const eventIds = new Set<string>()
  const idempotencyKeys = new Set<string>()
  const recordingIds = new Set<string>()
  for (const [index, review] of data.reviews.entries()) {
    if (eventIds.has(review.id)) context.addIssue({ code: 'custom', path: ['reviews', index, 'id'], message: `Duplicate review id: ${review.id}` })
    if (idempotencyKeys.has(review.idempotencyKey)) context.addIssue({ code: 'custom', path: ['reviews', index, 'idempotencyKey'], message: `Duplicate review idempotency key: ${review.idempotencyKey}` })
    if (review.targetType === 'phrase' && !phraseIds.has(review.targetId)) context.addIssue({ code: 'custom', path: ['reviews', index, 'targetId'], message: 'A review refers to a missing phrase.' })
    if (review.targetType === 'error' && !errorIds.has(review.targetId)) context.addIssue({ code: 'custom', path: ['reviews', index, 'targetId'], message: 'A review refers to a missing error pattern.' })
    eventIds.add(review.id)
    idempotencyKeys.add(review.idempotencyKey)
  }

  for (const [index, attempt] of data.speakingAttempts.entries()) {
    if (eventIds.has(attempt.id)) context.addIssue({ code: 'custom', path: ['speakingAttempts', index, 'id'], message: `Duplicate event id: ${attempt.id}` })
    if (idempotencyKeys.has(attempt.idempotencyKey)) context.addIssue({ code: 'custom', path: ['speakingAttempts', index, 'idempotencyKey'], message: `Duplicate event idempotency key: ${attempt.idempotencyKey}` })
    const targets = new Set(attempt.targetPhraseIds)
    if (targets.size !== attempt.targetPhraseIds.length || attempt.targetPhraseIds.some((id) => !phraseIds.has(id))) context.addIssue({ code: 'custom', path: ['speakingAttempts', index, 'targetPhraseIds'], message: 'A speaking attempt has invalid phrase targets.' })
    const detected = new Set(attempt.detectedPhraseIds)
    if (detected.size !== attempt.detectedPhraseIds.length || new Set(attempt.confirmedPhraseIds).size !== attempt.confirmedPhraseIds.length) context.addIssue({ code: 'custom', path: ['speakingAttempts', index], message: 'Detected and confirmed phrase lists must not contain duplicates.' })
    if (attempt.detectedPhraseIds.some((id) => !targets.has(id)) || attempt.confirmedPhraseIds.some((id) => !detected.has(id))) context.addIssue({ code: 'custom', path: ['speakingAttempts', index], message: 'Detected phrases must be targets and confirmed phrases must be detected.' })
    if (attempt.evidenceEligiblePhraseIds && (new Set(attempt.evidenceEligiblePhraseIds).size !== attempt.evidenceEligiblePhraseIds.length || attempt.evidenceEligiblePhraseIds.some((id) => !targets.has(id)))) context.addIssue({ code: 'custom', path: ['speakingAttempts', index, 'evidenceEligiblePhraseIds'], message: 'Speaking evidence eligibility must be a unique subset of the saved targets.' })
    if (attempt.mode === 'fluency_432' && attempt.round === undefined) context.addIssue({ code: 'custom', path: ['speakingAttempts', index, 'round'], message: 'A 4/3/2 attempt must identify its round.' })
    if (attempt.mode === 'fluency_432' && !attempt.recordingId) context.addIssue({ code: 'custom', path: ['speakingAttempts', index, 'recordingId'], message: 'Every 4/3/2 round requires a recording.' })
    if (attempt.mode !== 'fluency_432' && attempt.round !== undefined) context.addIssue({ code: 'custom', path: ['speakingAttempts', index, 'round'], message: 'Only a 4/3/2 attempt may identify a round.' })
    const durationLimit = attempt.mode === 'fluency_432' ? ([60, 45, 30] as const)[(attempt.round ?? 1) - 1] : 180
    if (attempt.durationSeconds > durationLimit) context.addIssue({ code: 'custom', path: ['speakingAttempts', index, 'durationSeconds'], message: `Speaking duration exceeds the ${durationLimit}-second task limit.` })
    if (attempt.recordingId) {
      if (recordingIds.has(attempt.recordingId)) context.addIssue({ code: 'custom', path: ['speakingAttempts', index, 'recordingId'], message: 'A recording is already registered.' })
      recordingIds.add(attempt.recordingId)
    }
    eventIds.add(attempt.id)
    idempotencyKeys.add(attempt.idempotencyKey)
  }

  const fluencyFamilies = new Map<string, { index: number; attempt: typeof data.speakingAttempts[number] }[]>()
  data.speakingAttempts.forEach((attempt, index) => {
    if (attempt.mode !== 'fluency_432') return
    fluencyFamilies.set(attempt.sessionId, [...(fluencyFamilies.get(attempt.sessionId) ?? []), { index, attempt }])
  })
  for (const family of fluencyFamilies.values()) {
    const ordered = [...family].sort((left, right) => (left.attempt.round ?? 0) - (right.attempt.round ?? 0))
    const first = ordered[0]?.attempt
    let inheritedSupportUsed = false
    let inheritedTargetFormVisible = false
    for (const [position, item] of ordered.entries()) {
      if (item.attempt.round !== position + 1) context.addIssue({ code: 'custom', path: ['speakingAttempts', item.index, 'round'], message: '4/3/2 rounds must form an ordered 1 → 2 → 3 prefix.' })
      if (first && (item.attempt.prompt.trim() !== first.prompt.trim() || [...item.attempt.targetPhraseIds].sort().join('\u0000') !== [...first.targetPhraseIds].sort().join('\u0000'))) context.addIssue({ code: 'custom', path: ['speakingAttempts', item.index], message: 'A 4/3/2 family must keep the same prompt and targets.' })
      if (position > 0 && new Date(item.attempt.createdAt).getTime() < new Date(ordered[position - 1].attempt.createdAt).getTime()) context.addIssue({ code: 'custom', path: ['speakingAttempts', item.index, 'createdAt'], message: '4/3/2 rounds must be saved in chronological order.' })
      if (inheritedSupportUsed && !item.attempt.supportUsed) context.addIssue({ code: 'custom', path: ['speakingAttempts', item.index, 'supportUsed'], message: 'A later 4/3/2 round cannot clear support provenance inherited from an earlier round.' })
      if (inheritedTargetFormVisible && item.attempt.targetFormVisible === false) context.addIssue({ code: 'custom', path: ['speakingAttempts', item.index, 'targetFormVisible'], message: 'A later 4/3/2 round cannot clear target-form exposure inherited from an earlier round.' })
      inheritedSupportUsed ||= item.attempt.supportUsed
      // Missing legacy provenance is deliberately treated as exposed so it can
      // never be upgraded into independent speaking evidence during import.
      inheritedTargetFormVisible ||= item.attempt.targetFormVisible !== false
    }
  }

  for (const [index, clip] of data.listeningClips.entries()) {
    if (eventIds.has(clip.id)) context.addIssue({ code: 'custom', path: ['listeningClips', index, 'id'], message: `Duplicate event id: ${clip.id}` })
    if (recordingIds.has(clip.recordingId)) context.addIssue({ code: 'custom', path: ['listeningClips', index, 'recordingId'], message: 'A listening recording is already registered.' })
    eventIds.add(clip.id)
    recordingIds.add(clip.recordingId)
  }

  const missionIds = new Set<string>()
  for (const [index, mission] of data.missions.entries()) {
    if (missionIds.has(mission.id)) context.addIssue({ code: 'custom', path: ['missions', index, 'id'], message: `Duplicate mission id: ${mission.id}` })
    missionIds.add(mission.id)
    const targets = new Set(mission.targetPhraseIds)
    if (targets.size !== mission.targetPhraseIds.length) context.addIssue({ code: 'custom', path: ['missions', index, 'targetPhraseIds'], message: 'A mission contains duplicate phrase targets.' })
    if (mission.minWords > mission.maxWords) context.addIssue({ code: 'custom', path: ['missions', index, 'maxWords'], message: 'A mission maximum must not be lower than its minimum word count.' })
    if (mission.targetPhraseCount !== mission.targetPhraseIds.length) context.addIssue({ code: 'custom', path: ['missions', index, 'targetPhraseCount'], message: 'A mission target count must match its phrase targets.' })
    for (const phraseId of targets) if (!phraseIds.has(phraseId)) context.addIssue({ code: 'custom', path: ['missions', index, 'targetPhraseIds'], message: 'A mission refers to a missing phrase.' })
    const legacyHistory = mission.legacyContract === true
    const requirements = missionRequirementsForLevel(mission.level)
    if (!legacyHistory && (mission.minWords !== requirements.minWords || mission.maxWords !== requirements.maxWords)) context.addIssue({ code: 'custom', path: ['missions', index], message: 'Mission writing limits must match its persisted CEFR level.' })
    if (!legacyHistory && (targets.size < requirements.minTargetPhrases || targets.size > requirements.maxTargetPhrases)) context.addIssue({ code: 'custom', path: ['missions', index, 'targetPhraseIds'], message: 'Mission target load must match its persisted CEFR level.' })
    if (!legacyHistory && [...targets].some((phraseId) => phrasesById.get(phraseId)?.cefr !== mission.level)) context.addIssue({ code: 'custom', path: ['missions', index, 'targetPhraseIds'], message: 'Every mission target must match the mission CEFR level.' })
    const resultIds = mission.targetResults.map((result) => result.phraseId)
    if (new Set(resultIds).size !== resultIds.length || resultIds.some((id) => !targets.has(id)) || resultIds.length !== targets.size) context.addIssue({ code: 'custom', path: ['missions', index, 'targetResults'], message: 'Mission results must match its phrase targets exactly.' })
    if (mission.status === 'done' && !mission.completedAt) context.addIssue({ code: 'custom', path: ['missions', index, 'completedAt'], message: 'A completed mission must include its completion time.' })
    if (!legacyHistory && mission.completedAt && new Date(mission.completedAt).getTime() < new Date(mission.createdAt).getTime()) context.addIssue({ code: 'custom', path: ['missions', index, 'completedAt'], message: 'Mission completion cannot precede mission creation.' })
    if (!legacyHistory && mission.status === 'done') {
      if (!mission.response?.trim() || !mission.selfConfirmedAt || mission.selfConfirmedAt !== mission.completedAt) context.addIssue({ code: 'custom', path: ['missions', index], message: 'A completed current mission requires a self-confirmed response tied to its completion time.' })
      if (mission.targetResults.some((result) => !result.confirmed)) context.addIssue({ code: 'custom', path: ['missions', index, 'targetResults'], message: 'Every target in a completed current mission must be confirmed.' })
      if (mission.response) {
        const wordCount = missionWordCount(mission.response)
        if (wordCount < mission.minWords || wordCount > mission.maxWords) context.addIssue({ code: 'custom', path: ['missions', index, 'response'], message: 'A completed current mission response must satisfy its saved word-count contract.' })
        if (normalizePhrase(mission.response) !== normalizePhrase(mission.draft)) context.addIssue({ code: 'custom', path: ['missions', index, 'response'], message: 'A completed current mission response must match its saved draft.' })
        if (!missionDraftHasLexicalVariety(mission.response)) context.addIssue({ code: 'custom', path: ['missions', index, 'response'], message: 'A completed current mission must contain a connected response rather than mechanical repetition.' })
        for (const phraseId of targets) {
          const phrase = phrasesById.get(phraseId)
          if (phrase && !includesPhrase(mission.response, phrase.canonical, phrase.acceptedForms)) context.addIssue({ code: 'custom', path: ['missions', index, 'response'], message: `A completed current mission response does not contain target ${phraseId}.` })
        }
      }
    }
  }
}

const forgeDataV2Schema = forgeDataV2Base.superRefine(refineForgeData)

const forgeDataV3Schema = z.object({
  ...forgeDataV2Base.shape,
  schemaVersion: z.literal(3),
  placementAttempts: z.array(placementAttemptSchema).max(100),
  grammarProgress: z.array(grammarProgressV3Schema),
  preferences: preferencesV3Schema,
}).strict().superRefine((data, context) => {
  refineForgeData(data as unknown as z.infer<typeof forgeDataV2Base>, context)
  const placementIds = new Set<string>()
  for (const [index, attempt] of data.placementAttempts.entries()) {
    if (placementIds.has(attempt.id)) context.addIssue({ code: 'custom', path: ['placementAttempts', index, 'id'], message: `Duplicate placement attempt id: ${attempt.id}` })
    placementIds.add(attempt.id)
  }
  const lessonIds = new Set<string>()
  for (const [index, progress] of data.grammarProgress.entries()) {
    if (lessonIds.has(progress.lessonId)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'lessonId'], message: `Duplicate grammar progress: ${progress.lessonId}` })
    lessonIds.add(progress.lessonId)
    if (progress.bestScore > progress.totalQuestions) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'bestScore'], message: 'Grammar score exceeds its question total.' })
  }
})

const forgeDataV4Schema = z.object({
  ...forgeDataV2Base.shape,
  schemaVersion: z.literal(4),
  dailyVocabularyAssignment: dailyVocabularyAssignmentSchema.nullable().default(null),
  dailyVocabularyAssignments: z.array(dailyVocabularyAssignmentSchema).max(DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT).default([]),
  listeningAttempts: z.array(listeningAttemptV4Schema).max(10_000).default([]),
  placementAttempts: z.array(placementAttemptSchema).max(100),
  grammarProgress: z.array(grammarProgressV4Schema),
  preferences: preferencesV3Schema,
}).strict().superRefine((data, context) => {
  refineForgeData(data as unknown as z.infer<typeof forgeDataV2Base>, context)
  if (data.dailyVocabularyAssignment) {
    const { itemIds, enrolledIds, previewedIds = [], deferredIds = [] } = data.dailyVocabularyAssignment
    const selectedIds = new Set(itemIds)
    if (selectedIds.size !== itemIds.length) context.addIssue({ code: 'custom', path: ['dailyVocabularyAssignment', 'itemIds'], message: 'A daily vocabulary assignment contains duplicate item ids.' })
    if (new Set(enrolledIds).size !== enrolledIds.length || enrolledIds.some((id) => !selectedIds.has(id))) context.addIssue({ code: 'custom', path: ['dailyVocabularyAssignment', 'enrolledIds'], message: 'Daily vocabulary enrollment must be a unique subset of assigned items.' })
    if (new Set(previewedIds).size !== previewedIds.length || previewedIds.some((id) => !selectedIds.has(id))) context.addIssue({ code: 'custom', path: ['dailyVocabularyAssignment', 'previewedIds'], message: 'Daily vocabulary previews must be a unique subset of assigned items.' })
    if (new Set(deferredIds).size !== deferredIds.length || deferredIds.some((id) => selectedIds.has(id))) context.addIssue({ code: 'custom', path: ['dailyVocabularyAssignment', 'deferredIds'], message: 'Deferred daily vocabulary ids must be unique and outside the assigned pack.' })
  }
  const assignmentKeys = new Set<string>()
  for (const [index, assignment] of data.dailyVocabularyAssignments.entries()) {
    const key = `${assignment.dayKey}:${assignment.level}`
    if (assignmentKeys.has(key)) context.addIssue({ code: 'custom', path: ['dailyVocabularyAssignments', index], message: 'Daily vocabulary packs must be unique by day and level.' })
    assignmentKeys.add(key)
    if (new Set(assignment.itemIds).size !== assignment.itemIds.length) context.addIssue({ code: 'custom', path: ['dailyVocabularyAssignments', index, 'itemIds'], message: 'A daily vocabulary assignment contains duplicate item ids.' })
    if (new Set(assignment.enrolledIds).size !== assignment.enrolledIds.length || assignment.enrolledIds.some((id) => !assignment.itemIds.includes(id))) context.addIssue({ code: 'custom', path: ['dailyVocabularyAssignments', index, 'enrolledIds'], message: 'Daily vocabulary enrollment must be a unique subset of assigned items.' })
    const previewedIds = assignment.previewedIds ?? []
    if (new Set(previewedIds).size !== previewedIds.length || previewedIds.some((id) => !assignment.itemIds.includes(id))) context.addIssue({ code: 'custom', path: ['dailyVocabularyAssignments', index, 'previewedIds'], message: 'Daily vocabulary previews must be a unique subset of assigned items.' })
    const deferredIds = assignment.deferredIds ?? []
    if (new Set(deferredIds).size !== deferredIds.length || deferredIds.some((id) => assignment.itemIds.includes(id))) context.addIssue({ code: 'custom', path: ['dailyVocabularyAssignments', index, 'deferredIds'], message: 'Deferred daily vocabulary ids must be unique and outside the assigned pack.' })
  }
  if (data.dailyVocabularyAssignment) {
    const active = data.dailyVocabularyAssignment
    const matchingHistoryIndex = data.dailyVocabularyAssignments.findIndex((assignment) => assignment.dayKey === active.dayKey && assignment.level === active.level)
    const matchingHistory = data.dailyVocabularyAssignments[matchingHistoryIndex]
    if (matchingHistory && !sameDailyVocabularyAssignment(active, matchingHistory)) {
      context.addIssue({
        code: 'custom',
        path: ['dailyVocabularyAssignments', matchingHistoryIndex],
        message: 'The active daily vocabulary pack must match its same-day, same-level history entry.',
      })
    }
  }
  const listeningAttemptIds = new Set<string>()
  for (const [index, attempt] of data.listeningAttempts.entries()) {
    if (listeningAttemptIds.has(attempt.id)) context.addIssue({ code: 'custom', path: ['listeningAttempts', index, 'id'], message: `Duplicate listening attempt id: ${attempt.id}` })
    listeningAttemptIds.add(attempt.id)
    const comprehensionParts = [attempt.comprehensionQuestion, attempt.comprehensionResponse, attempt.comprehensionMatched].filter((value) => value !== undefined).length
    if (comprehensionParts !== 0 && comprehensionParts !== 3) context.addIssue({ code: 'custom', path: ['listeningAttempts', index], message: 'Listening comprehension evidence must include question, response, and result together.' })
    if (attempt.answerMatched && (attempt.playbackCompleted !== true || !attempt.referenceTranscript?.trim())) context.addIssue({ code: 'custom', path: ['listeningAttempts', index, 'answerMatched'], message: 'A matched listening result requires completed playback and an immutable reference snapshot.' })
    if (attempt.answerMatched && comprehensionParts === 3 && attempt.comprehensionMatched !== true) context.addIssue({ code: 'custom', path: ['listeningAttempts', index, 'comprehensionMatched'], message: 'A matched listening result cannot contain an incorrect comprehension answer.' })
  }
  const placementIds = new Set<string>()
  const expectedQuestionIds = new Set(PLACEMENT_QUESTION_IDS)
  for (const [index, attempt] of data.placementAttempts.entries()) {
    if (placementIds.has(attempt.id)) context.addIssue({ code: 'custom', path: ['placementAttempts', index, 'id'], message: `Duplicate placement attempt id: ${attempt.id}` })
    placementIds.add(attempt.id)
    const answerIds = attempt.answers.map((answer) => answer.questionId)
    const bandTotals = Object.values(attempt.bandScores).reduce((sum, band) => sum + band.total, 0)
    const bandCorrect = Object.values(attempt.bandScores).reduce((sum, band) => sum + band.correct, 0)
    const hasExactQuestionSet = answerIds.length === expectedQuestionIds.size && answerIds.every((id) => expectedQuestionIds.has(id))
    if (new Set(answerIds).size !== answerIds.length || !hasExactQuestionSet || attempt.score > attempt.maxScore || attempt.answers.length !== attempt.maxScore || attempt.answers.filter((answer) => answer.correct).length !== attempt.score || bandTotals !== attempt.maxScore || bandCorrect !== attempt.score) context.addIssue({ code: 'custom', path: ['placementAttempts', index], message: 'Placement score and answer totals are inconsistent.' })
    for (const level of ['A2', 'B1', 'B2', 'C1'] as const) if (attempt.bandScores[level].correct > attempt.bandScores[level].total) context.addIssue({ code: 'custom', path: ['placementAttempts', index, 'bandScores', level], message: 'A placement band score exceeds its total.' })
    if (hasExactQuestionSet) {
      const levels = ['A2', 'B1', 'B2', 'C1'] as const
      const bandsMatchStoredEvidence = levels.every((level) => {
        const answers = attempt.answers.filter((answer) => PLACEMENT_QUESTION_LEVELS.get(answer.questionId) === level)
        return attempt.bandScores[level].total === answers.length
          && attempt.bandScores[level].correct === answers.filter((answer) => answer.correct).length
      })
      const currentSuggested = suggestedLevelForBands(attempt.bandScores, 'current')
      const legacySuggested = suggestedLevelForBands(attempt.bandScores, 'legacy')
      if (!bandsMatchStoredEvidence || (attempt.suggestedLevel !== currentSuggested && attempt.suggestedLevel !== legacySuggested)) context.addIssue({ code: 'custom', path: ['placementAttempts', index], message: 'Placement result does not match its stored diagnostic evidence.' })
    }
    if (attempt.listeningDiagnostic && new Date(attempt.listeningDiagnostic.completedAt).getTime() > new Date(attempt.completedAt).getTime()) context.addIssue({ code: 'custom', path: ['placementAttempts', index, 'listeningDiagnostic', 'completedAt'], message: 'Placement listening evidence cannot be completed after its enclosing saved attempt.' })
    if (index > 0 && new Date(attempt.completedAt).getTime() > new Date(data.placementAttempts[index - 1].completedAt).getTime()) context.addIssue({ code: 'custom', path: ['placementAttempts', index, 'completedAt'], message: 'Placement attempts must be ordered newest first.' })
  }
  if (data.placementAttempts.length > 0 && data.preferences.placementCompletedAt !== data.placementAttempts[0].completedAt) context.addIssue({ code: 'custom', path: ['preferences', 'placementCompletedAt'], message: 'The active placement timestamp must match the newest saved attempt.' })
  if (data.placementAttempts.length > 0) {
    const activeLevel = data.placementAttempts[0].suggestedLevel
    const expectedTarget = PLACEMENT_TARGET_LEVEL[activeLevel]
    if (data.preferences.currentLevel !== activeLevel || data.preferences.targetLevel !== expectedTarget) context.addIssue({ code: 'custom', path: ['preferences', 'currentLevel'], message: 'The active learning route must match the newest placement result.' })
  }
  if (data.placementAttempts.length === 0 && data.preferences.placementCompletedAt) context.addIssue({ code: 'custom', path: ['preferences', 'placementCompletedAt'], message: 'A placement timestamp requires a saved attempt.' })
  const savedPhraseIds = new Set(data.phrases.map((phrase) => phrase.id))
  const lessonIds = new Set<string>()
  for (const [index, progress] of data.grammarProgress.entries()) {
    if (lessonIds.has(progress.lessonId)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'lessonId'], message: `Duplicate grammar progress: ${progress.lessonId}` })
    lessonIds.add(progress.lessonId)
    if (progress.bestScore > progress.totalQuestions) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'bestScore'], message: 'Grammar score exceeds its question total.' })
    if (progress.passes > progress.attempts) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'passes'], message: 'Grammar passes exceed total attempts.' })
    if (progress.passes > 0 && !progress.lastPassedAt) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'lastPassedAt'], message: 'A successful grammar check requires its timestamp.' })
    if (progress.completedAt && (progress.passes < 2 || progress.masteryEvidenceVersion !== 3)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'completedAt'], message: 'Current grammar mastery requires two spaced checks and version 3 transfer evidence.' })
    if (progress.masteryEvidenceVersion === 3 && (!progress.completedAt || !progress.productionDraft?.trim() || !progress.productionSavedAt || !progress.productionSelfConfirmedAt || !progress.transferDraft?.trim() || !progress.transferSavedAt || !progress.transferSelfConfirmedAt || !progress.correctionPassedAt)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'masteryEvidenceVersion'], message: 'Current grammar mastery requires confirmed production, correction and delayed transfer evidence.' })
    if (progress.transferSavedAt && (!progress.productionSavedAt || new Date(progress.transferSavedAt).getTime() - new Date(progress.productionSavedAt).getTime() < 12 * 60 * 60 * 1000)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'transferSavedAt'], message: 'Grammar transfer evidence must be at least 12 hours after production.' })
    if (progress.productionTargetPhraseId && !savedPhraseIds.has(progress.productionTargetPhraseId)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'productionTargetPhraseId'], message: 'Grammar production target refers to a missing phrase.' })
    if (progress.transferTargetPhraseId && !savedPhraseIds.has(progress.transferTargetPhraseId)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'transferTargetPhraseId'], message: 'Grammar transfer target refers to a missing phrase.' })
    if ((progress.cumulativeCorrect ?? 0) > (progress.cumulativeAttempts ?? 0)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'cumulativeCorrect'], message: 'Correct cumulative grammar checks exceed attempts.' })
  }
})

const forgeDataV6Base = z.object({
  ...forgeDataV2Base.shape,
  schemaVersion: z.literal(6),
  dailyVocabularyAssignment: dailyVocabularyAssignmentSchema.nullable().default(null),
  dailyVocabularyAssignments: z.array(dailyVocabularyAssignmentSchema).max(DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT).default([]),
  listeningClips: z.array(listeningClipSchema),
  listeningAttempts: z.array(listeningAttemptV6Schema).max(10_000).default([]),
  placementAttempts: z.array(placementAttemptSchema).max(100),
  grammarProgress: z.array(grammarProgressV6Schema),
  preferences: preferencesV3Schema,
}).strict().superRefine((data, context) => {
  for (const [index, attempt] of data.listeningAttempts.entries()) {
    const comprehensionParts = [attempt.comprehensionQuestion, attempt.comprehensionResponse, attempt.comprehensionExpectedResponse, attempt.comprehensionMatched]
    const comprehensionStarted = comprehensionParts.some((value) => value !== undefined)
    const hasCurrentVersion = attempt.listeningEvidenceVersion === LISTENING_EVIDENCE_VERSION
    if (hasCurrentVersion) {
      if (attempt.playbackCompleted !== true) context.addIssue({ code: 'custom', path: ['listeningAttempts', index, 'playbackCompleted'], message: 'Current listening evidence requires completed playback.' })
      if (comprehensionStarted && comprehensionParts.some((value) => value === undefined)) context.addIssue({ code: 'custom', path: ['listeningAttempts', index], message: 'Current comprehension evidence requires question, response, expected-answer snapshot and result together.' })
      const derived = deriveListeningResults(attempt)
      if (attempt.answerMatched !== derived.answerMatched) context.addIssue({ code: 'custom', path: ['listeningAttempts', index, 'answerMatched'], message: 'Listening match must be recomputed from the response and reference snapshot.' })
      if (comprehensionStarted && attempt.comprehensionMatched !== derived.comprehensionMatched) context.addIssue({ code: 'custom', path: ['listeningAttempts', index, 'comprehensionMatched'], message: 'Comprehension match must be recomputed from the saved expected-answer snapshot.' })
    } else {
      if (attempt.answerMatched || attempt.comprehensionMatched === true || attempt.comprehensionExpectedResponse !== undefined) context.addIssue({ code: 'custom', path: ['listeningAttempts', index], message: 'Positive listening evidence requires a current recomputable evidence version.' })
    }
  }

  const placementQuestionById = new Map(PLACEMENT_QUESTIONS.map((question) => [question.id, question]))
  for (const [index, attempt] of data.placementAttempts.entries()) {
    if (attempt.questionSetVersion !== PLACEMENT_QUESTION_SET_VERSION) {
      if (attempt.legacyQuestionSet !== true) context.addIssue({ code: 'custom', path: ['placementAttempts', index], message: 'Placement evidence must identify either the current question set or an explicit legacy contract.' })
      continue
    }
    if (attempt.legacyQuestionSet) context.addIssue({ code: 'custom', path: ['placementAttempts', index], message: 'A placement attempt cannot be both current and legacy.' })
    const selected: Record<string, number> = {}
    let rawAnswersMatch = attempt.answers.length === placementQuestionById.size
    for (const answer of attempt.answers) {
      const question = placementQuestionById.get(answer.questionId)
      if (!question || answer.selectedIndex >= question.choices.length || answer.correct !== (answer.selectedIndex === question.correctIndex)) rawAnswersMatch = false
      selected[answer.questionId] = answer.selectedIndex
    }
    if (!rawAnswersMatch) {
      context.addIssue({ code: 'custom', path: ['placementAttempts', index, 'answers'], message: 'Current placement answers must match the versioned answer key.' })
      continue
    }
    const derived = scorePlacement(selected)
    const bandsMatch = (['A2', 'B1', 'B2', 'C1'] as const).every((level) => attempt.bandScores[level].correct === derived.bandScores[level].correct && attempt.bandScores[level].total === derived.bandScores[level].total)
    if (attempt.score !== derived.score || attempt.maxScore !== derived.maxScore || attempt.suggestedLevel !== derived.suggestedLevel || !bandsMatch) context.addIssue({ code: 'custom', path: ['placementAttempts', index], message: 'Current placement result must be recomputed from its versioned raw selections.' })
  }

  const phrasesById = new Map(data.phrases.map((phrase) => [phrase.id, phrase]))
  const grammarLessonById = new Map(grammarAcademyLessons.map((lesson) => [lesson.id, lesson]))
  for (const [index, progress] of data.grammarProgress.entries()) {
    const passHistory = progress.passHistory
    const passTimes = passHistory.map((value) => new Date(value).getTime())
    if (new Set(passHistory).size !== passHistory.length || passTimes.some((time, position) => position > 0 && time - passTimes[position - 1] < 12 * 60 * 60 * 1000)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'passHistory'], message: 'Grammar pass history must contain unique chronological checks spaced by at least 12 hours.' })
    if (progress.passes !== passHistory.length || progress.quizPassEvidence.length !== passHistory.length || progress.quizPassEvidence.some((evidence, position) => evidence.completedAt !== passHistory[position])) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'passes'], message: 'Grammar pass summaries must equal the versioned raw quiz evidence.' })
    if (progress.lastPassedAt !== passHistory.at(-1)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'lastPassedAt'], message: 'The last grammar pass timestamp must match persisted pass history.' })
    if (passTimes.length && new Date(progress.lastAttemptedAt).getTime() < passTimes.at(-1)!) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'lastAttemptedAt'], message: 'The latest grammar attempt cannot precede a successful pass.' })
    const lesson = grammarLessonById.get(progress.lessonId)
    for (const [evidenceIndex, evidence] of progress.quizPassEvidence.entries()) {
      const quiz = lesson ? grammarQuizForAttempt(lesson, evidence.attemptNumber) : undefined
      const score = quiz ? scoreGrammarQuizSelections(quiz, evidence.answers) : undefined
      if (evidence.evidenceVersion !== GRAMMAR_EVIDENCE_VERSION || evidence.attemptNumber >= progress.attempts || score === undefined || score / quiz!.length < 0.8) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'quizPassEvidence', evidenceIndex], message: 'Grammar pass evidence must match the versioned lesson answer key.' })
    }
    if (lesson) {
      const variants = progress.quizPassEvidence.map((evidence) => grammarQuizVariantKey(lesson, evidence.attemptNumber))
      if (new Set(variants).size !== variants.length) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'quizPassEvidence'], message: 'Grammar mastery checks must use distinct answer-choice layouts.' })
    }
    if (progress.correctionEvidence) {
      if (!lesson || progress.correctionEvidence.evidenceVersion !== GRAMMAR_EVIDENCE_VERSION || progress.correctionEvidence.completedAt !== progress.correctionPassedAt || !grammarCorrectionMatches(progress.correctionEvidence.response, lesson.commonMistake.correct)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'correctionEvidence'], message: 'Grammar correction evidence must match the versioned authored correction.' })
    } else if (progress.correctionPassedAt) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'correctionPassedAt'], message: 'Current grammar correction requires a versioned raw response.' })
    if (progress.transferCheckEvidence) {
      const transferQuiz = lesson ? grammarQuizForAttempt(lesson, progress.transferCheckEvidence.attemptNumber) : undefined
      const transferScore = transferQuiz ? scoreGrammarQuizSelections(transferQuiz, progress.transferCheckEvidence.answers) : undefined
      const transferCheckTime = new Date(progress.transferCheckEvidence.completedAt).getTime()
      const productionTime = progress.productionSavedAt ? new Date(progress.productionSavedAt).getTime() : undefined
      if (progress.transferCheckEvidence.evidenceVersion !== GRAMMAR_EVIDENCE_VERSION || transferScore !== transferQuiz?.length || productionTime === undefined || transferCheckTime - productionTime < 12 * 60 * 60 * 1000) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'transferCheckEvidence'], message: 'Grammar transfer check must be a delayed 3/3 result against the versioned lesson key.' })
    } else if (progress.masteryEvidenceVersion === 6) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'transferCheckEvidence'], message: 'Current grammar transfer requires a delayed controlled construction check.' })

    const productionWords = progress.productionDraft ? missionWordCount(progress.productionDraft) : 0
    const transferWords = progress.transferDraft ? missionWordCount(progress.transferDraft) : 0
    if (progress.productionDraft !== undefined && productionWords < 6) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'productionDraft'], message: 'Grammar production evidence must contain at least six words.' })
    if (progress.transferDraft !== undefined && transferWords < 6) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'transferDraft'], message: 'Grammar transfer evidence must contain at least six words.' })
    if (progress.productionDraft && progress.transferDraft && normalizePhrase(progress.productionDraft) === normalizePhrase(progress.transferDraft)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'transferDraft'], message: 'Grammar transfer evidence must be distinct from production.' })
    const lessonReferenceTexts = lesson ? [...lesson.examples, lesson.commonMistake.wrong, lesson.commonMistake.correct] : []
    if (lesson && progress.productionDraft !== undefined && !grammarDraftIsOriginal(progress.productionDraft, lessonReferenceTexts)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'productionDraft'], message: 'Grammar production evidence must be learner-authored rather than copied from the lesson.' })
    if (lesson && progress.transferDraft !== undefined && !grammarDraftIsOriginal(progress.transferDraft, lessonReferenceTexts)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'transferDraft'], message: 'Grammar transfer evidence must be learner-authored rather than copied from the lesson.' })

    const productionParts = [progress.productionDraft, progress.productionSavedAt, progress.productionSelfConfirmedAt]
    const transferParts = [progress.transferDraft, progress.transferSavedAt, progress.transferSelfConfirmedAt]
    const productionEvidenceStarted = progress.productionSavedAt !== undefined || progress.productionSelfConfirmedAt !== undefined
    const transferEvidenceStarted = progress.transferSavedAt !== undefined || progress.transferSelfConfirmedAt !== undefined
    if (productionEvidenceStarted && productionParts.some((value) => value === undefined)) context.addIssue({ code: 'custom', path: ['grammarProgress', index], message: 'Grammar production evidence requires draft, saved time and self-confirmation together.' })
    if (transferEvidenceStarted && transferParts.some((value) => value === undefined)) context.addIssue({ code: 'custom', path: ['grammarProgress', index], message: 'Grammar transfer evidence requires draft, saved time and self-confirmation together.' })
    if (progress.productionSavedAt && progress.productionSelfConfirmedAt !== progress.productionSavedAt) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'productionSelfConfirmedAt'], message: 'Grammar production self-confirmation must match its save time.' })
    if (progress.transferSavedAt && progress.transferSelfConfirmedAt !== progress.transferSavedAt) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'transferSelfConfirmedAt'], message: 'Grammar transfer self-confirmation must match its save time.' })

    if (progress.productionTargetPhraseId) {
      const target = phrasesById.get(progress.productionTargetPhraseId)
      if (!target || !progress.productionDraft || !includesPhrase(progress.productionDraft, target.canonical, target.acceptedForms)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'productionTargetPhraseId'], message: 'Grammar production must contain its persisted lexical target.' })
    }
    if (progress.transferTargetPhraseId) {
      const target = phrasesById.get(progress.transferTargetPhraseId)
      if (!target || !progress.transferDraft || !includesPhrase(progress.transferDraft, target.canonical, target.acceptedForms)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'transferTargetPhraseId'], message: 'Grammar transfer must contain its persisted lexical target.' })
    }

    const completionTime = progress.completedAt ? new Date(progress.completedAt).getTime() : undefined
    const evidenceTimes = [passTimes.at(-1), progress.productionSavedAt ? new Date(progress.productionSavedAt).getTime() : undefined, progress.transferSavedAt ? new Date(progress.transferSavedAt).getTime() : undefined, progress.transferCheckEvidence ? new Date(progress.transferCheckEvidence.completedAt).getTime() : undefined, progress.correctionPassedAt ? new Date(progress.correctionPassedAt).getTime() : undefined]
      .filter((value): value is number => value !== undefined)
    if (completionTime !== undefined && evidenceTimes.some((time) => time > completionTime)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'completedAt'], message: 'Grammar completion cannot precede any of its evidence.' })
    if (progress.completedAt && (progress.quizPassEvidence.length < 2 || progress.masteryEvidenceVersion !== 6)) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'completedAt'], message: 'Current grammar mastery requires two versioned raw checks and version 6 transfer-check evidence.' })
    if (progress.masteryEvidenceVersion === 6 && (!progress.completedAt || !progress.correctionEvidence || !progress.transferCheckEvidence || productionParts.some((value) => value === undefined) || transferParts.some((value) => value === undefined))) context.addIssue({ code: 'custom', path: ['grammarProgress', index, 'masteryEvidenceVersion'], message: 'Version 6 grammar mastery requires recomputable quiz, correction, production, delayed transfer and construction-check evidence.' })
  }
})

export const EMPTY_PHRASE_DEPTH: PhraseDepth = {
  grammarFrame: '', collocates: [], constraints: [], contrasts: [], connotation: '', pronunciationNote: '',
}

function suggestedLevelForBands(
  bands: Record<'A2' | 'B1' | 'B2' | 'C1', { correct: number; total: number }>,
  rules: 'legacy' | 'current',
) {
  const hasA2Foundation = bands.A2.correct >= (rules === 'legacy' ? 6 : 5)
  const hasB1ForUpperLevels = bands.B1.correct >= (rules === 'legacy' ? 6 : 5)
  if (hasA2Foundation && hasB1ForUpperLevels && bands.B2.correct >= 6 && bands.C1.correct >= 6) return 'C1' as const
  if (hasA2Foundation && hasB1ForUpperLevels && bands.B2.correct >= 6) return 'B2' as const
  if (hasA2Foundation && bands.B1.correct >= 6) return 'B1' as const
  return 'A2' as const
}

const PLACEMENT_TARGET_LEVEL: Record<CEFRLevel, CEFRLevel> = {
  A2: 'B1', B1: 'B2', B2: 'C1', C1: 'C1',
}

function newestPlacementFirst<T extends Pick<PlacementAttempt, 'completedAt'>>(attempts: readonly T[]): T[] {
  return [...attempts].sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime())
}

function normalizeLegacyPlacementOrder(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const profile = value as { placementAttempts?: unknown; preferences?: unknown }
  if (!Array.isArray(profile.placementAttempts)) return value
  const placementAttempts = [...profile.placementAttempts].sort((left, right) => {
    const completedAt = (entry: unknown) => entry && typeof entry === 'object' && typeof (entry as { completedAt?: unknown }).completedAt === 'string'
      ? new Date((entry as { completedAt: string }).completedAt).getTime()
      : Number.NEGATIVE_INFINITY
    return completedAt(right) - completedAt(left)
  })
  const active = placementAttempts[0]
  if (!active || typeof active !== 'object' || !profile.preferences || typeof profile.preferences !== 'object') return { ...value, placementAttempts }
  const { suggestedLevel, completedAt } = active as { suggestedLevel?: unknown; completedAt?: unknown }
  if (typeof completedAt !== 'string' || (suggestedLevel !== 'A2' && suggestedLevel !== 'B1' && suggestedLevel !== 'B2' && suggestedLevel !== 'C1')) return { ...value, placementAttempts }
  return {
    ...value,
    placementAttempts,
    preferences: {
      ...profile.preferences,
      currentLevel: suggestedLevel,
      targetLevel: PLACEMENT_TARGET_LEVEL[suggestedLevel],
      placementCompletedAt: completedAt,
    },
  }
}

function migrateV1(value: unknown) {
  const legacy = forgeDataV1Schema.parse(value)
  const spokenStates = legacy.phrases.map((phrase) => ({
    phraseId: phrase.id,
    skill: 'spoken_productive' as const,
    phase: 'new' as const,
    mastery: 0,
    ease: 2.3,
    intervalDays: 0,
    learningStep: 0,
    dueAt: phrase.updatedAt,
    attempts: 0,
    firstTrySuccesses: 0,
    lapses: 0,
    consecutiveSuccesses: 0,
    transferPasses: 0,
  }))
  return {
    schemaVersion: 2,
    phrases: legacy.phrases.map((phrase) => ({ ...phrase, depth: structuredClone(EMPTY_PHRASE_DEPTH) })),
    skillStates: [...legacy.skillStates, ...spokenStates],
    reviews: legacy.reviews,
    errors: legacy.errors,
    missions: legacy.missions,
    speakingAttempts: [],
    listeningClips: [],
    preferences: { ...legacy.preferences, keepRecordings: 'forever' },
  }
}

function migrateV2(value: unknown) {
  const legacy = forgeDataV2Schema.parse(value)
  return {
    ...legacy,
    schemaVersion: 3,
    placementAttempts: [],
    grammarProgress: [],
    preferences: {
      ...legacy.preferences,
      currentLevel: 'A2',
      targetLevel: 'B1',
    },
  }
}

function migrateV3(value: unknown) {
  const legacy = forgeDataV3Schema.parse(value)
  const placementAttempts = newestPlacementFirst(legacy.placementAttempts.flatMap((attempt) => {
    const expectedIds = new Set(PLACEMENT_QUESTION_IDS)
    const answerIds = attempt.answers.map((answer) => answer.questionId)
    const exactQuestionSet = answerIds.length === expectedIds.size && answerIds.every((id) => expectedIds.has(id)) && new Set(answerIds).size === answerIds.length
    if (!exactQuestionSet) return []
    const questionLevels = PLACEMENT_QUESTION_LEVELS
    const bandScores = Object.fromEntries((['A2', 'B1', 'B2', 'C1'] as const).map((level) => {
      const answers = attempt.answers.filter((answer) => questionLevels.get(answer.questionId) === level)
      return [level, { correct: answers.filter((answer) => answer.correct).length, total: answers.length }]
    })) as typeof attempt.bandScores
    const supportedLevel = attempt.suggestedLevel === suggestedLevelForBands(bandScores, 'legacy')
      || attempt.suggestedLevel === suggestedLevelForBands(bandScores, 'current')
    return [{
      ...attempt,
      answers: attempt.answers.map((answer) => ({ ...answer })),
      score: attempt.answers.filter((answer) => answer.correct).length,
      maxScore: attempt.answers.length,
      suggestedLevel: supportedLevel ? attempt.suggestedLevel : suggestedLevelForBands(bandScores, 'legacy'),
      bandScores,
      legacyQuestionSet: true as const,
    }]
  }))
  const activePlacement = placementAttempts[0]
  const currentLevel = activePlacement?.suggestedLevel ?? 'A2'
  const targetLevel = PLACEMENT_TARGET_LEVEL[currentLevel]

  return {
    ...legacy,
    schemaVersion: 4,
    dailyVocabularyAssignment: null,
    dailyVocabularyAssignments: [],
    listeningAttempts: [],
    placementAttempts,
    grammarProgress: legacy.grammarProgress.map((progress) => {
      const passedPreviously = progress.bestScore / progress.totalQuestions >= 0.8
      const inferredPasses = passedPreviously ? 1 : 0
      const passes = Math.max(progress.completedAt ? 2 : 0, progress.passes ?? inferredPasses)
      const { completedAt, ...preserved } = progress
      return {
        ...preserved,
        attempts: Math.max(progress.attempts, passes),
        passes,
        lastPassedAt: passes > 0 ? progress.lastPassedAt ?? progress.lastAttemptedAt : undefined,
        legacyCompletedAt: completedAt,
      }
    }),
    preferences: {
      ...legacy.preferences,
      keepRecordings: 'forever' as const,
      currentLevel,
      targetLevel,
      placementCompletedAt: activePlacement?.completedAt,
    },
  }
}

function migrateV4(value: unknown) {
  const legacy = forgeDataV4Schema.parse(normalizeLegacyPlacementOrder(normalizeUnsupportedRetention(value)))
  return {
    ...legacy,
    schemaVersion: 5 as const,
    listeningClips: legacy.listeningClips.map((clip) => clip.durationSeconds > 300
      ? {
          ...clip,
          durationSeconds: 300,
          quarantine: {
            reason: 'duration_limit' as const,
            originalDurationSeconds: clip.durationSeconds,
          },
        }
      : clip),
  }
}

function parseV5(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Profile data must be an object.')
  const candidate = value as { listeningClips?: unknown }
  const listeningClips = z.array(listeningClipSchema).parse(candidate.listeningClips)
  // Reuse every V4 relational invariant after projecting the new quarantine
  // metadata out of the legacy-compatible view.
  const compatible = {
    ...value,
    schemaVersion: 4,
    listeningClips: listeningClips.map(({ quarantine: _quarantine, ...clip }) => clip),
  }
  const validated = forgeDataV4Schema.parse(normalizeLegacyPlacementOrder(compatible))
  return { ...validated, schemaVersion: 5, listeningClips }
}

function migrateV5(value: unknown) {
  const legacy = parseV5(normalizeUnsupportedRetention(value))
  return {
    ...legacy,
    schemaVersion: 6 as const,
    placementAttempts: legacy.placementAttempts.map((attempt) => ({ ...attempt, legacyQuestionSet: true as const })),
    listeningAttempts: legacy.listeningAttempts.map((attempt) => {
      const hasComprehension = [attempt.comprehensionQuestion, attempt.comprehensionResponse, attempt.comprehensionMatched].some((part) => part !== undefined)
      if (hasComprehension) return {
        ...attempt,
        answerMatched: false,
        comprehensionMatched: false,
        legacyComprehensionMatched: attempt.comprehensionMatched,
      }
      if (attempt.playbackCompleted !== true) return { ...attempt, answerMatched: false }
      return {
        ...attempt,
        answerMatched: deriveListeningResults(attempt).answerMatched,
        listeningEvidenceVersion: LISTENING_EVIDENCE_VERSION,
      }
    }),
    grammarProgress: legacy.grammarProgress.map((progress) => {
      const { completedAt, lastPassedAt, correctionPassedAt, masteryEvidenceVersion: _masteryEvidenceVersion, ...preserved } = progress
      const phrasesById = new Map(legacy.phrases.map((phrase) => [phrase.id, phrase]))
      const productionTarget = progress.productionTargetPhraseId ? phrasesById.get(progress.productionTargetPhraseId) : undefined
      const transferTarget = progress.transferTargetPhraseId ? phrasesById.get(progress.transferTargetPhraseId) : undefined
      const productionValid = Boolean(
        progress.productionDraft
        && missionWordCount(progress.productionDraft) >= 6
        && progress.productionSavedAt
        && progress.productionSelfConfirmedAt === progress.productionSavedAt
        && (!progress.productionTargetPhraseId || (productionTarget && includesPhrase(progress.productionDraft, productionTarget.canonical, productionTarget.acceptedForms))),
      )
      const transferValid = Boolean(
        productionValid
        && progress.transferDraft
        && missionWordCount(progress.transferDraft) >= 6
        && progress.transferSavedAt
        && progress.transferSelfConfirmedAt === progress.transferSavedAt
        && normalizePhrase(progress.transferDraft) !== normalizePhrase(progress.productionDraft ?? '')
        && (!progress.transferTargetPhraseId || (transferTarget && includesPhrase(progress.transferDraft, transferTarget.canonical, transferTarget.acceptedForms))),
      )
      const migrated = {
        ...preserved,
        attempts: Math.max(progress.attempts, 0),
        passes: 0,
        passHistory: [],
        legacyPasses: Math.max(progress.legacyCompletedAt ? 2 : 0, progress.passes),
        legacyLastPassedAt: lastPassedAt,
        legacyCorrectionPassedAt: correctionPassedAt,
        legacyCompletedAt: progress.legacyCompletedAt ?? completedAt,
      }
      if (!productionValid) {
        delete migrated.productionSavedAt
        delete migrated.productionSelfConfirmedAt
        delete migrated.productionTargetPhraseId
      }
      if (!transferValid) {
        delete migrated.transferSavedAt
        delete migrated.transferSelfConfirmedAt
        delete migrated.transferTargetPhraseId
      }
      return migrated
    }),
  }
}

function parseV6(value: unknown): ForgeData {
  const candidate = forgeDataV6Base.parse(value)
  const compatible = {
    ...candidate,
    schemaVersion: 4 as const,
    listeningClips: candidate.listeningClips.map(({ quarantine: _quarantine, ...clip }) => clip),
    listeningAttempts: candidate.listeningAttempts.map((attempt) => {
      const { comprehensionExpectedResponse: _expected, legacyComprehensionMatched: _legacy, listeningEvidenceVersion: _version, ...compatibleAttempt } = attempt
      return compatibleAttempt
    }),
    grammarProgress: candidate.grammarProgress.map((progress) => {
      const {
        passHistory: _history, quizPassEvidence: _quizEvidence,
        legacyPasses: _legacyPasses, legacyLastPassedAt: _legacyLast,
        correctionEvidence: _correctionEvidence, legacyCorrectionPassedAt: _legacyCorrection,
        transferCheckEvidence: _transferCheckEvidence,
        masteryEvidenceVersion, ...compatibleProgress
      } = progress
      return { ...compatibleProgress, masteryEvidenceVersion: masteryEvidenceVersion === 4 || masteryEvidenceVersion === 5 || masteryEvidenceVersion === 6 ? 3 as const : masteryEvidenceVersion }
    }),
  }
  forgeDataV4Schema.parse(compatible)
  return candidate
}

function sanitizeImportedEvidence(data: ForgeData): ForgeData {
  const errors = data.errors.map((error) => deriveErrorEvidence(error).pattern)
  const speakingAttempts = data.speakingAttempts.map((attempt) => ({
    ...attempt,
    evidenceEligiblePhraseIds: (attempt.evidenceEligiblePhraseIds ?? []).filter((phraseId) => {
      const phrase = data.phrases.find((candidate) => candidate.id === phraseId)
      return Boolean(phrase && hasQualifiedActivationThrough(phrase, 6, new Date(attempt.createdAt)))
    }),
  }))
  let phrasesChanged = false
  const phrases = data.phrases.map((phrase) => {
    const originalStage = phrase.activationStage ?? 0
    const qualifiedStage = qualifiedActivationStageAt(phrase)
    // Every activation summary is derived from the append-only stage chain.
    // A reference-only card therefore cannot import stage 5, add an error
    // pair later, and silently skip the learning route.
    let maximumCurrentStage = canEnterActivationStepSix(phrase) && qualifiedStage >= 6 ? 6 : Math.min(qualifiedStage, 5)
    const stageSeven = speakingAttempts
      .filter((attempt) => attempt.evidenceEligiblePhraseIds?.includes(phrase.id))
      .filter((attempt) => speakingEvidencePhraseIds(attempt, data.phrases).includes(phrase.id))
      .find((attempt) => (phrase.activationEvents ?? []).some((event) => event.stage === 7 && event.evidenceId === attempt.id && event.completedAt === attempt.createdAt))
    if (maximumCurrentStage >= 6 && stageSeven) maximumCurrentStage = 7
    const stageSevenAt = stageSeven ? new Date(stageSeven.createdAt).getTime() : undefined
    const stageEight = stageSevenAt === undefined ? undefined : (phrase.activationEvents ?? []).find((event) => {
      if (event.stage !== 8 || !event.evidenceId) return false
      const review = data.reviews.find((candidate) => candidate.id === event.evidenceId)
      return Boolean(review
        && isIndependentWrittenProductiveEvidence(review, phrase, data.reviews, new Date(event.completedAt))
        && review.reviewedAt === event.completedAt
        && new Date(review.reviewedAt).getTime() - stageSevenAt >= 12 * 60 * 60 * 1000)
    })
    if (maximumCurrentStage >= 7 && stageEight) maximumCurrentStage = 8
    const nextStage = Math.min(originalStage, maximumCurrentStage)
    if (nextStage === originalStage) return phrase
    phrasesChanged = true
    const lastValidEvent = [...(phrase.activationEvents ?? [])]
      .filter((event) => event.stage <= nextStage)
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0]
    return {
      ...phrase,
      activationStage: nextStage,
      legacyActivationStage: Math.max(phrase.legacyActivationStage ?? 0, originalStage),
      activationUpdatedAt: lastValidEvent?.completedAt ?? phrase.updatedAt,
      status: phrase.status === 'archived' || phrase.status === 'needs_enrichment'
        ? phrase.status
        : nextStage > 0 ? 'learning' as const : 'new' as const,
    }
  })
  const missions = data.missions.map((mission) => !mission.legacyContract && !missionTargetsWereEligibleAt(mission, phrases, data.reviews)
    ? { ...mission, legacyContract: true as const }
    : mission)
  const skillStates = rebuildSkillStates({ ...data, phrases, speakingAttempts })
  const speakingChanged = speakingAttempts.some((attempt, index) => {
    const before = data.speakingAttempts[index].evidenceEligiblePhraseIds ?? []
    const after = attempt.evidenceEligiblePhraseIds ?? []
    return before.length !== after.length || before.some((id, position) => id !== after[position])
  })
  const errorsChanged = errors.some((error, index) => {
    const before = data.errors[index]
    return JSON.stringify(error) !== JSON.stringify(before)
  })
  const missionsChanged = missions.some((mission, index) => mission !== data.missions[index])
  const skillStatesChanged = skillStates.length !== data.skillStates.length || skillStates.some((state, index) => {
    const before = data.skillStates[index]
    return !before || Object.keys(state).some((key) => state[key as keyof typeof state] !== before[key as keyof typeof before])
  })
  return !phrasesChanged && !speakingChanged && !errorsChanged && !missionsChanged && !skillStatesChanged
    ? data
    : { ...data, phrases, skillStates, speakingAttempts, errors, missions }
}

function formatValidationError(error: z.ZodError): Error {
  const issue = error.issues[0]
  const location = issue.path.length ? ` at ${issue.path.join('.')}` : ''
  return new Error(`${issue.message}${location}`)
}

function normalizeUnsupportedRetention(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const profile = value as { preferences?: unknown; grammarProgress?: unknown }
  const preferences = profile.preferences
  if (!preferences || typeof preferences !== 'object') return value
  const grammarProgress = Array.isArray(profile.grammarProgress) ? profile.grammarProgress.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const progress = entry as { completedAt?: unknown; legacyCompletedAt?: unknown; masteryEvidenceVersion?: unknown }
    if (typeof progress.completedAt !== 'string' || progress.masteryEvidenceVersion === 3 || progress.masteryEvidenceVersion === 4) return entry
    const { completedAt, ...preserved } = progress
    return { ...preserved, legacyCompletedAt: typeof progress.legacyCompletedAt === 'string' ? progress.legacyCompletedAt : completedAt }
  }) : profile.grammarProgress
  return { ...value, grammarProgress, preferences: { ...preferences, keepRecordings: 'forever' } }
}

function quarantineRetiredGeneratedB1(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const profile = value as { phrases?: unknown; skillStates?: unknown; reviews?: unknown; missions?: unknown; speakingAttempts?: unknown }
  if (!Array.isArray(profile.phrases) || !Array.isArray(profile.skillStates)) return value
  const evidencePhraseIds = new Set<string>()
  if (Array.isArray(profile.reviews)) for (const review of profile.reviews) if (review && typeof review === 'object' && typeof (review as { targetId?: unknown }).targetId === 'string') evidencePhraseIds.add((review as { targetId: string }).targetId)
  if (Array.isArray(profile.missions)) for (const mission of profile.missions) if (mission && typeof mission === 'object' && Array.isArray((mission as { targetPhraseIds?: unknown }).targetPhraseIds)) for (const id of (mission as { targetPhraseIds: unknown[] }).targetPhraseIds) if (typeof id === 'string') evidencePhraseIds.add(id)
  if (Array.isArray(profile.speakingAttempts)) for (const attempt of profile.speakingAttempts) if (attempt && typeof attempt === 'object' && Array.isArray((attempt as { targetPhraseIds?: unknown }).targetPhraseIds)) for (const id of (attempt as { targetPhraseIds: unknown[] }).targetPhraseIds) if (typeof id === 'string') evidencePhraseIds.add(id)
  const retiredPhraseIds = new Set<string>()
  const phrases = profile.phrases.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const phrase = entry as { id?: unknown; tags?: unknown; status?: unknown; archivedAt?: unknown; createdAt?: unknown; updatedAt?: unknown; note?: unknown; activationStage?: unknown }
    const retired = Array.isArray(phrase.tags) && phrase.tags.some((tag) => typeof tag === 'string' && tag.startsWith('catalog-item:lex-b1-x'))
    if (!retired || typeof phrase.id !== 'string') return entry
    const retirementNote = 'Retired from the reviewed course because its source used a mechanical B1 example generator; preserved locally for backup and manual reference.'
    const learnerEvidence = evidencePhraseIds.has(phrase.id) || (typeof phrase.activationStage === 'number' && phrase.activationStage > 0) || (typeof phrase.createdAt === 'string' && typeof phrase.updatedAt === 'string' && phrase.createdAt !== phrase.updatedAt)
    if (learnerEvidence) return {
      ...phrase,
      note: typeof phrase.note === 'string' && phrase.note.includes(retirementNote) ? phrase.note : [phrase.note, retirementNote, 'Kept in practice because learner evidence or edits exist; review the content manually.'].filter(Boolean).join(' · '),
    }
    retiredPhraseIds.add(phrase.id)
    return {
      ...phrase,
      status: 'archived',
      archivedAt: typeof phrase.archivedAt === 'string' ? phrase.archivedAt : phrase.updatedAt,
      note: typeof phrase.note === 'string' && phrase.note.includes(retirementNote) ? phrase.note : [phrase.note, retirementNote].filter(Boolean).join(' · '),
    }
  })
  if (!retiredPhraseIds.size) return value
  const skillStates = profile.skillStates.map((entry) => entry && typeof entry === 'object' && retiredPhraseIds.has(String((entry as { phraseId?: unknown }).phraseId))
    ? { ...entry, phase: 'suspended' }
    : entry)
  return { ...value, phrases, skillStates }
}

function normalizeLegacyMissionConstraints(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const profile = value as { missions?: unknown; phrases?: unknown; preferences?: unknown }
  if (!Array.isArray(profile.missions)) return value
  const phraseLevels = new Map<string, CEFRLevel>()
  if (Array.isArray(profile.phrases)) for (const entry of profile.phrases) {
    if (!entry || typeof entry !== 'object') continue
    const phrase = entry as { id?: unknown; cefr?: unknown }
    if (typeof phrase.id === 'string' && ['A2', 'B1', 'B2', 'C1'].includes(String(phrase.cefr))) phraseLevels.set(phrase.id, phrase.cefr as CEFRLevel)
  }
  const preferredLevel = profile.preferences && typeof profile.preferences === 'object' && ['A2', 'B1', 'B2', 'C1'].includes(String((profile.preferences as { currentLevel?: unknown }).currentLevel))
    ? (profile.preferences as { currentLevel: CEFRLevel }).currentLevel
    : 'B2'
  const missions = profile.missions.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const mission = entry as { level?: unknown; minWords?: unknown; maxWords?: unknown; targetPhraseCount?: unknown; targetPhraseIds?: unknown; supportUsed?: unknown; status?: unknown; response?: unknown; selfConfirmedAt?: unknown }
    const hadPersistedLevel = ['A2', 'B1', 'B2', 'C1'].includes(String(mission.level))
    const targetLevels = Array.isArray(mission.targetPhraseIds)
      ? [...new Set(mission.targetPhraseIds.map((id) => typeof id === 'string' ? phraseLevels.get(id) : undefined).filter((level): level is CEFRLevel => Boolean(level)))]
      : []
    const legacyMixed = !hadPersistedLevel && targetLevels.length > 1
    const level = hadPersistedLevel ? mission.level as CEFRLevel : targetLevels.length === 1 ? targetLevels[0] : preferredLevel
    const requirements = missionRequirementsForLevel(level)
    const missingCurrentContract = !hadPersistedLevel
      || mission.minWords === undefined
      || mission.maxWords === undefined
      || mission.targetPhraseCount === undefined
      || mission.supportUsed === undefined
      || (mission.status === 'done' && (typeof mission.response !== 'string' || !mission.response.trim() || typeof mission.selfConfirmedAt !== 'string'))
    return {
      ...mission,
      level,
      minWords: mission.minWords === undefined ? requirements.minWords : mission.minWords,
      maxWords: mission.maxWords === undefined ? requirements.maxWords : mission.maxWords,
      targetPhraseCount: mission.targetPhraseCount === undefined && Array.isArray(mission.targetPhraseIds) ? mission.targetPhraseIds.length : mission.targetPhraseCount,
      ...(missingCurrentContract || legacyMixed ? { legacyContract: true } : {}),
    }
  })
  return { ...value, missions }
}

function normalizeEarlyV6PlacementAttempt(entry: unknown): unknown | undefined {
  if (!entry || typeof entry !== 'object') return entry
  const attempt = entry as Record<string, unknown>
  if (attempt.questionSetVersion === PLACEMENT_QUESTION_SET_VERSION || attempt.legacyQuestionSet === true) return entry
  // Unknown explicit versions are not compatibility records: leave them intact
  // so the strict V6 schema rejects them. Only the early-V6 shape, which had no
  // contract marker at all, is eligible for deterministic repair.
  if (attempt.questionSetVersion !== undefined || attempt.legacyQuestionSet !== undefined) return entry
  if (!Array.isArray(attempt.answers) || attempt.answers.length !== PLACEMENT_QUESTIONS.length) return undefined

  const questionsById = new Map(PLACEMENT_QUESTIONS.map((question) => [question.id, question]))
  const selected: Record<string, number> = {}
  const answers: Array<{ questionId: string; selectedIndex: number; correct: boolean }> = []
  for (const entryAnswer of attempt.answers) {
    if (!entryAnswer || typeof entryAnswer !== 'object') return undefined
    const answer = entryAnswer as Record<string, unknown>
    if (Object.keys(answer).some((key) => !['questionId', 'selectedIndex', 'correct'].includes(key))) return undefined
    if (typeof answer.questionId !== 'string' || !Number.isInteger(answer.selectedIndex) || typeof answer.correct !== 'boolean') return undefined
    const question = questionsById.get(answer.questionId)
    const selectedIndex = answer.selectedIndex as number
    if (!question || selected[answer.questionId] !== undefined || selectedIndex < 0 || selectedIndex >= question.choices.length) return undefined
    selected[answer.questionId] = selectedIndex
    answers.push({ questionId: answer.questionId, selectedIndex, correct: selectedIndex === question.correctIndex })
  }
  if (Object.keys(selected).length !== PLACEMENT_QUESTIONS.length) return undefined

  const derived = scorePlacement(selected)
  return {
    ...attempt,
    questionSetVersion: PLACEMENT_QUESTION_SET_VERSION,
    answers,
    score: derived.score,
    maxScore: derived.maxScore,
    suggestedLevel: derived.suggestedLevel,
    bandScores: derived.bandScores,
  }
}

function normalizeMissingV6EvidenceContracts(value: unknown): unknown {
  if (!value || typeof value !== 'object' || (value as { schemaVersion?: unknown }).schemaVersion !== 6) return value
  const profile = value as { placementAttempts?: unknown; grammarProgress?: unknown; listeningAttempts?: unknown; preferences?: unknown }
  const hasEarlyV6Placement = Array.isArray(profile.placementAttempts) && profile.placementAttempts.some((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const attempt = entry as { questionSetVersion?: unknown; legacyQuestionSet?: unknown }
    return attempt.questionSetVersion === undefined && attempt.legacyQuestionSet === undefined
  })
  const placementAttempts = Array.isArray(profile.placementAttempts)
    ? (hasEarlyV6Placement
        ? profile.placementAttempts
          .map(normalizeEarlyV6PlacementAttempt)
          .filter((entry): entry is Exclude<typeof entry, undefined> => entry !== undefined)
          .sort((left, right) => {
            const leftTime = left && typeof left === 'object' && typeof (left as { completedAt?: unknown }).completedAt === 'string' ? new Date((left as { completedAt: string }).completedAt).getTime() : Number.NEGATIVE_INFINITY
            const rightTime = right && typeof right === 'object' && typeof (right as { completedAt?: unknown }).completedAt === 'string' ? new Date((right as { completedAt: string }).completedAt).getTime() : Number.NEGATIVE_INFINITY
            return rightTime - leftTime
          })
        : profile.placementAttempts)
    : profile.placementAttempts
  const grammarProgress = Array.isArray(profile.grammarProgress) ? profile.grammarProgress.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const progress = entry as {
      passes?: unknown; passHistory?: unknown; quizPassEvidence?: unknown; lastPassedAt?: unknown
      legacyPasses?: unknown; legacyLastPassedAt?: unknown; correctionPassedAt?: unknown
      correctionEvidence?: unknown; legacyCorrectionPassedAt?: unknown; completedAt?: unknown
      legacyCompletedAt?: unknown; masteryEvidenceVersion?: unknown; transferCheckEvidence?: unknown
    }
    if (progress.masteryEvidenceVersion === 5) {
      const {
        completedAt, masteryEvidenceVersion: _masteryEvidenceVersion,
        ...preserved
      } = progress
      return {
        ...preserved,
        ...(typeof completedAt === 'string'
          ? { legacyCompletedAt: typeof progress.legacyCompletedAt === 'string' ? progress.legacyCompletedAt : completedAt }
          : {}),
      }
    }
    const rawPassesPresent = Array.isArray(progress.quizPassEvidence)
      && Array.isArray(progress.passHistory)
      && progress.quizPassEvidence.length === progress.passHistory.length
    const rawCorrectionPresent = progress.correctionPassedAt === undefined || Boolean(progress.correctionEvidence)
    // Version 6 and explicitly versioned raw fields were produced by the
    // current contract. Leave them untouched so malformed/tampered evidence
    // is rejected by the V6 refinements below. Version 5 completion predates
    // the delayed construction check and is retained only as legacy history.
    const explicitlyCurrent = progress.masteryEvidenceVersion === 6
      || progress.quizPassEvidence !== undefined
      || progress.correctionEvidence !== undefined
      || progress.transferCheckEvidence !== undefined
    if (explicitlyCurrent) return entry
    if (rawPassesPresent && rawCorrectionPresent && progress.completedAt === undefined) return entry
    const {
      passes, passHistory, quizPassEvidence, lastPassedAt,
      correctionPassedAt, correctionEvidence,
      completedAt, masteryEvidenceVersion: _masteryEvidenceVersion,
      ...preserved
    } = progress
    return {
      ...preserved,
      passes: rawPassesPresent ? passes : 0,
      passHistory: rawPassesPresent ? passHistory : [],
      quizPassEvidence: rawPassesPresent ? quizPassEvidence : [],
      ...(rawPassesPresent && lastPassedAt !== undefined ? { lastPassedAt } : {}),
      legacyPasses: Math.max(typeof progress.legacyPasses === 'number' ? progress.legacyPasses : 0, typeof passes === 'number' ? passes : 0),
      legacyLastPassedAt: typeof progress.legacyLastPassedAt === 'string' ? progress.legacyLastPassedAt : typeof lastPassedAt === 'string' ? lastPassedAt : undefined,
      ...(rawCorrectionPresent && correctionPassedAt !== undefined ? { correctionPassedAt, correctionEvidence } : {}),
      ...(!rawCorrectionPresent && typeof correctionPassedAt === 'string' ? { legacyCorrectionPassedAt: typeof progress.legacyCorrectionPassedAt === 'string' ? progress.legacyCorrectionPassedAt : correctionPassedAt } : {}),
      ...(typeof completedAt === 'string' ? { legacyCompletedAt: typeof progress.legacyCompletedAt === 'string' ? progress.legacyCompletedAt : completedAt } : {}),
    }
  }) : profile.grammarProgress
  const listeningAttempts = Array.isArray(profile.listeningAttempts) ? profile.listeningAttempts.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const attempt = entry as Record<string, unknown>
    // Explicit or partially current contracts must pass the strict validator;
    // compatibility applies only to the original unversioned V6 shape.
    if (attempt.listeningEvidenceVersion !== undefined || attempt.comprehensionExpectedResponse !== undefined) return entry
    const hasLegacyComprehension = [attempt.comprehensionQuestion, attempt.comprehensionResponse, attempt.comprehensionMatched]
      .some((part) => part !== undefined)
    if (hasLegacyComprehension) return {
      ...attempt,
      answerMatched: false,
      comprehensionMatched: false,
      ...(typeof attempt.comprehensionMatched === 'boolean' ? { legacyComprehensionMatched: attempt.comprehensionMatched } : {}),
    }
    if (attempt.playbackCompleted !== true) return { ...attempt, answerMatched: false }
    const derived = deriveListeningResults(attempt as Parameters<typeof deriveListeningResults>[0])
    return { ...attempt, answerMatched: derived.answerMatched, listeningEvidenceVersion: LISTENING_EVIDENCE_VERSION }
  }) : profile.listeningAttempts
  let preferences = profile.preferences
  if (hasEarlyV6Placement && preferences && typeof preferences === 'object' && Array.isArray(placementAttempts)) {
    const active = placementAttempts[0]
    if (active && typeof active === 'object') {
      const { suggestedLevel, completedAt } = active as { suggestedLevel?: unknown; completedAt?: unknown }
      if (typeof completedAt === 'string' && (suggestedLevel === 'A2' || suggestedLevel === 'B1' || suggestedLevel === 'B2' || suggestedLevel === 'C1')) {
        preferences = {
          ...preferences,
          currentLevel: suggestedLevel,
          targetLevel: PLACEMENT_TARGET_LEVEL[suggestedLevel],
          placementCompletedAt: completedAt,
        }
      }
    } else {
      const { placementCompletedAt: _placementCompletedAt, ...preserved } = preferences as Record<string, unknown>
      preferences = { ...preserved, currentLevel: 'A2', targetLevel: 'B1' }
    }
  }
  return { ...value, placementAttempts, grammarProgress, listeningAttempts, preferences }
}

export function validateForgeData(value: unknown): ForgeData {
  if (!value || typeof value !== 'object' || !('schemaVersion' in value)) throw new Error('Profile schemaVersion is missing.')
  const normalized = normalizeLegacyMissionConstraints(normalizeMissingV6EvidenceContracts(value))
  const version = (normalized as { schemaVersion?: unknown }).schemaVersion
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6) throw new Error('Unsupported profile version. This build accepts schema versions 1, 2, 3, 4, 5 and 6.')
  try {
    const migrated = version === 1
      ? migrateV5(migrateV4(migrateV3(migrateV2(migrateV1(normalized)))))
      : version === 2
        ? migrateV5(migrateV4(migrateV3(migrateV2(normalized))))
        : version === 3
          ? migrateV5(migrateV4(migrateV3(normalized)))
          : version === 4
            ? migrateV5(migrateV4(normalized))
            : version === 5
              ? migrateV5(normalized)
              : normalized
    const candidate = quarantineRetiredGeneratedB1(migrated)
    const parsed = parseV6(candidate)
    return migrateCatalogIdentityProfile(sanitizeImportedEvidence(parsed))
  } catch (error) {
    if (error instanceof z.ZodError) throw formatValidationError(error)
    throw error
  }
}

export function parseForgeJson(text: string): ForgeData {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) throw new Error('Import is larger than the 9 MB profile-data safety limit.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('This is not valid JSON.') }
  return validateForgeData(value)
}

export function exportJson(data: ForgeData): string {
  const exported = JSON.stringify(validateForgeData(data))
  if (new Blob([exported]).size > MAX_IMPORT_BYTES) throw new Error('Profile data is larger than the 9 MB portable-backup limit.')
  return exported
}

function safeCsvCell(value: string): string {
  // Spreadsheet applications may ignore leading spaces/control characters
  // before a formula marker. Prefix the complete cell with an apostrophe so a
  // user-authored phrase can never execute as a CSV formula on export.
  const protectedValue = /^[\t\r\n ]*[=+@-]/.test(value) ? `'${value}` : value
  return `"${protectedValue.replace(/"/g, '""')}"`
}

export function exportPhrasesCsv(data: ForgeData): string {
  const header = ['phrase', 'meaning', 'context', 'source', 'tags', 'status', 'created_at']
  const rows = data.phrases.map((phrase) => [phrase.canonical, phrase.meaning, phrase.context, phrase.source, phrase.tags.join('; '), derivePhraseStatus(data, phrase), phrase.createdAt])
  return [header, ...rows].map((row) => row.map((cell) => safeCsvCell(String(cell))).join(',')).join('\r\n')
}

export function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
