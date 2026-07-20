import { describe, expect, it } from 'vitest'
import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import { DAILY_NEW_ITEM_COUNT, DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT } from '../domain/dailyVocabulary'
import { includesPhrase } from '../domain/normalization'
import { responseMatchesPractice } from '../domain/practice'
import { createSeedData } from './seed'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'
import { attachActivationReadiness, createRetryableCatalogLevelLoader, lexicalCatalogLevelCounts, lexicalCatalogTotalCount, loadLexicalCatalogLevel, loadedCanonicalCatalogLevel } from './lexicalCatalogLoader'

describe('level-specific lexical catalog loading', () => {
  it('keeps published counts aligned with each lazy level module', async () => {
    for (const level of ['A2', 'B1', 'B2', 'C1'] as const) {
      const items = await loadLexicalCatalogLevel(level)
      expect(items).toHaveLength(lexicalCatalogLevelCounts[level])
      expect(items.every((item) => item.level === level)).toBe(true)
      expect(await loadLexicalCatalogLevel(level)).toBe(items)
      expect(loadedCanonicalCatalogLevel(level)).toBe(items)
      expect(Object.isFrozen(items)).toBe(true)
      expect(items.every((item) => Object.isFrozen(item))).toBe(true)
    }
    expect(lexicalCatalogTotalCount).toBe(2_164)
    expect(DAILY_VOCABULARY_ASSIGNMENT_HISTORY_LIMIT).toBeGreaterThanOrEqual(
      Object.keys(lexicalCatalogLevelCounts).length
        * Math.ceil(Math.max(...Object.values(lexicalCatalogLevelCounts)) / DAILY_NEW_ITEM_COUNT),
    )
  })

  it('marks every loaded row explicitly and preserves the reviewed readiness gates', async () => {
    const expectedReadyCounts = { A2: 160, B1: 305, B2: 282, C1: 265 }
    let totalReady = 0
    for (const level of ['A2', 'B1', 'B2', 'C1'] as const) {
      const items = await loadLexicalCatalogLevel(level)
      expect(items.every((item) => typeof item.activationReady === 'boolean')).toBe(true)
      const ready = items.filter((item) => item.activationReady)
      console.info(`[activation-ready] ${level}: ${ready.length}/${items.length}; editorial=${items.filter((item) => item.activationError).length}`)
      expect(ready).toHaveLength(expectedReadyCounts[level])
      expect(ready.every((item) => item.activationError !== undefined)).toBe(true)
      totalReady += ready.length
    }
    expect(totalReady).toBe(1_012)
    expect(lexicalCatalogTotalCount - totalReady).toBe(1_152)
  })

  it('fails closed for reference rows and rejects broken editorial metadata', () => {
    const reference: LexicalCatalogItem = {
      id: 'lex-b1-reference', level: 'B1', expression: 'fathom', kind: 'word', translationRu: 'понимать',
      meaningEn: 'understand something difficult', example: 'I cannot fathom his decision.',
      exampleTranslationRu: 'Я не могу понять его решение.', topic: 'thinking', register: 'neutral',
    }
    expect(attachActivationReadiness([reference], [])[0]).toMatchObject({ activationReady: false })
    expect(() => attachActivationReadiness([reference], [{
      catalogItemId: reference.id,
      incorrectContext: 'I cannot fathom with his decision.',
      expectedCorrection: 'A different sentence.',
      cue: 'Исправьте управление.',
    }])).toThrow(/does not match/)
    expect(() => attachActivationReadiness([reference], [{
      catalogItemId: 'missing-id',
      incorrectContext: 'A wrong sentence.',
      expectedCorrection: 'A correct sentence.',
      cue: 'Исправьте предложение.',
    }])).toThrow(/unknown catalog item/)
  })

  it('evicts a rejected lazy load so the next retry can recover', async () => {
    let attempts = 0
    const load = createRetryableCatalogLevelLoader(async () => {
      attempts += 1
      if (attempts === 1) throw new Error('transient chunk failure')
      return []
    })

    await expect(load('A2')).rejects.toThrow('transient chunk failure')
    await expect(load('A2')).resolves.toEqual([])
    await expect(load('A2')).resolves.toEqual([])
    expect(attempts).toBe(2)
  })

  it('accepts genuine phrasal-verb inflections without manufacturing misspellings or formula aliases', async () => {
    const examples = [
      ['A2', 'lex-a2-sit-down', 'We sat down after lunch.'],
      ['B2', 'lex-b2-account-for', 'Online orders accounted for half of sales.'],
      ['C1', 'lex-c1-comply-with', 'All suppliers complied with the rule.'],
    ] as const
    for (const [level, id, response] of examples) {
      const item = (await loadLexicalCatalogLevel(level)).find((entry) => entry.id === id)!
      expect(includesPhrase(response, item.expression, catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id)), id).toBe(true)
    }

    expect(catalogAcceptedForms('map out', 'phrasal_verb')).toEqual(expect.arrayContaining(['mapped out', 'mapping out']))
    expect(catalogAcceptedForms('map out', 'phrasal_verb')).not.toEqual(expect.arrayContaining(['maped out', 'maping out']))
    expect(catalogAcceptedForms('prefer ... to ...', 'grammar_frame')).toEqual(expect.arrayContaining(['preferred ... to ...', 'preferring ... to ...']))
    expect(catalogAcceptedForms('uphold a standard', 'collocation', 'maintain and defend an accepted standard')).toEqual(expect.arrayContaining(['upheld a standard']))
    expect(catalogAcceptedForms('confer status', 'collocation', 'formally give a particular status')).toEqual(expect.arrayContaining(['conferred status']))
    expect(catalogAcceptedForms("don't have to", 'grammar_frame')).not.toEqual(expect.arrayContaining(['done not have to', 'doing not have to']))
    expect(includesPhrase("She doesn't have to wait outside.", "don't have to", catalogAcceptedForms("don't have to", 'grammar_frame'))).toBe(true)
    expect(includesPhrase("They didn't have to pay again.", "don't have to", catalogAcceptedForms("don't have to", 'grammar_frame'))).toBe(true)
    expect(includesPhrase("Didn't she use to work here?", 'used to', catalogAcceptedForms('used to', 'grammar_frame'))).toBe(true)
    expect(catalogAcceptedForms("Let's ...", 'register_formula')).not.toEqual(expect.arrayContaining(['lets us ...', 'letting us ...']))
    expect(catalogAcceptedForms('hand luggage', 'collocation', 'small bags carried onto a plane')).not.toEqual(expect.arrayContaining(['hands luggage', 'handing luggage']))
    expect(catalogAcceptedForms('live music', 'collocation', 'music performed in front of an audience')).not.toEqual(expect.arrayContaining(['lives music']))
    expect(catalogAcceptedForms('help yourself', 'register_formula', 'used to invite someone to take something')).toEqual([])
    expect(catalogAcceptedForms('have I got that right?', 'register_formula', 'used to check understanding')).toEqual([])
    expect(catalogAcceptedForms('change', 'word', 'money returned after payment', 'lex-a2-change')).toEqual([])
    expect(catalogAcceptedForms('map', 'word', 'a drawing showing roads and places', 'lex-a2-map')).toEqual(expect.arrayContaining(['...pluralcountcue maps', '...pluraldet maps']))
    expect(catalogAcceptedForms('break', 'word', 'a short rest', 'lex-a2-break')).toEqual(expect.arrayContaining(['...pluralcountcue breaks', '...pluraldet breaks']))
    expect(catalogAcceptedForms('wind', 'word', 'moving air', 'lex-a2-wind')).toEqual(expect.arrayContaining(['...pluralcountcue winds', '...pluraldet winds']))
    expect(catalogAcceptedForms('wind', 'word', 'moving air', 'lex-a2-wind')).not.toContain('winds')
    expect(catalogAcceptedForms('full-time job', 'collocation', 'work for standard weekly hours', 'lex-a2-full-time-job')).toEqual(expect.arrayContaining(['...pluralcue full-time jobs', 'full-time jobs']))
    expect(catalogAcceptedForms('part-time job', 'collocation', 'work for fewer weekly hours', 'lex-a2-part-time-job')).toEqual(expect.arrayContaining(['...pluralcue part-time jobs', 'part-time jobs']))
    expect(catalogAcceptedForms('medical help', 'collocation', 'help from a health professional', 'lex-a2-medical-help')).toEqual([])
    expect(catalogAcceptedForms('Do you have ...?', 'grammar_frame', 'a question about availability', 'lex-a2-do-you-have')).toEqual([])
    expect(catalogAcceptedForms('Do you mean ...?', 'grammar_frame', 'used to check an interpretation', 'lex-a2-do-you-mean')).toEqual([])
    expect(catalogAcceptedForms('be going to', 'grammar_frame', 'used for a plan', 'lex-a2-going-to')).not.toEqual(expect.arrayContaining(['been going to', 'being going to']))
    expect(catalogAcceptedForms('be likely to', 'grammar_frame')).toEqual(expect.arrayContaining(['been likely to', 'is not likely to']))
    expect(catalogAcceptedForms('want to', 'grammar_frame')).toEqual(expect.arrayContaining(['wanted to', 'wanting to']))
    expect(catalogAcceptedForms('forget to', 'grammar_frame')).toEqual(expect.arrayContaining(['forgot to', 'forgotten to']))
    expect(catalogAcceptedForms('appear to', 'grammar_frame')).toEqual(expect.arrayContaining(['appeared to', 'appearing to']))
    expect(catalogAcceptedForms('mean doing', 'grammar_frame')).toEqual(expect.arrayContaining(['meant doing']))

    const catalogs = (await Promise.all((['A2', 'B1', 'B2', 'C1'] as const).map(loadLexicalCatalogLevel))).flat()
    const impossible = /\b(?:eated|layed|loged|steped|winded|hurted|fulfiled|fulfiling|feedded|feedding|boilled|boilling|cleanned|cleanning|dealled|dealling|feeled|feelling|hearred|hearring|keepped|keepping|speakked|speakking|maped|maping|prefered|prefering|confered|confering|planed|planing|stoped|stoping|full-times|full-timed|part-times|part-timed|medicals|medicaled)\b/u
    expect(catalogs.flatMap((item) => catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id).filter((form) => impossible.test(form)))).toEqual([])
  })

  it('matches real learner inflections and rejects invented or wrong-sense forms in productive practice', async () => {
    const catalogs = (await Promise.all((['A2', 'B1', 'B2', 'C1'] as const).map(loadLexicalCatalogLevel))).flat()
    const seed = createSeedData().phrases[0]
    const phrase = (id: string) => {
      const item = catalogs.find((entry) => entry.id === id)!
      if (!item) throw new Error(`Missing catalog item in matcher test: ${id}`)
      return {
        ...seed,
        id,
        canonical: item.expression,
        context: item.example,
        acceptedForms: catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id),
      }
    }
    const genuine = [
      ['lex-a2-lie-down', 'She lay down after lunch.'],
      ['lex-a2-eat-out', 'We ate out after the concert.'],
      ['lex-a2-agree', 'We agreed on the final date yesterday.'],
      ['lex-a2-walk-dog', 'She walked the dog before breakfast.'],
      ['lex-a2-take-part', 'She took part in the discussion.'],
      ['lex-a2-brush-teeth', 'She brushed her teeth before bed.'],
      ['lex-a2-cancel-booking', 'She cancelled a booking yesterday.'],
      ['lex-a2-answer-door', 'Someone answered the door immediately.'],
      ['lex-a2-ring-doorbell', 'She rang the doorbell twice.'],
      ['lex-a2-share-flat', 'They shared a flat last year.'],
      ['lex-a2-study-exam', 'She studied for an exam yesterday.'],
      ['lex-a2-fail-exam', 'She failed an exam yesterday.'],
      ['lex-a2-charge-phone', 'She charged her phone before work.'],
      ['lex-a2-hurt-back', 'She hurt her back during training.'],
      ['lex-a2-show-around', 'She showed the new students around after lunch.'],
      ['lex-a2-write-down', 'She wrote the address down before leaving.'],
      ['lex-a2-finish-ing', 'He finished reading the report before lunch.'],
      ['lex-a2-stop-ing', 'They stopped arguing about the issue yesterday.'],
      ['lex-a2-start-ing', 'She started working here last September.'],
      ['lex-a2-learn-by-heart', 'She learnt the poem by heart at school.'],
      ['lex-a2-start-ing', 'She started to work here last September.'],
      ['lex-a2-practise-speaking', 'They practiced speaking before the interview.'],
      ['lex-b1-auth-log-in', 'She logged in before the meeting.'],
      ['lex-b1-auth-step-in', 'A mediator stepped in to help.'],
      ['lex-b1-auth-develop-skill', 'She developed a useful skill during the course.'],
      ['lex-b1-auth2-attend-course', 'She attended a course last year.'],
      ['lex-b1-auth2-set-example', 'They supported a team throughout the season.'],
      ['lex-b1-auth-be-good-enough-to', 'She imagined working abroad during her career.'],
      ['lex-b1-auth-be-prepared-to', 'The hosts made everyone feel welcome at dinner.'],
      ['lex-b1-auth2-fail-to', 'The delay kept us waiting outside for an hour.'],
      ['lex-b1-auth2-allow-someone', 'The guard allowed her to enter after checking.'],
      ['lex-b1-auth2-familiar-with', 'The barrier stopped them from entering the building.'],
      ['lex-b1-auth2-have-trouble', 'I had trouble opening the file this morning.'],
      ['lex-b1-auth2-ask-someone', 'She asked him to wait outside for a moment.'],
      ['lex-b1-auth2-advise-someone', 'The doctor advised her to rest for two days.'],
      ['lex-b1-auth2-warn-someone', 'The sign warned them not to enter the room.'],
      ['lex-b1-auth-remind-me-to', 'Please remind us to call the office tomorrow.'],
      ['lex-b1-prove', 'The results have proven the original claim.'],
      ['lex-b1-extra-apologize', 'She apologised for the delay yesterday.'],
      ['lex-b1-extra-recognize', 'She recognised his voice immediately.'],
      ['lex-b1-auth2-apologise-for', 'He apologized for arriving late.'],
      ['lex-b1-make-someone-do', 'The joke made everyone laugh during the meeting.'],
      ['lex-b1-auth-give-hand', 'Could you give Anna a hand with these boxes?'],
      ['lex-b1-auth2-use-up', 'A cyclist knocked him down near the crossing.'],
      ['lex-b2-lay-off', 'The factory laid off temporary workers.'],
      ['lex-b2-approve-a-budget', 'The board approved a budget after the review.'],
      ['lex-b2-explore-an-alternative', 'They explored an alternative before deciding.'],
      ['lex-b2-analyse-findings', 'They analysed findings from the survey.'],
      ['lex-b2-respond-to-criticism', 'The director responded to criticism.'],
      ['lex-b2-conduct-research', 'The university conducted research into pollution.'],
      ['lex-b2-coincide', 'The dates coincided.'],
      ['lex-b2-fulfil-an-obligation', 'The supplier fulfilled an obligation yesterday.'],
      ['lex-b2-fulfil-an-obligation', 'The supplier will fulfill an obligation tomorrow.'],
      ['lex-b2-analyse-findings', 'Independent experts analyzed findings from the trial.'],
      ['lex-b2-recognise-a-need', 'The board recognized a need for clearer guidance.'],
      ['lex-b2-what-is-more', "What's more, the safer route is also shorter."],
      ['lex-c1-step-down', 'The chair stepped down after the inquiry.'],
      ['lex-c1-wind-down', 'The company wound down its overseas operation.'],
      ['lex-c1-question-validity', 'Several reviewers questioned the validity of the comparison.'],
      ['lex-c1-broker-agreement', 'Regional leaders brokered an agreement.'],
      ['lex-c1-scrutinise-evidence', 'The committee scrutinised the evidence.'],
      ['lex-c1-accommodate-needs', 'The timetable accommodated differing needs.'],
      ['lex-c1-allocate-budget', 'The department allocated a budget for training.'],
      ['lex-c1-appease-critics', 'The amendment appeased critics.'],
      ['lex-c1-bridge-gap', 'The programme bridged the gap for rural learners.'],
      ['lex-c1-marginalise-group', 'The policy marginalised a vulnerable group further.'],
      ['lex-c1-marginalise-group', 'The policy marginalized a vulnerable group further.'],
      ['lex-c1-restore-trust', 'The disclosure restored public trust gradually.'],
      ['lex-c1-spell-out-implications', 'The report spelt out the implications for local councils.'],
    ] as const
    for (const [id, response] of genuine) expect(responseMatchesPractice(phrase(id), 'written_productive', response), id).toBe(true)

    const invented = [
      ['lex-a2-lie-down', 'She lied down after lunch.'],
      ['lex-a2-eat-out', 'We eated out after the concert.'],
      ['lex-b1-auth-log-in', 'She loged in before the meeting.'],
      ['lex-b1-auth-step-in', 'A mediator steped in to help.'],
      ['lex-b2-lay-off', 'The factory layed off temporary workers.'],
      ['lex-c1-step-down', 'The chair steped down after the inquiry.'],
      ['lex-c1-wind-down', 'The company winded down its overseas operation.'],
    ] as const
    for (const [id, response] of invented) expect(responseMatchesPractice(phrase(id), 'written_productive', response), id).toBe(false)

    expect(responseMatchesPractice(phrase('lex-a2-change'), 'written_productive', 'The timetable changed again today.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-map'), 'written_productive', 'We mapped the route yesterday.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-break'), 'written_productive', 'The glass broke during the move.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-cost'), 'written_productive', 'Prices were costing more every week.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-bridge'), 'written_productive', 'The programme bridged two communities successfully.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-fit'), 'written_productive', 'The tailor fitted the jacket yesterday.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-b1-make-someone-do'), 'written_productive', 'The funny video made everyone to laugh.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-b1-make-someone-do'), 'written_productive', 'The funny video made everyone laughed.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-b1-make-someone-do'), 'written_productive', 'The result made everyone happy.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-start-ing'), 'written_productive', 'She started to went home after lunch.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-start-ing'), 'written_productive', 'She started to working here last September.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-finish-ing'), 'written_productive', 'They finished bring the boxes upstairs.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-b1-auth2-have-trouble'), 'written_productive', 'They had trouble ring the office.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-stop-ing'), 'written_productive', 'They stopped something near the station yesterday.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-b1-auth-be-good-enough-to'), 'written_productive', 'She imagined nothing during the quiet exercise.')).toBe(false)

    expect(responseMatchesPractice(phrase('lex-a2-stranger'), 'written_productive', 'I spoke to two strangers outside the station.')).toBe(true)
    expect(responseMatchesPractice(phrase('lex-b1-disadvantage'), 'written_productive', 'The plan has several disadvantages for small teams.')).toBe(true)
    expect(responseMatchesPractice(phrase('lex-b2-assumption'), 'written_productive', 'These assumptions need stronger evidence.')).toBe(true)
    expect(responseMatchesPractice(phrase('lex-c1-discrepancy'), 'written_productive', 'Several discrepancies remain in the report.')).toBe(true)
    expect(responseMatchesPractice(phrase('lex-a2-map'), 'written_productive', 'The maps are useful in unfamiliar cities.')).toBe(true)
    expect(responseMatchesPractice(phrase('lex-a2-map'), 'written_productive', 'The guide maps the route for each group.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-map'), 'written_productive', 'The article focuses on how software maps customer journeys.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-map'), 'written_productive', 'What the software maps are complex customer journeys.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-b1-extra-occasion'), 'written_productive', 'We meet on special occasions each year.')).toBe(true)
    expect(responseMatchesPractice(phrase('lex-b1-extra-occasion'), 'written_productive', 'The delay occasions concern among residents.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-c1-contingency'), 'written_productive', 'The reserve covers contingencies arising during construction.')).toBe(true)
    expect(responseMatchesPractice(phrase('lex-c1-stakeholder'), 'written_productive', 'Stakeholders were consulted before the decision.')).toBe(true)
    expect(responseMatchesPractice(phrase('lex-c1-adverse-consequence'), 'written_productive', 'The change may have adverse consequences for small firms.')).toBe(true)
    expect(responseMatchesPractice(phrase('lex-a2-break'), 'written_productive', 'This glass breaks easily in cold weather.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-a2-break'), 'written_productive', 'The report focuses on why machinery breaks frequently.')).toBe(false)
    expect(responseMatchesPractice(phrase('lex-b1-extra-occasion'), 'written_productive', 'The report focuses on what occasions public concern.')).toBe(false)
    expect(catalogAcceptedForms('advice', 'word', 'an opinion about what someone should do', 'lex-a2-advice')).toEqual([])
    expect(catalogAcceptedForms('heating', 'word', 'a system that makes a building warm', 'lex-a2-heating')).toEqual([])
    expect(catalogAcceptedForms('stairs', 'word', 'a set of steps between floors', 'lex-a2-stairs')).toEqual([])
    expect(catalogAcceptedForms('shelf', 'word', 'a flat board used to hold things', 'lex-a2-shelf')).toEqual(expect.arrayContaining(['...pluralcountcue shelves']))
    expect(catalogAcceptedForms('hypothesis', 'word', 'a proposed explanation', 'lex-c1-hypothesis')).toEqual(expect.arrayContaining(['...pluralcue hypotheses']))
    expect(catalogAcceptedForms('in practice', 'discourse_marker')).not.toContain('in practise')
    expect(responseMatchesPractice({ ...phrase('lex-a2-interested-in'), canonical: 'be interested in', acceptedForms: catalogAcceptedForms('be interested in', 'grammar_frame') }, 'written_productive', 'She is not interested in art anymore.')).toBe(true)
  })
})
