import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createEmptyData } from '../data/emptyData'
import { loadedCanonicalCatalogLevel } from '../data/lexicalCatalogLoader'
import { catalogAcceptedForms } from '../data/lexicalCatalogSurfaceForms'
import { beginProfileHydration, createProfileEntry, deleteProfileEntry, enterProfileRecovery, markProfileReady, profileContainerStorage, renameProfileEntry, replacePersistedProfile, setProfileWriteBarrier, switchProfileEntry } from '../data/profileStorage'
import { EMPTY_PHRASE_DEPTH, PROFILE_STORAGE_KEY, validateForgeData } from '../data/serialization'
import { activationBacklogSize, activationNewEnrollmentLimit, activationResponseMatches, activationStageIsSpaced, hasQualifiedActivationThrough } from '../domain/activation'
import { catalogItemIdsFromTags, catalogItemTag, DAILY_NEW_ITEM_COUNT, DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT, hasPracticeReadyContent, isPracticeReadyPhrase, localDayKey, replaceDailyVocabularyItem as replaceDailyVocabularyAssignmentItem, resolveDailyVocabularyAssignment } from '../domain/dailyVocabulary'
import { deriveErrorEvidence, errorAnswerContractFingerprint, errorAttemptContractSnapshot, errorAttemptResponseMatches } from '../domain/errorEvidence'
import { PERSONAL_CATALOG_ENRICHMENT_TAG, type LexicalCatalogItem } from '../domain/lexicalCatalog'
import { deriveListeningResults, LISTENING_EVIDENCE_VERSION } from '../domain/listening'
import { GRAMMAR_EVIDENCE_VERSION, grammarCorrectionMatches, grammarDraftIsOriginal, scoreGrammarQuizSelections, type GrammarQuizSelection } from '../domain/grammarEvidence'
import { includesPhrase, normalizePhrase, phraseFingerprint } from '../domain/normalization'
import { isCompletePlacementListeningDiagnostic, type PlacementListeningDiagnostic } from '../domain/placementListening'
import { buildPracticeQueue, phraseHasRecentPracticeExposure } from '../domain/queue'
import { isIndependentWrittenProductiveEvidence } from '../domain/reviewEvidence'
import { missionConfigurationIsValid, missionDraftHasLexicalVariety, missionRequirementsForLevel, missionTargetsWereEligibleAt, selectMissionTargetIds } from '../domain/mission'
import { effectiveGrade, initialSkillState, isDue, scheduleReview } from '../domain/scheduler'
import { samePhraseTargets, speakingEvidencePhraseIds } from '../domain/speaking'
import type { DailyVocabularyAssignment, ErrorPattern, ForgeData, Grade, GrammarLessonProgress, ListeningAttempt, ListeningClip, Mission, Phrase, Preferences, Skill, SpeakingAttempt, SpeakingMode } from '../domain/types'
import { assertProfileRecordingsAvailable, deleteRecording } from '../lib/audioStorage'

type AddPhraseInput = Pick<Phrase, 'canonical' | 'meaning' | 'context' | 'source' | 'kind' | 'cefr' | 'register' | 'tags' | 'note'> & { acceptedForms?: string[]; activationError?: Phrase['activationError'] }

interface ReviewInput {
  phraseId: string
  skill: Skill
  response: string
  answerMatched: boolean
  requestedGrade: Grade
  hintsUsed: number
  revealUsed: boolean
  /** True when the learner saw the target form before arriving at this task. */
  supportUsed?: boolean
  idempotencyKey: string
}

interface SpeakingAttemptInput extends Omit<SpeakingAttempt, 'id' | 'detectedPhraseIds' | 'confirmedPhraseIds' | 'createdAt'> {
  confirmedPhraseIds: string[]
  targetFormVisible: boolean
}

// Bounded append-only histories keep a multi-year daily profile under the 9 MiB
// portable-data limit. Caps are far above realistic use; oldest events fall off first.
const MAX_REVIEW_HISTORY = 20_000
const MAX_SPEAKING_HISTORY = 5_000
const MAX_MISSION_HISTORY = 2_000
const MAX_CHECKPOINT_HISTORY = 200

type MutationResult = { id?: string; duplicateId?: string; error?: string }
type DailyReplacementResult = { replacementId?: string; error?: string }
type ActivationEvent = NonNullable<Phrase['activationEvents']>[number]
type PracticeExposure = NonNullable<Phrase['practiceExposures']>[number]

function appendActivationEvent(events: Phrase['activationEvents'], event: ActivationEvent): ActivationEvent[] {
  const all = [...(events ?? []), event]
  const decisive = all.filter((candidate) => candidate.qualified !== false)
  const trainingBudget = 100 - Math.min(100, decisive.length)
  const training = trainingBudget === 0 ? [] : all.filter((candidate) => candidate.qualified === false).slice(-trainingBudget)
  return [...decisive.slice(-100), ...training]
    .sort((left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime())
}

function appendPracticeExposure(events: Phrase['practiceExposures'], event: PracticeExposure): PracticeExposure[] {
  if (events?.some((candidate) => candidate.sessionKey === event.sessionKey && candidate.source === event.source)) return events
  return [...(events ?? []), event]
    .sort((left, right) => new Date(left.exposedAt).getTime() - new Date(right.exposedAt).getTime())
    .slice(-100)
}

interface AddErrorInput {
  label: string
  category: ErrorPattern['category']
  original: string
  correction: string
  hint: string
  rule: string
  transferPrompt?: string
  transferAnswer?: string
}

interface ForgeStore extends ForgeData {
  addPhrase: (input: AddPhraseInput) => MutationResult
  /** Legacy proposal arguments are ignored; membership is derived from the trusted loaded catalog. */
  ensureDailyVocabularyAssignment: (legacyProposal?: DailyVocabularyAssignment, legacyItems?: readonly LexicalCatalogItem[], legacyReplaceSameDay?: boolean) => void
  markDailyVocabularyPreviewed: (itemId: string, assignment: DailyVocabularyAssignment) => void
  reconcileCatalogReadiness: () => void
  /** Legacy catalog/date arguments are ignored; replacements use the trusted loaded catalog and current local day. */
  replaceDailyVocabularyItem: (itemId: string, legacyItems?: readonly LexicalCatalogItem[], legacyDate?: Date) => DailyReplacementResult
  enrollCatalogItem: (item: LexicalCatalogItem, assignment: DailyVocabularyAssignment, intent?: 'learn' | 'dismiss') => MutationResult
  saveReferenceCatalogItem: (item: LexicalCatalogItem) => MutationResult
  updatePhrase: (id: string, patch: Partial<Phrase>) => MutationResult
  archivePhrase: (id: string) => void
  restorePhrase: (id: string) => void
  deletePhrase: (id: string) => MutationResult
  recordPracticeExposure: (phraseId: string, skill: Skill, sessionKey: string, source: PracticeExposure['source']) => void
  recordReview: (input: ReviewInput) => Grade
  advancePhraseActivation: (phraseId: string, stage: 1 | 2 | 3 | 4 | 5 | 6, response: string, selfConfirmed?: boolean) => void
  recordUnqualifiedActivationAttempt: (phraseId: string, stage: 1 | 2 | 3 | 4 | 5 | 6, supportUsed: boolean) => void
  resumeSuspendedSkills: () => number
  recordSpeakingAttempt: (input: SpeakingAttemptInput) => Promise<MutationResult>
  deleteSpeakingAttempt: (id: string) => Promise<string[]>
  addListeningClip: (clip: Omit<ListeningClip, 'id' | 'createdAt' | 'updatedAt' | 'quarantine'>) => Promise<string>
  recordListeningAttempt: (attempt: Omit<ListeningAttempt, 'id' | 'createdAt' | 'listeningEvidenceVersion' | 'legacyComprehensionMatched'>) => Promise<string>
  updateListeningClip: (id: string, patch: Pick<Partial<ListeningClip>, 'title' | 'source' | 'transcript'>) => Promise<void>
  deleteListeningClip: (id: string) => Promise<string | undefined>
  addError: (input: AddErrorInput) => MutationResult
  recordErrorAttempt: (errorId: string, response: string, correct: boolean, supportUsed: boolean, transfer: boolean) => void
  updateError: (id: string, patch: Partial<ErrorPattern>) => void
  updateMissionDraft: (missionId: string, draft: string) => void
  deleteMission: (missionId: string) => boolean
  completeMission: (missionId: string, confirmedPhraseIds: string[], selfConfirmed: boolean) => boolean
  createMission: (mission: Omit<Mission, 'id' | 'createdAt' | 'status' | 'draft' | 'targetResults'>) => void
  createSuggestedMission: () => string | undefined
  completePlacement: (selected: Record<string, number>, listeningDiagnostic?: PlacementListeningDiagnostic) => Promise<boolean>
  recordGrammarProgress: (lessonId: string, attemptNumber: number, answers: GrammarQuizSelection[]) => Promise<boolean>
  saveGrammarProduction: (lessonId: string, draft: string, totalQuestions: number, selfConfirmed: boolean, targetPhraseId: string | undefined, lessonReferenceTexts: readonly string[]) => boolean
  recordGrammarTransferCheck: (lessonId: string, attemptNumber: number, answers: GrammarQuizSelection[]) => Promise<boolean>
  saveGrammarTransfer: (lessonId: string, draft: string, totalQuestions: number, selfConfirmed: boolean, targetPhraseId: string | undefined, lessonReferenceTexts: readonly string[]) => boolean
  recordGrammarCheckpoint: (results: { lessonId: string; correct: boolean }[], validLessonIds: readonly string[]) => boolean
  recordGrammarCorrection: (lessonId: string, response: string) => Promise<boolean>
  updatePreferences: (patch: Partial<Preferences>) => void
  importProfile: (data: unknown) => Promise<void>
  resetToDemo: () => Promise<void>
  clearAll: () => Promise<void>
  createProfile: (name: string) => Promise<void>
  switchProfile: (id: string) => Promise<void>
  renameProfile: (id: string, name: string) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
}

const seed = createEmptyData()
const GRAMMAR_TRANSFER_DELAY_MS = 12 * 60 * 60 * 1000
const GRAMMAR_CHECKPOINT_INITIAL_DELAY_MS = 7 * 24 * 60 * 60 * 1000

function normalizeActivationErrorSpec(
  canonical: string,
  acceptedForms: readonly string[],
  value: Phrase['activationError'],
): { value?: NonNullable<Phrase['activationError']>; error?: string } {
  if (!value) return {}
  const normalized = {
    incorrectContext: value.incorrectContext.trim(),
    expectedCorrection: value.expectedCorrection.trim(),
    cue: value.cue.trim(),
  }
  if (!normalized.incorrectContext || !normalized.expectedCorrection || !normalized.cue) return { error: 'Для шага 6 заполните ошибочный пример, исправленное предложение и подсказку.' }
  if (normalizePhrase(normalized.incorrectContext) === normalizePhrase(normalized.expectedCorrection)) return { error: 'Ошибочный и исправленный варианты шага 6 должны различаться.' }
  if (!includesPhrase(normalized.expectedCorrection, canonical, [...acceptedForms])) return { error: 'Исправленный вариант шага 6 должен содержать целевое выражение или допустимую форму.' }
  return { value: normalized }
}

function hasCurrentGrammarMastery(progress: GrammarLessonProgress): boolean {
  return (progress.quizPassEvidence?.length ?? 0) >= 2
    && Boolean(progress.correctionEvidence)
    && Boolean(progress.productionDraft?.trim() && progress.productionSavedAt && progress.productionSelfConfirmedAt)
    && Boolean(progress.transferDraft?.trim() && progress.transferSavedAt && progress.transferSelfConfirmedAt)
    && Boolean(progress.transferCheckEvidence?.completedAt)
}

function forgeDataFromState(state: ForgeStore): ForgeData {
  return {
    schemaVersion: state.schemaVersion,
    dailyVocabularyAssignment: state.dailyVocabularyAssignment,
    dailyVocabularyAssignments: state.dailyVocabularyAssignments,
    phrases: state.phrases,
    skillStates: state.skillStates,
    reviews: state.reviews,
    errors: state.errors,
    missions: state.missions,
    speakingAttempts: state.speakingAttempts,
    listeningClips: state.listeningClips,
    listeningAttempts: state.listeningAttempts,
    placementAttempts: state.placementAttempts,
    grammarProgress: state.grammarProgress,
    preferences: state.preferences,
  }
}

function persistedDailyAssignmentFor(
  active: DailyVocabularyAssignment | null,
  history: readonly DailyVocabularyAssignment[],
  dayKey: string,
  level: DailyVocabularyAssignment['level'],
): DailyVocabularyAssignment | null {
  if (active?.dayKey === dayKey && active.level === level) return active
  return history.find((assignment) => assignment.dayKey === dayKey && assignment.level === level) ?? null
}

function upsertDailyVocabularyAssignment(
  assignments: DailyVocabularyAssignment[],
  assignment: DailyVocabularyAssignment,
): DailyVocabularyAssignment[] {
  const key = `${assignment.dayKey}:${assignment.level}`
  const existing = assignments.find((item) => `${item.dayKey}:${item.level}` === key)
  if (existing
    && existing.itemIds.length === assignment.itemIds.length
    && existing.enrolledIds.length === assignment.enrolledIds.length
    && (existing.previewedIds?.length ?? 0) === (assignment.previewedIds?.length ?? 0)
    && (existing.deferredIds?.length ?? 0) === (assignment.deferredIds?.length ?? 0)
    && existing.itemIds.every((id, index) => id === assignment.itemIds[index])
    && existing.enrolledIds.every((id, index) => id === assignment.enrolledIds[index])
    && (existing.previewedIds ?? []).every((id, index) => id === assignment.previewedIds?.[index])
    && (existing.deferredIds ?? []).every((id, index) => id === assignment.deferredIds?.[index])) return assignments
  return [assignment, ...assignments.filter((item) => `${item.dayKey}:${item.level}` !== key)].slice(0, DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT)
}

function enrollAssignmentItem(assignment: DailyVocabularyAssignment, item: LexicalCatalogItem): DailyVocabularyAssignment {
  if (assignment.level !== item.level || !assignment.itemIds.includes(item.id) || assignment.enrolledIds.includes(item.id)) return assignment
  return { ...assignment, enrolledIds: [...assignment.enrolledIds, item.id] }
}

function activationErrorSpecsMatch(left: Phrase['activationError'], right: Phrase['activationError']): boolean {
  return (!left && !right) || Boolean(left && right
    && left.incorrectContext === right.incorrectContext
    && left.expectedCorrection === right.expectedCorrection
    && left.cue === right.cue)
}

function resetPhraseEvidenceForCatalogRevision(phrase: Phrase, activationError: NonNullable<Phrase['activationError']>, updatedAt: string): Phrase {
  return {
    ...phrase,
    activationError,
    activationStage: 0,
    activationUpdatedAt: updatedAt,
    evidenceResetAt: updatedAt,
    status: 'new',
    updatedAt,
  }
}

function reconcileAssignmentCatalogTags(
  phrases: Phrase[],
  assignment: DailyVocabularyAssignment | undefined,
  items: readonly LexicalCatalogItem[],
  updatedAt: string,
): { phrases: Phrase[]; revisedIds: Set<string> } {
  const enrolledItems = assignment ? items.filter((item) => assignment.enrolledIds.includes(item.id)) : []
  const enrolledByFingerprint = new Map(enrolledItems.map((item) => [phraseFingerprint(item.expression), item]))
  const itemById = new Map(items.map((item) => [item.id, item]))
  if (!enrolledItems.length && !phrases.some((phrase) => catalogItemIdsFromTags(phrase.tags).some((id) => itemById.has(id)))) {
    return { phrases, revisedIds: new Set() }
  }

  let changed = false
  const revisedIds = new Set<string>()
  const reconciled = phrases.map((phrase): Phrase => {
    if (!isPracticeReadyPhrase(phrase)) return phrase
    const taggedItem = catalogItemIdsFromTags(phrase.tags).map((id) => itemById.get(id)).find(Boolean)
    const item = taggedItem ?? enrolledByFingerprint.get(phraseFingerprint(phrase.canonical))
    if (!item) return phrase
    const requiredTags = item.activationReady === true
      ? [catalogItemTag(item.id)]
      : [catalogItemTag(item.id), PERSONAL_CATALOG_ENRICHMENT_TAG]
    const metadata = item.activationReady === true ? item.activationError : undefined
    const metadataMatches = !metadata || activationErrorSpecsMatch(phrase.activationError, metadata)
    const readinessDowngraded = item.activationReady !== true
      && !phrase.tags.includes(PERSONAL_CATALOG_ENRICHMENT_TAG)
    if (readinessDowngraded) {
      changed = true
      revisedIds.add(phrase.id)
      const originalStage = phrase.activationStage ?? 0
      return {
        ...phrase,
        tags: [...new Set([...phrase.tags, ...requiredTags])],
        activationStage: 0,
        legacyActivationStage: Math.max(phrase.legacyActivationStage ?? 0, originalStage),
        activationUpdatedAt: updatedAt,
        evidenceResetAt: updatedAt,
        activationError: undefined,
        legacyActivationError: phrase.activationError ?? phrase.legacyActivationError,
        status: phrase.status === 'archived' ? 'archived' : 'new',
        updatedAt,
      }
    }
    if (requiredTags.every((tag) => phrase.tags.includes(tag)) && metadataMatches) return phrase
    changed = true
    if (metadata && !metadataMatches) {
      revisedIds.add(phrase.id)
      const reset = resetPhraseEvidenceForCatalogRevision({ ...phrase, tags: [...new Set([...phrase.tags, ...requiredTags])] }, metadata, updatedAt)
      return phrase.status === 'archived' ? { ...reset, status: 'archived', archivedAt: phrase.archivedAt } : reset
    }
    return {
      ...phrase,
      tags: [...new Set([...phrase.tags, ...requiredTags])],
      ...(metadata ? { activationError: metadata } : {}),
      updatedAt,
    }
  })
  return { phrases: changed ? reconciled : phrases, revisedIds }
}

function catalogSkillStates(phraseId: string, now: Date) {
  return [
    initialSkillState(phraseId, 'meaning_recall', now),
    { ...initialSkillState(phraseId, 'cloze', now), dueAt: new Date(now.getTime() + 86_400_000).toISOString() },
    { ...initialSkillState(phraseId, 'written_productive', now), dueAt: new Date(now.getTime() + 3 * 86_400_000).toISOString() },
    { ...initialSkillState(phraseId, 'spoken_productive', now), dueAt: new Date(now.getTime() + 3 * 86_400_000).toISOString() },
  ]
}

type CatalogPhraseFields = Pick<Phrase, 'canonical' | 'normalizedKey' | 'meaning' | 'context' | 'source' | 'kind' | 'cefr' | 'register' | 'tags' | 'note' | 'acceptedForms' | 'examples' | 'depth' | 'activationError'>

function catalogPhraseFields(item: LexicalCatalogItem): CatalogPhraseFields {
  return {
    canonical: item.expression,
    normalizedKey: normalizePhrase(item.expression),
    meaning: `${item.translationRu} · ${item.meaningEn}`,
    context: item.example,
    source: `English Forge Core Library · ${item.level}`,
    kind: item.kind as Phrase['kind'],
    cefr: item.level,
    register: [item.register],
    tags: [item.topic, 'core-library', catalogItemTag(item.id)],
    note: [item.pattern, item.note, `Перевод примера: ${item.exampleTranslationRu}`].filter(Boolean).join(' · '),
    acceptedForms: catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id),
    examples: [{ id: `${item.id}-example`, text: item.example, source: 'English Forge original example' }],
    depth: {
      grammarFrame: item.pattern ?? '', collocates: [], constraints: item.note ? [item.note] : [], contrasts: [],
      connotation: `${item.register} · ${item.topic}`, pronunciationNote: '',
    },
    activationError: item.activationError,
  }
}

function mergeUniqueStrings(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right])]
}

function mergeCatalogEnrichment(current: Phrase, fields: CatalogPhraseFields, updatedAt: string): Phrase {
  const examples = [...current.examples]
  const exampleFingerprints = new Set(examples.map((example) => phraseFingerprint(example.text)))
  for (const example of fields.examples) {
    if (exampleFingerprints.has(phraseFingerprint(example.text))) continue
    examples.push(example)
    exampleFingerprints.add(phraseFingerprint(example.text))
  }
  const contrasts = [...current.depth.contrasts]
  const contrastKeys = new Set(contrasts.map((contrast) => `${phraseFingerprint(contrast.alternative)}\u0000${normalizePhrase(contrast.distinction)}`))
  for (const contrast of fields.depth.contrasts) {
    const key = `${phraseFingerprint(contrast.alternative)}\u0000${normalizePhrase(contrast.distinction)}`
    if (contrastKeys.has(key)) continue
    contrasts.push(contrast)
    contrastKeys.add(key)
  }
  const noteParts = [current.note.trim(), fields.note.trim()].filter((value, index, values) => value && values.indexOf(value) === index)
  const sourceParts = [current.source.trim(), fields.source.trim()].filter((value, index, values) => value && values.indexOf(value) === index)

  return {
    ...current,
    canonical: fields.canonical,
    normalizedKey: fields.normalizedKey,
    meaning: current.meaning.trim() || fields.meaning,
    context: current.context.trim() || fields.context,
    source: sourceParts.join(' · '),
    kind: fields.kind,
    cefr: fields.cefr,
    register: mergeUniqueStrings(current.register, fields.register) as Phrase['register'],
    tags: mergeUniqueStrings(current.tags, fields.tags),
    note: noteParts.join(' · '),
    acceptedForms: mergeUniqueStrings(current.acceptedForms, fields.acceptedForms),
    examples,
    depth: {
      grammarFrame: current.depth.grammarFrame.trim() || fields.depth.grammarFrame,
      collocates: mergeUniqueStrings(current.depth.collocates, fields.depth.collocates),
      constraints: mergeUniqueStrings(current.depth.constraints, fields.depth.constraints),
      contrasts,
      connotation: current.depth.connotation.trim() || fields.depth.connotation,
      pronunciationNote: current.depth.pronunciationNote.trim() || fields.depth.pronunciationNote,
    },
    activationError: fields.activationError ?? current.activationError,
    status: current.status === 'needs_enrichment' || current.status === 'archived' ? 'new' : current.status,
    archivedAt: undefined,
    updatedAt,
  }
}

type MutationPlan<T> = { data?: ForgeData; result: T }
let durableMutationQueue: Promise<void> = Promise.resolve()

function speakingDurationLimit(mode: SpeakingMode, round?: 1 | 2 | 3): number {
  if (mode !== 'fluency_432') return 180
  return ([60, 45, 30] as const)[(round ?? 1) - 1]
}

function commitData<T>(
  get: () => ForgeStore,
  set: (partial: ForgeData) => void,
  build: (state: ForgeStore) => MutationPlan<T>,
): Promise<T> {
  const operation = durableMutationQueue.catch(() => undefined).then(async () => {
    let base = get()
    for (let rebase = 0; rebase < 8; rebase += 1) {
      const plan = build(base)
      if (!plan.data) return plan.result
      const validated = validateForgeData(plan.data)
      await replacePersistedProfile(validated)
      if (get() === base) {
        set(validated)
        return plan.result
      }
      base = get()
    }
    throw new Error('The profile changed repeatedly while committing media metadata. Try the action again.')
  })
  durableMutationQueue = operation.then(() => undefined, () => undefined)
  return operation
}

export const useForgeStore = create<ForgeStore>()(
  persist(
    (set, get) => ({
      ...seed,
      addPhrase: (input) => {
        if (!input.canonical.trim()) return { error: 'Add at least one English word or expression.' }
        const normalizedKey = normalizePhrase(input.canonical)
        const fingerprint = phraseFingerprint(input.canonical)
        const duplicate = get().phrases.find((item) => phraseFingerprint(item.canonical) === fingerprint)
        if (duplicate) return { duplicateId: duplicate.id }

        const id = crypto.randomUUID()
        const nowDate = new Date()
        const now = nowDate.toISOString()
        const needsEnrichment = !hasPracticeReadyContent({ canonical: input.canonical.trim(), meaning: input.meaning, context: input.context, acceptedForms: input.acceptedForms ?? [] })
        const activationError = normalizeActivationErrorSpec(input.canonical.trim(), input.acceptedForms ?? [], input.activationError)
        if (activationError.error) return { error: activationError.error }
        const item: Phrase = {
          id,
          ...input,
          canonical: input.canonical.trim(),
          normalizedKey,
          acceptedForms: input.acceptedForms ?? [],
          examples: [],
          depth: structuredClone(EMPTY_PHRASE_DEPTH),
          status: needsEnrichment ? 'needs_enrichment' : 'new',
          activationStage: 0,
          activationUpdatedAt: now,
          ...(activationError.value ? { activationError: activationError.value } : {}),
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          phrases: [item, ...state.phrases],
          skillStates: [
            { ...initialSkillState(id, 'meaning_recall', nowDate), dueAt: new Date(nowDate.getTime() + (needsEnrichment ? 1 : 0) * 86_400_000).toISOString() },
            { ...initialSkillState(id, 'cloze', nowDate), dueAt: new Date(nowDate.getTime() + (needsEnrichment ? 3 : 1) * 86_400_000).toISOString() },
            { ...initialSkillState(id, 'written_productive', nowDate), dueAt: new Date(nowDate.getTime() + (needsEnrichment ? 7 : 3) * 86_400_000).toISOString() },
            { ...initialSkillState(id, 'spoken_productive', nowDate), dueAt: new Date(nowDate.getTime() + (needsEnrichment ? 7 : 3) * 86_400_000).toISOString() },
            ...state.skillStates,
          ],
        }))
        return { id }
      },
      ensureDailyVocabularyAssignment: () => set((state) => {
        const nowDate = new Date()
        const todayKey = localDayKey(nowDate)
        const currentLevel = state.preferences.currentLevel
        const items = loadedCanonicalCatalogLevel(currentLevel)
        if (!items) return state
        const persisted = persistedDailyAssignmentFor(
          state.dailyVocabularyAssignment,
          state.dailyVocabularyAssignments,
          todayKey,
          currentLevel,
        )
        const dailyVocabularyAssignment = resolveDailyVocabularyAssignment(
          items,
          currentLevel,
          state.phrases,
          nowDate,
          DAILY_NEW_ITEM_COUNT,
          persisted,
          state.dailyVocabularyAssignments,
        ).assignment
        const updatedAt = nowDate.toISOString()
        const reconciliation = reconcileAssignmentCatalogTags(state.phrases, dailyVocabularyAssignment, items, updatedAt)
        const { phrases, revisedIds } = reconciliation
        const dailyVocabularyAssignments = upsertDailyVocabularyAssignment(state.dailyVocabularyAssignments, dailyVocabularyAssignment)
        if (dailyVocabularyAssignment === state.dailyVocabularyAssignment && dailyVocabularyAssignments === state.dailyVocabularyAssignments && phrases === state.phrases) return state
        return {
          dailyVocabularyAssignment,
          dailyVocabularyAssignments,
          phrases,
          ...(revisedIds.size ? {
            skillStates: [
              ...[...revisedIds].flatMap((phraseId) => catalogSkillStates(phraseId, new Date(updatedAt))),
              ...state.skillStates.filter((skillState) => !revisedIds.has(skillState.phraseId)),
            ],
            missions: state.missions.map((mission) => mission.targetPhraseIds.some((phraseId) => revisedIds.has(phraseId))
              ? { ...mission, legacyContract: true }
              : mission),
            grammarProgress: state.grammarProgress.map((progress) => ({
              ...progress,
              ...(progress.productionTargetPhraseId && revisedIds.has(progress.productionTargetPhraseId) ? { productionTargetPhraseId: undefined } : {}),
              ...(progress.transferTargetPhraseId && revisedIds.has(progress.transferTargetPhraseId) ? { transferTargetPhraseId: undefined } : {}),
            })),
          } : {}),
        }
      }),
      reconcileCatalogReadiness: () => set((state) => {
        const items = (['A2', 'B1', 'B2', 'C1'] as const)
          .flatMap((level) => loadedCanonicalCatalogLevel(level) ?? [])
        if (!items.length) return state
        const updatedAt = new Date().toISOString()
        const { phrases, revisedIds } = reconcileAssignmentCatalogTags(state.phrases, undefined, items, updatedAt)
        if (phrases === state.phrases) return state
        return {
          phrases,
          ...(revisedIds.size ? {
            skillStates: [
              ...[...revisedIds].flatMap((phraseId) => catalogSkillStates(phraseId, new Date(updatedAt))),
              ...state.skillStates.filter((skillState) => !revisedIds.has(skillState.phraseId)),
            ],
            missions: state.missions.map((mission) => mission.targetPhraseIds.some((phraseId) => revisedIds.has(phraseId))
              ? { ...mission, legacyContract: true }
              : mission),
            grammarProgress: state.grammarProgress.map((progress) => ({
              ...progress,
              ...(progress.productionTargetPhraseId && revisedIds.has(progress.productionTargetPhraseId) ? { productionTargetPhraseId: undefined } : {}),
              ...(progress.transferTargetPhraseId && revisedIds.has(progress.transferTargetPhraseId) ? { transferTargetPhraseId: undefined } : {}),
            })),
          } : {}),
        }
      }),
      markDailyVocabularyPreviewed: (itemId, proposedAssignment) => set((state) => {
        const todayKey = localDayKey(new Date())
        const currentLevel = state.preferences.currentLevel
        if (proposedAssignment.dayKey !== todayKey || proposedAssignment.level !== currentLevel) return state
        const assignment = persistedDailyAssignmentFor(
          state.dailyVocabularyAssignment,
          state.dailyVocabularyAssignments,
          todayKey,
          currentLevel,
        )
        if (!assignment) return state
        if (!assignment.itemIds.includes(itemId) || assignment.previewedIds?.includes(itemId)) return state
        const next = { ...assignment, previewedIds: [...(assignment.previewedIds ?? []), itemId] }
        return {
          dailyVocabularyAssignment: next,
          dailyVocabularyAssignments: upsertDailyVocabularyAssignment(state.dailyVocabularyAssignments, next),
        }
      }),
      replaceDailyVocabularyItem: (itemId) => {
        const currentState = get()
        const nowDate = new Date()
        const todayKey = localDayKey(nowDate)
        const current = currentState.dailyVocabularyAssignment
        if (!current || current.dayKey !== todayKey || current.level !== currentState.preferences.currentLevel) return { error: 'Open today’s current-level vocabulary pack before replacing a card.' }
        const items = loadedCanonicalCatalogLevel(current.level)
        if (!items) return { error: 'Open the trusted vocabulary catalog before replacing a card.' }
        const replacement = replaceDailyVocabularyAssignmentItem(items, currentState.phrases, current, itemId, nowDate, currentState.dailyVocabularyAssignments)
        if (replacement === current) return { error: 'No eligible replacement is available for this daily pack.' }
        const replacementId = replacement.itemIds[current.itemIds.indexOf(itemId)]
        let committed = false
        set((state) => {
          if (state.dailyVocabularyAssignment !== current
            || state.preferences.currentLevel !== current.level
            || current.dayKey !== localDayKey(new Date())) return state
          committed = true
          return {
            dailyVocabularyAssignment: replacement,
            dailyVocabularyAssignments: upsertDailyVocabularyAssignment(state.dailyVocabularyAssignments, replacement),
          }
        })
        return committed ? { replacementId } : { error: 'Today’s vocabulary pack changed before the replacement could be saved.' }
      },
      enrollCatalogItem: (proposedCatalogItem, proposedAssignment, intent = 'learn') => {
        const currentLevel = get().preferences.currentLevel
        const catalogItem = loadedCanonicalCatalogLevel(currentLevel)?.find((item) => item.id === proposedCatalogItem.id)
        if (!catalogItem) return { error: 'Сначала откройте проверенный каталог текущего уровня.' }
        if (catalogItem.activationReady !== true) return { error: 'Эта карточка пока доступна только как справочный материал.' }
        const currentState = get()
        const nowDate = new Date()
        const todayKey = localDayKey(nowDate)
        if (proposedAssignment.dayKey !== todayKey || proposedAssignment.level !== currentLevel || catalogItem.level !== currentLevel) return { error: 'Глубокий цикл доступен только для карточек сегодняшнего ежедневного набора текущего уровня.' }
        const admissionAssignment = persistedDailyAssignmentFor(
          currentState.dailyVocabularyAssignment,
          currentState.dailyVocabularyAssignments,
          todayKey,
          currentLevel,
        )
        if (!admissionAssignment || !admissionAssignment.itemIds.includes(catalogItem.id)) return { error: 'Сначала откройте сохранённый ежедневный набор на сегодня; переданный набор не может заменить его.' }
        if (intent === 'learn') {
          if (!admissionAssignment.previewedIds?.includes(catalogItem.id)) return { error: 'Сначала правильно извлеките значение карточки в разделе «Знакомство».' }
          const alreadyEnrolled = admissionAssignment.enrolledIds.includes(catalogItem.id)
          const dueReviews = buildPracticeQueue(
            currentState.skillStates,
            currentState.phrases,
            currentState.preferences,
            nowDate,
            undefined,
            admissionAssignment,
            currentState.reviews,
          ).length
          const admissionLimit = Math.min(
            currentState.preferences.maxNewPhrases,
            activationNewEnrollmentLimit(currentState.preferences.dailyMinutes, dueReviews, activationBacklogSize(currentState.phrases, catalogItem.level)),
          )
          if (!alreadyEnrolled && admissionAssignment.enrolledIds.length >= admissionLimit) return { error: `Безопасный лимит глубокого цикла на сегодня — ${admissionLimit}.` }
        }
        const fingerprint = phraseFingerprint(catalogItem.expression)
        const duplicate = get().phrases.find((phrase) => phraseFingerprint(phrase.canonical) === fingerprint)
        const id = duplicate?.id ?? crypto.randomUUID()
        const now = nowDate.toISOString()
        const catalogFields = catalogPhraseFields(catalogItem)
        const fields: CatalogPhraseFields = catalogItem.activationReady === true ? catalogFields : {
          ...catalogFields,
          tags: mergeUniqueStrings(catalogFields.tags, [PERSONAL_CATALOG_ENRICHMENT_TAG]),
          activationError: undefined,
        }
        set((state) => {
          if (state.preferences.currentLevel !== currentLevel) return state
          const persistedAssignment = persistedDailyAssignmentFor(state.dailyVocabularyAssignment, state.dailyVocabularyAssignments, todayKey, currentLevel)
          if (!persistedAssignment || !persistedAssignment.itemIds.includes(catalogItem.id)) return state
          const assignment = enrollAssignmentItem(persistedAssignment, catalogItem)
          const current = state.phrases.find((phrase) => phrase.id === id)
          const needsEnrichment = current && !hasPracticeReadyContent(current)
          if (current && !needsEnrichment) {
            const requiredTags = catalogItem.activationReady === true
              ? [catalogItemTag(catalogItem.id)]
              : [catalogItemTag(catalogItem.id), PERSONAL_CATALOG_ENRICHMENT_TAG]
            const restoring = current.status === 'archived'
            const restoredStatus = state.skillStates.some((skillState) => skillState.phraseId === id && skillState.attempts > 0) ? 'learning' as const : 'new' as const
            const metadata = fields.activationError
            const metadataMatches = !metadata || activationErrorSpecsMatch(current.activationError, metadata)
            const evidenceRevised = Boolean(metadata && !metadataMatches)
            const alreadyCurrent = requiredTags.every((tag) => current.tags.includes(tag)) && !restoring && metadataMatches
            const revisedPhrase = evidenceRevised && metadata
              ? resetPhraseEvidenceForCatalogRevision({
                ...current,
                tags: mergeUniqueStrings(current.tags, requiredTags),
                archivedAt: restoring ? undefined : current.archivedAt,
              }, metadata, now)
              : undefined
            return {
              dailyVocabularyAssignment: assignment,
              dailyVocabularyAssignments: upsertDailyVocabularyAssignment(state.dailyVocabularyAssignments, assignment),
              phrases: alreadyCurrent
                ? state.phrases
                : state.phrases.map((phrase) => phrase.id === id ? revisedPhrase ?? {
                  ...phrase,
                  tags: mergeUniqueStrings(phrase.tags, requiredTags),
                  ...(metadata ? { activationError: metadata } : {}),
                  status: restoring ? restoredStatus : phrase.status,
                  archivedAt: restoring ? undefined : phrase.archivedAt,
                  updatedAt: now,
                } : phrase),
              ...(evidenceRevised ? {
                skillStates: [...catalogSkillStates(id, nowDate), ...state.skillStates.filter((skillState) => skillState.phraseId !== id)],
                missions: state.missions.map((mission) => mission.targetPhraseIds.includes(id)
                  ? { ...mission, legacyContract: true }
                  : mission),
                grammarProgress: state.grammarProgress.map((progress) => ({
                  ...progress,
                  ...(progress.productionTargetPhraseId === id ? { productionTargetPhraseId: undefined } : {}),
                  ...(progress.transferTargetPhraseId === id ? { transferTargetPhraseId: undefined } : {}),
                })),
              } : {}),
            }
          }
          const metadataChanged = Boolean(current && fields.activationError && !activationErrorSpecsMatch(current.activationError, fields.activationError))
          const enrolledPhrase: Phrase = current
            ? metadataChanged && fields.activationError
              ? resetPhraseEvidenceForCatalogRevision(mergeCatalogEnrichment(current, fields, now), fields.activationError, now)
              : mergeCatalogEnrichment(current, fields, now)
            : { id, ...fields, status: 'new', activationStage: 0, activationUpdatedAt: now, createdAt: now, updatedAt: now }
          const initializeSkills = !current || current.status === 'needs_enrichment' || metadataChanged
          return {
            dailyVocabularyAssignment: assignment,
            dailyVocabularyAssignments: upsertDailyVocabularyAssignment(state.dailyVocabularyAssignments, assignment),
            phrases: current ? state.phrases.map((phrase) => phrase.id === id ? enrolledPhrase : phrase) : [enrolledPhrase, ...state.phrases],
            skillStates: initializeSkills
              ? [...catalogSkillStates(id, nowDate), ...state.skillStates.filter((skillState) => skillState.phraseId !== id)]
              : state.skillStates,
            ...(metadataChanged ? {
              missions: state.missions.map((mission) => mission.targetPhraseIds.includes(id)
                ? { ...mission, legacyContract: true }
                : mission),
              grammarProgress: state.grammarProgress.map((progress) => ({
                ...progress,
                ...(progress.productionTargetPhraseId === id ? { productionTargetPhraseId: undefined } : {}),
                ...(progress.transferTargetPhraseId === id ? { transferTargetPhraseId: undefined } : {}),
              })),
            } : {}),
          }
        })
        if (intent === 'dismiss') get().archivePhrase(id)
        return { id }
      },
      saveReferenceCatalogItem: (catalogItem) => {
        if (catalogItem.activationReady === true) return { error: 'Эта карточка уже готова для активного курса; добавьте её через ежедневный набор.' }
        const fingerprint = phraseFingerprint(catalogItem.expression)
        const duplicate = get().phrases.find((phrase) => phraseFingerprint(phrase.canonical) === fingerprint)
        const id = duplicate?.id ?? crypto.randomUUID()
        const nowDate = new Date()
        const now = nowDate.toISOString()
        const catalogFields = catalogPhraseFields(catalogItem)
        // Reference rows must never smuggle unreviewed bundled metadata into
        // the productive gate. A valid personal pair can still be preserved
        // when this action enriches an existing learner-authored duplicate.
        const fields: CatalogPhraseFields = {
          ...catalogFields,
          tags: mergeUniqueStrings(catalogFields.tags, [PERSONAL_CATALOG_ENRICHMENT_TAG]),
          activationError: undefined,
        }
        set((state) => {
          const current = state.phrases.find((phrase) => phrase.id === id)
          const savedPhrase: Phrase = current
            ? mergeCatalogEnrichment(current, fields, now)
            : { id, ...fields, status: 'new', activationStage: 0, activationUpdatedAt: now, createdAt: now, updatedAt: now }
          const initializeSkills = !current
            || current.status === 'needs_enrichment'
            || !state.skillStates.some((skillState) => skillState.phraseId === id)
          return {
            phrases: current ? state.phrases.map((phrase) => phrase.id === id ? savedPhrase : phrase) : [savedPhrase, ...state.phrases],
            skillStates: initializeSkills
              ? [...catalogSkillStates(id, nowDate), ...state.skillStates.filter((skillState) => skillState.phraseId !== id)]
              : state.skillStates,
          }
        })
        return { id }
      },
      updatePhrase: (id, patch) => {
        const canonical = patch.canonical?.trim()
        if (patch.canonical !== undefined && !canonical) return { error: 'The phrase cannot be blank.' }
        if (canonical) {
          const fingerprint = phraseFingerprint(canonical)
          const duplicate = get().phrases.find((item) => item.id !== id && phraseFingerprint(item.canonical) === fingerprint)
          if (duplicate) return { duplicateId: duplicate.id }
        }
        const currentPhrase = get().phrases.find((item) => item.id === id)
        if (!currentPhrase) return { error: 'The phrase no longer exists.' }
        const hasActivationPatch = Object.prototype.hasOwnProperty.call(patch, 'activationError')
        const activationError = normalizeActivationErrorSpec(
          canonical ?? currentPhrase.canonical,
          patch.acceptedForms ?? currentPhrase.acceptedForms,
          patch.activationError,
        )
        if (activationError.error) return { error: activationError.error }
        const sameForms = (left: readonly string[], right: readonly string[]) => {
          const a = left.map(normalizePhrase).sort()
          const b = right.map(normalizePhrase).sort()
          return a.length === b.length && a.every((value, index) => value === b[index])
        }
        const nextActivationError = canonical && normalizePhrase(canonical) !== currentPhrase.normalizedKey
          ? activationError.value
          : hasActivationPatch ? activationError.value : currentPhrase.activationError
        const activationErrorChanged = JSON.stringify(nextActivationError ?? null) !== JSON.stringify(currentPhrase.activationError ?? null)
        const evidenceAffectingRevision = Boolean(
          (canonical && normalizePhrase(canonical) !== currentPhrase.normalizedKey)
          || (patch.meaning !== undefined && patch.meaning.trim() !== currentPhrase.meaning.trim())
          || (patch.context !== undefined && patch.context.trim() !== currentPhrase.context.trim())
          || (patch.acceptedForms !== undefined && !sameForms(patch.acceptedForms, currentPhrase.acceptedForms))
          || activationErrorChanged,
        )
        set((state) => {
          const current = state.phrases.find((item) => item.id === id)
          if (!current) return state
          const meaning = patch.meaning ?? current.meaning
          const context = patch.context ?? current.context
          const nextCanonical = canonical ?? current.canonical
          const nextAcceptedForms = patch.acceptedForms ?? current.acceptedForms
          const hasLearningContent = hasPracticeReadyContent({ canonical: nextCanonical, meaning, context, acceptedForms: nextAcceptedForms })
          const unlocked = current.status === 'needs_enrichment' && hasLearningContent
          const updatedAt = new Date().toISOString()
          const canonicalChanged = Boolean(canonical && normalizePhrase(canonical) !== current.normalizedKey)
          const { id: _ignoredId, normalizedKey: _ignoredNormalizedKey, createdAt: _ignoredCreatedAt, updatedAt: _ignoredUpdatedAt, archivedAt: _ignoredArchivedAt, activationError: _ignoredActivationError, legacyActivationError: _ignoredLegacyActivationError, ...safePatch } = patch
          return {
            phrases: state.phrases.map((item) => item.id === id ? {
              ...item,
              ...safePatch,
              canonical: canonical ?? item.canonical,
              normalizedKey: canonical ? normalizePhrase(canonical) : item.normalizedKey,
              activationError: canonicalChanged || hasActivationPatch ? activationError.value : item.activationError,
              tags: hasActivationPatch && activationError.value && activationErrorChanged
                ? mergeUniqueStrings(item.tags, [PERSONAL_CATALOG_ENRICHMENT_TAG])
                : item.tags,
              activationStage: evidenceAffectingRevision ? 0 : item.activationStage,
              activationUpdatedAt: evidenceAffectingRevision ? updatedAt : item.activationUpdatedAt,
              evidenceResetAt: evidenceAffectingRevision ? updatedAt : item.evidenceResetAt,
              status: patch.status === 'archived' || item.status === 'archived'
                ? 'archived'
                : !hasLearningContent
                  ? 'needs_enrichment'
                  : unlocked || evidenceAffectingRevision ? 'new' : patch.status ?? item.status,
              updatedAt,
            } : item),
            missions: (patch.cefr !== undefined || patch.status === 'needs_enrichment' || evidenceAffectingRevision)
              ? state.missions.map((mission) => mission.targetPhraseIds.includes(id)
                ? { ...mission, legacyContract: true }
                : mission)
              : state.missions,
            skillStates: evidenceAffectingRevision
              ? [...catalogSkillStates(id, new Date(updatedAt)), ...state.skillStates.filter((skillState) => skillState.phraseId !== id)]
              : unlocked ? state.skillStates.map((skillState) => {
              if (skillState.phraseId !== id) return skillState
              const delayDays = skillState.skill === 'meaning_recall' ? 0 : skillState.skill === 'cloze' ? 1 : 3
              return { ...skillState, dueAt: new Date(new Date(updatedAt).getTime() + delayDays * 86_400_000).toISOString() }
            }) : state.skillStates,
            grammarProgress: evidenceAffectingRevision ? state.grammarProgress.map((progress) => ({
              ...progress,
              ...(progress.productionTargetPhraseId === id ? { productionTargetPhraseId: undefined } : {}),
              ...(progress.transferTargetPhraseId === id ? { transferTargetPhraseId: undefined } : {}),
            })) : state.grammarProgress,
          }
        })
        return { id }
      },
      archivePhrase: (id) => set((state) => ({
        phrases: state.phrases.map((item) => item.id === id ? { ...item, status: 'archived', archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item),
        skillStates: state.skillStates.map((item) => item.phraseId === id ? { ...item, phase: 'suspended' as const } : item),
        missions: state.missions.map((mission) => mission.status !== 'done' && mission.targetPhraseIds.includes(id)
          ? { ...mission, legacyContract: true }
          : mission),
      })),
      restorePhrase: (id) => set((state) => ({
        phrases: state.phrases.map((item) => item.id === id && item.status === 'archived' ? { ...item, status: isPracticeReadyPhrase(item) ? 'learning' : 'needs_enrichment', archivedAt: undefined, updatedAt: new Date().toISOString() } : item),
        skillStates: state.skillStates.map((item) => item.phraseId === id && item.phase === 'suspended' ? { ...item, phase: 'relearning' as const, dueAt: new Date().toISOString(), learningStep: 0 } : item),
      })),
      deletePhrase: (id) => {
        const phrase = get().phrases.find((item) => item.id === id)
        if (!phrase) return { error: 'The phrase no longer exists.' }
        if (get().missions.some((mission) => mission.targetPhraseIds.includes(id))) {
          return { error: 'Сначала сохраните или удалите связанные задания на перенос: выражение используется в истории задания.' }
        }
        set((state) => {
        const removedCatalogIds = new Set(catalogItemIdsFromTags(state.phrases.find((item) => item.id === id)?.tags ?? []))
        return {
          dailyVocabularyAssignment: state.dailyVocabularyAssignment && removedCatalogIds.size
            ? { ...state.dailyVocabularyAssignment, enrolledIds: state.dailyVocabularyAssignment.enrolledIds.filter((itemId) => !removedCatalogIds.has(itemId)) }
            : state.dailyVocabularyAssignment,
          dailyVocabularyAssignments: removedCatalogIds.size ? state.dailyVocabularyAssignments.map((assignment) => ({
            ...assignment,
            enrolledIds: assignment.enrolledIds.filter((itemId) => !removedCatalogIds.has(itemId)),
          })) : state.dailyVocabularyAssignments,
          phrases: state.phrases.filter((item) => item.id !== id),
          skillStates: state.skillStates.filter((item) => item.phraseId !== id),
          reviews: state.reviews.filter((item) => !(item.targetType === 'phrase' && item.targetId === id)),
          speakingAttempts: state.speakingAttempts.map((attempt) => ({
            ...attempt,
            targetPhraseIds: attempt.targetPhraseIds.filter((phraseId) => phraseId !== id),
            detectedPhraseIds: attempt.detectedPhraseIds.filter((phraseId) => phraseId !== id),
            confirmedPhraseIds: attempt.confirmedPhraseIds.filter((phraseId) => phraseId !== id),
            evidenceEligiblePhraseIds: attempt.evidenceEligiblePhraseIds?.filter((phraseId) => phraseId !== id),
          })),
          grammarProgress: state.grammarProgress.map((progress) => ({
            ...progress,
            ...(progress.productionTargetPhraseId === id ? { productionTargetPhraseId: undefined } : {}),
            ...(progress.transferTargetPhraseId === id ? { transferTargetPhraseId: undefined } : {}),
          })),
        }
        })
        return { id }
      },
      advancePhraseActivation: (phraseId, stage, response, selfConfirmed = false) => set((state) => {
        const nowDate = new Date()
        const now = nowDate.toISOString()
        return {
          phrases: state.phrases.map((phrase) => phrase.id === phraseId
            && (phrase.activationStage ?? 0) + 1 === stage
            && activationStageIsSpaced(phrase, nowDate)
            && (stage !== 5 || selfConfirmed)
            && activationResponseMatches(phrase, stage, response)
            ? { ...phrase, activationStage: stage, activationUpdatedAt: now, activationEvents: appendActivationEvent(phrase.activationEvents, { stage, completedAt: now, evidenceVersion: 1 as const, response: response.trim(), ...(stage === 5 ? { selfConfirmed: true } : {}) }), updatedAt: now }
            : phrase),
        }
      }),
      recordUnqualifiedActivationAttempt: (phraseId, stage, supportUsed) => set((state) => {
        const now = new Date().toISOString()
        return {
          phrases: state.phrases.map((phrase) => phrase.id === phraseId && (phrase.activationStage ?? 0) + 1 === stage
            ? { ...phrase, activationEvents: appendActivationEvent(phrase.activationEvents, { stage, completedAt: now, qualified: false, supportUsed }), updatedAt: now }
            : phrase),
        }
      }),
      resumeSuspendedSkills: () => {
        const count = get().skillStates.filter((skillState) => skillState.phase === 'suspended').length
        if (!count) return 0
        const dueAt = new Date().toISOString()
        set((state) => ({
          skillStates: state.skillStates.map((skillState) => skillState.phase === 'suspended'
            ? { ...skillState, phase: 'relearning' as const, dueAt, learningStep: 0, lapses: Math.max(0, skillState.lapses - 2), consecutiveSuccesses: 0 }
            : skillState),
        }))
        return count
      },
      recordPracticeExposure: (phraseId, skill, sessionKey, source) => {
        if (!sessionKey.trim()) return
        set((state) => {
          const target = state.phrases.find((phrase) => phrase.id === phraseId)
          if (!target || target.status === 'archived') return state
          if (target.practiceExposures?.some((exposure) => exposure.sessionKey === sessionKey && exposure.source === source)) return state
          const exposedAt = new Date().toISOString()
          return {
            phrases: state.phrases.map((phrase) => phrase.id === phraseId
              ? {
                  ...phrase,
                  practiceExposures: appendPracticeExposure(phrase.practiceExposures, {
                    id: crypto.randomUUID(),
                    skill,
                    exposedAt,
                    source,
                    sessionKey,
                  }),
                  updatedAt: exposedAt,
                }
              : phrase),
          }
        })
      },
      recordReview: (input) => {
        const currentState = get()
        const existing = currentState.reviews.find((review) => review.idempotencyKey === input.idempotencyKey)
        if (existing) return existing.grade
        const reviewedAt = new Date()
        const phrase = currentState.phrases.find((candidate) => candidate.id === input.phraseId)
        if (!phrase || phrase.status === 'archived') return 0
        const recentOtherExposure = phraseHasRecentPracticeExposure(phrase, currentState.reviews, reviewedAt, input.idempotencyKey)
        const stateIndex = currentState.skillStates.findIndex((state) => state.phraseId === input.phraseId && state.skill === input.skill)
        const before = stateIndex >= 0 ? currentState.skillStates[stateIndex] : initialSkillState(input.phraseId, input.skill)
        const externalSupportUsed = input.supportUsed === true || recentOtherExposure
        const grade = effectiveGrade(input.requestedGrade, input.hintsUsed + (externalSupportUsed ? 1 : 0), input.revealUsed, input.answerMatched)
        if (before.attempts > 0 && !isDue(before, reviewedAt)) return grade
        const after = scheduleReview(before, grade, reviewedAt)
        const event = {
          id: crypto.randomUUID(),
          idempotencyKey: input.idempotencyKey,
          targetType: 'phrase' as const,
          targetId: input.phraseId,
          skill: input.skill,
          exerciseType: input.skill === 'cloze' ? 'cloze_chunk' as const : input.skill === 'written_productive' ? 'constrained_sentence' as const : 'meaning_to_chunk' as const,
          response: input.response,
          grade,
          hintsUsed: input.hintsUsed,
          revealUsed: input.revealUsed,
          supportUsed: externalSupportUsed || input.hintsUsed > 0 || input.revealUsed,
          reviewedAt: reviewedAt.toISOString(),
          dueBefore: before.dueAt,
          dueAfter: after.dueAt,
        }
        set((state) => {
          const skillStates = [...state.skillStates]
          const index = skillStates.findIndex((item) => item.phraseId === input.phraseId && item.skill === input.skill)
          if (index >= 0) skillStates[index] = after
          else skillStates.push(after)
          return {
            skillStates,
            // Bounded history: keep the most recent events so a multi-year daily
            // profile cannot grow past the 9 MiB write limit and lock all writes.
            reviews: [event, ...state.reviews].slice(0, MAX_REVIEW_HISTORY),
            phrases: state.phrases.map((item) => {
              if (item.id !== input.phraseId) return item
              const delayedActivationPass = (item.activationStage ?? 0) === 7
                && isIndependentWrittenProductiveEvidence(event, item, state.reviews, reviewedAt)
                && Boolean(item.activationUpdatedAt && reviewedAt.getTime() - new Date(item.activationUpdatedAt).getTime() >= 12 * 60 * 60 * 1000)
              return { ...item, status: item.status === 'needs_enrichment' ? item.status : 'learning', activationStage: delayedActivationPass ? 8 as const : item.activationStage, activationUpdatedAt: delayedActivationPass ? reviewedAt.toISOString() : item.activationUpdatedAt, activationEvents: delayedActivationPass ? appendActivationEvent(item.activationEvents, { stage: 8 as const, completedAt: reviewedAt.toISOString(), evidenceId: event.id }) : item.activationEvents, updatedAt: reviewedAt.toISOString() }
            }),
          }
        })
        return grade
      },
      recordSpeakingAttempt: async (input) => {
        if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 1) return { error: 'Record at least one second before saving an attempt.' }
        const durationLimit = speakingDurationLimit(input.mode, input.round)
        if (input.durationSeconds > durationLimit) return { error: `This ${input.mode === 'fluency_432' ? 'fluency round' : 'speaking task'} cannot exceed ${durationLimit} seconds.` }
        if (!input.transcript.trim() && !input.recordingId) return { error: 'Add a recording or a transcript before saving an attempt.' }
        const id = crypto.randomUUID()
        const createdAt = new Date().toISOString()
        return commitData<MutationResult>(get, (data) => set(data), (state) => {
          const existing = state.speakingAttempts.find((attempt) => attempt.idempotencyKey === input.idempotencyKey)
          if (existing) return { result: { id: existing.id } }
          const targetPhraseIds = [...new Set(input.targetPhraseIds)].filter((phraseId) => state.phrases.some((phrase) => phrase.id === phraseId && phrase.status !== 'archived'))
          let inheritedSupportUsed = false
          let inheritedTargetFormVisible = false
          if (input.mode === 'fluency_432') {
            if (!input.recordingId) return { result: { error: 'Each 60/45/30 round needs a saved audio take.' } }
            const family = state.speakingAttempts
              .filter((attempt) => attempt.mode === 'fluency_432' && attempt.sessionId === input.sessionId)
              .sort((left, right) => (left.round ?? 0) - (right.round ?? 0))
            const expectedRound = family.length + 1
            if (input.round !== expectedRound || expectedRound > 3) return { result: { error: `Save fluency rounds in order. Round ${Math.min(expectedRound, 3)} is required next.` } }
            const first = family[0]
            if (first && (first.prompt.trim() !== input.prompt.trim() || !samePhraseTargets(first.targetPhraseIds, targetPhraseIds))) return { result: { error: 'Keep the same prompt and target chunks through all three fluency rounds.' } }
            inheritedSupportUsed = family.some((attempt) => attempt.supportUsed)
            inheritedTargetFormVisible = family.some((attempt) => attempt.targetFormVisible !== false)
          }
          const detectedPhraseIds = targetPhraseIds.filter((phraseId) => {
            const phrase = state.phrases.find((item) => item.id === phraseId)
            return phrase ? includesPhrase(input.transcript, phrase.canonical, phrase.acceptedForms) : false
          })
          const confirmedPhraseIds = [...new Set(input.confirmedPhraseIds)].filter((phraseId) => detectedPhraseIds.includes(phraseId))
          const evidenceEligiblePhraseIds = targetPhraseIds.filter((phraseId) => {
            const phrase = state.phrases.find((item) => item.id === phraseId)
            return Boolean(phrase && hasQualifiedActivationThrough(phrase, 6, new Date(createdAt)))
          })
          const promptExposesTarget = targetPhraseIds.some((phraseId) => {
            const phrase = state.phrases.find((item) => item.id === phraseId)
            return Boolean(phrase && includesPhrase(input.prompt, phrase.canonical, phrase.acceptedForms))
          })
          const attempt: SpeakingAttempt = {
            ...input,
            id,
            targetPhraseIds,
            detectedPhraseIds,
            confirmedPhraseIds,
            evidenceEligiblePhraseIds,
            transcript: input.transcript.trim(),
            targetFormVisible: input.targetFormVisible || inheritedTargetFormVisible || promptExposesTarget,
            supportUsed: input.supportUsed || inheritedSupportUsed,
            createdAt,
          }
          const evidencePhraseIds = speakingEvidencePhraseIds(attempt, state.phrases)
          const skillStates = [...state.skillStates]
          for (const phraseId of evidencePhraseIds) {
            const index = skillStates.findIndex((item) => item.phraseId === phraseId && item.skill === 'spoken_productive')
            const before = index >= 0 ? skillStates[index] : initialSkillState(phraseId, 'spoken_productive')
            if (before.attempts > 0 && !isDue(before, new Date(createdAt))) continue
            const after = scheduleReview(before, 2, new Date(createdAt))
            if (index >= 0) skillStates[index] = after
            else skillStates.push(after)
          }
          return {
            data: {
              ...forgeDataFromState(state),
              speakingAttempts: [attempt, ...state.speakingAttempts].slice(0, MAX_SPEAKING_HISTORY),
              skillStates,
              phrases: state.phrases.map((phrase) => evidencePhraseIds.includes(phrase.id) && (phrase.activationStage ?? 0) >= 6 && (phrase.activationStage ?? 0) < 7
                ? { ...phrase, activationStage: 7 as const, activationUpdatedAt: createdAt, activationEvents: appendActivationEvent(phrase.activationEvents, { stage: 7 as const, completedAt: createdAt, evidenceId: id }), updatedAt: createdAt }
                : phrase),
            },
            result: { id },
          }
        })
      },
      deleteSpeakingAttempt: async (id) => {
        const resetAt = new Date()
        return commitData(get, (data) => set(data), (state) => {
          const selected = state.speakingAttempts.find((attempt) => attempt.id === id)
          if (!selected) return { result: [] }
          const removed = selected.mode === 'fluency_432'
            ? state.speakingAttempts.filter((attempt) => attempt.mode === 'fluency_432' && attempt.sessionId === selected.sessionId)
            : [selected]
          const removedIds = new Set(removed.map((attempt) => attempt.id))
          const speakingAttempts = state.speakingAttempts.filter((attempt) => !removedIds.has(attempt.id))
          const affectedPhraseIds = new Set(removed.flatMap((attempt) => speakingEvidencePhraseIds(attempt, state.phrases)))
          const skillStates = state.skillStates.map((skillState) => {
            if (skillState.skill !== 'spoken_productive' || !affectedPhraseIds.has(skillState.phraseId)) return skillState
            let rebuilt = initialSkillState(skillState.phraseId, 'spoken_productive', resetAt)
            for (const attempt of [...speakingAttempts].sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
              const attemptedAt = new Date(attempt.createdAt)
              if (speakingEvidencePhraseIds(attempt, state.phrases).includes(skillState.phraseId) && (rebuilt.attempts === 0 || isDue(rebuilt, attemptedAt))) rebuilt = scheduleReview(rebuilt, 2, attemptedAt)
            }
            return rebuilt
          })
          const phrases = state.phrases.map((phrase) => {
            if (!affectedPhraseIds.has(phrase.id)) return phrase
            const survivingEvidence = speakingAttempts.filter((attempt) => speakingEvidencePhraseIds(attempt, state.phrases).includes(phrase.id)).sort((left, right) => left.createdAt.localeCompare(right.createdAt))
            if (survivingEvidence.length) {
              const stageSevenEvidence = survivingEvidence[0]
              const stageSevenAt = new Date(stageSevenEvidence.createdAt).getTime()
              const validStageEightEvents = (phrase.activationEvents ?? []).filter((event) => event.stage === 8 && new Date(event.completedAt).getTime() - stageSevenAt >= 12 * 60 * 60 * 1000)
              const activationEvents = [
                ...(phrase.activationEvents ?? []).filter((event) => event.stage < 7),
                { stage: 7 as const, completedAt: stageSevenEvidence.createdAt, evidenceId: stageSevenEvidence.id },
                ...validStageEightEvents,
              ].sort((left, right) => left.completedAt.localeCompare(right.completedAt)).slice(-100)
              const remainsDelayed = (phrase.activationStage ?? 0) >= 8 && validStageEightEvents.length > 0
              const activationUpdatedAt = remainsDelayed ? validStageEightEvents.at(-1)!.completedAt : stageSevenEvidence.createdAt
              return { ...phrase, activationStage: remainsDelayed ? 8 as const : 7 as const, activationEvents, activationUpdatedAt, updatedAt: resetAt.toISOString() }
            }
            if ((phrase.activationStage ?? 0) < 7) return phrase
            const activationEvents = (phrase.activationEvents ?? []).filter((event) => event.stage < 7)
            const lastPreSpeaking = [...activationEvents].sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0]
            return { ...phrase, status: phrase.status === 'archived' ? phrase.status : 'learning' as const, activationStage: 6 as const, activationEvents, activationUpdatedAt: lastPreSpeaking?.completedAt ?? phrase.activationUpdatedAt, updatedAt: resetAt.toISOString() }
          })
          return {
            data: { ...forgeDataFromState(state), speakingAttempts, skillStates, phrases },
            result: removed.map((attempt) => attempt.recordingId).filter((recordingId): recordingId is string => Boolean(recordingId)),
          }
        })
      },
      addListeningClip: async (clip) => {
        if (!Number.isFinite(clip.durationSeconds) || clip.durationSeconds < 1 || clip.durationSeconds > 300) throw new Error('A listening clip must be between 1 and 300 seconds.')
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        return commitData(get, (data) => set(data), (state) => ({
          data: { ...forgeDataFromState(state), listeningClips: [{ ...clip, id, title: clip.title.trim() || 'Untitled listening clip', createdAt: now, updatedAt: now }, ...state.listeningClips] },
          result: id,
        }))
      },
      recordListeningAttempt: async (input) => {
        if (!input.sourceId.trim() || !input.response.trim()) throw new Error('Complete the listening response before saving it.')
        if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 1 || input.durationSeconds > 300) throw new Error('Listening practice must be between 1 and 300 seconds.')
        if (input.playbackCompleted !== true) throw new Error('Finish playing the audio before saving listening practice.')
        const comprehensionParts = [input.comprehensionQuestion, input.comprehensionResponse, input.comprehensionExpectedResponse, input.comprehensionMatched]
        const comprehensionStarted = comprehensionParts.some((value) => value !== undefined)
        if (comprehensionStarted && comprehensionParts.some((value) => value === undefined)) throw new Error('Comprehension evidence requires the question, response, expected-answer snapshot and result together.')
        const derived = deriveListeningResults(input)
        if (input.answerMatched !== derived.answerMatched || (comprehensionStarted && input.comprehensionMatched !== derived.comprehensionMatched)) throw new Error('Listening results must match the saved responses and reference snapshots.')
        const id = crypto.randomUUID()
        const createdAt = new Date().toISOString()
        return commitData(get, (data) => set(data), (state) => ({
          data: { ...forgeDataFromState(state), listeningAttempts: [{ ...input, id, sourceId: input.sourceId.trim(), response: input.response.trim(), listeningEvidenceVersion: LISTENING_EVIDENCE_VERSION, createdAt }, ...state.listeningAttempts].slice(0, 10_000) },
          result: id,
        }))
      },
      updateListeningClip: async (id, patch) => {
        const updatedAt = new Date().toISOString()
        await commitData(get, (data) => set(data), (state) => ({
          data: { ...forgeDataFromState(state), listeningClips: state.listeningClips.map((clip) => clip.id === id ? { ...clip, ...patch, title: patch.title?.trim() || clip.title, updatedAt } : clip) },
          result: undefined,
        }))
      },
      deleteListeningClip: async (id) => {
        return commitData(get, (data) => set(data), (state) => {
          const recordingId = state.listeningClips.find((clip) => clip.id === id)?.recordingId
          if (!recordingId) return { result: undefined }
          return {
            data: { ...forgeDataFromState(state), listeningClips: state.listeningClips.filter((clip) => clip.id !== id) },
            result: recordingId,
          }
        })
      },
      addError: (input) => {
        if (!input.original.trim() || !input.correction.trim()) return { error: 'Add both the original and corrected sentence.' }
        if (!input.transferPrompt?.trim() || !input.transferAnswer?.trim()) return { error: 'Add a distinct new-context prompt and its accepted transfer answer.' }
        if (normalizePhrase(input.transferPrompt) === normalizePhrase(input.original) || normalizePhrase(input.transferAnswer) === normalizePhrase(input.correction)) return { error: 'The transfer must use a genuinely different sentence.' }
        const duplicate = get().errors.find((error) => normalizePhrase(error.original) === normalizePhrase(input.original))
        if (duplicate) {
          const now = new Date().toISOString()
          set((state) => ({ errors: state.errors.map((error) => {
            if (error.id !== duplicate.id) return error
            const current = deriveErrorEvidence(error, new Date(now)).pattern
            return deriveErrorEvidence({
              ...current,
              observations: [{ id: crypto.randomUUID(), observedAt: now, evidenceVersion: 1 }, ...(current.observations ?? [])],
              status: 'active',
              updatedAt: now,
            }, new Date(now)).pattern
          }) }))
          return { duplicateId: duplicate.id }
        }
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const transferPrompt = input.transferPrompt?.trim() ?? ''
        const transferAnswer = input.transferAnswer?.trim()
        set((state) => {
          const pattern = deriveErrorEvidence({ ...input, id, label: input.label.trim() || 'Personal grammar pattern', original: input.original.trim(), correction: input.correction.trim(), occurrences: 1, observations: [{ id: crypto.randomUUID(), observedAt: now, evidenceVersion: 1 }], transferPrompt, transferAnswer: transferPrompt && transferAnswer ? transferAnswer : undefined, status: 'active', dueAt: now, cycleStartedAt: now, attempts: [], createdAt: now, updatedAt: now }, new Date(now)).pattern
          return { errors: [pattern, ...state.errors] }
        })
        return { id }
      },
      recordErrorAttempt: (errorId, response, _correct, supportUsed, transfer) => set((state) => ({
        errors: state.errors.map((error) => {
          if (error.id !== errorId) return error
          const now = new Date()
          const current = deriveErrorEvidence(error, now)
          if (new Date(current.pattern.dueAt).getTime() > now.getTime()) return current.pattern
          const snapshot = errorAttemptContractSnapshot(current.pattern, transfer)
          const attempt = {
            id: crypto.randomUUID(),
            response,
            ...snapshot,
            correct: errorAttemptResponseMatches(current.pattern, { response, transfer, ...snapshot }),
            supportUsed,
            transfer,
            attemptedAt: now.toISOString(),
          }
          return deriveErrorEvidence({
            ...current.pattern,
            attempts: [attempt, ...current.pattern.attempts],
            updatedAt: now.toISOString(),
          }, now).pattern
        }),
      })),
      updateError: (id, patch) => {
        if (patch.correction !== undefined && !patch.correction.trim()) return
        const now = new Date().toISOString()
        set((state) => ({
          errors: state.errors.map((error) => {
            if (error.id !== id) return error
            const updatedAt = new Date(now)
            const current = deriveErrorEvidence(error, updatedAt).pattern
            const nextOriginal = patch.original?.trim() ?? error.original
            const nextCorrection = patch.correction?.trim() ?? error.correction
            const nextTransferPrompt = patch.transferPrompt?.trim() ?? error.transferPrompt
            const nextTransferAnswer = patch.transferAnswer === undefined ? error.transferAnswer : patch.transferAnswer.trim() || undefined
            const repairContractChanged = normalizePhrase(nextOriginal) !== normalizePhrase(error.original)
              || normalizePhrase(nextCorrection) !== normalizePhrase(error.correction)
              || normalizePhrase(nextTransferPrompt) !== normalizePhrase(error.transferPrompt)
              || normalizePhrase(nextTransferAnswer ?? '') !== normalizePhrase(error.transferAnswer ?? '')
            const manuallyObserved = patch.status === 'observed'
            return deriveErrorEvidence({
              ...current,
              ...patch,
              original: nextOriginal,
              correction: nextCorrection,
              transferPrompt: nextTransferPrompt,
              transferAnswer: nextTransferAnswer,
              // Evidence-bearing fields are never writable through a generic
              // metadata patch.
              attempts: current.attempts,
              observations: current.observations,
              occurrences: current.occurrences,
              legacyOccurrences: current.legacyOccurrences,
              evidenceVersion: 1,
              answerContractFingerprint: errorAnswerContractFingerprint({ original: nextOriginal, correction: nextCorrection, transferPrompt: nextTransferPrompt, transferAnswer: nextTransferAnswer }),
              answerContractUpdatedAt: repairContractChanged ? now : current.answerContractUpdatedAt,
              ...(repairContractChanged || manuallyObserved ? {
                status: manuallyObserved ? 'observed' as const : 'active' as const,
                dueAt: now,
                cycleStartedAt: now,
              } : {}),
              updatedAt: now,
            }, updatedAt).pattern
          }),
        }))
      },
      updateMissionDraft: (missionId, draft) => set((state) => ({
        missions: state.missions.map((mission) => mission.id === missionId && !mission.legacyContract ? { ...mission, draft, status: 'active' } : mission),
      })),
      deleteMission: (missionId) => {
        if (!get().missions.some((mission) => mission.id === missionId)) return false
        set((state) => ({ missions: state.missions.filter((mission) => mission.id !== missionId) }))
        return true
      },
      completeMission: (missionId, confirmedPhraseIds, selfConfirmed) => {
        const state = get()
        const mission = state.missions.find((item) => item.id === missionId)
        if (!mission || mission.legacyContract || !missionConfigurationIsValid(mission, state.phrases) || !missionTargetsWereEligibleAt(mission, state.phrases, state.reviews)) return false
        const wordCount = mission.draft.trim() ? mission.draft.trim().split(/\s+/u).length : 0
        if (wordCount < mission.minWords || wordCount > mission.maxWords || !selfConfirmed || !missionDraftHasLexicalVariety(mission.draft)) return false
        const detected = new Set(detectMissionTargets(mission, state.phrases, mission.draft))
        const completedAt = new Date().toISOString()
        const confirmed = new Set(confirmedPhraseIds.filter((phraseId) => detected.has(phraseId)))
        if (confirmed.size !== mission.targetPhraseIds.length) return false
        set((current) => ({
          missions: current.missions.map((item) => item.id === missionId ? {
            ...item,
            response: item.draft,
            targetResults: item.targetPhraseIds.map((phraseId) => ({ phraseId, confirmed: confirmed.has(phraseId) })),
            status: 'done',
            completedAt,
            selfConfirmedAt: completedAt,
          } : item),
        }))
        return true
      },
      createMission: (mission) => {
        const state = get()
        const createdAt = new Date().toISOString()
        const candidate = { ...mission, createdAt }
        if (!missionConfigurationIsValid(mission, state.phrases) || !missionTargetsWereEligibleAt(candidate, state.phrases, state.reviews)) return
        set((state) => ({
          missions: [{
            ...mission,
            supportUsed: mission.supportUsed ?? false,
            id: crypto.randomUUID(),
            draft: '',
            status: 'planned' as const,
            targetResults: mission.targetPhraseIds.map((phraseId) => ({ phraseId, confirmed: false })),
            createdAt,
          }, ...state.missions].slice(0, MAX_MISSION_HISTORY),
        }))
      },
      createSuggestedMission: () => {
        const state = get()
        const activeMission = state.missions.find((mission) => !mission.legacyContract && mission.status !== 'done' && mission.level === state.preferences.currentLevel && missionConfigurationIsValid(mission, state.phrases) && missionTargetsWereEligibleAt(mission, state.phrases, state.reviews))
        if (activeMission) return activeMission.id
        const level = state.preferences.currentLevel
        const requirements = missionRequirementsForLevel(level)
        const targetPhraseIds = selectMissionTargetIds(state.phrases, state.skillStates, state.reviews, level, requirements.maxTargetPhrases)
        if (targetPhraseIds.length < requirements.minTargetPhrases) return undefined
        const id = crypto.randomUUID()
        const focusError = state.errors.find((error) => error.status === 'active')
        set((current) => ({ missions: [{
          id,
          level,
          title: `${level} activation brief ${current.missions.filter((mission) => mission.status === 'done').length + 1}`,
          prompt: level === 'A2'
            ? 'Write a short everyday message or note. Use the target expressions naturally in clear, complete sentences.'
            : level === 'B1'
              ? 'Write a clear everyday or work update. Connect your ideas and use both target expressions naturally.'
              : 'Write a concise real-world update or opinion. Use the target expressions naturally; clarity matters more than length.',
          targetPhraseIds,
          minWords: requirements.minWords,
          maxWords: requirements.maxWords,
          targetPhraseCount: targetPhraseIds.length,
          supportUsed: false,
          grammarTarget: focusError?.rule,
          draft: '',
          status: 'planned',
          targetResults: targetPhraseIds.map((phraseId) => ({ phraseId, confirmed: false })),
          createdAt: new Date().toISOString(),
        }, ...current.missions] }))
        return id
      },
      completePlacement: async (selected, listeningDiagnostic) => {
        const { isCompletePlacementSelection, placementAnswers, scorePlacement, PLACEMENT_QUESTION_SET_VERSION } = await import('../data/placementTest')
        if (!isCompletePlacementSelection(selected) || (listeningDiagnostic && !isCompletePlacementListeningDiagnostic(listeningDiagnostic))) return false
        const result = scorePlacement(selected)
        const completedAt = new Date().toISOString()
        if (listeningDiagnostic && new Date(listeningDiagnostic.completedAt).getTime() > new Date(completedAt).getTime()) return false
        set((state) => {
          const nextLevel = ({ A2: 'B1', B1: 'B2', B2: 'C1', C1: 'C1' } as const)[result.suggestedLevel]
          return {
            placementAttempts: [{ questionSetVersion: PLACEMENT_QUESTION_SET_VERSION, answers: placementAnswers(selected), score: result.score, maxScore: result.maxScore, suggestedLevel: result.suggestedLevel, bandScores: result.bandScores, ...(listeningDiagnostic ? { listeningDiagnostic: structuredClone(listeningDiagnostic) } : {}), id: crypto.randomUUID(), completedAt }, ...state.placementAttempts].slice(0, 20),
            preferences: { ...state.preferences, currentLevel: result.suggestedLevel, targetLevel: nextLevel, placementCompletedAt: completedAt },
            missions: state.missions,
          }
        })
        return true
      },
      recordGrammarProgress: async (lessonId, attemptNumber, answers) => {
        if (!lessonId || !Number.isInteger(attemptNumber) || attemptNumber < 0 || attemptNumber > 100_000) return false
        const { grammarAcademyLessons, grammarQuizForAttempt, grammarQuizVariantKey } = await import('../data/grammarAcademy')
        const lesson = grammarAcademyLessons.find((candidate) => candidate.id === lessonId)
        if (!lesson) return false
        const quiz = grammarQuizForAttempt(lesson, attemptNumber)
        const score = scoreGrammarQuizSelections(quiz, answers)
        if (score === undefined) return false
        let recorded = false
        set((state) => {
          const previous = state.grammarProgress.find((progress) => progress.lessonId === lessonId)
          if ((previous?.attempts ?? 0) !== attemptNumber) return state
          const now = new Date().toISOString()
          const bestScore = Math.max(previous?.bestScore ?? 0, score)
          const passed = score / quiz.length >= 0.8
          const quizPassEvidence = previous?.quizPassEvidence ?? []
          const passHistory = quizPassEvidence.map((evidence) => evidence.completedAt)
          const previousPassTime = passHistory.length ? new Date(passHistory.at(-1)!).getTime() : undefined
          const previousVariants = new Set(quizPassEvidence.map((evidence) => grammarQuizVariantKey(lesson, evidence.attemptNumber)))
          const newVariant = !previousVariants.has(grammarQuizVariantKey(lesson, attemptNumber))
          const spacedPass = passed && newVariant && passHistory.length < 2 && (previousPassTime === undefined || Date.now() - previousPassTime >= 12 * 60 * 60 * 1000)
          const nextQuizPassEvidence = spacedPass ? [...quizPassEvidence, {
            evidenceVersion: GRAMMAR_EVIDENCE_VERSION,
            attemptNumber,
            answers: answers.map((answer) => ({ ...answer })),
            completedAt: now,
          }] : quizPassEvidence
          const nextPassHistory = nextQuizPassEvidence.map((evidence) => evidence.completedAt)
          const passes = nextPassHistory.length
          const lastPassedAt = nextPassHistory.at(-1)
          const next: GrammarLessonProgress = { ...previous, lessonId, attempts: attemptNumber + 1, passes, passHistory: nextPassHistory, quizPassEvidence: nextQuizPassEvidence, bestScore, totalQuestions: quiz.length, lastScore: score, lastAttemptedAt: now, lastPassedAt }
          if (!next.completedAt && hasCurrentGrammarMastery(next)) {
            next.completedAt = now
            next.masteryEvidenceVersion = 6
            next.nextCumulativeDueAt = new Date(Date.now() + GRAMMAR_CHECKPOINT_INITIAL_DELAY_MS).toISOString()
          }
          recorded = true
          return { grammarProgress: [next, ...state.grammarProgress.filter((progress) => progress.lessonId !== lessonId)] }
        })
        return recorded
      },
      saveGrammarProduction: (lessonId, draft, totalQuestions, selfConfirmed, targetPhraseId, lessonReferenceTexts) => {
        const cleaned = draft.trim()
        if (!lessonId || !Number.isInteger(totalQuestions) || totalQuestions < 1 || !selfConfirmed || !grammarDraftIsOriginal(cleaned, lessonReferenceTexts)) return false
        let saved = false
        set((state) => {
          const now = new Date().toISOString()
          const previous = state.grammarProgress.find((progress) => progress.lessonId === lessonId)
          const targetPhrase = targetPhraseId ? state.phrases.find((phrase) => phrase.id === targetPhraseId && phrase.status !== 'archived') : undefined
          if (targetPhraseId && (!targetPhrase || !includesPhrase(cleaned, targetPhrase.canonical, targetPhrase.acceptedForms))) return {}
          const unchanged = Boolean(previous?.productionSelfConfirmedAt)
            && normalizePhrase(previous?.productionDraft ?? '') === normalizePhrase(cleaned)
            && previous?.productionTargetPhraseId === targetPhraseId
          const next: GrammarLessonProgress = {
            ...previous,
            lessonId,
            attempts: previous?.attempts ?? 0,
            passes: previous?.passes ?? 0,
            passHistory: previous?.passHistory ?? [],
            bestScore: previous?.bestScore ?? 0,
            totalQuestions,
            lastAttemptedAt: previous?.lastAttemptedAt ?? now,
            productionDraft: cleaned,
            productionSavedAt: unchanged ? previous?.productionSavedAt ?? now : now,
            productionSelfConfirmedAt: unchanged ? previous?.productionSelfConfirmedAt ?? now : now,
            productionTargetPhraseId: targetPhraseId,
            transferDraft: unchanged ? previous?.transferDraft : undefined,
            transferSavedAt: unchanged ? previous?.transferSavedAt : undefined,
            transferSelfConfirmedAt: unchanged ? previous?.transferSelfConfirmedAt : undefined,
            transferTargetPhraseId: unchanged ? previous?.transferTargetPhraseId : undefined,
            transferCheckEvidence: unchanged ? previous?.transferCheckEvidence : undefined,
            completedAt: unchanged ? previous?.completedAt : undefined,
            legacyCompletedAt: unchanged ? previous?.legacyCompletedAt : previous?.legacyCompletedAt ?? previous?.completedAt,
            masteryEvidenceVersion: unchanged ? previous?.masteryEvidenceVersion : undefined,
          }
          saved = true
          return { grammarProgress: [next, ...state.grammarProgress.filter((progress) => progress.lessonId !== lessonId)] }
        })
        return saved
      },
      recordGrammarTransferCheck: async (lessonId, attemptNumber, answers) => {
        if (!lessonId || !Number.isInteger(attemptNumber) || attemptNumber < 0 || attemptNumber > 100_000) return false
        const { grammarAcademyLessons, grammarQuizForAttempt } = await import('../data/grammarAcademy')
        const lesson = grammarAcademyLessons.find((candidate) => candidate.id === lessonId)
        if (!lesson) return false
        const quiz = grammarQuizForAttempt(lesson, attemptNumber)
        if (scoreGrammarQuizSelections(quiz, answers) !== quiz.length) return false
        let recorded = false
        set((state) => {
          const previous = state.grammarProgress.find((progress) => progress.lessonId === lessonId)
          const now = new Date()
          if (!previous?.productionSavedAt || now.getTime() - new Date(previous.productionSavedAt).getTime() < GRAMMAR_TRANSFER_DELAY_MS) return {}
          const next: GrammarLessonProgress = {
            ...previous,
            transferCheckEvidence: {
              evidenceVersion: GRAMMAR_EVIDENCE_VERSION,
              attemptNumber,
              answers: answers.map((answer) => ({ ...answer })),
              completedAt: now.toISOString(),
            },
          }
          recorded = true
          return { grammarProgress: [next, ...state.grammarProgress.filter((progress) => progress.lessonId !== lessonId)] }
        })
        return recorded
      },
      saveGrammarTransfer: (lessonId, draft, totalQuestions, selfConfirmed, targetPhraseId, lessonReferenceTexts) => {
        const cleaned = draft.trim()
        if (!lessonId || !Number.isInteger(totalQuestions) || totalQuestions < 1 || !selfConfirmed || !grammarDraftIsOriginal(cleaned, lessonReferenceTexts)) return false
        let saved = false
        set((state) => {
          const now = new Date().toISOString()
          const previous = state.grammarProgress.find((progress) => progress.lessonId === lessonId)
          if (!previous?.productionSavedAt || Date.now() - new Date(previous.productionSavedAt).getTime() < GRAMMAR_TRANSFER_DELAY_MS) return {}
          if (!previous.transferCheckEvidence || new Date(previous.transferCheckEvidence.completedAt).getTime() - new Date(previous.productionSavedAt).getTime() < GRAMMAR_TRANSFER_DELAY_MS) return {}
          if (normalizePhrase(previous.productionDraft ?? '') === normalizePhrase(cleaned)) return {}
          const targetPhrase = targetPhraseId ? state.phrases.find((phrase) => phrase.id === targetPhraseId && phrase.status !== 'archived') : undefined
          if (targetPhraseId && (!targetPhrase || !includesPhrase(cleaned, targetPhrase.canonical, targetPhrase.acceptedForms))) return {}
          const unchanged = Boolean(previous.transferSelfConfirmedAt)
            && normalizePhrase(previous.transferDraft ?? '') === normalizePhrase(cleaned)
            && previous.transferTargetPhraseId === targetPhraseId
          const next: GrammarLessonProgress = {
            ...previous,
            transferDraft: cleaned,
            transferSavedAt: unchanged ? previous.transferSavedAt ?? now : now,
            transferSelfConfirmedAt: unchanged ? previous.transferSelfConfirmedAt ?? now : now,
            transferTargetPhraseId: targetPhraseId,
          }
          if (hasCurrentGrammarMastery(next)) {
            next.completedAt = unchanged ? previous.completedAt ?? now : now
            next.masteryEvidenceVersion = 6
            next.nextCumulativeDueAt = previous.nextCumulativeDueAt ?? new Date(Date.now() + GRAMMAR_CHECKPOINT_INITIAL_DELAY_MS).toISOString()
          }
          saved = true
          return { grammarProgress: [next, ...state.grammarProgress.filter((progress) => progress.lessonId !== lessonId)] }
        })
        return saved
      },
      recordGrammarCorrection: async (lessonId, response) => {
        if (!lessonId || !response.trim()) return false
        const { grammarAcademyLessons } = await import('../data/grammarAcademy')
        const lesson = grammarAcademyLessons.find((candidate) => candidate.id === lessonId)
        if (!lesson || !grammarCorrectionMatches(response, lesson.commonMistake.correct)) return false
        let recorded = false
        set((state) => {
          const now = new Date().toISOString()
          const previous = state.grammarProgress.find((progress) => progress.lessonId === lessonId)
          const correctionEvidence = previous?.correctionEvidence ?? { evidenceVersion: GRAMMAR_EVIDENCE_VERSION, response: response.trim(), completedAt: now }
          const next: GrammarLessonProgress = {
            ...previous,
            lessonId,
            attempts: previous?.attempts ?? 0,
            passes: previous?.passes ?? 0,
            passHistory: previous?.passHistory ?? [],
            bestScore: previous?.bestScore ?? 0,
            quizPassEvidence: previous?.quizPassEvidence ?? [],
            totalQuestions: lesson.quiz.length,
            lastAttemptedAt: previous?.lastAttemptedAt ?? now,
            correctionPassedAt: correctionEvidence.completedAt,
            correctionEvidence,
          }
          if (!next.completedAt && hasCurrentGrammarMastery(next)) {
            next.completedAt = now
            next.masteryEvidenceVersion = 6
            next.nextCumulativeDueAt = new Date(Date.now() + GRAMMAR_CHECKPOINT_INITIAL_DELAY_MS).toISOString()
          }
          recorded = true
          return { grammarProgress: [next, ...state.grammarProgress.filter((progress) => progress.lessonId !== lessonId)] }
        })
        return recorded
      },
      recordGrammarCheckpoint: (results, validLessonIds) => {
        if (!results.length || results.length > 8 || new Set(results.map((result) => result.lessonId)).size !== results.length) return false
        const validLessonIdSet = new Set(validLessonIds)
        if (!validLessonIdSet.size || results.some((result) => !validLessonIdSet.has(result.lessonId))) return false
        let saved = false
        set((state) => {
          if (results.some((result) => !state.grammarProgress.some((progress) => progress.lessonId === result.lessonId))) return {}
          const now = new Date().toISOString()
          const resultByLesson = new Map(results.map((result) => [result.lessonId, result.correct]))
          const updatedProgress = state.grammarProgress.map((progress) => {
            const correct = resultByLesson.get(progress.lessonId)
            if (correct === undefined) return progress
            const cumulativeAttempts = (progress.cumulativeAttempts ?? 0) + 1
            const cumulativeCorrect = (progress.cumulativeCorrect ?? 0) + (correct ? 1 : 0)
            const previousIntervalDays = progress.nextCumulativeDueAt && progress.lastCumulativeReviewedAt
              ? Math.max(0, Math.round((new Date(progress.nextCumulativeDueAt).getTime() - new Date(progress.lastCumulativeReviewedAt).getTime()) / (24 * 60 * 60 * 1000)))
              : 0
            const delayDays = correct ? (previousIntervalDays >= 7 ? Math.min(30, previousIntervalDays + 7) : 7) : 1
            return { ...progress, cumulativeAttempts, cumulativeCorrect, lastCumulativeReviewedAt: now, nextCumulativeDueAt: new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString() }
          })
          const score = results.filter((result) => result.correct).length
          const passed = score / results.length >= 0.8
          const checkpoint: GrammarLessonProgress = {
            lessonId: `checkpoint-${state.preferences.currentLevel}-${crypto.randomUUID()}`,
            attempts: 1,
            passes: 0,
            passHistory: [],
            legacyPasses: passed ? 1 : 0,
            bestScore: score,
            totalQuestions: results.length,
            lastScore: score,
            lastAttemptedAt: now,
            legacyLastPassedAt: passed ? now : undefined,
          }
          saved = true
          // Synthetic checkpoint rows accrue one per cumulative review; bound them
          // to the most recent runs while preserving every real lesson-progress row.
          const withCheckpoint = [checkpoint, ...updatedProgress]
          const recentCheckpoints = withCheckpoint.filter((progress) => progress.lessonId.startsWith('checkpoint-')).slice(0, MAX_CHECKPOINT_HISTORY)
          const keptCheckpoints = new Set(recentCheckpoints.map((progress) => progress.lessonId))
          return { grammarProgress: withCheckpoint.filter((progress) => !progress.lessonId.startsWith('checkpoint-') || keptCheckpoints.has(progress.lessonId)) }
        })
        return saved
      },
      updatePreferences: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),
      importProfile: async (data) => {
        const validated = validateForgeData(data)
        await assertProfileRecordingsAvailable(validated)
        await commitData(get, (next) => set(next), () => ({ data: validated, result: undefined }))
      },
      resetToDemo: async () => {
        const { createSeedData } = await import('../data/seed')
        await commitData(get, (data) => set(data), () => ({ data: createSeedData(), result: undefined }))
      },
      clearAll: async () => { await commitData(get, (data) => set(data), () => ({
        data: createEmptyData(),
        result: undefined,
      })) },
      createProfile: async (name: string) => {
        // Let in-flight durable writes finish against the current profile, then hold a
        // write barrier so no stray persist targets the wrong slot during the switch.
        await durableMutationQueue.catch(() => undefined)
        setProfileWriteBarrier(true)
        try {
          await createProfileEntry(name)
          // The new slot starts empty; write empty data into it so the store reflects
          // a fresh learner (which routes to placement) instead of the previous profile.
          await commitData(get, (data) => set(data), () => ({ data: createEmptyData(), result: undefined }))
        } finally {
          setProfileWriteBarrier(false)
        }
      },
      switchProfile: async (id: string) => {
        await durableMutationQueue.catch(() => undefined)
        setProfileWriteBarrier(true)
        try {
          await switchProfileEntry(id)
          beginProfileHydration()
          await useForgeStore.persist.rehydrate()
        } finally {
          setProfileWriteBarrier(false)
        }
      },
      renameProfile: async (id: string, name: string) => {
        await renameProfileEntry(id, name)
      },
      deleteProfile: async (id: string) => {
        await durableMutationQueue.catch(() => undefined)
        setProfileWriteBarrier(true)
        let removed: Awaited<ReturnType<typeof deleteProfileEntry>>
        try {
          removed = await deleteProfileEntry(id)
          // Only reload when the active profile was the one removed.
          if (removed?.wasActive) {
            beginProfileHydration()
            await useForgeStore.persist.rehydrate()
          }
        } finally {
          setProfileWriteBarrier(false)
        }
        // Delete the removed profile's own recordings (siblings' audio is untouched).
        for (const recordingId of removed?.recordingIds ?? []) {
          try { await deleteRecording(recordingId) } catch { /* orphan retried at next startup reconciliation */ }
        }
      },
    }),
    {
      name: PROFILE_STORAGE_KEY,
      version: 6,
      storage: createJSONStorage(() => profileContainerStorage),
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        dailyVocabularyAssignment: state.dailyVocabularyAssignment,
        dailyVocabularyAssignments: state.dailyVocabularyAssignments,
        phrases: state.phrases,
        skillStates: state.skillStates,
        reviews: state.reviews,
        errors: state.errors,
        missions: state.missions,
        speakingAttempts: state.speakingAttempts,
        listeningClips: state.listeningClips,
        listeningAttempts: state.listeningAttempts,
        placementAttempts: state.placementAttempts,
        grammarProgress: state.grammarProgress,
        preferences: state.preferences,
      }),
      migrate: (persisted) => validateForgeData(persisted),
      merge: (persisted, current) => {
        if (persisted === undefined || persisted === null) return current
        try {
          return { ...current, ...validateForgeData(persisted) }
        } catch (error) {
          enterProfileRecovery(`The saved profile failed validation and was not loaded. ${error instanceof Error ? error.message : ''}`)
          return current
        }
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) enterProfileRecovery(error)
        else markProfileReady()
      },
    },
  ),
)

useForgeStore.persist.onHydrate(() => beginProfileHydration())

export function detectMissionTargets(mission: Mission, phrases: Phrase[], response: string): string[] {
  return mission.targetPhraseIds.filter((id) => {
    const phrase = phrases.find((item) => item.id === id)
    return phrase ? includesPhrase(response, phrase.canonical, phrase.acceptedForms) : false
  })
}
