import { describe, expect, it } from 'vitest'
import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import { includesPhrase, phraseFingerprint } from '../domain/normalization'
import { lexicalCatalogA2All } from './lexicalCatalogA2All'
import { lexicalCatalogB1All } from './lexicalCatalogB1All'
import { lexicalCatalogB2All } from './lexicalCatalogB2All'
import {
  B1_LOWER_LEVEL_EXPRESSIONS,
  B2_LOWER_LEVEL_EXPRESSIONS,
  C1_LOWER_LEVEL_EXPRESSIONS,
} from './lexicalCatalogLevelExclusions'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

function missingLowerLevelTargets(
  exclusions: readonly string[],
  lowerLevelItems: readonly LexicalCatalogItem[],
  semanticAliases: Readonly<Record<string, string>> = {},
): string[] {
  const lowerFingerprints = new Set(lowerLevelItems.map((item) => phraseFingerprint(item.expression)))
  return exclusions.filter((expression) => {
    const lowerExpression = semanticAliases[expression] ?? expression
    return !lowerFingerprints.has(phraseFingerprint(lowerExpression))
  })
}

describe('cross-level exclusion closure', () => {
  it('excludes a B1 row only when the target already exists at A2', () => {
    const semanticAliases = {
      // The A2 card teaches the same complementation in its authored example.
      'pay attention to': 'pay attention',
    } as const

    expect(Object.keys(semanticAliases)).toEqual(['pay attention to'])
    const payAttention = lexicalCatalogA2All.find((item) => phraseFingerprint(item.expression) === 'pay attention')
    expect(payAttention).toBeDefined()
    expect(includesPhrase(
      payAttention!.example,
      'pay attention to',
      catalogAcceptedForms('pay attention to'),
    )).toBe(true)
    expect(missingLowerLevelTargets(B1_LOWER_LEVEL_EXPRESSIONS, lexicalCatalogA2All, semanticAliases)).toEqual([])
  })

  it('keeps every B2 exclusion as an exact A2/B1 target', () => {
    expect(missingLowerLevelTargets(
      B2_LOWER_LEVEL_EXPRESSIONS,
      [...lexicalCatalogA2All, ...lexicalCatalogB1All],
    )).toEqual([])
  })

  it('keeps every C1 exclusion as an exact lower-level target', () => {
    expect(missingLowerLevelTargets(
      C1_LOWER_LEVEL_EXPRESSIONS,
      [...lexicalCatalogA2All, ...lexicalCatalogB1All, ...lexicalCatalogB2All],
    )).toEqual([])
  })
})
