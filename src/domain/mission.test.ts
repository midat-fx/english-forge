import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { missionRequirementsForLevel, reconcileConfirmedTargets, selectMissionTargetIds } from './mission'
import { activationEventsThrough as qualifiedEventsThrough } from '../test/activationEvidence'

describe('mission target confirmation', () => {
  it('retracts stale automatic detection while preserving manual confirmation', () => {
    expect(reconcileConfirmedTargets(['auto', 'manual'], ['auto'], [])).toEqual(['manual'])
  })

  it('defines an achievable writing range and target load for every level', () => {
    expect(missionRequirementsForLevel('A2')).toEqual({ minWords: 40, maxWords: 70, minTargetPhrases: 1, maxTargetPhrases: 2 })
    expect(missionRequirementsForLevel('B1')).toEqual({ minWords: 80, maxWords: 120, minTargetPhrases: 2, maxTargetPhrases: 2 })
    expect(missionRequirementsForLevel('B2')).toEqual({ minWords: 120, maxWords: 180, minTargetPhrases: 3, maxTargetPhrases: 3 })
    expect(missionRequirementsForLevel('C1')).toEqual(missionRequirementsForLevel('B2'))
  })

  it('selects only same-level studied material and ranks activation evidence first', () => {
    const data = createSeedData()
    const template = data.phrases[0]
    const activation = { ...template, id: 'activation', cefr: 'B1' as const, activationStage: 5 as const, createdAt: '2026-01-03T00:00:00.000Z' }
    activation.activationEvents = qualifiedEventsThrough(activation, 5)
    const phrases = [
      { ...template, id: 'untouched', cefr: 'B1' as const, activationStage: undefined, activationEvents: undefined, createdAt: '2026-01-01T00:00:00.000Z' },
      { ...template, id: 'studied', cefr: 'B1' as const, activationStage: undefined, activationEvents: undefined, createdAt: '2026-01-02T00:00:00.000Z' },
      activation,
      { ...template, id: 'wrong-level', cefr: 'B2' as const, activationStage: 8 as const, createdAt: '2026-01-04T00:00:00.000Z' },
      { ...template, id: 'suspended', cefr: 'B1' as const, activationStage: 8 as const, createdAt: '2026-01-05T00:00:00.000Z' },
    ]
    const skillTemplate = data.skillStates[0]
    const skillStates = [
      { ...skillTemplate, phraseId: 'untouched', attempts: 0 },
      { ...skillTemplate, phraseId: 'studied', attempts: 1 },
      { ...skillTemplate, phraseId: 'suspended', attempts: 4, phase: 'suspended' as const },
    ]

    const futureReview = { ...data.reviews[0], targetId: 'untouched', skill: 'written_productive' as const, grade: 2 as const, hintsUsed: 0, revealUsed: false, supportUsed: false, reviewedAt: '2030-07-18T00:00:00.000Z' }
    const productiveReview = { ...data.reviews[0], id: 'studied-review', idempotencyKey: 'studied-review', targetId: 'studied', skill: 'written_productive' as const, grade: 2 as const, hintsUsed: 0, revealUsed: false, supportUsed: false, response: 'The final result may fall short of expectations this year.', reviewedAt: '2026-07-10T00:00:00.000Z', dueBefore: '2026-07-09T00:00:00.000Z' }
    expect(selectMissionTargetIds(phrases, skillStates, [futureReview, productiveReview], 'B1', 3, new Date('2026-07-18T00:00:00.000Z'))).toEqual(['activation', 'studied'])
    expect(selectMissionTargetIds(phrases.map((phrase) => phrase.id === 'activation' ? { ...phrase, activationEvents: undefined } : phrase), skillStates, [futureReview, productiveReview], 'B1', 3, new Date('2026-07-18T00:00:00.000Z'))).toEqual(['studied'])
  })

  it('does not reuse productive evidence that predates a phrase revision', () => {
    const data = createSeedData()
    const phrase = {
      ...data.phrases[0], id: 'revised', cefr: 'B1' as const, activationStage: 0 as const,
      evidenceResetAt: '2026-07-15T00:00:00.000Z',
    }
    const oldReview = {
      ...data.reviews[0], id: 'old-review', idempotencyKey: 'old-review', targetId: phrase.id,
      targetType: 'phrase' as const, skill: 'written_productive' as const, grade: 3 as const,
      hintsUsed: 0, revealUsed: false, supportUsed: false, reviewedAt: '2026-07-14T23:59:59.000Z',
    }
    expect(selectMissionTargetIds([phrase], [], [oldReview], 'B1', 1, new Date('2026-07-18T00:00:00.000Z'))).toEqual([])
  })

  it('rejects a productive grade whose saved response does not use the target', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], id: 'forged', cefr: 'B1' as const, activationStage: 0 as const, activationEvents: [] }
    const review = {
      ...data.reviews[0], id: 'forged-review', idempotencyKey: 'forged-review', targetId: phrase.id,
      response: '', reviewedAt: '2026-07-17T08:00:00.000Z', dueBefore: '2026-07-16T08:00:00.000Z',
    }

    expect(selectMissionTargetIds([phrase], [], [review], 'B1', 1, new Date('2026-07-18T00:00:00.000Z'))).toEqual([])
  })
})
