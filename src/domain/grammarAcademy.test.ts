import { describe, expect, it } from 'vitest'
import { grammarLexicalCandidates } from './grammarAcademy'

describe('grammar lexical reuse', () => {
  const phrases = [
    { id: 'a', cefr: 'B1' as const, status: 'learning' as const, activationStage: 6 },
    { id: 'b', cefr: 'B1' as const, status: 'active' as const, activationStage: 8 },
    { id: 'c', cefr: 'B1' as const, status: 'retained' as const, activationStage: 8 },
    { id: 'wrong-level', cefr: 'A2' as const, status: 'active' as const, activationStage: 8 },
    { id: 'not-ready', cefr: 'B1' as const, status: 'learning' as const, activationStage: 5 },
  ]

  it('selects only learned same-level phrases in a stable lesson-specific rotation', () => {
    const first = grammarLexicalCandidates(phrases, 'b1-present-perfect-v-past', 'B1')
    const repeat = grammarLexicalCandidates(phrases, 'b1-present-perfect-v-past', 'B1')
    expect(first).toEqual(repeat)
    expect(first.map((phrase) => phrase.id).sort()).toEqual(['a', 'b', 'c'])
    const starts = new Set([
      first[0]?.id,
      grammarLexicalCandidates(phrases, 'b1-modals-possibility', 'B1')[0]?.id,
      grammarLexicalCandidates(phrases, 'b1-reported-questions', 'B1')[0]?.id,
    ])
    expect(starts.size).toBeGreaterThan(1)
  })
})
