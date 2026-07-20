import { describe, expect, it } from 'vitest'
import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import { normalizePhrase, phraseFingerprint } from '../domain/normalization'
import { buildActivationErrorPrompt } from '../domain/practice'
import type { Phrase } from '../domain/types'
import { activationErrorsB1 } from './activationErrorsB1'
import { activationErrorsB1AuthoredPart1 } from './activationErrorsB1AuthoredPart1'
import { activationErrorsB1AuthoredPart2 } from './activationErrorsB1AuthoredPart2'
import { activationErrorsB1Retained } from './activationErrorsB1Retained'
import { activationErrorsB1Structural } from './activationErrorsB1Structural'
import { lexicalCatalogB1 } from './lexicalCatalogB1'
import { lexicalCatalogB1Additional } from './lexicalCatalogB1Additional'
import { lexicalCatalogB1All } from './lexicalCatalogB1All'
import { lexicalCatalogB1AuthoredPart1 } from './lexicalCatalogB1AuthoredPart1'
import { lexicalCatalogB1AuthoredPart2 } from './lexicalCatalogB1AuthoredPart2'
import { uniqueCatalogLevelAgainstExpressions } from './lexicalCatalogDeduplication'
import { B1_LOWER_LEVEL_EXPRESSIONS } from './lexicalCatalogLevelExclusions'
import { attachActivationReadiness } from './lexicalCatalogLoader'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

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

function lexicalOverlap(left: string, right: string): number {
  const tokens = (value: string) => new Set(normalizePhrase(value).split(' ').filter((token) => token.length > 1))
  const actual = tokens(left)
  const expected = tokens(right)
  return [...actual].filter((token) => expected.has(token)).length / Math.max(1, expected.size)
}

describe('merged B1 activation curriculum', () => {
  const retainedCatalog = uniqueCatalogLevelAgainstExpressions(
    [...lexicalCatalogB1, ...lexicalCatalogB1Additional],
    B1_LOWER_LEVEL_EXPRESSIONS,
  )

  it('covers every retained row with one explicit editorial pair', () => {
    const retainedIds = retainedCatalog.map((item) => item.id)
    const retainedPairIds = [
      ...activationErrorsB1Retained,
      ...activationErrorsB1Structural,
    ].map((pair) => pair.catalogItemId)

    expect(activationErrorsB1Retained).toHaveLength(112)
    expect(activationErrorsB1Structural).toHaveLength(33)
    expect(retainedPairIds).toHaveLength(retainedIds.length)
    expect(new Set(retainedPairIds)).toEqual(new Set(retainedIds))
  })

  it('covers every new static row exactly once and no unrelated row', () => {
    const newIds = [
      ...lexicalCatalogB1AuthoredPart1,
      ...lexicalCatalogB1AuthoredPart2,
    ].map((item) => item.id)
    const newPairIds = [
      ...activationErrorsB1AuthoredPart1,
      ...activationErrorsB1AuthoredPart2,
    ].map((pair) => pair.catalogItemId)

    expect(lexicalCatalogB1AuthoredPart1).toHaveLength(80)
    expect(lexicalCatalogB1AuthoredPart2).toHaveLength(80)
    expect(new Set(newPairIds)).toEqual(new Set(newIds))
    expect(newPairIds).toHaveLength(160)
  })

  it('binds all 305 editorial pairs to exact examples with unique prompts', () => {
    const itemById = new Map(lexicalCatalogB1All.map((item) => [item.id, item]))
    expect(activationErrorsB1).toHaveLength(305)
    expect(new Set(activationErrorsB1.map((pair) => pair.catalogItemId))).toEqual(new Set(itemById.keys()))
    expect(new Set(activationErrorsB1.map((pair) => pair.incorrectContext)).size).toBe(305)
    expect(new Set(activationErrorsB1.map((pair) => pair.cue.trim())).size).toBe(305)

    for (const pair of activationErrorsB1) {
      const item = itemById.get(pair.catalogItemId)
      expect(item, pair.catalogItemId).toBeDefined()
      expect(pair.expectedCorrection, pair.catalogItemId).toBe(item?.example)
      expect(pair.incorrectContext, pair.catalogItemId).not.toBe(pair.expectedCorrection)
      expect(pair.cue.trim(), pair.catalogItemId).not.toBe('')
      expect(lexicalOverlap(pair.incorrectContext, pair.expectedCorrection), pair.catalogItemId).toBeGreaterThanOrEqual(0.6)
    }
  })

  it('ships exactly 305 activation-ready B1 items with a multiword majority', () => {
    const loaded = attachActivationReadiness(lexicalCatalogB1All, activationErrorsB1)
    const ready = loaded.filter((item) => item.activationReady)
    const multiword = ready.filter((item) => phraseFingerprint(item.expression).split(' ').length >= 2)

    expect(lexicalCatalogB1All).toHaveLength(305)
    expect(ready).toHaveLength(305)
    expect(multiword.length / ready.length).toBeGreaterThanOrEqual(0.5)
    expect(ready.every((item) => item.activationError !== undefined)).toBe(true)
    for (const item of ready) {
      const prompt = buildActivationErrorPrompt(catalogPhrase(item))
      expect(prompt.kind, item.id).toBe('typical')
      expect(prompt.context, item.id).toBe(item.activationError?.incorrectContext)
      expect(prompt.expectedCorrection, item.id).toBe(item.example)
    }
  })

  it('keeps representative repairs exact across error classes', () => {
    const byId = new Map(activationErrorsB1.map((pair) => [pair.catalogItemId, pair]))
    expect(byId.get('lex-b1-raise-money')).toMatchObject({
      incorrectContext: 'The school rose money for new sports equipment.',
      expectedCorrection: 'The school raised money for new sports equipment.',
    })
    expect(byId.get('lex-b1-recommend')).toMatchObject({
      incorrectContext: 'I recommend to visit the market early in the morning.',
      expectedCorrection: 'I recommend visiting the market early in the morning.',
    })
    expect(byId.get('lex-b1-extra-depend')).toMatchObject({
      incorrectContext: 'The final price will depend from the type of room.',
      expectedCorrection: 'The final price will depend on the type of room.',
    })
    expect(byId.get('lex-b1-auth-work-on')).toMatchObject({
      incorrectContext: 'I am work on a clearer introduction for my presentation.',
      expectedCorrection: 'I am working on a clearer introduction for my presentation.',
    })
    expect(byId.get('lex-b1-auth-be-certain-to')).toMatchObject({
      incorrectContext: 'The earlier train is certain for be crowded on Monday morning.',
      expectedCorrection: 'The earlier train is certain to be crowded on Monday morning.',
    })
    expect(byId.get('lex-b1-auth2-cause-damage')).toMatchObject({
      incorrectContext: 'Moving heavy furniture carelessly can make damage to a wooden floor.',
      expectedCorrection: 'Moving heavy furniture carelessly can cause damage to a wooden floor.',
    })
    expect(byId.get('lex-b1-set-up')).toMatchObject({
      incorrectContext: 'Local parents setted up a reading club for younger children.',
      expectedCorrection: 'Local parents set up a reading club for younger children.',
    })
    expect(byId.get('lex-b1-look-forward')).toMatchObject({
      incorrectContext: 'I look forward to hear about your new job.',
      expectedCorrection: 'I look forward to hearing about your new job.',
    })
  })
})
