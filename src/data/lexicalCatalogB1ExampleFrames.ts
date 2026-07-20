type Scenario = readonly [leadEn: string, tailEn: string, leadRu: string, tailRu: string]

const groupScenarios: Readonly<Record<string, readonly [Scenario, Scenario]>> = {
  accept: [
    ['After considering the situation, we decided to ', '', 'Рассмотрев ситуацию, мы решили ', ''],
    ['Mina had enough information to ', '', 'У Мины было достаточно информации, чтобы ', ''],
  ],
  arrange: [
    ['The coordinator called this morning to ', '', 'Координатор позвонил сегодня утром, чтобы ', ''],
    ['We still have enough time to ', ' before Friday', 'У нас ещё достаточно времени, чтобы ', ' до пятницы'],
  ],
  attend: [
    ['Mina plans to ', ' next week', 'Мина планирует ', ' на следующей неделе'],
    ['Please arrive early if you are going to ', '', 'Приходите заранее, если собираетесь ', ''],
  ],
  avoid: [
    ['Careful planning can help us ', '', 'Тщательное планирование поможет нам ', ''],
    ['The guide suggests a practical way to ', '', 'В руководстве предложен практичный способ ', ''],
  ],
  book: [
    ['We decided to ', ' before prices rise', 'Мы решили ', ' до повышения цен'],
    ['Mina used the travel website to ', '', 'Мина воспользовалась туристическим сайтом, чтобы ', ''],
  ],
  build: [
    ['The project gave Mina a chance to ', '', 'Проект дал Мине возможность ', ''],
    ['We set a realistic goal to ', ' over time', 'Мы поставили реалистичную цель — ', ' со временем'],
  ],
  cancel: [
    ['The help page shows what to do if you need to ', '', 'На странице помощи объясняется, что делать, если вам нужно ', ''],
    ['The confirmation email explains how to ', '', 'В письме с подтверждением объясняется, как ', ''],
  ],
  change: [
    ['After reviewing the new information, you may decide to ', '', 'Изучив новые сведения, вы можете решить ', ''],
    ['Please contact us if you need to ', '', 'Свяжитесь с нами, если вам нужно ', ''],
  ],
  check: [
    ['Before continuing, remember to ', '', 'Прежде чем продолжить, не забудьте ', ''],
    ['Take a moment to ', ' carefully', 'Найдите минуту, чтобы внимательно ', ''],
  ],
  choose: [
    ['The adviser helped Mina ', '', 'Консультант помог Мине ', ''],
    ['We compared several alternatives before we had to ', '', 'Мы сравнили несколько альтернатив, прежде чем пришлось ', ''],
  ],
  collect: [
    ['The team has until Friday to ', '', 'У команды есть время до пятницы, чтобы ', ''],
    ['The instructions explain where to ', '', 'В инструкции объясняется, где можно ', ''],
  ],
  compare: [
    ['Before making a decision, take time to ', '', 'Перед принятием решения найдите время, чтобы ', ''],
    ['The review gives us enough evidence to ', '', 'В обзоре достаточно данных, чтобы ', ''],
  ],
  complete: [
    ['Mina stayed late to ', ' by the deadline', 'Мина задержалась допоздна, чтобы ', ' к установленному сроку'],
    ['You have two days left to ', '', 'У вас осталось два дня, чтобы ', ''],
  ],
  confirm: [
    ['Before we proceed, we need to ', '', 'Прежде чем продолжить, нам нужно ', ''],
    ['The final screen asks you to ', '', 'На последнем экране вас просят ', ''],
  ],
  contact: [
    ['If you need more information, you can ', '', 'Если вам нужна дополнительная информация, можно ', ''],
    ['Mina decided to ', ' after the problem continued', 'Мина решила ', ', когда проблема не исчезла'],
  ],
  create: [
    ['The project requires us to ', ' by Friday', 'Для проекта нам нужно ', ' до пятницы'],
    ['The team now has the tools to ', '', 'Теперь у команды есть инструменты, чтобы ', ''],
  ],
  deliver: [
    ['The organisation promised to ', ' by Friday', 'Организация пообещала ', ' до пятницы'],
    ['The schedule shows when the team will ', '', 'В расписании указано, когда команда сможет ', ''],
  ],
  describe: [
    ['The interviewer asked Mina to ', ' in her own words', 'Интервьюер попросил Мину ', ' своими словами'],
    ['Use two or three sentences to ', ' clearly', 'Используйте два-три предложения, чтобы понятно ', ''],
  ],
  develop: [
    ['The project gave us time to ', '', 'В рамках проекта у нас было время, чтобы ', ''],
    ['The team worked for several months to ', '', 'Команда работала несколько месяцев, чтобы ', ''],
  ],
  discuss: [
    ["We will use tomorrow's meeting to ", '', 'На завтрашней встрече мы планируем ', ''],
    ['Mina asked for a quiet place to ', ' privately', 'Мина попросила найти тихое место, чтобы конфиденциально ', ''],
  ],
  improve: [
    ['The course gives you a clear plan to ', ' over the next month', 'На курсе вы получите чёткий план, как ', ' в течение следующего месяца'],
    ['Focused practice can help you ', '', 'Целенаправленная практика поможет вам ', ''],
  ],
  explain: [
    ['The teacher used an example to ', '', 'Учитель привёл пример, чтобы ', ''],
    ['Mina chose simple language to ', '', 'Мина выбрала простые слова, чтобы ', ''],
  ],
  find: [
    ['The guide offers practical ways to ', '', 'В руководстве предложены практичные способы ', ''],
    ['We changed our approach to ', ' without wasting time', 'Мы изменили подход, чтобы ', ', не теряя времени'],
  ],
  follow: [
    ['It became easier to ', ' after a short demonstration', 'После короткой демонстрации стало легче ', ''],
    ['Mina checked the details before she began to ', '', 'Мина проверила детали, прежде чем начала ', ''],
  ],
  handle: [
    ['The training taught us how to ', ' professionally', 'На обучении нам объяснили, как профессионально ', ''],
    ['Mina stayed calm while she had to ', '', 'Мина сохраняла спокойствие, когда ей пришлось ', ''],
  ],
  identify: [
    ['The review helped us ', ' at an early stage', 'Проверка помогла нам ', ' на раннем этапе'],
    ['Mina examined the evidence to ', '', 'Мина изучила данные, чтобы ', ''],
  ],
  join: [
    ['Mina plans to ', ' this month', 'Мина планирует ', ' в этом месяце'],
    ['The invitation explains how to ', '', 'В приглашении объясняется, как ', ''],
  ],
  keep: [
    ['It can be useful to ', '', 'Иногда полезно ', ''],
    ['The instructions explain how to ', ' for as long as necessary', 'В инструкции объясняется, как ', ' столько, сколько нужно'],
  ],
  learn: [
    ['The course gives you time to ', ' step by step', 'На курсе у вас будет время, чтобы шаг за шагом ', ''],
    ['Short daily sessions can help you ', '', 'Короткие ежедневные занятия помогут вам ', ''],
  ],
  manage: [
    ['The workshop explains how to ', ' effectively', 'На семинаре объясняется, как эффективно ', ''],
    ['A clear plan makes it easier to ', '', 'Чёткий план помогает ', ''],
  ],
  meet: [
    ['The team worked hard to ', ' by Friday', 'Команда усердно работала, чтобы ', ' к пятнице'],
    ['Mina changed her schedule so that she could ', '', 'Мина изменила расписание, чтобы ', ''],
  ],
  notice: [
    ['After comparing the two versions, Mina was able to ', '', 'Сравнив два варианта, Мина смогла ', ''],
    ['The reviewer looked closely enough to ', '', 'Проверяющий внимательно изучил материал и смог ', ''],
  ],
  offer: [
    ['After reviewing the situation, the organisation decided to ', '', 'Изучив ситуацию, организация решила ', ''],
    ['Mina was ready to ', ' when asked', 'Мина была готова ', ', когда её попросили'],
  ],
  organise: [
    ['Set aside Friday morning to ', '', 'Выделите утро пятницы, чтобы ', ''],
    ['A checklist can help you ', '', 'Список дел поможет вам ', ''],
  ],
  pay: [
    ['The reminder says when we need to ', '', 'В напоминании указано, когда нужно ', ''],
    ['Mina used her bank card to ', '', 'Мина воспользовалась банковской картой, чтобы ', ''],
  ],
  plan: [
    ['We met on Monday to ', ' well in advance', 'Мы встретились в понедельник, чтобы заранее ', ''],
    ['Mina considered the details carefully before she decided to ', '', 'Мина тщательно продумала детали, прежде чем решила ', ''],
  ],
  practise: [
    ['Mina spends ten minutes a day trying to ', '', 'Мина каждый день занимается десять минут, стараясь ', ''],
    ['Short daily sessions make it easier to ', '', 'Короткие ежедневные занятия помогают ', ''],
  ],
  prepare: [
    ['Mina started early to ', '', 'Мина начала заранее, чтобы ', ''],
    ['The checklist shows everything required to ', '', 'В списке указано всё, что нужно, чтобы ', ''],
  ],
  prevent: [
    ['Early action can help us ', '', 'Своевременные меры помогут нам ', ''],
    ['The plan includes an early step to ', '', 'План предусматривает заблаговременную меру, чтобы ', ''],
  ],
  protect: [
    ['Simple precautions can help you ', '', 'Простые меры предосторожности помогут вам ', ''],
    ['You can take practical steps to ', '', 'Вы можете принять практические меры, чтобы ', ''],
  ],
  provide: [
    ['The service is designed to ', ' when it is needed', 'Сервис предназначен для того, чтобы при необходимости ', ''],
    ['The service team agreed to ', ' by Friday', 'Служба поддержки согласилась ', ' до пятницы'],
  ],
  reach: [
    ['After several weeks of work, we managed to ', '', 'После нескольких недель работы мы смогли ', ''],
    ['A clear plan should help us ', ' sooner', 'Чёткий план должен помочь нам быстрее ', ''],
  ],
  receive: [
    ['Mina expects to ', ' by Friday', 'Мина рассчитывает ', ' до пятницы'],
    ['The office confirmed that we would ', ' through the usual channel', 'В офисе подтвердили, что мы сможем ', ' по обычному каналу'],
  ],
  reduce: [
    ['The team set a measurable goal to ', '', 'Команда поставила измеримую цель — ', ''],
    ['Mina made one practical change to ', '', 'Мина внесла одно практическое изменение, чтобы ', ''],
  ],
  remember: [
    ['A short review helped us ', '', 'Короткое повторение помогло нам ', ''],
    ['Even after several years, Mina could still ', '', 'Даже спустя несколько лет Мина всё ещё могла ', ''],
  ],
  report: [
    ['Please use the form to ', ' as soon as possible', 'Воспользуйтесь формой, чтобы как можно скорее ', ''],
    ['Mina contacted the appropriate person to ', '', 'Мина связалась с ответственным сотрудником, чтобы ', ''],
  ],
  request: [
    ['The form allows you to ', ' through the correct channel', 'Форма позволяет ', ' через соответствующий канал'],
    ['Mina wrote a short email to ', '', 'Мина написала короткое письмо, чтобы ', ''],
  ],
  research: [
    ['Mina consulted several sources to ', ' before taking action', 'Мина обратилась к нескольким источникам, чтобы ', ' до начала действий'],
    ['The team set aside a week to ', ' thoroughly', 'Команда выделила неделю, чтобы тщательно ', ''],
  ],
  review: [
    ['Set aside an hour to ', ' carefully', 'Выделите час, чтобы внимательно ', ''],
    ['The committee will meet to ', '', 'Комитет соберётся, чтобы ', ''],
  ],
  save: [
    ['It is often sensible to ', '', 'Часто разумно ', ''],
    ['A small change can help you ', '', 'Небольшое изменение поможет вам ', ''],
  ],
  share: [
    ['At the meeting, Mina offered to ', ' with the group', 'На встрече Мина предложила ', ' с группой'],
    ['We set aside time to ', ' with the group', 'Мы выделили время, чтобы ', ' с группой'],
  ],
  spend: [
    ['Mina made a deliberate choice to ', ' wisely', 'Мина сознательно решила ', ' разумно'],
    ['The weekly plan leaves enough time to ', '', 'В недельном плане достаточно времени, чтобы ', ''],
  ],
  start: [
    ['The schedule says when we should ', '', 'В расписании указано, когда нам следует ', ''],
    ['Mina feels ready to ', '', 'Мина чувствует, что готова ', ''],
  ],
  support: [
    ['You can find a way to ', ' when it matters', 'Можно найти способ ', ', когда это важно'],
    ['A practical next step is to ', '', 'Практичный следующий шаг — ', ''],
  ],
  take: [
    ['The instructions tell you when to ', '', 'В инструкции указано, когда нужно ', ''],
    ['Mina decided to ', ' at the right moment', 'Мина решила ', ' в подходящий момент'],
  ],
  track: [
    ['The dashboard helps you ', ' over time', 'Панель помогает ', ' на протяжении времени'],
    ['A simple record can help you ', '', 'Простые записи помогут вам ', ''],
  ],
  try: [
    ['If the first option does not work, you can ', '', 'Если первый вариант не сработает, можно ', ''],
    ['Mina decided to ', ' to see whether it would help', 'Мина решила ', ', чтобы понять, поможет ли это'],
  ],
  understand: [
    ['The example helped us ', '', 'Пример помог нам ', ''],
    ['Mina asked for more context to ', '', 'Мина попросила больше контекста, чтобы ', ''],
  ],
  update: [
    ['The app reminds you to ', ' when something changes', 'Приложение напоминает ', ' при изменении данных'],
    ['The change request makes it possible to ', '', 'Запрос на изменение позволяет ', ''],
  ],
  use: [
    ['The guide explains when to ', '', 'В руководстве объясняется, когда следует ', ''],
    ['The exercise gives you a chance to ', '', 'Упражнение даёт возможность ', ''],
  ],
  visit: [
    ['You can make time to ', ' this week', 'На этой неделе можно найти время, чтобы ', ''],
    ['If it is relevant to your plans, you can ', '', 'Если это связано с вашими планами, можно ', ''],
  ],
  write: [
    ['Mina set aside an hour to ', ' in clear English', 'Мина выделила час, чтобы на понятном английском языке ', ''],
    ['The task asks learners to ', '', 'В задании учащихся просят ', ''],
  ],
  'ask-for': [
    ['If you need it, do not hesitate to ', '', 'Если вам это нужно, не стесняйтесь ', ''],
    ['Mina sent a polite message to ', '', 'Мина отправила вежливое сообщение, чтобы ', ''],
  ],
  'bring-up': [
    ['Mina waited for the right moment to ', '', 'Мина дождалась подходящего момента, чтобы ', ''],
    ["We agreed to ", " at tomorrow's meeting", 'Мы договорились ', ' на завтрашней встрече'],
  ],
  'call-off': [
    ['The organiser may have to ', ' if circumstances change', 'Организатору, возможно, придётся ', ', если обстоятельства изменятся'],
    ['The notice explains who can ', '', 'В уведомлении указано, кто может ', ''],
  ],
  'carry-out': [
    ['The team was ready to ', '', 'Команда была готова ', ''],
    ['The schedule gives us enough time to ', '', 'В расписании достаточно времени, чтобы ', ''],
  ],
  'check-in': [
    ['The message explains when to ', '', 'В сообщении объясняется, когда нужно ', ''],
    ['Reception can help you ', '', 'На стойке регистрации вам помогут ', ''],
  ],
  'check-out': [
    ['Before leaving, Mina had time to ', '', 'Перед уходом у Мины было время, чтобы ', ''],
    ['The local guide recommends that you ', '', 'Местный гид рекомендует ', ''],
  ],
  'cut-down-on': [
    ['Mina changed her routine to ', '', 'Мина изменила свой распорядок, чтобы ', ''],
    ['A small weekly goal can help you ', '', 'Небольшая цель на неделю поможет ', ''],
  ],
  'fill-in': [
    ['Please read the instructions before you ', '', 'Прочитайте инструкцию, прежде чем ', ''],
    ['Take a moment to ', ' accurately', 'Найдите минуту, чтобы без ошибок ', ''],
  ],
  'find-out': [
    ['Mina checked a reliable source to ', '', 'Мина обратилась к надёжному источнику, чтобы ', ''],
    ['One phone call may help you ', '', 'Один телефонный звонок может помочь ', ''],
  ],
  'get-back': [
    ['You may be able to ', ' by Friday', 'Возможно, вы сможете ', ' до пятницы'],
    ['The message explains when you can ', '', 'В сообщении объясняется, когда вы сможете ', ''],
  ],
  'go-over': [
    ['Before the meeting, take time to ', ' once more', 'Перед встречей найдите время, чтобы ещё раз ', ''],
    ['Set aside ten minutes to ', ' carefully', 'Выделите десять минут, чтобы внимательно ', ''],
  ],
  'look-after': [
    ['During the week, you may have to ', '', 'В течение недели вам, возможно, придётся ', ''],
    ['The rota shows when you can ', '', 'В графике указано, когда вы сможете ', ''],
  ],
  'look-for': [
    ['Mina began to ', ' after deciding what she needed', 'Определившись со своими потребностями, Мина начала ', ''],
    ['The guide suggests where to ', ' first', 'В руководстве указано, где сначала ', ''],
  ],
  'pick-up': [
    ['The message explains when Mina can ', '', 'В сообщении объясняется, когда Мина сможет ', ''],
    ['The schedule leaves enough time to ', '', 'В расписании достаточно времени, чтобы ', ''],
  ],
  'put-away': [
    ['After finishing, remember to ', '', 'Закончив работу, не забудьте ', ''],
    ['You can find a safe place to ', '', 'Можно найти безопасное место, чтобы ', ''],
  ],
  'run-out-of': [
    ['If we do not plan ahead, we may ', '', 'Если не планировать заранее, мы можем ', ''],
    ['The team made a backup plan because it might ', '', 'Команда подготовила запасной план, потому что могла ', ''],
  ],
  'sort-out': [
    ['We set aside enough time to ', ' before Friday', 'Мы выделили достаточно времени, чтобы ', ' до пятницы'],
    ['Mina took the necessary steps to ', '', 'Мина предприняла необходимые шаги, чтобы ', ''],
  ],
  'turn-down': [
    ['Mina decided to ', ' because it was not suitable', 'Мина решила ', ', потому что это ей не подходило'],
    ['It is reasonable to ', ' if it does not meet your needs', 'Если это не отвечает вашим потребностям, разумно ', ''],
  ],
}

export function b1GeneratedExample(
  key: string,
  _exampleMode: 'action' | 'risk',
  expression: string,
  translationRu: string,
  _contextEn: string,
  _contextRu: string,
  _groupIndex: number,
  entryIndex: number,
) {
  const scenarios = scenariosFor(key, expression)
  if (!scenarios) throw new Error(`Missing B1 example scenarios for ${key}`)
  const [leadEn, tailEn, leadRu, tailRu] = scenarios[entryIndex % scenarios.length]
  return [`${leadEn}${expression}${tailEn}.`, `${leadRu}${translationRu}${tailRu}.`] as const
}

export function b1EntryContext(_key: string, _tail: string, contextEn: string, contextRu: string) {
  return [contextEn, contextRu] as const
}

function scenariosFor(key: string, expression: string): readonly [Scenario, Scenario] | undefined {
  if (key === 'check-out') {
    if (/^check out (?:of the hotel|by eleven|at reception)$/u.test(expression)) {
      return [
        ['The booking confirms when guests must ', '', 'В бронировании указано, когда гостям нужно ', ''],
        ['The hotel staff can help you ', '', 'Сотрудники гостиницы помогут вам ', ''],
      ]
    }
    if (expression === 'check out a library book') {
      return [
        ['Mina used her library card to ', '', 'Мина воспользовалась читательским билетом, чтобы ', ''],
        ['The librarian showed me how to ', '', 'Библиотекарь показал мне, как ', ''],
      ]
    }
    return [
      ['Mina took a few minutes to ', '', 'Мина нашла несколько минут, чтобы ', ''],
      ['The guide recommends that you ', ' before deciding', 'В руководстве рекомендуется ', ' перед принятием решения'],
    ]
  }

  if (key === 'pick-up') {
    if (/^pick up (?:a parcel|an order|a ticket|a child|a friend|the keys|a rental car|some groceries)$/u.test(expression)) {
      return [
        ['The message explains where you can ', '', 'В сообщении объясняется, где можно ', ''],
        ['Mina stopped on her way home to ', '', 'По дороге домой Мина остановилась, чтобы ', ''],
      ]
    }
    if (expression === 'pick up the phone') {
      return [
        ['I was in the kitchen when I had to ', '', 'Я был на кухне, когда пришлось ', ''],
        ['Mina stopped what she was doing to ', '', 'Мина прервала работу, чтобы ', ''],
      ]
    }
    if (/^pick up (?:a skill|a language|a habit)$/u.test(expression)) {
      return [
        ['Daily practice can help you ', '', 'Ежедневная практика поможет ', ''],
        ['Mina was able to ', ' through regular contact', 'Благодаря регулярному общению Мина смогла ', ''],
      ]
    }
    if (expression === 'pick up information') {
      return [
        ['Mina was able to ', ' during the conversation', 'Во время разговора Мина смогла ', ''],
        ['Careful listening can help you ', '', 'Внимательное слушание поможет ', ''],
      ]
    }
    return [
      ['The receiver was able to ', ' during the test', 'Во время проверки приёмник смог ', ''],
      ['Mina listened carefully enough to ', '', 'Мина слушала достаточно внимательно и смогла ', ''],
    ]
  }

  if (key === 'meet') {
    if (/^meet (?:a colleague|a client|a friend|the manager)$/u.test(expression)) {
      return [
        ['Mina arranged to ', ' after work', 'Мина договорилась ', ' после работы'],
        ['The calendar shows when she can ', '', 'В календаре указано, когда она сможет ', ''],
      ]
    }
    return [
      ['The revised plan should help us ', '', 'Пересмотренный план должен помочь нам ', ''],
      ['The team worked hard to ', ' by Friday', 'Команда усердно работала, чтобы ', ' к пятнице'],
    ]
  }

  if (key === 'turn-down' && /^turn down (?:the volume|the heat|the music|the temperature)$/u.test(expression)) {
    return [
      ['The control allows you to ', '', 'Регулятор позволяет ', ''],
      ['Mina decided to ', ' to make the room more comfortable', 'Чтобы в комнате стало комфортнее, Мина решила ', ''],
    ]
  }

  if (key === 'turn-down' && expression === 'turn down a candidate') {
    return [
      ['The panel decided to ', ' because they lacked the required experience', 'Комиссия решила ', ' из-за недостатка необходимого опыта'],
      ['After the final interview, the panel had to ', '', 'После последнего собеседования комиссии пришлось ', ''],
    ]
  }

  if (key === 'look-after' && expression === 'look after your health') {
    return [
      ['Regular check-ups can help you ', '', 'Регулярные осмотры помогут вам ', ''],
      ['A balanced routine makes it easier to ', '', 'Сбалансированный распорядок помогает ', ''],
    ]
  }

  if (key === 'put-away' && expression === 'put away some money') {
    return [
      ['Mina decided to ', ' each month', 'Мина решила каждый месяц ', ''],
      ['A regular transfer can help you ', '', 'Регулярный перевод поможет ', ''],
    ]
  }

  if (key === 'run-out-of' && expression === 'run out of battery power') {
    return [
      ['The phone may ', ' during a long journey', 'В долгой поездке телефон может ', ''],
      ['Mina packed a charger because her phone could ', '', 'Мина взяла зарядное устройство, потому что её телефон мог ', ''],
    ]
  }

  return groupScenarios[key]
}
