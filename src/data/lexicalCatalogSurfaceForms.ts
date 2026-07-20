import { deriveAcceptedForms, deriveEnglishSpellingVariants, expandEnglishContractions } from '../domain/normalization'
import type { CatalogKind } from '../domain/lexicalCatalog'
import { catalogNominalCollocationPatterns } from './lexicalCatalogNominalForms'
import { catalogWordAcceptedPatterns, catalogWordFormDecision } from './lexicalCatalogWordForms'

// This list is only the opt-in path for a new lexical verb whose expression head
// is not in normalization's reviewed verb lexicon yet. Known expression heads
// derive by default; explicit item-id exceptions below protect noun homographs.
const VERB_DEFINITION_HEADS = new Set([
  'accept', 'act', 'adapt', 'admire', 'agree', 'alter', 'answer', 'ask', 'assign', 'be', 'become', 'believe', 'bring', 'change', 'check', 'choose', 'clean', 'communicate', 'copy',
  'achieve', 'arrange', 'arrive', 'begin', 'cause', 'collect', 'combine', 'compare', 'consider', 'consume', 'continue', 'control', 'cook', 'create', 'deal', 'decide', 'describe', 'develop', 'do',
  'disagree', 'discover', 'discuss', 'draw', 'emphasise', 'encourage', 'enjoy', 'examine', 'expect', 'experience', 'express',
  'end', 'explain', 'fail', 'feel', 'find', 'finish', 'fix', 'formally', 'gain', 'get', 'give', 'go', 'gradually', 'harm', 'have', 'help', 'hold', 'improve', 'increase', 'injure',
  'gather', 'identify', 'include', 'investigate', 'join', 'judge', 'keep', 'know', 'let', 'look', 'maintain', 'make', 'manage', 'mention', 'move', 'necessarily', 'negotiate', 'notice',
  'limit', 'name', 'obtain', 'officially', 'openly', 'organise', 'pay', 'perform', 'plan', 'predict', 'prepare', 'present', 'prevent', 'process', 'produce', 'protect', 'prove', 'provide', 'publicly', 'put', 'question',
  'reach', 'receive', 'recognise', 'reduce', 'refuse', 'regard', 'remain', 'remove', 'request', 'reserve', 'return', 'reveal', 'rise', 'say', 'see', 'shape', 'share',
  'repeat', 'satisfy', 'secure', 'show', 'speak', 'spend', 'start', 'state', 'stay', 'stop', 'study', 'succeed', 'successfully', 'suggest', 'support', 'systematically', 'take', 'talk', 'tell',
  'think', 'travel', 'understand', 'use', 'view', 'visit', 'walk', 'wash', 'watch', 'work', 'write',
])

const NON_VERB_ITEM_IDS = new Set([
  'lex-a2-change', 'lex-a2-map', 'lex-a2-break', 'lex-a2-wind',
  'lex-a2-cost', 'lex-a2-bridge', 'lex-a2-fit',
  'lex-a2-hand-luggage', 'lex-a2-live-music', 'lex-a2-full-time-job', 'lex-a2-part-time-job',
  'lex-a2-medical-help', 'lex-b2-waste-management',
])

const NON_VERB_EXPRESSIONS = new Set(['full-time job', 'hand luggage', 'live music', 'medical help', 'part-time job', 'waste management'])

const PRODUCTIVE_GRAMMAR_FRAME_HEADS = new Set([
  'advise', 'allow', 'apologise', 'appear', 'ask', 'decide', 'enjoy', 'feel', 'find', 'finish', 'forget',
  'get', 'have', 'hope', 'imagine', 'insist', 'keep', 'learn', 'like', 'make', 'manage', 'mean', 'need',
  'persuade', 'plan', 'prefer', 'prevent', 'remember', 'remind', 'start', 'stop', 'succeed', 'suggest',
  'try', 'want', 'warn',
])

function finiteBeForms(expression: string): string[] {
  const normalized = expression.trim().toLocaleLowerCase('en-US')
  if (!normalized.startsWith('be ')) return []
  const tail = normalized.slice(3)
  return [
    ...['am', 'is', 'are', 'was', 'were'].map((form) => `${form} ${tail}`),
    ...(/(?:^|\s)no(?:\s|$)/u.test(tail) ? [] : ['am not', 'is not', 'are not', 'was not', 'were not'].map((form) => `${form} ${tail}`)),
    ...(normalized === 'be going to' ? [] : ['been', 'being'].map((form) => `${form} ${tail}`)),
    ...["I'm", "you're", "he's", "she's", "it's", "we're", "they're"].map((form) => `${form} ${tail}`),
  ]
}

function expandContractions(expression: string): string[] {
  const apostrophesNormalized = expression.replace(/[‘’]/gu, "'")
  const expanded = expandEnglishContractions(apostrophesNormalized)
  return expanded !== apostrophesNormalized ? [expanded] : []
}

// Authored structural alternatives for chunks whose natural surface form contains
// an object, modifier, expansion, or other material inside the canonical expression.
const SURFACE_PATTERNS: Record<string, string[]> = {
  'do some exercise': ['do some gentle exercise'],
  'charge a phone': ['charge my phone', "charge one's phone"],
  'visit a website': ['visit the website'],
  'change a plan': ['change our plan'],
  'wake up': ['woke me up'],
  'give back': ['give your book back'],
  'take back': ['took the broken lamp back'],
  'call back': ['call you back'],
  'show someone around': ['show you around', 'show ...person around'],
  'put down': ['put the box down'],
  'take out': ['took his wallet out'],
  'What time does it leave?': ['What time does the last train leave?'],
  'What time does it arrive?': ['What time does the coach arrive in Leeds?'],
  'A ticket to ..., please.': ['A return ticket to Brighton, please.'],
  'Is this spicy?': ['Is this too spicy for children?'],
  'make a noise': ['makes a strange noise'],
  'turn off': ['turn ... off'],
  'pick up': ['pick ... up'],
  'put away': ['put ... away'],
  'get along with': ['get along ... with'],
  'take a break': ['take ... break'],
  'catch a bus': ['catch ... bus'],
  'miss a train': ['miss ... train'],
  'spend time': ['spend ... time'],
  "That's a shame.": ['That is a shame.'],
  "Let's ...": ['Let us ...'],
  "I'd rather ...": ['I would rather ...'],
  "don't have to": ['do not have to', 'does not have to', 'did not have to'],
  'used to': ['did not use to', 'did ...person use to', "didn't ...person use to"],
  'the flight is delayed': ['the flight was delayed', 'the flight has been delayed'],
  'the flight is cancelled': ['the flight was cancelled', 'the flight has been cancelled'],
  'How much is it?': ['How much is ...?'],
  'meet a deadline': ['meet ... deadline'],
  'solve a problem': ['solve ... problem'],
  'break a habit': ['break ... habit'],
  'keep a promise': ['keep ... promise'],
  'be likely to': ['be ... likely to'],
  'be worth doing': ['be worth ...-ing'],
  'have difficulty doing': ['have difficulty ...-ing'],
  'give someone a hand': ['give me a hand', 'give you a hand', 'give ...person a hand'],
  'pay back': ['pay you back', 'pay me back', 'pay them back'],
  'send back': ['send the jacket back'],
  'leave behind': ['leave anything behind'],
  'reach a goal': ['reach our goal', 'reach your goal', 'reach their goal'],
  'let down': ['let the team down'],
  'earn a living': ['earns a living'],
  'follow instructions': ['follow the instructions'],
  'develop a skill': ['develop ... skill'],
  'keep an appointment': ['keep your appointment'],
  'make a comment': ['made a helpful comment'],
  'make a point': ['make an important point'],
  'offer advice': ['offer ... advice'],
  'persuade someone to': ['persuade ...person to'],
  'make someone do': ['make everyone laugh', 'make ...person ...-base'],
  'learn by heart': ['learn ...thing by heart'],
  'write something down': ['write ...thing down'],
  'knock someone down': ['knock ...person down'],
  'imagine doing': ['imagine ...-ing'],
  'finish writing': ['finish ...-ing'],
  'stop doing something': ['stop ...-ing'],
  'start doing something': ['start ...-ing', 'start to ...-base'],
  'keep someone waiting': ['keep ...person ...-ing'],
  'allow someone to': ['allow ...person to'],
  'stop someone from doing': ['stop ...person from ...-ing'],
  'have trouble doing': ['have trouble ...-ing'],
  'ask someone to': ['ask ...person to'],
  'advise someone to': ['advise ...person to'],
  'warn someone not to': ['warn ...person not to'],
  'remind me to': ['remind ...person to'],
  'make someone feel welcome': ['make ...person feel welcome'],
  'There is no point in ...': ['There is no point in arguing'],
  'take into account': ['take ... into account'],
  'have an impact on': ['have ... impact on'],
  'play a role in': ['play ... role in'],
  'raise a concern': ['raise concerns', 'raise ... concern', 'raise ... concerns'],
  'reach a target': ['reach ... target', 'reached its fundraising target'],
  'meet the requirements': ['meet ... requirements'],
  'take an approach': ['take ... approach'],
  'strike a balance': ['strike ... balance'],
  'make a difference': ['make ... difference'],
  'address an issue': ['address ... issue'],
  'pave the way for': ['pave ... way for'],
  'take for granted': ['take ... for granted'],
  'draw a distinction': ['draw ... distinction'],
  'undertake a review': ['undertook ... review', 'undertaken ... review'],
  'withdraw support': ['withdrew support', 'withdrawn support'],
  'not so much X as Y': ['not so much ... as ...'],
  'compel action': ['compelled action'],
  'marginalise a group': ['marginalise ...'],
  'an adverse consequence': ['adverse consequence', 'have adverse consequences'],
  'a credible threat': ['credible threat'],
  'an ethical dilemma': ['ethical dilemma', 'ethical ... dilemma'],
  'that remains to be seen': ['remains to be seen'],
  'be under no illusion': ['am under no illusion', 'is under no illusion', 'are under no illusion', 'was under no illusion', 'were under no illusion'],
  'implement a measure': ['implement measures', 'implemented measures'],
  'uphold a standard': ['uphold standards', 'uphold ... standards', 'upholds standards', 'upheld standards'],
  'amplify a voice': ['amplify voices', 'amplifies voices', 'amplified voices'],
  'articulate a concern': ['articulate concerns', 'articulates concerns', 'articulated concerns'],
  'empower a community': ['empower communities', 'empowers communities', 'empowered communities'],
  'perpetuate a stereotype': ['perpetuate stereotypes', 'perpetuates stereotypes', 'perpetuated stereotypes'],
  'voice a reservation': ['voice reservations', 'voices reservations', 'voiced reservations'],
  'put down to': ['put the decline down to'],
  'dismiss a claim': ['dismiss the claim'],
  'formulate a hypothesis': ['formulate a testable hypothesis'],
  'illustrate a point': ['illustrates the author’s central point'],
  'overlook a limitation': ['overlooks a significant limitation'],
  'draw an inference': ['draw a reliable inference'],
  'warrant a conclusion': ['warrant a sweeping conclusion'],
  'withstand scrutiny': ['withstand independent scrutiny'],
  'call into question': ['call the official figures into question'],
  'anticipate demand': ['anticipate seasonal demand'],
  'avert a crisis': ['avert a prolonged constitutional crisis'],
  'bolster confidence': ['bolster public confidence'],
  'circumvent a rule': ['circumvent the ownership rule'],
  'deploy resources': ['deployed additional resources'],
  'enforce a regulation': ['enforce the regulation'],
  'leverage expertise': ['leverages local expertise'],
  'offset costs': ['offset the initial installation costs'],
  'oversee an operation': ['oversee the entire operation'],
  'streamline a process': ['streamlined the process'],
  'address a shortfall': ['address the staffing shortfall'],
  'bridge a gap': ['bridge the gap'],
  'sustainable growth': ['sustainable economic growth'],
  'bring forward': ['brought the review forward'],
  'articulate a position': ['articulate a coherent position'],
  'assert authority': ['assert its authority'],
  'concede a point': ['conceded the point'],
  'counter an argument': ['counters this argument'],
  'make a case for': ['makes a strong case for'],
  'qualify a statement': ['qualified her statement'],
  'reject a premise': ['reject the premise'],
  'spell out the implications': ['spell out the legal implications'],
  'defend a stance': ['defend her stance'],
  'alienate an audience': ['alienate a general audience'],
  'allay fears': ['allay public fears'],
  'confer status': ['confers protected status'],
  'elicit a response': ['elicited a surprisingly candid response'],
  'exert influence': ['exert considerable influence'],
  'mediate a dispute': ['mediated the dispute'],
  'perceive a threat': ['perceived the monitoring system as a threat'],
  'reinforce a perception': ['reinforced the perception'],
  'restore trust': ['restore public trust'],
  'transcend boundaries': ['transcends national and ideological boundaries'],
  'the social fabric': ['the region’s social fabric'],
  occasion: ['on special occasions'],
  contingency: ['contingencies arising'],
  stakeholder: ['Stakeholders were consulted'],
}

function definitionHasVerbSense(meaningEn?: string): boolean {
  const head = meaningEn?.trim().toLocaleLowerCase('en-US').match(/^[a-z-]+/u)?.[0]
  return Boolean(head && VERB_DEFINITION_HEADS.has(head))
}

export function catalogAcceptedForms(expression: string, kind?: CatalogKind, meaningEn?: string, itemId?: string): string[] {
  const authored = SURFACE_PATTERNS[expression] ?? []
  const contractionExpansions = expandContractions(expression)
  const wordForms = kind === 'word' && itemId
    ? catalogWordAcceptedPatterns(expression, meaningEn, itemId)
    : []
  const nominalCollocationForms = kind === 'collocation' && itemId
    ? catalogNominalCollocationPatterns(expression, meaningEn, itemId)
    : []
  const reviewedWordDecision = kind === 'word' && itemId ? catalogWordFormDecision(itemId) : 'none'
  const first = expression.trim().split(/\s+/u)[0]?.toLocaleLowerCase('en-US')
  const recognizedExpressionHead = deriveAcceptedForms(expression).length > 0
  const lexicalKind = kind === 'word' || kind === 'collocation'
  const explicitNonVerb = Boolean(itemId && NON_VERB_ITEM_IDS.has(itemId))
    || NON_VERB_EXPRESSIONS.has(expression)
    || (reviewedWordDecision !== 'none' && !definitionHasVerbSense(meaningEn))
    || (kind === 'word' && !recognizedExpressionHead && Boolean(meaningEn) && !definitionHasVerbSense(meaningEn))
  const semanticVerb = lexicalKind
    && !explicitNonVerb
    && (recognizedExpressionHead || definitionHasVerbSense(meaningEn))
  const grammarBeFrame = kind === 'grammar_frame' && first === 'be'
  const productiveGrammarFrame = kind === 'grammar_frame' && PRODUCTIVE_GRAMMAR_FRAME_HEADS.has(first)
  const deriveCanonical = kind === undefined || kind === 'phrasal_verb' || semanticVerb || productiveGrammarFrame
  const assumeVerb = kind === 'phrasal_verb' || productiveGrammarFrame || (semanticVerb && !recognizedExpressionHead)
  const forms = [
    ...(grammarBeFrame ? finiteBeForms(expression) : []),
    ...(deriveCanonical ? deriveAcceptedForms(expression, assumeVerb) : []),
    ...contractionExpansions,
    ...wordForms,
    ...nominalCollocationForms,
    ...authored,
    ...authored.flatMap((pattern) => grammarBeFrame && pattern.trim().toLocaleLowerCase('en-US').startsWith('be ')
      ? finiteBeForms(pattern)
      : []),
    ...authored.flatMap((pattern) => deriveCanonical && pattern.trim().split(/\s+/u)[0]?.toLocaleLowerCase('en-US') === first
      ? deriveAcceptedForms(pattern, assumeVerb)
      : []),
  ]
  return [...new Set([
    ...forms,
    ...[expression, ...forms].flatMap(deriveEnglishSpellingVariants),
  ].filter((form) => form !== expression))]
}
