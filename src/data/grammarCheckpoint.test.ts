import { describe, expect, it } from 'vitest'
import type { GrammarLessonProgress } from '../domain/types'
import { grammarAcademyLessons } from './grammarAcademy'
import { buildGrammarCheckpoint } from './grammarCheckpoint'

describe('cumulative grammar checkpoint', () => {
  it('mixes due questions from distinct previously attempted lessons', () => {
    const lessons = grammarAcademyLessons.filter((lesson) => lesson.level === 'A2').slice(0, 3)
    const progress: GrammarLessonProgress[] = lessons.map((lesson, index) => ({
      lessonId: lesson.id, attempts: 2, passes: 2, bestScore: 3, totalQuestions: 3,
      lastAttemptedAt: `2026-07-0${index + 1}T08:00:00.000Z`, completedAt: `2026-07-0${index + 1}T08:00:00.000Z`,
      nextCumulativeDueAt: `2026-07-1${index + 1}T08:00:00.000Z`,
    }))
    const checkpoint = buildGrammarCheckpoint(grammarAcademyLessons, progress, 'A2', new Date('2026-07-18T12:00:00.000Z'))
    expect(checkpoint).toHaveLength(3)
    expect(new Set(checkpoint.map((item) => item.lessonId)).size).toBe(3)
    for (const item of checkpoint) expect(item.question.choices[item.question.answerIndex]).toBeTruthy()
  })

  it('builds a one-topic recovery check instead of leaving a due topic stranded', () => {
    const lesson = grammarAcademyLessons.find((item) => item.level === 'A2')!
    const progress: GrammarLessonProgress[] = [{ lessonId: lesson.id, attempts: 1, passes: 0, bestScore: 1, totalQuestions: 3, lastAttemptedAt: '2026-07-01T08:00:00.000Z' }]
    const recovery = buildGrammarCheckpoint(grammarAcademyLessons, progress, 'A2', new Date('2026-07-18T12:00:00.000Z'))
    expect(recovery).toHaveLength(1)
    expect(recovery[0].lessonId).toBe(lesson.id)
  })
})
