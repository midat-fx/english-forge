import { lexicalCatalogB1 } from './lexicalCatalogB1'
import { lexicalCatalogB1Additional } from './lexicalCatalogB1Additional'
import { lexicalCatalogB1AuthoredPart1 } from './lexicalCatalogB1AuthoredPart1'
import { lexicalCatalogB1AuthoredPart2 } from './lexicalCatalogB1AuthoredPart2'
import { uniqueCatalogLevelAgainstExpressions } from './lexicalCatalogDeduplication'
import { B1_LOWER_LEVEL_EXPRESSIONS } from './lexicalCatalogLevelExclusions'

/**
 * Only explicitly authored rows are eligible for the production B1 catalog.
 *
 * The former bulk expansion was assembled from verb/tail combinations and
 * sentence-frame generators. It is deliberately excluded: a large generated
 * count is not a substitute for independently written learning contexts.
 */
const b1Source = [
  ...lexicalCatalogB1,
  ...lexicalCatalogB1Additional,
  ...lexicalCatalogB1AuthoredPart1,
  ...lexicalCatalogB1AuthoredPart2,
]

/** B1 catalog after stable, cross-level canonical deduplication against A2. */
export const lexicalCatalogB1All = uniqueCatalogLevelAgainstExpressions(b1Source, B1_LOWER_LEVEL_EXPRESSIONS)
