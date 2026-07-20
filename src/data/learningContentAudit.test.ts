import { describe, expect, it } from 'vitest'
import { auditLearningContent } from './learningContentAudit'

describe('exhaustive learning-content audit', () => {
  const audit = auditLearningContent()

  it('audits every production vocabulary card, grammar lesson, quiz and placement item', () => {
    expect(audit.lexical.total).toBe(2_164)
    expect(audit.lexical.byLevel).toEqual({ A2: 800, B1: 305, B2: 634, C1: 425 })
    expect(audit.grammar.lessons).toBe(124)
    expect(audit.grammar.questions).toBe(372)
    expect(audit.placement.questions).toBe(32)
  })

  it('has no machine-detectable critical content defects', () => {
    expect(audit.issues.filter((issue) => issue.severity === 'critical')).toEqual([])
  })

  it('keeps the placement answer key balanced and all remediation links resolvable', () => {
    expect(audit.placement.answerPositions).toEqual([8, 8, 8, 8])
    expect(audit.issues.find((issue) => issue.code === 'placement-answer-position-gap')).toBeUndefined()
    expect(audit.issues.find((issue) => issue.code === 'placement-broken-lesson-link')).toBeUndefined()
  })

  it('rejects retired mechanical example families from production content', () => {
    expect(audit.lexical.mechanicallyFramedExamples).toBe(0)
    expect(audit.issues.find((issue) => issue.code === 'lexical-mechanical-example-family')).toBeUndefined()
    expect(audit.placement.bySkill).toEqual({ grammar: 8, vocabulary: 8, reading: 8, use_of_english: 8 })
    expect(audit.issues.find((issue) => issue.code === 'placement-skill-sampling-imbalance')).toBeUndefined()
    expect(audit.issues.find((issue) => issue.code === 'lexical-pattern-metadata-review')).toBeUndefined()
  })
})
