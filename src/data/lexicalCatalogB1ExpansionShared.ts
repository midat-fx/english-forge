import type { CatalogKind, CatalogRegister, CatalogRow } from '../domain/lexicalCatalog'
import { b1EntryContext, b1GeneratedExample } from './lexicalCatalogB1ExampleFrames'

interface ExpansionEntryOverrides {
  expression?: string
  example?: string
  exampleTranslationRu?: string
  topic?: string
}

export type ExpansionEntry = readonly [
  tailEn: string,
  translationRu: string,
  meaningEn?: string,
  overrides?: ExpansionEntryOverrides,
]

export type ExpansionGroup = readonly [
  key: string,
  headEn: string,
  kind: CatalogKind,
  topic: string,
  register: CatalogRegister,
  meaningLead: string,
  contextEn: string,
  contextRu: string,
  entries: readonly ExpansionEntry[],
  exampleMode?: 'action' | 'risk',
]

type MeaningBuilder = (tail: string) => string

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const meaningBuilders: Readonly<Record<string, MeaningBuilder>> = {
  accept: (tail) => {
    if (tail === 'responsibility') return 'agree to take responsibility for something'
    if (tail === 'a challenge') return 'agree to attempt a difficult task'
    if (/^(?:the result|criticism)$/u.test(tail)) return `acknowledge ${tail} without rejecting it`
    if (/^(?:an apology|an explanation|advice)$/u.test(tail)) return `regard ${tail} as valid or useful`
    return `agree to receive or approve ${tail}`
  },
  avoid: (tail) => {
    if (tail === 'traffic') return 'stay away from heavy traffic by choosing another route or time'
    if (/^(?:conflict|an argument|a distraction)$/u.test(tail)) return `stay away from ${tail}`
    if (tail === 'a risk') return 'prevent unnecessary exposure to a risk'
    if (/^(?:waste|an unnecessary cost)$/u.test(tail)) return `prevent ${tail}`
    return `prevent or escape ${tail}`
  },
  book: (tail) => `make an advance reservation for ${tail}`,
  cancel: (tail) => `officially stop or end ${tail}`,
  change: (tail) => {
    if (tail === 'your mind') return 'make a different decision after reconsidering'
    if (tail === 'your job') return 'leave one job and move to a different one'
    if (tail === 'your opinion') return 'adopt a different opinion after reconsidering'
    return `alter ${tail}`
  },
  check: (tail) => {
    if (tail === 'availability') return 'find out whether something is available'
    if (tail === 'your email') return 'look in your email inbox for new messages'
    if (tail === 'the balance') return 'look at the amount currently in an account'
    if (tail === 'the weather forecast') return 'look at the latest weather forecast'
    if (tail === 'your progress') return 'review how much progress you have made'
    if (tail === 'the equipment') return 'inspect equipment for problems or damage'
    return `examine ${tail} for accuracy or problems`
  },
  choose: (tail) => `select ${tail} after considering alternatives`,
  collect: (tail) => {
    if (/^(?:information|data|evidence|feedback|samples|points|donations)$/u.test(tail)) return `gather ${tail} from one or more sources`
    if (tail === 'a payment') return 'receive a payment from someone'
    return `collect ${tail} from an agreed place`
  },
  confirm: (tail) => {
    if (tail === 'attendance') return 'state that you will attend an event'
    if (tail === 'availability') return 'state that something is available'
    if (tail === 'your identity') return 'prove that you are the person you claim to be'
    if (tail === 'the details') return 'formally state that the details are correct or definite'
    if (tail === 'the decision') return 'state that a decision is final'
    return `formally state that ${tail} is correct or definite`
  },
  compare: (tail) => tail === 'performance'
    ? 'assess how well different people or systems perform'
    : `examine similarities and differences between ${tail}`,
  create: (tail) => `make or establish ${tail}`,
  deliver: (tail) => {
    if (/^(?:an order|a package|goods|equipment)$/u.test(tail)) return `transport ${tail} to its destination`
    if (/^(?:a presentation|a speech|a report|the news|feedback)$/u.test(tail)) return `present or communicate ${tail}`
    if (tail === 'training') return 'provide an organised training session'
    if (tail === 'a result') return 'produce a promised result'
    if (tail === 'a service') return 'provide a service to its users'
    if (tail === 'a project') return 'complete and submit a project'
    return `provide ${tail}`
  },
  develop: (tail) => `gradually build or improve ${tail}`,
  discuss: (tail) => `talk about ${tail} in detail`,
  explain: (tail) => `make ${tail} clear by giving details`,
  improve: (tail) => `make ${tail} better`,
  follow: (tail) => {
    if (tail === 'the route') return 'travel along the route shown'
    if (tail === 'the link') return 'open the page connected by the link'
    if (tail === 'the trend') return 'observe how a trend changes over time'
    if (tail === 'the conversation') return 'understand the conversation as it develops'
    return `act according to ${tail}`
  },
  handle: (tail) => `deal with ${tail} effectively`,
  keep: (tail) => {
    if (tail === 'a record') return 'write down information and preserve the record'
    if (tail === 'a diary') return 'write regularly about events in a diary'
    if (tail === 'your balance') return 'remain steady without falling'
    if (tail === 'your distance') return 'remain a safe or respectful distance away'
    if (tail === 'your focus') return 'continue concentrating on the task'
    if (tail === 'a secret') return 'not tell other people a piece of private information'
    if (tail === 'calm') return 'remain calm in a difficult situation'
    if (tail === 'a commitment') return 'do what you promised or agreed to do'
    if (tail === 'an appointment') return 'attend an appointment as arranged'
    if (tail === 'an account') return 'continue to maintain an active account'
    return `retain ${tail} for future use`
  },
  learn: (tail) => {
    if (tail.startsWith('from ')) return `gain useful knowledge ${tail}`
    if (tail.startsWith('how ')) return `understand ${tail}`
    if (tail.startsWith('to ')) return `gain the ability ${tail}`
    if (tail.startsWith('about ')) return `gain information ${tail}`
    if (tail.startsWith('through ')) return 'gain knowledge or skill through practice'
    if (tail.startsWith('at ')) return 'study at a pace that suits you'
    if (tail === 'by heart') return 'memorise something so that you can repeat it exactly'
    if (tail === 'a new skill') return 'acquire a new skill through study or practice'
    if (tail === 'a practical method') return 'understand how to use a practical method'
    if (tail === 'the difference') return 'understand the difference between things'
    return `gain knowledge of ${tail}`
  },
  meet: (tail) => {
    if (/^(?:a colleague|a client|a friend|the manager)$/u.test(tail)) return `come together with ${tail} to talk`
    if (tail === 'a tight deadline') return 'finish work by a demanding deadline'
    if (/^(?:a goal|a target)$/u.test(tail)) return `achieve ${tail}`
    return `satisfy ${tail}`
  },
  manage: (tail) => {
    if (/^(?:stress|conflict)$/u.test(tail)) return `deal with ${tail} effectively`
    if (tail === 'expectations') return 'guide what people expect so that it remains realistic'
    if (tail === 'risk') return 'control and reduce risk'
    if (/^(?:a team|a business)$/u.test(tail)) return `take responsibility for directing ${tail}`
    return `plan and control ${tail} effectively`
  },
  offer: (tail) => `make ${tail} available to someone`,
  organise: (tail) => {
    if (/^(?:your files|your workspace|your notes|information)$/u.test(tail)) return `put ${tail} into a clear and useful order`
    return `make practical arrangements for ${tail}`
  },
  practise: (tail) => `repeat or rehearse ${tail} in order to improve`,
  join: (tail) => {
    if (tail === 'a queue') return 'take your place at the end of a queue'
    if (/^(?:a meeting|a discussion|a class|a call|an event|a conversation)$/u.test(tail)) return `take part in ${tail}`
    return `become a member or participant in ${tail}`
  },
  receive: (tail) => `get or be given ${tail}`,
  reduce: (tail) => `lower or decrease ${tail}`,
  reach: (tail) => {
    if (/^(?:a destination|the top)$/u.test(tail)) return `arrive at ${tail}`
    if (tail === 'a customer') return 'make contact with a customer'
    if (tail === 'a wider audience') return 'communicate with a wider audience'
    return `achieve ${tail}`
  },
  save: (tail) => {
    if (tail === 'money') return 'avoid spending money unnecessarily'
    if (/^(?:time|energy)$/u.test(tail)) return `avoid wasting ${tail}`
    if (tail === 'the date') return 'reserve a date and remember it'
    if (tail === 'a place') return 'reserve a place for later'
    return `store ${tail} for future use`
  },
  share: (tail) => {
    if (/^(?:responsibility|the cost)$/u.test(tail)) return `divide ${tail} between people`
    if (/^(?:a file|a photo|a link)$/u.test(tail)) return `give other people access to ${tail}`
    return `communicate ${tail} to other people`
  },
  spend: (tail) => {
    if (/^(?:money|the budget)$/u.test(tail)) return `use ${tail} to pay for something`
    if (tail === 'energy') return 'use physical or mental energy on an activity'
    if (tail === 'time and effort') return 'devote time and effort to an activity'
    if (tail === 'time') return 'use time for a particular activity or with particular people'
    if (tail === 'your break') return 'use your break for a particular activity or for rest'
    if (tail === 'the night') return 'stay somewhere or do something for the whole night'
    return `pass ${tail} doing something or staying somewhere`
  },
  support: (tail) => {
    if (tail === 'development') return 'help development continue successfully'
    if (/^(?:a project|an idea|a decision|a cause|a plan)$/u.test(tail)) return `express approval for ${tail}`
    return `give practical or emotional help to ${tail}`
  },
  start: (tail) => `begin ${tail}`,
  track: (tail) => {
    if (/^(?:an order|a delivery|an application)$/u.test(tail)) return `follow the current status of ${tail}`
    if (tail === 'a location') return 'follow the current location of a person or object'
    if (tail === 'a goal') return 'record progress toward a goal'
    if (tail === 'a result') return 'record a result and check how it changes'
    return `record ${tail} regularly to observe changes`
  },
  try: (tail) => {
    if (tail === 'a recipe') return 'use a recipe for the first time to make a dish'
    if (tail === 'a different size') return 'put on clothing in another size to see whether it fits'
    if (tail === 'again') return 'make another attempt after the first one'
    if (/^(?:an activity|a product|an exercise|a service|a course)$/u.test(tail)) return `experience or use ${tail} to see whether it suits you`
    return `use or test ${tail} to see whether it works`
  },
  update: (tail) => `make ${tail} current by adding the latest information`,
  use: (tail) => `employ ${tail} for a particular purpose`,
  visit: (tail) => {
    if (/^(?:a doctor|your family|a customer|a friend)$/u.test(tail)) return `go to see and spend time with ${tail}`
    if (tail === 'a website') return 'open and look at a website'
    if (tail === 'the local area') return 'travel around and explore the local area'
    return `go to ${tail} and spend time there`
  },
  'bring-up': (tail) => `introduce ${tail} into a conversation`,
  'call-off': (tail) => `cancel ${tail} before it happens`,
  'fill-in': (tail) => {
    if (/^(?:a form|an application|a questionnaire|a timesheet|a survey|a report|an online profile|a feedback card)$/u.test(tail)) {
      return `complete ${tail} by adding the required information`
    }
    if (tail === 'the blank') return 'write the missing answer in a blank space'
    if (/^(?:the details|the missing information)$/u.test(tail)) return `provide ${tail} in the available spaces`
    return `write ${tail} in the correct space`
  },
  'go-over': (tail) => `carefully review ${tail}`,
  'cut-down-on': (tail) => {
    if (/^(?:sugar|caffeine|salt|processed food|alcohol)$/u.test(tail)) return `consume less ${tail}`
    if (tail === 'screen time') return 'spend less time using screens'
    if (tail === 'social media') return 'spend less time using social media'
    if (tail === 'spending') return 'spend less money'
    if (tail === 'waste') return 'produce less waste'
    if (tail === 'plastic') return 'use less plastic'
    if (tail === 'driving') return 'drive less often'
    if (tail === 'unnecessary meetings') return 'hold or attend fewer unnecessary meetings'
    if (tail === 'late nights') return 'stay up late less often'
    if (tail === 'takeaway meals') return 'eat takeaway meals less often'
    return `reduce the amount of ${tail}`
  },
  'pick-up': (tail) => {
    if (/^(?:a parcel|an order|a ticket|a child|a friend|the keys|a rental car)$/u.test(tail)) return `collect ${tail} from a place`
    if (tail === 'the phone') return 'answer a ringing phone'
    if (/^(?:a skill|a language|a habit)$/u.test(tail)) return `acquire ${tail} informally over time`
    if (tail === 'a signal') return 'detect and receive a signal'
    if (tail === 'information') return 'learn information indirectly'
    return 'buy a small amount of groceries while out'
  },
  'put-away': (tail) => tail === 'some money'
    ? 'save some money for future use'
    : `return ${tail} to a suitable storage place`,
  'run-out-of': (tail) => `have no ${tail} remaining`,
  'sort-out': (tail) => {
    if (tail === 'a problem' || tail === 'the issue') return `resolve ${tail}`
    if (tail === 'a misunderstanding') return 'clear up a misunderstanding'
    if (tail === 'the schedule') return 'organise the schedule so that it works'
    if (tail === 'the details') return 'make the details clear and final'
    if (tail === 'the transport') return 'make the necessary transport arrangements'
    if (tail === 'a complaint') return 'deal with and resolve a complaint'
    if (tail === 'the mess') return 'organise and clear the mess'
    return `resolve practical issues involving ${tail}`
  },
  'turn-down': (tail) => {
    if (/^(?:the volume|the heat|the temperature)$/u.test(tail)) return `reduce ${tail}`
    if (tail === 'the music') return 'make the music quieter'
    if (tail === 'a candidate') return 'reject a candidate for a position'
    return `refuse ${tail}`
  },
  prepare: (tail) => `make ${tail} ready in advance`,
  prevent: (tail) => `stop ${tail} from happening`,
  protect: (tail) => `keep ${tail} safe from harm`,
}

/**
 * Builds curated verb–noun and phrasal-verb patterns. Each group selects a
 * sentence purpose that is safe for every entry in that pattern; individual
 * entries can still provide a sense-specific definition when a verb is
 * polysemous. Russian contexts are punctuated as complete clauses here.
 */
export function expansionRows(groups: readonly ExpansionGroup[], groupOffset: number): CatalogRow[] {
  return groups.flatMap(([key, headEn, kind, topic, register, meaningLead, contextEn, contextRu, entries, exampleMode = 'action'], groupIndex) =>
    entries.map(([tailEn, translationRu, meaningOverride, overrides], entryIndex) => {
      const expression = overrides?.expression ?? `${headEn} ${tailEn}`.trim()
      const [renderedContextEn, renderedContextRu] = b1EntryContext(key, tailEn, contextEn, contextRu)
      const [generatedExample, generatedExampleTranslationRu] = b1GeneratedExample(
        key,
        exampleMode,
        expression,
        translationRu,
        renderedContextEn,
        renderedContextRu,
        groupOffset + groupIndex,
        entryIndex,
      )
      const example = overrides?.example ?? generatedExample
      const exampleTranslationRu = overrides?.exampleTranslationRu ?? generatedExampleTranslationRu
      const defaultMeaning = meaningBuilders[key]?.(tailEn) ?? `${meaningLead.replace(/[:;,]\s*$/u, '')} ${tailEn}`

      return [
        `x${groupOffset + groupIndex + 1}-${entryIndex + 1}-${slugify(key)}-${slugify(tailEn)}`,
        expression,
        kind,
        translationRu,
        meaningOverride ?? defaultMeaning,
        example,
        exampleTranslationRu,
        overrides?.topic ?? topic,
        register,
      ] satisfies CatalogRow
    }),
  )
}
