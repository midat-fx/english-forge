import { describe, expect, it } from 'vitest'
import { includesPhrase } from '../domain/normalization'
import { lexicalCatalogA2All } from './lexicalCatalogA2All'
import { lexicalCatalogB1All } from './lexicalCatalogB1All'
import { lexicalCatalogB2 } from './lexicalCatalogB2'
import { lexicalCatalogB2ExpansionPart2 } from './lexicalCatalogB2ExpansionPart2'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

const canonical = (value: string) => value.toLocaleLowerCase('en').replace(/[.?!…]/gu, '').trim()
const wordCount = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length

describe('B2 lexical expansion part 2', () => {
  it('contains 376 high-utility B2 entries after exact duplicate removal', () => {
    expect(lexicalCatalogB2ExpansionPart2).toHaveLength(376)
  })

  it('has unique ids and canonical expressions', () => {
    const ids = lexicalCatalogB2ExpansionPart2.map((item) => item.id)
    const expressions = lexicalCatalogB2ExpansionPart2.map((item) => canonical(item.expression))
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(expressions).size).toBe(expressions.length)
  })

  it('does not duplicate A2, B1, or core B2 expressions', () => {
    const earlier = new Set([...lexicalCatalogA2All, ...lexicalCatalogB1All, ...lexicalCatalogB2].map((item) => canonical(item.expression)))
    expect(lexicalCatalogB2ExpansionPart2.filter((item) => earlier.has(canonical(item.expression))).map((item) => item.expression)).toEqual([])
  })

  it('provides natural bilingual examples and practice-compatible answers', () => {
    const failures = []
    for (const item of lexicalCatalogB2ExpansionPart2) {
      expect(item.translationRu, item.id).toMatch(/[а-яё]/iu)
      expect(wordCount(item.example), item.id).toBeGreaterThanOrEqual(6)
      expect(wordCount(item.exampleTranslationRu), item.id).toBeGreaterThanOrEqual(4)
      if (!includesPhrase(item.example, item.expression, catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id))) failures.push(item.id)
    }
    expect(failures).toEqual([])
  })

  it('mixes words, collocations, phrasal verbs, and idiomatic formulas', () => {
    const kinds = new Set(lexicalCatalogB2ExpansionPart2.map((item) => item.kind))
    for (const kind of ['word', 'collocation', 'phrasal_verb', 'register_formula'] as const) expect(kinds.has(kind)).toBe(true)
  })

  it('uses natural Russian support and keeps examples aligned with patterns', () => {
    const byExpression = new Map(lexicalCatalogB2ExpansionPart2.map((item) => [item.expression, item]))

    expect(byExpression.get('allocate emergency funding')).toMatchObject({
      translationRu: 'выделить экстренные средства',
      exampleTranslationRu: 'Местные власти могут выделить экстренные средства после сильного наводнения.',
    })
    expect(byExpression.get('catch up on')?.exampleTranslationRu).toBe(
      'По пятницам после обеда я разбираюсь с накопившейся административной работой.',
    )
    expect(byExpression.get('be prone to')).toMatchObject({
      example: 'Older devices are prone to overheating during long recording sessions.',
      pattern: 'be prone to + noun / -ing',
    })
  })
})
