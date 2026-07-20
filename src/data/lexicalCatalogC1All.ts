import { lexicalCatalogC1 } from './lexicalCatalogC1'
import { lexicalCatalogC1Buffer } from './lexicalCatalogC1Buffer'
import { lexicalCatalogC1Expansion } from './lexicalCatalogC1Expansion'
import { uniqueCatalogLevelAgainstExpressions } from './lexicalCatalogDeduplication'
import { C1_LOWER_LEVEL_EXPRESSIONS } from './lexicalCatalogLevelExclusions'

const c1Source = [...lexicalCatalogC1, ...lexicalCatalogC1Expansion, ...lexicalCatalogC1Buffer]

/** C1 catalog after stable deduplication against every earlier level and itself. */
export const lexicalCatalogC1All = uniqueCatalogLevelAgainstExpressions(c1Source, C1_LOWER_LEVEL_EXPRESSIONS)
