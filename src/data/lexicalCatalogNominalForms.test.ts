import { describe, expect, it } from 'vitest'
import { includesPhrase } from '../domain/normalization'
import { loadLexicalCatalogLevel } from './lexicalCatalogLoader'
import {
  catalogNominalCollocationPatterns,
  catalogNominalCollocationPolicy,
  catalogNominalFormCoverage,
  reviewedNominalCollocationCount,
} from './lexicalCatalogNominalForms'

async function collocations() {
  return (await Promise.all((['A2', 'B1', 'B2', 'C1'] as const).map(loadLexicalCatalogLevel)))
    .flat()
    .filter((item) => item.kind === 'collocation')
}

describe('reviewed nominal-collocation plurals', () => {
  it('binds and partitions all 155 reviewed entries without overlap', async () => {
    const items = await collocations()
    const reviewed = items.filter((item) => catalogNominalCollocationPolicy(item.id) !== 'none')
    const classified = { bareSafe: 0, cueOnly: 0, determinerOnly: 0, unsupportedAmbiguous: 0 }

    expect(reviewedNominalCollocationCount).toBe(155)
    expect(reviewed).toHaveLength(reviewedNominalCollocationCount)
    for (const item of reviewed) {
      const policy = catalogNominalCollocationPolicy(item.id)
      const forms = catalogNominalCollocationPatterns(item)
      expect(forms.some((form) => form.includes('...pluralverb')), item.id).toBe(false)
      if (policy === 'bare_safe') {
        classified.bareSafe += 1
        expect(forms, item.id).toHaveLength(4)
        expect(forms.slice(0, 3).every((form) => form.includes('...plural'))).toBe(true)
        expect(forms[3], item.id).not.toContain('...')
      } else if (policy === 'cue_only') {
        classified.cueOnly += 1
        expect(forms, item.id).toHaveLength(1)
        expect(forms[0], item.id).toContain('...pluralcountcue')
      } else if (policy === 'determiner_only') {
        classified.determinerOnly += 1
        expect(forms, item.id).toHaveLength(1)
        expect(forms[0], item.id).toContain('...pluraldet')
      } else if (policy === 'unsupported_ambiguous') {
        classified.unsupportedAmbiguous += 1
        expect(forms, item.id).toEqual([])
      }
    }

    expect(catalogNominalFormCoverage).toEqual({
      reviewed: 155,
      bareSafe: 77,
      cueOnly: 27,
      determinerOnly: 38,
      unsupportedAmbiguous: 13,
    })
    expect(classified).toEqual({
      bareSafe: catalogNominalFormCoverage.bareSafe,
      cueOnly: catalogNominalFormCoverage.cueOnly,
      determinerOnly: catalogNominalFormCoverage.determinerOnly,
      unsupportedAmbiguous: catalogNominalFormCoverage.unsupportedAmbiguous,
    })
  })

  it('uses authored head and spelling changes instead of a last-token heuristic', () => {
    expect(catalogNominalCollocationPatterns('a table for two', 'a restaurant table', 'lex-a2-table-two')).toContain('...pluraldet tables for two')
    expect(catalogNominalCollocationPatterns('a growing body of evidence', 'an increasing collection', 'lex-b2-a-growing-body-of-evidence')).toContain('...pluraldet growing bodies of evidence')
    expect(catalogNominalCollocationPatterns('line of reasoning', 'a connected sequence', 'lex-c1-line-of-reasoning')).toContain('...pluralcue lines of reasoning')
    expect(catalogNominalCollocationPatterns('a broad range of', 'a large variety', 'lex-c1-broad-range')).toContain('...pluralcue broad ranges of')
    expect(catalogNominalCollocationPatterns('theoretical basis', 'the theory supporting a method', 'lex-c1-theoretical-basis')).toContain('...pluralcue theoretical bases')
    expect(catalogNominalCollocationPatterns('an ethical dilemma', 'a difficult moral choice', 'lex-c1-ethical-dilemma')).toContain('...pluralcue ethical dilemmas')
    expect(catalogNominalCollocationPatterns("today's special", 'a dish offered today', 'lex-a2-todays-special')).toContain('...pluralcue today’s specials')
  })

  it('uses the narrowest context which rules out each reviewed boundary parse', () => {
    const attentionPatterns = catalogNominalCollocationPatterns('attention span', undefined, 'lex-b2-attention-span')
    expect(attentionPatterns).toEqual(['...pluralcountcue attention spans'])
    expect(includesPhrase('Her attention spans work and family.', 'attention span', attentionPatterns)).toBe(false)
    expect(includesPhrase('All attention spans both tasks.', 'attention span', attentionPatterns)).toBe(false)
    expect(includesPhrase('Several attention spans were measured.', 'attention span', attentionPatterns)).toBe(true)

    const busStopPatterns = catalogNominalCollocationPatterns('bus stop', undefined, 'lex-a2-bus-stop')
    expect(includesPhrase('Any bus stops here.', 'bus stop', busStopPatterns)).toBe(false)
    expect(includesPhrase('These bus stops need shelters.', 'bus stop', busStopPatterns)).toBe(true)

    const bankAccountPatterns = catalogNominalCollocationPatterns('bank account', undefined, 'lex-a2-bank-account')
    expect(includesPhrase('Some bank accounts for the discrepancy.', 'bank account', bankAccountPatterns)).toBe(false)
    const specialOfferPatterns = catalogNominalCollocationPatterns('special offer', undefined, 'lex-a2-special-offer')
    expect(includesPhrase('Some special offers soup at lunchtime.', 'special offer', specialOfferPatterns)).toBe(false)

    const packedLunchPatterns = catalogNominalCollocationPatterns('packed lunch', undefined, 'lex-a2-packed-lunch')
    expect(packedLunchPatterns).toEqual(['...pluraldet packed lunches'])
    expect(includesPhrase('Many packed lunches.', 'packed lunch', packedLunchPatterns)).toBe(false)
    expect(includesPhrase('Their packed lunches were cold.', 'packed lunch', packedLunchPatterns)).toBe(true)

    const returnTicketPatterns = catalogNominalCollocationPatterns('return ticket', undefined, 'lex-a2-return-ticket')
    expect(returnTicketPatterns).toEqual(['...pluraldet return tickets'])
    expect(includesPhrase('They agreed to return tickets.', 'return ticket', returnTicketPatterns)).toBe(false)

    const tablePatterns = catalogNominalCollocationPatterns('a table for two', undefined, 'lex-a2-table-two')
    expect(tablePatterns).toEqual(['...pluraldet tables for two'])
    expect(includesPhrase('The committee tables for two weeks every controversial motion.', 'a table for two', tablePatterns)).toBe(false)
    expect(includesPhrase('The tables for two are already reserved.', 'a table for two', tablePatterns)).toBe(true)

    const jobInterviewPatterns = catalogNominalCollocationPatterns('job interview', undefined, 'lex-a2-job-interview')
    expect(jobInterviewPatterns).toEqual(['...pluralcountcue job interviews'])
    expect(includesPhrase('The automated job interviews candidates remotely.', 'job interview', jobInterviewPatterns)).toBe(false)
    expect(includesPhrase('Several job interviews were arranged.', 'job interview', jobInterviewPatterns)).toBe(true)

    const schoolSubjectPatterns = catalogNominalCollocationPatterns('school subject', undefined, 'lex-a2-school-subject')
    expect(schoolSubjectPatterns).toEqual([])
    expect(includesPhrase('Their school subjects pupils to frequent tests.', 'school subject', schoolSubjectPatterns)).toBe(false)
    expect(includesPhrase('Many teachers school subjects in controlled settings.', 'school subject', schoolSubjectPatterns)).toBe(false)

    const supplyChainPatterns = catalogNominalCollocationPatterns('supply chain', undefined, 'lex-b2-supply-chain')
    expect(supplyChainPatterns).toEqual([])
    expect(includesPhrase('The supply chains the economy to volatile markets.', 'supply chain', supplyChainPatterns)).toBe(false)
    expect(includesPhrase('Many factories supply chains across Europe.', 'supply chain', supplyChainPatterns)).toBe(false)

    const strictCueBoundaryCases = [
      ['living room', 'lex-a2-living-room', 'living rooms', 'Assisted living rooms residents in pairs.', 'Several living rooms were renovated.'],
      ['deep regret', 'lex-b2-deep-regret', 'deep regrets', 'The deep regrets nothing.', 'Several deep regrets were mentioned.'],
      ['a delicate balance', 'lex-c1-delicate-balance', 'delicate balances', 'The delicate balances on one foot.', 'Several delicate balances must be maintained.'],
      ['urgent need', 'lex-b2-urgent-need', 'urgent needs', 'The urgent needs to be distinguished from the important.', 'Several urgent needs were identified.'],
      ['genuine concern', 'lex-b2-genuine-concern', 'genuine concerns', 'The genuine concerns me more than the imitation.', 'Several genuine concerns were raised.'],
      ['a genuine concern', 'lex-c1-genuine-concern', 'genuine concerns', 'The genuine concerns me more than the imitation.', 'Several genuine concerns were raised.'],
    ] as const
    for (const [expression, itemId, plural, wrongReading, pluralReading] of strictCueBoundaryCases) {
      const patterns = catalogNominalCollocationPatterns(expression, undefined, itemId)
      expect(patterns, itemId).toEqual([`...pluralcountcue ${plural}`])
      expect(includesPhrase(wrongReading, expression, patterns), itemId).toBe(false)
      expect(includesPhrase(pluralReading, expression, patterns), itemId).toBe(true)
    }

    const sampleSizePatterns = catalogNominalCollocationPatterns('sample size', undefined, 'lex-b2-sample-size')
    expect(sampleSizePatterns).toEqual([])
    expect(includesPhrase('The sample sizes each image.', 'sample size', sampleSizePatterns)).toBe(false)
    expect(includesPhrase('Many researchers sample sizes from the distribution.', 'sample size', sampleSizePatterns)).toBe(false)

    const marketSharePatterns = catalogNominalCollocationPatterns('market share', undefined, 'lex-b2-market-share')
    expect(marketSharePatterns).toEqual([])
    expect(includesPhrase('The market shares its gains.', 'market share', marketSharePatterns)).toBe(false)
    expect(includesPhrase('Many brokers market shares to clients.', 'market share', marketSharePatterns)).toBe(false)

    const safePatterns = catalogNominalCollocationPatterns('daily routine', undefined, 'lex-a2-daily-routine')
    expect(safePatterns).toEqual([
      '...pluralcue daily routines',
      '...pluraldet daily routines',
      '...pluralprep daily routines',
      'daily routines',
    ])
    expect(includesPhrase('Daily routines improve sleep.', 'daily routine', safePatterns)).toBe(true)
  })

  it('fails closed for mass phrases, unknown IDs, expression mismatches, and non-collocations', async () => {
    const items = await collocations()
    const byId = new Map(items.map((item) => [item.id, item]))
    for (const id of [
      'lex-b2-economic-growth',
      'lex-b2-population-growth',
      'lex-b2-mutual-respect',
      'lex-b2-social-isolation',
      'lex-b2-considerable-uncertainty',
      'lex-b2-limited-scope',
      'lex-c1-mounting-evidence',
      'lex-c1-mutual-understanding',
    ]) expect(catalogNominalCollocationPatterns(byId.get(id)!), id).toEqual([])

    expect(catalogNominalCollocationPatterns('quiet neighbourhood', undefined, 'lex-a2-unknown')).toEqual([])
    expect(catalogNominalCollocationPatterns('noisy neighbourhood', undefined, 'lex-a2-quiet-neighbourhood')).toEqual([])
    expect(catalogNominalCollocationPatterns({ ...byId.get('lex-a2-quiet-neighbourhood')!, kind: 'word' })).toEqual([])
  })
})
