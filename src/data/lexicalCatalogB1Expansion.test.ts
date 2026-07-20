import { describe, expect, it } from 'vitest'
import { includesPhrase, phraseFingerprint } from '../domain/normalization'
import { lexicalCatalogB1 } from './lexicalCatalogB1'
import { lexicalCatalogB1Additional } from './lexicalCatalogB1Additional'
import { lexicalCatalogB1AuthoredPart1 } from './lexicalCatalogB1AuthoredPart1'
import { lexicalCatalogB1AuthoredPart2 } from './lexicalCatalogB1AuthoredPart2'
import { lexicalCatalogB1All } from './lexicalCatalogB1All'
import { uniqueCatalogLevelAgainstExpressions } from './lexicalCatalogDeduplication'
import { B1_LOWER_LEVEL_EXPRESSIONS } from './lexicalCatalogLevelExclusions'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

const authoredSource = [
  ...lexicalCatalogB1,
  ...lexicalCatalogB1Additional,
  ...lexicalCatalogB1AuthoredPart1,
  ...lexicalCatalogB1AuthoredPart2,
]
const expectedProductionCatalog = uniqueCatalogLevelAgainstExpressions(authoredSource, B1_LOWER_LEVEL_EXPRESSIONS)
const generatedExpansionId = /^lex-b1-x\d+-/u
const retiredMechanicalFrame = /^(?:In this situation, it is (?:often helpful|important) to |One useful option is to |You may need to |Without careful planning, we may )/u

const wordCount = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length

describe('authored B1 production catalog', () => {
  it('ships only the four explicitly authored static row sets', () => {
    expect(lexicalCatalogB1).toHaveLength(80)
    expect(lexicalCatalogB1Additional).toHaveLength(83)
    expect(lexicalCatalogB1AuthoredPart1).toHaveLength(80)
    expect(lexicalCatalogB1AuthoredPart2).toHaveLength(80)
    expect(lexicalCatalogB1All).toEqual(expectedProductionCatalog)
    expect(lexicalCatalogB1All).toHaveLength(305)

    const authoredIds = new Set(authoredSource.map((item) => item.id))
    expect(lexicalCatalogB1All.every((item) => authoredIds.has(item.id))).toBe(true)
  })

  it('keeps at least half of the activation curriculum multiword', () => {
    const multiword = lexicalCatalogB1All.filter((item) => phraseFingerprint(item.expression).split(' ').length >= 2)
    expect(multiword.length / lexicalCatalogB1All.length).toBeGreaterThanOrEqual(0.5)
  })

  it('cannot admit any item from the retired generated expansion', () => {
    expect(lexicalCatalogB1All.filter((item) => generatedExpansionId.test(item.id))).toEqual([])
    expect(lexicalCatalogB1All.filter((item) => retiredMechanicalFrame.test(item.example))).toEqual([])
  })

  it('does not reteach the transparent A2 pay-attention sense at B1', () => {
    expect(lexicalCatalogB1All.some((item) => phraseFingerprint(item.expression) === 'pay attention to')).toBe(false)
  })

  it('keeps stable unique ids, expressions, and examples after A2 exclusions', () => {
    const ids = lexicalCatalogB1All.map((item) => item.id)
    const expressions = lexicalCatalogB1All.map((item) => phraseFingerprint(item.expression))
    const examples = lexicalCatalogB1All.map((item) => phraseFingerprint(item.example))

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(expressions).size).toBe(expressions.length)
    expect(new Set(examples).size).toBe(examples.length)
  })

  it('keeps every shipped B1 row bilingual, contextual, and usable in active recall', () => {
    const failures = lexicalCatalogB1All.filter((item) =>
      item.level !== 'B1'
      || !/[а-яё]/iu.test(item.translationRu)
      || wordCount(item.meaningEn) < 2
      || wordCount(item.example) < 6
      || !/[а-яё]/iu.test(item.exampleTranslationRu)
      || wordCount(item.exampleTranslationRu) < 4
      || !includesPhrase(item.example, item.expression, catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id)),
    )

    expect(failures).toEqual([])
  })

  it('records an explicit pattern for every authored B1 grammar frame and register formula', () => {
    expect(
      lexicalCatalogB1All
        .filter((item) => item.kind === 'grammar_frame' || item.kind === 'register_formula')
        .filter((item) => !item.pattern)
        .map((item) => item.id),
    ).toEqual([])
  })
})
