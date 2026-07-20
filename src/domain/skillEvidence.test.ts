import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { rebuildSkillStates } from './skillEvidence'

describe('raw-derived skill schedules', () => {
  it('discards forged attempts, mastery, suspension and future due summaries', () => {
    const data = createSeedData()
    const phrase = data.phrases[0]
    data.reviews = []
    data.speakingAttempts = []
    data.skillStates = data.skillStates.map((state) => state.phraseId === phrase.id
      ? { ...state, attempts: 99, mastery: 1, phase: 'suspended' as const, dueAt: '2099-01-01T00:00:00.000Z' }
      : state)

    const rebuilt = rebuildSkillStates(data, new Date('2026-07-18T12:00:00.000Z')).filter((state) => state.phraseId === phrase.id)
    expect(rebuilt).toHaveLength(4)
    expect(rebuilt.every((state) => state.attempts === 0 && state.mastery === 0 && state.phase === 'new')).toBe(true)
    expect(rebuilt.every((state) => new Date(state.dueAt).getFullYear() < 2099)).toBe(true)
  })

  it('rebuilds a real productive schedule from its verified saved response', () => {
    const data = createSeedData()
    const phrase = data.phrases.find((item) => item.id === 'phrase-bear-in-mind')!
    data.reviews = data.reviews.filter((review) => review.targetId === phrase.id)
    data.speakingAttempts = []

    const productive = rebuildSkillStates(data, new Date()).find((state) => state.phraseId === phrase.id && state.skill === 'written_productive')!
    expect(productive.attempts).toBe(1)
    expect(productive.lastReviewedAt).toBe(data.reviews[0].reviewedAt)
  })

  it('does not schedule from a review that predates phrase creation', () => {
    const data = createSeedData()
    const phrase = data.phrases.find((item) => item.id === 'phrase-bear-in-mind')!
    phrase.createdAt = '2026-07-18T12:00:00.000Z'
    phrase.evidenceResetAt = undefined
    data.reviews = data.reviews.filter((review) => review.targetId === phrase.id).map((review) => ({ ...review, reviewedAt: '2026-07-17T12:00:00.000Z' }))
    data.speakingAttempts = []

    const productive = rebuildSkillStates(data, new Date('2026-07-20T12:00:00.000Z')).find((state) => state.phraseId === phrase.id && state.skill === 'written_productive')!
    expect(productive.attempts).toBe(0)
  })

  it('carries a manual soft-relearning resume across a rebuild instead of re-suspending on the next mistake', () => {
    const data = createSeedData()
    const skill = 'meaning_recall' as const
    const phrase = data.phrases.find((item) => data.skillStates.some((state) => state.phraseId === item.id && state.skill === skill))!
    const base = new Date('2026-01-01T00:00:00.000Z').getTime()
    const day = 86_400_000
    phrase.createdAt = new Date(base).toISOString()
    phrase.evidenceResetAt = undefined
    phrase.status = 'active'
    // Five failed reviews drive the skill to automatic suspension (5 lapses).
    data.reviews = Array.from({ length: 5 }, (_, index) => ({
      id: `lapse-${index}`,
      idempotencyKey: `lapse-${index}`,
      targetType: 'phrase' as const,
      targetId: phrase.id,
      skill,
      exerciseType: 'meaning_to_chunk' as const,
      response: 'zzz totally wrong answer',
      grade: 0 as const,
      hintsUsed: 0,
      revealUsed: false,
      reviewedAt: new Date(base + (index + 1) * day).toISOString(),
      dueBefore: new Date(base + (index + 1) * day).toISOString(),
      dueAfter: new Date(base + (index + 1) * day).toISOString(),
    }))
    data.speakingAttempts = []
    const now = new Date(base + 30 * day)

    const suspended = rebuildSkillStates(data, now).find((state) => state.phraseId === phrase.id && state.skill === skill)!
    expect(suspended.phase).toBe('suspended')
    expect(suspended.lapses).toBeGreaterThanOrEqual(5)

    // Simulate the store's "resume soft relearning" action (lapses - 2) + persistence.
    data.skillStates = data.skillStates.map((state) => state.phraseId === phrase.id && state.skill === skill
      ? { ...suspended, phase: 'relearning' as const, learningStep: 0, lapses: Math.max(0, suspended.lapses - 2), consecutiveSuccesses: 0 }
      : state)

    const resumed = rebuildSkillStates(data, now).find((state) => state.phraseId === phrase.id && state.skill === skill)!
    expect(resumed.phase).toBe('relearning')
    expect(resumed.lapses).toBe(suspended.lapses - 2)
  })
})
