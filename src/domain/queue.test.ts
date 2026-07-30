import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { catalogItemTag, localDayKey } from './dailyVocabulary'
import { initialSkillState } from './scheduler'
import { buildPracticeQueue, dailyReviewPlan, phraseHasRecentPracticeExposure, practiceTaskCapacityForMinutes, wasDueWhenReviewed } from './queue'
import { activationEventsThrough as qualifiedEventsThrough } from '../test/activationEvidence'
import type { Phrase } from './types'

const activationEventsThroughSix = (phrase: Phrase) => qualifiedEventsThrough(phrase, 6)

describe('daily practice queue', () => {
  it('finishes the daily review step at the time-capped quota while preserving backlog', () => {
    expect(dailyReviewPlan(100, 0, 20)).toEqual({ quota: 13, completed: 0, remaining: 13, backlog: 100 })
    expect(dailyReviewPlan(87, 13, 20)).toEqual({ quota: 13, completed: 13, remaining: 0, backlog: 87 })
    expect(dailyReviewPlan(0, 0, 20)).toEqual({ quota: 0, completed: 0, remaining: 0, backlog: 0 })
  })

  it('reserves a short-session slice for activation before setting the review quota', () => {
    expect(dailyReviewPlan(100, 0, 20, 6)).toEqual({ quota: 7, completed: 0, remaining: 7, backlog: 100 })
    expect(dailyReviewPlan(100, 0, 5, 3)).toEqual({ quota: 1, completed: 0, remaining: 1, backlog: 100 })
    expect(practiceTaskCapacityForMinutes(5)).toBe(3)
    expect(dailyReviewPlan(3, 0, 5, 1)).toEqual({ quota: 2, completed: 0, remaining: 2, backlog: 3 })
  })

  it('does not count an early activation event as due-backlog work', () => {
    expect(wasDueWhenReviewed({ dueBefore: '2026-07-19T08:00:00.000Z', reviewedAt: '2026-07-18T08:00:00.000Z' })).toBe(false)
    expect(wasDueWhenReviewed({ dueBefore: '2026-07-18T07:00:00.000Z', reviewedAt: '2026-07-18T08:00:00.000Z' })).toBe(true)
  })
  it('schedules at most one skill per phrase so shown feedback cannot become independent evidence', () => {
    const data = createSeedData()
    const now = new Date()
    data.skillStates = data.phrases.slice(0, 2).flatMap((phrase) => [
      initialSkillState(phrase.id, 'meaning_recall', now),
      initialSkillState(phrase.id, 'cloze', now),
      initialSkillState(phrase.id, 'written_productive', now),
    ])
    const readyPhrases = data.phrases.map((phrase) => ({ ...phrase, activationStage: 8 as const, activationEvents: activationEventsThroughSix(phrase) }))
    const queue = buildPracticeQueue(data.skillStates, readyPhrases, data.preferences, now)
    expect(queue.map((item) => item.phraseId)).toEqual([data.phrases[0].id, data.phrases[1].id])
    expect(queue.map((item) => item.skill)).toEqual(['meaning_recall', 'cloze'])
    expect(new Set(queue.map((item) => item.phraseId)).size).toBe(queue.length)
  })

  it('keeps a recently exposed phrase out of a newly opened session for twelve hours', () => {
    const data = createSeedData()
    const now = new Date()
    const phrase = {
      ...data.phrases[0],
      activationStage: 8 as const,
      activationEvents: activationEventsThroughSix(data.phrases[0]),
      practiceExposures: [{
        id: 'feedback-exposure',
        skill: 'meaning_recall' as const,
        exposedAt: new Date(now.getTime() - 60_000).toISOString(),
        source: 'feedback' as const,
        sessionKey: 'closed-before-grade',
      }],
    }
    const states = [
      initialSkillState(phrase.id, 'meaning_recall', now),
      initialSkillState(phrase.id, 'cloze', now),
    ]

    expect(phraseHasRecentPracticeExposure(phrase, [], now)).toBe(true)
    expect(phraseHasRecentPracticeExposure(phrase, [], now, 'closed-before-grade')).toBe(false)
    expect(buildPracticeQueue(states, [phrase], data.preferences, now, undefined, null, [])).toEqual([])

    const later = new Date(now.getTime() + 12 * 60 * 60 * 1000)
    expect(buildPracticeQueue(states, [phrase], data.preferences, later, undefined, null, [])).toHaveLength(1)
  })

  it('uses persisted review history as an exposure guard for older profiles', () => {
    const data = createSeedData()
    const now = new Date()
    const phrase = { ...data.phrases[0], activationStage: 8 as const, activationEvents: activationEventsThroughSix(data.phrases[0]) }
    const state = initialSkillState(phrase.id, 'cloze', now)
    const recentReview = {
      ...data.reviews[0],
      id: 'recent-other-skill',
      idempotencyKey: 'recent-other-skill',
      targetId: phrase.id,
      skill: 'meaning_recall' as const,
      reviewedAt: new Date(now.getTime() - 60_000).toISOString(),
    }

    expect(buildPracticeQueue([state], [phrase], data.preferences, now, undefined, null, [recentReview])).toEqual([])
  })

  it('withholds meaning recall for an unenriched quick capture', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], id: 'blank', status: 'new' as const, meaning: '', context: '' }
    const queue = buildPracticeQueue([
      initialSkillState(phrase.id, 'meaning_recall'),
      initialSkillState(phrase.id, 'cloze'),
      initialSkillState(phrase.id, 'written_productive'),
    ], [phrase], data.preferences)
    expect(queue).toEqual([])
  })

  it('introduces at most ten new phrases and honors the daily time budget', () => {
    const data = createSeedData()
    const now = new Date()
    const newPhrases = Array.from({ length: 15 }, (_, index) => { const phrase = { ...data.phrases[index % data.phrases.length], id: `new-${index}`, status: 'new' as const, activationStage: 8 as const }; return { ...phrase, activationEvents: activationEventsThroughSix(phrase) } })
    const states = newPhrases.flatMap((phrase) => [initialSkillState(phrase.id, 'meaning_recall', now), initialSkillState(phrase.id, 'cloze', now)])
    const full = buildPracticeQueue(states, newPhrases, { ...data.preferences, dailyMinutes: 90 }, now)
    const short = buildPracticeQueue(states, newPhrases, { ...data.preferences, dailyMinutes: 5 }, now)
    expect(new Set(full.map((item) => item.phraseId)).size).toBe(10)
    expect(short.length).toBeLessThanOrEqual(3)
  })

  it("prioritizes today's current-level assignment over older new phrases", () => {
    const data = createSeedData()
    const now = new Date(2026, 6, 20, 12)
    const oldPhrases = Array.from({ length: 10 }, (_, index) => { const phrase = { ...data.phrases[index % data.phrases.length], id: `old-${index}`, status: 'new' as const, cefr: 'B1' as const, tags: [], activationStage: 8 as const, createdAt: '2026-07-01T08:00:00.000Z' }; return { ...phrase, activationEvents: activationEventsThroughSix(phrase) } })
    const dailyPhrases = Array.from({ length: 10 }, (_, index) => { const phrase = { ...data.phrases[index % data.phrases.length], id: `daily-${index}`, status: 'new' as const, cefr: 'B1' as const, tags: [catalogItemTag(`catalog-${index}`)], activationStage: 8 as const, createdAt: '2026-07-01T08:00:00.000Z' }; return { ...phrase, activationEvents: activationEventsThroughSix(phrase) } })
    const states = [
      ...oldPhrases.map((phrase) => ({ ...initialSkillState(phrase.id, 'meaning_recall', now), dueAt: new Date(now.getTime() - 60_000).toISOString() })),
      ...dailyPhrases.map((phrase) => initialSkillState(phrase.id, 'meaning_recall', now)),
    ]
    const assignment = { dayKey: localDayKey(now), level: 'B1' as const, itemIds: dailyPhrases.map((_, index) => `catalog-${index}`), enrolledIds: dailyPhrases.map((_, index) => `catalog-${index}`) }
    const queue = buildPracticeQueue(states, [...oldPhrases, ...dailyPhrases], { ...data.preferences, currentLevel: 'B1', dailyMinutes: 90 }, now, undefined, assignment)
    expect(new Set(queue.map((entry) => entry.phraseId))).toEqual(new Set(dailyPhrases.map((phrase) => phrase.id)))
  })

  it("keeps today's enrolled learning cards first in a short session after reload", () => {
    const data = createSeedData()
    const now = new Date(2026, 6, 20, 12)
    const older = Array.from({ length: 5 }, (_, index) => { const phrase = { ...data.phrases[index], id: `overdue-${index}`, status: 'learning' as const, tags: [], activationStage: 8 as const, createdAt: '2026-07-01T08:00:00.000Z' }; return { ...phrase, activationEvents: activationEventsThroughSix(phrase) } })
    const daily = Array.from({ length: 5 }, (_, index) => { const phrase = { ...data.phrases[index], id: `daily-learning-${index}`, status: 'learning' as const, tags: [catalogItemTag(`daily-catalog-${index}`)], activationStage: 8 as const, createdAt: '2026-07-01T08:00:00.000Z' }; return { ...phrase, activationEvents: activationEventsThroughSix(phrase) } })
    const states = [
      ...older.map((phrase) => ({ ...initialSkillState(phrase.id, 'meaning_recall', now), dueAt: new Date(now.getTime() - 86_400_000).toISOString() })),
      ...daily.map((phrase) => initialSkillState(phrase.id, 'meaning_recall', now)),
    ]
    const assignment = {
      dayKey: localDayKey(now), level: data.preferences.currentLevel,
      itemIds: daily.map((_, index) => `daily-catalog-${index}`),
      enrolledIds: daily.map((_, index) => `daily-catalog-${index}`),
    }
    const queue = buildPracticeQueue(states, [...older, ...daily], { ...data.preferences, dailyMinutes: 5 }, now, undefined, assignment)
    expect(queue).toHaveLength(3)
    expect(queue.every((entry) => entry.phraseId.startsWith('daily-learning-'))).toBe(true)
  })

  it("does not introduce a second batch after today's ten become learning cards", () => {
    const data = createSeedData()
    const now = new Date(2026, 6, 20, 12)
    const daily = Array.from({ length: 10 }, (_, index) => { const phrase = { ...data.phrases[index % data.phrases.length], id: `daily-reviewed-${index}`, status: 'learning' as const, tags: [catalogItemTag(`daily-reviewed-catalog-${index}`)], activationStage: 8 as const, createdAt: '2026-07-01T08:00:00.000Z' }; return { ...phrase, activationEvents: activationEventsThroughSix(phrase) } })
    const extraNew = Array.from({ length: 10 }, (_, index) => { const phrase = { ...data.phrases[index % data.phrases.length], id: `extra-new-${index}`, status: 'new' as const, tags: [], activationStage: 8 as const, createdAt: '2026-07-01T08:00:00.000Z' }; return { ...phrase, activationEvents: activationEventsThroughSix(phrase) } })
    const states = [...daily, ...extraNew].map((phrase) => initialSkillState(phrase.id, 'meaning_recall', now))
    const assignment = {
      dayKey: localDayKey(now), level: data.preferences.currentLevel,
      itemIds: daily.map((_, index) => `daily-reviewed-catalog-${index}`),
      enrolledIds: daily.map((_, index) => `daily-reviewed-catalog-${index}`),
    }

    const queue = buildPracticeQueue(states, [...daily, ...extraNew], { ...data.preferences, dailyMinutes: 90 }, now, undefined, assignment)
    expect(queue.map((entry) => entry.phraseId)).toEqual(daily.map((phrase) => phrase.id))
  })

  it('applies the selected skills before the time limit and scales longer sessions', () => {
    const data = createSeedData()
    const now = new Date()
    const phrases = Array.from({ length: 12 }, (_, index) => { const phrase = { ...data.phrases[index % data.phrases.length], id: `phrase-${index}`, status: 'learning' as const, activationStage: 8 as const }; return { ...phrase, activationEvents: activationEventsThroughSix(phrase) } })
    const states = phrases.flatMap((phrase) => [
      initialSkillState(phrase.id, 'meaning_recall', now),
      initialSkillState(phrase.id, 'cloze', now),
      initialSkillState(phrase.id, 'written_productive', now),
    ])
    const onlyWriting = buildPracticeQueue(states, phrases, { ...data.preferences, dailyMinutes: 20 }, now, ['written_productive'])
    const longer = buildPracticeQueue(states, phrases, { ...data.preferences, dailyMinutes: 30 }, now)
    expect(onlyWriting.every((item) => item.skill === 'written_productive')).toBe(true)
    expect(onlyWriting).toHaveLength(12)
    expect(longer).toHaveLength(12)
    expect(new Set(longer.map((item) => item.phraseId)).size).toBe(longer.length)
  })

  it('withholds the parallel SRS queue until the six pre-speaking stages are complete', () => {
    const data = createSeedData()
    const now = new Date()
    const phrase = { ...data.phrases[0], activationStage: 0 as const }
    expect(buildPracticeQueue([initialSkillState(phrase.id, 'meaning_recall', now)], [phrase], data.preferences, now)).toEqual([])
    expect(buildPracticeQueue([initialSkillState(phrase.id, 'meaning_recall', now)], [{ ...phrase, activationStage: 7 as const }], data.preferences, now)).toEqual([])
    expect(buildPracticeQueue([initialSkillState(phrase.id, 'meaning_recall', now)], [{ ...phrase, activationStage: 7 as const, activationEvents: activationEventsThroughSix(phrase) }], data.preferences, now)).toHaveLength(1)
  })
})
