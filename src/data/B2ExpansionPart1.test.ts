import { describe, expect, it } from 'vitest'
import { includesPhrase } from '../domain/normalization'
import { lexicalCatalogA2All } from './lexicalCatalogA2All'
import { lexicalCatalogB1All } from './lexicalCatalogB1All'
import { lexicalCatalogB2 } from './lexicalCatalogB2'
import { lexicalCatalogB2ExpansionPart1 } from './lexicalCatalogB2ExpansionPart1'
import { lexicalCatalogB2ExpansionPart2 } from './lexicalCatalogB2ExpansionPart2'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

const canonical = (value: string) => value.toLocaleLowerCase('en').replace(/[.?!…]/gu, '').trim()
const wordCount = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length

describe('B2 lexical expansion part 1', () => {
  it('contains at least 220 high-utility B2 entries', () => {
    expect(lexicalCatalogB2ExpansionPart1.length).toBeGreaterThanOrEqual(220)
  })

  it('has unique ids and canonical expressions', () => {
    const ids = lexicalCatalogB2ExpansionPart1.map((item) => item.id)
    const expressions = lexicalCatalogB2ExpansionPart1.map((item) => canonical(item.expression))
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(expressions).size).toBe(expressions.length)
  })

  it('keeps enough novel entries after stable global deduplication', () => {
    const earlier = new Set([...lexicalCatalogA2All, ...lexicalCatalogB1All, ...lexicalCatalogB2, ...lexicalCatalogB2ExpansionPart2].map((item) => canonical(item.expression)))
    const novelPart1 = lexicalCatalogB2ExpansionPart1.filter((item) => !earlier.has(canonical(item.expression)))
    const productionExpressions = new Set(
      [...lexicalCatalogB2, ...lexicalCatalogB2ExpansionPart2, ...novelPart1].map((item) => canonical(item.expression)),
    )

    expect(lexicalCatalogB2.length + lexicalCatalogB2ExpansionPart1.length + lexicalCatalogB2ExpansionPart2.length).toBeGreaterThanOrEqual(650)
    expect(novelPart1.length).toBeGreaterThanOrEqual(180)
    expect(productionExpressions.size).toBeGreaterThanOrEqual(600)
  })

  it('provides substantial bilingual examples usable in active practice', () => {
    const failures: string[] = []
    for (const item of lexicalCatalogB2ExpansionPart1) {
      expect(item.translationRu, item.id).toMatch(/[а-яё]/iu)
      expect(wordCount(item.example), item.id).toBeGreaterThanOrEqual(6)
      expect(wordCount(item.exampleTranslationRu), item.id).toBeGreaterThanOrEqual(4)
      if (!includesPhrase(item.example, item.expression, catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id))) failures.push(item.id)
    }
    expect(failures).toEqual([])
  })

  it('mixes all six supported catalog item types', () => {
    expect(new Set(lexicalCatalogB2ExpansionPart1.map((item) => item.kind))).toEqual(
      new Set(['word', 'collocation', 'phrasal_verb', 'discourse_marker', 'grammar_frame', 'register_formula']),
    )
  })

  it('keeps key bilingual frames and examples natural', () => {
    const byExpression = new Map(lexicalCatalogB2ExpansionPart1.map((item) => [item.expression, item]))

    expect(byExpression.get('circumstances')).toMatchObject({
      translationRu: 'обстоятельства',
      example: 'The decision depends on each family’s circumstances.',
    })
    expect(byExpression.get('follow up on')).toMatchObject({
      translationRu: 'принять дальнейшие меры по; проконтролировать',
      exampleTranslationRu: 'Сотрудники примут дальнейшие меры по каждой серьёзной жалобе.',
      pattern: 'follow up on + issue / information',
    })
    expect(byExpression.get('whether or not')).toMatchObject({
      translationRu: 'ли… или нет; независимо от того, …',
      meaningEn: 'used to include both possible alternatives explicitly',
      exampleTranslationRu: 'Мы должны решить, продолжать ли работу или нет.',
    })
  })
})
