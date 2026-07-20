import { describe, expect, it } from 'vitest'
import { LISTENING_PROMPTS_BY_LEVEL, PLACEMENT_LISTENING_PROMPTS } from './listeningPromptBank'

describe('authored listening prompt bank', () => {
  it('contains five unique prompts per level with balanced answer positions', () => {
    const all = Object.values(LISTENING_PROMPTS_BY_LEVEL).flat()
    expect(all).toHaveLength(20)
    expect(new Set(all.map((prompt) => prompt.id)).size).toBe(20)
    for (const [level, prompts] of Object.entries(LISTENING_PROMPTS_BY_LEVEL)) {
      expect(prompts).toHaveLength(5)
      expect(prompts.every((prompt) => prompt.level === level && prompt.text.length >= 40 && prompt.question.endsWith('?'))).toBe(true)
      expect(new Set(prompts.flatMap((prompt) => prompt.choices)).size).toBeGreaterThanOrEqual(12)
    }
  })

  it('selects exactly two prompts per level for optional placement listening', () => {
    expect(PLACEMENT_LISTENING_PROMPTS).toHaveLength(8)
    expect(Object.fromEntries(['A2', 'B1', 'B2', 'C1'].map((level) => [level, PLACEMENT_LISTENING_PROMPTS.filter((prompt) => prompt.level === level).length]))).toEqual({ A2: 2, B1: 2, B2: 2, C1: 2 })
  })

  it('uses coherent two-to-three-sentence passages for every C1 prompt', () => {
    const prompts = LISTENING_PROMPTS_BY_LEVEL.C1
    expect(prompts.map((prompt) => prompt.id)).toEqual([
      'c1-evidence', 'c1-assumption', 'c1-tradeoff', 'c1-interpretation', 'c1-accountability',
    ])
    for (const prompt of prompts) {
      const sentenceCount = prompt.text.split(/[.!?](?:\s+|$)/u).filter(Boolean).length
      expect(sentenceCount, prompt.id).toBeGreaterThanOrEqual(2)
      expect(sentenceCount, prompt.id).toBeLessThanOrEqual(3)
    }
  })
})
