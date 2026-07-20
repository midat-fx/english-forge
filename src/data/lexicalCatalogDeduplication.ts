import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import { phraseFingerprint } from '../domain/normalization'

export function canonicalCatalogExpression(value: string): string {
  return phraseFingerprint(value)
}

/** Keeps source order while removing expressions already taught at a lower level. */
export function uniqueCatalogLevel(
  source: readonly LexicalCatalogItem[],
  lowerLevels: readonly LexicalCatalogItem[],
): LexicalCatalogItem[] {
  return uniqueCatalogLevelAgainstExpressions(source, lowerLevels.map((item) => item.expression))
}

/**
 * Lightweight variant used by level-specific lazy chunks. Keeping only the
 * known lower-level expressions here avoids loading every easier catalog just
 * to filter a harder one at runtime.
 */
export function uniqueCatalogLevelAgainstExpressions(
  source: readonly LexicalCatalogItem[],
  lowerLevelExpressions: readonly string[],
): LexicalCatalogItem[] {
  const seen = new Set(lowerLevelExpressions.map(canonicalCatalogExpression))
  return source.filter((item) => {
    const expression = canonicalCatalogExpression(item.expression)
    if (seen.has(expression)) return false
    seen.add(expression)
    return true
  })
}
