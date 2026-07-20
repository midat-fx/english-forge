import type { LexicalCatalogItem } from '../domain/lexicalCatalog'

type NominalCollocationSpec = Readonly<{
  expression: string
  plural: string
}>

function idSet(ids: string): ReadonlySet<string> {
  return new Set(ids.trim().split(/\s+/u).filter(Boolean))
}

function nominalSpecs(rows: string): Readonly<Record<string, NominalCollocationSpec>> {
  const parsedRows = rows.trim().split('\n').map((row) => row.trim()).filter(Boolean)
  const entries = parsedRows.map((row) => {
    const fields = row.split('|')
    const [id, expression, plural] = fields
    if (fields.length !== 3 || !id || !expression || !plural) throw new Error(`Invalid reviewed nominal-collocation row: ${row}`)
    return [id, Object.freeze({ expression, plural })]
  })
  if (new Set(entries.map(([id]) => id)).size !== entries.length) throw new Error('Duplicate reviewed nominal-collocation ID')
  return Object.freeze(Object.fromEntries(entries))
}

/**
 * Reviewed count readings for nominal collocations.
 *
 * The plural is authored for every ID. In particular, this avoids a generic
 * "pluralise the final token" rule, which would break phrases such as `a table
 * for two`, `a body of evidence`, and `a line of reasoning`, and would wrongly
 * derive forms for mass phrases such as `economic growth` or `mutual respect`.
 */
const NOMINAL_COLLOCATION_SPECS = nominalSpecs(`
  lex-a2-quiet-neighbourhood|quiet neighbourhood|quiet neighbourhoods
  lex-a2-daily-routine|daily routine|daily routines
  lex-a2-front-door|front door|front doors
  lex-a2-living-room|living room|living rooms
  lex-a2-table-two|a table for two|tables for two
  lex-a2-main-course|main course|main courses
  lex-a2-packed-lunch|packed lunch|packed lunches
  lex-a2-vegetarian-dish|vegetarian dish|vegetarian dishes
  lex-a2-todays-special|today’s special|today’s specials
  lex-a2-shopping-list|shopping list|shopping lists
  lex-a2-credit-card|credit card|credit cards
  lex-a2-bank-account|bank account|bank accounts
  lex-a2-cash-machine|cash machine|cash machines
  lex-a2-special-offer|special offer|special offers
  lex-a2-return-ticket|return ticket|return tickets
  lex-a2-single-ticket|single ticket|single tickets
  lex-a2-boarding-pass|boarding pass|boarding passes
  lex-a2-bus-stop|bus stop|bus stops
  lex-a2-train-station|train station|train stations
  lex-a2-best-friend|best friend|best friends
  lex-a2-close-friend|close friend|close friends
  lex-a2-family-member|family member|family members
  lex-a2-language-course|language course|language courses
  lex-a2-online-class|online class|online classes
  lex-a2-school-subject|school subject|school subjects
  lex-a2-foreign-language|foreign language|foreign languages
  lex-a2-full-time-job|full-time job|full-time jobs
  lex-a2-part-time-job|part-time job|part-time jobs
  lex-a2-job-interview|job interview|job interviews
  lex-a2-office-worker|office worker|office workers
  lex-a2-lunch-break|lunch break|lunch breaks
  lex-a2-healthy-diet|healthy diet|healthy diets
  lex-a2-internet-connection|internet connection|internet connections
  lex-a2-mobile-phone|mobile phone|mobile phones
  lex-a2-sports-centre|sports centre|sports centres

  lex-b1-auth2-meet-expectations|a rough idea|rough ideas
  lex-b1-auth2-form-opinion|a range of products|ranges of products
  lex-b1-auth2-keep-diary|a serious illness|serious illnesses
  lex-b1-auth2-reach-decision|return fare|return fares

  lex-b2-unconscious-bias|unconscious bias|unconscious biases
  lex-b2-coherent-argument|coherent argument|coherent arguments
  lex-b2-budget-constraint|budget constraint|budget constraints
  lex-b2-service-disruption|service disruption|service disruptions
  lex-b2-legitimate-concern|legitimate concern|legitimate concerns
  lex-b2-safety-regulation|safety regulation|safety regulations
  lex-b2-long-term-strategy|long-term strategy|long-term strategies
  lex-b2-reliable-indicator|reliable indicator|reliable indicators
  lex-b2-underlying-factor|underlying factor|underlying factors
  lex-b2-peer-reviewed-journal|peer-reviewed journal|peer-reviewed journals
  lex-b2-unintended-consequence|unintended consequence|unintended consequences
  lex-b2-long-term-impact|long-term impact|long-term impacts
  lex-b2-urgent-need|urgent need|urgent needs
  lex-b2-a-growing-body-of-evidence|a growing body of evidence|growing bodies of evidence
  lex-b2-reasonable-doubt|reasonable doubt|reasonable doubts
  lex-b2-serious-obstacle|serious obstacle|serious obstacles
  lex-b2-significant-challenge|significant challenge|significant challenges
  lex-b2-social-enterprise|social enterprise|social enterprises
  lex-b2-learning-outcome|learning outcome|learning outcomes
  lex-b2-steep-learning-curve|steep learning curve|steep learning curves
  lex-b2-common-misconception|common misconception|common misconceptions
  lex-b2-key-concept|key concept|key concepts
  lex-b2-detailed-explanation|detailed explanation|detailed explanations
  lex-b2-housing-shortage|housing shortage|housing shortages
  lex-b2-ageing-population|ageing population|ageing populations
  lex-b2-climate-policy|climate policy|climate policies
  lex-b2-public-transport-network|public transport network|public transport networks
  lex-b2-rural-community|rural community|rural communities
  lex-b2-collective-duty|collective duty|collective duties
  lex-b2-strong-commitment|strong commitment|strong commitments
  lex-b2-reasonable-expectation|reasonable expectation|reasonable expectations
  lex-b2-financial-incentive|financial incentive|financial incentives
  lex-b2-early-intervention|early intervention|early interventions
  lex-b2-sample-size|sample size|sample sizes
  lex-b2-immediate-priority|immediate priority|immediate priorities
  lex-b2-growing-pressure|growing pressure|growing pressures
  lex-b2-market-share|market share|market shares
  lex-b2-financial-pressure|financial pressure|financial pressures
  lex-b2-business-model|business model|business models
  lex-b2-profit-margin|profit margin|profit margins
  lex-b2-supply-chain|supply chain|supply chains
  lex-b2-public-sector|public sector|public sectors
  lex-b2-private-sector|private sector|private sectors
  lex-b2-academic-achievement|academic achievement|academic achievements
  lex-b2-attention-span|attention span|attention spans
  lex-b2-language-barrier|language barrier|language barriers
  lex-b2-environmental-impact|environmental impact|environmental impacts
  lex-b2-sense-of-belonging|sense of belonging|senses of belonging
  lex-b2-genuine-concern|genuine concern|genuine concerns
  lex-b2-growing-frustration|growing frustration|growing frustrations
  lex-b2-deep-regret|deep regret|deep regrets

  lex-c1-compelling-argument|a compelling argument|compelling arguments
  lex-c1-underlying-cause|underlying cause|underlying causes
  lex-c1-broad-range|a broad range of|broad ranges of
  lex-c1-key-driver|a key driver of|key drivers of
  lex-c1-marked-difference|a marked difference|marked differences
  lex-c1-growing-concern|a growing concern|growing concerns
  lex-c1-causal-relationship|causal relationship|causal relationships
  lex-c1-conceptual-framework|conceptual framework|conceptual frameworks
  lex-c1-methodological-flaw|methodological flaw|methodological flaws
  lex-c1-inherent-limitation|inherent limitation|inherent limitations
  lex-c1-representative-sample|representative sample|representative samples
  lex-c1-tentative-conclusion|tentative conclusion|tentative conclusions
  lex-c1-plausible-explanation|plausible explanation|plausible explanations
  lex-c1-alternative-interpretation|alternative interpretation|alternative interpretations
  lex-c1-theoretical-basis|theoretical basis|theoretical bases
  lex-c1-body-of-evidence|body of evidence|bodies of evidence
  lex-c1-line-of-reasoning|line of reasoning|lines of reasoning
  lex-c1-strategic-priority|strategic priority|strategic priorities
  lex-c1-binding-commitment|binding commitment|binding commitments
  lex-c1-contingency-plan|contingency plan|contingency plans
  lex-c1-measurable-outcome|measurable outcome|measurable outcomes
  lex-c1-risk-assessment|risk assessment|risk assessments
  lex-c1-skills-shortage|skills shortage|skills shortages
  lex-c1-structural-reform|structural reform|structural reforms
  lex-c1-competitive-advantage|competitive advantage|competitive advantages
  lex-c1-operational-capacity|operational capacity|operational capacities
  lex-c1-regulatory-framework|regulatory framework|regulatory frameworks
  lex-c1-long-term-outlook|long-term outlook|long-term outlooks
  lex-c1-organisational-culture|organisational culture|organisational cultures
  lex-c1-resource-allocation|resource allocation|resource allocations
  lex-c1-broader-remit|a broader remit|broader remits
  lex-c1-vested-interest|a vested interest|vested interests
  lex-c1-deep-seated-belief|a deep-seated belief|deep-seated beliefs
  lex-c1-growing-divide|a growing divide|growing divides
  lex-c1-shared-responsibility|shared responsibility|shared responsibilities
  lex-c1-entrenched-inequality|entrenched inequality|entrenched inequalities
  lex-c1-public-perception|public perception|public perceptions
  lex-c1-underlying-tension|underlying tension|underlying tensions
  lex-c1-implicit-bias|implicit bias|implicit biases
  lex-c1-meaningful-dialogue|meaningful dialogue|meaningful dialogues
  lex-c1-widespread-misconception|a widespread misconception|widespread misconceptions
  lex-c1-disproportionate-impact|a disproportionate impact|disproportionate impacts
  lex-c1-adverse-consequence|an adverse consequence|adverse consequences
  lex-c1-compelling-narrative|a compelling narrative|compelling narratives
  lex-c1-credible-threat|a credible threat|credible threats
  lex-c1-delicate-balance|a delicate balance|delicate balances
  lex-c1-ethical-dilemma|an ethical dilemma|ethical dilemmas
  lex-c1-genuine-concern|a genuine concern|genuine concerns
  lex-c1-legitimate-expectation|a legitimate expectation|legitimate expectations
  lex-c1-nuanced-understanding|a nuanced understanding|nuanced understandings
  lex-c1-compelling-rationale|a compelling rationale|compelling rationales
  lex-c1-foregone-conclusion|a foregone conclusion|foregone conclusions
  lex-c1-contentious-issue|a contentious issue|contentious issues
  lex-c1-tacit-agreement|a tacit agreement|tacit agreements
  lex-c1-untenable-position|an untenable position|untenable positions
  lex-c1-salient-point|a salient point|salient points
  lex-c1-robust-framework|a robust framework|robust frameworks
  lex-c1-marked-disparity|a marked disparity|marked disparities
  lex-c1-cursory-glance|a cursory glance|cursory glances
  lex-c1-negligible-impact|a negligible impact|negligible impacts
  lex-c1-sweeping-generalisation|a sweeping generalisation|sweeping generalisations
  lex-c1-unilateral-decision|a unilateral decision|unilateral decisions
  lex-c1-self-defeating-strategy|a self-defeating strategy|self-defeating strategies
  lex-c1-coherent-narrative|a coherent narrative|coherent narratives
  lex-c1-compelling-case|a compelling case|compelling cases
`)

// The complete plural phrase can cross a word-class boundary for these rows.
// A quantifier is the only reviewed context which forces the whole phrase to
// be a plural noun: compare `several attention spans` with `her attention spans
// work and family`.
const CUE_ONLY_ITEM_IDS = idSet(`
  lex-a2-living-room lex-a2-main-course lex-a2-vegetarian-dish lex-a2-shopping-list
  lex-a2-bank-account lex-a2-special-offer lex-a2-boarding-pass
  lex-a2-bus-stop lex-a2-job-interview lex-a2-lunch-break lex-a2-mobile-phone

  lex-b2-unconscious-bias lex-b2-public-transport-network
  lex-b2-business-model lex-b2-profit-margin lex-b2-public-sector
  lex-b2-private-sector lex-b2-attention-span lex-b2-urgent-need
  lex-b2-genuine-concern lex-b2-deep-regret

  lex-c1-representative-sample lex-c1-contingency-plan lex-c1-implicit-bias
  lex-c1-genuine-concern lex-c1-delicate-balance lex-c1-salient-point
`)

// These phrases can begin with a modern verb form (`packed lunches`, `return
// tickets`, `marked differences`). A plural determiner before the complete
// phrase blocks that parse. Quantifiers do not: `many packed lunches` can be a
// complete past-tense clause. Prepositions are not safe either because the
// matcher includes `to` and `by` (`to return tickets`, `by compelling
// arguments`).
const DETERMINER_ONLY_ITEM_IDS = idSet(`
  lex-a2-quiet-neighbourhood lex-a2-front-door lex-a2-table-two
  lex-a2-packed-lunch
  lex-a2-credit-card lex-a2-return-ticket lex-a2-single-ticket
  lex-a2-close-friend lex-a2-office-worker
  lex-a2-sports-centre

  lex-b1-auth2-meet-expectations

  lex-b2-budget-constraint lex-b2-underlying-factor
  lex-b2-peer-reviewed-journal lex-b2-a-growing-body-of-evidence
  lex-b2-key-concept lex-b2-detailed-explanation lex-b2-ageing-population
  lex-b2-climate-policy lex-b2-growing-frustration

  lex-c1-compelling-argument lex-c1-underlying-cause lex-c1-key-driver
  lex-c1-marked-difference lex-c1-binding-commitment lex-c1-risk-assessment
  lex-c1-resource-allocation lex-c1-vested-interest
  lex-c1-shared-responsibility lex-c1-entrenched-inequality
  lex-c1-underlying-tension lex-c1-compelling-narrative
  lex-c1-legitimate-expectation lex-c1-nuanced-understanding
  lex-c1-compelling-rationale lex-c1-marked-disparity
  lex-c1-sweeping-generalisation lex-c1-compelling-case
`)

// Both a phrase-initial verb parse and a subject-plus-verb parse are plausible,
// so none of the generic contexts is unambiguous. These remain unsupported
// until a grammar-aware matcher can prove the nominal reading.
const UNSUPPORTED_AMBIGUOUS_ITEM_IDS = idSet(`
  lex-a2-train-station lex-a2-best-friend lex-a2-language-course
  lex-a2-school-subject
  lex-b1-auth2-reach-decision
  lex-b2-legitimate-concern lex-b2-sample-size lex-b2-growing-pressure
  lex-b2-market-share lex-b2-supply-chain lex-b2-language-barrier
  lex-c1-growing-concern lex-c1-growing-divide
`)

const POLICY_ITEM_ID_SETS = [
  CUE_ONLY_ITEM_IDS,
  DETERMINER_ONLY_ITEM_IDS,
  UNSUPPORTED_AMBIGUOUS_ITEM_IDS,
] as const

const reviewedPolicyItemIds = POLICY_ITEM_ID_SETS.flatMap((ids) => [...ids])
if (new Set(reviewedPolicyItemIds).size !== reviewedPolicyItemIds.length) {
  throw new Error('Overlapping reviewed nominal-collocation policies')
}
for (const itemId of reviewedPolicyItemIds) {
  if (!NOMINAL_COLLOCATION_SPECS[itemId]) throw new Error(`Unknown reviewed nominal-collocation policy ID: ${itemId}`)
}

function normalizeExpression(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/[‘’]/gu, "'").replace(/\s+/gu, ' ')
}

function pluralPatterns(itemId: string, plural: string): string[] {
  if (UNSUPPORTED_AMBIGUOUS_ITEM_IDS.has(itemId)) return []
  if (CUE_ONLY_ITEM_IDS.has(itemId)) return [`...pluralcountcue ${plural}`]
  if (DETERMINER_ONLY_ITEM_IDS.has(itemId)) return [`...pluraldet ${plural}`]
  return [
    `...pluralcue ${plural}`,
    `...pluraldet ${plural}`,
    `...pluralprep ${plural}`,
    plural,
  ]
}

type CatalogCollocation = Pick<LexicalCatalogItem, 'id' | 'expression' | 'kind' | 'meaningEn'>

export const reviewedNominalCollocationCount = Object.keys(NOMINAL_COLLOCATION_SPECS).length

export type CatalogNominalFormPolicy = 'bare_safe' | 'cue_only' | 'determiner_only' | 'unsupported_ambiguous' | 'none'

export function catalogNominalCollocationPolicy(itemId: string): CatalogNominalFormPolicy {
  if (!NOMINAL_COLLOCATION_SPECS[itemId]) return 'none'
  if (UNSUPPORTED_AMBIGUOUS_ITEM_IDS.has(itemId)) return 'unsupported_ambiguous'
  if (CUE_ONLY_ITEM_IDS.has(itemId)) return 'cue_only'
  if (DETERMINER_ONLY_ITEM_IDS.has(itemId)) return 'determiner_only'
  return 'bare_safe'
}

export const catalogNominalFormCoverage = Object.freeze({
  reviewed: reviewedNominalCollocationCount,
  bareSafe: reviewedNominalCollocationCount - reviewedPolicyItemIds.length,
  cueOnly: CUE_ONLY_ITEM_IDS.size,
  determinerOnly: DETERMINER_ONLY_ITEM_IDS.size,
  unsupportedAmbiguous: UNSUPPORTED_AMBIGUOUS_ITEM_IDS.size,
})

export function catalogNominalCollocationPatterns(item: CatalogCollocation): string[]
export function catalogNominalCollocationPatterns(expression: string, meaningEn: string | undefined, itemId: string): string[]
export function catalogNominalCollocationPatterns(
  itemOrExpression: CatalogCollocation | string,
  _meaningEn?: string,
  explicitItemId?: string,
): string[] {
  if (typeof itemOrExpression !== 'string' && itemOrExpression.kind !== 'collocation') return []
  const expression = typeof itemOrExpression === 'string' ? itemOrExpression : itemOrExpression.expression
  const itemId = typeof itemOrExpression === 'string' ? explicitItemId : itemOrExpression.id
  if (!itemId) return []
  const spec = NOMINAL_COLLOCATION_SPECS[itemId]
  if (!spec || normalizeExpression(expression) !== normalizeExpression(spec.expression)) return []
  return pluralPatterns(itemId, spec.plural)
}
