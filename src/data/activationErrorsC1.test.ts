import { describe, expect, it } from 'vitest'
import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import { normalizePhrase } from '../domain/normalization'
import { buildActivationErrorPrompt } from '../domain/practice'
import type { Phrase } from '../domain/types'
import { activationErrorsC1 } from './activationErrorsC1'
import { lexicalCatalogC1All } from './lexicalCatalogC1All'
import { attachActivationReadiness } from './lexicalCatalogLoader'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

const readyCatalogC1 = attachActivationReadiness(lexicalCatalogC1All, activationErrorsC1)

function catalogPhrase(item: LexicalCatalogItem, baseline = false): Phrase {
  return {
    id: baseline ? `baseline-${item.id}` : item.id,
    canonical: item.expression,
    normalizedKey: normalizePhrase(item.expression),
    meaning: `${item.translationRu} · ${item.meaningEn}`,
    kind: item.kind,
    cefr: item.level,
    register: [item.register],
    context: item.example,
    source: 'English Forge Core Library',
    tags: baseline ? [] : ['core-library', `catalog-item:${item.id}`],
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

function lexicalOverlap(left: string, right: string): number {
  const tokens = (value: string) => new Set(normalizePhrase(value).split(' ').filter((token) => token.length > 1))
  const actual = tokens(left)
  const expected = tokens(right)
  return [...actual].filter((token) => expected.has(token)).length / Math.max(1, expected.size)
}

describe('C1 authored activation-error metadata', () => {
  it('fails closed without metadata and exposes only the reviewed C1 subset', () => {
    const baseline = attachActivationReadiness(lexicalCatalogC1All, [])
    const catalogIds = new Set(lexicalCatalogC1All.map((item) => item.id))

    expect(baseline.filter((item) => item.activationReady)).toHaveLength(0)
    expect(lexicalCatalogC1All.every((item) => buildActivationErrorPrompt(catalogPhrase(item, true)).kind === 'reconstruction')).toBe(true)
    expect(activationErrorsC1).toHaveLength(265)
    expect(new Set(activationErrorsC1.map((pair) => pair.catalogItemId)).size).toBe(activationErrorsC1.length)
    expect(activationErrorsC1.every((pair) => catalogIds.has(pair.catalogItemId))).toBe(true)
    expect(readyCatalogC1.filter((item) => item.activationReady)).toHaveLength(265)
    expect(readyCatalogC1.filter((item) => !item.activationReady)).toHaveLength(160)
  })

  it('binds every item to its exact example, explicit error, and item-specific cue', () => {
    const catalogById = new Map(readyCatalogC1.map((item) => [item.id, item]))

    for (const pair of activationErrorsC1) {
      const item = catalogById.get(pair.catalogItemId)
      expect(item, pair.catalogItemId).toBeDefined()
      expect(pair.expectedCorrection, pair.catalogItemId).toBe(item?.example)
      expect(pair.incorrectContext, pair.catalogItemId).not.toBe(pair.expectedCorrection)
      expect(pair.cue.trim(), pair.catalogItemId).not.toBe('')
      expect(lexicalOverlap(pair.incorrectContext, pair.expectedCorrection), pair.catalogItemId).toBeGreaterThanOrEqual(0.6)

      expect(buildActivationErrorPrompt(catalogPhrase(item!)), pair.catalogItemId).toEqual({
        instruction: 'Шаг 6 из 8 · исправление типичной ошибки',
        cue: pair.cue,
        context: pair.incorrectContext,
        kind: 'typical',
        expectedCorrection: pair.expectedCorrection,
      })
    }

    expect(new Set(activationErrorsC1.map((pair) => pair.cue)).size).toBe(activationErrorsC1.length)
  })

  it('keeps audited samples exact across error classes', () => {
    const byId = new Map(activationErrorsC1.map((pair) => [pair.catalogItemId, pair]))
    expect(byId.get('lex-c1-brush-aside')).toMatchObject({
      incorrectContext: 'The committee should not brushes aside criticism from local residents.',
      expectedCorrection: 'The committee should not brush aside criticism from local residents.',
    })
    expect(byId.get('lex-c1-empirical-evidence')).toMatchObject({
      incorrectContext: 'The theory lacks sufficient empirical evidences at present.',
      expectedCorrection: 'The theory lacks sufficient empirical evidence at present.',
    })
    expect(byId.get('lex-c1-lest')).toMatchObject({
      incorrectContext: 'The data were anonymised lest individuals to be identified.',
      expectedCorrection: 'The data were anonymised lest individuals be identified.',
    })
    expect(byId.get('lex-c1-on-no-account')).toMatchObject({
      incorrectContext: 'On no account confidential files should leave the premises.',
      expectedCorrection: 'On no account should confidential files leave the premises.',
    })
    expect(byId.get('lex-c1-all-intents-purposes')).toMatchObject({
      incorrectContext: 'The temporary arrangement is, for all intensive purposes, permanent.',
      expectedCorrection: 'The temporary arrangement is, for all intents and purposes, permanent.',
    })
  })
})
