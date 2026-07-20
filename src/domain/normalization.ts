export function normalizePhrase(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en')
}

const ENGLISH_SPELLING_PAIRS = [
  ['behavior', 'behaviour'], ['behaviors', 'behaviours'],
  ['color', 'colour'], ['colors', 'colours'], ['colored', 'coloured'], ['coloring', 'colouring'],
  ['favor', 'favour'], ['favors', 'favours'], ['favored', 'favoured'], ['favoring', 'favouring'], ['favorable', 'favourable'], ['favorite', 'favourite'], ['favorites', 'favourites'],
  ['honor', 'honour'], ['honors', 'honours'], ['honored', 'honoured'],
  ['labor', 'labour'], ['labors', 'labours'], ['neighbor', 'neighbour'], ['neighbors', 'neighbours'],
  ['center', 'centre'], ['centers', 'centres'], ['centered', 'centred'], ['theater', 'theatre'], ['theaters', 'theatres'], ['gray', 'grey'],
  ['organize', 'organise'], ['organizes', 'organises'], ['organized', 'organised'], ['organizing', 'organising'],
  ['organization', 'organisation'], ['organizations', 'organisations'],
  ['organizational', 'organisational'],
  ['recognize', 'recognise'], ['recognizes', 'recognises'], ['recognized', 'recognised'], ['recognizing', 'recognising'],
  ['analyze', 'analyse'], ['analyzes', 'analyses'], ['analyzed', 'analysed'], ['analyzing', 'analysing'],
  ['apologize', 'apologise'], ['apologizes', 'apologises'], ['apologized', 'apologised'], ['apologizing', 'apologising'],
  ['fulfill', 'fulfil'], ['fulfills', 'fulfils'],
  ['marginalize', 'marginalise'], ['marginalizes', 'marginalises'], ['marginalized', 'marginalised'], ['marginalizing', 'marginalising'],
  ['mobilize', 'mobilise'], ['mobilizes', 'mobilises'], ['mobilized', 'mobilised'], ['mobilizing', 'mobilising'],
  ['scrutinize', 'scrutinise'], ['scrutinizes', 'scrutinises'], ['scrutinized', 'scrutinised'], ['scrutinizing', 'scrutinising'],
  ['emphasize', 'emphasise'], ['emphasizes', 'emphasises'], ['emphasized', 'emphasised'], ['emphasizing', 'emphasising'],
  ['anonymize', 'anonymise'], ['anonymizes', 'anonymises'], ['anonymized', 'anonymised'], ['anonymizing', 'anonymising'],
  ['authorize', 'authorise'], ['authorizes', 'authorises'], ['authorized', 'authorised'], ['authorizing', 'authorising'],
  ['decentralize', 'decentralise'], ['decentralizes', 'decentralises'], ['decentralized', 'decentralised'], ['decentralizing', 'decentralising'],
  ['disorganized', 'disorganised'],
  ['finalize', 'finalise'], ['finalizes', 'finalises'], ['finalized', 'finalised'], ['finalizing', 'finalising'],
  ['hypothesize', 'hypothesise'], ['hypothesizes', 'hypothesises'], ['hypothesized', 'hypothesised'], ['hypothesizing', 'hypothesising'],
  ['incentivize', 'incentivise'], ['incentivizes', 'incentivises'], ['incentivized', 'incentivised'], ['incentivizing', 'incentivising'],
  ['materialize', 'materialise'], ['materializes', 'materialises'], ['materialized', 'materialised'], ['materializing', 'materialising'],
  ['memorize', 'memorise'], ['memorizes', 'memorises'], ['memorized', 'memorised'], ['memorizing', 'memorising'],
  ['minimize', 'minimise'], ['minimizes', 'minimises'], ['minimized', 'minimised'], ['minimizing', 'minimising'],
  ['normalize', 'normalise'], ['normalizes', 'normalises'], ['normalized', 'normalised'], ['normalizing', 'normalising'],
  ['polarize', 'polarise'], ['polarizes', 'polarises'], ['polarized', 'polarised'], ['polarizing', 'polarising'],
  ['prioritize', 'prioritise'], ['prioritizes', 'prioritises'], ['prioritized', 'prioritised'], ['prioritizing', 'prioritising'],
  ['realize', 'realise'], ['realizes', 'realises'], ['realized', 'realised'], ['realizing', 'realising'],
  ['specialize', 'specialise'], ['specializes', 'specialises'], ['specialized', 'specialised'], ['specializing', 'specialising'],
  ['subsidize', 'subsidise'], ['subsidizes', 'subsidises'], ['subsidized', 'subsidised'], ['subsidizing', 'subsidising'],
  ['summarize', 'summarise'], ['summarizes', 'summarises'], ['summarized', 'summarised'], ['summarizing', 'summarising'],
  ['synthesize', 'synthesise'], ['synthesizes', 'synthesises'], ['synthesized', 'synthesised'], ['synthesizing', 'synthesising'],
  ['polarization', 'polarisation'], ['polarizations', 'polarisations'],
  ['generalization', 'generalisation'], ['generalizations', 'generalisations'],
  ['overgeneralization', 'overgeneralisation'], ['overgeneralizations', 'overgeneralisations'],
  ['nominalization', 'nominalisation'], ['nominalizations', 'nominalisations'],
  ['aging', 'ageing'], ['skeptical', 'sceptical'],
  ['kilometer', 'kilometre'], ['kilometers', 'kilometres'], ['neighboring', 'neighbouring'],
  ['traveling', 'travelling'], ['traveled', 'travelled'], ['traveler', 'traveller'], ['travelers', 'travellers'],
  ['canceled', 'cancelled'], ['canceling', 'cancelling'], ['labeled', 'labelled'], ['labeling', 'labelling'],
  ['modeled', 'modelled'], ['modeling', 'modelling'], ['program', 'programme'], ['programs', 'programmes'],
  ['dialog', 'dialogue'], ['dialogs', 'dialogues'], ['judgment', 'judgement'], ['judgments', 'judgements'],
  ['license', 'licence'], ['licenses', 'licences'],
  ['learned', 'learnt'],
] as const

const ENGLISH_SPELLING_EQUIVALENTS = new Map<string, string>(
  ENGLISH_SPELLING_PAIRS.flatMap(([left, right]) => [[left, right], [right, left]]),
)
const ENGLISH_SPELLING_CANONICAL = new Map<string, string>(
  ENGLISH_SPELLING_PAIRS.flatMap(([left, right]) => [[left, left], [right, left]]),
)

export function canonicalizeEnglishSpelling(value: string): string {
  return value.replace(/\p{L}+/gu, (token) => ENGLISH_SPELLING_CANONICAL.get(token.toLocaleLowerCase('en-US')) ?? token)
}

export function deriveEnglishSpellingVariants(value: string): string[] {
  const parts = value.split(/(\p{L}+)/u)
  let variants = [parts]
  for (let index = 1; index < parts.length; index += 2) {
    const token = parts[index]
    const replacement = ENGLISH_SPELLING_EQUIVALENTS.get(token.toLocaleLowerCase('en-US'))
    if (!replacement) continue
    const cased = /^\p{Lu}/u.test(token) ? `${replacement[0]?.toLocaleUpperCase('en-US')}${replacement.slice(1)}` : replacement
    variants = variants.flatMap((candidate) => {
      const swapped = [...candidate]
      swapped[index] = cased
      return [candidate, swapped]
    }).slice(0, 32)
  }
  return [...new Set(variants.map((partsVariant) => partsVariant.join('')).filter((variant) => variant !== value))]
}

const CONTRACTION_EXPANSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(i|you|he|she|it|we|they)'d(?=\s+better\b)/giu, '$1 had'],
  [/\b(i|you|he|she|it|we|they)'d(?=\s+(?:rather|like)\b)/giu, '$1 would'],
  [/\b(he|she|it)'s(?=\s+(?:been|got)\b)/giu, '$1 has'],
  [/\baren't\b/giu, 'are not'], [/\bcan't\b/giu, 'cannot'], [/\bcouldn't\b/giu, 'could not'],
  [/\bdidn't\b/giu, 'did not'], [/\bdoesn't\b/giu, 'does not'], [/\bdon't\b/giu, 'do not'],
  [/\bhadn't\b/giu, 'had not'], [/\bhasn't\b/giu, 'has not'], [/\bhaven't\b/giu, 'have not'],
  [/\bhe's\b/giu, 'he is'], [/\bi'll\b/giu, 'I will'], [/\byou'll\b/giu, 'you will'],
  [/\bhe'll\b/giu, 'he will'], [/\bshe'll\b/giu, 'she will'], [/\bit'll\b/giu, 'it will'],
  [/\bwe'll\b/giu, 'we will'], [/\bthey'll\b/giu, 'they will'],
  [/\bi'm\b/giu, 'I am'], [/\bi've\b/giu, 'I have'], [/\bwe've\b/giu, 'we have'],
  [/\bthey've\b/giu, 'they have'], [/\byou've\b/giu, 'you have'], [/\bisn't\b/giu, 'is not'],
  [/\bit's\b/giu, 'it is'], [/\blet's\b/giu, 'let us'], [/\bmustn't\b/giu, 'must not'],
  [/\bshe's\b/giu, 'she is'], [/\bshouldn't\b/giu, 'should not'], [/\bthat's\b/giu, 'that is'],
  [/\bthere's\b/giu, 'there is'], [/\bthey're\b/giu, 'they are'], [/\bwasn't\b/giu, 'was not'],
  [/\bwe're\b/giu, 'we are'], [/\bweren't\b/giu, 'were not'], [/\bwhat's\b/giu, 'what is'],
  [/\bwon't\b/giu, 'will not'], [/\bwouldn't\b/giu, 'would not'], [/\byou're\b/giu, 'you are'],
]

export function expandEnglishContractions(value: string): string {
  return CONTRACTION_EXPANSIONS.reduce(
    (expanded, [pattern, replacement]) => expanded.replace(pattern, replacement),
    value.replace(/[‘’]/gu, "'"),
  )
}

const IRREGULAR_VERB_FORMS: Record<string, string[]> = {
  arise: ['arises', 'arose', 'arisen', 'arising'], be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  admit: ['admits', 'admitted', 'admitting'],
  analyse: ['analyses', 'analysed', 'analysing', 'analyze', 'analyzes', 'analyzed', 'analyzing'],
  analyze: ['analyzes', 'analyzed', 'analyzing', 'analyse', 'analyses', 'analysed', 'analysing'],
  apologise: ['apologises', 'apologised', 'apologising', 'apologize', 'apologizes', 'apologized', 'apologizing'],
  apologize: ['apologizes', 'apologized', 'apologizing', 'apologise', 'apologises', 'apologised', 'apologising'],
  bear: ['bears', 'bore', 'borne', 'bearing'], break: ['breaks', 'broke', 'broken', 'breaking'],
  bring: ['brings', 'brought', 'bringing'], build: ['builds', 'built', 'building'],
  buy: ['buys', 'bought', 'buying'], catch: ['catches', 'caught', 'catching'], choose: ['chooses', 'chose', 'chosen', 'choosing'],
  cancel: ['cancels', 'canceled', 'cancelled', 'canceling', 'cancelling'], compel: ['compels', 'compelled', 'compelling'], cost: ['costs', 'cost', 'costing'],
  breed: ['breeds', 'bred', 'breeding'], drink: ['drinks', 'drank', 'drunk', 'drinking'], eat: ['eats', 'ate', 'eaten', 'eating'],
  cast: ['casts', 'casting'], come: ['comes', 'came', 'coming'], cut: ['cuts', 'cutting'], deal: ['deals', 'dealt', 'dealing'],
  do: ['does', 'did', 'done', 'doing'], draw: ['draws', 'drew', 'drawn', 'drawing'],
  drive: ['drives', 'drove', 'driven', 'driving'],
  fall: ['falls', 'fell', 'fallen', 'falling'], feel: ['feels', 'felt', 'feeling'],
  feed: ['feeds', 'fed', 'feeding'], find: ['finds', 'found', 'finding'], fit: ['fits', 'fit', 'fitted', 'fitting'], get: ['gets', 'got', 'gotten', 'getting'],
  fulfil: ['fulfill', 'fulfils', 'fulfills', 'fulfilled', 'fulfilling'],
  fulfill: ['fulfil', 'fulfils', 'fulfills', 'fulfilled', 'fulfilling'], hurt: ['hurts', 'hurt', 'hurting'],
  forget: ['forgets', 'forgot', 'forgotten', 'forgetting'],
  give: ['gives', 'gave', 'given', 'giving'], go: ['goes', 'went', 'gone', 'going'],
  grow: ['grows', 'grew', 'grown', 'growing'], have: ['has', 'had', 'having'],
  hear: ['hears', 'heard', 'hearing'], keep: ['keeps', 'kept', 'keeping'],
  hang: ['hangs', 'hung', 'hanging'], hold: ['holds', 'held', 'holding'],
  lay: ['lays', 'laid', 'laying'], lend: ['lends', 'lent', 'lending'], lie: ['lies', 'lay', 'lain', 'lying'],
  log: ['logs', 'logged', 'logging'],
  infer: ['infers', 'inferred', 'inferring'], know: ['knows', 'knew', 'known', 'knowing'], lead: ['leads', 'led', 'leading'],
  learn: ['learns', 'learned', 'learnt', 'learning'],
  leave: ['leaves', 'left', 'leaving'], let: ['lets', 'letting'],
  lose: ['loses', 'lost', 'losing'], make: ['makes', 'made', 'making'],
  meet: ['meets', 'met', 'meeting'], offset: ['offsets', 'offset', 'offsetting'], overcome: ['overcomes', 'overcame', 'overcome', 'overcoming'],
  mean: ['means', 'meant', 'meaning'], oversee: ['oversees', 'oversaw', 'overseen', 'overseeing'], pay: ['pays', 'paid', 'paying'],
  organise: ['organises', 'organised', 'organising', 'organize', 'organizes', 'organized', 'organizing'],
  organize: ['organizes', 'organized', 'organizing', 'organise', 'organises', 'organised', 'organising'],
  practise: ['practises', 'practised', 'practising', 'practice', 'practices', 'practiced', 'practicing'],
  practice: ['practices', 'practiced', 'practicing', 'practise', 'practises', 'practised', 'practising'],
  put: ['puts', 'putting'], read: ['reads', 'reading'], run: ['runs', 'ran', 'running'],
  say: ['says', 'said', 'saying'], see: ['sees', 'saw', 'seen', 'seeing'],
  send: ['sends', 'sent', 'sending'],
  prove: ['proves', 'proved', 'proven', 'proving'], ride: ['rides', 'rode', 'ridden', 'riding'], set: ['sets', 'setting'], shed: ['sheds', 'shed', 'shedding'], show: ['shows', 'showed', 'shown', 'showing'],
  ring: ['rings', 'rang', 'rung', 'ringing'],
  recognise: ['recognises', 'recognised', 'recognising', 'recognize', 'recognizes', 'recognized', 'recognizing'],
  recognize: ['recognizes', 'recognized', 'recognizing', 'recognise', 'recognises', 'recognised', 'recognising'],
  sleep: ['sleeps', 'slept', 'sleeping'], spell: ['spells', 'spelled', 'spelt', 'spelling'], stem: ['stems', 'stemmed', 'stemming'],
  sit: ['sits', 'sat', 'sitting'],
  step: ['steps', 'stepped', 'stepping'],
  speak: ['speaks', 'spoke', 'spoken', 'speaking'], spend: ['spends', 'spent', 'spending'],
  stand: ['stands', 'stood', 'standing'], strike: ['strikes', 'struck', 'striking'], take: ['takes', 'took', 'taken', 'taking'],
  tell: ['tells', 'told', 'telling'], think: ['thinks', 'thought', 'thinking'],
  throw: ['throws', 'threw', 'thrown', 'throwing'], understand: ['understands', 'understood', 'understanding'],
  wear: ['wears', 'wore', 'worn', 'wearing'], write: ['writes', 'wrote', 'written', 'writing'],
  wake: ['wakes', 'woke', 'woken', 'waking'],
  wind: ['winds', 'wound', 'winding'],
  map: ['maps', 'mapped', 'mapping'], prefer: ['prefers', 'preferred', 'preferring'],
  confer: ['confers', 'conferred', 'conferring'], uphold: ['upholds', 'upheld', 'upholding'],
  travel: ['travels', 'traveled', 'travelled', 'traveling', 'travelling'],
  undergo: ['undergoes', 'underwent', 'undergone', 'undergoing'],
  underpin: ['underpins', 'underpinned', 'underpinning'], undertake: ['undertakes', 'undertook', 'undertaken', 'undertaking'],
  withdraw: ['withdraws', 'withdrew', 'withdrawn', 'withdrawing'], withstand: ['withstands', 'withstood', 'withstanding'],
}

const REGULAR_PHRASE_VERBS = new Set([
  'accept', 'accommodate', 'achieve', 'acquire', 'address', 'admit', 'advance', 'advise', 'afford', 'allocate', 'allay', 'amplify', 'announce', 'answer', 'appease', 'apologize',
  'apply', 'argue', 'articulate', 'ask', 'avoid', 'behave', 'boil', 'book', 'bridge', 'broker', 'calculate', 'call', 'carry', 'change', 'charge', 'check', 'clean', 'coincide',
  'attend', 'brush', 'complain', 'concede', 'confer', 'consider', 'contain', 'conduct', 'contribute', 'control', 'corroborate', 'counter', 'decide', 'decline',
  'deliver', 'delineate', 'deploy', 'devise', 'disappear', 'discern', 'discover', 'elaborate', 'elicit', 'employ', 'empower', 'encourage', 'encompass', 'end',
  'earn', 'escape', 'establish', 'explore', 'expose', 'face', 'fail', 'forge', 'frame', 'gain', 'garner', 'hand', 'help', 'highlight', 'hinge', 'illustrate', 'implement',
  'improve', 'involve', 'join', 'learn', 'leverage', 'live', 'look', 'manage', 'map', 'marginalise', 'mediate', 'mention', 'miss', 'mobilise', 'move',
  'offer', 'open', 'order', 'overlook', 'pave', 'perceive', 'perpetuate', 'persuade', 'phase', 'pick', 'play', 'point', 'posit', 'prefer',
  'prevent', 'prompt', 'provide', 'prove', 'publish', 'qualify', 'raise', 'reach', 'recognize', 'recommend', 'reduce', 'reinforce', 'refuse', 'rely', 'respond', 'save',
  'restore', 'scale', 'seem', 'share', 'shift', 'solve', 'sound', 'spark', 'stay', 'streamline', 'study', 'succeed', 'suffer', 'suggest', 'support', 'tend', 'transcend', 'try',
  'turn', 'uphold', 'use', 'visit', 'voice', 'wait', 'waste', 'work',
])

// Structural aliases such as `make ...person ...-base` are matcher-only
// metadata. Keep the verb slot deliberately finite: accepting an arbitrary
// token here would validate the exact errors these grammar cards teach
// (for example, "made everyone laughed" or "started to went").
const BASE_SLOT_VERBS = new Set([
  ...Object.keys(IRREGULAR_VERB_FORMS),
  ...REGULAR_PHRASE_VERBS,
  'close', 'cook', 'cry', 'dance', 'discuss', 'dress', 'enter', 'gasp', 'guess',
  'exercise', 'happen', 'jog', 'kiss', 'laugh', 'listen', 'need', 'paint', 'pass', 'practise',
  'proceed', 'rain', 'rest', 'revise', 'scream', 'sell', 'sing', 'smile', 'sneeze',
  'snow', 'swim', 'teach', 'wash', 'watch',
])

const ING_FINAL_BASE_WORDS = new Set([
  'bring', 'ceiling', 'cling', 'darling', 'evening', 'fling', 'king', 'morning',
  'ping', 'ring', 'sing', 'spring', 'sting', 'string', 'swing', 'thing', 'wing',
])

const STRESSED_FINAL_DOUBLING_VERBS = new Set([
  'commit', 'control', 'defer', 'occur', 'refer', 'regret', 'submit', 'transfer',
])

function doublesFinalConsonant(verb: string): boolean {
  if (STRESSED_FINAL_DOUBLING_VERBS.has(verb)) return true
  return /^[^aeiouy]*[aeiou][^aeiouywx]$/u.test(verb)
}

function regularVerbForms(verb: string): string[] {
  const third = /(?:s|x|z|ch|sh|o)$/u.test(verb) ? `${verb}es` : /[^aeiou]y$/u.test(verb) ? `${verb.slice(0, -1)}ies` : `${verb}s`
  const stem = doublesFinalConsonant(verb) ? `${verb}${verb.at(-1)}` : verb
  const past = /e$/u.test(verb) ? `${verb}d` : /[^aeiou]y$/u.test(verb) ? `${verb.slice(0, -1)}ied` : `${stem}ed`
  const ing = /ie$/u.test(verb) ? `${verb.slice(0, -2)}ying` : /e$/u.test(verb) && !/ee$/u.test(verb) ? `${verb.slice(0, -1)}ing` : `${stem}ing`
  return [third, past, ing]
}

export function deriveAcceptedForms(value: string, assumeVerb = false): string[] {
  const normalized = normalizePhrase(value)
  const [first, ...rest] = normalized.split(' ')
  if (!first || rest.length === 0) return IRREGULAR_VERB_FORMS[first]?.filter((form) => form !== first) ?? (REGULAR_PHRASE_VERBS.has(first) || assumeVerb ? regularVerbForms(first) : [])
  const verbForms = IRREGULAR_VERB_FORMS[first] ?? (REGULAR_PHRASE_VERBS.has(first) || assumeVerb ? regularVerbForms(first) : [])
  return [...new Set(verbForms.map((form) => [form, ...rest].join(' ')).filter((form) => form !== normalized))]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const lexicalToken = "[\\p{L}][\\p{L}'’-]*"
const slotStopword = '(?:and|as|at|by|carefully|for|from|here|immediately|in|into|not|of|on|or|quickly|quietly|slowly|suddenly|than|that|then|there|to|tomorrow|too|very|with|yesterday)'
const slotContentWord = `(?!(?:${slotStopword})(?=$|[^\\p{L}]))${lexicalToken}`
const personPronoun = '(?:anybody|anyone|everybody|everyone|her|him|me|nobody|no\\s+one|somebody|someone|them|us|you)'
const personSlot = `(?:${personPronoun}|${slotContentWord}(?:\\s+${slotContentWord}){0,3})`
const thingPronoun = '(?:anything|everything|nothing|something)'
const thingSlot = `(?:${thingPronoun}|${slotContentWord}(?:\\s+${slotContentWord}){0,3})`
const knownBaseSlot = `(?:${[...BASE_SLOT_VERBS].sort((left, right) => right.length - left.length).map(escapeRegExp).join('|')})`
const baseSlot = knownBaseSlot
const ingFinalBase = `(?:${[...ING_FINAL_BASE_WORDS].sort((left, right) => right.length - left.length).map(escapeRegExp).join('|')})`
const pluralCue = '(?:all|any|both|countless|eight|eighteen|eleven|few|fifteen|five|four|fourteen|many|nine|nineteen|numerous|seven|seventeen|several|six|sixteen|some|ten|thirteen|these|those|three|twelve|twenty|two|various|[2-9][0-9]*|[1-9][0-9]+)'
const pluralCountCue = '(?:both|countless|eight|eighteen|eleven|few|fifteen|five|four|fourteen|many|nine|nineteen|numerous|seven|seventeen|several|six|sixteen|ten|thirteen|these|those|three|twelve|twenty|two|various|[2-9][0-9]*|[1-9][0-9]+)'
const pluralDeterminer = '(?:her|his|my|our|the|their|your)'
const pluralPreposition = '(?:about|among|around|at|between|by|for|from|in|into|of|on|to|with|without)'

export function phraseSearchRegExp(value: string, global = false): RegExp | undefined {
  const normalized = normalizePhrase(value)
  if (!normalized || normalized.includes('...pluralverb')) return undefined
  const tokens = normalized.split(' ').map((rawToken) => {
    const token = rawToken.replace(/[!?;:,]+$/u, '')
    if (token === '...-ing') return `(?!(?:something|anything|nothing|everything|thing|${ingFinalBase})(?=$|[^\\p{L}]))${lexicalToken}ing`
    if (token === '...-base') return baseSlot
    if (token === '...person') return personSlot
    if (token === '...thing') return thingSlot
    if (token === '...pluralcue') return pluralCue
    if (token === '...pluralcountcue') return pluralCountCue
    if (token === '...pluraldet') return pluralDeterminer
    if (token === '...pluralprep') return pluralPreposition
    if (token.includes('...') || token.includes('…')) return "[\\p{L}\\p{N}'’-]+(?:\\s+[\\p{L}\\p{N}'’-]+){0,5}"
    if (token === "one's") return "(?:my|your|his|her|its|our|their|one's|[\\p{L}]+['’]s)"
    return escapeRegExp(token.replace(/\.$/u, ''))
  }).filter(Boolean)
  if (!tokens.length) return undefined
  return new RegExp(`(^|[^\\p{L}\\p{N}])(?:${tokens.join('[\\s,;:!?]+')})(?=$|[^\\p{L}\\p{N}])`, global ? 'giu' : 'iu')
}

export function isMatcherOnlyPattern(value: string): boolean {
  return /\.\.\.(?:person|thing|pluralcountcue|pluralcue|pluraldet|pluralprep|pluralverb|-base|-ing)/iu.test(value)
}

/** Returns the lexical token inside a matcher-only nominal surface pattern. */
export function matcherPatternLexicalSurface(value: string): string | undefined {
  const normalized = normalizePhrase(value)
  const prefixed = normalized.match(/^\.\.\.plural(?:countcue|cue|det|prep)\s+(.+)$/u)?.[1]
  if (prefixed) return prefixed
  return undefined
}

export function includesPhrase(response: string, phrase: string, aliases: string[] = []): boolean {
  const haystack = normalizePhrase(response)
  const expandedHaystack = normalizePhrase(expandEnglishContractions(response))
  return [phrase, ...aliases].some((candidate) => {
    const matcher = phraseSearchRegExp(candidate)
    return matcher ? matcher.test(haystack) || (expandedHaystack !== haystack && matcher.test(expandedHaystack)) : false
  })
}

export function phraseFingerprint(value: string): string {
  return normalizePhrase(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
