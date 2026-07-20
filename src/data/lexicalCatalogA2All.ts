import { lexicalCatalogA2 } from './lexicalCatalogA2'
import { lexicalCatalogA2Chunks } from './lexicalCatalogA2Chunks'
import { lexicalCatalogA2Collocations } from './lexicalCatalogA2Collocations'
import { lexicalCatalogA2Words } from './lexicalCatalogA2Words'

export const lexicalCatalogA2All = [
  ...lexicalCatalogA2,
  ...lexicalCatalogA2Words,
  ...lexicalCatalogA2Collocations,
  ...lexicalCatalogA2Chunks,
]
