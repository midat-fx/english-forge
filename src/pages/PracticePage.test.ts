import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { buildTargetedActivationQueue } from '../domain/activation'

describe('targeted activation routing', () => {
  it('offers only the single next stage and blocks another stage on the same local day', () => {
    const phrase = createSeedData().phrases.find((item) => item.id === 'phrase-fall-short')!
    const now = new Date('2026-07-18T12:00:00.000Z')

    const first = buildTargetedActivationQueue({ ...phrase, activationStage: 0, activationEvents: [] }, now)
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ phraseId: phrase.id, mode: 'recognition' })

    const alreadyPracticed = buildTargetedActivationQueue({
      ...phrase,
      activationStage: 1,
      activationEvents: [{ stage: 1, completedAt: '2026-07-18T08:00:00.000Z' }],
    }, now)
    expect(alreadyPracticed).toEqual([])
  })
})
