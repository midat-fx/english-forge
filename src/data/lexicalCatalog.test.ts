import { describe, expect, it } from 'vitest'
import { includesPhrase, phraseFingerprint } from '../domain/normalization'
import { lexicalCatalog, lexicalCatalogByLevel, lexicalCatalogMethodology } from './lexicalCatalog'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

const wordCount = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length

describe('CEFR lexical catalog', () => {
  it('contains the complete production catalog without padding B1 through generated rows', () => {
    expect(lexicalCatalog).toHaveLength(2_164)
    expect(lexicalCatalogByLevel.A2).toHaveLength(800)
    expect(lexicalCatalogByLevel.B1).toHaveLength(305)
    expect(lexicalCatalogByLevel.B2).toHaveLength(634)
    expect(lexicalCatalogByLevel.C1).toHaveLength(425)
    expect(lexicalCatalogByLevel.B1.some((item) => /^lex-b1-x\d+-/u.test(item.id))).toBe(false)
  })

  it('uses stable unique ids and does not repeat canonical expressions', () => {
    const ids = lexicalCatalog.map((item) => item.id)
    const expressions = lexicalCatalog.map((item) => phraseFingerprint(item.expression))

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(expressions).size).toBe(expressions.length)
    for (const item of lexicalCatalog) {
      expect(item.id).toMatch(/^lex-(a2|b1|b2|c1)-[a-z0-9-]+$/u)
      expect(item.id.startsWith(`lex-${item.level.toLowerCase()}-`)).toBe(true)
    }
  })

  it('provides usable bilingual learning content for every item', () => {
    const examples = new Set<string>()

    for (const item of lexicalCatalog) {
      expect(item.expression.trim().length).toBeGreaterThan(1)
      expect(item.translationRu).toMatch(/[а-яё]/iu)
      expect(wordCount(item.meaningEn), item.id).toBeGreaterThanOrEqual(2)
      expect(wordCount(item.example), item.id).toBeGreaterThanOrEqual(6)
      expect(item.exampleTranslationRu, item.id).toMatch(/[а-яё]/iu)
      expect(wordCount(item.exampleTranslationRu), item.id).toBeGreaterThanOrEqual(4)
      expect(item.topic.trim().length).toBeGreaterThan(2)
      expect(examples.has(item.example)).toBe(false)
      examples.add(item.example)
    }
  })

  it('mixes lexical chunks, words, discourse, grammar, and register-aware formulas', () => {
    const kinds = new Set(lexicalCatalog.map((item) => item.kind))
    const registers = new Set(lexicalCatalog.map((item) => item.register))

    expect(kinds).toEqual(
      new Set(['word', 'collocation', 'phrasal_verb', 'discourse_marker', 'grammar_frame', 'register_formula']),
    )
    expect(registers).toEqual(new Set(['neutral', 'informal', 'formal', 'spoken', 'academic']))
    expect(lexicalCatalog.filter((item) => item.pattern).length).toBeGreaterThan(30)
  })

  it('records authoritative methodology sources without presenting them as item citations', () => {
    expect(lexicalCatalogMethodology.sources.length).toBeGreaterThanOrEqual(6)
    expect(new Set(lexicalCatalogMethodology.sources.map((source) => source.url)).size).toBe(
      lexicalCatalogMethodology.sources.length,
    )
    for (const source of lexicalCatalogMethodology.sources) {
      expect(source.url).toMatch(/^https:\/\//u)
      expect(source.organisation.trim()).not.toBe('')
      expect(source.purpose.trim()).not.toBe('')
    }
  })

  it('keeps EVP C1 headwords out of the B2 production set', () => {
    const movedExpressions = ['ambiguous', 'consensus', 'empirical', 'resilience']
    expect(lexicalCatalogByLevel.B2.filter((item) => movedExpressions.includes(item.expression))).toEqual([])
    expect(
      lexicalCatalogByLevel.C1
        .filter((item) => movedExpressions.includes(item.expression))
        .map((item) => ({ id: item.id, expression: item.expression })),
    ).toEqual([
      { id: 'lex-c1-ambiguous', expression: 'ambiguous' },
      { id: 'lex-c1-consensus', expression: 'consensus' },
      { id: 'lex-c1-empirical', expression: 'empirical' },
      { id: 'lex-c1-resilience', expression: 'resilience' },
    ])
  })

  it('makes every catalog example usable in active practice', () => {
    const failures = lexicalCatalog.filter((item) => !includesPhrase(item.example, item.expression, catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id))).map((item) => ({ id: item.id, expression: item.expression, example: item.example }))
    expect(failures).toEqual([])
  })

  it('accepts real regular forms without inventing doubled spellings or undefined aliases', () => {
    expect(includesPhrase('I visited a website yesterday.', 'visit a website', catalogAcceptedForms('visit a website'))).toBe(true)
    expect(includesPhrase('She opened a window.', 'open a window', catalogAcceptedForms('open a window'))).toBe(true)
    expect(includesPhrase('They offered help immediately.', 'offer help', catalogAcceptedForms('offer help'))).toBe(true)
    expect(includesPhrase('I visitted a website yesterday.', 'visit a website', catalogAcceptedForms('visit a website'))).toBe(false)
    expect(includesPhrase('She openned a window.', 'open a window', catalogAcceptedForms('open a window'))).toBe(false)
    expect(includesPhrase('They offerred help immediately.', 'offer help', catalogAcceptedForms('offer help'))).toBe(false)
    expect(includesPhrase('We take the bus for work.', 'take responsibility for', catalogAcceptedForms('take responsibility for'))).toBe(false)
    expect(includesPhrase('The staff put the files on a shelf.', 'put a strain on', catalogAcceptedForms('put a strain on'))).toBe(false)
    expect(catalogAcceptedForms('prefer ...')).not.toContain('prefer undefined')
  })
})
