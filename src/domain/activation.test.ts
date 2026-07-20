import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { catalogItemTag } from './dailyVocabulary'
import { PERSONAL_CATALOG_ENRICHMENT_TAG } from './lexicalCatalog'
import { activationBacklogSize, activationBlockedByMissingErrorPattern, activationDailyQuota, activationWorkDoneToday, buildDailyActivationQueue, qualifiedActivationStageAt } from './activation'
import { activationEventsThrough } from '../test/activationEvidence'

describe('distributed activation queue', () => {
  it('schedules at most one persisted next step per phrase and prefers a started cycle', () => {
    const data = createSeedData()
    const phrases = data.phrases.slice(0, 3).map((phrase, index) => ({ ...phrase, activationStage: index, activationEvents: [], activationUpdatedAt: index ? '2026-07-17T08:00:00.000Z' : '2026-07-18T08:00:00.000Z' }))
    const queue = buildDailyActivationQueue(phrases, null, new Date('2026-07-18T12:00:00.000Z'), 2)
    expect(queue).toEqual([
      { phraseId: phrases[1].id, skill: 'cloze', mode: 'context_choice' },
      { phraseId: phrases[2].id, skill: 'cloze', mode: 'cloze' },
    ])
  })

  it('reports a visible bounded daily quota without erasing the backlog', () => {
    const data = createSeedData()
    // activationEvents is cleared for the same reason the sibling test above clears it:
    // the seed stamps its events relative to `new Date()`, so leaving them in place makes
    // this fixture drift across the pinned date and the assertion below fail on whichever
    // real-world day `ago(7 - stage)` happens to land on 2026-07-18.
    const phrases = data.phrases.slice(0, 8).map((phrase, index) => ({ ...phrase, activationStage: index < 2 ? 1 : 0, activationEvents: [], activationUpdatedAt: index < 2 ? '2026-07-17T09:00:00.000Z' : undefined }))
    expect(activationWorkDoneToday(phrases, new Date('2026-07-18T12:00:00.000Z'))).toBe(0)
    expect(activationBacklogSize(phrases) + activationBlockedByMissingErrorPattern(phrases)).toBe(8)
    expect(activationBacklogSize(phrases)).toBeGreaterThan(0)
    expect(buildDailyActivationQueue(phrases, null, new Date('2026-07-18T12:00:00.000Z'), 6, 1)).toHaveLength(3)
  })

  it('does not disguise a missing reviewed usage error as a completed sixth step', () => {
    const phrase = { ...createSeedData().phrases[0], canonical: 'evidence', acceptedForms: [], context: 'The evidence changed our view.', activationStage: 5 as const, depth: { ...createSeedData().phrases[0].depth, contrasts: [] } }
    expect(activationBlockedByMissingErrorPattern([phrase])).toBe(1)
    expect(activationBacklogSize([phrase])).toBe(0)
    expect(buildDailyActivationQueue([phrase], null, new Date('2026-07-18T12:00:00.000Z'))).toEqual([])
  })

  it('admits safe Steps 1-5 before a personal Step-6 error pair exists', () => {
    const seed = createSeedData().phrases[0]
    const phrase = { ...seed, canonical: 'evidence', acceptedForms: [], context: 'The evidence changed our view.', activationEvents: [], activationUpdatedAt: undefined, activationError: undefined, depth: { ...seed.depth, contrasts: [] } }
    const expected = [
      { skill: 'meaning_recall', mode: 'recognition' },
      { skill: 'cloze', mode: 'context_choice' },
      { skill: 'cloze', mode: 'cloze' },
      { skill: 'meaning_recall', mode: 'russian_recall' },
      { skill: 'written_productive', mode: 'own_sentence' },
    ] as const

    for (const [activationStage, next] of expected.entries()) {
      const candidate = { ...phrase, activationStage: activationStage as 0 | 1 | 2 | 3 | 4 }
      expect(activationBlockedByMissingErrorPattern([candidate])).toBe(0)
      expect(buildDailyActivationQueue([candidate], null, new Date('2026-07-18T12:00:00.000Z'), 1, 1)).toEqual([{ phraseId: phrase.id, ...next }])
    }
  })

  it('unlocks Step 6 only after a valid personal error pair is present', () => {
    const seed = createSeedData().phrases[0]
    const phrase = {
      ...seed,
      canonical: 'evidence',
      acceptedForms: [],
      context: 'The evidence changed our view.',
      activationStage: 5 as const,
      activationEvents: [],
      activationUpdatedAt: undefined,
      activationError: {
        incorrectContext: 'The evidences changed our view.',
        expectedCorrection: 'The evidence changed our view.',
        cue: 'Evidence is uncountable in this meaning.',
      },
      depth: { ...seed.depth, contrasts: [] },
    }

    expect(activationBlockedByMissingErrorPattern([phrase])).toBe(0)
    expect(buildDailyActivationQueue([phrase], null, new Date('2026-07-18T12:00:00.000Z'), 1, 1)).toEqual([{ phraseId: phrase.id, skill: 'cloze', mode: 'error_repair' }])
  })

  it('does not let a generated heuristic bypass the personal Step-6 contract', () => {
    const seed = createSeedData().phrases[0]
    const phrase = {
      ...seed,
      canonical: 'make a decision',
      acceptedForms: ['made a decision'],
      context: 'We made a decision before lunch.',
      activationStage: 5 as const,
      activationEvents: [],
      activationUpdatedAt: undefined,
      activationError: undefined,
      tags: [...seed.tags, PERSONAL_CATALOG_ENRICHMENT_TAG],
    }

    expect(activationBlockedByMissingErrorPattern([phrase])).toBe(1)
    expect(activationBacklogSize([phrase])).toBe(0)
    expect(buildDailyActivationQueue([phrase], null, new Date('2026-07-18T12:00:00.000Z'), 1, 1)).toEqual([])
  })

  it('keeps the daily quota stable after every eligible phrase completes one step', () => {
    const completedAt = '2026-07-18T09:00:00.000Z'
    const seed = createSeedData().phrases
    const phrases = Array.from({ length: 10 }, (_, index) => ({ ...seed[index % seed.length], id: `daily-${index}`, activationStage: 1, activationUpdatedAt: completedAt, activationEvents: [{ stage: 1 as const, completedAt }] }))
    const now = new Date('2026-07-18T12:00:00.000Z')
    expect(activationDailyQuota(phrases, null, 20, now)).toBe(10)
    expect(activationWorkDoneToday(phrases, now)).toBe(10)
    expect(buildDailyActivationQueue(phrases, null, now)).toEqual([])
  })

  it('scopes activation to the current level and prioritizes a fresh daily enrollment', () => {
    const data = createSeedData()
    const [first, second, third] = data.phrases
    const unassigned = { ...first, id: 'unassigned-b1', cefr: 'B1' as const, activationStage: 0 as const, activationEvents: [], tags: [], createdAt: '2026-01-01T08:00:00.000Z' }
    const assigned = { ...second, id: 'assigned-b1', cefr: 'B1' as const, activationStage: 0 as const, activationEvents: [], tags: [catalogItemTag('daily-b1')], createdAt: '2026-07-18T08:00:00.000Z' }
    const wrongLevel = { ...third, id: 'assigned-a2', cefr: 'A2' as const, activationStage: 0 as const, activationEvents: [], tags: [catalogItemTag('daily-a2')] }
    const assignment = { dayKey: '2026-07-18', level: 'B1' as const, itemIds: ['daily-b1'], enrolledIds: ['daily-b1'] }

    expect(buildDailyActivationQueue([unassigned, wrongLevel, assigned], assignment, new Date('2026-07-18T12:00:00.000Z'), 2, 2, 'B1').map((item) => item.phraseId)).toEqual([
      assigned.id,
      unassigned.id,
    ])
  })

  it('ignores imported activation events dated before the phrase existed', () => {
    const phrase = { ...createSeedData().phrases[0], createdAt: '2026-07-10T08:00:00.000Z' }
    phrase.activationEvents = activationEventsThrough(phrase, 6, 1).map((event, index) => ({
      ...event,
      completedAt: `2026-07-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
    }))
    expect(qualifiedActivationStageAt(phrase, new Date('2026-07-18T08:00:00.000Z'))).toBe(0)
  })
})
