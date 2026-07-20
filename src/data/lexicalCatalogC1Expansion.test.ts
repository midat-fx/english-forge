import { describe, expect, it } from 'vitest'
import { lexicalCatalogA2 } from './lexicalCatalogA2'
import { lexicalCatalogB1 } from './lexicalCatalogB1'
import { lexicalCatalogB2 } from './lexicalCatalogB2'
import { lexicalCatalogC1 } from './lexicalCatalogC1'
import { lexicalCatalogC1Expansion } from './lexicalCatalogC1Expansion'

const normalise = (value: string) => value.trim().toLocaleLowerCase('en-US').replace(/[’‘]/g, "'").replace(/\s+/g, ' ')
const words = (value: string) => value.trim().split(/\s+/u).filter(Boolean)

describe('C1 lexical expansion', () => {
  it('raises the raw C1 catalog above four hundred curated entries', () => {
    expect(lexicalCatalogC1Expansion.length).toBeGreaterThanOrEqual(360)
    expect(lexicalCatalogC1.length + lexicalCatalogC1Expansion.length).toBeGreaterThanOrEqual(400)
  })

  it('uses unique IDs and expressions without collisions with the existing catalog', () => {
    const existing = [...lexicalCatalogA2, ...lexicalCatalogB1, ...lexicalCatalogB2, ...lexicalCatalogC1]
    const existingIds = new Set(existing.map(({ id }) => id))
    const existingExpressions = new Set(existing.map(({ expression }) => normalise(expression)))
    const expansionIds = lexicalCatalogC1Expansion.map(({ id }) => id)
    const expansionExpressions = lexicalCatalogC1Expansion.map(({ expression }) => normalise(expression))

    expect(new Set(expansionIds).size).toBe(expansionIds.length)
    expect(new Set(expansionExpressions).size).toBe(expansionExpressions.length)
    expansionIds.forEach((id) => expect(existingIds.has(id), id).toBe(false))
    lexicalCatalogC1Expansion.forEach(({ id, expression }) => {
      expect(existingExpressions.has(normalise(expression)), `${id}: ${expression}`).toBe(false)
    })
  })

  it('contains complete bilingual examples and useful metadata', () => {
    for (const item of lexicalCatalogC1Expansion) {
      expect(item.level, item.id).toBe('C1')
      expect(item.expression.trim().length, item.id).toBeGreaterThan(1)
      expect(item.meaningEn.trim().length, item.id).toBeGreaterThan(20)
      expect(words(item.example).length, item.id).toBeGreaterThanOrEqual(6)
      expect(words(item.exampleTranslationRu).length, item.id).toBeGreaterThanOrEqual(4)
      expect(item.exampleTranslationRu, item.id).toMatch(/[А-Яа-яЁё]/u)
      expect(item.topic.trim().length, item.id).toBeGreaterThan(2)
      expect(item.register, item.id).toMatch(/^(neutral|informal|formal|spoken|academic)$/)
    }
  })
})
