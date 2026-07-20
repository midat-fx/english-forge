import { describe, expect, it } from 'vitest'
import { lexicalCatalog } from './lexicalCatalog'
import { CATALOG_IDENTITY_MIGRATIONS } from './lexicalCatalogIdentityHistory'

describe('catalog identity history', () => {
  it('never rebinds a previously shipped ID to another canonical expression', () => {
    const catalogById = new Map(lexicalCatalog.map((item) => [item.id, item.expression]))

    expect(CATALOG_IDENTITY_MIGRATIONS).toHaveLength(36)
    for (const [retiredId, retiredExpression, replacementId, replacementExpression] of CATALOG_IDENTITY_MIGRATIONS) {
      const currentRetiredBinding = catalogById.get(retiredId)
      if (currentRetiredBinding !== undefined) {
        expect(currentRetiredBinding, retiredId).toBe(retiredExpression)
      }
      expect(replacementId, retiredId).not.toBe(retiredId)
      expect(catalogById.get(replacementId), replacementId).toBe(replacementExpression)
    }
  })

  it('keeps both sides of the identity migration ledger unique', () => {
    const retiredIds = CATALOG_IDENTITY_MIGRATIONS.map(([retiredId]) => retiredId)
    const replacementIds = CATALOG_IDENTITY_MIGRATIONS.map(([, , replacementId]) => replacementId)

    expect(new Set(retiredIds).size).toBe(retiredIds.length)
    expect(new Set(replacementIds).size).toBe(replacementIds.length)
    const replacementIdSet = new Set<string>(replacementIds)
    expect(retiredIds.filter((id) => replacementIdSet.has(id))).toEqual([])
  })
})
