import type { LexicalCatalogItem } from '../domain/lexicalCatalog'

/**
 * Reviewed, fail-closed morphology for the catalog's `kind: "word"` rows.
 *
 * The catalog does not carry a part-of-speech field, so this module deliberately
 * does not infer one from an English definition (for example, from `a` / `an`).
 * Only item IDs in the reviewed sets below can produce a form. Everything else,
 * including a newly added catalog row, returns no form until it is reviewed.
 *
 * The inventory constants pin the exact 660-row editorial snapshot reviewed for
 * this metadata. Tests recompute the ID digest from the real lazy-loaded catalog.
 */
export const REVIEWED_WORD_INVENTORY_COUNT = 660
export const REVIEWED_WORD_INVENTORY_IDS_SHA256 = '6f2f330e706f88ea6f3feeb497ed850a4139ea3100a14b5ce0c81e9fc03ce30c'

function idSet(ids: string): ReadonlySet<string> {
  return new Set(ids.trim().split(/\s+/u).filter(Boolean))
}

// Count readings only. Deliberately absent: mass nouns (advice, evidence,
// furniture), plural-only nouns (stairs), and homographs without a safe count
// reading in the reviewed row. Ambiguous count/mass readings are
// omitted when a plural would normally change the taught sense.
const COUNT_NOUN_ITEM_IDS = idSet(`
  lex-a2-choice lex-a2-journey lex-a2-neighbourhood lex-a2-appointment
  lex-a2-adult lex-a2-guest lex-a2-couple lex-a2-relative lex-a2-teenager
  lex-a2-colleague lex-a2-customer lex-a2-passenger lex-a2-owner lex-a2-manager
  lex-a2-stranger lex-a2-partner lex-a2-member lex-a2-visitor lex-a2-guide
  lex-a2-driver lex-a2-neighbour lex-a2-classmate lex-a2-friendship
  lex-a2-conversation lex-a2-balcony lex-a2-basement lex-a2-ceiling
  lex-a2-entrance lex-a2-floor lex-a2-gate lex-a2-hall lex-a2-roof lex-a2-shelf
  lex-a2-blanket lex-a2-carpet lex-a2-curtain lex-a2-drawer lex-a2-washing-machine lex-a2-mirror
  lex-a2-pillow lex-a2-towel lex-a2-meal lex-a2-snack lex-a2-recipe
  lex-a2-ingredient lex-a2-taste lex-a2-slice lex-a2-bowl lex-a2-plate
  lex-a2-fork lex-a2-spoon lex-a2-price lex-a2-cost lex-a2-receipt lex-a2-sale
  lex-a2-discount lex-a2-size lex-a2-brand lex-a2-product lex-a2-market
  lex-a2-department lex-a2-item lex-a2-suitcase lex-a2-platform lex-a2-station
  lex-a2-airport lex-a2-flight lex-a2-ticket lex-a2-passport lex-a2-map
  lex-a2-route lex-a2-delay lex-a2-bridge lex-a2-corner lex-a2-crossing
  lex-a2-direction lex-a2-capital lex-a2-centre lex-a2-island lex-a2-forest
  lex-a2-field lex-a2-hill lex-a2-lake lex-a2-path lex-a2-square lex-a2-castle
  lex-a2-church lex-a2-factory lex-a2-farm lex-a2-library lex-a2-museum
  lex-a2-stadium lex-a2-theatre lex-a2-view lex-a2-area lex-a2-ache lex-a2-cough
  lex-a2-cold lex-a2-fever lex-a2-medicine lex-a2-patient lex-a2-treatment
  lex-a2-accident lex-a2-ambulance lex-a2-exercise lex-a2-dentist lex-a2-pharmacy lex-a2-bandage
  lex-a2-subject lex-a2-course lex-a2-lesson lex-a2-exam lex-a2-mark lex-a2-result
  lex-a2-skill lex-a2-project lex-a2-report lex-a2-meeting lex-a2-office
  lex-a2-salary lex-a2-career lex-a2-task lex-a2-break lex-a2-uniform lex-a2-job
  lex-a2-cloud lex-a2-storm lex-a2-wind lex-a2-temperature lex-a2-degree lex-a2-forecast
  lex-a2-season lex-a2-environment lex-a2-plant lex-a2-ocean lex-a2-date
  lex-a2-calendar lex-a2-century lex-a2-period lex-a2-schedule lex-a2-holiday
  lex-a2-festival lex-a2-celebration lex-a2-competition lex-a2-performance
  lex-a2-event lex-a2-invitation lex-a2-present lex-a2-programme lex-a2-audience
  lex-a2-crowd

  lex-b1-opportunity lex-b1-relationship lex-b1-advantage lex-b1-disadvantage
  lex-b1-extra-ability lex-b1-extra-achievement lex-b1-extra-announcement
  lex-b1-extra-arrangement lex-b1-extra-attitude lex-b1-extra-benefit
  lex-b1-extra-conclusion lex-b1-extra-connection lex-b1-extra-development
  lex-b1-extra-effect lex-b1-extra-effort lex-b1-extra-behaviour lex-b1-extra-improvement
  lex-b1-extra-occasion lex-b1-extra-possibility lex-b1-extra-purpose
  lex-b1-extra-solution

  lex-b2-decline lex-b2-demand lex-b2-issue lex-b2-outcome lex-b2-tendency lex-b2-alternative
  lex-b2-assumption lex-b2-barrier lex-b2-commitment
  lex-b2-capacity lex-b2-constraint lex-b2-context lex-b2-criterion lex-b2-debate
  lex-b2-drawback lex-b2-emphasis lex-b2-exception lex-b2-factor lex-b2-framework
  lex-b2-incentive lex-b2-inequality lex-b2-initiative lex-b2-interpretation
  lex-b2-limitation lex-b2-priority lex-b2-procedure lex-b2-proportion
  lex-b2-prospect lex-b2-regulation lex-b2-resource lex-b2-shortage
  lex-b2-scope lex-b2-strategy lex-b2-trend lex-b2-version lex-b2-exposure
  lex-b2-implication lex-b2-mechanism lex-b2-notification lex-b2-restriction
  lex-b2-controversy

  lex-c1-ambiguity lex-c1-anomaly lex-c1-bias lex-c1-caveat
  lex-c1-correlation lex-c1-discrepancy lex-c1-hypothesis lex-c1-methodology
  lex-c1-paradigm lex-c1-premise lex-c1-rationale lex-c1-variable
  lex-c1-contingency lex-c1-deficit lex-c1-disruption lex-c1-intervention
  lex-c1-mandate lex-c1-oversight lex-c1-provision lex-c1-stakeholder lex-c1-backlash
  lex-c1-disparity lex-c1-entitlement lex-c1-grievance lex-c1-misconception
  lex-c1-prejudice lex-c1-resentment lex-c1-stigma lex-c1-stereotype
`)

// A plural spelling is also the third-person singular verb for these reviewed
// noun readings. They remain context-bound so a sentence such as “software
// maps demand” cannot satisfy the noun card. Borderline denominal verbs are
// included deliberately: fail-closed evidence is preferable to a false pass.
const CONTEXT_ONLY_COUNT_NOUN_ITEM_IDS = idSet(`
  lex-a2-journey lex-a2-guest lex-a2-couple lex-a2-partner lex-a2-guide
  lex-a2-neighbour lex-a2-entrance lex-a2-floor lex-a2-gate lex-a2-roof lex-a2-shelf
  lex-a2-blanket lex-a2-carpet lex-a2-curtain lex-a2-mirror lex-a2-towel
  lex-a2-snack lex-a2-taste lex-a2-slice lex-a2-bowl lex-a2-plate lex-a2-fork
  lex-a2-spoon lex-a2-price lex-a2-cost lex-a2-discount lex-a2-size lex-a2-brand
  lex-a2-market lex-a2-platform lex-a2-station lex-a2-ticket lex-a2-map
  lex-a2-route lex-a2-delay lex-a2-bridge lex-a2-corner lex-a2-centre
  lex-a2-field lex-a2-square lex-a2-castle lex-a2-farm lex-a2-view lex-a2-ache
  lex-a2-cough lex-a2-exercise lex-a2-bandage lex-a2-subject lex-a2-course
  lex-a2-mark lex-a2-result lex-a2-skill lex-a2-project lex-a2-report
  lex-a2-career lex-a2-task lex-a2-break lex-a2-cloud lex-a2-storm lex-a2-wind
  lex-a2-forecast lex-a2-season lex-a2-plant lex-a2-date lex-a2-calendar
  lex-a2-schedule lex-a2-holiday lex-a2-present lex-a2-programme lex-a2-crowd lex-a2-event

  lex-b1-advantage lex-b1-disadvantage lex-b1-extra-benefit lex-b1-extra-effect
  lex-b1-extra-occasion lex-b1-extra-purpose

  lex-b2-decline lex-b2-demand lex-b2-issue lex-b2-debate lex-b2-factor
  lex-b2-proportion lex-b2-prospect lex-b2-resource lex-b2-scope lex-b2-trend
  lex-b2-version

  lex-c1-bias lex-c1-premise lex-c1-mandate lex-c1-provision lex-c1-prejudice
  lex-c1-stereotype

  lex-a2-adult lex-a2-pillow lex-a2-receipt lex-a2-flight lex-a2-passport
  lex-a2-forest lex-a2-hill lex-a2-island lex-a2-path lex-a2-church lex-a2-fever
  lex-a2-medicine lex-a2-lesson lex-a2-salary lex-a2-uniform lex-a2-job
  lex-a2-period lex-b2-barrier lex-b2-context lex-b2-framework lex-c1-caveat
  lex-c1-backlash lex-c1-stigma
`)

// Reviewed noun readings which must remain morphologically inert. Keeping this
// taxonomy explicit distinguishes a deliberate non-count decision from a verb,
// adverb, non-gradable adjective, or otherwise unsupported catalog row.
const NON_COUNT_NOUN_ITEM_IDS = idSet(`
  lex-a2-advice lex-a2-furniture lex-a2-heating lex-a2-cash lex-a2-change
  lex-a2-quality lex-a2-luggage lex-a2-traffic lex-a2-petrol lex-a2-countryside
  lex-a2-pain lex-a2-knowledge lex-a2-experience lex-a2-training lex-a2-sunshine
  lex-a2-shade lex-a2-wildlife lex-a2-pollution lex-a2-rubbish lex-a2-energy
  lex-a2-earth lex-a2-future lex-a2-past lex-a2-midnight lex-a2-noon lex-a2-stairs

  lex-b1-extra-employment lex-b1-extra-lack lex-b1-extra-permission
  lex-b1-extra-research lex-b1-extra-safety

  lex-b2-evidence lex-b2-access lex-b2-feedback lex-b2-enforcement lex-b2-welfare
  lex-b2-circumstance

  lex-c1-validity lex-c1-viability lex-c1-accountability lex-c1-compliance
  lex-c1-credibility lex-c1-efficiency lex-c1-governance lex-c1-infrastructure
  lex-c1-procurement lex-c1-sustainability lex-c1-transparency lex-c1-cohesion
  lex-c1-dissent lex-c1-empathy lex-c1-integrity lex-c1-legitimacy
  lex-c1-polarisation lex-c1-rapport lex-c1-reciprocity lex-c1-solidarity
  lex-c1-tolerance lex-c1-vulnerability lex-c1-consensus lex-c1-resilience
`)

// Only semantically gradable readings. Relational/absolute adjectives such as
// local, online, possible, mutual, mandatory, preliminary, and empirical are
// intentionally excluded even if occasional corpus examples use degree words.
const GRADABLE_ADJECTIVE_ITEM_IDS = idSet(`
  lex-a2-available lex-a2-fresh lex-a2-sweet lex-a2-spicy lex-a2-hungry
  lex-a2-thirsty lex-a2-cheap lex-a2-expensive lex-a2-fit lex-a2-healthy
  lex-a2-ill lex-a2-sick lex-a2-tired lex-a2-wild lex-a2-natural lex-a2-amazed
  lex-a2-angry lex-a2-bored lex-a2-calm lex-a2-comfortable lex-a2-confused
  lex-a2-disappointed lex-a2-embarrassed lex-a2-excited lex-a2-friendly
  lex-a2-glad lex-a2-lonely lex-a2-nervous lex-a2-pleased lex-a2-relaxed
  lex-a2-surprised lex-a2-worried lex-a2-useful lex-a2-careful

  lex-b1-reliable lex-b1-reasonable lex-b1-confident lex-b1-familiar
  lex-b1-responsible lex-b1-similar lex-b1-ordinary lex-b1-challenging
  lex-b1-embarrassing lex-b1-extra-accurate lex-b1-extra-anxious
  lex-b1-extra-certain lex-b1-extra-convenient lex-b1-extra-creative
  lex-b1-extra-fair lex-b1-extra-independent lex-b1-common
  lex-b1-extra-positive lex-b1-extra-private lex-b1-extra-professional
  lex-b1-extra-suitable lex-b1-extra-typical lex-b1-extra-unlikely lex-b1-ashamed

  lex-b2-significant lex-b2-relevant lex-b2-valid lex-b2-widespread
  lex-b2-adequate lex-b2-apparent lex-b2-appropriate lex-b2-arbitrary
  lex-b2-aware lex-b2-beneficial lex-b2-brief lex-b2-complex
  lex-b2-consistent lex-b2-controversial lex-b2-distinct lex-b2-diverse
  lex-b2-efficient lex-b2-ethical lex-b2-excessive lex-b2-flexible
  lex-b2-genuine lex-b2-gradual lex-b2-innovative lex-b2-intense
  lex-b2-objective lex-b2-practical lex-b2-precise lex-b2-predictable
  lex-b2-reluctant lex-b2-remarkable lex-b2-remote lex-b2-severe
  lex-b2-specific lex-b2-stable lex-b2-substantial lex-b2-thorough
  lex-b2-urgent lex-b2-vague lex-b2-vulnerable lex-b2-worthwhile
  lex-b2-adaptable lex-b2-compelling lex-b2-credible lex-b2-inclusive
  lex-b2-marginal lex-b2-moderate lex-b2-prevalent lex-b2-rigid
  lex-b2-scarce lex-b2-sceptical lex-b2-sustainable lex-b2-tentative
  lex-b2-viable lex-b2-decisive

  lex-c1-nuanced lex-c1-feasible lex-c1-resilient lex-c1-accountable
  lex-c1-transparent lex-c1-stringent lex-c1-comprehensive lex-c1-coherent
  lex-c1-contentious lex-c1-counterintuitive lex-c1-dubious lex-c1-flawed
  lex-c1-inconclusive lex-c1-legitimate lex-c1-misleading
  lex-c1-questionable lex-c1-redundant lex-c1-rigorous lex-c1-tenable
  lex-c1-ambivalent lex-c1-apprehensive lex-c1-complacent lex-c1-dismissive
  lex-c1-ambiguous
`)

// Reviewed synthetic forms for short and irregular adjectives. All other IDs in
// GRADABLE_ADJECTIVE_ITEM_IDS use the uninflected analytic forms more/most.
const SYNTHETIC_ADJECTIVE_FORMS: Readonly<Record<string, readonly [string, string]>> = {
  'lex-a2-fresh': ['fresher', 'freshest'],
  'lex-a2-sweet': ['sweeter', 'sweetest'],
  'lex-a2-spicy': ['spicier', 'spiciest'],
  'lex-a2-hungry': ['hungrier', 'hungriest'],
  'lex-a2-thirsty': ['thirstier', 'thirstiest'],
  'lex-a2-cheap': ['cheaper', 'cheapest'],
  'lex-a2-healthy': ['healthier', 'healthiest'],
  'lex-a2-sick': ['sicker', 'sickest'],
  'lex-a2-wild': ['wilder', 'wildest'],
  'lex-a2-angry': ['angrier', 'angriest'],
  'lex-a2-calm': ['calmer', 'calmest'],
  'lex-a2-friendly': ['friendlier', 'friendliest'],
  'lex-a2-glad': ['gladder', 'gladdest'],
  'lex-a2-lonely': ['lonelier', 'loneliest'],
  'lex-b1-extra-fair': ['fairer', 'fairest'],
  'lex-b2-brief': ['briefer', 'briefest'],
  'lex-b1-extra-unlikely': ['unlikelier', 'unlikeliest'],
  'lex-b2-remote': ['remoter', 'remotest'],
  'lex-b2-severe': ['severer', 'severest'],
  'lex-b2-stable': ['stabler', 'stablest'],
  'lex-b2-vague': ['vaguer', 'vaguest'],
  'lex-b2-scarce': ['scarcer', 'scarcest'],
}

const IRREGULAR_NOUN_PLURALS: Readonly<Record<string, readonly string[]>> = {
  criterion: ['criteria'],
  emphasis: ['emphases'],
  hypothesis: ['hypotheses'],
  shelf: ['shelves'],
}

function regularNounPlural(word: string): string {
  if (/[^aeiou]y$/u.test(word)) return `${word.slice(0, -1)}ies`
  if (/(?:s|x|z|ch|sh)$/u.test(word)) return `${word}es`
  return `${word}s`
}

function nounPatterns(word: string, itemId: string): string[] {
  const plurals = IRREGULAR_NOUN_PLURALS[word] ?? [regularNounPlural(word)]
  const contextOnly = CONTEXT_ONLY_COUNT_NOUN_ITEM_IDS.has(itemId)
  return plurals.flatMap((plural) => [
    `...${contextOnly ? 'pluralcountcue' : 'pluralcue'} ${plural}`,
    `...pluraldet ${plural}`,
    `...pluralprep ${plural}`,
    ...(contextOnly ? [] : [plural]),
  ])
}

type CatalogWord = Pick<LexicalCatalogItem, 'id' | 'expression' | 'kind' | 'meaningEn'>

export type CatalogWordFormDecision = 'count_noun' | 'non_count_noun' | 'gradable_adjective' | 'none'

export function catalogWordFormDecision(itemId: string): CatalogWordFormDecision {
  if (COUNT_NOUN_ITEM_IDS.has(itemId)) return 'count_noun'
  if (NON_COUNT_NOUN_ITEM_IDS.has(itemId)) return 'non_count_noun'
  if (GRADABLE_ADJECTIVE_ITEM_IDS.has(itemId)) return 'gradable_adjective'
  return 'none'
}

export function catalogWordAllowsBarePlural(itemId: string): boolean {
  return COUNT_NOUN_ITEM_IDS.has(itemId) && !CONTEXT_ONLY_COUNT_NOUN_ITEM_IDS.has(itemId)
}

export const catalogWordFormCoverage = Object.freeze({
  reviewedInventory: REVIEWED_WORD_INVENTORY_COUNT,
  countNouns: COUNT_NOUN_ITEM_IDS.size,
  contextOnlyCountNouns: CONTEXT_ONLY_COUNT_NOUN_ITEM_IDS.size,
  nonCountNouns: NON_COUNT_NOUN_ITEM_IDS.size,
  gradableAdjectives: GRADABLE_ADJECTIVE_ITEM_IDS.size,
  excluded: REVIEWED_WORD_INVENTORY_COUNT - COUNT_NOUN_ITEM_IDS.size - NON_COUNT_NOUN_ITEM_IDS.size - GRADABLE_ADJECTIVE_ITEM_IDS.size,
})

export function catalogWordAcceptedPatterns(item: CatalogWord): string[]
export function catalogWordAcceptedPatterns(expression: string, meaningEn: string | undefined, itemId: string): string[]
export function catalogWordAcceptedPatterns(
  itemOrExpression: CatalogWord | string,
  _meaningEn?: string,
  explicitItemId?: string,
): string[] {
  if (typeof itemOrExpression !== 'string' && itemOrExpression.kind !== 'word') return []

  const expression = (typeof itemOrExpression === 'string' ? itemOrExpression : itemOrExpression.expression)
    .trim()
    .toLocaleLowerCase('en-US')
  const itemId = typeof itemOrExpression === 'string' ? explicitItemId : itemOrExpression.id
  if (!itemId || !expression) return []

  // Bind the ID to its expression so reviewed POS metadata cannot be reused for
  // another row. `washing machine` is the sole multiword `kind: "word"` row.
  const expressionSlug = expression.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/gu, '')
  if (!itemId.toLocaleLowerCase('en-US').endsWith(`-${expressionSlug}`)) return []

  const decision = catalogWordFormDecision(itemId)
  if (decision === 'count_noun') return nounPatterns(expression, itemId)
  if (decision === 'gradable_adjective') {
    return [...(SYNTHETIC_ADJECTIVE_FORMS[itemId] ?? [`more ${expression}`, `most ${expression}`])]
  }
  return []
}
