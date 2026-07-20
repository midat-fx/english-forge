import { catalogItems } from '../domain/lexicalCatalog'
import { expansionRows, type ExpansionGroup } from './lexicalCatalogB1ExpansionShared'

const groups = [
  ['provide', 'provide', 'collocation', 'work', 'neutral', 'give or make available', 'when it is needed', 'когда это понадобится', [
    ['information', 'предоставить информацию'], ['support', 'оказать поддержку'], ['a service', 'оказать услугу'],
    ['evidence', 'предоставить доказательства'], ['the details', 'предоставить подробности'], ['advice', 'дать совет'],
    ['training', 'провести обучение'], ['access', 'предоставить доступ'], ['an opportunity', 'предоставить возможность'],
    ['a solution', 'предложить решение'], ['feedback', 'дать обратную связь'], ['an explanation', 'предоставить объяснение'],
    ['equipment', 'предоставить оборудование'], ['protection', 'обеспечить защиту'],
  ]],
  ['reach', 'reach', 'collocation', 'achievement', 'neutral', 'arrive at, achieve, or finally agree on', 'after steady work', 'после последовательной работы', [
    ['a goal', 'достичь цели'], ['a target', 'достичь целевого показателя'], ['a conclusion', 'прийти к выводу'],
    ['a decision', 'принять решение'], ['a destination', 'добраться до места назначения'], ['a final agreement', 'достичь окончательного соглашения'],
    ['a compromise', 'достичь компромисса'], ['a level', 'достичь уровня'], ['a wider audience', 'охватить более широкую аудиторию'],
    ['a customer', 'связаться с клиентом'], ['a limit', 'достичь предела'], ['a stage', 'достичь этапа'],
    ['the top', 'добраться до вершины'], ['an understanding', 'достичь взаимопонимания'],
  ]],
  ['receive', 'receive', 'collocation', 'communication', 'neutral', 'get or be given', 'through the usual channel', 'по обычному каналу', [
    ['a message', 'получить сообщение'], ['an email', 'получить электронное письмо'], ['a payment', 'получить платёж'],
    ['an order', 'получить заказ'], ['a reply', 'получить ответ'], ['support', 'получить поддержку'],
    ['advice', 'получить совет'], ['an invitation', 'получить приглашение'], ['an offer', 'получить предложение'],
    ['confirmation', 'получить подтверждение'], ['a package', 'получить посылку'], ['feedback', 'получить обратную связь'],
    ['training', 'пройти обучение'], ['treatment', 'получить лечение'],
  ]],
  ['reduce', 'reduce', 'collocation', 'improvement', 'neutral', 'make smaller or less:', 'without lowering quality', 'без снижения качества', [
    ['the cost', 'снизить стоимость'], ['the risk', 'снизить риск'], ['stress', 'снизить стресс'],
    ['waste', 'сократить отходы'], ['pollution', 'снизить загрязнение'], ['traffic', 'уменьшить дорожное движение'],
    ['the price', 'снизить цену'], ['the time', 'сократить время'], ['the amount', 'уменьшить количество'],
    ['energy use', 'сократить потребление энергии'], ['pressure', 'снизить давление'], ['noise', 'снизить уровень шума'],
    ['screen time', 'сократить экранное время'], ['the workload', 'снизить рабочую нагрузку'],
  ]],
  ['remember', 'remember', 'collocation', 'memory', 'neutral', 'keep in your memory or recall', 'when it matters', 'когда это важно', [
    ['a name', 'запомнить имя'], ['a detail', 'запомнить деталь'], ['a rule', 'запомнить правило'],
    ['a password', 'запомнить пароль'], ['an appointment', 'помнить о записи'], ['an address', 'запомнить адрес'],
    ['a date', 'запомнить дату'], ['a phrase', 'запомнить фразу'], ['a fact', 'запомнить факт'],
    ['an instruction', 'запомнить инструкцию'], ['a face', 'запомнить лицо'], ['an experience', 'помнить о пережитом опыте'],
    ['the reason', 'помнить причину'], ['the difference', 'помнить разницу'],
  ]],
  ['report', 'report', 'collocation', 'communication', 'neutral', 'officially give information about', 'as soon as possible', 'как можно скорее', [
    ['a problem', 'сообщить о проблеме'], ['a crime', 'сообщить о преступлении'], ['an accident', 'сообщить о происшествии'],
    ['an error', 'сообщить об ошибке'], ['an issue', 'сообщить о неполадке'], ['a result', 'сообщить результат'],
    ['a change', 'сообщить об изменении'], ['progress', 'отчитаться о ходе работы'], ['damage', 'сообщить о повреждении'],
    ['a loss', 'сообщить о потере'], ['a symptom', 'сообщить о симптоме'], ['an incident', 'сообщить об инциденте'],
    ['a bug', 'сообщить об ошибке в программе'], ['suspicious activity', 'сообщить о подозрительной активности'],
  ]],
  ['request', 'request', 'collocation', 'communication', 'formal', 'formally ask for', 'through the correct channel', 'через соответствующий канал', [
    ['information', 'запросить информацию'], ['a refund', 'запросить возврат денег'], ['help', 'запросить помощь'],
    ['support', 'запросить поддержку'], ['a payment', 'запросить оплату'], ['a copy', 'запросить копию'],
    ['a change', 'запросить изменение'], ['a meeting', 'запросить встречу'], ['an extension', 'попросить продлить срок'],
    ['a replacement', 'запросить замену'], ['a review', 'запросить пересмотр'], ['access', 'запросить доступ'],
    ['a document', 'запросить документ'], ['confirmation', 'запросить подтверждение'],
  ]],
  ['research', 'research', 'collocation', 'learning', 'neutral', 'study carefully to learn more about', 'before taking action', 'до начала действий', [
    ['a topic', 'изучить тему'], ['the market', 'изучить рынок'], ['a product', 'изучить продукт'],
    ['a company', 'изучить компанию'], ['an option', 'изучить вариант'], ['a destination', 'изучить место назначения'],
    ['a course', 'изучить курс'], ['a problem', 'исследовать проблему'], ['the history', 'изучить историю'],
    ['customer needs', 'изучить потребности клиентов'], ['a trend', 'исследовать тенденцию'], ['a method', 'исследовать метод'],
    ['the background', 'изучить предысторию'], ['a solution', 'исследовать решение'],
  ]],
  ['review', 'review', 'collocation', 'work', 'neutral', 'examine again in order to assess', 'before approving it', 'перед утверждением', [
    ['a report', 'проверить отчёт'], ['a document', 'проверить документ'], ['a plan', 'пересмотреть план'],
    ['a result', 'проанализировать результат'], ['performance', 'оценить эффективность'], ['progress', 'оценить прогресс'],
    ['an application', 'рассмотреть заявку'], ['a contract', 'проверить договор'], ['a budget', 'пересмотреть бюджет'],
    ['a policy', 'пересмотреть политику'], ['feedback', 'изучить обратную связь'], ['an option', 'пересмотреть вариант'],
    ['your notes', 'повторить свои записи'], ['a decision', 'пересмотреть решение'],
  ]],
  ['save', 'save', 'collocation', 'organisation', 'neutral', 'keep, store, or avoid wasting', 'for later', 'на будущее', [
    ['money', 'экономить деньги'], ['time', 'сэкономить время'], ['energy', 'сберечь энергию'],
    ['a file', 'сохранить файл'], ['a document', 'сохранить документ'], ['a copy', 'сохранить копию'],
    ['a contact', 'сохранить контакт'], ['a password', 'сохранить пароль'], ['your progress', 'сохранить свой прогресс'],
    ['a receipt', 'сохранить чек'], ['the date', 'запомнить дату', 'record a date so that you remember it later'], ['a place', 'сохранить место', 'store a location or reserve a position for later'],
    ['a resource', 'сохранить ресурс'], ['your work', 'сохранить свою работу'],
  ]],
  ['share', 'share', 'collocation', 'communication', 'neutral', 'give part of or communicate', 'with the group', 'с группой', [
    ['an idea', 'поделиться идеей'], ['information', 'поделиться информацией'], ['an experience', 'поделиться опытом'],
    ['an opinion', 'поделиться мнением'], ['a file', 'поделиться файлом'], ['a photo', 'поделиться фотографией'],
    ['responsibility', 'разделить ответственность'], ['the cost', 'разделить расходы'], ['a problem', 'поделиться проблемой'],
    ['a result', 'поделиться результатом'], ['a plan', 'поделиться планом'], ['feedback', 'поделиться обратной связью'],
    ['a link', 'поделиться ссылкой'], ['a story', 'поделиться историей'],
  ]],
  ['spend', 'spend', 'collocation', 'time', 'neutral', 'devote or use', 'wisely', 'разумно', [
    ['time', 'провести время', undefined, {
      example: 'I try to spend time outdoors after a long workday.',
      exampleTranslationRu: 'После долгого рабочего дня я стараюсь проводить время на свежем воздухе.',
    }],
    ['money', 'тратить деньги', undefined, {
      example: 'It is easy to spend money quickly when you shop online.',
      exampleTranslationRu: 'При покупках в интернете легко быстро потратить деньги.',
      topic: 'money',
    }],
    ['a day', 'провести день', undefined, {
      example: 'We plan to spend a day exploring the old town.',
      exampleTranslationRu: 'Мы планируем провести день, исследуя старый город.',
    }],
    ['a week', 'провести неделю', undefined, {
      example: 'She decided to spend a week preparing for the examination.',
      exampleTranslationRu: 'Она решила провести неделю, готовясь к экзамену.',
    }],
    ['an evening', 'провести вечер', undefined, {
      example: 'I would like to spend an evening reviewing the final draft.',
      exampleTranslationRu: 'Я хотел бы провести вечер за проверкой окончательного варианта.',
    }],
    ['a holiday', 'провести отпуск', undefined, {
      example: 'They plan to spend a holiday near the coast.',
      exampleTranslationRu: 'Они планируют провести отпуск недалеко от побережья.',
    }],
    ['your break', 'провести перерыв', undefined, {
      example: 'Try to spend your break away from the computer screen.',
      exampleTranslationRu: 'Постарайтесь провести перерыв вдали от экрана компьютера.',
    }],
    ['the budget', 'потратить бюджет', undefined, {
      example: 'The department must spend the budget before the financial year ends.',
      exampleTranslationRu: 'Отдел должен потратить бюджет до окончания финансового года.',
      topic: 'money',
    }],
    ['energy', 'тратить силы', undefined, {
      example: 'Do not spend energy worrying about things you cannot change.',
      exampleTranslationRu: 'Не тратьте силы на переживания о том, чего нельзя изменить.',
    }],
    ['time and effort', 'потратить время и силы', undefined, {
      example: 'We need to spend time and effort improving the onboarding guide.',
      exampleTranslationRu: 'Нам нужно потратить время и силы на улучшение руководства для новых сотрудников.',
    }],
    ['an hour', 'провести час', undefined, {
      example: 'I had to spend an hour checking the final figures.',
      exampleTranslationRu: 'Мне пришлось провести час за проверкой итоговых цифр.',
    }],
    ['a weekend', 'провести выходные', undefined, {
      example: 'We hope to spend a weekend visiting our relatives.',
      exampleTranslationRu: 'Мы надеемся провести выходные в гостях у родственников.',
    }],
    ['the night', 'провести ночь', undefined, {
      example: 'They had to spend the night at an airport hotel.',
      exampleTranslationRu: 'Им пришлось провести ночь в гостинице возле аэропорта.',
    }],
    ['the summer', 'провести лето', undefined, {
      example: 'He plans to spend the summer working at a language camp.',
      exampleTranslationRu: 'Он планирует провести лето, работая в языковом лагере.',
    }],
  ]],
  ['start', 'start', 'collocation', 'plans', 'neutral', 'begin or set in motion', 'at the agreed time', 'в согласованное время', [
    ['a job', 'начать работу'], ['a course', 'начать курс'], ['a project', 'начать проект'],
    ['a conversation', 'начать разговор'], ['a business', 'открыть бизнес'], ['a journey', 'начать путешествие'],
    ['a process', 'начать процесс'], ['a meeting', 'начать встречу'], ['a routine', 'начать придерживаться распорядка'],
    ['an exercise', 'начать упражнение'], ['training', 'начать обучение'], ['an application', 'начать заполнять заявку'],
    ['the engine', 'запустить двигатель'], ['a relationship', 'начать отношения'],
  ]],
  ['support', 'support', 'collocation', 'relationships', 'neutral', 'help, encourage, or agree with', 'when help is needed', 'когда нужна помощь', [
    ['a team', 'поддержать команду'], ['a colleague', 'поддержать коллегу'], ['a friend', 'поддержать друга'],
    ['your family', 'поддержать свою семью'], ['a customer', 'поддержать клиента'], ['a project', 'поддержать проект'],
    ['an idea', 'поддержать идею'], ['a decision', 'поддержать решение'], ['a community', 'поддержать сообщество'],
    ['a business', 'поддержать бизнес'], ['a student', 'поддержать студента'], ['a cause', 'поддержать важное дело'],
    ['a plan', 'поддержать план'], ['development', 'поддержать развитие'],
  ]],
  ['take', 'take', 'collocation', 'actions', 'neutral', 'perform, use, board, consume, or participate in', 'at the right moment', 'в подходящий момент', [
    ['a short break', 'сделать короткий перерыв', 'stop working briefly in order to rest'], ['action', 'принять меры', 'do something practical in response to a situation'], ['a note', 'сделать запись', 'write down a short piece of information'],
    ['a photo', 'сделать фотографию', 'use a camera to produce a photograph'], ['a seat', 'сесть', 'sit down in an available place'], ['a bus', 'сесть на автобус', 'travel somewhere using a bus'],
    ['a train', 'сесть на поезд', 'travel somewhere using a train'], ['a chance', 'воспользоваться шансом', 'accept an opportunity despite possible uncertainty'], ['a step', 'сделать шаг', 'perform one action toward a larger goal'],
    ['a safety measure', 'принять меру безопасности', 'perform an action intended to improve safety'], ['a course', 'пройти курс', 'study as a participant on a course'], ['an exam', 'сдать экзамен', 'sit or complete an official examination'],
    ['medicine', 'принять лекарство', 'swallow or use medicine as directed'], ['part', 'принять участие', 'participate in an activity or event'],
  ]],
  ['track', 'track', 'collocation', 'organisation', 'neutral', 'regularly record or follow', 'over time', 'на протяжении времени', [
    ['your progress', 'отслеживать свой прогресс'], ['an order', 'отслеживать заказ'], ['a delivery', 'отслеживать доставку'],
    ['your spending', 'отслеживать свои расходы'], ['your time', 'отслеживать своё время'], ['a habit', 'отслеживать привычку'],
    ['performance', 'отслеживать эффективность'], ['a change', 'отслеживать изменение'], ['a location', 'отслеживать местоположение'],
    ['a result', 'отслеживать результат'], ['a goal', 'отслеживать достижение цели'], ['your workouts', 'отслеживать свои тренировки'],
    ['your sleep', 'отслеживать свой сон'], ['an application', 'отслеживать заявку'],
  ]],
  ['try', 'try', 'collocation', 'learning', 'neutral', 'test or make an effort with', 'before deciding', 'перед принятием решения', [
    ['a new method', 'попробовать новый метод'], ['a different approach', 'попробовать другой подход'], ['a recipe', 'попробовать рецепт'],
    ['an activity', 'попробовать занятие'], ['another route', 'попробовать другой маршрут'], ['a product', 'попробовать продукт'],
    ['an exercise', 'попробовать упражнение'], ['a solution', 'попробовать решение'], ['an option', 'попробовать вариант'],
    ['a service', 'попробовать услугу'], ['a course', 'попробовать курс'], ['a technique', 'попробовать приём'],
    ['a different size', 'примерить другой размер', undefined, {
      example: 'I decided to try a different size because the first jacket was too tight.',
      exampleTranslationRu: 'Я решил примерить другой размер, потому что первая куртка была слишком тесной.',
    }],
    ['again', 'попробовать снова'],
  ]],
  ['understand', 'understand', 'collocation', 'learning', 'neutral', 'know the meaning, reason, or nature of', 'before responding', 'перед ответом', [
    ['the question', 'понять вопрос'], ['the problem', 'понять проблему'], ['the rule', 'понять правило'],
    ['the reason', 'понять причину'], ['the difference', 'понять разницу'], ['the process', 'понять процесс'],
    ['the situation', 'понять ситуацию'], ['the instruction', 'понять инструкцию'], ['the meaning', 'понять значение'],
    ['the culture', 'понять культуру'], ['the system', 'понять систему'], ['the result', 'понять результат'],
    ['the point', 'понять суть'], ['the concern', 'понять причину беспокойства'],
  ]],
  ['update', 'update', 'collocation', 'technology', 'neutral', 'add current information to', 'when something changes', 'при изменении данных', [
    ['your profile', 'обновить свой профиль'], ['the software', 'обновить программу'], ['the app', 'обновить приложение'],
    ['a record', 'обновить запись'], ['a document', 'обновить документ'], ['the information', 'обновить информацию'],
    ['the schedule', 'обновить расписание'], ['the plan', 'обновить план'], ['your account', 'обновить учётную запись'],
    ['your password', 'обновить пароль'], ['your address', 'обновить адрес'], ['your status', 'обновить статус'],
    ['the list', 'обновить список'], ['the website', 'обновить сайт'],
  ]],
  ['use', 'use', 'collocation', 'independent-life', 'neutral', 'employ for a particular purpose:', 'in the appropriate situation', 'в подходящей ситуации', [
    ['an app', 'использовать приложение'], ['a tool', 'использовать инструмент'], ['a method', 'использовать метод'],
    ['a system', 'использовать систему'], ['a service', 'использовать услугу'], ['equipment', 'использовать оборудование'],
    ['English', 'использовать английский язык'], ['a phrase', 'использовать фразу'], ['an example', 'использовать пример'],
    ['data', 'использовать данные'], ['information', 'использовать информацию'], ['a password', 'использовать пароль'],
    ['a map', 'использовать карту'], ['public transport', 'пользоваться общественным транспортом'],
  ]],
] as const satisfies readonly ExpansionGroup[]

export const lexicalCatalogB1Expansion3 = catalogItems('B1', expansionRows(groups, 40))
