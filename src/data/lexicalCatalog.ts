import type { CatalogLevel } from '../domain/lexicalCatalog'
import { lexicalCatalogA2All as lexicalCatalogA2 } from './lexicalCatalogA2All'
import { lexicalCatalogB1All as lexicalCatalogB1 } from './lexicalCatalogB1All'
import { lexicalCatalogB2All as lexicalCatalogB2 } from './lexicalCatalogB2All'
import { lexicalCatalogC1All as lexicalCatalogC1 } from './lexicalCatalogC1All'

export { lexicalCatalogMethodology, type CatalogMethodologySource } from './lexicalCatalogMethodology'

export const lexicalCatalog = [
  ...lexicalCatalogA2,
  ...lexicalCatalogB1,
  ...lexicalCatalogB2,
  ...lexicalCatalogC1,
]

export const lexicalCatalogByLevel: Record<CatalogLevel, typeof lexicalCatalog> = {
  A2: lexicalCatalogA2,
  B1: lexicalCatalogB1,
  B2: lexicalCatalogB2,
  C1: lexicalCatalogC1,
}

export { lexicalCatalogA2, lexicalCatalogB1, lexicalCatalogB2, lexicalCatalogC1 }
