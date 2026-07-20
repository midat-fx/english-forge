import { lexicalCatalogC1ExpansionAcademic } from './lexicalCatalogC1ExpansionAcademic'
import { lexicalCatalogC1ExpansionArgument } from './lexicalCatalogC1ExpansionArgument'
import { lexicalCatalogC1ExpansionProfessional } from './lexicalCatalogC1ExpansionProfessional'
import { lexicalCatalogC1ExpansionSociety } from './lexicalCatalogC1ExpansionSociety'

export const lexicalCatalogC1Expansion = [
  ...lexicalCatalogC1ExpansionAcademic,
  ...lexicalCatalogC1ExpansionProfessional,
  ...lexicalCatalogC1ExpansionArgument,
  ...lexicalCatalogC1ExpansionSociety,
]
