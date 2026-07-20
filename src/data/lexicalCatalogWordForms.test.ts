import { describe, expect, it } from 'vitest'
import { includesPhrase } from '../domain/normalization'
import { loadLexicalCatalogLevel } from './lexicalCatalogLoader'
import {
  REVIEWED_WORD_INVENTORY_COUNT,
  REVIEWED_WORD_INVENTORY_IDS_SHA256,
  catalogWordAllowsBarePlural,
  catalogWordAcceptedPatterns,
  catalogWordFormCoverage,
  catalogWordFormDecision,
} from './lexicalCatalogWordForms'

async function catalogWords() {
  return (await Promise.all((['A2', 'B1', 'B2', 'C1'] as const).map(loadLexicalCatalogLevel)))
    .flat()
    .filter((item) => item.kind === 'word')
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('catalog word morphology metadata', () => {
  it('pins the exact reviewed 660-row word inventory', async () => {
    const items = await catalogWords()
    const digest = await sha256(items.map((item) => item.id).sort().join('\n'))

    expect(items).toHaveLength(REVIEWED_WORD_INVENTORY_COUNT)
    expect(new Set(items.map((item) => item.id))).toHaveLength(REVIEWED_WORD_INVENTORY_COUNT)
    expect(digest).toBe(REVIEWED_WORD_INVENTORY_IDS_SHA256)
  })

  it('classifies every reviewed row explicitly and returns forms only for opted-in IDs', async () => {
    const items = await catalogWords()
    const classified = { countNouns: 0, nonCountNouns: 0, gradableAdjectives: 0, excluded: 0 }

    for (const item of items) {
      const decision = catalogWordFormDecision(item.id)
      const forms = catalogWordAcceptedPatterns(item)
      if (decision === 'count_noun') {
        classified.countNouns += 1
        expect(forms, item.id).toHaveLength(catalogWordAllowsBarePlural(item.id) ? 4 : 3)
        expect(forms.slice(0, 3).every((form) => form.includes('...plural'))).toBe(true)
        expect(forms.slice(3).every((form) => !form.includes('...'))).toBe(true)
      } else if (decision === 'non_count_noun') {
        classified.nonCountNouns += 1
        expect(forms, item.id).toEqual([])
      } else if (decision === 'gradable_adjective') {
        classified.gradableAdjectives += 1
        expect(forms, item.id).toHaveLength(2)
        expect(forms.every((form) => !form.includes('...'))).toBe(true)
      } else {
        classified.excluded += 1
        expect(forms, item.id).toEqual([])
      }
    }

    expect(classified).toEqual({
      countNouns: catalogWordFormCoverage.countNouns,
      nonCountNouns: catalogWordFormCoverage.nonCountNouns,
      gradableAdjectives: catalogWordFormCoverage.gradableAdjectives,
      excluded: catalogWordFormCoverage.excluded,
    })
    expect(catalogWordFormCoverage).toEqual({
      reviewedInventory: 660,
      countNouns: 242,
      contextOnlyCountNouns: 117,
      nonCountNouns: 61,
      gradableAdjectives: 136,
      excluded: 221,
    })
    expect(classified.countNouns + classified.nonCountNouns + classified.gradableAdjectives + classified.excluded).toBe(REVIEWED_WORD_INVENTORY_COUNT)
  })

  it('splits safe bare plurals from context-only noun/verb homographs', () => {
    expect(catalogWordAcceptedPatterns('journey', 'the act of travelling', 'lex-a2-journey')).toEqual([
      '...pluralcountcue journeys', '...pluraldet journeys', '...pluralprep journeys',
    ])
    expect(catalogWordAcceptedPatterns('pharmacy', 'a shop that sells medicines', 'lex-a2-pharmacy')).toContain('...pluralcue pharmacies')
    expect(catalogWordAcceptedPatterns('church', 'a building for worship', 'lex-a2-church')).toContain('...pluralcountcue churches')
    expect(catalogWordAcceptedPatterns('washing machine', 'a machine for washing clothes', 'lex-a2-washing-machine')).toContain('...pluralcue washing machines')
    expect(catalogWordAcceptedPatterns('roof', 'the top covering of a building', 'lex-a2-roof')).toContain('...pluralcountcue roofs')
    expect(catalogWordAcceptedPatterns('shelf', 'a flat board', 'lex-a2-shelf')).toContain('...pluralcountcue shelves')
    expect(catalogWordAcceptedPatterns('criterion', 'a standard', 'lex-b2-criterion')).toContain('...pluralcue criteria')
    expect(catalogWordAcceptedPatterns('emphasis', 'special importance', 'lex-b2-emphasis')).toContain('...pluralcue emphases')
    expect(catalogWordAcceptedPatterns('hypothesis', 'a proposed explanation', 'lex-c1-hypothesis')).toContain('...pluralcue hypotheses')
    expect(catalogWordAcceptedPatterns('map', 'a drawing of roads', 'lex-a2-map')).not.toContain('maps')
    expect(catalogWordAcceptedPatterns('price', 'the amount paid', 'lex-a2-price')).not.toContain('prices')
    expect(catalogWordAcceptedPatterns('shelf', 'a flat board', 'lex-a2-shelf')).not.toContain('shelves')
    expect(catalogWordAcceptedPatterns('stakeholder', 'a person or group affected by a decision', 'lex-c1-stakeholder')).toContain('stakeholders')
    expect(catalogWordAcceptedPatterns('contingency', 'a possible future event', 'lex-c1-contingency')).toContain('contingencies')
    const mapPatterns = catalogWordAcceptedPatterns('map', 'a drawing of roads', 'lex-a2-map')
    expect(includesPhrase('The software maps change to outcomes.', 'map', mapPatterns)).toBe(false)
    expect(includesPhrase('The platform maps work to available teams.', 'map', mapPatterns)).toBe(false)
    expect(includesPhrase('The board shelves plans indefinitely.', 'shelf', catalogWordAcceptedPatterns('shelf', 'a flat board', 'lex-a2-shelf'))).toBe(false)
    expect(includesPhrase('Many think software maps customer journeys.', 'map', mapPatterns)).toBe(false)
    expect(includesPhrase('All breaks eventually.', 'break', catalogWordAcceptedPatterns('break', 'a short rest', 'lex-a2-break'))).toBe(false)
    expect(includesPhrase('Some maps demand to supply.', 'map', mapPatterns)).toBe(false)
    expect(includesPhrase('Several maps were updated.', 'map', mapPatterns)).toBe(true)
  })

  it('uses reviewed synthetic, irregular, and analytic adjective forms', () => {
    expect(catalogWordAcceptedPatterns('fit', 'healthy and physically strong', 'lex-a2-fit')).toEqual(['more fit', 'most fit'])
    expect(catalogWordAcceptedPatterns('ill', 'not in good health', 'lex-a2-ill')).toEqual(['more ill', 'most ill'])
    expect(catalogWordAcceptedPatterns('spicy', 'having a strong hot flavour', 'lex-a2-spicy')).toEqual(['spicier', 'spiciest'])
    expect(catalogWordAcceptedPatterns('brief', 'lasting a short time', 'lex-b2-brief')).toEqual(['briefer', 'briefest'])
    expect(catalogWordAcceptedPatterns('unlikely', 'not likely to happen', 'lex-b1-extra-unlikely')).toEqual(['unlikelier', 'unlikeliest'])
    expect(catalogWordAcceptedPatterns('remote', 'far away', 'lex-b2-remote')).toEqual(['remoter', 'remotest'])
    expect(catalogWordAcceptedPatterns('severe', 'very serious', 'lex-b2-severe')).toEqual(['severer', 'severest'])
    expect(catalogWordAcceptedPatterns('stable', 'not likely to change', 'lex-b2-stable')).toEqual(['stabler', 'stablest'])
    expect(catalogWordAcceptedPatterns('reliable', 'able to be trusted', 'lex-b1-reliable')).toEqual(['more reliable', 'most reliable'])
    expect(catalogWordAcceptedPatterns('common', 'happening often', 'lex-b1-common')).toEqual(['more common', 'most common'])
    expect(catalogWordAcceptedPatterns('ambiguous', 'having more than one meaning', 'lex-c1-ambiguous')).toEqual(['more ambiguous', 'most ambiguous'])
  })

  it('fails closed for mass, plural-only, verbal, relational, non-gradable, unknown, or mismatched rows', async () => {
    const items = await catalogWords()
    const byId = new Map(items.map((item) => [item.id, item]))

    for (const id of [
      'lex-a2-advice',
      'lex-a2-furniture',
      'lex-a2-stairs',
      'lex-a2-change',
      'lex-a2-local',
      'lex-a2-possible',
      'lex-b2-evidence',
      'lex-b2-mutual',
      'lex-c1-mandatory',
      'lex-c1-empirical',
    ]) expect(catalogWordAcceptedPatterns(byId.get(id)!), id).toEqual([])

    expect(catalogWordAcceptedPatterns('maps', 'a drawing of roads', 'lex-a2-map')).toEqual([])
    expect(catalogWordAcceptedPatterns('map', 'a drawing of roads', 'lex-a2-unknown-map')).toEqual([])
    expect(catalogWordAcceptedPatterns({ ...byId.get('lex-a2-map')!, kind: 'collocation' })).toEqual([])
  })
})
