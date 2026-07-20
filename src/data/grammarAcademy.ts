import type { GrammarLesson, GrammarQuizQuestion } from '../domain/grammarAcademy'
import { grammarAcademyExpansionLessons } from './grammarAcademyExpansion'

type QuizSeed = readonly [
  prompt: string,
  choices: readonly [string, string, string],
  answerIndex: 0 | 1 | 2,
  explanation: string,
]

type LessonSeed = Omit<GrammarLesson, 'quiz'> & {
  quiz: readonly [QuizSeed, QuizSeed, QuizSeed]
}

function lesson(seed: LessonSeed): GrammarLesson {
  const quiz = seed.quiz.map<GrammarQuizQuestion>((item, index) => ({
    id: `${seed.id}-q${index + 1}`,
    prompt: item[0],
    choices: [...item[1]],
    answerIndex: item[2],
    explanation: item[3],
  })) as GrammarLesson['quiz']
  return { ...seed, quiz }
}

const coreGrammarAcademyLessons: readonly GrammarLesson[] = [
  lesson({
    id: 'a2-present-simple', level: 'A2', category: 'tenses', title: 'Present simple: routines and facts',
    explanation: 'Use the present simple for repeated actions, stable situations and facts. Add -s or -es after he, she and it. Use do or does to make most questions and negatives.',
    formula: 'subject + base verb (he/she/it: verb-s); do/does + subject + base verb?',
    examples: ['I check my messages after breakfast.', 'Mina works near the station.', 'Does this shop close at six?'],
    commonMistake: { wrong: 'He work from home.', correct: 'He works from home.', note: 'A third-person singular subject needs -s in an affirmative sentence.' },
    quiz: [
      ['Choose the correct sentence.', ['My brother cook every day.', 'My brother cooks every day.', 'My brother is cook every day.'], 1, 'Brother is third-person singular, so cook becomes cooks.'],
      ['Complete: How often ___ you exercise?', ['do', 'does', 'are'], 0, 'Use do with the subject you in a present-simple question.'],
      ['Complete: Sara ___ not eat meat.', ['do', 'is', 'does'], 2, 'Use does not with he, she or it; the main verb stays in its base form.'],
    ],
  }),
  lesson({
    id: 'a2-present-continuous', level: 'A2', category: 'tenses', title: 'Present continuous: now and temporary situations',
    explanation: 'Use the present continuous for an action happening now or around now, and for a temporary situation. The -ing form cannot stand alone: it needs am, is or are.',
    formula: 'subject + am/is/are + verb-ing',
    examples: ['I am waiting outside now.', 'They are staying with friends this week.', 'Why is Leo laughing?'],
    commonMistake: { wrong: 'We watching a film.', correct: 'We are watching a film.', note: 'The continuous form needs a form of be before verb-ing.' },
    quiz: [
      ['Complete: Listen! Someone ___ at the door.', ['knocks', 'is knocking', 'knocking'], 1, 'Listen signals an action in progress, so use is knocking.'],
      ['Which sentence describes a temporary situation?', ['I live in Ankara.', 'I am living with my cousin this month.', 'I living with my cousin.'], 1, 'The present continuous can mark a situation limited to the current period.'],
      ['Complete: We ___ dinner right now.', ['are making', 'make', 'is making'], 0, 'Right now calls for are + making with we.'],
    ],
  }),
  lesson({
    id: 'a2-present-simple-v-continuous', level: 'A2', category: 'tenses', title: 'Present simple or present continuous?',
    explanation: 'Choose the simple form for a routine or fact and the continuous form for an activity in progress or a temporary change. Time expressions often reveal the intended meaning.',
    formula: 'routine/fact → present simple; now/temporary → am/is/are + verb-ing',
    examples: ['I usually walk, but today I am taking the bus.', 'The café opens at eight.', 'Business is improving this month.'],
    commonMistake: { wrong: 'I am going to work by train every day.', correct: 'I go to work by train every day.', note: 'Every day describes a routine, so the simple form is the natural choice.' },
    quiz: [
      ['Complete: Tom usually ___ early.', ['is arriving', 'arrives', 'arrive'], 1, 'Usually marks a routine; Tom requires arrives.'],
      ['Complete: This week, I ___ the early shift.', ['work', 'am working', 'works'], 1, 'This week presents the shift as temporary.'],
      ['Choose the best pair: She normally ___ tea, but today she ___ coffee.', ['drinks / is having', 'is drinking / has', 'drink / having'], 0, 'The first action is usual; the second is temporary today.'],
    ],
  }),
  lesson({
    id: 'a2-past-simple', level: 'A2', category: 'tenses', title: 'Past simple: finished events',
    explanation: 'Use the past simple for a completed event at a finished past time. Regular verbs take -ed; irregular verbs have special forms. After did or did not, use the base verb.',
    formula: 'subject + past form; did + subject + base verb?; subject + did not + base verb',
    examples: ['We moved here in 2023.', 'I saw Deniz yesterday.', 'Did you enjoy the concert?'],
    commonMistake: { wrong: 'Did you went out?', correct: 'Did you go out?', note: 'Did already carries the past meaning, so the main verb returns to its base form.' },
    quiz: [
      ['Complete: I ___ my keys last night.', ['lose', 'lost', 'did lost'], 1, 'Lost is the irregular past form of lose.'],
      ['Complete: They did not ___ the message.', ['received', 'receive', 'receiving'], 1, 'Use the base form after did not.'],
      ['Which question is correct?', ['Where you stayed?', 'Where did you stayed?', 'Where did you stay?'], 2, 'A past-simple question uses did + subject + base verb.'],
    ],
  }),
  lesson({
    id: 'a2-past-continuous', level: 'A2', category: 'tenses', title: 'Past continuous and interruptions',
    explanation: 'Use was or were plus verb-ing for an action in progress at a past moment. A shorter past-simple event can interrupt or occur during that background action.',
    formula: 'subject + was/were + verb-ing; while + past continuous, past simple',
    examples: ['I was cooking when the lights went out.', 'They were talking at ten o’clock.', 'While we were walking, it started to snow.'],
    commonMistake: { wrong: 'I was drive when she called.', correct: 'I was driving when she called.', note: 'Was and were must be followed by the -ing form.' },
    quiz: [
      ['Complete: At 8 p.m., we ___ home.', ['were driving', 'drove', 'was driving'], 0, 'The action was in progress at a stated past time.'],
      ['Complete: I ___ when the alarm rang.', ['slept', 'was sleeping', 'am sleeping'], 1, 'The longer background action takes the past continuous.'],
      ['Choose the correct sentence.', ['While I studied, Ali was arriving.', 'While I was studying, Ali arrived.', 'While I am studying, Ali arrived.'], 1, 'Use past continuous for the background and past simple for the shorter event.'],
    ],
  }),
  lesson({
    id: 'a2-present-perfect-basics', level: 'A2', category: 'tenses', title: 'Present perfect: experience and recent results',
    explanation: 'Use have or has plus a past participle for life experience with no finished time, or a past action whose result matters now. Do not combine it with a finished time such as yesterday.',
    formula: 'subject + have/has + past participle',
    examples: ['I have visited Georgia twice.', 'She has lost her wallet, so she cannot pay.', 'Have you ever tried surfing?'],
    commonMistake: { wrong: 'I have met him yesterday.', correct: 'I met him yesterday.', note: 'Yesterday is a finished past time, so use the past simple.' },
    quiz: [
      ['Complete: Ela ___ never flown before.', ['has', 'did', 'is'], 0, 'Has + past participle forms the present perfect with she.'],
      ['Choose the natural sentence.', ['I have finished it last night.', 'I finished it last night.', 'I have finish it last night.'], 1, 'A finished time expression takes the past simple.'],
      ['Complete: ___ you ever eaten Korean food?', ['Did', 'Have', 'Are'], 1, 'Ever with general life experience normally uses the present perfect.'],
    ],
  }),
  lesson({
    id: 'a2-future-choices', level: 'A2', category: 'tenses', title: 'Future basics: will, going to and arrangements',
    explanation: 'Use will for a decision made now or a prediction based mainly on opinion. Use going to for an earlier intention or visible evidence. Use the present continuous for a fixed personal arrangement.',
    formula: 'will + base verb; am/is/are going to + base verb; am/is/are + verb-ing + future time',
    examples: ['I’ll answer the phone.', 'Look at those clouds—it is going to rain.', 'We are meeting the designer on Friday.'],
    commonMistake: { wrong: 'I will to call you.', correct: 'I will call you.', note: 'Will is followed directly by the base verb, without to.' },
    quiz: [
      ['The doorbell rings. Complete: I ___ get it!', ['am going to', 'will', 'am'], 1, 'Will fits a spontaneous decision made at the moment of speaking.'],
      ['You already bought the paint. Complete: We ___ decorate the room.', ['are going to', 'will to', 'going'], 0, 'The existing plan makes going to appropriate.'],
      ['Complete: I ___ the dentist at 3 p.m. tomorrow; it is booked.', ['saw', 'am seeing', 'will seeing'], 1, 'A booked personal arrangement can use the present continuous.'],
    ],
  }),
  lesson({
    id: 'a2-question-forms', level: 'A2', category: 'questions', title: 'Question forms and word order',
    explanation: 'Put an auxiliary before the subject in most questions. Use do, does or did when there is no other auxiliary. A question word normally comes first.',
    formula: 'question word + auxiliary + subject + main verb?',
    examples: ['Where do you work?', 'Why did she leave?', 'Can they join us?'],
    commonMistake: { wrong: 'Where you do live?', correct: 'Where do you live?', note: 'The auxiliary comes before the subject.' },
    quiz: [
      ['Choose the correct question.', ['What does this word mean?', 'What this word does mean?', 'What means this word?'], 0, 'Use question word + does + subject + base verb.'],
      ['Complete: When ___ the train arrive?', ['does', 'is', 'has'], 0, 'Arrive is a main verb in the present simple, so the question needs does.'],
      ['Choose the correct order.', ['Why are they laughing?', 'Why they are laughing?', 'Why do they laughing?'], 0, 'The existing auxiliary are moves before the subject they.'],
    ],
  }),
  lesson({
    id: 'a2-articles', level: 'A2', category: 'nouns-and-articles', title: 'Articles: a, an, the and no article',
    explanation: 'Use a or an for one non-specific countable thing. Use the when the listener can identify the thing. Use no article for plural or uncountable nouns when speaking generally.',
    formula: 'a/an + singular countable noun; the + identifiable noun; plural/uncountable general noun → no article',
    examples: ['I need a charger.', 'Please close the window.', 'Music helps me concentrate.'],
    commonMistake: { wrong: 'She is engineer.', correct: 'She is an engineer.', note: 'A singular countable job noun needs an article.' },
    quiz: [
      ['Complete: Could I borrow ___ pen?', ['a', 'an', '—'], 0, 'Pen is a singular countable noun introduced for the first time.'],
      ['Complete: ___ moon looks bright tonight.', ['A', 'The', '—'], 1, 'The moon is uniquely identifiable in this context.'],
      ['Complete: ___ information is easy to find online.', ['An', 'A', '—'], 2, 'Information is uncountable and the sentence is general.'],
    ],
  }),
  lesson({
    id: 'a2-countable-quantifiers', level: 'A2', category: 'nouns-and-articles', title: 'Countable nouns, uncountable nouns and quantity',
    explanation: 'Use many and a few with plural countable nouns; use much and a little with uncountable nouns. Some works mainly in affirmative sentences, while any is common in questions and negatives.',
    formula: 'many/a few + plural countable; much/a little + uncountable; some/any + either type',
    examples: ['We have a few spare chairs.', 'There is a little rice left.', 'Do you have any advice?'],
    commonMistake: { wrong: 'I need an advice.', correct: 'I need some advice.', note: 'Advice is uncountable, so it does not take a or an.' },
    quiz: [
      ['Complete: How ___ emails did you receive?', ['much', 'many', 'little'], 1, 'Emails is a plural countable noun.'],
      ['Complete: We have only ___ time.', ['a few', 'many', 'a little'], 2, 'Time is uncountable in this meaning.'],
      ['Choose the correct sentence.', ['There are some bread.', 'There is some bread.', 'There is a bread.'], 1, 'Bread is uncountable, so use singular is with some.'],
    ],
  }),
  lesson({
    id: 'a2-comparatives-superlatives', level: 'A2', category: 'adjectives-and-adverbs', title: 'Comparatives and superlatives',
    explanation: 'Use a comparative to compare two things and a superlative for the highest or lowest member of a group. Short adjectives usually take -er/-est; longer ones use more/most.',
    formula: 'adjective-er + than / more + adjective + than; the + adjective-est / the most + adjective',
    examples: ['This route is shorter than the motorway.', 'The blue option is more practical.', 'That was the funniest part.'],
    commonMistake: { wrong: 'This task is more easier.', correct: 'This task is easier.', note: 'Do not use more together with an -er comparative.' },
    quiz: [
      ['Complete: My new room is ___ than the old one.', ['brightest', 'brighter', 'more bright'], 1, 'The regular comparative of bright is brighter.'],
      ['Complete: It is ___ café in the area.', ['the most quietest', 'the quietest', 'quieter'], 1, 'Use the superlative for one café within a whole area.'],
      ['Complete: This explanation is ___ than the first.', ['more useful', 'usefuller', 'most useful'], 0, 'A longer adjective such as useful takes more.'],
    ],
  }),
  lesson({
    id: 'a2-ed-ing-adjectives', level: 'A2', category: 'adjectives-and-adverbs', title: 'Adjectives ending in -ed and -ing',
    explanation: 'An -ing adjective describes the person or thing that creates a feeling. An -ed adjective describes how someone feels. The distinction is about source versus experience.',
    formula: 'cause/source → adjective-ing; person experiencing feeling → adjective-ed',
    examples: ['The lecture was surprising.', 'We were surprised by the news.', 'This long delay is frustrating.'],
    commonMistake: { wrong: 'I am boring with this game.', correct: 'I am bored with this game.', note: 'The speaker experiences the feeling, so use bored.' },
    quiz: [
      ['Complete: The instructions are very ___.', ['confused', 'confusing', 'confuse'], 1, 'The instructions cause confusion.'],
      ['Complete: I felt ___ after the long meeting.', ['exhausting', 'exhausted', 'exhaust'], 1, 'The person experiences exhaustion.'],
      ['Choose the correct pair: The film was ___, so the children were ___.', ['frightened / frightening', 'frightening / frightened', 'frighten / frightened'], 1, 'The film causes the feeling; the children experience it.'],
    ],
  }),
  lesson({
    id: 'a2-basic-modals', level: 'A2', category: 'modals', title: 'Can, could, should and must',
    explanation: 'Use can for present ability, could for general past ability or a polite request, should for advice and must for a strong requirement. A modal is followed by the base verb.',
    formula: 'subject + modal + base verb',
    examples: ['I can understand the main idea.', 'Could you speak more slowly?', 'You should save a copy.'],
    commonMistake: { wrong: 'She can to drive.', correct: 'She can drive.', note: 'Do not put to between a modal and the main verb.' },
    quiz: [
      ['Complete: You look tired. You ___ rest.', ['should', 'can to', 'must to'], 0, 'Should expresses advice.'],
      ['Complete: ___ you open the window, please?', ['Should', 'Could', 'Must'], 1, 'Could makes a polite request.'],
      ['Complete: Visitors ___ show identification; it is required.', ['could', 'must', 'can'], 1, 'Must expresses a strong requirement.'],
    ],
  }),
  lesson({
    id: 'a2-have-to-mustnt', level: 'A2', category: 'modals', title: 'Have to, must not and do not have to',
    explanation: 'Have to expresses a requirement. Must not means something is prohibited. Do not have to means there is no need, but the action is still allowed.',
    formula: 'have/has to + verb; must not + verb; do/does not have to + verb',
    examples: ['I have to renew my pass.', 'You must not touch that switch.', 'We do not have to wear a uniform.'],
    commonMistake: { wrong: 'You mustn’t come early if you are busy.', correct: 'You don’t have to come early if you are busy.', note: 'Use do not have to for lack of necessity; must not would prohibit coming early.' },
    quiz: [
      ['The museum is free. Complete: You ___ pay.', ['must not', 'do not have to', 'have to'], 1, 'No payment is necessary, but paying is not prohibited.'],
      ['Complete: You ___ use your phone during the exam.', ['must not', 'do not have to', 'could'], 0, 'Must not states a prohibition.'],
      ['Complete: She ___ leave at six because her shift starts early.', ['has to', 'must not', 'does not have'], 0, 'Has to agrees with she and expresses necessity.'],
    ],
  }),
  lesson({
    id: 'a2-prepositions-time-place', level: 'A2', category: 'nouns-and-articles', title: 'Prepositions of time and place: at, on and in',
    explanation: 'For time, use at for a precise point, on for a day or date, and in for a month, year or longer period. For place, at marks a point, on a surface and in an enclosed area.',
    formula: 'at + point; on + day/surface; in + period/enclosed area',
    examples: ['The call starts at nine.', 'We met on Monday.', 'Your keys are in the drawer.'],
    commonMistake: { wrong: 'I was born on 1998.', correct: 'I was born in 1998.', note: 'Years take in, not on.' },
    quiz: [
      ['Complete: The workshop is ___ 18 July.', ['at', 'on', 'in'], 1, 'Specific dates take on.'],
      ['Complete: Let’s meet ___ the entrance.', ['at', 'on', 'in'], 0, 'The entrance is treated as a meeting point.'],
      ['Complete: The photo is ___ the wall.', ['at', 'in', 'on'], 2, 'A wall is a surface, so use on.'],
    ],
  }),
  lesson({
    id: 'a2-there-is-it-is', level: 'A2', category: 'nouns-and-articles', title: 'There is, there are and it is',
    explanation: 'Use there is or there are to introduce the existence of something. Use it is to identify or describe something already known, or to talk about weather, time and distance.',
    formula: 'there is + singular/uncountable; there are + plural; it is + description/time/weather',
    examples: ['There is a pharmacy nearby.', 'There are two files attached.', 'It is cold outside.'],
    commonMistake: { wrong: 'It is many people here.', correct: 'There are many people here.', note: 'Use there are to say that plural things or people exist in a place.' },
    quiz: [
      ['Complete: ___ a problem with the printer.', ['It is', 'There is', 'There are'], 1, 'The sentence introduces the existence of one problem.'],
      ['Complete: ___ nearly midnight.', ['It is', 'There is', 'There are'], 0, 'Use it is to state the time.'],
      ['Complete: ___ several useful examples in this lesson.', ['There are', 'It is', 'There is'], 0, 'Examples is plural, so use there are.'],
    ],
  }),
  lesson({
    id: 'a2-verb-patterns', level: 'A2', category: 'verb-patterns', title: 'Verb + -ing or to-infinitive',
    explanation: 'Some common verbs are followed by an -ing form, while others are followed by to plus the base verb. Learn the pattern together with the verb: enjoy reading, like cooking, want to go and need to leave.',
    formula: 'enjoy/like/love + verb-ing; want/need/would like + to + base verb',
    examples: ['I enjoy learning through stories.', 'We want to leave early.', 'She likes reading after work.'],
    commonMistake: { wrong: 'I enjoy to cook.', correct: 'I enjoy cooking.', note: 'Enjoy is followed by an -ing form.' },
    quiz: [
      ['Complete: They want ___ a taxi.', ['taking', 'to take', 'take'], 1, 'Want is followed by a to-infinitive.'],
      ['Complete: He enjoys ___ after work.', ['to read', 'reading', 'read'], 1, 'Enjoy is followed by an -ing form.'],
      ['Complete: I would like ___ you soon.', ['seeing', 'to see', 'see to'], 1, 'Would like is followed by a to-infinitive.'],
    ],
  }),
  lesson({
    id: 'a2-infinitive-purpose', level: 'A2', category: 'verb-patterns', title: 'Infinitive of purpose',
    explanation: 'Use to plus a base verb to explain why someone does something. This simple purpose phrase answers the question “Why?” and normally follows the main action.',
    formula: 'action + to + base verb (purpose)',
    examples: ['I opened the app to review my words.', 'She called to confirm the time.', 'We left early to catch the train.'],
    commonMistake: { wrong: 'I went out for buy milk.', correct: 'I went out to buy milk.', note: 'Use a to-infinitive, not for plus a verb, to express purpose.' },
    quiz: [
      ['Complete: I went to the station ___ a ticket.', ['for buy', 'buying', 'to buy'], 2, 'To buy explains the purpose of going to the station.'],
      ['Complete: We use a map ___ the route.', ['to check', 'for check', 'checking for'], 0, 'To check explains the purpose of using the map.'],
      ['Which sentence expresses purpose?', ['I called to ask a question.', 'I called yesterday.', 'I called my neighbour.'], 0, 'To ask tells us why the speaker called.'],
    ],
  }),
  lesson({
    id: 'a2-pronouns-possessives', level: 'A2', category: 'nouns-and-articles', title: 'Pronouns and possessives',
    explanation: 'Use subject pronouns before verbs, object pronouns after verbs or prepositions, and possessive adjectives before nouns. Possessive pronouns replace the noun completely, so do not put a noun after them.',
    formula: 'I → me → my → mine; they → them → their → theirs',
    examples: ['She sent me her address.', 'This jacket is mine.', 'We spoke to them after their lesson.'],
    commonMistake: { wrong: 'This is her book; that one is my.', correct: 'This is her book; that one is mine.', note: 'Use the possessive pronoun mine when the noun is not repeated.' },
    quiz: [
      ['Complete: Sam called ___ after work.', ['I', 'me', 'my'], 1, 'A verb takes the object pronoun me.'],
      ['Complete: Is this notebook ___?', ['your', 'yours', 'you'], 1, 'Yours replaces your notebook.'],
      ['Complete: ___ neighbours are very friendly.', ['They', 'Them', 'Their'], 2, 'A possessive adjective comes before the noun neighbours.'],
    ],
  }),
  lesson({
    id: 'a2-frequency-adverbs', level: 'A2', category: 'adjectives-and-adverbs', title: 'Adverbs of frequency',
    explanation: 'Put usually, often, sometimes, rarely and never before most main verbs but after the verb be. Expressions such as every day or once a week normally go at the beginning or end of the clause.',
    formula: 'subject + frequency adverb + main verb; subject + be + frequency adverb',
    examples: ['I usually walk to work.', 'She is often tired on Fridays.', 'We practise speaking twice a week.'],
    commonMistake: { wrong: 'He goes always by bus.', correct: 'He always goes by bus.', note: 'With an ordinary main verb, place the frequency adverb before the verb.' },
    quiz: [
      ['Choose the natural order.', ['I drink often tea.', 'I often drink tea.', 'Often I tea drink.'], 1, 'Often normally comes before the main verb drink.'],
      ['Complete: Maya is ___ late.', ['rarely', 'rare', 'once'], 0, 'After be, use the frequency adverb rarely.'],
      ['Which expression means two times each week?', ['every two week', 'twice a week', 'two time weekly'], 1, 'Twice a week is the standard frequency expression.'],
    ],
  }),
  lesson({
    id: 'a2-imperatives-instructions', level: 'A2', category: 'questions', title: 'Imperatives and clear instructions',
    explanation: 'Use the base form of a verb to give an instruction, direction or invitation. Add do not or don’t before the base verb for a negative instruction, and use please to make many requests sound more polite.',
    formula: 'base verb; do not/don’t + base verb; please + base verb',
    examples: ['Turn left after the bank.', 'Please wait here for a moment.', 'Do not open the window.'],
    commonMistake: { wrong: 'To turn right at the lights.', correct: 'Turn right at the lights.', note: 'A direct instruction normally begins with the base verb and has no stated subject.' },
    quiz: [
      ['Choose the clear instruction.', ['To press the green button.', 'Press the green button.', 'You pressing the green button.'], 1, 'An imperative begins with the base verb press.'],
      ['Complete: ___ forget your passport.', ["Don't", "Doesn't", 'Not'], 0, 'Use don’t plus a base verb for a negative imperative.'],
      ['Which instruction is polite?', ['Please take a seat.', 'You will a seat.', 'Taking please seat.'], 0, 'Please can make an imperative more polite.'],
    ],
  }),
  lesson({
    id: 'a2-movement-prepositions', level: 'A2', category: 'nouns-and-articles', title: 'Prepositions of movement',
    explanation: 'Use to for a destination, into and out of for entering or leaving, across for movement from one side to another, along for following a line, and past for moving beyond a place.',
    formula: 'go to/into/out of/across/along/past + place',
    examples: ['We walked across the bridge.', 'She ran into the house.', 'Go past the pharmacy and turn right.'],
    commonMistake: { wrong: 'They went in the café.', correct: 'They went into the café.', note: 'Use into when movement ends inside a place; in normally describes position.' },
    quiz: [
      ['Complete: We cycled ___ the river path.', ['along', 'into', 'at'], 0, 'Along means following the line of the path.'],
      ['Complete: The dog ran ___ the garden and into the road.', ['out of', 'under', 'between'], 0, 'Out of shows movement from inside to outside.'],
      ['Complete: Walk ___ the museum; the café is next door.', ['past', 'in', 'from'], 0, 'Past means moving beyond the museum.'],
    ],
  }),
  lesson({
    id: 'a2-indefinite-pronouns', level: 'A2', category: 'nouns-and-articles', title: 'Someone, anything and nobody',
    explanation: 'Use someone, something and somewhere mainly in affirmative statements; anyone, anything and anywhere are common in questions and negatives. Nobody and nothing already carry a negative meaning.',
    formula: 'some- in affirmatives; any- in questions/negatives; no- = negative meaning',
    examples: ['Someone left a message for you.', 'I cannot find anything useful.', 'Nobody was waiting outside.'],
    commonMistake: { wrong: 'I didn’t see nobody.', correct: 'I didn’t see anybody.', note: 'Standard English avoids a double negative: use did not with anybody.' },
    quiz: [
      ['Choose the neutral question when the speaker does not know whether a person is there: Is there ___ at the door?', ['someone', 'anyone', 'no one'], 1, 'Anyone is the usual neutral choice in a question.'],
      ['Complete: I have ___ to tell you.', ['something', 'anything not', 'nothing any'], 0, 'Something is natural in an affirmative statement.'],
      ['Choose the standard sentence.', ['Nobody called me.', 'Nobody did not call me.', 'Anybody called not me.'], 0, 'Nobody already makes the clause negative.'],
    ],
  }),
  lesson({
    id: 'b1-present-perfect-v-past', level: 'B1', category: 'tenses', title: 'Present perfect or past simple?',
    explanation: 'Use the past simple when a finished past time is stated or understood. Use the present perfect when the time period is unfinished, the exact time is unimportant, or the present result is the focus.',
    formula: 'finished past time → past simple; unfinished/no exact time → have/has + past participle',
    examples: ['I sent the invoice on Tuesday.', 'I have sent three invoices today.', 'Have you spoken to Maya yet?'],
    commonMistake: { wrong: 'I didn’t see her since May.', correct: 'I haven’t seen her since May.', note: 'Since connects a past starting point to the present, so use the present perfect.' },
    quiz: [
      ['Complete: I ___ that film in 2024.', ['have seen', 'saw', 'have saw'], 1, 'The finished year 2024 requires the past simple.'],
      ['Complete: We ___ two meetings so far today.', ['had', 'have had', 'have'], 1, 'So far in an unfinished day calls for the present perfect.'],
      ['Complete: She ___ here since January.', ['worked', 'has worked', 'did work'], 1, 'Since January describes a situation continuing to now.'],
    ],
  }),
  lesson({
    id: 'b1-present-perfect-continuous', level: 'B1', category: 'tenses', title: 'Present perfect continuous',
    explanation: 'Use have or has been plus verb-ing for an activity continuing until now or recently stopped with a visible result. It often highlights duration or process rather than completion.',
    formula: 'subject + have/has been + verb-ing',
    examples: ['I have been studying for two hours.', 'It has been raining, so the road is wet.', 'How long have you been waiting?'],
    commonMistake: { wrong: 'I am working here since March.', correct: 'I have been working here since March.', note: 'A situation that began in the past and continues now needs a perfect form.' },
    quiz: [
      ['Complete: They ___ all morning.', ['have been practising', 'are practising since', 'practised since'], 0, 'The continuous perfect highlights an activity across a period up to now.'],
      ['Complete: Your hands are dirty. ___ you ___ the bike?', ['Did / repair', 'Have / been repairing', 'Are / repaired'], 1, 'The current evidence suggests a recent ongoing activity.'],
      ['Which expression fits duration?', ['since three hours', 'for three hours', 'during three hours ago'], 1, 'For introduces a length of time.'],
    ],
  }),
  lesson({
    id: 'b1-past-perfect', level: 'B1', category: 'tenses', title: 'Past perfect: the earlier past',
    explanation: 'Use had plus a past participle to make the sequence of two past events clear. The past perfect marks the event that happened first; the later event is often in the past simple.',
    formula: 'earlier event: had + past participle; later event: past simple',
    examples: ['The train had left before we reached the platform.', 'I was tired because I had slept badly.', 'Had they met before the interview?'],
    commonMistake: { wrong: 'When I arrived, she already left.', correct: 'When I arrived, she had already left.', note: 'Her departure happened before the arrival, so mark it with the past perfect.' },
    quiz: [
      ['Complete: By the time I called, they ___.', ['left', 'had left', 'have left'], 1, 'The leaving occurred before the past call.'],
      ['Complete: He recognised the place because he ___ there before.', ['had been', 'was', 'has been'], 0, 'The earlier visit needs the past perfect.'],
      ['Choose the correct sequence.', ['After she had saved the file, she closed the laptop.', 'After she has saved the file, she closed the laptop.', 'After she saved had the file, she closed the laptop.'], 0, 'Had saved clearly marks the earlier of two past actions.'],
    ],
  }),
  lesson({
    id: 'b1-past-habits', level: 'B1', category: 'tenses', title: 'Past habits: used to and would',
    explanation: 'Use used to for past states or repeated actions that are no longer true. Would can describe repeated past actions when the past time is already clear, but it does not normally describe past states.',
    formula: 'used to + base verb; past context + would + base verb (repeated action)',
    examples: ['I used to be shy.', 'Every summer, we would camp by the lake.', 'Did you use to cycle to school?'],
    commonMistake: { wrong: 'I would own a small car.', correct: 'I used to own a small car.', note: 'Own describes a state, so used to is appropriate but habitual would is not.' },
    quiz: [
      ['Complete: We ___ live near the coast.', ['used to', 'would to', 'use'], 0, 'Used to can express a past state that changed.'],
      ['Complete: On winter evenings, Dad ___ make soup.', ['used', 'would', 'was'], 1, 'Would can describe a repeated action in a clear past context.'],
      ['Choose the correct question.', ['Did she used to sing?', 'Did she use to sing?', 'Would she used to sing?'], 1, 'After did, use the base form use.'],
    ],
  }),
  lesson({
    id: 'b1-zero-first-second-conditionals', level: 'B1', category: 'clauses-and-linking', title: 'Zero, first and second conditionals',
    explanation: 'Use the zero conditional for general results, the first for a realistic future possibility and the second for an imaginary or unlikely present/future situation. Do not put will in the ordinary if-clause.',
    formula: 'zero: if + present, present; first: if + present, will + verb; second: if + past, would + verb',
    examples: ['If water freezes, it expands.', 'If I finish early, I’ll call you.', 'If I had more space, I would get a larger desk.'],
    commonMistake: { wrong: 'If it will rain, we will stay inside.', correct: 'If it rains, we will stay inside.', note: 'Use the present simple in a normal first-conditional if-clause.' },
    quiz: [
      ['Choose the standard zero-conditional form for a general scientific fact: If you heat ice, it ___.', ['will melt', 'melts', 'would melt'], 1, 'A general scientific result takes the zero conditional.'],
      ['Complete: If she has time this evening, she ___ us.', ['joins', 'would join', 'will join'], 2, 'This is a realistic future possibility, so use the first conditional.'],
      ['Complete: If I knew the answer, I ___ you.', ['tell', 'will tell', 'would tell'], 2, 'Past form plus would expresses an imaginary present situation.'],
    ],
  }),
  lesson({
    id: 'b1-passive-basics', level: 'B1', category: 'advanced-structures', title: 'The passive: focus on action or result',
    explanation: 'Use the passive when the action, receiver or result matters more than the person doing it, or when the agent is unknown. Match be to the tense and follow it with a past participle.',
    formula: 'subject + be in required tense + past participle (+ by agent)',
    examples: ['The rooms are cleaned every morning.', 'My bike was stolen last night.', 'The results will be published tomorrow.'],
    commonMistake: { wrong: 'The bridge built in 2010.', correct: 'The bridge was built in 2010.', note: 'A passive verb needs the correct form of be.' },
    quiz: [
      ['Complete: English ___ in many countries.', ['speaks', 'is spoken', 'is speaking'], 1, 'The language receives the action, so use present passive is spoken.'],
      ['Complete: The package ___ yesterday.', ['was delivered', 'is delivered', 'delivered'], 0, 'Yesterday calls for past passive was delivered.'],
      ['Complete: A new version ___ next month.', ['will release', 'will be released', 'is releasing'], 1, 'Future passive uses will be + past participle.'],
    ],
  }),
  lesson({
    id: 'b1-reported-statements', level: 'B1', category: 'clauses-and-linking', title: 'Reported statements',
    explanation: 'Reported speech gives the content of someone’s words without quoting them exactly. After a past reporting verb, pronouns, time expressions and tenses often shift to match the new viewpoint.',
    formula: 'said (that) + clause; told + person + (that) + clause',
    examples: ['Lara said that she was busy.', 'He told me that the shop had closed.', 'They said they would email the next day.'],
    commonMistake: { wrong: 'She told that she was tired.', correct: 'She said that she was tired.', note: 'Tell normally needs a person object: she told me; say does not.' },
    quiz: [
      ['Report: “I am ready,” Ken said.', ['Ken said that I am ready.', 'Ken said that he was ready.', 'Ken told that he ready.'], 1, 'The pronoun and tense shift to the reporting viewpoint.'],
      ['Complete: Mira ___ me that she needed help.', ['said', 'told', 'asked'], 1, 'Tell takes the person directly: told me.'],
      ['Report: “We will call tomorrow,” they said.', ['They said they would call the next day.', 'They said we will call tomorrow.', 'They told would call tomorrow.'], 0, 'Will commonly shifts to would, and tomorrow to the next day.'],
    ],
  }),
  lesson({
    id: 'b1-reported-questions', level: 'B1', category: 'questions', title: 'Reported questions',
    explanation: 'In a reported question, use statement word order and no question mark inside the report. Keep the question word, or use if/whether for a yes-no question.',
    formula: 'asked + question word + subject + verb; asked if/whether + subject + verb',
    examples: ['She asked where I lived.', 'He asked whether the seat was free.', 'They asked what time the talk started.'],
    commonMistake: { wrong: 'She asked where did I work.', correct: 'She asked where I worked.', note: 'Reported questions use statement order, without did.' },
    quiz: [
      ['Report: “Are you hungry?”', ['She asked was I hungry.', 'She asked if I was hungry.', 'She asked that I was hungry.'], 1, 'A reported yes-no question uses if plus statement order.'],
      ['Report: “Where is the station?”', ['He asked where the station was.', 'He asked where was the station.', 'He asked if the station was.'], 0, 'Keep where but use subject before verb.'],
      ['Choose the correct reported question.', ['They asked what did I want.', 'They asked what I wanted.', 'They asked what wanted I.'], 1, 'Reported questions take statement word order.'],
    ],
  }),
  lesson({
    id: 'b1-defining-relative-clauses', level: 'B1', category: 'clauses-and-linking', title: 'Defining relative clauses',
    explanation: 'A defining relative clause identifies exactly which person or thing you mean. Use who for people, which for things, and that for either in defining clauses. You may omit an object relative pronoun, but not a subject pronoun.',
    formula: 'noun + who/which/that + defining information',
    examples: ['The woman who called left no message.', 'This is the app that tracks my reviews.', 'The book I borrowed is on the desk.'],
    commonMistake: { wrong: 'The man works here helped me.', correct: 'The man who works here helped me.', note: 'Who is the subject of works and cannot be omitted.' },
    quiz: [
      ['Complete: I know someone ___ can repair it.', ['which', 'who', 'where'], 1, 'Who refers to a person and acts as the subject of can repair.'],
      ['Complete: The headphones ___ I ordered have arrived.', ['who', 'where', 'that'], 2, 'That can refer to things in a defining clause.'],
      ['Where can the relative pronoun be omitted?', ['The person who lives upstairs', 'The course that I chose', 'The train that leaves at six'], 1, 'In the course that I chose, that is the object of chose.'],
    ],
  }),
  lesson({
    id: 'b1-modals-deduction', level: 'B1', category: 'modals', title: 'Present deduction: must, might and can’t',
    explanation: 'Use must when evidence makes a conclusion very likely, might/could/may for a possibility, and can’t when evidence makes something nearly impossible. These forms express judgement, not obligation.',
    formula: 'must/might/may/could/can’t + base verb',
    examples: ['The lights are on, so Rafi must be home.', 'This might be the correct entrance.', 'It can’t be noon; the clock says nine.'],
    commonMistake: { wrong: 'She must to be busy.', correct: 'She must be busy.', note: 'A modal of deduction is followed directly by the base verb.' },
    quiz: [
      ['The office is dark and locked. Complete: They ___ be open.', ['must', 'can’t', 'might to'], 1, 'The evidence strongly suggests that being open is impossible.'],
      ['I am not certain. Complete: This ___ be her number.', ['must', 'might', 'can’t'], 1, 'Might communicates an uncertain possibility.'],
      ['He has run 20 kilometres. Complete: He ___ be tired.', ['must', 'can’t', 'may to'], 0, 'The evidence supports a strong logical conclusion.'],
    ],
  }),
  lesson({
    id: 'b1-question-tags', level: 'B1', category: 'questions', title: 'Question tags',
    explanation: 'Add a short tag to check information or invite agreement. A positive statement normally takes a negative tag and a negative statement a positive tag. Repeat the auxiliary and use a pronoun.',
    formula: 'positive statement, negative auxiliary + pronoun?; negative statement, positive auxiliary + pronoun?',
    examples: ['You work nearby, don’t you?', 'She isn’t driving, is she?', 'They have arrived, haven’t they?'],
    commonMistake: { wrong: 'He can swim, doesn’t he?', correct: 'He can swim, can’t he?', note: 'Repeat the existing modal can in the tag.' },
    quiz: [
      ['Complete: It is cold, ___?', ['is it', 'isn’t it', 'doesn’t it'], 1, 'A positive statement with is takes the negative tag isn’t it.'],
      ['Complete: You didn’t call, ___?', ['did you', 'didn’t you', 'do you'], 0, 'A negative past statement takes the positive tag did you.'],
      ['Complete: Mina can help, ___?', ['doesn’t she', 'can she', 'can’t she'], 2, 'Repeat can and make the tag negative.'],
    ],
  }),
  lesson({
    id: 'b1-linking-reason-result-purpose', level: 'B1', category: 'clauses-and-linking', title: 'Linking reason, result and purpose',
    explanation: 'Use because plus a clause or because of plus a noun phrase for reasons. Use so plus a clause for results. Use so that plus a clause, often with can/could, to express purpose.',
    formula: 'because + clause; because of + noun; result: so + clause; purpose: so that + clause',
    examples: ['We stayed in because it was raining.', 'The match stopped because of the storm.', 'I spoke clearly so that everyone could follow.'],
    commonMistake: { wrong: 'We cancelled because of it was late.', correct: 'We cancelled because it was late.', note: 'Because of takes a noun phrase; because introduces a clause.' },
    quiz: [
      ['Complete: The road was closed ___ heavy snow.', ['because', 'because of', 'so that'], 1, 'Heavy snow is a noun phrase, so use because of.'],
      ['Complete: I repeated the number ___ she could write it down.', ['because of', 'so that', 'so'], 1, 'So that introduces the intended purpose.'],
      ['Complete: The bus was late, ___ I walked.', ['because', 'so', 'because of'], 1, 'So connects the cause to its result.'],
    ],
  }),
  lesson({
    id: 'b1-contrast-linkers', level: 'B1', category: 'clauses-and-linking', title: 'Although, however and despite',
    explanation: 'Use although or even though before a clause, and despite or in spite of before a noun or -ing form. However usually links separate sentences and is followed by a comma.',
    formula: 'although + clause; despite + noun/verb-ing; sentence. However, sentence.',
    examples: ['Although I was nervous, I spoke clearly.', 'Despite the delay, we arrived on time.', 'The task was difficult. However, we completed it.'],
    commonMistake: { wrong: 'Despite she was tired, she continued.', correct: 'Although she was tired, she continued.', note: 'Despite does not directly introduce a full finite clause.' },
    quiz: [
      ['Complete: ___ the rain, we went for a walk.', ['Although', 'Despite', 'However'], 1, 'The rain is a noun phrase, so despite fits.'],
      ['Complete: ___ it was expensive, I bought it.', ['Despite', 'Although', 'Because of'], 1, 'Although introduces the complete clause it was expensive.'],
      ['Choose the correctly punctuated link.', ['It was risky, however we tried.', 'It was risky. However, we tried.', 'It was risky despite, we tried.'], 1, 'However can link two separate sentences with a following comma.'],
    ],
  }),
  lesson({
    id: 'b1-phrasal-verb-order', level: 'B1', category: 'verb-patterns', title: 'Phrasal verbs and object position',
    explanation: 'With a separable phrasal verb, a noun object may go before or after the particle, but a pronoun must go between them. Inseparable phrasal verbs keep the verb and particle together.',
    formula: 'separable: turn the light off / turn it off; inseparable: look after the child',
    examples: ['Please turn the music down.', 'Please turn it down.', 'Can you look after my bag?'],
    commonMistake: { wrong: 'Turn off it.', correct: 'Turn it off.', note: 'A pronoun object goes between a separable verb and its particle.' },
    quiz: [
      ['Choose the correct pronoun order.', ['Pick up it.', 'Pick it up.', 'It pick up.'], 1, 'The pronoun it separates pick and up.'],
      ['Which sentence uses an inseparable verb correctly?', ['I look my sister after.', 'I look after my sister.', 'I look her after.'], 1, 'Look after stays together before its object.'],
      ['Complete: Please write ___ down.', ['the address it', 'it', 'down it'], 1, 'A pronoun belongs between write and down.'],
    ],
  }),
  lesson({
    id: 'b1-reflexive-pronouns', level: 'B1', category: 'nouns-and-articles', title: 'Reflexive pronouns and by myself',
    explanation: 'Use a reflexive pronoun when the subject and object are the same person or thing. By plus a reflexive pronoun means alone or without help. Do not add one when the verb normally has no object.',
    formula: 'subject + verb + myself/yourself/himself/herself/itself/ourselves/themselves',
    examples: ['She taught herself Italian.', 'I fixed it by myself.', 'Please help yourselves to tea.'],
    commonMistake: { wrong: 'I relaxed myself after work.', correct: 'I relaxed after work.', note: 'Relax is normally intransitive in this meaning, so no reflexive object is needed.' },
    quiz: [
      ['Complete: We introduced ___ to the new neighbours.', ['us', 'ourselves', 'ourself'], 1, 'The subject and object are the same group.'],
      ['Complete: He built the shelf by ___.', ['him', 'himself', 'his'], 1, 'By himself means without help.'],
      ['Choose the natural sentence.', ['She woke herself up at seven.', 'She arrived herself at seven.', 'She went herself to home.'], 0, 'Wake can take a reflexive object; arrive and go do not use one this way.'],
    ],
  }),
  lesson({
    id: 'b1-enough-too', level: 'B1', category: 'adjectives-and-adverbs', title: 'Too and enough',
    explanation: 'Too means more than is wanted or possible, while enough means the required amount. Put enough after an adjective or adverb but before a noun.',
    formula: 'too + adjective; adjective + enough; enough + noun; too/enough + to-infinitive',
    examples: ['The box is too heavy to lift.', 'I am not confident enough to present yet.', 'We have enough chairs for everyone.'],
    commonMistake: { wrong: 'The room is enough large.', correct: 'The room is large enough.', note: 'Enough follows an adjective.' },
    quiz: [
      ['Complete: It is ___ dark to read.', ['enough', 'too', 'too much'], 1, 'Too dark means the darkness prevents reading.'],
      ['Complete: We do not have ___ information.', ['information enough', 'enough', 'too'], 1, 'Enough comes before a noun.'],
      ['Complete: Are you old ___ to drive?', ['too', 'enough', 'much'], 1, 'Enough follows the adjective old.'],
    ],
  }),
  lesson({
    id: 'b2-perfect-simple-v-continuous', level: 'B2', category: 'tenses', title: 'Perfect simple or perfect continuous?',
    explanation: 'Choose the perfect simple to emphasise completion, quantity or a result. Choose the perfect continuous to emphasise duration, repetition or an unfinished process. Some state verbs rarely take the continuous form.',
    formula: 'result/quantity → have + participle; process/duration → have been + verb-ing',
    examples: ['I have written four pages.', 'I have been writing since lunch.', 'She has known him for years.'],
    commonMistake: { wrong: 'I have been knowing her since school.', correct: 'I have known her since school.', note: 'Know is a state verb and normally uses the simple perfect.' },
    quiz: [
      ['The report is complete. Choose: I ___ it.', ['have been finishing', 'have finished', 'finish since'], 1, 'The simple perfect highlights the completed result.'],
      ['Complete: How long ___ you ___ for this company?', ['have / been working', 'did / worked', 'are / work'], 0, 'The question focuses on duration up to now.'],
      ['Complete: She ___ three clients today.', ['has been calling', 'has called', 'calls since'], 1, 'A stated quantity favours the simple perfect.'],
    ],
  }),
  lesson({
    id: 'b2-third-mixed-conditionals', level: 'B2', category: 'clauses-and-linking', title: 'Third and mixed conditionals',
    explanation: 'Use the third conditional for an unreal past situation and its imagined past result. A mixed conditional connects an unreal past cause to a present result, or an unreal present state to a past result.',
    formula: 'third: if + had + participle, would have + participle; mixed: if + had + participle, would + verb',
    examples: ['If we had left earlier, we would have caught the train.', 'If I had studied design, I would have a different career now.', 'If she were more patient, she would not have quit yesterday.'],
    commonMistake: { wrong: 'If I would have known, I would have helped.', correct: 'If I had known, I would have helped.', note: 'Use had plus past participle, not would have, in the normal third-conditional if-clause.' },
    quiz: [
      ['Complete: If you had called, I ___ answered.', ['would have', 'will have', 'would'], 0, 'The imagined past result uses would have + participle.'],
      ['Complete: If I had taken that job, I ___ in Berlin now.', ['would live', 'would have lived yesterday', 'will live'], 0, 'A past choice has an imagined present result.'],
      ['Choose the correct third conditional.', ['If we knew, we would have acted.', 'If we had known, we would have acted.', 'If we would know, we had acted.'], 1, 'Both condition and result refer to an unreal past.'],
    ],
  }),
  lesson({
    id: 'b2-future-continuous-perfect', level: 'B2', category: 'tenses', title: 'Future continuous and future perfect',
    explanation: 'Use the future continuous for an action that will be in progress at a future time or as a neutral question about plans. Use the future perfect for something completed before a future deadline.',
    formula: 'will be + verb-ing; will have + past participle',
    examples: ['This time tomorrow, I will be flying home.', 'Will you be using the meeting room?', 'By Friday, we will have completed the move.'],
    commonMistake: { wrong: 'By noon, I will finish already.', correct: 'By noon, I will have finished.', note: 'A deadline viewed from the future calls for the future perfect.' },
    quiz: [
      ['Complete: At eight, we ___ dinner.', ['will have eaten by', 'will be eating', 'will eating'], 1, 'The action will be in progress at that future time.'],
      ['Choose the future perfect form for completion before the deadline: By 2030, they ___ the new line.', ['will build', 'will have built', 'will be build'], 1, 'The requested future perfect form is will have plus the past participle built.'],
      ['Which is a neutral question about plans?', ['Will you be staying long?', 'Would you stayed long?', 'Have you will stay long?'], 0, 'The future continuous can politely ask about an expected plan.'],
    ],
  }),
  lesson({
    id: 'b2-past-deduction-modals', level: 'B2', category: 'modals', title: 'Past deduction with modal perfects',
    explanation: 'Use must have plus a past participle for a strong past conclusion, might/could have for a past possibility and can’t have for a conclusion that a past event was impossible.',
    formula: 'must/might/could/can’t + have + past participle',
    examples: ['She must have missed the bus.', 'They might have taken a different route.', 'He can’t have read the email yet.'],
    commonMistake: { wrong: 'They must have went home.', correct: 'They must have gone home.', note: 'Have is followed by a past participle, not the past-simple form.' },
    quiz: [
      ['The ground is wet. Complete: It ___ last night.', ['must have rained', 'must rained', 'must be rain'], 0, 'Present evidence supports a strong conclusion about the past.'],
      ['I am unsure. Complete: She ___ the earlier train.', ['might have caught', 'must caught', 'can’t caught'], 0, 'Might have expresses an uncertain past possibility.'],
      ['I saw him here all day. He ___ in Izmir.', ['must have been', 'can’t have been', 'might be'], 1, 'The evidence rules out that past location.'],
    ],
  }),
  lesson({
    id: 'b2-nondefining-relative-clauses', level: 'B2', category: 'clauses-and-linking', title: 'Non-defining relative clauses',
    explanation: 'A non-defining relative clause adds optional information about an already identified noun. Separate it with commas. Use who or which, not that, and do not omit the relative pronoun.',
    formula: 'identified noun, who/which/whose + extra information, main clause',
    examples: ['My aunt, who lives in Bursa, is visiting.', 'The app, which launched in May, works offline.', 'Arda, whose desk is by the window, can help.'],
    commonMistake: { wrong: 'My car, that is ten years old, runs well.', correct: 'My car, which is ten years old, runs well.', note: 'That is not used in a non-defining relative clause.' },
    quiz: [
      ['Complete: Our manager, ___ joined last month, leads the project.', ['that', 'who', '—'], 1, 'Who introduces extra information about a person.'],
      ['Choose the correctly punctuated sentence.', ['The hotel which overlooks the bay, is full.', 'The hotel, which overlooks the bay, is full.', 'The hotel, that overlooks the bay is full.'], 1, 'The optional clause needs commas on both sides.'],
      ['Complete: Ece, ___ idea we selected, will present it.', ['who', 'which', 'whose'], 2, 'Whose expresses possession: Ece’s idea.'],
    ],
  }),
  lesson({
    id: 'b2-causative-have-get', level: 'B2', category: 'advanced-structures', title: 'Have and get something done',
    explanation: 'Use have or get plus an object and past participle when you arrange for another person to perform a service. The structure focuses on the result, not the service provider.',
    formula: 'subject + have/get in required tense + object + past participle',
    examples: ['I had my laptop repaired.', 'We are getting the windows replaced.', 'You should have your eyes tested.'],
    commonMistake: { wrong: 'I got cut my hair at the salon.', correct: 'I had my hair cut at the salon.', note: 'Use have/get + object + past participle when another person performed the service.' },
    quiz: [
      ['Complete: We ___ the kitchen painted last week.', ['had', 'did', 'were'], 0, 'Had + object + participle shows an arranged service.'],
      ['Complete: She is getting her passport ___.', ['renew', 'renewed', 'renewing'], 1, 'The causative requires a past participle after the object.'],
      ['Which means a technician installed it?', ['I installed the alarm.', 'I had the alarm installed.', 'I had installed the alarm.'], 1, 'The causative says the speaker arranged the work.'],
    ],
  }),
  lesson({
    id: 'b2-wish-if-only', level: 'B2', category: 'advanced-structures', title: 'Wish and if only',
    explanation: 'Use wish or if only plus a past form for an unreal present desire, could for desired ability or change, and past perfect for regret about the past. If only is generally more emphatic.',
    formula: 'wish + past simple; wish + could + verb; wish + had + past participle',
    examples: ['I wish I knew the answer.', 'If only we could stay longer.', 'She wishes she had accepted the offer.'],
    commonMistake: { wrong: 'I wish I would know more words.', correct: 'I wish I knew more words.', note: 'For an unreal present state, shift to the past simple.' },
    quiz: [
      ['Complete: I wish I ___ more free time.', ['have', 'had', 'would have had yesterday'], 1, 'Had expresses an unreal present situation.'],
      ['Complete: He wishes he ___ so rudely at the meeting.', ['had not spoken', 'does not speak', 'would not spoke'], 0, 'Past perfect expresses regret about a completed past action.'],
      ['Complete: If only I ___ play the piano.', ['could', 'can', 'had can'], 0, 'Could expresses desired but unreal present ability.'],
    ],
  }),
  lesson({
    id: 'b2-verb-pattern-meaning', level: 'B2', category: 'verb-patterns', title: 'Verb patterns that change meaning',
    explanation: 'With some verbs, choosing -ing or a to-infinitive changes the meaning. Remember doing looks back to a memory; remember to do looks forward to a duty. Stop doing ends an activity; stop to do interrupts one activity for another purpose.',
    formula: 'remember/forget/stop/try + verb-ing ≠ same verb + to-infinitive',
    examples: ['I remember meeting her.', 'Remember to lock the door.', 'We stopped to take a photograph.'],
    commonMistake: { wrong: 'I stopped to smoke last year.', correct: 'I stopped smoking last year.', note: 'Stopped smoking means the habit ended; stopped to smoke means another action paused for a cigarette.' },
    quiz: [
      ['You must not forget the task. Complete: Remember ___ the form.', ['submitting', 'to submit', 'submit to'], 1, 'The to-infinitive refers to an action still to be done.'],
      ['I have a memory of it. Complete: I remember ___ this street before.', ['to see', 'seeing', 'see'], 1, 'The -ing form looks back at a memory.'],
      ['We paused our walk in order to rest. Choose:', ['We stopped resting.', 'We stopped to rest.', 'We stopped rest.'], 1, 'To rest expresses the purpose of pausing the walk.'],
    ],
  }),
  lesson({
    id: 'b2-gradable-nongradable', level: 'B2', category: 'adjectives-and-adverbs', title: 'Gradable and non-gradable adjectives',
    explanation: 'Gradable adjectives can vary in degree and combine with very, fairly or a bit. Extreme or absolute adjectives usually combine with absolutely, completely or utterly instead.',
    formula: 'very/fairly + gradable adjective; absolutely/completely + extreme or absolute adjective',
    examples: ['The water is very cold.', 'The view is absolutely stunning.', 'The container is completely empty.'],
    commonMistake: { wrong: 'The answer is very impossible.', correct: 'The answer is completely impossible.', note: 'Impossible is absolute and does not normally take very.' },
    quiz: [
      ['Complete: The meal was absolutely ___.', ['tasty', 'delicious', 'warm'], 1, 'Delicious is an extreme adjective that combines naturally with absolutely.'],
      ['Complete: I am a bit ___.', ['exhausted', 'tired', 'impossible'], 1, 'Tired is gradable and can take a bit.'],
      ['Choose the natural combination.', ['utterly ridiculous', 'very perfect', 'slightly impossible'], 0, 'Ridiculous is an extreme adjective that works with utterly.'],
    ],
  }),
  lesson({
    id: 'b2-participle-adjective-clauses', level: 'B2', category: 'clauses-and-linking', title: 'Reduced relative clauses',
    explanation: 'A defining relative clause can sometimes be shortened. Use an -ing participle for an active meaning and a past participle for a passive meaning. The shortened clause directly follows the noun it modifies.',
    formula: 'noun + verb-ing (active); noun + past participle (passive)',
    examples: ['People waiting outside may come in.', 'The files stored here are encrypted.', 'The woman speaking now is our guide.'],
    commonMistake: { wrong: 'The documents sending yesterday arrived.', correct: 'The documents sent yesterday arrived.', note: 'The documents received the action, so use the passive participle sent.' },
    quiz: [
      ['Reduce: Students who need help should ask.', ['Students needed help should ask.', 'Students needing help should ask.', 'Students need help asking.'], 1, 'Needing has an active meaning: the students need help.'],
      ['Reduce: The bridge that was damaged in the storm is closed.', ['The bridge damaging in the storm is closed.', 'The bridge damaged in the storm is closed.', 'The bridge damage in the storm is closed.'], 1, 'Damaged in the storm is a natural reduced passive relative clause.'],
      ['Complete: Anyone ___ a blue badge may enter.', ['worn', 'wearing', 'is wear'], 1, 'The person actively wears the badge.'],
    ],
  }),
  lesson({
    id: 'b2-advanced-passive-reporting', level: 'B2', category: 'advanced-structures', title: 'Reporting with passive structures',
    explanation: 'Formal English often uses it is said that or a person is said to to report a general claim without naming its source. Match the infinitive form to the time relationship.',
    formula: 'It + passive reporting verb + that-clause; subject + passive reporting verb + to-infinitive',
    examples: ['It is believed that the painting is genuine.', 'The actor is said to live abroad.', 'The company is reported to have lost money.'],
    commonMistake: { wrong: 'He is said that he owns the house.', correct: 'He is said to own the house.', note: 'After a personal passive subject, use a to-infinitive, not a that-clause.' },
    quiz: [
      ['Rewrite: People believe the cave is ancient.', ['The cave believes to be ancient.', 'The cave is believed to be ancient.', 'The cave is believed that ancient.'], 1, 'Personal passive + to be preserves the reported claim.'],
      ['Complete: It ___ that prices will rise.', ['is expected', 'expects', 'is expect'], 0, 'Impersonal reporting uses it + passive + that-clause.'],
      ['The loss happened earlier. Complete: The firm is thought ___ money.', ['to lose', 'to have lost', 'losing'], 1, 'The perfect infinitive marks an event before the reporting time.'],
    ],
  }),
  lesson({
    id: 'c1-negative-adverbial-inversion', level: 'C1', category: 'advanced-structures', title: 'Inversion after negative adverbials',
    explanation: 'For formal emphasis, place a negative or restrictive adverbial first and invert the auxiliary and subject. If the original clause has no auxiliary, add do, does or did.',
    formula: 'negative adverbial + auxiliary + subject + main verb',
    examples: ['Never have I seen such a rapid change.', 'Rarely does the team miss a deadline.', 'Only then did we understand the risk.'],
    commonMistake: { wrong: 'Never I have seen that.', correct: 'Never have I seen that.', note: 'A fronted negative adverbial triggers auxiliary–subject inversion.' },
    quiz: [
      ['Complete: Seldom ___ such careful work.', ['we see', 'do we see', 'we do see'], 1, 'Fronted seldom requires inversion with do.'],
      ['Complete: Not until midnight ___ the server recover.', ['did', 'the server did', 'was'], 0, 'Not until triggers inversion in the main clause.'],
      ['Choose the correct inversion.', ['Under no circumstances you should reply.', 'Under no circumstances should you reply.', 'Under no circumstances should reply you.'], 1, 'The modal should comes before the subject you.'],
    ],
  }),
  lesson({
    id: 'c1-conditional-inversion', level: 'C1', category: 'advanced-structures', title: 'Formal conditional inversion',
    explanation: 'In formal style, omit if and invert had, were or should with the subject. Had introduces unreal past conditions, were unreal present conditions, and should a less likely future possibility.',
    formula: 'Had + subject + participle; Were + subject + complement/to-infinitive; Should + subject + base verb',
    examples: ['Had I known, I would have waited.', 'Were the price lower, we might agree.', 'Should you need assistance, call reception.'],
    commonMistake: { wrong: 'Had I knew, I would have stayed.', correct: 'Had I known, I would have stayed.', note: 'Had must be followed by a past participle.' },
    quiz: [
      ['Rewrite: If you should have questions, email me.', ['Should you have questions, email me.', 'Have you should questions, email me.', 'Should have you questions, email me.'], 0, 'Should moves before the subject when if is omitted.'],
      ['Complete: ___ she accepted, the outcome would have differed.', ['Had', 'Were', 'Should have'], 0, 'Had + subject + participle creates an inverted third conditional.'],
      ['Rewrite: If I were in charge, I would simplify it.', ['Were I in charge, I would simplify it.', 'Was I in charge, I simplify it.', 'Were in charge I, I would simplify it.'], 0, 'Were precedes the subject in a formal unreal condition.'],
    ],
  }),
  lesson({
    id: 'c1-cleft-sentences', level: 'C1', category: 'advanced-structures', title: 'Cleft sentences for focus',
    explanation: 'A cleft divides one message into two clauses so that one element receives strong focus. It-clefts highlight a person, time, place or thing; wh-clefts often introduce known information before the key point.',
    formula: 'It + be + focus + that/who-clause; What + clause + be + focus',
    examples: ['It was Leyla who noticed the error.', 'What I need is a clear deadline.', 'It was after lunch that the system failed.'],
    commonMistake: { wrong: 'What I need it is more time.', correct: 'What I need is more time.', note: 'The wh-clause itself is the subject, so do not add an extra it.' },
    quiz: [
      ['Emphasise “the timing”:', ['It was the timing that caused concern.', 'What the timing it caused concern.', 'The timing was that caused concern.'], 0, 'The it-cleft places the timing in the focus position.'],
      ['Complete: What surprised me ___ her calm response.', ['it was', 'was', 'that'], 1, 'The wh-clause What surprised me acts as the subject of was.'],
      ['Complete: It was Selin ___ solved the issue.', ['which', 'who', 'what'], 1, 'Who naturally links a focused person to the remaining clause.'],
    ],
  }),
  lesson({
    id: 'c1-participle-clauses', level: 'C1', category: 'clauses-and-linking', title: 'Participle clauses',
    explanation: 'Participle clauses compress information about time, reason, result or condition. Use verb-ing for an active simultaneous relation, having + participle for an earlier action, and a past participle for a passive relation. The understood subject should match the main clause subject.',
    formula: 'verb-ing / having + participle / past participle, main clause with same subject',
    examples: ['Knowing the area well, I took a shortcut.', 'Having completed the test, she checked her answers.', 'Viewed from above, the pattern becomes clear.'],
    commonMistake: { wrong: 'Walking home, the rain started.', correct: 'Walking home, I noticed the rain starting.', note: 'The opening clause must logically describe the main-clause subject.' },
    quiz: [
      ['Complete: ___ the data, we changed our conclusion.', ['Having reviewed', 'Reviewed by', 'Have reviewing'], 0, 'Having reviewed marks an active action completed before the change.'],
      ['Choose the sentence without a dangling participle.', ['Driving to work, the traffic was awful.', 'Driving to work, I encountered heavy traffic.', 'Driving to work, the road annoyed.'], 1, 'I is the person understood to be driving.'],
      ['Complete: ___ carefully, the device should last for years.', ['Using', 'Used', 'Having use'], 1, 'The device is passively used, so a past participle fits.'],
    ],
  }),
  lesson({
    id: 'c1-ellipsis-substitution', level: 'C1', category: 'clauses-and-linking', title: 'Ellipsis and substitution',
    explanation: 'Natural English often omits recoverable words or replaces them with do, so, one or ones. This avoids heavy repetition while keeping the contrast or connection clear.',
    formula: 'auxiliary substitution: subject + auxiliary; noun substitution: one/ones; clause substitution: so/not',
    examples: ['I can join, but Yusuf can’t.', 'The first proposal failed; the second one succeeded.', 'Will it work? I think so.'],
    commonMistake: { wrong: 'I don’t think it.', correct: 'I don’t think so.', note: 'Use so to substitute for a whole affirmative clause after think.' },
    quiz: [
      ['Complete: She said she would help, and she ___.', ['did so', 'did it help', 'so did help'], 0, 'Did so substitutes for helped and avoids repetition.'],
      ['Complete: I prefer the smaller ___.', ['it', 'one', 'so'], 1, 'One substitutes for a singular countable noun.'],
      ['Complete: Is the shop open? I hope ___.', ['one', 'it', 'so'], 2, 'So stands for the clause that the shop is open.'],
    ],
  }),
  lesson({
    id: 'c1-advanced-contrast', level: 'C1', category: 'clauses-and-linking', title: 'Advanced contrast and concession',
    explanation: 'Use much as or while before a clause to concede a point, whereas to set up a direct contrast, and nevertheless or nonetheless to introduce a surprising continuation. Keep their different grammatical patterns clear.',
    formula: 'much as/while + clause; clause, whereas + clause; sentence. Nevertheless, sentence.',
    examples: ['Much as I respect the plan, it is too costly.', 'The north grew rapidly, whereas the south remained stable.', 'The evidence was limited. Nevertheless, the team acted.'],
    commonMistake: { wrong: 'Despite I understand the reason, I disagree.', correct: 'While I understand the reason, I disagree.', note: 'Despite needs a noun phrase or -ing form; while can introduce a finite clause.' },
    quiz: [
      ['Complete: ___ I appreciate the effort, the result needs work.', ['Despite', 'Much as', 'Nevertheless of'], 1, 'Much as introduces a concessive clause.'],
      ['Complete: Sales rose, ___ costs remained unchanged.', ['whereas', 'despite', 'nonetheless of'], 0, 'Whereas directly contrasts two clauses.'],
      ['Choose the correct linker and punctuation.', ['The odds were poor. Nevertheless, we continued.', 'The odds were poor, despite we continued.', 'The odds were poor. Whereas, we continued.'], 0, 'Nevertheless can introduce a contrasting independent sentence.'],
    ],
  }),
  lesson({
    id: 'c1-unreal-time', level: 'C1', category: 'advanced-structures', title: 'Unreal time after wish, would rather and it’s time',
    explanation: 'English often shifts a verb one step into the past to signal psychological distance rather than past time. Use a past form after would rather someone else, as if/as though for an unreal comparison, and it’s time for a desired present action.',
    formula: 'would rather + subject + past; it is time + subject + past; as if + past/past perfect',
    examples: ['I’d rather you emailed me first.', 'It’s time we made a decision.', 'He talks as though he had witnessed it himself.'],
    commonMistake: { wrong: 'I’d rather you will wait outside.', correct: 'I’d rather you waited outside.', note: 'Use a past form for a present or future preference about another person.' },
    quiz: [
      ['Complete: It’s time we ___ the problem directly.', ['address', 'addressed', 'will address'], 1, 'The past form expresses that the action should happen now.'],
      ['Complete: I’d rather she ___ us tomorrow.', ['calls', 'called', 'will call'], 1, 'A past form follows would rather when the subjects differ.'],
      ['The comparison is unreal in the past. Complete: He acts as if he ___ everything.', ['had planned', 'plans', 'will plan'], 0, 'Past perfect creates distance from an unreal earlier event.'],
    ],
  }),
  lesson({
    id: 'c1-reporting-verb-patterns', level: 'C1', category: 'verb-patterns', title: 'Patterns with reporting verbs',
    explanation: 'Reporting verbs select different complements. Admit and deny take -ing; advise and remind take an object plus to-infinitive; suggest can take -ing or a that-clause; insist often takes on plus -ing or a that-clause.',
    formula: 'admit/deny + -ing; advise/remind + object + to-infinitive; suggest + -ing/that-clause',
    examples: ['He denied leaking the document.', 'She reminded me to attach the file.', 'They suggested taking a later train.'],
    commonMistake: { wrong: 'She suggested me to wait.', correct: 'She suggested that I wait.', note: 'Suggest does not take object + to-infinitive in this pattern.' },
    quiz: [
      ['Complete: The guide advised us ___ water.', ['bringing', 'to bring', 'bring that'], 1, 'Advise can take an object followed by a to-infinitive.'],
      ['Complete: He denied ___ the lock.', ['to break', 'breaking', 'break'], 1, 'Deny is followed by an -ing form.'],
      ['Choose the correct suggestion.', ['She suggested us to leave.', 'She suggested leaving early.', 'She suggested to us leave.'], 1, 'Suggest can be followed directly by an -ing form.'],
    ],
  }),
  lesson({
    id: 'c1-fronting-focus', level: 'C1', category: 'advanced-structures', title: 'Fronting for topic and focus',
    explanation: 'Move a complement, object or adverbial to the beginning to establish the topic or create contrast. Unlike negative inversion, ordinary fronting often keeps normal subject–verb order. Use it selectively because it is marked.',
    formula: 'fronted element + subject + verb; negative fronted element + auxiliary + subject',
    examples: ['This point I fully accept.', 'Far more difficult was the final stage.', 'Into the room walked the director.'],
    commonMistake: { wrong: 'This proposal do I support.', correct: 'This proposal I do support.', note: 'Ordinary object fronting does not require question-style inversion.' },
    quiz: [
      ['Choose the natural fronted structure.', ['That explanation I can accept.', 'That explanation can I accept.', 'That can explanation I accept.'], 0, 'Object fronting normally retains subject–auxiliary order.'],
      ['Complete: At the end of the corridor ___ a narrow staircase.', ['there was', 'was there?', 'did there'], 0, 'The locative phrase sets the scene; the clause remains declarative.'],
      ['Which fronting creates a strong contrast?', ['This option, I strongly recommend.', 'I this option strongly recommend.', 'Do this option I recommend.'], 0, 'Moving this option to the topic position highlights it.'],
    ],
  }),
  lesson({
    id: 'c1-nominalisation', level: 'C1', category: 'advanced-structures', title: 'Nominalisation in formal writing',
    explanation: 'Nominalisation turns an action or quality into a noun phrase, allowing formal writing to package information and connect ideas. Use it carefully: too many abstract nouns can hide who did what.',
    formula: 'verb/adjective clause → noun phrase: decide → decision; fail → failure; available → availability',
    examples: ['The committee’s rejection of the plan surprised us.', 'A reduction in costs remains possible.', 'Their rapid response prevented further damage.'],
    commonMistake: { wrong: 'The decide was unexpected.', correct: 'The decision was unexpected.', note: 'Use the correct noun form, not the base verb.' },
    quiz: [
      ['Nominalise: The company expanded rapidly.', ['The company’s rapid expansion', 'The company’s rapidly expand', 'The expanding rapid company'], 0, 'Expansion is the noun form and rapid modifies it.'],
      ['Complete: The sudden ___ of the service caused complaints.', ['unavailable', 'unavailability', 'unavailably'], 1, 'A noun is required after the adjective sudden.'],
      ['Choose the clearest formal sentence.', ['Their refusal to negotiate delayed the agreement.', 'They refusal negotiating delayed agreement.', 'Their refuse to negotiation delayed.'], 0, 'Refusal is the correct noun and takes a to-infinitive complement.'],
    ],
  }),
  lesson({
    id: 'c1-advanced-passive-forms', level: 'C1', category: 'advanced-structures', title: 'Advanced passive forms',
    explanation: 'Advanced passive clauses combine passive voice with modality and non-finite aspect. Use modal plus be for present or future obligation and possibility, modal plus have been for a possible or inferred past, and being or having been after verbs and prepositions.',
    formula: 'modal + be + participle; modal + have been + participle; being + participle; having been + participle',
    examples: ['The records must be kept for six years.', 'The warning may have been overlooked.', 'She resented having been excluded from the meeting.'],
    commonMistake: { wrong: 'The files should have encrypted earlier.', correct: 'The files should have been encrypted earlier.', note: 'A modal perfect passive requires modal plus have been plus a past participle.' },
    quiz: [
      ['Complete: The decision ___ before Friday.', ['must review', 'must be reviewed', 'must be reviewing'], 1, 'A modal passive uses must plus be plus the past participle reviewed.'],
      ['Complete: The package may ___ to the wrong address.', ['have been sent', 'have sent', 'be sending'], 0, 'A modal perfect passive uses may plus have been plus a past participle.'],
      ['Complete: He objected to ___ without explanation.', ['being dismissed', 'be dismissed', 'have dismiss'], 0, 'The preposition to is followed by the passive gerund being dismissed.'],
    ],
  }),
  lesson({
    id: 'b2-sentence-boundaries', level: 'B2', category: 'clauses-and-linking', title: 'Sentence boundaries: fragments, run-ons and complete clauses',
    explanation: 'A complete independent clause normally needs a subject and a finite verb. Do not join two independent clauses with only a comma. Use a full stop, a semicolon, or a coordinating conjunction; attach dependent fragments to a complete clause.',
    formula: 'independent clause. Independent clause. / clause; clause / clause, and/but/so clause',
    examples: ['The deadline moved, so we revised the plan.', 'The evidence was limited; the conclusion remained cautious.', 'Because the train was late, we called the client.'],
    commonMistake: { wrong: 'The deadline moved, we revised the plan.', correct: 'The deadline moved, so we revised the plan.', note: 'A comma alone cannot normally join two independent clauses.' },
    quiz: [
      ['Which option has a complete sentence boundary?', ['The server failed, we used the backup.', 'The server failed; we used the backup.', 'Because the server failed.'], 1, 'A semicolon can join two closely related independent clauses.'],
      ['Which item is a fragment?', ['Although the figures improved.', 'The figures improved.', 'The figures improved, but costs rose.'], 0, 'Although makes the clause dependent, so it needs a main clause.'],
      ['Complete the logical sentence: The sample was small, ___ the result should be treated cautiously.', ['because', 'so', 'although'], 1, 'So coordinates the result with the preceding independent clause.'],
    ],
  }),
  lesson({
    id: 'b2-punctuation-clause-logic', level: 'B2', category: 'clauses-and-linking', title: 'Punctuation that shows clause logic',
    explanation: 'Punctuation helps readers see how clauses relate. Put a comma after a long introductory dependent clause, use paired commas for non-essential information, and use a semicolon before a linking adverb such as however when it connects two independent clauses.',
    formula: 'introductory clause, main clause; clause; however, clause; noun, non-essential clause, rest',
    examples: ['Although demand fell, prices remained stable.', 'The revised plan, which arrived yesterday, is clearer.', 'The evidence was incomplete; however, the team published it.'],
    commonMistake: { wrong: 'The evidence was incomplete, however the team published it.', correct: 'The evidence was incomplete; however, the team published it.', note: 'Use a semicolon or full stop before however when both sides are independent clauses.' },
    quiz: [
      ['Choose the correctly punctuated contrast.', ['Costs fell, however profits did not rise.', 'Costs fell; however, profits did not rise.', 'Costs fell however; profits did not rise.'], 1, 'A semicolon separates the independent clauses and a comma follows however.'],
      ['Which sentence marks non-essential information correctly?', ['Maya who leads the team approved it.', 'Maya, who leads the team, approved it.', 'Maya who leads, the team approved it.'], 1, 'The non-essential relative clause is enclosed by paired commas.'],
      ['Which version marks the end of the long introductory clause with a comma?', ['When the review ended after three hours of discussion we published the report.', 'When the review ended after three hours of discussion, we published the report.', 'When, the review ended after three hours of discussion we published the report.'], 1, 'A comma clearly marks the end of this long introductory dependent clause.'],
    ],
  }),
] as const

const combinedGrammarLessons: readonly GrammarLesson[] = [
  ...coreGrammarAcademyLessons,
  ...grammarAcademyExpansionLessons,
]

function stableQuestionHash(value: string): number {
  let hash = 2_166_136_261
  for (const character of value) {
    hash ^= character.codePointAt(0)!
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function moveAnswer(question: GrammarQuizQuestion, answerIndex: 0 | 1 | 2): GrammarQuizQuestion {
  const choices = [...question.choices] as [string, string, string]
  const correctChoice = choices[question.answerIndex]
  choices[question.answerIndex] = choices[answerIndex]
  choices[answerIndex] = correctChoice
  return { ...question, choices, answerIndex }
}

function independentQuizOrder(lesson: GrammarLesson): GrammarLesson {
  const quiz = lesson.quiz.map((question, index) => {
    const answerIndex = (stableQuestionHash(`${question.id}:catalog:${index}`) % 3) as 0 | 1 | 2
    return moveAnswer(question, answerIndex)
  }) as GrammarLesson['quiz']
  return { ...lesson, quiz }
}

/** Remaps each key independently on every attempt so a second pass cannot reuse
 * the positions revealed by the first one. The question wording stays authored. */
export function grammarQuizForAttempt(lesson: GrammarLesson, attempt: number): GrammarLesson['quiz'] {
  return lesson.quiz.map((question) => {
    const questionHash = stableQuestionHash(question.id)
    const stride = 1 + questionHash % 2
    const answerIndex = ((questionHash + Math.max(0, attempt) * stride) % 3) as 0 | 1 | 2
    return moveAnswer(question, answerIndex)
  }) as GrammarLesson['quiz']
}

/** Stable identity of the answer-choice layout used by one quiz attempt. */
export function grammarQuizVariantKey(lesson: GrammarLesson, attempt: number): string {
  return grammarQuizForAttempt(lesson, attempt)
    .map((question) => `${question.id}:${question.choices.join('\u001f')}`)
    .join('\u001e')
}

// Prerequisite order for the learner's first level. The expansion contains
// foundational forms, so source-file order is not a pedagogical sequence.
const A2_PREREQUISITE_ORDER = [
  'a2-be-forms', 'a2-present-simple', 'a2-present-continuous', 'a2-present-simple-v-continuous',
  'a2-do-or-be-questions', 'a2-question-forms', 'a2-subject-object-questions', 'a2-short-answers',
  'a2-pronouns-possessives', 'a2-demonstratives', 'a2-one-and-ones', 'a2-there-is-it-is',
  'a2-plural-nouns', 'a2-articles', 'a2-countable-quantifiers', 'a2-indefinite-pronouns',
  'a2-possessive-s', 'a2-indirect-objects', 'a2-adjectives-or-adverbs', 'a2-adjective-order',
  'a2-ed-ing-adjectives', 'a2-comparatives-superlatives', 'a2-as-as-comparisons', 'a2-frequency-adverbs',
  'a2-prepositions-time-place', 'a2-movement-prepositions', 'a2-dependent-prepositions',
  'a2-past-simple', 'a2-past-continuous', 'a2-sequence-linkers', 'a2-present-perfect-basics',
  'a2-future-choices', 'a2-basic-modals', 'a2-have-to-mustnt', 'a2-requests-and-offers',
  'a2-would-like', 'a2-verb-patterns', 'a2-infinitive-purpose', 'a2-imperatives-instructions',
] as const
const a2Order = new Map<string, number>(A2_PREREQUISITE_ORDER.map((id, index) => [id, index]))

const B1_PREREQUISITE_ORDER = [
  'b1-present-perfect-v-past', 'b1-present-perfect-since-for', 'b1-just-already-yet-still',
  'b1-present-perfect-continuous', 'b1-past-perfect', 'b1-narrative-tenses', 'b1-past-habits',
  'b1-future-time-clauses', 'b1-zero-first-second-conditionals',
  'b1-modals-possibility', 'b1-modals-deduction', 'b1-past-ability', 'b1-need-and-necessity',
  'b1-passive-basics', 'b1-defining-relative-clauses', 'b1-reported-statements',
  'b1-reported-questions', 'b1-reported-commands', 'b1-embedded-questions', 'b1-question-tags',
  'b1-linking-reason-result-purpose', 'b1-contrast-linkers', 'b1-phrasal-verb-order',
  'b1-make-let-allow', 'b1-verb-object-infinitive', 'b1-be-get-used-to',
  'b1-reflexive-pronouns', 'b1-both-either-neither', 'b1-each-every-all',
  'b1-most-and-most-of', 'b1-articles-geographical-names', 'b1-enough-too',
  'b1-so-and-such', 'b1-so-neither-agreement',
] as const
const b1Order = new Map<string, number>(B1_PREREQUISITE_ORDER.map((id, index) => [id, index]))

export const grammarAcademyLessons: readonly GrammarLesson[] = [
  ...combinedGrammarLessons
    .filter((lesson) => lesson.level === 'A2')
    .sort((left, right) => (a2Order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (a2Order.get(right.id) ?? Number.MAX_SAFE_INTEGER)),
  ...combinedGrammarLessons
    .filter((lesson) => lesson.level === 'B1')
    .sort((left, right) => (b1Order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (b1Order.get(right.id) ?? Number.MAX_SAFE_INTEGER)),
  ...combinedGrammarLessons.filter((lesson) => lesson.level !== 'A2' && lesson.level !== 'B1'),
].map(independentQuizOrder)
