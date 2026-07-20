import { describe, expect, it } from 'vitest'
import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import type { Phrase } from '../domain/types'
import { buildActivationErrorPrompt } from '../domain/practice'
import { normalizePhrase } from '../domain/normalization'
import { activationErrorsB2 } from './activationErrorsB2'
import { lexicalCatalogB2All } from './lexicalCatalogB2All'
import { attachActivationReadiness } from './lexicalCatalogLoader'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

const readyCatalogB2 = attachActivationReadiness(lexicalCatalogB2All, activationErrorsB2)

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

describe('B2 authored activation-error metadata', () => {
  it('fails closed without metadata and exposes only the duplicate-free reviewed set', () => {
    const baseline = attachActivationReadiness(lexicalCatalogB2All, [])
    const authoredIds = activationErrorsB2.map((pair) => pair.catalogItemId)

    expect(baseline.filter((item) => item.activationReady)).toHaveLength(0)
    expect(lexicalCatalogB2All.every((item) => buildActivationErrorPrompt(catalogPhrase(item, true)).kind === 'reconstruction')).toBe(true)
    expect(activationErrorsB2).toHaveLength(282)
    expect(readyCatalogB2.filter((item) => item.activationReady)).toHaveLength(282)
    expect(readyCatalogB2.filter((item) => !item.activationReady)).toHaveLength(352)
    expect(new Set(authoredIds).size).toBe(authoredIds.length)
  })

  it('binds every item to an explicit error, exact catalog correction, and item-specific cue', () => {
    const catalogById = new Map(readyCatalogB2.map((item) => [item.id, item]))

    for (const pair of activationErrorsB2) {
      const item = catalogById.get(pair.catalogItemId)
      expect(item, pair.catalogItemId).toBeDefined()
      expect(pair.expectedCorrection, pair.catalogItemId).toBe(item?.example)
      expect(pair.incorrectContext, pair.catalogItemId).not.toBe(pair.expectedCorrection)
      expect(pair.cue.trim(), pair.catalogItemId).not.toBe('')
      expect(lexicalOverlap(pair.incorrectContext, pair.expectedCorrection), pair.catalogItemId).toBeGreaterThanOrEqual(0.6)

      const prompt = buildActivationErrorPrompt(catalogPhrase(item!))
      expect(prompt, pair.catalogItemId).toEqual({
        instruction: 'Шаг 6 из 8 · исправление типичной ошибки',
        cue: pair.cue,
        context: pair.incorrectContext,
        kind: 'typical',
        expectedCorrection: pair.expectedCorrection,
      })
    }

    expect(new Set(activationErrorsB2.map((pair) => pair.cue)).size).toBe(activationErrorsB2.length)
  })

  it('restores every former stale-exclusion row as an explicitly authored activation target', () => {
    const restoredIds = [
      'lex-b2-reach-target',
      'lex-b2-contribute',
      'lex-b2-demand',
      'lex-b2-evidence',
      'lex-b2-aware',
      'lex-b2-flexible',
      'lex-b2-practical',
      'lex-b2-feedback',
      'lex-b2-meet-a-deadline',
      'lex-b2-reach-a-compromise',
      'lex-b2-take-responsibility',
      'lex-b2-come-up-with',
      'lex-b2-point-out',
      'lex-b2-there-is-no-point',
    ]
    const pairsById = new Map<string, (typeof activationErrorsB2)[number]>(activationErrorsB2.map((pair) => [pair.catalogItemId, pair]))
    const catalogById = new Map(readyCatalogB2.map((item) => [item.id, item]))

    expect(restoredIds).toHaveLength(14)
    for (const id of restoredIds) {
      const item = catalogById.get(id)
      const pair = pairsById.get(id)
      expect(item, id).toBeDefined()
      expect(pair, id).toBeDefined()
      expect(item?.activationReady, id).toBe(true)
      expect(item?.activationError, id).toEqual({
        incorrectContext: pair?.incorrectContext,
        expectedCorrection: pair?.expectedCorrection,
        cue: pair?.cue,
      })
    }
  })

  it('keeps audited learner-error samples exact across error classes', () => {
    const byId = new Map<string, (typeof activationErrorsB2)[number]>(activationErrorsB2.map((pair) => [pair.catalogItemId, pair]))
    expect(byId.get('lex-b2-come-across')).toMatchObject({
      incorrectContext: 'I came across to an old notebook while clearing the cupboard.',
      expectedCorrection: 'I came across an old notebook while clearing the cupboard.',
      cue: 'Уберите ошибочный предлог после фразового глагола со значением «случайно наткнуться».',
    })
    expect(byId.get('lex-b2-significant')).toMatchObject({
      incorrectContext: 'The policy led to a significance drop in waiting times.',
      expectedCorrection: 'The policy led to a significant drop in waiting times.',
    })
    expect(byId.get('lex-b2-conduct-research')).toMatchObject({
      incorrectContext: 'The university will conduction research into coastal pollution.',
      expectedCorrection: 'The university will conduct research into coastal pollution.',
    })
    expect(byId.get('lex-b2-criterion')).toMatchObject({
      incorrectContext: 'Cost should not be the only criteria.',
      expectedCorrection: 'Cost should not be the only criterion.',
    })
    expect(byId.get('lex-b2-under-no-circumstances')).toMatchObject({
      incorrectContext: 'Under no circumstances you should share this password.',
      expectedCorrection: 'Under no circumstances should you share this password.',
    })
    expect(byId.get('lex-b2-im-not-convinced')).toMatchObject({
      incorrectContext: 'I’m not convincing that this approach is safer.',
      expectedCorrection: 'I’m not convinced that this approach is safer.',
    })
    expect(byId.get('lex-b2-at-first-sight')).toMatchObject({
      incorrectContext: 'In first sight, the two proposals appear almost identical.',
      expectedCorrection: 'At first sight, the two proposals appear almost identical.',
    })
    expect(byId.get('lex-b2-whether-or-not')).toMatchObject({
      incorrectContext: 'We must decide whether nor not to proceed.',
      expectedCorrection: 'We must decide whether or not to proceed.',
    })
    expect(byId.has('lex-b2-consumer-demand')).toBe(false)
    expect(readyCatalogB2.find((item) => item.id === 'lex-b2-consumer-demand')?.activationReady).toBe(false)
  })

  it('keeps reviewed Step-6 authoring across context edits but invalidates it after a canonical edit', () => {
    const item = readyCatalogB2.find((entry) => entry.id === 'lex-b2-significant')!
    const enrolled = { ...catalogPhrase(item), id: 'personal-card', tags: [`catalog-item:${item.id}`] }
    expect(buildActivationErrorPrompt(enrolled).context).toBe('The policy led to a significance drop in waiting times.')

    expect(buildActivationErrorPrompt({ ...enrolled, context: 'The change was significant for our team.' }).context).toBe('The policy led to a significance drop in waiting times.')
    expect(buildActivationErrorPrompt({ ...enrolled, canonical: 'significance', normalizedKey: 'significance' }).kind).toBe('reconstruction')
  })
})
