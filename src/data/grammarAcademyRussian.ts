import { grammarAcademyExpansionExplanationRu } from './grammarAcademyExpansionRussian'

const coreGrammarExplanationRu: Record<string, string> = {
  'a2-present-simple': 'Present Simple нужен для привычек, расписаний и постоянных фактов. С he, she и it к глаголу обычно добавляется -s.',
  'a2-present-continuous': 'Present Continuous описывает действие прямо сейчас или временную ситуацию. Используйте am/is/are и форму глагола с -ing.',
  'a2-present-simple-v-continuous': 'Present Simple говорит о регулярном, а Present Continuous — о происходящем сейчас или временно. Смотрите на смысл и маркеры времени.',
  'a2-past-simple': 'Past Simple описывает законченное действие в прошлом. У правильных глаголов появляется -ed, а неправильные формы нужно запоминать.',
  'a2-past-continuous': 'Past Continuous показывает процесс в конкретный момент прошлого. Часто он задаёт фон для короткого действия в Past Simple.',
  'a2-present-perfect-basics': 'Present Perfect связывает прошлое с настоящим: опыт, свежий результат или период, который ещё продолжается. Используйте have/has + третью форму.',
  'a2-future-choices': 'Going to обычно показывает план или очевидный прогноз, will — решение в момент речи и нейтральный прогноз, Present Continuous — договорённость.',
  'a2-question-forms': 'В вопросах вспомогательный глагол ставится перед подлежащим. После do/does/did основной глагол остаётся в базовой форме.',
  'a2-articles': 'A/an вводит один неспецифичный предмет, the указывает на конкретный или уже известный, а нулевой артикль часто нужен для общих множественных понятий.',
  'a2-countable-quantifiers': 'Countable nouns можно считать, uncountable обычно нельзя. Many/few относятся к исчисляемым, much/little — к неисчисляемым.',
  'a2-comparatives-superlatives': 'Сравнительная степень сопоставляет два объекта, превосходная выделяет один из группы. Короткие прилагательные получают -er/-est.',
  'a2-ed-ing-adjectives': 'Прилагательное на -ed описывает чувство человека, а форма на -ing — то, что вызывает это чувство: bored и boring.',
  'a2-basic-modals': 'Can, could, should и must выражают способность, вежливую просьбу, совет или строгую необходимость. После модального глагола используется базовая форма без to.',
  'a2-have-to-mustnt': 'Have to означает необходимость, mustn’t — запрет, а don’t have to — отсутствие необходимости. Эти значения нельзя смешивать.',
  'a2-prepositions-time-place': 'At, on и in выбираются по масштабу времени и места: at для точки, on для поверхности/дня, in для пространства/периода.',
  'a2-there-is-it-is': 'There is/are сообщает, что что-то существует, а it is описывает уже известный предмет, время, погоду или ситуацию.',
  'a2-verb-patterns': 'С like, love и enjoy используйте форму -ing; с want, need и would like — infinitive с to. Учите глагол сразу вместе с его моделью.',
  'a2-infinitive-purpose': 'Чтобы объяснить цель действия, используйте to + базовую форму глагола: I called to ask. На этом уровне отрабатывайте эту простую утвердительную модель.',
  'a2-pronouns-possessives': 'Subject pronouns стоят перед глаголом, object pronouns — после глагола или предлога. Mine/yours заменяют существительное целиком.',
  'a2-frequency-adverbs': 'Usually, often и never стоят перед обычным глаголом, но после be. Once a week и похожие выражения чаще идут в конце.',
  'a2-imperatives-instructions': 'Инструкция начинается с базовой формы глагола без подлежащего. Для запрета используйте don’t, а please делает просьбу вежливее.',
  'a2-movement-prepositions': 'To, into, out of, across, along и past показывают направление движения. Выбирайте предлог по траектории, а не только по месту.',
  'a2-indefinite-pronouns': 'Some- обычно встречается в утверждениях, any- — в вопросах и отрицаниях. Nobody и nothing уже имеют отрицательное значение.',
  'b1-present-perfect-v-past': 'Past Simple нужен с законченным временем, а Present Perfect — когда точное время неважно, период ещё продолжается или важен текущий результат.',
  'b1-present-perfect-continuous': 'Present Perfect Continuous подчёркивает длительность или процесс до настоящего момента: have/has been + verb-ing.',
  'b1-past-perfect': 'Past Perfect отмечает более раннее из двух прошлых событий. Используйте had + третью форму, чтобы порядок был понятен.',
  'b1-past-habits': 'Used to подходит для прошлых состояний и привычек, которых больше нет. Would описывает повторяющиеся действия, но обычно не состояния.',
  'b1-zero-first-second-conditionals': 'Zero conditional — общий факт, first — реальная будущая возможность, second — воображаемая или маловероятная ситуация.',
  'b1-passive-basics': 'Passive нужен, когда важнее действие или результат, а не исполнитель. Поставьте be в нужное время и добавьте третью форму глагола.',
  'b1-reported-statements': 'В косвенной речи время часто сдвигается назад: present становится past, will — would. Местоимения и маркеры времени тоже меняются по смыслу.',
  'b1-reported-questions': 'В reported questions порядок слов становится утвердительным, без do/does/did. Общий вопрос вводится if или whether.',
  'b1-defining-relative-clauses': 'Defining relative clause уточняет, о каком человеке или предмете речь. Используйте who, which или that без запятых.',
  'b1-modals-deduction': 'Must выражает сильную уверенность, might/could — возможность, can’t — уверенность в невозможности. После них идёт базовая форма.',
  'b1-question-tags': 'Question tag превращает утверждение в короткий вопрос. Положительное предложение обычно получает отрицательный хвост и наоборот.',
  'b1-linking-reason-result-purpose': 'Because вводит причину-предложение, because of — существительное, so показывает результат, so that — цель.',
  'b1-contrast-linkers': 'Although/even though ставятся перед предложением, despite/in spite of — перед существительным или -ing, however связывает отдельные мысли.',
  'b1-phrasal-verb-order': 'У separable phrasal verbs существительное может стоять в двух позициях, но местоимение обязательно помещается между глаголом и частицей.',
  'b1-reflexive-pronouns': 'Myself, yourself и другие reflexive pronouns нужны, когда субъект и объект совпадают. By myself означает «самостоятельно/в одиночку».',
  'b1-enough-too': 'Too означает чрезмерность и часто проблему, enough — достаточное количество. Enough стоит после прилагательного, но перед существительным.',
}

export const grammarExplanationRu: Record<string, string> = {
  ...coreGrammarExplanationRu,
  ...grammarAcademyExpansionExplanationRu,
}

export function russianGrammarExplanation(lessonId: string): string | undefined {
  return grammarExplanationRu[lessonId]
}
