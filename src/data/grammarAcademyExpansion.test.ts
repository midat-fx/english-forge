import { describe, expect, it } from 'vitest'
import { grammarAcademyLessons } from './grammarAcademy'
import { grammarAcademyExpansionLessons } from './grammarAcademyExpansion'
import { grammarAcademyExpansionExplanationRu } from './grammarAcademyExpansionRussian'

describe('Grammar Academy expansion', () => {
  it('adds at least 59 distinct lessons without colliding with the original catalog', () => {
    expect(grammarAcademyExpansionLessons.length).toBeGreaterThanOrEqual(59)

    const allIds = grammarAcademyLessons.map((lesson) => lesson.id)
    const allTitles = grammarAcademyLessons.map((lesson) => lesson.title.toLocaleLowerCase('en-US'))
    const expansionIds = grammarAcademyExpansionLessons.map((lesson) => lesson.id)
    const expansionTitles = grammarAcademyExpansionLessons.map((lesson) => lesson.title.toLocaleLowerCase('en-US'))

    expect(new Set(expansionIds).size).toBe(expansionIds.length)
    expect(new Set(expansionTitles).size).toBe(expansionTitles.length)
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(new Set(allTitles).size).toBe(allTitles.length)
    expect(grammarAcademyLessons.length - grammarAcademyExpansionLessons.length).toBe(63)
  })

  it('contains complete, mechanically safe lesson material', () => {
    const questionIds = grammarAcademyExpansionLessons.flatMap((lesson) => lesson.quiz.map((question) => question.id))
    expect(new Set(questionIds).size).toBe(questionIds.length)

    for (const lesson of grammarAcademyExpansionLessons) {
      expect(lesson.explanation.length, lesson.id).toBeGreaterThan(80)
      expect(lesson.examples, lesson.id).toHaveLength(3)
      expect(new Set(lesson.examples).size, lesson.id).toBe(3)
      expect(lesson.quiz, lesson.id).toHaveLength(3)
      expect(lesson.commonMistake.wrong, lesson.id).not.toBe(lesson.commonMistake.correct)
      lesson.quiz.forEach((question, index) => {
        expect(question.id).toBe(`${lesson.id}-q${index + 1}`)
        expect(question.choices).toHaveLength(3)
        expect(new Set(question.choices).size, question.id).toBe(3)
        expect(question.answerIndex).toBeGreaterThanOrEqual(0)
        expect(question.answerIndex).toBeLessThan(3)
        expect(question.choices[question.answerIndex].length).toBeGreaterThan(0)
      })
    }
  })

  it('provides Russian guidance for every new A2 and B1 lesson', () => {
    for (const lesson of grammarAcademyExpansionLessons.filter(({ level }) => level === 'A2' || level === 'B1')) {
      expect(grammarAcademyExpansionExplanationRu[lesson.id]?.length, lesson.id).toBeGreaterThan(80)
    }
  })
})
