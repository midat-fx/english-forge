import { describe, expect, it } from 'vitest'
import { grammarAcademyLessons, grammarQuizForAttempt, grammarQuizVariantKey } from './grammarAcademy'
import { grammarAcademySources } from './grammarAcademySources'
import { grammarExplanationRu } from './grammarAcademyRussian'
import { grammarLessonExperience, grammarLevels } from '../domain/grammarAcademy'

describe('Grammar Academy catalog', () => {
  it('contains a substantial CEFR curriculum with extra A2 and B1 depth', () => {
    expect(grammarAcademyLessons.length).toBeGreaterThanOrEqual(120)

    const counts = Object.fromEntries(
      grammarLevels.map((level) => [
        level,
        grammarAcademyLessons.filter((lesson) => lesson.level === level).length,
      ]),
    )

    expect(counts.A2).toBeGreaterThanOrEqual(30)
    expect(counts.B1).toBeGreaterThanOrEqual(30)
    expect(counts.B2).toBeGreaterThanOrEqual(20)
    expect(counts.C1).toBeGreaterThanOrEqual(20)
  })

  it('uses stable unique IDs for lessons and questions', () => {
    const lessonIds = grammarAcademyLessons.map((lesson) => lesson.id)
    const questionIds = grammarAcademyLessons.flatMap((lesson) => lesson.quiz.map((question) => question.id))

    expect(new Set(lessonIds).size).toBe(lessonIds.length)
    expect(new Set(questionIds).size).toBe(questionIds.length)

    for (const lesson of grammarAcademyLessons) {
      expect(lesson.id).toMatch(/^(a2|b1|b2|c1)-[a-z0-9-]+$/)
      lesson.quiz.forEach((question, index) => {
        expect(question.id).toBe(`${lesson.id}-q${index + 1}`)
      })
    }
  })

  it('starts A2 with prerequisites before contrasts and advanced tense work', () => {
    const a2Ids = grammarAcademyLessons.filter((lesson) => lesson.level === 'A2').map((lesson) => lesson.id)
    expect(a2Ids.slice(0, 6)).toEqual([
      'a2-be-forms', 'a2-present-simple', 'a2-present-continuous',
      'a2-present-simple-v-continuous', 'a2-do-or-be-questions', 'a2-question-forms',
    ])
    expect(a2Ids.indexOf('a2-past-simple')).toBeLessThan(a2Ids.indexOf('a2-present-perfect-basics'))
  })

  it('provides complete teach-practise-feedback material for every lesson', () => {
    for (const lesson of grammarAcademyLessons) {
      const experience = grammarLessonExperience(grammarAcademyLessons, lesson)
      expect(lesson.title.length).toBeGreaterThan(5)
      expect(lesson.explanation.length).toBeGreaterThan(80)
      expect(lesson.formula.length).toBeGreaterThan(8)
      expect(lesson.examples).toHaveLength(3)
      expect(new Set(lesson.examples).size).toBe(3)
      lesson.examples.forEach((example) => expect(example.length).toBeGreaterThan(12))

      expect(lesson.commonMistake.wrong.length).toBeGreaterThan(4)
      expect(lesson.commonMistake.correct.length).toBeGreaterThan(4)
      expect(lesson.commonMistake.correct).not.toBe(lesson.commonMistake.wrong)
      expect(lesson.commonMistake.note.length).toBeGreaterThan(20)

      expect(lesson.quiz).toHaveLength(3)
      expect(experience.objective).toContain('После урока вы сможете')
      expect(experience.productionPrompt).toContain(lesson.formula)
      expect(experience.masteryCriterion).toContain('двух проверок 3/3')
      expect(experience.masteryCriterion).toContain('подтверждённого собственного предложения')
      expect(experience.masteryCriterion).toContain('переноса в новый контекст')
      for (const question of lesson.quiz) {
        expect(question.prompt.length).toBeGreaterThan(8)
        expect(question.choices).toHaveLength(3)
        expect(new Set(question.choices).size).toBe(3)
        expect(question.answerIndex).toBeGreaterThanOrEqual(0)
        expect(question.answerIndex).toBeLessThan(3)
        expect(question.choices[question.answerIndex].length).toBeGreaterThan(0)
        expect(question.explanation.length).toBeGreaterThan(18)
      }
    }
  })

  it('covers every category and all four levels', () => {
    expect(new Set(grammarAcademyLessons.map((lesson) => lesson.level))).toEqual(new Set(grammarLevels))
    expect(new Set(grammarAcademyLessons.map((lesson) => lesson.category))).toEqual(
      new Set([
        'tenses',
        'questions',
        'nouns-and-articles',
        'adjectives-and-adverbs',
        'modals',
        'clauses-and-linking',
        'verb-patterns',
        'advanced-structures',
      ]),
    )
  })

  it('keeps an attributable, dated list of curriculum references', () => {
    expect(grammarAcademySources.length).toBeGreaterThanOrEqual(8)
    for (const source of grammarAcademySources) {
      expect(source.url).toMatch(/^https:\/\//)
      expect(source.title.length).toBeGreaterThan(4)
      expect(source.publisher.length).toBeGreaterThan(4)
      expect(source.usedFor.length).toBeGreaterThan(10)
      expect(source.accessedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('provides Russian support for every A2 and B1 lesson', () => {
    for (const lesson of grammarAcademyLessons.filter((item) => item.level === 'A2' || item.level === 'B1')) expect(grammarExplanationRu[lesson.id]?.length, lesson.id).toBeGreaterThan(40)
  })

  it('keeps required A2 verb-pattern lessons within the simple taught scope', () => {
    const requiredIds = ['a2-verb-patterns', 'a2-infinitive-purpose']
    const requiredContent = requiredIds.map((id) => {
      const lesson = grammarAcademyLessons.find((item) => item.id === id)!
      return [lesson, grammarExplanationRu[id]]
    })
    const serialized = JSON.stringify(requiredContent).toLocaleLowerCase('en')
    expect(serialized).not.toContain('avoid')
    expect(serialized).not.toContain('избег')
    expect(serialized).not.toContain('so as not to')
    expect(serialized).not.toContain('in order not to')
  })

  it('avoids answer-position bias, remaps every attempt and preserves prerequisite order', () => {
    const answerPositions = [0, 1, 2].map((position) => grammarAcademyLessons.flatMap((lesson) => lesson.quiz).filter((question) => question.answerIndex === position).length)
    for (const count of answerPositions) expect(count / grammarAcademyLessons.flatMap((lesson) => lesson.quiz).length).toBeLessThan(0.4)
    for (const lesson of grammarAcademyLessons) {
      const first = grammarQuizForAttempt(lesson, 0)
      const second = grammarQuizForAttempt(lesson, 1)
      expect(second.map((question) => question.answerIndex), lesson.id).not.toEqual(first.map((question) => question.answerIndex))
      expect(first.map((question) => question.choices[question.answerIndex])).toEqual(second.map((question) => question.choices[question.answerIndex]))
      expect(grammarQuizVariantKey(lesson, 0)).not.toBe(grammarQuizVariantKey(lesson, 1))
      expect(grammarQuizVariantKey(lesson, 0)).toBe(grammarQuizVariantKey(lesson, 3))
    }
    const ids = grammarAcademyLessons.map((lesson) => lesson.id)
    expect(ids.indexOf('b1-present-perfect-since-for')).toBeLessThan(ids.indexOf('b1-present-perfect-continuous'))
    expect(ids.indexOf('b1-modals-possibility')).toBeLessThan(ids.indexOf('b1-modals-deduction'))
  })

  it('keeps controlled checks unambiguous and uses natural reduced clauses', () => {
    const lesson = (id: string) => grammarAcademyLessons.find((item) => item.id === id)!
    const correctAnswer = (lessonId: string, questionIndex: number) => {
      const question = lesson(lessonId).quiz[questionIndex]
      return question.choices[question.answerIndex]
    }

    expect(lesson('a2-short-answers').quiz[2].prompt).toContain('standard auxiliary short answer')
    expect(lesson('a2-short-answers').quiz[2].choices).not.toContain('Yes, it works.')
    expect(lesson('a2-future-choices').quiz[2].choices).not.toContain('see')
    expect(lesson('b1-past-ability').quiz[2].choices).not.toContain('managed to')
    expect(lesson('b1-most-and-most-of').quiz[1].prompt).toContain('birds in general')
    expect(lesson('b1-most-and-most-of').quiz[1].choices).not.toContain('Most of the')
    expect(lesson('b2-future-continuous-perfect').quiz[1].prompt).toContain('future perfect form')
    expect(lesson('b2-punctuation-clause-logic').quiz[2].prompt).toContain('long introductory clause')
    expect(lesson('c1-mandative-subjunctive').quiz[1].prompt).toContain('formal mandative subjunctive')
    expect(correctAnswer('b2-participle-adjective-clauses', 1)).toBe('The bridge damaged in the storm is closed.')
  })
})
