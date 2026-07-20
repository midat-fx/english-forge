import { lexicalCatalogB2 } from './lexicalCatalogB2'
import { lexicalCatalogB2ExpansionPart1 } from './lexicalCatalogB2ExpansionPart1'
import { lexicalCatalogB2ExpansionPart2 } from './lexicalCatalogB2ExpansionPart2'
import { uniqueCatalogLevelAgainstExpressions } from './lexicalCatalogDeduplication'
import { B2_LOWER_LEVEL_EXPRESSIONS } from './lexicalCatalogLevelExclusions'

const b2Source = [
  ...lexicalCatalogB2,
  ...lexicalCatalogB2ExpansionPart1,
  ...lexicalCatalogB2ExpansionPart2,
]

/** B2 catalog after stable deduplication against A2, B1, and itself. */
export const lexicalCatalogB2All = uniqueCatalogLevelAgainstExpressions(b2Source, B2_LOWER_LEVEL_EXPRESSIONS)
