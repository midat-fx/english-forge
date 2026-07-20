import type { CEFRLevel } from '../domain/types'

export interface ListeningPrompt {
  id: string
  level: CEFRLevel
  text: string
  question: string
  choices: [string, string, string]
  answerIndex: 0 | 1 | 2
}

const prompts = {
  A2: [
    ['train', 'The train leaves at quarter past eight, so please arrive ten minutes early.', 'When does the train leave?', ['At 7:45', 'At 8:15', 'At 8:30'], 1],
    ['shopping', 'I bought some fresh bread, but I forgot to get any milk.', 'What did the speaker forget to buy?', ['Bread', 'Milk', 'Juice'], 1],
    ['weather', 'It was raining this morning, so we decided to take the bus.', 'Why did they take the bus?', ['It was raining', 'They were late', 'The train was full'], 0],
    ['appointment', 'My dentist is on the second floor, next to the small pharmacy.', 'Where is the dentist?', ['Behind the station', 'On the first floor', 'Next to the pharmacy'], 2],
    ['weekend', 'We are meeting our friends in the park after lunch on Saturday.', 'When are they meeting their friends?', ['Before breakfast', 'After lunch on Saturday', 'On Sunday evening'], 1],
  ],
  B1: [
    ['deadline', 'I nearly missed the deadline because I had misunderstood one small part of the instructions.', 'What caused the problem?', ['A late train', 'A misunderstood instruction', 'A broken computer'], 1],
    ['routine', 'Working from home has made it easier for me to plan my day.', 'What became easier?', ['Planning the day', 'Finding a new home', 'Travelling to work'], 0],
    ['journey', 'By the time we reached the hotel, the restaurant had already closed.', 'What was closed when they arrived?', ['The hotel', 'The station', 'The restaurant'], 2],
    ['advice', 'If I were in your position, I would ask for a little more time.', 'What does the speaker advise?', ['Ask for more time', 'Refuse the task', 'Start a new job'], 0],
    ['repair', 'They offered to replace the screen, although the warranty had just expired.', 'What did they offer to replace?', ['The warranty', 'The screen', 'The whole device'], 1],
  ],
  B2: [
    ['proposal', 'Although the proposal seemed risky at first, the revised figures made it worth considering.', "What changed the speaker's view?", ['The revised figures', 'A new deadline', 'The original risk'], 0],
    ['feedback', 'The feedback was more encouraging than we had expected, despite a few specific concerns.', 'How was the feedback overall?', ['Entirely negative', 'More encouraging than expected', 'Impossible to understand'], 1],
    ['policy', 'Unless the policy is explained clearly, people may interpret it in very different ways.', 'What could prevent different interpretations?', ['A shorter policy', 'A private meeting', 'A clear explanation'], 2],
    ['research', 'The initial results appear promising, but a larger sample would make the conclusion more reliable.', 'What would strengthen the conclusion?', ['A larger sample', 'A shorter report', 'Fewer results'], 0],
    ['negotiation', 'Both sides were willing to compromise, which prevented the discussion from breaking down.', 'Why did the discussion continue?', ['The issue disappeared', 'Both sides accepted compromise', 'One side left'], 1],
  ],
  C1: [
    ['evidence', 'The evidence is far from conclusive, and several witnesses have since revised their accounts. Even so, the pattern it reveals raises questions that should not be dismissed simply because the investigation remains incomplete.', 'What stance does the speaker take?', ['The evidence proves everything', 'The questions still deserve attention', 'The evidence should be ignored'], 1],
    ['assumption', 'At first glance, the discrepancy looks like a minor exception to an otherwise reliable pattern. On closer inspection, however, it may undermine the central assumption on which the entire argument depends.', 'What may the discrepancy do?', ['Support the assumption', 'Replace the evidence', 'Weaken the central assumption'], 2],
    ['tradeoff', 'The proposed subsidy could deliver a welcome short-term boost to employment. Before endorsing it, however, we should weigh that gain against the less visible consequences of postponing structural reform.', 'What must be considered alongside the short-term gain?', ['The consequences of delay', 'Only the immediate cost', "A different speaker's opinion"], 0],
    ['interpretation', 'Her interpretation offers a plausible explanation for the earlier results, and it accounts for several anomalies that rival theories overlook. The difficulty is that it cannot easily be reconciled with the findings published last month.', 'What is the main reservation?', ['The interpretation is impossible', 'It conflicts with recent findings', 'There are no findings'], 1],
    ['accountability', 'Publishing the minutes would not eliminate disagreement, since the committee members interpret the evidence differently. It would, however, make it easier to establish who supported each decision and on what grounds.', 'What could publishing the minutes improve?', ['Complete agreement', 'The speed of reform', 'Accountability'], 2],
  ],
} as const

function materialize(level: CEFRLevel): ListeningPrompt[] {
  return prompts[level].map(([id, text, question, choices, answerIndex]) => ({
    id: `${level.toLocaleLowerCase('en-US')}-${id}`,
    level,
    text,
    question,
    choices: [...choices],
    answerIndex,
  }))
}

export const LISTENING_PROMPTS_BY_LEVEL: Record<CEFRLevel, readonly ListeningPrompt[]> = {
  A2: materialize('A2'),
  B1: materialize('B1'),
  B2: materialize('B2'),
  C1: materialize('C1'),
}

export const PLACEMENT_LISTENING_PROMPTS: readonly ListeningPrompt[] = (['A2', 'B1', 'B2', 'C1'] as const)
  .flatMap((level) => LISTENING_PROMPTS_BY_LEVEL[level].slice(0, 2))
