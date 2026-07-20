# Методическая база и аудит учебного контента

Дата проверки: 18 июля 2026 года. Это методическая записка, а не заявление об официальной аккредитации CEFR.

## Что проверено

Аудит выполнялся по production-агрегатам, а не по отдельным исходным файлам или случайной витрине:

- все 2 164 карточки каталога и справочника: A2 — 800, B1 — 305, B2 — 634, C1 — 425; отдельно проверен production-gate для 1 012 activation-ready карточек с авторской парой Step 6;
- все 124 грамматических урока и 372 вопроса;
- все 32 вопроса placement test, ключи, варианты ответов, ссылки на remedial lessons и scoring logic;
- production-сборка B1 и её происхождение: в неё входят только четыре файла со статическими авторскими rows; четыре прежних bulk-генератора и общий шаблонизатор из production-каталога исключены;
- равномерная редакторская выборка по 40 карточек каждого уровня (160 карточек), отдельно от автоматических проверок;
- независимая строгая перепроверка всех 305 B1 targets, значений и Step-6 пар на соответствие уровню и естественность.
- полный реестр всех 660 однословных rows: 242 count-noun, 61 non-count, 136 gradable-adjective и 221 fail-closed; внутри count-noun отдельно проверены 117 context-only омографов/пограничных случаев и 125 bare-safe строк;
- 155 именных коллокаций с поштучно заданными plural surfaces и boundary-политикой (77 bare-safe, 27 strict-count-cue, 38 determiner-only, 13 unsupported ambiguous), а также отдельным списком массовых, уже множественных и фиксированных выражений, которые продуктивно не расширяются.

Постоянный полный прогон реализован в `src/data/learningContentAudit.ts` и `src/data/learningContentAudit.test.ts`. Он проверяет уникальность ID, межуровневые fingerprints, полноту bilingual fields, технические фрагменты, совпадение target expression с примером через допустимые формы, повторы примеров, grammar keys, русскую опору A2–B1, placement links и распределение позиций правильного ответа.

## Итог аудита

После исправлений автоматический аудит не находит Critical-дефектов в production-каталогах.

- Лексика: каталог и справочник содержат 2 164 карточки. В активный курс допускаются 1 012 карточек с отдельной авторской парой Step 6: A2 — 160, B1 — 305, B2 — 282, C1 — 265. Остальные 1 152 остаются reference-only (A2 — 640, B2 — 352, C1 — 160), пока для них нет проверенной пары «ошибка → исправление». Все 305 карточек B1 имеют такое проверяемое упражнение.
- B1: два строгих дополнительных прохода выявили 75 source rows, которым требовалась замена цели или сужение значения, — 49 в первом и ещё 26 во втором. Последующий identity-аудит обнаружил, что 35 таких B1-замен и одна A2-замена ошибочно сохранили ID прежнего значения. Всем 36 новым targets выданы новые semantic ID; versioned ledger и условная миграция сохраняют evidence старого значения.
- B2: 14 полезных строк ошибочно исключались как lower-level duplicates, хотя соответствующих A2/B1 targets уже не было. Они восстановлены, получили отдельные редакторские Step‑6 пары и проходят closure‑проверку exclusions.
- Примеры: 2 164 из 2 164 заканчиваются пунктуацией, уникальны после нормализации и содержат target expression либо явно описанную допустимую форму.
- Pattern metadata: добавлена для всех 29 автоматически выявленных открытых рамок и конструкций с обязательным дополнением, включая `be similar to + noun`, `I prefer + noun / -ing / to-infinitive`, `cut down on + noun / -ing` и парные конструкции `the more ..., the more ...`.
- Грамматика: 124 уникальных урока, 372 уникальных вопроса; русская опора присутствует во всех 73 уроках A2–B1.
- Placement: ключ раньше имел серьёзную утечку — правильный ответ ни разу не находился в позиции D. Теперь в каждом уровне ровно по два ключа A/B/C/D, итого 8/8/8/8. Все remedial links разрешаются в существующие уроки.
- Retrieval/SRS: короткий план использует единый лимит и не позволяет activation вытеснить due SRS. Feedback или reveal записывается до показа ответа как долговечное phrase-wide exposure; другой навык той же фразы закрыт на 12 часов даже после remount, а импортированная review-history пересчитывается по тому же правилу.
- Морфология и точная проверка: новые формы больше не выводятся из неопределённого артикля или общего шаблона. Проверенные noun/adjective/collocation surfaces привязаны одновременно к stable ID и точному expression; cloze и productive matcher требуют грамматического контекста. Британско-американские варианты и естественные сокращения нормализуются централизованно, а двусмысленные случаи остаются fail-closed.

Известные ограничения:

1. Полный B1-каталог по-прежнему компактнее каталогов A2, B2 и C1: 305 карточек. Уровень расширяется только новыми статическими rows и отдельными редакторскими Step-6 repairs, а не комбинационным генератором.
2. Core placement равномерно выбирает grammar, vocabulary, reading и Use of English. Необязательный TTS-блок добавляет отдельный listening-signal, а портфель — выполненные speaking/writing samples, но приложение всё ещё не выполняет валидированную автоматическую оценку productive quality и должно говорить об этом прямо.
3. CEFR-метка карточки — рекомендация момента обучения, а не утверждение, что слово «принадлежит» только одному уровню. Полная EVP-проверка по значениям недоступна без лицензированного корпуса/интерфейса; платный контент не копировался.

## Решения и источники

Все формулировки карточек и упражнений оригинальные. Источники использовались только как методическая и валидационная основа.

### CEFR, curriculum и placement

- [Council of Europe — CEFR Companion Volume (2020)](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4). Влияние: action-oriented can-do goals; разделение reception, production, interaction и mediation; отказ называть короткий language-knowledge test официальным CEFR-сертификатом; приоритет intelligibility над имитацией «native accent».
- [Council of Europe — searchable CEFR descriptors](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors-search). Влияние: функциональная проверка уровней и формулировка целей через наблюдаемые действия.
- [English Profile — English Vocabulary Profile user guide](https://www.englishprofile.org/images/pdf/evp%20user%20guide.pdf). Влияние: level assignment рассматривается по значению и употреблению, а не по голой лемме; полисемия требует отдельных смыслов или явных ограничений.
- [English Profile — introductory guide to the CEFR for English](https://www.englishprofile.org/images/pdf/GuideToCEFR.pdf). Влияние: grammar progression проверяется как corpus-informed ориентир, а не жёсткий универсальный список.
- [Cambridge English — Cambridge English Placement Test](https://www.cambridgeenglish.org/find-a-centre/exam-centres/support-for-centres/placing-students-in-the-right-exam/). Влияние: валидный placement должен различать Reading, Listening и Language Knowledge и может быть adaptive; English Forge честно ограничивает вывод из-за отсутствия listening/productive modules.
- [Cambridge English — CEFR and language standards](https://www.cambridgeenglish.org/exams-and-tests/cefr/). Влияние: рабочий уровень показывается как понятный диапазон и маршрут, без ложной эквивалентности экзамену.
- [British Council — vocabulary by level](https://learnenglish.britishcouncil.org/free-resources/vocabulary). Влияние: A2–B1 получает бытовой, тематический и коммуникативно полезный приоритет; meaning, spelling и pronunciation должны тренироваться вместе.

### Retrieval, spacing, testing и interleaving

- [Karpicke & Roediger (2008), “The Critical Importance of Retrieval for Learning”](https://doi.org/10.1126/science.1152408). Влияние: повторное извлечение, а не повторное чтение после первого успеха; productive recall остаётся отдельным skill state.
- [Cepeda et al. (2006), distributed-practice meta-analysis](https://doi.org/10.1037/0033-2909.132.3.354). Влияние: повторения распределяются во времени; интервал связан с желаемым retention horizon, а не с фиксированным ежедневным показом.
- [Kim & Webb (2022), spaced practice in L2 meta-analysis](https://doi.org/10.1111/lang.12479). Влияние: spacing используется для L2 vocabulary и grammar; longer spacing важнее для delayed retention, при этом equal spacing не считается хуже expanding spacing по умолчанию.
- [Nakata & Suzuki (2019), spacing and semantic relatedness in L2 vocabulary](https://doi.org/10.1017/S0272263118000219). Влияние: дневная очередь перемешивает выражения и не выдаёт большие семантически однородные блоки как единственный режим.
- [Rohrer & Taylor (2007), interleaved practice](https://doi.org/10.1007/s11251-007-9015-8). Влияние: очередь чередует targets и skills вместо нескольких подряд задач на одну карточку.
- [Bjork & Bjork (2011), desirable difficulties](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/11/Making-Things-Hard-on-Yourself-but-in-a-Good-Way-20111.pdf). Влияние: усложнение допустимо лишь когда retrieval остаётся посильным; hints/reveal ограничивают оценку, а ошибочный ответ нельзя объявить Easy.

### Vocabulary depth, chunks и contextual encoding

- [Li & Lei (2024), collocation-instruction meta-analysis](https://doi.org/10.1515/iral-2021-0218). Влияние: collocations и lexical chunks представлены как отдельные targets; constrained и free production дополняют recognition.
- [Boers et al. (2006), formulaic sequences and perceived oral proficiency](https://doi.org/10.1191/1362168806lr195oa). Влияние: приложение учит цельные формулы, но pattern metadata делает внутреннюю структуру видимой.
- [Boers & Lindstromberg (2012), experimental studies on formulaic sequences](https://doi.org/10.1017/S0267190512000050). Влияние: noticing, retrieval и контекст используются совместно; один список переводов не считается достаточным обучением.
- [Puimège et al. (2019), context and word predictors in L2 vocabulary learning](https://doi.org/10.1017/S0142716418000504). Влияние: каждая карточка требует смыслового контекста; поэтому механически собранный B1 bulk-набор исключён из production целиком, даже когда отдельные строки проходили поверхностные формальные проверки.

### Feedback, pronunciation, listening и speaking

- [Li (2010), corrective-feedback meta-analysis](https://doi.org/10.1111/j.1467-9922.2010.00561.x). Влияние: feedback даётся после попытки и сохраняет правильную форму; ошибки становятся отдельными retrievable patterns, а не только красной подсветкой.
- [Lyster & Saito (2010), oral feedback in classroom SLA](https://kazuyasaito.net/SSLA2010.pdf). Влияние: prompts, correction и delayed reuse сочетаются; самооценка без наблюдаемого evidence не повышает mastery.
- [Saito (2012), pronunciation instruction synthesis](https://doi.org/10.1002/tesq.67). Влияние: явное внимание к форме сочетается с содержательной речью; цель — comprehensibility и control, не «избавление от акцента».
- [British Council — pronunciation practice](https://learnenglish.britishcouncil.org/level/improve-your-english-level/how-can-i-improve-my-english-pronunciation). Влияние: короткий listen-and-write, сравнение с transcript, запись себя и повтор оригинала; замедление доступно как поддержка.
- [Whitworth & Rose (2025), systematic review of shadowing](https://doi.org/10.1080/29984475.2025.2546827). Влияние: shadowing остаётся scaffolded practice, а не доказанной автоматической оценкой произношения; долгосрочные и advanced-level эффекты трактуются осторожно.
- [Mahalingappa, Zong & Polat (2024), captions and playback speed](https://doi.org/10.1016/j.system.2023.103192). Влияние: captions/transcript и 0.75×/1×/1.25× рассматриваются как learner-controlled support; влияние зависит от proficiency, поэтому скорость не служит самостоятельной мерой уровня.
- [Kuşçu (2024), meta-analysis of L2 listening instruction](https://doi.org/10.1080/10904018.2022.2074851). Влияние: listening требует собственных comprehension tasks и повторных попыток, а не пассивного фонового проигрывания.

### Cognitive load и доступность

- [Kalyuga, Ayres, Chandler & Sweller (2003), expertise-reversal effect](https://doi.org/10.1207/S15326985EP3801_4). Влияние: A2–B1 получает русскую опору и явные формулы; scaffolding должен уменьшаться по мере роста expertise, чтобы не превращаться в лишнюю нагрузку.
- [Kalyuga, Chandler & Sweller (1998), levels of expertise and instructional design](https://doi.org/10.1518/001872098779480587). Влияние: один и тот же объём подсказок не навязывается всем уровням; worked support отделён от productive check.
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/). Влияние: keyboard focus, visible labels, target size, contrast, reflow, reduced motion, понятные ошибки и отсутствие зависимости от одного сенсорного канала являются критериями готовности учебного UX.

## Правила для следующей редакции контента

1. Не увеличивать каталог генерацией общих sentence frames.
2. Сохранять stable ID при редакционной замене примера только если canonical target и его значение не меняются; проверять пересечение с `lexicalCatalogIdentityHistory.ts`.
3. Для нового target или нового смысла полисемичного слова создавать отдельную карточку с новым ID. Никогда не «освобождать» старый ID для другого выражения.
4. Для каждого открытого frame/dependent preposition указывать `pattern`; ограничения и регистр — в `note`.
5. Проверять English example и Russian translation как одну смысловую пару, включая отрицание, модальность, числа, время и участников.
6. Перед merge запускать `pnpm vitest run src/data/learningContentAudit.test.ts src/data/placementTest.test.ts src/data/lexicalCatalog.test.ts src/data/grammarAcademy.test.ts`.
