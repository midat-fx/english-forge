import { describe, expect, it } from 'vitest'
import type { LexicalCatalogItem } from './lexicalCatalog'
import { catalogItemTag, createDailyVocabularyAssignment, DAILY_NEW_ITEM_COUNT, DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT, dailyVocabularyItems, learnedTodayCount, localDayKey, replaceDailyVocabularyItem, resolveDailyVocabularyAssignment } from './dailyVocabulary'

function item(index: number): LexicalCatalogItem {
  return {
    id: `item-${index}`, level: 'B1', expression: `expression ${index}`, kind: 'word',
    translationRu: `перевод ${index}`, meaningEn: `meaning ${index}`, example: `This is example ${index}.`,
    exampleTranslationRu: `Это пример ${index}.`, topic: 'test', register: 'neutral', activationReady: true,
  }
}

function levelItem(index: number, level: 'A2' | 'B1'): LexicalCatalogItem {
  return { ...item(index), id: `${level.toLowerCase()}-item-${index}`, expression: `${level} expression ${index}`, level }
}

describe('daily vocabulary plan', () => {
  const items = Array.from({ length: 40 }, (_, index) => item(index))
  const today = new Date(2026, 6, 20, 12)

  it('returns exactly ten stable items for a day', () => {
    const first = dailyVocabularyItems(items, 'B1', [], today)
    const second = dailyVocabularyItems(items, 'B1', [], new Date(2026, 6, 20, 23, 59))
    expect(first).toHaveLength(10)
    expect(second.map((entry) => entry.id)).toEqual(first.map((entry) => entry.id))
  })

  it('uses the local calendar boundary rather than the UTC date', () => {
    const beforeMidnight = new Date(2026, 6, 20, 23, 59, 59)
    const afterMidnight = new Date(2026, 6, 21, 0, 0, 1)
    expect(localDayKey(beforeMidnight)).toBe('2026-07-20')
    expect(localDayKey(afterMidnight)).toBe('2026-07-21')
    expect(createDailyVocabularyAssignment(items, 'B1', [], beforeMidnight).dayKey).not.toBe(
      createDailyVocabularyAssignment(items, 'B1', [], afterMidnight).dayKey,
    )
  })

  it('spreads adjacent source groups across a daily pack', () => {
    const pack = dailyVocabularyItems(items, 'B1', [], today)
    const sourceIndexes = pack.map((entry) => items.findIndex((source) => source.id === entry.id))
    expect(new Set(sourceIndexes.map((value, index) => value - index)).size).toBeGreaterThan(1)
  })

  it('keeps items enrolled today and excludes them on the next day', () => {
    const assigned = dailyVocabularyItems(items, 'B1', [], today)
    const known = assigned.map((entry) => ({ canonical: entry.expression, createdAt: '2026-07-20T10:00:00.000Z', status: 'new' }))
    expect(dailyVocabularyItems(items, 'B1', known, today).map((entry) => entry.id)).toEqual(assigned.map((entry) => entry.id))
    expect(learnedTodayCount(assigned, known, today)).toBe(10)
    expect(dailyVocabularyItems(items, 'B1', known, new Date(2026, 6, 21, 12)).some((entry) => assigned.includes(entry))).toBe(false)
  })

  it('does not present completed discovery items as new until the eligible level pool is exhausted', () => {
    const catalog = items.slice(0, 20)
    const firstDay = createDailyVocabularyAssignment(catalog, 'B1', [], today)
    const completedFirstDay = { ...firstDay, previewedIds: [...firstDay.itemIds] }
    const nextDay = new Date(2026, 6, 21, 12)
    const secondDay = createDailyVocabularyAssignment(catalog, 'B1', [], nextDay, 10, [completedFirstDay])

    expect(secondDay.itemIds).toHaveLength(10)
    expect(secondDay.itemIds.every((id) => !firstDay.itemIds.includes(id))).toBe(true)

    const exhaustedCatalog = catalog.slice(0, 10)
    const exhaustedFirstDay = createDailyVocabularyAssignment(exhaustedCatalog, 'B1', [], today)
    const exhaustedHistory = [{ ...exhaustedFirstDay, previewedIds: [...exhaustedFirstDay.itemIds] }]
    expect(createDailyVocabularyAssignment(exhaustedCatalog, 'B1', [], nextDay, 10, exhaustedHistory).itemIds).toHaveLength(10)
  })

  it('retains enough preview history for the largest level despite four-level daily switching', () => {
    const largestCurrentLevel = Array.from({ length: 800 }, (_, index) => ({ ...item(index), id: `a2-history-${index}`, level: 'A2' as const }))
    const levels = ['A2', 'B1', 'B2', 'C1'] as const
    const seen = new Set<string>()
    let history: ReturnType<typeof createDailyVocabularyAssignment>[] = []

    for (let dayOffset = 0; dayOffset < 80; dayOffset += 1) {
      const date = new Date(2026, 0, 1 + dayOffset, 12)
      const assignment = createDailyVocabularyAssignment(largestCurrentLevel, 'A2', [], date, DAILY_NEW_ITEM_COUNT, history)
      expect(assignment.itemIds).toHaveLength(DAILY_NEW_ITEM_COUNT)
      expect(assignment.itemIds.some((id) => seen.has(id))).toBe(false)
      assignment.itemIds.forEach((id) => seen.add(id))
      const previewed = { ...assignment, previewedIds: [...assignment.itemIds] }
      const switchedLevelPlaceholders = levels.slice(1).map((level) => ({ dayKey: localDayKey(date), level, itemIds: [], enrolledIds: [] }))
      history = [previewed, ...switchedLevelPlaceholders, ...history].slice(0, DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT)
    }

    expect(seen).toHaveLength(800)
    expect(history).toHaveLength(DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT)
    const afterExhaustion = createDailyVocabularyAssignment(largestCurrentLevel, 'A2', [], new Date(2026, 2, 22, 12), DAILY_NEW_ITEM_COUNT, history)
    expect(afterExhaustion.itemIds).toHaveLength(DAILY_NEW_ITEM_COUNT)
    expect(afterExhaustion.itemIds.every((id) => seen.has(id))).toBe(true)
  })

  it('keeps a persisted assignment stable when phrase records are archived or edited', () => {
    const assignment = createDailyVocabularyAssignment(items, 'B1', [], today)
    const before = dailyVocabularyItems(items, 'B1', [], today, 10, assignment)
    const changedPhrases = [
      { canonical: before[0].expression, createdAt: '2026-07-19T10:00:00.000Z', status: 'archived', meaning: 'known', context: 'A complete example.' },
      { canonical: before[1].expression, createdAt: '2026-07-19T10:00:00.000Z', status: 'learning', meaning: 'edited', context: 'A changed example.' },
    ]
    expect(dailyVocabularyItems(items, 'B1', changedPhrases, today, 10, assignment).map((entry) => entry.id)).toEqual(assignment.itemIds)
  })

  it('uses the durable catalog id after an enrolled phrase canonical is edited', () => {
    const smallCatalog = items.slice(0, 11)
    const candidate = dailyVocabularyItems(smallCatalog, 'B1', [], today)[0]
    const editedKnown = [{
      canonical: 'a personally edited wording', createdAt: '2026-07-19T10:00:00.000Z', status: 'learning',
      meaning: 'known', context: 'This is a personally edited wording in context.', tags: [catalogItemTag(candidate.id)],
    }]
    const assignment = createDailyVocabularyAssignment(smallCatalog, 'B1', editedKnown, today)
    expect(assignment.itemIds).not.toContain(candidate.id)
    expect(assignment.itemIds).toHaveLength(10)
  })

  it('recognizes a same-day edited enrollment by its durable catalog tag', () => {
    const candidate = dailyVocabularyItems(items, 'B1', [], today)[0]
    const editedKnown = [{
      canonical: 'my edited wording', createdAt: today.toISOString(), status: 'learning',
      meaning: 'known', context: 'This is my edited wording in context.', tags: [catalogItemTag(candidate.id)],
    }]
    const assignment = createDailyVocabularyAssignment(items, 'B1', editedKnown, today)
    expect(assignment.itemIds).toContain(candidate.id)
    expect(assignment.enrolledIds).toContain(candidate.id)
  })

  it('preserves same-day enrollment from a durable tag after the personal card is archived', () => {
    const candidate = dailyVocabularyItems(items, 'B1', [], today)[0]
    const archived = [{
      canonical: 'an edited archived wording', createdAt: today.toISOString(), status: 'archived',
      meaning: 'known', context: 'This is an edited archived wording in context.', tags: [catalogItemTag(candidate.id)],
    }]
    const assignment = createDailyVocabularyAssignment(items, 'B1', archived, today)
    expect(assignment.itemIds).toContain(candidate.id)
    expect(assignment.enrolledIds).toContain(candidate.id)
  })

  it('skips an archived learned phrase when creating a new assignment', () => {
    const smallCatalog = items.slice(0, 11)
    const candidate = dailyVocabularyItems(smallCatalog, 'B1', [], today)[0]
    const archivedKnown = [{ canonical: candidate.expression, createdAt: '2026-07-19T10:00:00.000Z', status: 'archived', meaning: 'known', context: `This example uses ${candidate.expression} naturally.` }]
    const assignment = createDailyVocabularyAssignment(smallCatalog, 'B1', archivedKnown, today)
    expect(assignment.itemIds).not.toContain(candidate.id)
    expect(assignment.itemIds).toHaveLength(10)
  })

  it('does not count an incomplete quick capture as enrolled', () => {
    const assigned = dailyVocabularyItems(items, 'B1', [], today)
    const quickCapture = [{ canonical: assigned[0].expression, createdAt: today.toISOString(), status: 'needs_enrichment', meaning: '', context: '' }]
    const assignment = createDailyVocabularyAssignment(items, 'B1', quickCapture, today)
    expect(assignment.enrolledIds).toEqual([])
    expect(learnedTodayCount(assigned, quickCapture, today)).toBe(0)
  })

  it('creates a full pack when there is no persisted assignment', () => {
    const resolution = resolveDailyVocabularyAssignment(items, 'B1', [], today, 10, null)
    expect(resolution.repaired).toBe(false)
    expect(resolution.assignment.itemIds).toHaveLength(10)
  })

  it('uses reference rows for Discovery but never treats them as deep-cycle enrollment', () => {
    const referenceOnly = { ...item(100), id: 'reference-only', activationReady: false }
    const catalog = [...items, referenceOnly]
    const generated = createDailyVocabularyAssignment(catalog, 'B1', [], today, 41)
    expect(generated.itemIds).toContain(referenceOnly.id)

    const persisted = {
      dayKey: localDayKey(today), level: 'B1' as const,
      itemIds: [referenceOnly.id, ...generated.itemIds.slice(1, 10)], enrolledIds: [referenceOnly.id],
    }
    const resolution = resolveDailyVocabularyAssignment(catalog, 'B1', [], today, 10, persisted)
    expect(resolution.repaired).toBe(true)
    expect(resolution.assignment.itemIds).toContain(referenceOnly.id)
    expect(resolution.assignment.enrolledIds).not.toContain(referenceOnly.id)
  })

  it('fills a default Discovery pack from reference-only bilingual rows without deep enrollment', () => {
    const references = Array.from({ length: 14 }, (_, index) => ({
      ...item(200 + index), id: `reference-${index}`, activationReady: false,
    }))
    const knownToday = references.map((entry) => ({
      canonical: entry.expression, createdAt: today.toISOString(), status: 'learning',
      meaning: entry.meaningEn, context: entry.example, tags: [catalogItemTag(entry.id)],
    }))
    const assignment = createDailyVocabularyAssignment(references, 'B1', knownToday, today)

    expect(assignment.itemIds).toHaveLength(10)
    expect(assignment.itemIds.every((id) => id.startsWith('reference-'))).toBe(true)
    expect(assignment.enrolledIds).toEqual([])
  })

  it('repairs a mixed persisted pack while retaining enrollment only for activation-ready rows', () => {
    const mixed = Array.from({ length: 12 }, (_, index) => ({
      ...item(300 + index), id: `mixed-${index}`, activationReady: index % 2 === 0,
    }))
    const persisted = {
      dayKey: localDayKey(today), level: 'B1' as const,
      itemIds: mixed.slice(0, 10).map((entry) => entry.id),
      enrolledIds: mixed.slice(0, 10).map((entry) => entry.id),
    }
    const repaired = resolveDailyVocabularyAssignment(mixed, 'B1', [], today, 10, persisted)

    expect(repaired.repaired).toBe(true)
    expect(repaired.assignment.itemIds).toEqual(persisted.itemIds)
    expect(repaired.assignment.enrolledIds).toEqual(mixed.slice(0, 10).filter((entry) => entry.activationReady).map((entry) => entry.id))
  })

  it('creates a separate current-level pack after the learning level changes', () => {
    const mixedCatalog = [
      ...Array.from({ length: 15 }, (_, index) => levelItem(index, 'A2')),
      ...Array.from({ length: 15 }, (_, index) => levelItem(index, 'B1')),
    ]
    const b1 = createDailyVocabularyAssignment(mixedCatalog, 'B1', [], today)
    const switched = resolveDailyVocabularyAssignment(mixedCatalog, 'A2', [], today, 10, b1)
    const switchedBack = resolveDailyVocabularyAssignment(mixedCatalog, 'B1', [], today, 10, switched.assignment)
    expect(switched.assignment.level).toBe('A2')
    expect(switched.assignment.itemIds.every((id) => id.startsWith('a2-'))).toBe(true)
    expect(switchedBack.assignment).toEqual(b1)
  })

  it.each([
    ['zero-item', []],
    ['missing-id', ['retired-item-id']],
    ['duplicate-id', ['item-1', 'item-1']],
    ['wrong-level-id', ['a2-item']],
  ])('repairs a same-day %s persisted assignment', (_label, itemIds) => {
    const catalog = [...items, { ...item(100), id: 'a2-item', level: 'A2' as const }]
    const persisted = { dayKey: '2026-07-20', level: 'B1' as const, itemIds, enrolledIds: [] }
    const resolution = resolveDailyVocabularyAssignment(catalog, 'B1', [], today, 10, persisted)
    expect(resolution.repaired).toBe(true)
    expect(resolution.assignment.itemIds).toHaveLength(10)
    expect(new Set(resolution.assignment.itemIds).size).toBe(10)
    expect(resolution.assignment.itemIds.every((id) => catalog.find((entry) => entry.id === id)?.level === 'B1')).toBe(true)
  })

  it('repairs only a retired slot and preserves every surviving same-day id in place', () => {
    const persisted = createDailyVocabularyAssignment(items, 'B1', [], today)
    const retiredId = persisted.itemIds[4]
    const updatedCatalog = [...items.filter((entry) => entry.id !== retiredId), item(400)]
    const resolution = resolveDailyVocabularyAssignment(updatedCatalog, 'B1', [], today, 10, persisted)

    expect(resolution.repaired).toBe(true)
    expect(resolution.assignment.itemIds).toHaveLength(10)
    expect(resolution.assignment.itemIds[4]).not.toBe(retiredId)
    persisted.itemIds.forEach((id, index) => {
      if (id !== retiredId) expect(resolution.assignment.itemIds[index]).toBe(id)
    })
  })

  it('keeps a persisted pack stable if local-midnight reclassification makes one timestamp look older', () => {
    const persisted = createDailyVocabularyAssignment(items, 'B1', [], today)
    const learnedId = persisted.itemIds[2]
    const learnedItem = items.find((entry) => entry.id === learnedId)!
    const known = [{
      canonical: learnedItem.expression, createdAt: '2026-07-19T10:00:00.000Z', status: 'retained',
      meaning: 'known', context: 'A complete example.', tags: [catalogItemTag(learnedId)],
    }]
    const resolution = resolveDailyVocabularyAssignment(items, 'B1', known, today, 10, persisted)

    expect(resolution.repaired).toBe(false)
    expect(resolution.assignment).toBe(persisted)
  })

  it('replaces or defers one daily card without changing the other positions or cycling back', () => {
    const assignment = createDailyVocabularyAssignment(items, 'B1', [], today)
    const removedId = assignment.itemIds[3]
    const first = replaceDailyVocabularyItem(items, [], assignment, removedId, today)
    const firstReplacement = first.itemIds[3]
    const second = replaceDailyVocabularyItem(items, [], first, firstReplacement, today)

    expect(first).not.toBe(assignment)
    expect(first.itemIds[3]).not.toBe(removedId)
    assignment.itemIds.forEach((id, index) => {
      if (index !== 3) expect(first.itemIds[index]).toBe(id)
    })
    expect(second.itemIds[3]).not.toBe(firstReplacement)
    expect(second.itemIds[3]).not.toBe(removedId)
  })

  it('keeps a replacement enrolled only when an existing same-day phrase owns it', () => {
    const assignment = createDailyVocabularyAssignment(items, 'B1', [], today)
    const preliminary = replaceDailyVocabularyItem(items, [], assignment, assignment.itemIds[0], today)
    const replacement = items.find((entry) => entry.id === preliminary.itemIds[0])!
    const known = [{
      canonical: replacement.expression, createdAt: today.toISOString(), status: 'new',
      meaning: 'known', context: `This example uses ${replacement.expression} naturally.`, tags: [catalogItemTag(replacement.id)],
    }]
    const replaced = replaceDailyVocabularyItem(items, known, assignment, assignment.itemIds[0], today)
    expect(replaced.enrolledIds).toContain(replacement.id)
  })

  it('does not cycle back to a deferred card when only eleven candidates exist', () => {
    const smallCatalog = items.slice(0, 11)
    const assignment = createDailyVocabularyAssignment(smallCatalog, 'B1', [], today)
    const removedId = assignment.itemIds[0]
    const first = replaceDailyVocabularyItem(smallCatalog, [], assignment, removedId, today)
    const replacementId = first.itemIds[0]
    const second = replaceDailyVocabularyItem(smallCatalog, [], first, replacementId, today)

    expect(first.deferredIds).toEqual([removedId])
    expect(second).toBe(first)
    expect(second.itemIds[0]).toBe(replacementId)
    expect(second.itemIds).not.toContain(removedId)
  })

  it('requires a replacement card to receive its own first-pass preview', () => {
    const assignment = { ...createDailyVocabularyAssignment(items, 'B1', [], today), previewedIds: [] as string[] }
    const removedId = assignment.itemIds[2]
    assignment.previewedIds = [removedId, assignment.itemIds[3]]
    const replaced = replaceDailyVocabularyItem(items, [], assignment, removedId, today)

    expect(replaced.previewedIds).toEqual([assignment.itemIds[3]])
    expect(replaced.previewedIds).not.toContain(replaced.itemIds[2])
  })
})
