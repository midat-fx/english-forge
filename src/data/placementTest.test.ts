import { describe, expect, it } from 'vitest'
import { PLACEMENT_QUESTION_BLUEPRINT } from './placementBlueprint'
import { isCompletePlacementSelection, PLACEMENT_QUESTIONS, placementAnswers, placementSelectionFromAnswers, recommendedPlacementLessonIds, recommendedPlacementLessonIdsFromAnswers, scorePlacement } from './placementTest'

describe('placement diagnostic', () => {
  it('has balanced, valid and unique questions', () => {
    expect(new Set(PLACEMENT_QUESTIONS.map((question) => question.id)).size).toBe(PLACEMENT_QUESTIONS.length)
    expect(PLACEMENT_QUESTIONS).toHaveLength(32)
    expect(PLACEMENT_QUESTIONS.map(({ id, level }) => ({ id, level }))).toEqual(PLACEMENT_QUESTION_BLUEPRINT)
    for (const level of ['A2', 'B1', 'B2', 'C1']) expect(PLACEMENT_QUESTIONS.filter((question) => question.level === level)).toHaveLength(8)
    for (const question of PLACEMENT_QUESTIONS) {
      expect(question.choices.length).toBe(4)
      expect(question.correctIndex).toBeGreaterThanOrEqual(0)
      expect(question.correctIndex).toBeLessThan(question.choices.length)
      expect(question.explanation.length).toBeGreaterThan(20)
    }

    for (const level of ['A2', 'B1', 'B2', 'C1']) {
      const answerPositions = [0, 1, 2, 3].map((position) =>
        PLACEMENT_QUESTIONS.filter((question) => question.level === level && question.correctIndex === position).length)
      expect(answerPositions, `${level} answer-key positions`).toEqual([2, 2, 2, 2])
      expect(new Set(PLACEMENT_QUESTIONS.filter((question) => question.level === level).map((question) => question.skill))).toEqual(
        new Set(['grammar', 'vocabulary', 'reading', 'use_of_english']),
      )
    }
  })

  it('requires lower-band evidence before assigning higher levels', () => {
    const onlyC1Correct = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.level === 'C1' ? question.correctIndex : (question.correctIndex + 1) % 4]))
    expect(scorePlacement(onlyC1Correct).suggestedLevel).toBe('A2')
    const onlyUpperBandsCorrect = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.level === 'B2' || question.level === 'C1' ? question.correctIndex : (question.correctIndex + 1) % 4]))
    expect(scorePlacement(onlyUpperBandsCorrect).suggestedLevel).toBe('A2')
    expect(scorePlacement(onlyUpperBandsCorrect).foundationReview).toBe(true)
  })

  it('keeps the level ladder monotonic: a strong B2 band never lowers a borderline B1 learner', () => {
    // A2=7, B1=5, B2=5, C1=2 — a borderline B1 learner (the core audience).
    const borderline = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => {
      const target: Record<string, number> = { A2: 7, B1: 5, B2: 5, C1: 2 }
      const answered = PLACEMENT_QUESTIONS.filter((item) => item.level === question.level)
      const index = answered.indexOf(question)
      const correctCount = target[question.level] ?? 0
      return [question.id, index < correctCount ? question.correctIndex : (question.correctIndex + 1) % question.choices.length]
    }))
    expect(scorePlacement(borderline).suggestedLevel).toBe('B1')
    expect(scorePlacement(borderline).foundationReview).toBe(false)

    // Raising the B2 band from 5 to 6 must never drop the recommendation below B1.
    const b2 = PLACEMENT_QUESTIONS.filter((question) => question.level === 'B2')
    const stronger = { ...borderline, [b2[5].id]: b2[5].correctIndex }
    const levelOrder = ['A2', 'B1', 'B2', 'C1']
    expect(levelOrder.indexOf(scorePlacement(stronger).suggestedLevel)).toBeGreaterThanOrEqual(levelOrder.indexOf('B1'))
  })

  it('tolerates a small amount of lower-band noise when upper-band evidence is strong', () => {
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    for (const question of PLACEMENT_QUESTIONS.filter((item) => item.level === 'A2').slice(0, 3)) {
      selected[question.id] = (question.correctIndex + 1) % question.choices.length
    }
    for (const question of PLACEMENT_QUESTIONS.filter((item) => item.level === 'C1')) {
      selected[question.id] = (question.correctIndex + 1) % question.choices.length
    }

    expect(scorePlacement(selected).suggestedLevel).toBe('B2')
    expect(scorePlacement(selected).foundationReview).toBe(false)
  })

  it('keeps exactly four of eight A2 answers below the foundation threshold', () => {
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    for (const question of PLACEMENT_QUESTIONS.filter((item) => item.level === 'A2').slice(0, 4)) {
      selected[question.id] = (question.correctIndex + 1) % question.choices.length
    }

    expect(scorePlacement(selected)).toMatchObject({ suggestedLevel: 'A2', foundationReview: true })
  })

  it('reports normalized skill evidence and keeps remediation at or below the working level', () => {
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    for (const question of PLACEMENT_QUESTIONS.filter((item) => item.level === 'B2' || item.level === 'C1')) {
      selected[question.id] = (question.correctIndex + 1) % question.choices.length
    }
    const missedB1 = PLACEMENT_QUESTIONS.find((question) => question.id === 'b1-02')!
    selected[missedB1.id] = (missedB1.correctIndex + 1) % missedB1.choices.length

    const result = scorePlacement(selected)
    expect(result.suggestedLevel).toBe('B1')
    expect(result.skillScores).toMatchObject({
      grammar: { total: 8 },
      vocabulary: { total: 8 },
      reading: { total: 8 },
      use_of_english: { total: 8 },
    })
    expect(result.limitations.join(' ')).toMatch(/does not test listening, speaking or writing/i)
    expect(recommendedPlacementLessonIds(selected)).toEqual(['b1-zero-first-second-conditionals'])
  })

  it('builds a complete auditable answer list', () => {
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    expect(scorePlacement(selected).suggestedLevel).toBe('C1')
    expect(placementAnswers(selected)).toHaveLength(32)
    expect(placementAnswers(selected).every((answer) => answer.correct)).toBe(true)
    expect(isCompletePlacementSelection(selected)).toBe(true)
    expect(recommendedPlacementLessonIds(selected)).toEqual([])
    expect(isCompletePlacementSelection({ ...selected, unexpected: 0 })).toBe(false)
  })

  it('reconstructs only a complete, unique saved selection from raw answers', () => {
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    const answers = placementAnswers(selected)

    expect(placementSelectionFromAnswers(answers)).toEqual(selected)
    expect(placementSelectionFromAnswers(answers.slice(1))).toBeUndefined()
    expect(placementSelectionFromAnswers([...answers, answers[0]])).toBeUndefined()
    expect(placementSelectionFromAnswers(answers.map((answer, index) => index === 0 ? { ...answer, selectedIndex: 99 } : answer))).toBeUndefined()
  })

  it('builds legacy remediation from stored correctness rather than the current answer key', () => {
    const question = PLACEMENT_QUESTIONS.find((item) => item.id === 'b1-02')!
    const answers = [{ questionId: question.id, selectedIndex: question.correctIndex, correct: false }]

    expect(recommendedPlacementLessonIdsFromAnswers(answers, 'B1')).toEqual(['b1-zero-first-second-conditionals'])
  })

  it('does not invent a weakest skill when diagnostic rates are tied', () => {
    const allCorrect = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    expect(scorePlacement(allCorrect).weakestSkill).toBeUndefined()

    const readingMisses = { ...allCorrect }
    for (const question of PLACEMENT_QUESTIONS.filter((item) => item.skill === 'reading')) readingMisses[question.id] = (question.correctIndex + 1) % 4
    expect(scorePlacement(readingMisses).weakestSkill).toBe('reading')
  })

  it('keeps pure reading comprehension items out of grammar remediation', () => {
    expect(PLACEMENT_QUESTIONS.filter((question) => question.skill === 'reading').every((question) => !question.lessonId)).toBe(true)
  })

  it('does not send semantic phrasal-verb misses to an unrelated word-order lesson', () => {
    for (const id of ['b1-06', 'b2-06']) {
      const question = PLACEMENT_QUESTIONS.find((item) => item.id === id)!
      expect(question.skill).toBe('vocabulary')
      expect(question.lessonId).toBeUndefined()
    }
  })

  it('routes form misses to the most specific authored lesson', () => {
    expect(Object.fromEntries(PLACEMENT_QUESTIONS.filter((question) => ['a2-08', 'b1-01', 'c1-04'].includes(question.id)).map((question) => [question.id, question.lessonId]))).toEqual({
      'a2-08': 'a2-dependent-prepositions',
      'b1-01': 'b1-present-perfect-since-for',
      'c1-04': 'c1-mandative-subjunctive',
    })
  })
})
