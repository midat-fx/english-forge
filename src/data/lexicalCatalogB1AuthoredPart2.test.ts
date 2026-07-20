import { describe, expect, it } from 'vitest'
import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import { includesPhrase, normalizePhrase } from '../domain/normalization'
import { buildActivationErrorPrompt } from '../domain/practice'
import type { Phrase } from '../domain/types'
import { activationErrorsB1AuthoredPart2 } from './activationErrorsB1AuthoredPart2'
import { lexicalCatalog } from './lexicalCatalog'
import { lexicalCatalogB1AuthoredPart1 } from './lexicalCatalogB1AuthoredPart1'
import { lexicalCatalogB1AuthoredPart2 } from './lexicalCatalogB1AuthoredPart2'
import { attachActivationReadiness } from './lexicalCatalogLoader'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

const readyPart2 = attachActivationReadiness(lexicalCatalogB1AuthoredPart2, activationErrorsB1AuthoredPart2)

function catalogPhrase(item: LexicalCatalogItem): Phrase {
  return {
    id: item.id,
    canonical: item.expression,
    normalizedKey: normalizePhrase(item.expression),
    meaning: `${item.translationRu} · ${item.meaningEn}`,
    kind: item.kind,
    cefr: item.level,
    register: [item.register],
    context: item.example,
    source: 'English Forge Core Library',
    tags: ['core-library', `catalog-item:${item.id}`],
    note: item.note ?? '',
    acceptedForms: catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id),
    examples: [],
    depth: {
      grammarFrame: item.pattern ?? '',
      collocates: [],
      constraints: item.note ? [item.note] : [],
      contrasts: [],
      connotation: '',
      pronunciationNote: '',
    },
    status: 'new',
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
    ...(item.activationError ? { activationError: item.activationError } : {}),
  }
}

function tokenEditDistance(left: string, right: string): number {
  const a = normalizePhrase(left).split(' ').filter(Boolean)
  const b = normalizePhrase(right).split(' ').filter(Boolean)
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1]! + 1,
        previous[column]! + 1,
        previous[column - 1]! + (a[row - 1] === b[column - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]!
}

describe('B1 independently authored Part 2', () => {
  it('contains exactly 80 unique, multiword-first B1 rows with no existing fingerprint conflicts', () => {
    const ids = lexicalCatalogB1AuthoredPart2.map((item) => item.id)
    const expressions = lexicalCatalogB1AuthoredPart2.map((item) => normalizePhrase(item.expression))
    const existing = new Set(
      [...lexicalCatalog, ...lexicalCatalogB1AuthoredPart1]
        .filter((item) => !item.id.startsWith('lex-b1-auth2-'))
        .map((item) => normalizePhrase(item.expression)),
    )

    expect(lexicalCatalogB1AuthoredPart2).toHaveLength(80)
    expect(new Set(ids).size).toBe(80)
    expect(new Set(expressions).size).toBe(80)
    expect(ids.every((id) => id.startsWith('lex-b1-auth2-'))).toBe(true)
    expect(lexicalCatalogB1AuthoredPart2.filter((item) => normalizePhrase(item.expression).split(' ').length >= 2).length).toBeGreaterThanOrEqual(65)
    expect(lexicalCatalogB1AuthoredPart2.filter((item) => existing.has(normalizePhrase(item.expression))).map((item) => item.expression)).toEqual([])
    expect(lexicalCatalogB1AuthoredPart2.filter((item) => item.kind === 'phrasal_verb')).toHaveLength(15)
    expect(lexicalCatalogB1AuthoredPart2.filter((item) => item.kind === 'collocation')).toHaveLength(35)
    expect(lexicalCatalogB1AuthoredPart2.filter((item) => item.kind === 'grammar_frame')).toHaveLength(20)
    expect(lexicalCatalogB1AuthoredPart2.filter((item) => item.kind === 'discourse_marker' || item.kind === 'register_formula')).toHaveLength(10)
  })

  it('gives every row complete bilingual authoring and an exact canonical surface', () => {
    for (const item of lexicalCatalogB1AuthoredPart2) {
      expect(item.level, item.id).toBe('B1')
      expect(item.expression.trim(), item.id).not.toBe('')
      expect(item.meaningEn.trim(), item.id).not.toBe('')
      expect(item.translationRu, item.id).toMatch(/[А-Яа-яЁё]/u)
      expect(includesPhrase(item.example, item.expression, catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id)), item.id).toBe(true)
      expect(item.exampleTranslationRu, item.id).toMatch(/[А-Яа-яЁё]/u)
      expect(item.example.split(/\s+/u).length, item.id).toBeGreaterThanOrEqual(7)
    }
  })

  it('exhaustively binds 80 unique single-repair pairs to the exact authored examples', () => {
    const itemById = new Map(readyPart2.map((item) => [item.id, item]))
    const pairIds = activationErrorsB1AuthoredPart2.map((pair) => pair.catalogItemId)

    expect(activationErrorsB1AuthoredPart2).toHaveLength(80)
    expect(new Set(pairIds).size).toBe(80)
    expect(new Set(activationErrorsB1AuthoredPart2.map((pair) => pair.cue)).size).toBe(80)
    expect(new Set(pairIds)).toEqual(new Set(lexicalCatalogB1AuthoredPart2.map((item) => item.id)))

    for (const pair of activationErrorsB1AuthoredPart2) {
      const item = itemById.get(pair.catalogItemId)
      expect(item, pair.catalogItemId).toBeDefined()
      expect(pair.expectedCorrection, pair.catalogItemId).toBe(item?.example)
      expect(pair.incorrectContext, pair.catalogItemId).not.toBe(pair.expectedCorrection)
      expect(pair.cue.trim(), pair.catalogItemId).not.toBe('')
      expect(tokenEditDistance(pair.incorrectContext, pair.expectedCorrection), pair.catalogItemId).toBe(1)
      expect(pair.incorrectContext, pair.catalogItemId).not.toMatch(/\b(?:at|for|from|in|of|on|to|with)\s+(?:at|for|from|in|of|on|to|with)\b/iu)
      expect(item?.activationReady, pair.catalogItemId).toBe(true)
      expect(buildActivationErrorPrompt(catalogPhrase(item!)), pair.catalogItemId).toEqual({
        instruction: 'Шаг 6 из 8 · исправление типичной ошибки',
        cue: pair.cue,
        context: pair.incorrectContext,
        kind: 'typical',
        expectedCorrection: pair.expectedCorrection,
      })
    }
  })

  it('keeps audited samples exact across item and repair types', () => {
    const itemById = new Map(lexicalCatalogB1AuthoredPart2.map((item) => [item.id, item]))
    const pairById = new Map<string, (typeof activationErrorsB1AuthoredPart2)[number]>(activationErrorsB1AuthoredPart2.map((pair) => [pair.catalogItemId, pair]))

    expect(itemById.get('lex-b1-auth2-clear-up')).toMatchObject({ expression: 'give in', translationRu: 'уступить' })
    expect(itemById.get('lex-b1-auth2-make-good-impression')).toMatchObject({ expression: 'have an argument', translationRu: 'поссориться; поспорить' })
    expect(itemById.get('lex-b1-auth2-allow-someone')).toMatchObject({ expression: 'allow someone to', kind: 'grammar_frame' })
    expect(itemById.get('lex-b1-auth2-to-be-fair')).toMatchObject({ expression: 'besides', kind: 'discourse_marker' })
    expect(pairById.get('lex-b1-auth2-cause-damage')).toMatchObject({
      incorrectContext: 'Moving heavy furniture carelessly can make damage to a wooden floor.',
      expectedCorrection: 'Moving heavy furniture carelessly can cause damage to a wooden floor.',
    })
    expect(pairById.get('lex-b1-auth2-familiar-with')).toMatchObject({
      incorrectContext: 'A clear warning may stop someone by doing something dangerous.',
      expectedCorrection: 'A clear warning may stop someone from doing something dangerous.',
    })
  })
})
