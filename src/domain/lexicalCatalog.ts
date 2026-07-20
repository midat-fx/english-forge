import type { ActivationErrorSpec } from './activationErrorMetadata'

/** Marks a bundled reference row saved for learner-authored Step-6 enrichment. */
export const PERSONAL_CATALOG_ENRICHMENT_TAG = 'catalog-personal-enrichment'

export type CatalogLevel = 'A2' | 'B1' | 'B2' | 'C1'

export type CatalogKind =
  | 'word'
  | 'collocation'
  | 'phrasal_verb'
  | 'discourse_marker'
  | 'grammar_frame'
  | 'register_formula'

export type CatalogRegister = 'neutral' | 'informal' | 'formal' | 'spoken' | 'academic'

export interface LexicalCatalogItem {
  id: string
  level: CatalogLevel
  expression: string
  kind: CatalogKind
  translationRu: string
  meaningEn: string
  example: string
  exampleTranslationRu: string
  topic: string
  register: CatalogRegister
  pattern?: string
  note?: string
  /** Present only after the level loader attaches reviewed Step-6 authoring. */
  activationError?: ActivationErrorSpec
  /** Explicit production gate: reference-only rows never enter Daily Ten. */
  activationReady?: boolean
}

export type CatalogRow = readonly [
  slug: string,
  expression: string,
  kind: CatalogKind,
  translationRu: string,
  meaningEn: string,
  example: string,
  exampleTranslationRu: string,
  topic: string,
  register: CatalogRegister,
  pattern?: string,
  note?: string,
]

export function catalogItems(level: CatalogLevel, rows: readonly CatalogRow[]): LexicalCatalogItem[] {
  return rows.map(([slug, expression, kind, translationRu, meaningEn, example, exampleTranslationRu, topic, register, pattern, note]) => ({
    id: `lex-${level.toLowerCase()}-${slug}`,
    level,
    expression,
    kind,
    translationRu,
    meaningEn,
    example,
    exampleTranslationRu,
    topic,
    register,
    ...(pattern ? { pattern } : {}),
    ...(note ? { note } : {}),
  }))
}
