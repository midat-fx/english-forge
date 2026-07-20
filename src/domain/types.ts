import type { ActivationErrorSpec } from './activationErrorMetadata'
import type { PlacementListeningDiagnostic } from './placementListening'

export type PhraseKind =
  | 'word'
  | 'collocation'
  | 'phrasal_verb'
  | 'idiom'
  | 'discourse_marker'
  | 'grammar_frame'
  | 'register_formula'

export type CEFRLevel = 'A2' | 'B1' | 'B2' | 'C1'
export type PhraseStatus = 'needs_enrichment' | 'new' | 'learning' | 'active' | 'retained' | 'archived'
export type Register = 'neutral' | 'formal' | 'informal' | 'academic' | 'spoken'
export type Skill = 'meaning_recall' | 'cloze' | 'written_productive' | 'spoken_productive' | 'grammar_repair'
export type Phase = 'new' | 'learning' | 'review' | 'relearning' | 'suspended'
export type Grade = 0 | 1 | 2 | 3
export type ExerciseType = 'meaning_to_chunk' | 'cloze_chunk' | 'constrained_sentence' | 'spoken_response' | 'past_error_replay'

export interface Example {
  id: string
  text: string
  source?: string
}

export interface PhraseContrast {
  alternative: string
  distinction: string
}

export interface PhraseDepth {
  grammarFrame: string
  collocates: string[]
  constraints: string[]
  contrasts: PhraseContrast[]
  connotation: string
  pronunciationNote: string
}

export interface Phrase {
  id: string
  canonical: string
  normalizedKey: string
  meaning: string
  kind: PhraseKind
  cefr: CEFRLevel | 'C2'
  register: Register[]
  context: string
  source: string
  tags: string[]
  note: string
  acceptedForms: string[]
  examples: Example[]
  depth: PhraseDepth
  status: PhraseStatus
  createdAt: string
  updatedAt: string
  archivedAt?: string
  activationStage?: number
  /** Pre-contract summary retained as read-only history after fail-closed import. */
  legacyActivationStage?: number
  activationUpdatedAt?: string
  /** Evidence before this content revision remains history but cannot count toward the current phrase. */
  evidenceResetAt?: string
  activationEvents?: {
    stage: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
    completedAt: string
    evidenceId?: string
    /** Versioned raw response is required for current evidence at stages 1-6. */
    evidenceVersion?: 1
    response?: string
    selfConfirmed?: boolean
    /** False records a durable training-only attempt. */
    qualified?: boolean
    supportUsed?: boolean
  }[]
  /**
   * Durable target-form exposure provenance. Checking or revealing an answer
   * writes this before feedback is shown, so closing the page cannot turn a
   * second immediate task for the same phrase into independent retrieval.
   */
  practiceExposures?: {
    id: string
    skill: Skill
    exposedAt: string
    source: 'feedback' | 'reveal'
    sessionKey: string
  }[]
  /** Reviewed single-repair exercise copied from an activation-ready catalog item. */
  activationError?: ActivationErrorSpec
  /** Downgraded pre-0.6 repair retained for inspection but excluded from evidence. */
  legacyActivationError?: ActivationErrorSpec
}

export interface SkillState {
  phraseId: string
  skill: Skill
  phase: Phase
  mastery: number
  ease: number
  intervalDays: number
  learningStep: number
  dueAt: string
  lastReviewedAt?: string
  attempts: number
  firstTrySuccesses: number
  lapses: number
  consecutiveSuccesses: number
  transferPasses: number
}

export interface ReviewEvent {
  id: string
  idempotencyKey: string
  targetType: 'phrase' | 'error'
  targetId: string
  skill: Skill
  exerciseType: ExerciseType
  response: string
  grade: Grade
  hintsUsed: number
  revealUsed: boolean
  /** Explicitly false only when the target form stayed hidden until the response. */
  supportUsed?: boolean
  reviewedAt: string
  dueBefore: string
  dueAfter: string
}

export type ErrorCategory =
  | 'articles'
  | 'prepositions'
  | 'tense_aspect'
  | 'word_order'
  | 'collocation'
  | 'register'
  | 'other'

export interface ErrorAttempt {
  id: string
  response: string
  correct: boolean
  supportUsed: boolean
  transfer: boolean
  attemptedAt: string
  /** Binds the saved response to the answer contract that was active then. */
  evidenceVersion?: 1
  answerContractFingerprint?: string
  expectedResponse?: string
}

export interface ErrorObservation {
  id: string
  observedAt: string
  evidenceVersion: 1
}

export interface ErrorPattern {
  id: string
  label: string
  category: ErrorCategory
  original: string
  correction: string
  hint: string
  rule: string
  transferPrompt: string
  transferAnswer?: string
  occurrences: number
  /** Raw recurrence records; the mutable occurrence summary is rebuilt from these. */
  observations?: ErrorObservation[]
  /** Pre-contract aggregate retained for display/history, never used as current evidence. */
  legacyOccurrences?: number
  status: 'observed' | 'active' | 'improving' | 'resolved'
  dueAt: string
  /** Start of the current recurrence cycle; older attempts remain history only. */
  cycleStartedAt?: string
  /** Immutable answer-contract identity used by current repair attempts. */
  evidenceVersion?: 1
  answerContractFingerprint?: string
  answerContractUpdatedAt?: string
  attempts: ErrorAttempt[]
  createdAt: string
  updatedAt: string
}

export interface MissionTarget {
  phraseId: string
  confirmed: boolean
}

export interface Mission {
  id: string
  level: CEFRLevel
  title: string
  prompt: string
  targetPhraseIds: string[]
  minWords: number
  maxWords: number
  targetPhraseCount: number
  /** Missing on legacy missions whose pre-response support cannot be verified. */
  supportUsed?: boolean
  /** Read-only legacy or invalidated draft retained without counting as current evidence. */
  legacyContract?: boolean
  grammarTarget?: string
  draft: string
  response?: string
  targetResults: MissionTarget[]
  status: 'planned' | 'active' | 'done'
  createdAt: string
  completedAt?: string
  selfConfirmedAt?: string
}

export type SpeakingMode = 'targeted_response' | 'fluency_432' | 'shadowing'

export interface SpeakingAttempt {
  id: string
  idempotencyKey: string
  sessionId: string
  mode: SpeakingMode
  prompt: string
  round?: 1 | 2 | 3
  targetPhraseIds: string[]
  detectedPhraseIds: string[]
  confirmedPhraseIds: string[]
  /** Targets whose six pre-speaking activation stages were complete when this take was saved. */
  evidenceEligiblePhraseIds?: string[]
  transcript: string
  durationSeconds: number
  recordingId?: string
  mimeType?: string
  /** Missing on legacy attempts whose target visibility cannot be verified. */
  targetFormVisible?: boolean
  supportUsed: boolean
  selfRating: {
    clarity: 1 | 2 | 3 | 4 | 5
    flow: 1 | 2 | 3 | 4 | 5
  }
  createdAt: string
}

export interface ListeningClip {
  id: string
  title: string
  source: string
  transcript: string
  recordingId: string
  mimeType: string
  /** Practice metadata for current clips is always capped at five minutes. */
  durationSeconds: number
  /**
   * Legacy audio over five minutes is retained by id, but cannot enter a
   * listening exercise until the learner trims and imports a new clip.
   */
  quarantine?: {
    reason: 'duration_limit'
    originalDurationSeconds: number
  }
  createdAt: string
  updatedAt: string
}

export interface ListeningAttempt {
  id: string
  sourceId: string
  mode: 'blind_listen' | 'dictation'
  response: string
  answerMatched: boolean
  revealUsed: boolean
  /** True only after the referenced audio reached its end in this attempt. */
  playbackCompleted?: boolean
  /** Immutable evidence snapshot so later clip edits/deletion cannot rewrite the result. */
  referenceTranscript?: string
  sourceUpdatedAt?: string
  comprehensionQuestion?: string
  comprehensionResponse?: string
  /** Immutable correct-answer snapshot used to recompute comprehension evidence. */
  comprehensionExpectedResponse?: string
  comprehensionMatched?: boolean
  /** A legacy claimed result retained for history after unverifiable evidence is downgraded. */
  legacyComprehensionMatched?: boolean
  /** Present only when every positive result can be recomputed from saved snapshots. */
  listeningEvidenceVersion?: 1
  durationSeconds: number
  createdAt: string
}

export interface PlacementAnswer {
  questionId: string
  selectedIndex: number
  correct: boolean
}

export interface PlacementAttempt {
  id: string
  /** Current answer key contract; absent only on preserved legacy attempts. */
  questionSetVersion?: 1
  legacyQuestionSet?: true
  answers: PlacementAnswer[]
  score: number
  maxScore: number
  suggestedLevel: CEFRLevel
  bandScores: Record<CEFRLevel, { correct: number; total: number }>
  /** Optional raw TTS listening evidence; it never changes the core CEFR route. */
  listeningDiagnostic?: PlacementListeningDiagnostic
  completedAt: string
}

export interface GrammarLessonProgress {
  lessonId: string
  attempts: number
  passes: number
  bestScore: number
  totalQuestions: number
  lastScore?: number
  lastAttemptedAt: string
  lastPassedAt?: string
  /** Chronological, independently spaced successful checks used by current mastery. */
  passHistory?: string[]
  quizPassEvidence?: {
    evidenceVersion: 1
    attemptNumber: number
    answers: { questionId: string; selectedIndex: number }[]
    completedAt: string
  }[]
  /** Pre-v6 counters retained as history, never used as current mastery evidence. */
  legacyPasses?: number
  legacyLastPassedAt?: string
  completedAt?: string
  legacyCompletedAt?: string
  productionDraft?: string
  productionSavedAt?: string
  productionSelfConfirmedAt?: string
  productionTargetPhraseId?: string
  transferDraft?: string
  transferSavedAt?: string
  transferSelfConfirmedAt?: string
  transferTargetPhraseId?: string
  transferCheckEvidence?: {
    evidenceVersion: 1
    attemptNumber: number
    answers: { questionId: string; selectedIndex: number }[]
    completedAt: string
  }
  correctionPassedAt?: string
  correctionEvidence?: {
    evidenceVersion: 1
    response: string
    completedAt: string
  }
  legacyCorrectionPassedAt?: string
  cumulativeAttempts?: number
  cumulativeCorrect?: number
  lastCumulativeReviewedAt?: string
  nextCumulativeDueAt?: string
  masteryEvidenceVersion?: 2 | 3 | 4 | 5 | 6
}

export interface DailyVocabularyAssignment {
  dayKey: string
  level: CEFRLevel
  itemIds: string[]
  enrolledIds: string[]
  /** Explicit first-pass progress for every card in the ten-item daily preview. */
  previewedIds?: string[]
  /** Cards deferred from this local-day pack, kept to prevent A→B→A cycling. */
  deferredIds?: string[]
}

export interface Preferences {
  dailyMinutes: number
  maxNewPhrases: number
  englishVariant: 'International' | 'UK' | 'US'
  explanationLanguage: 'English' | 'Russian'
  theme: 'dark' | 'light' | 'system'
  reducedMotion: boolean
  keepRecordings: 'session' | '7_days' | 'forever'
  currentLevel: CEFRLevel
  targetLevel: CEFRLevel
  placementCompletedAt?: string
}

export interface ForgeData {
  schemaVersion: 6
  dailyVocabularyAssignment: DailyVocabularyAssignment | null
  /** Durable packs keyed by local day and level; the singular field is the currently open pack. */
  dailyVocabularyAssignments: DailyVocabularyAssignment[]
  phrases: Phrase[]
  skillStates: SkillState[]
  reviews: ReviewEvent[]
  errors: ErrorPattern[]
  missions: Mission[]
  speakingAttempts: SpeakingAttempt[]
  listeningClips: ListeningClip[]
  listeningAttempts: ListeningAttempt[]
  placementAttempts: PlacementAttempt[]
  grammarProgress: GrammarLessonProgress[]
  preferences: Preferences
}

export interface ProgressMetrics {
  captured: number
  /** All currently due phrase reviews, including the Voice-only spoken lane. */
  due: number
  spokenDue: number
  reviewedToday: number
  reviewedThisWeek: number
  successfulProductiveRecalls: number
  phrasesUsedInMissions: number
  provisional: number
  retained: number
  recurringErrors: number
  speakingAttempts: number
  speakingMinutes: number
  phrasesUsedInSpeech: number
}
