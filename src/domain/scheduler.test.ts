import { describe, expect, it } from 'vitest'
import { effectiveGrade, initialSkillState, isDue, scheduleReview } from './scheduler'
import type { SkillState } from './types'

const now = new Date('2026-07-16T08:00:00.000Z')

describe('learning scheduler', () => {
  it('moves a good new item from ten minutes to one day', () => {
    const initial = initialSkillState('phrase', 'meaning_recall', now)
    const afterAgain = scheduleReview(initial, 0, now)
    const afterGood = scheduleReview(afterAgain, 2, now)
    expect(new Date(afterAgain.dueAt).getTime() - now.getTime()).toBe(10 * 60_000)
    expect(new Date(afterGood.dueAt).getTime() - now.getTime()).toBe(86_400_000)
  })

  it('schedules Again before Hard before Good before Easy in review', () => {
    const base = { ...initialSkillState('phrase', 'meaning_recall', now), phase: 'review' as const, intervalDays: 10, ease: 2 }
    const due = ([0, 1, 2, 3] as const).map((grade) => new Date(scheduleReview(base, grade, now).dueAt).getTime())
    expect(due[0]).toBeLessThan(due[1])
    expect(due[1]).toBeLessThan(due[2])
    expect(due[2]).toBeLessThan(due[3])
  })

  it('calculates a 20 day Good interval from 10 days at ease 2', () => {
    const base = { ...initialSkillState('phrase', 'meaning_recall', now), phase: 'review' as const, intervalDays: 10, ease: 2 }
    expect(scheduleReview(base, 2, now).intervalDays).toBe(20)
  })

  it('changes only the state passed to it', () => {
    const recall = initialSkillState('phrase', 'meaning_recall', now)
    const productive = initialSkillState('phrase', 'written_productive', now)
    scheduleReview(recall, 0, now)
    expect(productive.attempts).toBe(0)
    expect(productive.phase).toBe('new')
  })

  it('caps hinted answers at Hard and schedules a revealed answer as Again', () => {
    expect(effectiveGrade(3, 1, false)).toBe(1)
    expect(effectiveGrade(3, 0, true)).toBe(0)
    expect(effectiveGrade(3, 0, false)).toBe(3)
  })

  it('records an unmatched or revealed answer as Again even if the learner clicks Easy', () => {
    expect(effectiveGrade(3, 0, false, false)).toBe(0)
    expect(effectiveGrade(3, 0, true, false)).toBe(0)
  })

  it('treats an exactly due state as due', () => {
    expect(isDue(initialSkillState('phrase', 'cloze', now), now)).toBe(true)
  })

  it('suspends a leech on the fifth failure instead of waiting for a success', () => {
    let state = initialSkillState('phrase', 'cloze', now)
    for (let failure = 0; failure < 5; failure += 1) state = scheduleReview(state, 0, new Date(now.getTime() + failure * 600_000))
    expect(state.lapses).toBe(5)
    expect(state.phase).toBe('suspended')
    expect(isDue(state, new Date(now.getTime() + 86_400_000))).toBe(false)
  })

  it('also suspends a recurrent leech when its fifth lapse happens after ten attempts', () => {
    const mature = { ...initialSkillState('phrase', 'cloze', now), phase: 'review' as const, attempts: 14, lapses: 4, intervalDays: 7 }
    const state = scheduleReview(mature, 0, now)
    expect(state).toMatchObject({ attempts: 15, lapses: 5, phase: 'suspended' })
    expect(isDue(state, new Date(now.getTime() + 86_400_000))).toBe(false)
  })

  it('tracks mastery as a moving average of grade and clamps ease within [1.3, 2.5]', () => {
    const base = { ...initialSkillState('phrase', 'meaning_recall', now), phase: 'review' as const, intervalDays: 10, ease: 2 }
    // mastery = 0.8 * prev + 0.2 * (grade / 3); from 0 with Good(2): 0.2 * 2/3 ≈ 0.1333
    expect(scheduleReview(base, 2, now).mastery).toBeCloseTo(0.1333, 3)
    expect(scheduleReview(base, 3, now).ease).toBeCloseTo(2.05, 5)
    let raised: SkillState = base
    for (let i = 0; i < 20; i += 1) raised = scheduleReview(raised, 3, now)
    expect(raised.ease).toBeLessThanOrEqual(2.5)
    let lowered: SkillState = base
    for (let i = 0; i < 20; i += 1) lowered = scheduleReview(lowered, 0, new Date(now.getTime() + i * 600_000))
    expect(lowered.ease).toBeGreaterThanOrEqual(1.3)
  })

  it('lets an Easy answer skip a learning step while Good advances one', () => {
    const initial = initialSkillState('phrase', 'meaning_recall', now)
    const afterEasy = scheduleReview(initial, 3, now)
    expect(afterEasy.learningStep).toBe(2)
    expect(new Date(afterEasy.dueAt).getTime() - now.getTime()).toBe(3 * 86_400_000)
    const afterGood = scheduleReview(initial, 2, now)
    expect(afterGood.learningStep).toBe(1)
    expect(new Date(afterGood.dueAt).getTime() - now.getTime()).toBe(86_400_000)
  })
})
