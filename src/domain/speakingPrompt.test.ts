import { describe, expect, it } from 'vitest'
import { grammarAcademyLessons } from '../data/grammarAcademy'
import type { GrammarLessonProgress } from './types'
import { promptWithGrammarFocus, selectSpeakingGrammarFocus, stripPersistedGrammarFocus } from './speakingPrompt'

describe('speaking grammar focus', () => {
  it('prefers a studied struggling topic and persists an auditable constraint', () => {
    const progress: GrammarLessonProgress[] = [
      { lessonId: 'b1-present-perfect-since-for', attempts: 2, passes: 1, bestScore: 3, totalQuestions: 3, lastAttemptedAt: '2026-07-17T10:00:00.000Z', completedAt: '2026-07-17T10:00:00.000Z' },
      { lessonId: 'b1-zero-first-second-conditionals', attempts: 1, passes: 0, bestScore: 1, totalQuestions: 3, lastAttemptedAt: '2026-07-16T10:00:00.000Z' },
    ]
    const focus = selectSpeakingGrammarFocus(grammarAcademyLessons, progress, 'B1')!
    expect(focus.lessonId).toBe('b1-zero-first-second-conditionals')
    const persisted = promptWithGrammarFocus('Describe a decision.', focus)
    expect(persisted).toContain('[Grammar focus b1-zero-first-second-conditionals; self-confirmed]')
    expect(stripPersistedGrammarFocus(persisted)).toBe('Describe a decision.')
  })

  it('does not pretend that an unstudied level supplied a grammar focus', () => {
    expect(selectSpeakingGrammarFocus(grammarAcademyLessons, [], 'A2')).toBeUndefined()
  })
})
