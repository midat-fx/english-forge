import type { CatalogLevel, LexicalCatalogItem } from '../domain/lexicalCatalog'
import type { Phrase } from '../domain/types'
import type { AuthoredActivationErrorPair } from '../domain/activationErrorMetadata'
import { includesPhrase, normalizePhrase } from '../domain/normalization'
import { buildActivationErrorPrompt } from '../domain/practice'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

export const lexicalCatalogLevelCounts: Readonly<Record<CatalogLevel, number>> = {
  A2: 800,
  B1: 305,
  B2: 634,
  C1: 425,
}

export const lexicalCatalogTotalCount = Object.values(lexicalCatalogLevelCounts).reduce((sum, count) => sum + count, 0)

function phraseForReadiness(item: LexicalCatalogItem): Phrase {
  const timestamp = '2026-01-01T00:00:00.000Z'
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
    tags: [],
    note: '',
    acceptedForms: catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id),
    examples: [],
    depth: {
      grammarFrame: item.pattern ?? '',
      collocates: [],
      constraints: [],
      contrasts: [],
      connotation: '',
      pronunciationNote: '',
    },
    status: 'new',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(item.activationError ? { activationError: item.activationError } : {}),
  }
}

/**
 * Attaches reviewed authoring and marks only rows with a concrete Step-6 repair
 * as production-ready. Invalid editorial metadata fails the level load loudly.
 */
export function attachActivationReadiness(
  items: readonly LexicalCatalogItem[],
  authoredPairs: readonly AuthoredActivationErrorPair[],
): readonly LexicalCatalogItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const pairById = new Map<string, AuthoredActivationErrorPair>()
  for (const pair of authoredPairs) {
    const item = itemById.get(pair.catalogItemId)
    if (!item) throw new Error(`Step-6 metadata refers to an unknown catalog item: ${pair.catalogItemId}`)
    if (pairById.has(pair.catalogItemId)) throw new Error(`Duplicate Step-6 metadata: ${pair.catalogItemId}`)
    const acceptedForms = catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id)
    if (pair.expectedCorrection !== item.example) throw new Error(`Step-6 correction does not match the authored example: ${pair.catalogItemId}`)
    if (pair.incorrectContext === pair.expectedCorrection) throw new Error(`Step-6 repair does not change the sentence: ${pair.catalogItemId}`)
    if (!includesPhrase(pair.expectedCorrection, item.expression, acceptedForms)) throw new Error(`Step-6 correction omits its target expression: ${pair.catalogItemId}`)
    pairById.set(pair.catalogItemId, pair)
  }

  return items.map((item) => {
    const pair = pairById.get(item.id)
    const activationError = pair ? {
      incorrectContext: pair.incorrectContext,
      expectedCorrection: pair.expectedCorrection,
      cue: pair.cue,
    } : undefined
    const candidate = { ...item, ...(activationError ? { activationError } : {}) }
    const prompt = buildActivationErrorPrompt(phraseForReadiness(candidate))
    const activationReady = Boolean(pair)
      && prompt.kind === 'typical'
      && prompt.context !== prompt.expectedCorrection
      && prompt.expectedCorrection === item.example
      && includesPhrase(prompt.expectedCorrection, item.expression, catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id))
    return { ...candidate, activationReady }
  })
}

async function loadLevelSource(level: CatalogLevel): Promise<readonly LexicalCatalogItem[]> {
  if (level === 'A2') {
    const [catalog, errors] = await Promise.all([import('./lexicalCatalogA2All'), import('./activationErrorsA2')])
    return attachActivationReadiness(catalog.lexicalCatalogA2All, errors.activationErrorsA2)
  }
  if (level === 'B1') {
    const [catalog, errors] = await Promise.all([import('./lexicalCatalogB1All'), import('./activationErrorsB1')])
    return attachActivationReadiness(catalog.lexicalCatalogB1All, errors.activationErrorsB1)
  }
  if (level === 'B2') {
    const [catalog, errors] = await Promise.all([import('./lexicalCatalogB2All'), import('./activationErrorsB2')])
    return attachActivationReadiness(catalog.lexicalCatalogB2All, errors.activationErrorsB2)
  }
  const [catalog, errors] = await Promise.all([import('./lexicalCatalogC1All'), import('./activationErrorsC1')])
  return attachActivationReadiness(catalog.lexicalCatalogC1All, errors.activationErrorsC1)
}

/** Load only the requested CEFR catalog and its reviewed Step-6 metadata. */
export function loadLexicalCatalogLevel(level: CatalogLevel): Promise<readonly LexicalCatalogItem[]> {
  return cachedLevelLoader(level)
}

/** Rejected chunk loads are evicted so an in-app retry can actually recover. */
export function createRetryableCatalogLevelLoader(
  loadSource: (level: CatalogLevel) => Promise<readonly LexicalCatalogItem[]>,
): (level: CatalogLevel) => Promise<readonly LexicalCatalogItem[]> {
  const cache = new Map<CatalogLevel, Promise<readonly LexicalCatalogItem[]>>()
  return (level) => {
    const cached = cache.get(level)
    if (cached) return cached
    let loading: Promise<readonly LexicalCatalogItem[]>
    loading = loadSource(level).catch((error: unknown) => {
      if (cache.get(level) === loading) cache.delete(level)
      throw error
    })
    cache.set(level, loading)
    return loading
  }
}

const loadedCanonicalCatalogs = new Map<CatalogLevel, readonly LexicalCatalogItem[]>()

function freezeCanonicalCatalog(items: readonly LexicalCatalogItem[]): readonly LexicalCatalogItem[] {
  return Object.freeze(items.map((item) => Object.freeze({
    ...item,
    ...(item.activationError ? { activationError: Object.freeze({ ...item.activationError }) } : {}),
  })))
}

const cachedLevelLoader = createRetryableCatalogLevelLoader(async (level) => {
  const items = freezeCanonicalCatalog(await loadLevelSource(level))
  loadedCanonicalCatalogs.set(level, items)
  return items
})

/**
 * Returns only a catalog that completed the trusted lazy loader successfully.
 * Mutations use this registry instead of accepting caller-owned catalog rows.
 */
export function loadedCanonicalCatalogLevel(level: CatalogLevel): readonly LexicalCatalogItem[] | undefined {
  return loadedCanonicalCatalogs.get(level)
}
