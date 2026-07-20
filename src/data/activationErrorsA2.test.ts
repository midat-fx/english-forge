import { describe, expect, it } from 'vitest'
import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import { normalizePhrase } from '../domain/normalization'
import { buildActivationErrorPrompt } from '../domain/practice'
import type { Phrase } from '../domain/types'
import { activationErrorsA2 } from './activationErrorsA2'
import { lexicalCatalogA2All } from './lexicalCatalogA2All'
import { attachActivationReadiness } from './lexicalCatalogLoader'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

const baselineCatalogA2 = attachActivationReadiness(lexicalCatalogA2All, [])
const readyCatalogA2 = attachActivationReadiness(lexicalCatalogA2All, activationErrorsA2)

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

describe('A2 authored activation-error metadata', () => {
  it('fails closed to the 160 explicitly authored repairs', () => {
    expect(lexicalCatalogA2All).toHaveLength(800)
    expect(baselineCatalogA2.filter((item) => item.activationReady)).toHaveLength(0)
    expect(activationErrorsA2).toHaveLength(160)
    expect(readyCatalogA2.filter((item) => item.activationReady)).toHaveLength(160)
    expect(readyCatalogA2.filter((item) => item.activationError && item.activationReady)).toHaveLength(160)
  })

  it('exhaustively binds every pair to one exact catalog example and one production repair', () => {
    const rawById = new Map(lexicalCatalogA2All.map((item) => [item.id, item]))
    const readyById = new Map(readyCatalogA2.map((item) => [item.id, item]))
    const ids = activationErrorsA2.map((pair) => pair.catalogItemId)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(activationErrorsA2.map((pair) => pair.cue)).size).toBe(activationErrorsA2.length)

    for (const pair of activationErrorsA2) {
      const rawItem = rawById.get(pair.catalogItemId)
      const readyItem = readyById.get(pair.catalogItemId)
      expect(rawItem, pair.catalogItemId).toBeDefined()
      expect(readyItem, pair.catalogItemId).toBeDefined()
      expect(pair.expectedCorrection, pair.catalogItemId).toBe(rawItem?.example)
      expect(pair.incorrectContext, pair.catalogItemId).not.toBe(pair.expectedCorrection)
      expect(pair.cue.trim(), pair.catalogItemId).not.toBe('')
      expect(tokenEditDistance(pair.incorrectContext, pair.expectedCorrection), pair.catalogItemId).toBe(1)
      expect(pair.incorrectContext, pair.catalogItemId).not.toMatch(/\b(?:at|for|from|in|of|on|to|with)\s+(?:at|for|from|in|of|on|to|with)\b/iu)
      expect(readyItem?.activationReady, pair.catalogItemId).toBe(true)
      expect(readyItem?.activationError, pair.catalogItemId).toEqual({
        incorrectContext: pair.incorrectContext,
        expectedCorrection: pair.expectedCorrection,
        cue: pair.cue,
      })
      expect(buildActivationErrorPrompt(catalogPhrase(readyItem!)), pair.catalogItemId).toEqual({
        instruction: 'Шаг 6 из 8 · исправление типичной ошибки',
        cue: pair.cue,
        context: pair.incorrectContext,
        kind: 'typical',
        expectedCorrection: pair.expectedCorrection,
      })
    }
  })

  it('keeps audited samples exact across common A2 error classes', () => {
    const byId = new Map<string, (typeof activationErrorsA2)[number]>(activationErrorsA2.map((pair) => [pair.catalogItemId, pair]))
    expect(byId.get('lex-a2-take-notes')).toMatchObject({
      incorrectContext: 'Take a notes while you listen to the presentation.',
      expectedCorrection: 'Take notes while you listen to the presentation.',
    })
    expect(byId.get('lex-a2-could-you')).toMatchObject({
      incorrectContext: 'Could you to speak a little more slowly, please?',
      expectedCorrection: 'Could you speak a little more slowly, please?',
    })
    expect(byId.get('lex-a2-not-as-as')).toMatchObject({
      incorrectContext: 'The second exercise was not as difficult than the first.',
      expectedCorrection: 'The second exercise was not as difficult as the first.',
    })
    expect(byId.get('lex-a2-advice')).toMatchObject({
      incorrectContext: 'My teacher gave me useful advices about vocabulary practice.',
      expectedCorrection: 'My teacher gave me useful advice about vocabulary practice.',
    })
    expect(byId.get('lex-a2-owner')).toMatchObject({
      incorrectContext: 'The own of the café knows all her regular customers.',
      expectedCorrection: 'The owner of the café knows all her regular customers.',
    })
  })
})
