/**
 * Cross-level collisions intentionally kept at their earliest useful CEFR
 * level. Tests compare the assembled catalog globally, so additions cannot
 * silently reintroduce a duplicate.
 */
export const B1_LOWER_LEVEL_EXPRESSIONS = [
  'take care of', 'make progress', 'make a decision', 'solve a problem', 'although', 'however',
  'in my opinion', 'experience', 'environment', 'disappointed', 'arrange a meeting', 'arrange a visit',
  'attend a meeting', 'book a flight', 'book a table', 'cancel a booking', 'choose a date', 'compare prices',
  'join a club', 'keep a secret', 'keep the receipt', 'keep calm', 'learn by heart', 'pay the rent', 'plan a trip',
  'practise speaking', 'save money', 'spend time', 'take a photo', 'take a bus', 'take a train', 'take an exam',
  'take medicine', 'visit a website', 'write a report', 'ask for directions', 'ask for the bill', 'check in online',
  'fill in a form', 'audience', 'competition', 'knowledge', 'performance', 'available', 'patient', 'allow',
  // Same lexical sense and complementation already appear in the A2
  // `pay attention` card and its example (`pay attention to ...`).
  'pay attention to',
] as const

export const B2_LOWER_LEVEL_EXPRESSIONS = [
  'unlikely', 'accurate', 'convenient', 'essential', 'reasonable', 'reliable', 'face a challenge', 'break down',
  'deal with', 'be supposed to', 'be likely to', 'even though', 'unless', 'To be honest, ...',
] as const

export const C1_LOWER_LEVEL_EXPRESSIONS = [
  'address an issue', 'in other words', 'facilitate', 'challenge an assumption', 'imply', 'justify', 'criterion',
  'framework', 'scope', 'rule out', 'regardless of', 'allocate resources', 'constraint', 'incentive', 'regulation',
  'admittedly', 'all things considered', 'by comparison', 'in principle', 'incidentally', 'whether or not',
  'I take your point',
] as const
