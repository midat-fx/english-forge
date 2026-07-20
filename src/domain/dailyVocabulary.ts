import type { CatalogLevel, LexicalCatalogItem } from './lexicalCatalog'
import { includesPhrase, phraseFingerprint } from './normalization'
import type { DailyVocabularyAssignment } from './types'

export const DAILY_NEW_ITEM_COUNT = 10
/**
 * Four level packs can be opened on the same local day. Keeping 80 complete
 * days covers the largest current level catalog (A2: 800 items at ten per
 * pack), so frequent A2/B1/B2/C1 switching cannot evict preview evidence
 * before that level has been exhausted. Keep this bound aligned with the
 * published per-level catalog counts when a level grows beyond 800 items.
 */
export const DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT = 4 * 80
export const CATALOG_ITEM_TAG_PREFIX = 'catalog-item:'

interface KnownPhrase {
  canonical: string
  createdAt: string
  status: string
  meaning?: string
  context?: string
  acceptedForms?: readonly string[]
  tags?: readonly string[]
}

export interface DailyVocabularyResolution {
  assignment: DailyVocabularyAssignment
  repaired: boolean
}

function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function localDayKey(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayNumber(date: Date): number {
  const localDateAsUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const origin = Date.UTC(2026, 0, 1)
  return Math.max(0, Math.floor((localDateAsUtc - origin) / 86_400_000))
}

function stableHash(value: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

/** Spread maintainers' adjacent topic groups across learning days. */
function learningOrder(items: readonly LexicalCatalogItem[], level: CatalogLevel): LexicalCatalogItem[] {
  return [...items].sort((left, right) => {
    const hashDifference = stableHash(`english-forge-v1:${level}:${left.id}`) - stableHash(`english-forge-v1:${level}:${right.id}`)
    return hashDifference || left.id.localeCompare(right.id)
  })
}

interface DailyCatalogState {
  candidates: LexicalCatalogItem[]
  enrolledItemIds: Set<string>
  enrolledFingerprints: Set<string>
}

function dailyCatalogState(
  items: readonly LexicalCatalogItem[],
  level: CatalogLevel,
  knownPhrases: readonly KnownPhrase[],
  date: Date,
  assignmentHistory: readonly DailyVocabularyAssignment[] = [],
): DailyCatalogState {
  const dayKey = localDayKey(date)
  const levelItems = learningOrder(items.filter((item) => item.level === level), level)
  if (!levelItems.length) return { candidates: [], enrolledItemIds: new Set(), enrolledFingerprints: new Set() }
  const levelOffset = ({ A2: 0, B1: 3, B2: 6, C1: 9 } as const)[level]
  const start = ((dayNumber(date) * DAILY_NEW_ITEM_COUNT) + levelOffset) % levelItems.length
  const rotated = [...levelItems.slice(start), ...levelItems.slice(0, start)]

  const todayStart = localDayStart(date).getTime()
  const learnedBeforeToday = new Set(
    knownPhrases
      .filter((phrase) => isPracticeReadyPhrase(phrase) && new Date(phrase.createdAt).getTime() < todayStart)
      .map((phrase) => phraseFingerprint(phrase.canonical)),
  )
  const learnedCatalogIdsBeforeToday = new Set(
    knownPhrases
      .filter((phrase) => isPracticeReadyPhrase(phrase) && new Date(phrase.createdAt).getTime() < todayStart)
      .flatMap((phrase) => catalogItemIdsFromTags(phrase.tags ?? [])),
  )
  const readyToday = knownPhrases.filter((phrase) =>
    isPracticeReadyPhrase(phrase) && localDayKey(new Date(phrase.createdAt)) === dayKey,
  )
  const discoveredBeforeToday = new Set(assignmentHistory
    .filter((assignment) => assignment.level === level && assignment.dayKey !== dayKey)
    .flatMap((assignment) => (assignment.previewedIds ?? []).filter((id) => assignment.itemIds.includes(id))))
  const enrolledFingerprints = new Set(
    readyToday.filter((phrase) => phrase.status !== 'archived').map((phrase) => phraseFingerprint(phrase.canonical)),
  )
  // A durable catalog tag proves explicit enrollment even if the personal card
  // was archived later. This keeps today's completion stable across a same-day
  // level switch, while an unrelated archived manual fingerprint is not inferred.
  const enrolledItemIds = new Set(readyToday.flatMap((phrase) => catalogItemIdsFromTags(phrase.tags ?? [])))
  const eligible = rotated.filter((item) =>
    !learnedCatalogIdsBeforeToday.has(item.id)
    && !learnedBeforeToday.has(phraseFingerprint(item.expression)))
  return {
    // Completed discovery items return only after every still-unseen eligible
    // item at this level has had its first retrieval encounter.
    candidates: [
      ...eligible.filter((item) => !discoveredBeforeToday.has(item.id)),
      ...eligible.filter((item) => discoveredBeforeToday.has(item.id)),
    ],
    enrolledItemIds,
    enrolledFingerprints,
  }
}

function isEnrolledToday(item: LexicalCatalogItem, state: DailyCatalogState): boolean {
  return item.activationReady === true
    && (state.enrolledItemIds.has(item.id) || state.enrolledFingerprints.has(phraseFingerprint(item.expression)))
}

function assignmentFromCatalogState(
  state: DailyCatalogState,
  level: CatalogLevel,
  date: Date,
  limit: number,
): DailyVocabularyAssignment {
  const selected = limit > 0 ? state.candidates.slice(0, limit) : []
  return {
    dayKey: localDayKey(date),
    level,
    itemIds: selected.map((item) => item.id),
    enrolledIds: selected.filter((item) => isEnrolledToday(item, state)).map((item) => item.id),
  }
}

export function catalogItemTag(itemId: string): string {
  return `${CATALOG_ITEM_TAG_PREFIX}${itemId}`
}

export function catalogItemIdsFromTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => tag.startsWith(CATALOG_ITEM_TAG_PREFIX)).map((tag) => tag.slice(CATALOG_ITEM_TAG_PREFIX.length))
}

export function hasPracticeReadyContent(phrase: Pick<KnownPhrase, 'canonical' | 'meaning' | 'context' | 'acceptedForms'>): boolean {
  if (phrase.meaning === undefined && phrase.context === undefined) return true
  return Boolean(phrase.meaning?.trim()
    && phrase.context?.trim()
    && includesPhrase(phrase.context, phrase.canonical, [...(phrase.acceptedForms ?? [])]))
}

export function isPracticeReadyPhrase(phrase: KnownPhrase): boolean {
  if (phrase.status === 'needs_enrichment') return false
  return hasPracticeReadyContent(phrase)
}

export function isDailyVocabularyAssignmentFor(
  assignment: DailyVocabularyAssignment | null | undefined,
  level: CatalogLevel,
  date = new Date(),
): assignment is DailyVocabularyAssignment {
  return assignment?.dayKey === localDayKey(date) && assignment.level === level
}

export function createDailyVocabularyAssignment(
  items: readonly LexicalCatalogItem[],
  level: CatalogLevel,
  knownPhrases: readonly KnownPhrase[],
  date = new Date(),
  limit = DAILY_NEW_ITEM_COUNT,
  assignmentHistory: readonly DailyVocabularyAssignment[] = [],
): DailyVocabularyAssignment {
  const state = dailyCatalogState(items, level, knownPhrases, date, assignmentHistory)
  return assignmentFromCatalogState(state, level, date, limit)
}

/**
 * Preserves a valid persisted pack, but replaces assignments that can no longer
 * be rendered against the current catalog (for example after a catalog update
 * or a validly-shaped import containing retired ids).
 */
export function resolveDailyVocabularyAssignment(
  items: readonly LexicalCatalogItem[],
  level: CatalogLevel,
  knownPhrases: readonly KnownPhrase[],
  date = new Date(),
  limit = DAILY_NEW_ITEM_COUNT,
  persisted?: DailyVocabularyAssignment | null,
  assignmentHistory: readonly DailyVocabularyAssignment[] = [],
): DailyVocabularyResolution {
  const state = dailyCatalogState(items, level, knownPhrases, date, assignmentHistory)
  const generated = assignmentFromCatalogState(state, level, date, limit)
  if (!isDailyVocabularyAssignmentFor(persisted, level, date)) return { assignment: generated, repaired: false }

  const levelItems = items.filter((item) => item.level === level)
  const itemById = new Map(levelItems.map((item) => [item.id, item]))
  const levelCatalogSize = new Set(levelItems.map((item) => item.id)).size
  const targetCount = Math.min(Math.max(0, limit), levelCatalogSize)
  const slots: Array<string | undefined> = Array.from({ length: targetCount })
  const selectedIds = new Set<string>()

  // A catalog release should repair only the retired or no-longer-eligible slots.
  // Keeping surviving ids prevents nine unrelated cards from changing because one
  // catalog entry was renamed or removed during the day.
  for (const [index, id] of persisted.itemIds.slice(0, targetCount).entries()) {
    const item = itemById.get(id)
    // Do not reclassify a surviving persisted id as "previously learned" here.
    // A timezone change can move a same instant across the local-midnight
    // boundary; the explicit day+level assignment remains the stronger record.
    if (!item || selectedIds.has(id)) continue
    slots[index] = id
    selectedIds.add(id)
  }
  const deferredSet = new Set(persisted.deferredIds ?? [])
  const replacements = state.candidates.map((item) => item.id).filter((id) => !selectedIds.has(id) && !deferredSet.has(id))
  for (let index = 0; index < slots.length; index += 1) {
    if (slots[index]) continue
    const replacement = replacements.shift()
    if (!replacement) break
    slots[index] = replacement
    selectedIds.add(replacement)
  }
  const retainedIds = slots.filter((id): id is string => Boolean(id))
  const deferredIds = [...deferredSet].filter((id) => itemById.has(id) && !selectedIds.has(id))

  const enrolledIds: string[] = []
  const enrolledSet = new Set<string>()
  for (const id of persisted.enrolledIds) {
    if (!selectedIds.has(id) || enrolledSet.has(id) || itemById.get(id)?.activationReady !== true) continue
    enrolledIds.push(id)
    enrolledSet.add(id)
  }
  for (const id of retainedIds) {
    const item = itemById.get(id)
    if (!item || enrolledSet.has(id) || !isEnrolledToday(item, state)) continue
    enrolledIds.push(id)
    enrolledSet.add(id)
  }
  const previewedIds = [...new Set(persisted.previewedIds ?? [])].filter((id) => selectedIds.has(id))
  const assignment: DailyVocabularyAssignment = {
    dayKey: generated.dayKey,
    level,
    itemIds: retainedIds,
    enrolledIds,
    ...(previewedIds.length ? { previewedIds } : {}),
    ...(deferredIds.length ? { deferredIds } : {}),
  }
  const unchanged = assignment.itemIds.length === persisted.itemIds.length
    && assignment.enrolledIds.length === persisted.enrolledIds.length
    && (assignment.previewedIds?.length ?? 0) === (persisted.previewedIds?.length ?? 0)
    && (assignment.deferredIds?.length ?? 0) === (persisted.deferredIds?.length ?? 0)
    && assignment.itemIds.every((id, index) => id === persisted.itemIds[index])
    && assignment.enrolledIds.every((id, index) => id === persisted.enrolledIds[index])
    && (assignment.previewedIds ?? []).every((id, index) => id === persisted.previewedIds?.[index])
    && (assignment.deferredIds ?? []).every((id, index) => id === persisted.deferredIds?.[index])

  return unchanged
    ? { assignment: persisted, repaired: false }
    : { assignment, repaired: true }
}

/**
 * Replaces one card in a current persisted pack without reshuffling the other
 * positions. The next eligible catalog card is chosen after the removed card in
 * the deterministic learning order, so repeated replacements advance instead of
 * immediately cycling back to the previous card.
 */
export function replaceDailyVocabularyItem(
  items: readonly LexicalCatalogItem[],
  knownPhrases: readonly KnownPhrase[],
  assignment: DailyVocabularyAssignment,
  itemId: string,
  date = new Date(),
  assignmentHistory: readonly DailyVocabularyAssignment[] = [],
): DailyVocabularyAssignment {
  if (!isDailyVocabularyAssignmentFor(assignment, assignment.level, date)) return assignment
  const replacementIndex = assignment.itemIds.indexOf(itemId)
  if (replacementIndex < 0) return assignment

  const state = dailyCatalogState(items, assignment.level, knownPhrases, date, assignmentHistory)
  const assignedIds = new Set(assignment.itemIds)
  const deferredIds = new Set(assignment.deferredIds ?? [])
  const removedIndex = state.candidates.findIndex((item) => item.id === itemId)
  const start = removedIndex >= 0 ? removedIndex + 1 : 0
  let replacement: LexicalCatalogItem | undefined
  for (let offset = 0; offset < state.candidates.length; offset += 1) {
    const candidate = state.candidates[(start + offset) % state.candidates.length]
    if (!assignedIds.has(candidate.id) && !deferredIds.has(candidate.id)) {
      replacement = candidate
      break
    }
  }
  if (!replacement) return assignment

  const itemIds = [...assignment.itemIds]
  itemIds[replacementIndex] = replacement.id
  const enrolledIds = assignment.enrolledIds.filter((id) => id !== itemId && id !== replacement.id)
  if (isEnrolledToday(replacement, state)) enrolledIds.push(replacement.id)
  const previewedIds = (assignment.previewedIds ?? []).filter((id) => id !== itemId && id !== replacement.id)
  return { ...assignment, itemIds, enrolledIds, previewedIds, deferredIds: [...deferredIds, itemId] }
}

/**
 * Produces a stable ten-item learning pack for the local day. Items learned before
 * today are skipped, while items added today remain in the pack after enrollment.
 */
export function dailyVocabularyItems(
  items: readonly LexicalCatalogItem[],
  level: CatalogLevel,
  knownPhrases: readonly KnownPhrase[],
  date = new Date(),
  limit = DAILY_NEW_ITEM_COUNT,
  assignment?: DailyVocabularyAssignment | null,
  assignmentHistory: readonly DailyVocabularyAssignment[] = [],
): LexicalCatalogItem[] {
  const selected = isDailyVocabularyAssignmentFor(assignment, level, date)
    ? assignment
    : createDailyVocabularyAssignment(items, level, knownPhrases, date, limit, assignmentHistory)
  const itemById = new Map(items.filter((item) => item.level === level).map((item) => [item.id, item]))
  return selected.itemIds.map((id) => itemById.get(id)).filter((item): item is LexicalCatalogItem => Boolean(item))
}

export function learnedTodayCount(items: readonly LexicalCatalogItem[], knownPhrases: readonly KnownPhrase[], date = new Date()): number {
  const today = localDayKey(date)
  const dailyIds = new Set(items.map((item) => phraseFingerprint(item.expression)))
  return new Set(
    knownPhrases
      .filter((phrase) => phrase.status !== 'archived' && isPracticeReadyPhrase(phrase) && localDayKey(new Date(phrase.createdAt)) === today && dailyIds.has(phraseFingerprint(phrase.canonical)))
      .map((phrase) => phraseFingerprint(phrase.canonical)),
  ).size
}
