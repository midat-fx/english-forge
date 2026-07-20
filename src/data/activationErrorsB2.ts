import type { AuthoredActivationErrorPair } from '../domain/activationErrorMetadata'

export const activationErrorsB2 = [
  {
    "catalogItemId": "lex-b2-reach-target",
    "incorrectContext": "The campaign reached to its fundraising target two days early.",
    "expectedCorrection": "The campaign reached its fundraising target two days early.",
    "cue": "После reach перед объектом не нужен предлог to."
  },
  {
    "catalogItemId": "lex-b2-contribute",
    "incorrectContext": "Poor lighting may contribute for headaches and tiredness.",
    "expectedCorrection": "Poor lighting may contribute to headaches and tiredness.",
    "cue": "После contribute перед причиной или результатом используйте предлог to."
  },
  {
    "catalogItemId": "lex-b2-demand",
    "incorrectContext": "Demand of evening classes has increased this year.",
    "expectedCorrection": "Demand for evening classes has increased this year.",
    "cue": "После demand перед товаром или услугой используйте предлог for."
  },
  {
    "catalogItemId": "lex-b2-evidence",
    "incorrectContext": "There is a clear evidence that the new process saves time.",
    "expectedCorrection": "There is clear evidence that the new process saves time.",
    "cue": "Evidence обычно неисчисляемое; уберите артикль a."
  },
  {
    "catalogItemId": "lex-b2-aware",
    "incorrectContext": "Most residents are aware about the proposed changes.",
    "expectedCorrection": "Most residents are aware of the proposed changes.",
    "cue": "После aware перед темой осведомлённости используйте предлог of."
  },
  {
    "catalogItemId": "lex-b2-flexible",
    "incorrectContext": "The employer offers flexibility arrangements for working parents.",
    "expectedCorrection": "The employer offers flexible arrangements for working parents.",
    "cue": "Перед arrangements используйте прилагательное flexible, а не существительное flexibility."
  },
  {
    "catalogItemId": "lex-b2-practical",
    "incorrectContext": "We need a practically solution that costs less.",
    "expectedCorrection": "We need a practical solution that costs less.",
    "cue": "Перед solution используйте прилагательное practical, а не наречие practically."
  },
  {
    "catalogItemId": "lex-b2-feedback",
    "incorrectContext": "Participants provided detailed feedbacks after each session.",
    "expectedCorrection": "Participants provided detailed feedback after each session.",
    "cue": "Feedback обычно неисчисляемое; уберите окончание множественного числа."
  },
  {
    "catalogItemId": "lex-b2-meet-a-deadline",
    "incorrectContext": "We hired extra staff to meet to a deadline.",
    "expectedCorrection": "We hired extra staff to meet a deadline.",
    "cue": "После meet сразу используйте a deadline без предлога to."
  },
  {
    "catalogItemId": "lex-b2-reach-a-compromise",
    "incorrectContext": "The neighbours finally managed to reach to a compromise.",
    "expectedCorrection": "The neighbours finally managed to reach a compromise.",
    "cue": "После reach сразу используйте a compromise без предлога to."
  },
  {
    "catalogItemId": "lex-b2-take-responsibility",
    "incorrectContext": "The supplier must take responsible for the faulty parts.",
    "expectedCorrection": "The supplier must take responsibility for the faulty parts.",
    "cue": "После take используйте существительное responsibility, а не прилагательное responsible."
  },
  {
    "catalogItemId": "lex-b2-come-up-with",
    "incorrectContext": "The team must come up a cheaper solution.",
    "expectedCorrection": "The team must come up with a cheaper solution.",
    "cue": "В фразовом глаголе come up with восстановите обязательную частицу with."
  },
  {
    "catalogItemId": "lex-b2-point-out",
    "incorrectContext": "Several reviewers point out at the same weakness.",
    "expectedCorrection": "Several reviewers point out the same weakness.",
    "cue": "После point out перед прямым объектом не нужен предлог at."
  },
  {
    "catalogItemId": "lex-b2-there-is-no-point",
    "incorrectContext": "There is no point in argue about yesterday.",
    "expectedCorrection": "There is no point in arguing about yesterday.",
    "cue": "После There is no point in используйте форму глагола с -ing."
  },
  {
    "catalogItemId": "lex-b2-come-across",
    "incorrectContext": "I came across to an old notebook while clearing the cupboard.",
    "expectedCorrection": "I came across an old notebook while clearing the cupboard.",
    "cue": "Уберите ошибочный предлог после фразового глагола со значением «случайно наткнуться»."
  },
  {
    "catalogItemId": "lex-b2-raise-concern",
    "incorrectContext": "Several residents raised a concerns about late-night traffic.",
    "expectedCorrection": "Several residents raised concerns about late-night traffic.",
    "cue": "Уберите артикль a перед формой множественного числа concerns."
  },
  {
    "catalogItemId": "lex-b2-take-approach",
    "incorrectContext": "We took a more practical approaching to teaching grammar.",
    "expectedCorrection": "We took a more practical approach to teaching grammar.",
    "cue": "Исправьте форму существительного в сочетании со значением «применить подход»."
  },
  {
    "catalogItemId": "lex-b2-would-appear",
    "incorrectContext": "It would appears that the second option is more reliable.",
    "expectedCorrection": "It would appear that the second option is more reliable.",
    "cue": "После would используйте правильную форму глагола в осторожном выводе."
  },
  {
    "catalogItemId": "lex-b2-not-necessarily",
    "incorrectContext": "A longer answer is not necessary a clearer one.",
    "expectedCorrection": "A longer answer is not necessarily a clearer one.",
    "cue": "Исправьте часть речи в связке со значением «не обязательно»."
  },
  {
    "catalogItemId": "lex-b2-provided-that",
    "incorrectContext": "You can change the booking that provided you give two days’ notice.",
    "expectedCorrection": "You can change the booking provided that you give two days’ notice.",
    "cue": "Восстановите порядок слов в условной связке «при условии что»."
  },
  {
    "catalogItemId": "lex-b2-whereas",
    "incorrectContext": "The first plan is cheaper, where as the second offers more support.",
    "expectedCorrection": "The first plan is cheaper, whereas the second offers more support.",
    "cue": "Исправьте написание союзной связки со значением «тогда как»."
  },
  {
    "catalogItemId": "lex-b2-in-contrast",
    "incorrectContext": "The north was unusually dry. On contrast, the south had record rainfall.",
    "expectedCorrection": "The north was unusually dry. In contrast, the south had record rainfall.",
    "cue": "Исправьте предлог в связке со значением «в отличие от этого»."
  },
  {
    "catalogItemId": "lex-b2-nevertheless",
    "incorrectContext": "The evidence is limited. Never the less, the pattern deserves attention.",
    "expectedCorrection": "The evidence is limited. Nevertheless, the pattern deserves attention.",
    "cue": "Исправьте написание связки со значением «тем не менее»."
  },
  {
    "catalogItemId": "lex-b2-therefore",
    "incorrectContext": "The file contains private data and should therefor be encrypted.",
    "expectedCorrection": "The file contains private data and should therefore be encrypted.",
    "cue": "Исправьте написание связки результата со значением «поэтому»."
  },
  {
    "catalogItemId": "lex-b2-consequently",
    "incorrectContext": "Two suppliers withdrew; consequent, production slowed down.",
    "expectedCorrection": "Two suppliers withdrew; consequently, production slowed down.",
    "cue": "Исправьте часть речи в связке результата «следовательно»."
  },
  {
    "catalogItemId": "lex-b2-from-perspective",
    "incorrectContext": "On my perspective, the smaller team communicated more effectively.",
    "expectedCorrection": "From my perspective, the smaller team communicated more effectively.",
    "cue": "Исправьте предлог в связке со значением «с моей точки зрения»."
  },
  {
    "catalogItemId": "lex-b2-that-said",
    "incorrectContext": "The journey is long. That say, the scenery is remarkable.",
    "expectedCorrection": "The journey is long. That said, the scenery is remarkable.",
    "cue": "Исправьте форму глагола в уступительной связке «при этом»."
  },
  {
    "catalogItemId": "lex-b2-more-importantly",
    "incorrectContext": "The repair is cheaper and, importantly more, it can be done today.",
    "expectedCorrection": "The repair is cheaper and, more importantly, it can be done today.",
    "cue": "Восстановите порядок слов в связке «что важнее»."
  },
  {
    "catalogItemId": "lex-b2-some-extent",
    "incorrectContext": "The delay was, in some extent, outside our control.",
    "expectedCorrection": "The delay was, to some extent, outside our control.",
    "cue": "Исправьте предлог в связке со значением «в некоторой степени»."
  },
  {
    "catalogItemId": "lex-b2-broadly-speaking",
    "incorrectContext": "Broad speaking, the two groups responded in similar ways.",
    "expectedCorrection": "Broadly speaking, the two groups responded in similar ways.",
    "cue": "Исправьте часть речи в связке со значением «в общих чертах»."
  },
  {
    "catalogItemId": "lex-b2-arguably",
    "incorrectContext": "This is arguable the most useful feature in the entire package.",
    "expectedCorrection": "This is arguably the most useful feature in the entire package.",
    "cue": "Исправьте часть речи во вводном слове со значением «можно утверждать»."
  },
  {
    "catalogItemId": "lex-b2-significant",
    "incorrectContext": "The policy led to a significance drop in waiting times.",
    "expectedCorrection": "The policy led to a significant drop in waiting times.",
    "cue": "Исправьте форму «significance» на подходящую форму слова со значением «значительный»."
  },
  {
    "catalogItemId": "lex-b2-assess",
    "incorrectContext": "The panel will assessment each proposal against the same criteria.",
    "expectedCorrection": "The panel will assess each proposal against the same criteria.",
    "cue": "Исправьте форму «assessment» на подходящую форму слова со значением «оценивать»."
  },
  {
    "catalogItemId": "lex-b2-decline",
    "incorrectContext": "Attendance decline slightly during the winter months last year.",
    "expectedCorrection": "Attendance declined slightly during the winter months last year.",
    "cue": "Last year задаёт прошлое время; используйте declined."
  },
  {
    "catalogItemId": "lex-b2-tendency",
    "incorrectContext": "There is a tend to focus on speed rather than accuracy.",
    "expectedCorrection": "There is a tendency to focus on speed rather than accuracy.",
    "cue": "Исправьте форму «tend» на подходящую форму слова со значением «тенденция; склонность»."
  },
  {
    "catalogItemId": "lex-b2-relevant",
    "incorrectContext": "Please include only information that is relevance to the application.",
    "expectedCorrection": "Please include only information that is relevant to the application.",
    "cue": "Исправьте форму «relevance» на подходящую форму слова со значением «относящийся к делу»."
  },
  {
    "catalogItemId": "lex-b2-sufficient",
    "incorrectContext": "We do not yet have sufficiently data to change the policy.",
    "expectedCorrection": "We do not yet have sufficient data to change the policy.",
    "cue": "Исправьте форму «sufficiently» на подходящую форму слова со значением «достаточный»."
  },
  {
    "catalogItemId": "lex-b2-valid",
    "incorrectContext": "Her criticism is validity, but the proposed fix needs more work.",
    "expectedCorrection": "Her criticism is valid, but the proposed fix needs more work.",
    "cue": "Исправьте форму «validity» на подходящую форму слова со значением «обоснованный; действительный»."
  },
  {
    "catalogItemId": "lex-b2-widespread",
    "incorrectContext": "The survey found widely support for flexible working.",
    "expectedCorrection": "The survey found widespread support for flexible working.",
    "cue": "Исправьте форму «widely» на подходящую форму слова со значением «широко распространённый»."
  },
  {
    "catalogItemId": "lex-b2-adequate",
    "incorrectContext": "The current budget is adequately for basic repairs.",
    "expectedCorrection": "The current budget is adequate for basic repairs.",
    "cue": "Исправьте форму «adequately» на подходящую форму слова со значением «достаточный»."
  },
  {
    "catalogItemId": "lex-b2-apparent",
    "incorrectContext": "The reason for the delay soon became apparently.",
    "expectedCorrection": "The reason for the delay soon became apparent.",
    "cue": "Исправьте форму «apparently» на подходящую форму слова со значением «очевидный; кажущийся»."
  },
  {
    "catalogItemId": "lex-b2-appropriate",
    "incorrectContext": "Jeans are not appropriately for this formal event.",
    "expectedCorrection": "Jeans are not appropriate for this formal event.",
    "cue": "Исправьте форму «appropriately» на подходящую форму слова со значением «подходящий»."
  },
  {
    "catalogItemId": "lex-b2-arbitrary",
    "incorrectContext": "The deadline seems arbitrarily and needs further explanation.",
    "expectedCorrection": "The deadline seems arbitrary and needs further explanation.",
    "cue": "Исправьте форму «arbitrarily» на подходящую форму слова со значением «произвольный»."
  },
  {
    "catalogItemId": "lex-b2-beneficial",
    "incorrectContext": "Regular feedback is benefit for long-term development.",
    "expectedCorrection": "Regular feedback is beneficial for long-term development.",
    "cue": "Исправьте форму «benefit» на подходящую форму слова со значением «полезный»."
  },
  {
    "catalogItemId": "lex-b2-brief",
    "incorrectContext": "We had a briefly discussion before the meeting.",
    "expectedCorrection": "We had a brief discussion before the meeting.",
    "cue": "Исправьте форму «briefly» на подходящую форму слова со значением «краткий»."
  },
  {
    "catalogItemId": "lex-b2-complex",
    "incorrectContext": "The problem is more complexity than it first appears.",
    "expectedCorrection": "The problem is more complex than it first appears.",
    "cue": "Исправьте форму «complexity» на подходящую форму слова со значением «сложный»."
  },
  {
    "catalogItemId": "lex-b2-considerable",
    "incorrectContext": "The renovation requires a considerably amount of money.",
    "expectedCorrection": "The renovation requires a considerable amount of money.",
    "cue": "Исправьте форму «considerably» на подходящую форму слова со значением «значительный»."
  },
  {
    "catalogItemId": "lex-b2-consistent",
    "incorrectContext": "Her results have remained consistently throughout the course.",
    "expectedCorrection": "Her results have remained consistent throughout the course.",
    "cue": "Исправьте форму «consistently» на подходящую форму слова со значением «последовательный; стабильный»."
  },
  {
    "catalogItemId": "lex-b2-controversial",
    "incorrectContext": "The council approved a highly controversy development plan.",
    "expectedCorrection": "The council approved a highly controversial development plan.",
    "cue": "Исправьте форму «controversy» на подходящую форму слова со значением «спорный»."
  },
  {
    "catalogItemId": "lex-b2-crucial",
    "incorrectContext": "Clear communication is crucially during an emergency.",
    "expectedCorrection": "Clear communication is crucial during an emergency.",
    "cue": "Исправьте форму «crucially» на подходящую форму слова со значением «решающий»."
  },
  {
    "catalogItemId": "lex-b2-deliberate",
    "incorrectContext": "The omission was a deliberately editorial decision.",
    "expectedCorrection": "The omission was a deliberate editorial decision.",
    "cue": "Исправьте форму «deliberately» на подходящую форму слова со значением «намеренный»."
  },
  {
    "catalogItemId": "lex-b2-distinct",
    "incorrectContext": "The region has two distinctly cultural traditions.",
    "expectedCorrection": "The region has two distinct cultural traditions.",
    "cue": "Исправьте форму «distinctly» на подходящую форму слова со значением «отчётливый; отдельный»."
  },
  {
    "catalogItemId": "lex-b2-diverse",
    "incorrectContext": "The programme attracts a diversely group of participants.",
    "expectedCorrection": "The programme attracts a diverse group of participants.",
    "cue": "Исправьте форму «diversely» на подходящую форму слова со значением «разнообразный»."
  },
  {
    "catalogItemId": "lex-b2-efficient",
    "incorrectContext": "The new heating system is far more efficiently.",
    "expectedCorrection": "The new heating system is far more efficient.",
    "cue": "Исправьте форму «efficiently» на подходящую форму слова со значением «эффективный»."
  },
  {
    "catalogItemId": "lex-b2-ethical",
    "incorrectContext": "Researchers must follow strict ethically guidelines throughout.",
    "expectedCorrection": "Researchers must follow strict ethical guidelines throughout.",
    "cue": "Исправьте форму «ethically» на подходящую форму слова со значением «этичный»."
  },
  {
    "catalogItemId": "lex-b2-excessive",
    "incorrectContext": "Excessively screen time can affect sleep quality.",
    "expectedCorrection": "Excessive screen time can affect sleep quality.",
    "cue": "Исправьте форму «Excessively» на подходящую форму слова со значением «чрезмерный»."
  },
  {
    "catalogItemId": "lex-b2-fundamental",
    "incorrectContext": "Trust is fundamentally to any successful partnership.",
    "expectedCorrection": "Trust is fundamental to any successful partnership.",
    "cue": "Исправьте форму «fundamentally» на подходящую форму слова со значением «основополагающий»."
  },
  {
    "catalogItemId": "lex-b2-genuine",
    "incorrectContext": "She showed genuinely interest in our concerns.",
    "expectedCorrection": "She showed genuine interest in our concerns.",
    "cue": "Исправьте форму «genuinely» на подходящую форму слова со значением «подлинный; искренний»."
  },
  {
    "catalogItemId": "lex-b2-gradual",
    "incorrectContext": "The town experienced a gradually increase in tourism.",
    "expectedCorrection": "The town experienced a gradual increase in tourism.",
    "cue": "Исправьте форму «gradually» на подходящую форму слова со значением «постепенный»."
  },
  {
    "catalogItemId": "lex-b2-inevitable",
    "incorrectContext": "Some disruption is inevitably during major repairs.",
    "expectedCorrection": "Some disruption is inevitable during major repairs.",
    "cue": "Исправьте форму «inevitably» на подходящую форму слова со значением «неизбежный»."
  },
  {
    "catalogItemId": "lex-b2-innovative",
    "incorrectContext": "The school introduced an innovatively approach to assessment.",
    "expectedCorrection": "The school introduced an innovative approach to assessment.",
    "cue": "Исправьте форму «innovatively» на подходящую форму слова со значением «инновационный»."
  },
  {
    "catalogItemId": "lex-b2-intense",
    "incorrectContext": "The candidates faced intensely competition for each place.",
    "expectedCorrection": "The candidates faced intense competition for each place.",
    "cue": "Исправьте форму «intensely» на подходящую форму слова со значением «интенсивный»."
  },
  {
    "catalogItemId": "lex-b2-mutual",
    "incorrectContext": "The agreement depends on mutually trust and respect.",
    "expectedCorrection": "The agreement depends on mutual trust and respect.",
    "cue": "Исправьте форму «mutually» на подходящую форму слова со значением «взаимный»."
  },
  {
    "catalogItemId": "lex-b2-objective",
    "incorrectContext": "We need an objectively assessment of the damage.",
    "expectedCorrection": "We need an objective assessment of the damage.",
    "cue": "Исправьте форму «objectively» на подходящую форму слова со значением «объективный»."
  },
  {
    "catalogItemId": "lex-b2-overall",
    "incorrectContext": "The over all response to the proposal was positive.",
    "expectedCorrection": "The overall response to the proposal was positive.",
    "cue": "Исправьте форму «over all» на подходящую форму слова со значением «общий»."
  },
  {
    "catalogItemId": "lex-b2-potential",
    "incorrectContext": "The report identifies several potentially sources of funding.",
    "expectedCorrection": "The report identifies several potential sources of funding.",
    "cue": "Исправьте форму «potentially» на подходящую форму слова со значением «потенциальный»."
  },
  {
    "catalogItemId": "lex-b2-precise",
    "incorrectContext": "Please provide precisely measurements for every room.",
    "expectedCorrection": "Please provide precise measurements for every room.",
    "cue": "Исправьте форму «precisely» на подходящую форму слова со значением «точный»."
  },
  {
    "catalogItemId": "lex-b2-predictable",
    "incorrectContext": "Demand follows a fairly predictably seasonal pattern.",
    "expectedCorrection": "Demand follows a fairly predictable seasonal pattern.",
    "cue": "Исправьте форму «predictably» на подходящую форму слова со значением «предсказуемый»."
  },
  {
    "catalogItemId": "lex-b2-reluctant",
    "incorrectContext": "Many employees were reluctance to discuss the incident.",
    "expectedCorrection": "Many employees were reluctant to discuss the incident.",
    "cue": "Исправьте форму «reluctance» на подходящую форму слова со значением «не склонный; испытывающий нежелание»."
  },
  {
    "catalogItemId": "lex-b2-remarkable",
    "incorrectContext": "The team made remarkably progress within six months.",
    "expectedCorrection": "The team made remarkable progress within six months.",
    "cue": "Исправьте форму «remarkably» на подходящую форму слова со значением «выдающийся»."
  },
  {
    "catalogItemId": "lex-b2-remote",
    "incorrectContext": "Remotely communities often lack reliable public transport.",
    "expectedCorrection": "Remote communities often lack reliable public transport.",
    "cue": "Исправьте форму «Remotely» на подходящую форму слова со значением «отдалённый; дистанционный»."
  },
  {
    "catalogItemId": "lex-b2-severe",
    "incorrectContext": "The region suffered severely flooding last winter.",
    "expectedCorrection": "The region suffered severe flooding last winter.",
    "cue": "Исправьте форму «severely» на подходящую форму слова со значением «серьёзный; суровый»."
  },
  {
    "catalogItemId": "lex-b2-specific",
    "incorrectContext": "The survey asks about specifically workplace experiences.",
    "expectedCorrection": "The survey asks about specific workplace experiences.",
    "cue": "Исправьте форму «specifically» на подходящую форму слова со значением «конкретный»."
  },
  {
    "catalogItemId": "lex-b2-stable",
    "incorrectContext": "Prices remained stably throughout the summer period.",
    "expectedCorrection": "Prices remained stable throughout the summer period.",
    "cue": "Исправьте форму «stably» на подходящую форму слова со значением «стабильный»."
  },
  {
    "catalogItemId": "lex-b2-substantial",
    "incorrectContext": "The project received substantially support from local businesses.",
    "expectedCorrection": "The project received substantial support from local businesses.",
    "cue": "Исправьте форму «substantially» на подходящую форму слова со значением «существенный»."
  },
  {
    "catalogItemId": "lex-b2-temporary",
    "incorrectContext": "The library has moved to a temporarily location.",
    "expectedCorrection": "The library has moved to a temporary location.",
    "cue": "Исправьте форму «temporarily» на подходящую форму слова со значением «временный»."
  },
  {
    "catalogItemId": "lex-b2-thorough",
    "incorrectContext": "The inspector conducted a thoroughly safety review.",
    "expectedCorrection": "The inspector conducted a thorough safety review.",
    "cue": "Исправьте форму «thoroughly» на подходящую форму слова со значением «тщательный»."
  },
  {
    "catalogItemId": "lex-b2-urgent",
    "incorrectContext": "The roof requires urgently repairs before winter.",
    "expectedCorrection": "The roof requires urgent repairs before winter.",
    "cue": "Исправьте форму «urgently» на подходящую форму слова со значением «срочный»."
  },
  {
    "catalogItemId": "lex-b2-vague",
    "incorrectContext": "The instructions were too vaguely to follow confidently.",
    "expectedCorrection": "The instructions were too vague to follow confidently.",
    "cue": "Исправьте форму «vaguely» на подходящую форму слова со значением «неясный»."
  },
  {
    "catalogItemId": "lex-b2-vulnerable",
    "incorrectContext": "Older residents are particularly vulnerability during heatwaves.",
    "expectedCorrection": "Older residents are particularly vulnerable during heatwaves.",
    "cue": "Исправьте форму «vulnerability» на подходящую форму слова со значением «уязвимый»."
  },
  {
    "catalogItemId": "lex-b2-accommodate",
    "incorrectContext": "The revised plan can accommodates larger groups safely.",
    "expectedCorrection": "The revised plan can accommodate larger groups safely.",
    "cue": "Исправьте форму «accommodates» на подходящую форму слова со значением «учитывать; размещать»."
  },
  {
    "catalogItemId": "lex-b2-acknowledge",
    "incorrectContext": "We must acknowledged the limitations of this study.",
    "expectedCorrection": "We must acknowledge the limitations of this study.",
    "cue": "Исправьте форму «acknowledged» на подходящую форму слова со значением «признавать»."
  },
  {
    "catalogItemId": "lex-b2-adapt",
    "incorrectContext": "Small businesses must adapted to changing customer habits.",
    "expectedCorrection": "Small businesses must adapt to changing customer habits.",
    "cue": "Исправьте форму «adapted» на подходящую форму слова со значением «приспосабливаться»."
  },
  {
    "catalogItemId": "lex-b2-anticipate",
    "incorrectContext": "Managers should anticipated problems before they become serious.",
    "expectedCorrection": "Managers should anticipate problems before they become serious.",
    "cue": "Исправьте форму «anticipated» на подходящую форму слова со значением «предвидеть»."
  },
  {
    "catalogItemId": "lex-b2-assume",
    "incorrectContext": "We should not assumed that everyone agrees.",
    "expectedCorrection": "We should not assume that everyone agrees.",
    "cue": "Исправьте форму «assumed» на подходящую форму слова со значением «предполагать»."
  },
  {
    "catalogItemId": "lex-b2-clarify",
    "incorrectContext": "Could you clarified what the final paragraph means?",
    "expectedCorrection": "Could you clarify what the final paragraph means?",
    "cue": "Исправьте форму «clarified» на подходящую форму слова со значением «прояснять»."
  },
  {
    "catalogItemId": "lex-b2-collaborate",
    "incorrectContext": "The two universities collaborates on environmental research.",
    "expectedCorrection": "The two universities collaborate on environmental research.",
    "cue": "Исправьте форму «collaborates» на подходящую форму слова со значением «сотрудничать»."
  },
  {
    "catalogItemId": "lex-b2-compensate",
    "incorrectContext": "Extra leave may compensated for the longer hours.",
    "expectedCorrection": "Extra leave may compensate for the longer hours.",
    "cue": "Исправьте форму «compensated» на подходящую форму слова со значением «компенсировать»."
  },
  {
    "catalogItemId": "lex-b2-compile",
    "incorrectContext": "The team will compiled the results next week.",
    "expectedCorrection": "The team will compile the results next week.",
    "cue": "Исправьте форму «compiled» на подходящую форму слова со значением «составлять»."
  },
  {
    "catalogItemId": "lex-b2-confirm",
    "incorrectContext": "Please confirms your attendance by Thursday afternoon.",
    "expectedCorrection": "Please confirm your attendance by Thursday afternoon.",
    "cue": "Исправьте форму «confirms» на подходящую форму слова со значением «подтверждать»."
  },
  {
    "catalogItemId": "lex-b2-consult",
    "incorrectContext": "You should consulted a specialist before signing anything.",
    "expectedCorrection": "You should consult a specialist before signing anything.",
    "cue": "Исправьте форму «consulted» на подходящую форму слова со значением «консультироваться»."
  },
  {
    "catalogItemId": "lex-b2-consume",
    "incorrectContext": "Older appliances consumes significantly more electricity.",
    "expectedCorrection": "Older appliances consume significantly more electricity.",
    "cue": "Исправьте форму «consumes» на подходящую форму слова со значением «потреблять»."
  },
  {
    "catalogItemId": "lex-b2-convince",
    "incorrectContext": "The evidence may convinced residents to support the plan.",
    "expectedCorrection": "The evidence may convince residents to support the plan.",
    "cue": "Исправьте форму «convinced» на подходящую форму слова со значением «убеждать»."
  },
  {
    "catalogItemId": "lex-b2-cope",
    "incorrectContext": "Some families struggle to copes with rising costs.",
    "expectedCorrection": "Some families struggle to cope with rising costs.",
    "cue": "Исправьте форму «copes» на подходящую форму слова со значением «справляться»."
  },
  {
    "catalogItemId": "lex-b2-demonstrate",
    "incorrectContext": "The figures demonstrates a steady improvement in performance.",
    "expectedCorrection": "The figures demonstrate a steady improvement in performance.",
    "cue": "Исправьте форму «demonstrates» на подходящую форму слова со значением «демонстрировать»."
  },
  {
    "catalogItemId": "lex-b2-detect",
    "incorrectContext": "The device can detected even minor temperature changes.",
    "expectedCorrection": "The device can detect even minor temperature changes.",
    "cue": "Исправьте форму «detected» на подходящую форму слова со значением «обнаруживать»."
  },
  {
    "catalogItemId": "lex-b2-diminish",
    "incorrectContext": "Public interest may diminished once the campaign ends.",
    "expectedCorrection": "Public interest may diminish once the campaign ends.",
    "cue": "Исправьте форму «diminished» на подходящую форму слова со значением «уменьшаться»."
  },
  {
    "catalogItemId": "lex-b2-distinguish",
    "incorrectContext": "Children gradually distinguishes fact from personal opinion.",
    "expectedCorrection": "Children gradually distinguish fact from personal opinion.",
    "cue": "Исправьте форму «distinguishes» на подходящую форму слова со значением «различать»."
  },
  {
    "catalogItemId": "lex-b2-eliminate",
    "incorrectContext": "Better insulation can eliminated most outside noise.",
    "expectedCorrection": "Better insulation can eliminate most outside noise.",
    "cue": "Исправьте форму «eliminated» на подходящую форму слова со значением «устранять»."
  },
  {
    "catalogItemId": "lex-b2-emphasise",
    "incorrectContext": "The report should emphasises the long-term benefits.",
    "expectedCorrection": "The report should emphasise the long-term benefits.",
    "cue": "Исправьте форму «emphasises» на подходящую форму слова со значением «подчёркивать»."
  },
  {
    "catalogItemId": "lex-b2-enable",
    "incorrectContext": "The grant will enabled us to replace old equipment.",
    "expectedCorrection": "The grant will enable us to replace old equipment.",
    "cue": "Исправьте форму «enabled» на подходящую форму слова со значением «позволять»."
  },
  {
    "catalogItemId": "lex-b2-encounter",
    "incorrectContext": "New users may encountered difficulties during registration.",
    "expectedCorrection": "New users may encounter difficulties during registration.",
    "cue": "Исправьте форму «encountered» на подходящую форму слова со значением «сталкиваться»."
  },
  {
    "catalogItemId": "lex-b2-enhance",
    "incorrectContext": "Good lighting can enhanced the atmosphere considerably.",
    "expectedCorrection": "Good lighting can enhance the atmosphere considerably.",
    "cue": "Исправьте форму «enhanced» на подходящую форму слова со значением «улучшать»."
  },
  {
    "catalogItemId": "lex-b2-ensure",
    "incorrectContext": "Regular checks ensures that the equipment remains safe.",
    "expectedCorrection": "Regular checks ensure that the equipment remains safe.",
    "cue": "Исправьте форму «ensures» на подходящую форму слова со значением «обеспечивать»."
  },
  {
    "catalogItemId": "lex-b2-establish",
    "incorrectContext": "The inquiry will established exactly what happened.",
    "expectedCorrection": "The inquiry will establish exactly what happened.",
    "cue": "Исправьте форму «established» на подходящую форму слова со значением «устанавливать; создавать»."
  },
  {
    "catalogItemId": "lex-b2-evaluate",
    "incorrectContext": "We need to evaluates every option objectively.",
    "expectedCorrection": "We need to evaluate every option objectively.",
    "cue": "Исправьте форму «evaluates» на подходящую форму слова со значением «оценивать»."
  },
  {
    "catalogItemId": "lex-b2-exceed",
    "incorrectContext": "Repair costs may exceeded the original estimate.",
    "expectedCorrection": "Repair costs may exceed the original estimate.",
    "cue": "Исправьте форму «exceeded» на подходящую форму слова со значением «превышать»."
  },
  {
    "catalogItemId": "lex-b2-exclude",
    "incorrectContext": "High fees may excluded people on low incomes.",
    "expectedCorrection": "High fees may exclude people on low incomes.",
    "cue": "Исправьте форму «excluded» на подходящую форму слова со значением «исключать»."
  },
  {
    "catalogItemId": "lex-b2-facilitate",
    "incorrectContext": "Clear labels facilitates quick access to information.",
    "expectedCorrection": "Clear labels facilitate quick access to information.",
    "cue": "Исправьте форму «facilitates» на подходящую форму слова со значением «облегчать»."
  },
  {
    "catalogItemId": "lex-b2-generate",
    "incorrectContext": "The campaign could generated considerable public interest.",
    "expectedCorrection": "The campaign could generate considerable public interest.",
    "cue": "Исправьте форму «generated» на подходящую форму слова со значением «создавать»."
  },
  {
    "catalogItemId": "lex-b2-highlight",
    "incorrectContext": "The incident highlight weaknesses in the current system.",
    "expectedCorrection": "The incident highlights weaknesses in the current system.",
    "cue": "Исправьте форму «highlight» на подходящую форму слова со значением «подчёркивать»."
  },
  {
    "catalogItemId": "lex-b2-identify",
    "incorrectContext": "The survey aims to identifies barriers to participation.",
    "expectedCorrection": "The survey aims to identify barriers to participation.",
    "cue": "Исправьте форму «identifies» на подходящую форму слова со значением «выявлять»."
  },
  {
    "catalogItemId": "lex-b2-imply",
    "incorrectContext": "His response seemed to implied that changes were coming.",
    "expectedCorrection": "His response seemed to imply that changes were coming.",
    "cue": "Исправьте форму «implied» на подходящую форму слова со значением «подразумевать»."
  },
  {
    "catalogItemId": "lex-b2-implement",
    "incorrectContext": "The council will implemented the policy gradually.",
    "expectedCorrection": "The council will implement the policy gradually.",
    "cue": "Исправьте форму «implemented» на подходящую форму слова со значением «внедрять»."
  },
  {
    "catalogItemId": "lex-b2-indicate",
    "incorrectContext": "Recent figures indicates a decline in demand.",
    "expectedCorrection": "Recent figures indicate a decline in demand.",
    "cue": "Исправьте форму «indicates» на подходящую форму слова со значением «указывать»."
  },
  {
    "catalogItemId": "lex-b2-justify",
    "incorrectContext": "Can you justifies the additional expense clearly?",
    "expectedCorrection": "Can you justify the additional expense clearly?",
    "cue": "Исправьте форму «justifies» на подходящую форму слова со значением «обосновывать»."
  },
  {
    "catalogItemId": "lex-b2-maintain",
    "incorrectContext": "The company must maintained high safety standards.",
    "expectedCorrection": "The company must maintain high safety standards.",
    "cue": "Исправьте форму «maintained» на подходящую форму слова со значением «поддерживать; утверждать»."
  },
  {
    "catalogItemId": "lex-b2-modify",
    "incorrectContext": "Engineers may modified the design after testing.",
    "expectedCorrection": "Engineers may modify the design after testing.",
    "cue": "Исправьте форму «modified» на подходящую форму слова со значением «изменять»."
  },
  {
    "catalogItemId": "lex-b2-monitor",
    "incorrectContext": "Staff monitoring air quality throughout the building.",
    "expectedCorrection": "Staff monitor air quality throughout the building.",
    "cue": "Исправьте форму «monitoring» на подходящую форму слова со значением «отслеживать»."
  },
  {
    "catalogItemId": "lex-b2-negotiate",
    "incorrectContext": "Both sides must negotiated a fair settlement.",
    "expectedCorrection": "Both sides must negotiate a fair settlement.",
    "cue": "Исправьте форму «negotiated» на подходящую форму слова со значением «вести переговоры»."
  },
  {
    "catalogItemId": "lex-b2-obtain",
    "incorrectContext": "Residents can obtained further details from the council.",
    "expectedCorrection": "Residents can obtain further details from the council.",
    "cue": "Исправьте форму «obtained» на подходящую форму слова со значением «получать»."
  },
  {
    "catalogItemId": "lex-b2-overcome",
    "incorrectContext": "The team managed to overcomes several technical problems.",
    "expectedCorrection": "The team managed to overcome several technical problems.",
    "cue": "Исправьте форму «overcomes» на подходящую форму слова со значением «преодолевать»."
  },
  {
    "catalogItemId": "lex-b2-perceive",
    "incorrectContext": "Customers perceives the new service as more reliable.",
    "expectedCorrection": "Customers perceive the new service as more reliable.",
    "cue": "Исправьте форму «perceives» на подходящую форму слова со значением «воспринимать»."
  },
  {
    "catalogItemId": "lex-b2-preserve",
    "incorrectContext": "The project aims to preserves local wildlife habitats.",
    "expectedCorrection": "The project aims to preserve local wildlife habitats.",
    "cue": "Исправьте форму «preserves» на подходящую форму слова со значением «сохранять»."
  },
  {
    "catalogItemId": "lex-b2-prevent",
    "incorrectContext": "Simple checks can prevented costly mistakes later.",
    "expectedCorrection": "Simple checks can prevent costly mistakes later.",
    "cue": "Исправьте форму «prevented» на подходящую форму слова со значением «предотвращать»."
  },
  {
    "catalogItemId": "lex-b2-prohibit",
    "incorrectContext": "The rules prohibits smoking anywhere inside the building.",
    "expectedCorrection": "The rules prohibit smoking anywhere inside the building.",
    "cue": "Исправьте форму «prohibits» на подходящую форму слова со значением «запрещать»."
  },
  {
    "catalogItemId": "lex-b2-promote",
    "incorrectContext": "The campaign will promoted safer cycling habits.",
    "expectedCorrection": "The campaign will promote safer cycling habits.",
    "cue": "Исправьте форму «promoted» на подходящую форму слова со значением «содействовать; продвигать»."
  },
  {
    "catalogItemId": "lex-b2-propose",
    "incorrectContext": "Residents proposes a cheaper alternative to demolition.",
    "expectedCorrection": "Residents propose a cheaper alternative to demolition.",
    "cue": "Исправьте форму «proposes» на подходящую форму слова со значением «предлагать»."
  },
  {
    "catalogItemId": "lex-b2-pursue",
    "incorrectContext": "She decided to pursued a career in research.",
    "expectedCorrection": "She decided to pursue a career in research.",
    "cue": "Исправьте форму «pursued» на подходящую форму слова со значением «добиваться; продолжать»."
  },
  {
    "catalogItemId": "lex-b2-recover",
    "incorrectContext": "Local tourism may recovered faster than expected.",
    "expectedCorrection": "Local tourism may recover faster than expected.",
    "cue": "Исправьте форму «recovered» на подходящую форму слова со значением «восстанавливаться»."
  },
  {
    "catalogItemId": "lex-b2-regulate",
    "incorrectContext": "New laws regulates how companies store personal data.",
    "expectedCorrection": "New laws regulate how companies store personal data.",
    "cue": "Исправьте форму «regulates» на подходящую форму слова со значением «регулировать»."
  },
  {
    "catalogItemId": "lex-b2-reinforce",
    "incorrectContext": "Regular practice can reinforced recently learned vocabulary.",
    "expectedCorrection": "Regular practice can reinforce recently learned vocabulary.",
    "cue": "Исправьте форму «reinforced» на подходящую форму слова со значением «укреплять»."
  },
  {
    "catalogItemId": "lex-b2-reject",
    "incorrectContext": "The committee may rejected proposals without clear evidence.",
    "expectedCorrection": "The committee may reject proposals without clear evidence.",
    "cue": "Исправьте форму «rejected» на подходящую форму слова со значением «отклонять»."
  },
  {
    "catalogItemId": "lex-b2-retain",
    "incorrectContext": "The building will retained its original entrance.",
    "expectedCorrection": "The building will retain its original entrance.",
    "cue": "Исправьте форму «retained» на подходящую форму слова со значением «сохранять»."
  },
  {
    "catalogItemId": "lex-b2-reveal",
    "incorrectContext": "The investigation may revealed further safety failures.",
    "expectedCorrection": "The investigation may reveal further safety failures.",
    "cue": "Исправьте форму «revealed» на подходящую форму слова со значением «раскрывать»."
  },
  {
    "catalogItemId": "lex-b2-revise",
    "incorrectContext": "We should revises the schedule before publication.",
    "expectedCorrection": "We should revise the schedule before publication.",
    "cue": "Исправьте форму «revises» на подходящую форму слова со значением «пересматривать»."
  },
  {
    "catalogItemId": "lex-b2-specify",
    "incorrectContext": "Please specifies which documents you have included.",
    "expectedCorrection": "Please specify which documents you have included.",
    "cue": "Исправьте форму «specifies» на подходящую форму слова со значением «указывать точно»."
  },
  {
    "catalogItemId": "lex-b2-stimulate",
    "incorrectContext": "Lower fees could stimulated demand for classes.",
    "expectedCorrection": "Lower fees could stimulate demand for classes.",
    "cue": "Исправьте форму «stimulated» на подходящую форму слова со значением «стимулировать»."
  },
  {
    "catalogItemId": "lex-b2-submit",
    "incorrectContext": "Applicants must submitted two references by Friday.",
    "expectedCorrection": "Applicants must submit two references by Friday.",
    "cue": "Исправьте форму «submitted» на подходящую форму слова со значением «подавать»."
  },
  {
    "catalogItemId": "lex-b2-sustain",
    "incorrectContext": "Small grants cannot sustained the project indefinitely.",
    "expectedCorrection": "Small grants cannot sustain the project indefinitely.",
    "cue": "Исправьте форму «sustained» на подходящую форму слова со значением «поддерживать»."
  },
  {
    "catalogItemId": "lex-b2-tackle",
    "incorrectContext": "The plan must tackled the shortage of housing.",
    "expectedCorrection": "The plan must tackle the shortage of housing.",
    "cue": "Исправьте форму «tackled» на подходящую форму слова со значением «решать; бороться с»."
  },
  {
    "catalogItemId": "lex-b2-transform",
    "incorrectContext": "Investment could transformed the neglected waterfront area.",
    "expectedCorrection": "Investment could transform the neglected waterfront area.",
    "cue": "Исправьте форму «transformed» на подходящую форму слова со значением «преобразовывать»."
  },
  {
    "catalogItemId": "lex-b2-undertake",
    "incorrectContext": "The firm will undertook a complete safety assessment.",
    "expectedCorrection": "The firm will undertake a complete safety assessment.",
    "cue": "Исправьте форму «undertook» на подходящую форму слова со значением «предпринимать»."
  },
  {
    "catalogItemId": "lex-b2-verify",
    "incorrectContext": "Editors must verified every factual claim before publication.",
    "expectedCorrection": "Editors must verify every factual claim before publication.",
    "cue": "Исправьте форму «verified» на подходящую форму слова со значением «проверять»."
  },
  {
    "catalogItemId": "lex-b2-access",
    "incorrectContext": "Rural communities need better accessible to healthcare.",
    "expectedCorrection": "Rural communities need better access to healthcare.",
    "cue": "Исправьте форму «accessible» на подходящую форму слова со значением «доступ»."
  },
  {
    "catalogItemId": "lex-b2-alternative",
    "incorrectContext": "The committee considered an alternatively to complete closure.",
    "expectedCorrection": "The committee considered an alternative to complete closure.",
    "cue": "Исправьте форму «alternatively» на подходящую форму слова со значением «альтернатива»."
  },
  {
    "catalogItemId": "lex-b2-assumption",
    "incorrectContext": "That conclusion depends on a questionable assume.",
    "expectedCorrection": "That conclusion depends on a questionable assumption.",
    "cue": "Исправьте форму «assume» на подходящую форму слова со значением «предположение»."
  },
  {
    "catalogItemId": "lex-b2-barrier",
    "incorrectContext": "High costs remain a barriers to participation.",
    "expectedCorrection": "High costs remain a barrier to participation.",
    "cue": "Исправьте форму «barriers» на подходящую форму слова со значением «препятствие»."
  },
  {
    "catalogItemId": "lex-b2-capacity",
    "incorrectContext": "The hall has a capacities of five hundred.",
    "expectedCorrection": "The hall has a capacity of five hundred.",
    "cue": "Исправьте форму «capacities» на подходящую форму слова со значением «способность; вместимость»."
  },
  {
    "catalogItemId": "lex-b2-commitment",
    "incorrectContext": "The role requires a long-term commit from volunteers.",
    "expectedCorrection": "The role requires a long-term commitment from volunteers.",
    "cue": "Исправьте форму «commit» на подходящую форму слова со значением «обязательство; преданность»."
  },
  {
    "catalogItemId": "lex-b2-constraint",
    "incorrectContext": "Time is the main constrain on this project.",
    "expectedCorrection": "Time is the main constraint on this project.",
    "cue": "Исправьте форму «constrain» на подходящую форму слова со значением «ограничение»."
  },
  {
    "catalogItemId": "lex-b2-context",
    "incorrectContext": "The quotation sounds different outside its original contextual.",
    "expectedCorrection": "The quotation sounds different outside its original context.",
    "cue": "Исправьте форму «contextual» на подходящую форму слова со значением «контекст»."
  },
  {
    "catalogItemId": "lex-b2-criterion",
    "incorrectContext": "Cost should not be the only criteria.",
    "expectedCorrection": "Cost should not be the only criterion.",
    "cue": "Исправьте форму «criteria» на подходящую форму слова со значением «критерий»."
  },
  {
    "catalogItemId": "lex-b2-debate",
    "incorrectContext": "The proposal has caused considerable public debated.",
    "expectedCorrection": "The proposal has caused considerable public debate.",
    "cue": "Исправьте форму «debated» на подходящую форму слова со значением «дискуссия»."
  },
  {
    "catalogItemId": "lex-b2-drawback",
    "incorrectContext": "The main draw back is the limited storage space.",
    "expectedCorrection": "The main drawback is the limited storage space.",
    "cue": "Исправьте форму «draw back» на подходящую форму слова со значением «недостаток»."
  },
  {
    "catalogItemId": "lex-b2-emphasis",
    "incorrectContext": "The course places greater emphasise on practical skills.",
    "expectedCorrection": "The course places greater emphasis on practical skills.",
    "cue": "Исправьте форму «emphasise» на подходящую форму слова со значением «акцент»."
  },
  {
    "catalogItemId": "lex-b2-exception",
    "incorrectContext": "Every room is accessible, with one except.",
    "expectedCorrection": "Every room is accessible, with one exception.",
    "cue": "Исправьте форму «except» на подходящую форму слова со значением «исключение»."
  },
  {
    "catalogItemId": "lex-b2-factor",
    "incorrectContext": "Cost was a major factors in our decision.",
    "expectedCorrection": "Cost was a major factor in our decision.",
    "cue": "Исправьте форму «factors» на подходящую форму слова со значением «фактор»."
  },
  {
    "catalogItemId": "lex-b2-framework",
    "incorrectContext": "The policy provides a frameworks for local decisions.",
    "expectedCorrection": "The policy provides a framework for local decisions.",
    "cue": "Исправьте форму «frameworks» на подходящую форму слова со значением «структура; система»."
  },
  {
    "catalogItemId": "lex-b2-incentive",
    "incorrectContext": "The discount provides an incentivise to book early.",
    "expectedCorrection": "The discount provides an incentive to book early.",
    "cue": "Исправьте форму «incentivise» на подходящую форму слова со значением «стимул»."
  },
  {
    "catalogItemId": "lex-b2-inequality",
    "incorrectContext": "The report examines regional unequal in healthcare.",
    "expectedCorrection": "The report examines regional inequality in healthcare.",
    "cue": "Исправьте форму «unequal» на подходящую форму слова со значением «неравенство»."
  },
  {
    "catalogItemId": "lex-b2-initiative",
    "incorrectContext": "The recycling initial has attracted strong community support.",
    "expectedCorrection": "The recycling initiative has attracted strong community support.",
    "cue": "Исправьте форму «initial» на подходящую форму слова со значением «инициатива»."
  },
  {
    "catalogItemId": "lex-b2-interpretation",
    "incorrectContext": "Her interpret of the results seems reasonable.",
    "expectedCorrection": "Her interpretation of the results seems reasonable.",
    "cue": "Исправьте форму «interpret» на подходящую форму слова со значением «толкование»."
  },
  {
    "catalogItemId": "lex-b2-limitation",
    "incorrectContext": "The small sample is an important limited.",
    "expectedCorrection": "The small sample is an important limitation.",
    "cue": "Исправьте форму «limited» на подходящую форму слова со значением «ограничение»."
  },
  {
    "catalogItemId": "lex-b2-priority",
    "incorrectContext": "Improving safety remains our highest prior.",
    "expectedCorrection": "Improving safety remains our highest priority.",
    "cue": "Исправьте форму «prior» на подходящую форму слова со значением «приоритет»."
  },
  {
    "catalogItemId": "lex-b2-procedure",
    "incorrectContext": "Staff must follow the emergency proceed carefully.",
    "expectedCorrection": "Staff must follow the emergency procedure carefully.",
    "cue": "Исправьте форму «proceed» на подходящую форму слова со значением «процедура»."
  },
  {
    "catalogItemId": "lex-b2-proportion",
    "incorrectContext": "A high proportional of residents supported the change.",
    "expectedCorrection": "A high proportion of residents supported the change.",
    "cue": "Исправьте форму «proportional» на подходящую форму слова со значением «доля»."
  },
  {
    "catalogItemId": "lex-b2-prospect",
    "incorrectContext": "The prospective of promotion motivated the whole team.",
    "expectedCorrection": "The prospect of promotion motivated the whole team.",
    "cue": "Исправьте форму «prospective» на подходящую форму слова со значением «перспектива»."
  },
  {
    "catalogItemId": "lex-b2-regulation",
    "incorrectContext": "The new regulate applies to every landlord.",
    "expectedCorrection": "The new regulation applies to every landlord.",
    "cue": "Исправьте форму «regulate» на подходящую форму слова со значением «нормативное требование»."
  },
  {
    "catalogItemId": "lex-b2-resource",
    "incorrectContext": "Clean water is a limited natural resources.",
    "expectedCorrection": "Clean water is a limited natural resource.",
    "cue": "Исправьте форму «resources» на подходящую форму слова со значением «ресурс»."
  },
  {
    "catalogItemId": "lex-b2-scope",
    "incorrectContext": "The inquiry has a much broader scopes now.",
    "expectedCorrection": "The inquiry has a much broader scope now.",
    "cue": "Исправьте форму «scopes» на подходящую форму слова со значением «масштаб; охват»."
  },
  {
    "catalogItemId": "lex-b2-shortage",
    "incorrectContext": "The region faces a serious housing short.",
    "expectedCorrection": "The region faces a serious housing shortage.",
    "cue": "Исправьте форму «short» на подходящую форму слова со значением «нехватка»."
  },
  {
    "catalogItemId": "lex-b2-strategy",
    "incorrectContext": "The company needs a clearer digital strategic.",
    "expectedCorrection": "The company needs a clearer digital strategy.",
    "cue": "Исправьте форму «strategic» на подходящую форму слова со значением «стратегия»."
  },
  {
    "catalogItemId": "lex-b2-trend",
    "incorrectContext": "The figures confirm a long-term downward trending.",
    "expectedCorrection": "The figures confirm a long-term downward trend.",
    "cue": "Исправьте форму «trending» на подходящую форму слова со значением «тенденция»."
  },
  {
    "catalogItemId": "lex-b2-allocate-resources",
    "incorrectContext": "Managers must allocation resources according to local needs.",
    "expectedCorrection": "Managers must allocate resources according to local needs.",
    "cue": "Исправьте часть речи в сочетании со значением «распределять ресурсы»."
  },
  {
    "catalogItemId": "lex-b2-arouse-suspicion",
    "incorrectContext": "The unusual payment may arousal suspicion among auditors.",
    "expectedCorrection": "The unusual payment may arouse suspicion among auditors.",
    "cue": "Исправьте часть речи в сочетании со значением «вызвать подозрение»."
  },
  {
    "catalogItemId": "lex-b2-bear-responsibility",
    "incorrectContext": "Senior managers bearing responsibility for the final decision.",
    "expectedCorrection": "Senior managers bear responsibility for the final decision.",
    "cue": "Исправьте форму опорного глагола в сочетании «нести ответственность»."
  },
  {
    "catalogItemId": "lex-b2-conduct-research",
    "incorrectContext": "The university will conduction research into coastal pollution.",
    "expectedCorrection": "The university will conduct research into coastal pollution.",
    "cue": "Исправьте часть речи в сочетании со значением «проводить исследование»."
  },
  {
    "catalogItemId": "lex-b2-deliver-results",
    "incorrectContext": "The new strategy must delivery results within a year.",
    "expectedCorrection": "The new strategy must deliver results within a year.",
    "cue": "Исправьте часть речи в сочетании со значением «давать результаты»."
  },
  {
    "catalogItemId": "lex-b2-express-doubt",
    "incorrectContext": "Several experts expression doubt about the official estimate.",
    "expectedCorrection": "Several experts express doubt about the official estimate.",
    "cue": "Исправьте часть речи в сочетании со значением «выразить сомнение»."
  },
  {
    "catalogItemId": "lex-b2-present-evidence",
    "incorrectContext": "Both sides will presentation evidence to the committee.",
    "expectedCorrection": "Both sides will present evidence to the committee.",
    "cue": "Исправьте часть речи в сочетании со значением «представить доказательства»."
  },
  {
    "catalogItemId": "lex-b2-above-all",
    "incorrectContext": "Over all, the new system must remain accessible.",
    "expectedCorrection": "Above all, the new system must remain accessible.",
    "cue": "Исправьте форму связки со значением «прежде всего»."
  },
  {
    "catalogItemId": "lex-b2-accordingly",
    "incorrectContext": "Demand has fallen, and production changed according.",
    "expectedCorrection": "Demand has fallen, and production changed accordingly.",
    "cue": "Исправьте часть речи в связке результата «соответственно»."
  },
  {
    "catalogItemId": "lex-b2-admittedly",
    "incorrectContext": "Admitted, the first proposal costs considerably less.",
    "expectedCorrection": "Admittedly, the first proposal costs considerably less.",
    "cue": "Исправьте часть речи во вводном слове со значением «следует признать»."
  },
  {
    "catalogItemId": "lex-b2-all-things-considered",
    "incorrectContext": "All things considering, postponing the launch seems sensible.",
    "expectedCorrection": "All things considered, postponing the launch seems sensible.",
    "cue": "Исправьте причастную форму в связке «учитывая всё»."
  },
  {
    "catalogItemId": "lex-b2-by-comparison",
    "incorrectContext": "By compare, the older model seems inefficient.",
    "expectedCorrection": "By comparison, the older model seems inefficient.",
    "cue": "Исправьте часть речи в связке со значением «для сравнения»."
  },
  {
    "catalogItemId": "lex-b2-in-practice",
    "incorrectContext": "On practice, the procedure takes much longer.",
    "expectedCorrection": "In practice, the procedure takes much longer.",
    "cue": "Исправьте предлог в связке со значением «на практике»."
  },
  {
    "catalogItemId": "lex-b2-in-principle",
    "incorrectContext": "In principal, everyone supports the proposed change.",
    "expectedCorrection": "In principle, everyone supports the proposed change.",
    "cue": "Исправьте выбор слова в связке со значением «в принципе»."
  },
  {
    "catalogItemId": "lex-b2-incidentally",
    "incorrectContext": "Incidental, the same firm designed our library.",
    "expectedCorrection": "Incidentally, the same firm designed our library.",
    "cue": "Исправьте часть речи во вводном слове со значением «кстати»."
  },
  {
    "catalogItemId": "lex-b2-in-other-words",
    "incorrectContext": "With other words, the service remains free.",
    "expectedCorrection": "In other words, the service remains free.",
    "cue": "Исправьте предлог в связке со значением «другими словами»."
  },
  {
    "catalogItemId": "lex-b2-in-particular",
    "incorrectContext": "Young families, on particular, welcomed the proposal.",
    "expectedCorrection": "Young families, in particular, welcomed the proposal.",
    "cue": "Исправьте предлог в связке со значением «в частности»."
  },
  {
    "catalogItemId": "lex-b2-similarly",
    "incorrectContext": "Similar, rural areas reported lower participation rates.",
    "expectedCorrection": "Similarly, rural areas reported lower participation rates.",
    "cue": "Исправьте часть речи во вводном слове со значением «аналогично»."
  },
  {
    "catalogItemId": "lex-b2-strictly-speaking",
    "incorrectContext": "Strict speaking, the document is only a draft.",
    "expectedCorrection": "Strictly speaking, the document is only a draft.",
    "cue": "Исправьте часть речи в связке со значением «строго говоря»."
  },
  {
    "catalogItemId": "lex-b2-would-rather-not",
    "incorrectContext": "I would rather don't discuss private details here.",
    "expectedCorrection": "I would rather not discuss private details here.",
    "cue": "После would rather используйте правильную форму отрицания."
  },
  {
    "catalogItemId": "lex-b2-had-better",
    "incorrectContext": "We had better to check the figures again.",
    "expectedCorrection": "We had better check the figures again.",
    "cue": "После had better уберите ошибочный маркер инфинитива."
  },
  {
    "catalogItemId": "lex-b2-it-is-worth",
    "incorrectContext": "It is worth to check the original source.",
    "expectedCorrection": "It is worth checking the original source.",
    "cue": "После worth используйте правильную форму глагола."
  },
  {
    "catalogItemId": "lex-b2-not-only-but-also",
    "incorrectContext": "The change saves not only time but too money.",
    "expectedCorrection": "The change saves not only time but also money.",
    "cue": "Исправьте вторую часть парной связки «не только… но и…»."
  },
  {
    "catalogItemId": "lex-b2-as-long-as",
    "incorrectContext": "You can join as long than you register.",
    "expectedCorrection": "You can join as long as you register.",
    "cue": "Исправьте последнюю часть условной связки «при условии что»."
  },
  {
    "catalogItemId": "lex-b2-whether-or-not",
    "incorrectContext": "We must decide whether nor not to proceed.",
    "expectedCorrection": "We must decide whether or not to proceed.",
    "cue": "Замените ошибочный nor на or в парной связке «независимо от того»."
  },
  {
    "catalogItemId": "lex-b2-as-if",
    "incorrectContext": "He spoke as like he knew everything.",
    "expectedCorrection": "He spoke as if he knew everything.",
    "cue": "Исправьте второе слово сравнительной связки «как будто»."
  },
  {
    "catalogItemId": "lex-b2-no-matter-how",
    "incorrectContext": "Not matter how carefully we plan, problems arise.",
    "expectedCorrection": "No matter how carefully we plan, problems arise.",
    "cue": "Исправьте первое слово уступительной конструкции «как бы ни»."
  },
  {
    "catalogItemId": "lex-b2-it-is-essential-that",
    "incorrectContext": "It is essential that everyone receiving accurate information.",
    "expectedCorrection": "It is essential that everyone receives accurate information.",
    "cue": "После essential that исправьте форму сказуемого."
  },
  {
    "catalogItemId": "lex-b2-what-matters-is",
    "incorrectContext": "What matter is how quickly we respond.",
    "expectedCorrection": "What matters is how quickly we respond.",
    "cue": "Исправьте согласование в конструкции «важно то, что…»."
  },
  {
    "catalogItemId": "lex-b2-as-far-as-concerned",
    "incorrectContext": "As far cost is concerned, both plans work.",
    "expectedCorrection": "As far as cost is concerned, both plans work.",
    "cue": "Верните второе as в рамке со значением «что касается…»."
  },
  {
    "catalogItemId": "lex-b2-under-no-circumstances",
    "incorrectContext": "Under no circumstances you should share this password.",
    "expectedCorrection": "Under no circumstances should you share this password.",
    "cue": "После отрицательной связки восстановите инверсию should you."
  },
  {
    "catalogItemId": "lex-b2-would-you-object",
    "incorrectContext": "Would you object that we postponed the meeting?",
    "expectedCorrection": "Would you object if we postponed the meeting?",
    "cue": "После object используйте правильную условную рамку в вежливом вопросе."
  },
  {
    "catalogItemId": "lex-b2-i-take-your-point",
    "incorrectContext": "I do your point, but the risk remains.",
    "expectedCorrection": "I take your point, but the risk remains.",
    "cue": "Исправьте опорный глагол в реплике признания аргумента."
  },
  {
    "catalogItemId": "lex-b2-thats-a-fair-point",
    "incorrectContext": "That’s a fairly point, and we should respond.",
    "expectedCorrection": "That’s a fair point, and we should respond.",
    "cue": "Исправьте часть речи перед существительным point."
  },
  {
    "catalogItemId": "lex-b2-im-not-convinced",
    "incorrectContext": "I’m not convincing that this approach is safer.",
    "expectedCorrection": "I’m not convinced that this approach is safer.",
    "cue": "Исправьте причастную форму, описывающую состояние говорящего."
  },
  {
    "catalogItemId": "lex-b2-as-i-understand-it",
    "incorrectContext": "As I understand about it, no decision is final.",
    "expectedCorrection": "As I understand it, no decision is final.",
    "cue": "Уберите ошибочный предлог после understand в уточняющей реплике."
  },
  {
    "catalogItemId": "lex-b2-correct-me-if-wrong",
    "incorrectContext": "Correct to me if I’m wrong, but funding ends soon.",
    "expectedCorrection": "Correct me if I’m wrong, but funding ends soon.",
    "cue": "Уберите ошибочный предлог после correct в осторожном уточнении."
  },
  {
    "catalogItemId": "lex-b2-i-see-what-you-mean",
    "incorrectContext": "I see what do you mean about the entrance.",
    "expectedCorrection": "I see what you mean about the entrance.",
    "cue": "Уберите инверсию do you из встроенного вопроса после see."
  },
  {
    "catalogItemId": "lex-b2-thats-not-necessarily-case",
    "incorrectContext": "That’s not necessary the case for smaller firms.",
    "expectedCorrection": "That’s not necessarily the case for smaller firms.",
    "cue": "Исправьте часть речи перед the case в вежливом возражении."
  },
  {
    "catalogItemId": "lex-b2-adaptable",
    "incorrectContext": "An adaptably team can respond quickly to unexpected problems.",
    "expectedCorrection": "An adaptable team can respond quickly to unexpected problems.",
    "cue": "Исправьте форму «adaptably» на подходящую форму слова со значением «легко приспосабливающийся»."
  },
  {
    "catalogItemId": "lex-b2-advocate",
    "incorrectContext": "Several doctors advocates earlier screening for people at risk.",
    "expectedCorrection": "Several doctors advocate earlier screening for people at risk.",
    "cue": "Исправьте форму «advocates» на подходящую форму слова со значением «выступать в поддержку»."
  },
  {
    "catalogItemId": "lex-b2-alleviate",
    "incorrectContext": "Better insulation could alleviated pressure on household energy budgets.",
    "expectedCorrection": "Better insulation could alleviate pressure on household energy budgets.",
    "cue": "Исправьте форму «alleviated» на подходящую форму слова со значением «облегчать; смягчать»."
  },
  {
    "catalogItemId": "lex-b2-articulate",
    "incorrectContext": "Candidates must articulated how their experience matches the role.",
    "expectedCorrection": "Candidates must articulate how their experience matches the role.",
    "cue": "Исправьте форму «articulated» на подходящую форму слова со значением «ясно выражать»."
  },
  {
    "catalogItemId": "lex-b2-compelling",
    "incorrectContext": "The documentary presents a compellingly case for protecting the wetlands.",
    "expectedCorrection": "The documentary presents a compelling case for protecting the wetlands.",
    "cue": "Исправьте форму «compellingly» на подходящую форму слова со значением «убедительный; неотразимый»."
  },
  {
    "catalogItemId": "lex-b2-credible",
    "incorrectContext": "The witness gave a detailed and credibly account of the incident.",
    "expectedCorrection": "The witness gave a detailed and credible account of the incident.",
    "cue": "Исправьте форму «credibly» на подходящую форму слова со значением «заслуживающий доверия; убедительный»."
  },
  {
    "catalogItemId": "lex-b2-cumulative",
    "incorrectContext": "The cumulatively effect of several small delays was considerable.",
    "expectedCorrection": "The cumulative effect of several small delays was considerable.",
    "cue": "Исправьте форму «cumulatively» на подходящую форму слова со значением «совокупный; накопительный»."
  },
  {
    "catalogItemId": "lex-b2-derive",
    "incorrectContext": "Researchers derives these estimates from three independent data sets.",
    "expectedCorrection": "Researchers derive these estimates from three independent data sets.",
    "cue": "Исправьте форму «derives» на подходящую форму слова со значением «получать; выводить»."
  },
  {
    "catalogItemId": "lex-b2-disclose",
    "incorrectContext": "Applicants must disclosed any financial interest in the company.",
    "expectedCorrection": "Applicants must disclose any financial interest in the company.",
    "cue": "Исправьте форму «disclosed» на подходящую форму слова со значением «раскрывать; сообщать»."
  },
  {
    "catalogItemId": "lex-b2-emerge",
    "incorrectContext": "Several practical difficulties may emerged during the trial period.",
    "expectedCorrection": "Several practical difficulties may emerge during the trial period.",
    "cue": "Исправьте форму «emerged» на подходящую форму слова со значением «возникать; становиться известным»."
  },
  {
    "catalogItemId": "lex-b2-enforcement",
    "incorrectContext": "Weak enforce has reduced the effectiveness of the new regulations.",
    "expectedCorrection": "Weak enforcement has reduced the effectiveness of the new regulations.",
    "cue": "Исправьте форму «enforce» на подходящую форму слова со значением «обеспечение соблюдения»."
  },
  {
    "catalogItemId": "lex-b2-exposure",
    "incorrectContext": "Long-term expose to loud noise can damage hearing.",
    "expectedCorrection": "Long-term exposure to loud noise can damage hearing.",
    "cue": "Исправьте форму «expose» на подходящую форму слова со значением «воздействие; подверженность»."
  },
  {
    "catalogItemId": "lex-b2-fluctuate",
    "incorrectContext": "Energy prices fluctuates considerably throughout the year.",
    "expectedCorrection": "Energy prices fluctuate considerably throughout the year.",
    "cue": "Исправьте форму «fluctuates» на подходящую форму слова со значением «колебаться»."
  },
  {
    "catalogItemId": "lex-b2-foster",
    "incorrectContext": "Shared projects can fostered trust between neighbouring communities.",
    "expectedCorrection": "Shared projects can foster trust between neighbouring communities.",
    "cue": "Исправьте форму «fostered» на подходящую форму слова со значением «способствовать развитию»."
  },
  {
    "catalogItemId": "lex-b2-hinder",
    "incorrectContext": "Outdated equipment may hindered the team’s ability to respond quickly.",
    "expectedCorrection": "Outdated equipment may hinder the team’s ability to respond quickly.",
    "cue": "Исправьте форму «hindered» на подходящую форму слова со значением «мешать; препятствовать»."
  },
  {
    "catalogItemId": "lex-b2-implication",
    "incorrectContext": "The report examines one wider imply of remote working for cities.",
    "expectedCorrection": "The report examines one wider implication of remote working for cities.",
    "cue": "Исправьте форму «imply» на подходящую форму слова со значением «последствие; скрытый смысл»."
  },
  {
    "catalogItemId": "lex-b2-inclusive",
    "incorrectContext": "The organisers want a more inclusively recruitment process.",
    "expectedCorrection": "The organisers want a more inclusive recruitment process.",
    "cue": "Исправьте форму «inclusively» на подходящую форму слова со значением «инклюзивный; учитывающий всех»."
  },
  {
    "catalogItemId": "lex-b2-marginal",
    "incorrectContext": "The revised method produced only a marginally improvement in accuracy.",
    "expectedCorrection": "The revised method produced only a marginal improvement in accuracy.",
    "cue": "Исправьте форму «marginally» на подходящую форму слова со значением «незначительный; минимальный»."
  },
  {
    "catalogItemId": "lex-b2-mechanism",
    "incorrectContext": "The policy includes a mechanical for reviewing disputed decisions.",
    "expectedCorrection": "The policy includes a mechanism for reviewing disputed decisions.",
    "cue": "Исправьте форму «mechanical» на подходящую форму слова со значением «механизм; способ действия»."
  },
  {
    "catalogItemId": "lex-b2-moderate",
    "incorrectContext": "The treatment produced a moderately improvement in sleep quality.",
    "expectedCorrection": "The treatment produced a moderate improvement in sleep quality.",
    "cue": "Исправьте форму «moderately» на подходящую форму слова со значением «умеренный»."
  },
  {
    "catalogItemId": "lex-b2-notification",
    "incorrectContext": "You will receive a notify when the application has been reviewed.",
    "expectedCorrection": "You will receive a notification when the application has been reviewed.",
    "cue": "Исправьте форму «notify» на подходящую форму слова со значением «уведомление»."
  },
  {
    "catalogItemId": "lex-b2-ongoing",
    "incorrectContext": "The findings are part of an ongoingly investigation into air quality.",
    "expectedCorrection": "The findings are part of an ongoing investigation into air quality.",
    "cue": "Исправьте форму «ongoingly» на подходящую форму слова со значением «продолжающийся; текущий»."
  },
  {
    "catalogItemId": "lex-b2-oppose",
    "incorrectContext": "Several local groups opposes the proposed road extension.",
    "expectedCorrection": "Several local groups oppose the proposed road extension.",
    "cue": "Исправьте форму «opposes» на подходящую форму слова со значением «выступать против»."
  },
  {
    "catalogItemId": "lex-b2-preliminary",
    "incorrectContext": "Preliminarily figures suggest that waiting times have fallen.",
    "expectedCorrection": "Preliminary figures suggest that waiting times have fallen.",
    "cue": "Исправьте форму «Preliminarily» на подходящую форму слова со значением «предварительный»."
  },
  {
    "catalogItemId": "lex-b2-prevalent",
    "incorrectContext": "The problem is especially prevalence among younger internet users.",
    "expectedCorrection": "The problem is especially prevalent among younger internet users.",
    "cue": "Исправьте форму «prevalence» на подходящую форму слова со значением «широко распространённый»."
  },
  {
    "catalogItemId": "lex-b2-refine",
    "incorrectContext": "Feedback from users will help us refinement the booking process.",
    "expectedCorrection": "Feedback from users will help us refine the booking process.",
    "cue": "Исправьте форму «refinement» на подходящую форму слова со значением «дорабатывать; совершенствовать»."
  },
  {
    "catalogItemId": "lex-b2-restore",
    "incorrectContext": "The board must act quickly to restoration public confidence.",
    "expectedCorrection": "The board must act quickly to restore public confidence.",
    "cue": "Исправьте форму «restoration» на подходящую форму слова со значением «восстанавливать»."
  },
  {
    "catalogItemId": "lex-b2-restriction",
    "incorrectContext": "The temporary restrict applies only to heavy vehicles.",
    "expectedCorrection": "The temporary restriction applies only to heavy vehicles.",
    "cue": "Исправьте форму «restrict» на подходящую форму слова со значением «ограничение; запрет»."
  },
  {
    "catalogItemId": "lex-b2-rigid",
    "incorrectContext": "A rigidly timetable may disadvantage employees with caring duties.",
    "expectedCorrection": "A rigid timetable may disadvantage employees with caring duties.",
    "cue": "Исправьте форму «rigidly» на подходящую форму слова со значением «жёсткий; негибкий»."
  },
  {
    "catalogItemId": "lex-b2-scarce",
    "incorrectContext": "Affordable housing remains scarcity in the city centre.",
    "expectedCorrection": "Affordable housing remains scarce in the city centre.",
    "cue": "Исправьте форму «scarcity» на подходящую форму слова со значением «дефицитный; редкий»."
  },
  {
    "catalogItemId": "lex-b2-sceptical",
    "incorrectContext": "Many residents remain scepticism about the promised benefits.",
    "expectedCorrection": "Many residents remain sceptical about the promised benefits.",
    "cue": "Исправьте форму «scepticism» на подходящую форму слова со значением «скептически настроенный»."
  },
  {
    "catalogItemId": "lex-b2-sustainable",
    "incorrectContext": "The town needs a sustainably approach to tourism.",
    "expectedCorrection": "The town needs a sustainable approach to tourism.",
    "cue": "Исправьте форму «sustainably» на подходящую форму слова со значением «устойчивый; экологически приемлемый»."
  },
  {
    "catalogItemId": "lex-b2-tentative",
    "incorrectContext": "We have reached a tentatively agreement on the delivery schedule.",
    "expectedCorrection": "We have reached a tentative agreement on the delivery schedule.",
    "cue": "Исправьте форму «tentatively» на подходящую форму слова со значением «предварительный; неуверенный»."
  },
  {
    "catalogItemId": "lex-b2-undergo",
    "incorrectContext": "The bridge will underwent a full safety inspection next month.",
    "expectedCorrection": "The bridge will undergo a full safety inspection next month.",
    "cue": "Исправьте форму «underwent» на подходящую форму слова со значением «подвергаться; проходить»."
  },
  {
    "catalogItemId": "lex-b2-viable",
    "incorrectContext": "The cheaper route is not viability during the winter months.",
    "expectedCorrection": "The cheaper route is not viable during the winter months.",
    "cue": "Исправьте форму «viability» на подходящую форму слова со значением «жизнеспособный; осуществимый»."
  },
  {
    "catalogItemId": "lex-b2-voluntary",
    "incorrectContext": "Participation in the follow-up interview is entirely voluntarily.",
    "expectedCorrection": "Participation in the follow-up interview is entirely voluntary.",
    "cue": "Исправьте форму «voluntarily» на подходящую форму слова со значением «добровольный»."
  },
  {
    "catalogItemId": "lex-b2-allocate",
    "incorrectContext": "The council will allocated additional funds to emergency repairs.",
    "expectedCorrection": "The council will allocate additional funds to emergency repairs.",
    "cue": "Исправьте форму «allocated» на подходящую форму слова со значением «выделять; распределять»."
  },
  {
    "catalogItemId": "lex-b2-attribute",
    "incorrectContext": "Experts attributes the decline to higher transport costs.",
    "expectedCorrection": "Experts attribute the decline to higher transport costs.",
    "cue": "Исправьте форму «attributes» на подходящую форму слова со значением «приписывать; объяснять»."
  },
  {
    "catalogItemId": "lex-b2-cease",
    "incorrectContext": "The factory will ceased production at the end of March.",
    "expectedCorrection": "The factory will cease production at the end of March.",
    "cue": "Исправьте форму «ceased» на подходящую форму слова со значением «прекращать»."
  },
  {
    "catalogItemId": "lex-b2-coincide",
    "incorrectContext": "The fall in demand may coincided with the holiday period.",
    "expectedCorrection": "The fall in demand may coincide with the holiday period.",
    "cue": "Исправьте форму «coincided» на подходящую форму слова со значением «совпадать»."
  },
  {
    "catalogItemId": "lex-b2-controversy",
    "incorrectContext": "The development plan has caused considerable controversial locally.",
    "expectedCorrection": "The development plan has caused considerable controversy locally.",
    "cue": "Исправьте форму «controversial» на подходящую форму слова со значением «общественный спор; полемика»."
  },
  {
    "catalogItemId": "lex-b2-decisive",
    "incorrectContext": "Her technical expertise was decisively in the final selection.",
    "expectedCorrection": "Her technical expertise was decisive in the final selection.",
    "cue": "Исправьте форму «decisively» на подходящую форму слова со значением «решающий; твёрдый»."
  },
  {
    "catalogItemId": "lex-b2-deteriorate",
    "incorrectContext": "Road conditions may deteriorated rapidly during heavy snowfall.",
    "expectedCorrection": "Road conditions may deteriorate rapidly during heavy snowfall.",
    "cue": "Исправьте форму «deteriorated» на подходящую форму слова со значением «ухудшаться»."
  },
  {
    "catalogItemId": "lex-b2-deviate",
    "incorrectContext": "Staff should not deviated from the safety procedure without approval.",
    "expectedCorrection": "Staff should not deviate from the safety procedure without approval.",
    "cue": "Исправьте форму «deviated» на подходящую форму слова со значением «отклоняться»."
  },
  {
    "catalogItemId": "lex-b2-dismiss",
    "incorrectContext": "We should not dismissed the complaints without examining the evidence.",
    "expectedCorrection": "We should not dismiss the complaints without examining the evidence.",
    "cue": "Исправьте форму «dismissed» на подходящую форму слова со значением «отвергать; увольнять»."
  },
  {
    "catalogItemId": "lex-b2-diversify",
    "incorrectContext": "The farm plans to diversification its sources of income.",
    "expectedCorrection": "The farm plans to diversify its sources of income.",
    "cue": "Исправьте форму «diversification» на подходящую форму слова со значением «разнообразить»."
  },
  {
    "catalogItemId": "lex-b2-empower",
    "incorrectContext": "The programme aims to empowerment residents to influence local decisions.",
    "expectedCorrection": "The programme aims to empower residents to influence local decisions.",
    "cue": "Исправьте форму «empowerment» на подходящую форму слова со значением «давать полномочия и возможности»."
  },
  {
    "catalogItemId": "lex-b2-exploit",
    "incorrectContext": "Dishonest agencies may exploited workers who lack legal advice.",
    "expectedCorrection": "Dishonest agencies may exploit workers who lack legal advice.",
    "cue": "Исправьте форму «exploited» на подходящую форму слова со значением «эксплуатировать; использовать в своих интересах»."
  },
  {
    "catalogItemId": "lex-b2-formulate",
    "incorrectContext": "The committee will formulated new guidance after the consultation.",
    "expectedCorrection": "The committee will formulate new guidance after the consultation.",
    "cue": "Исправьте форму «formulated» на подходящую форму слова со значением «формулировать; разрабатывать»."
  },
  {
    "catalogItemId": "lex-b2-incorporate",
    "incorrectContext": "The final design will incorporated feedback from wheelchair users.",
    "expectedCorrection": "The final design will incorporate feedback from wheelchair users.",
    "cue": "Исправьте форму «incorporated» на подходящую форму слова со значением «включать; учитывать»."
  },
  {
    "catalogItemId": "lex-b2-offset",
    "incorrectContext": "Lower maintenance costs may offsetted the higher purchase price.",
    "expectedCorrection": "Lower maintenance costs may offset the higher purchase price.",
    "cue": "Исправьте форму «offsetted» на подходящую форму слова со значением «компенсировать»."
  },
  {
    "catalogItemId": "lex-b2-persist",
    "incorrectContext": "The fault may persisted until the damaged cable is replaced.",
    "expectedCorrection": "The fault may persist until the damaged cable is replaced.",
    "cue": "Исправьте форму «persisted» на подходящую форму слова со значением «сохраняться; упорно продолжать»."
  },
  {
    "catalogItemId": "lex-b2-at-first-sight",
    "incorrectContext": "In first sight, the two proposals appear almost identical.",
    "expectedCorrection": "At first sight, the two proposals appear almost identical.",
    "cue": "Исправьте предлог в связке со значением «на первый взгляд»."
  },
  {
    "catalogItemId": "lex-b2-in-most-cases",
    "incorrectContext": "At most cases, residents supported the revised transport plan.",
    "expectedCorrection": "In most cases, residents supported the revised transport plan.",
    "cue": "Исправьте предлог в связке со значением «в большинстве случаев»."
  },
  {
    "catalogItemId": "lex-b2-even-so",
    "incorrectContext": "The sample was relatively small. Even though, the pattern was consistent.",
    "expectedCorrection": "The sample was relatively small. Even so, the pattern was consistent.",
    "cue": "Исправьте смешение самостоятельной связки с подчинительным союзом."
  },
  {
    "catalogItemId": "lex-b2-in-that-respect",
    "incorrectContext": "The two plans differ considerably on that respect.",
    "expectedCorrection": "The two plans differ considerably in that respect.",
    "cue": "Исправьте предлог в связке со значением «в этом отношении»."
  },
  {
    "catalogItemId": "lex-b2-in-any-case",
    "incorrectContext": "The forecast may change, but at any case we need a backup venue.",
    "expectedCorrection": "The forecast may change, but in any case we need a backup venue.",
    "cue": "Исправьте предлог в связке со значением «в любом случае»."
  },
  {
    "catalogItemId": "lex-b2-in-comparison",
    "incorrectContext": "Last winter was mild. At comparison, this year has been exceptionally cold.",
    "expectedCorrection": "Last winter was mild. In comparison, this year has been exceptionally cold.",
    "cue": "Исправьте предлог в связке со значением «для сравнения»."
  },
  {
    "catalogItemId": "lex-b2-in-effect",
    "incorrectContext": "The extra requirement is, on effect, a ban on smaller providers.",
    "expectedCorrection": "The extra requirement is, in effect, a ban on smaller providers.",
    "cue": "Исправьте предлог в связке со значением «фактически»."
  },
  {
    "catalogItemId": "lex-b2-after-careful-consideration",
    "incorrectContext": "After carefully consideration, we decided to consult residents first.",
    "expectedCorrection": "After careful consideration, we decided to consult residents first.",
    "cue": "Исправьте часть речи перед consideration."
  },
  {
    "catalogItemId": "lex-b2-in-other-respects",
    "incorrectContext": "The device is expensive but performs well on other respects.",
    "expectedCorrection": "The device is expensive but performs well in other respects.",
    "cue": "Исправьте предлог в связке со значением «в других отношениях»."
  },
  {
    "catalogItemId": "lex-b2-in-reality",
    "incorrectContext": "The process looks simple but is much slower on reality.",
    "expectedCorrection": "The process looks simple but is much slower in reality.",
    "cue": "Исправьте предлог в связке со значением «в действительности»."
  },
  {
    "catalogItemId": "lex-b2-in-turn",
    "incorrectContext": "Reliable childcare supports employment, which on turn reduces financial hardship.",
    "expectedCorrection": "Reliable childcare supports employment, which in turn reduces financial hardship.",
    "cue": "Исправьте предлог в связке со значением «в свою очередь»."
  },
  {
    "catalogItemId": "lex-b2-what-is-more",
    "incorrectContext": "The route is shorter and, what more is, considerably safer.",
    "expectedCorrection": "The route is shorter and, what is more, considerably safer.",
    "cue": "Восстановите порядок слов в связке со значением «более того»."
  },
  {
    "catalogItemId": "lex-b2-i-appreciate-your-concern",
    "incorrectContext": "I am appreciate your concern, and we will review the safety evidence again.",
    "expectedCorrection": "I appreciate your concern, and we will review the safety evidence again.",
    "cue": "Уберите ошибочный be перед глаголом appreciate."
  },
  {
    "catalogItemId": "lex-b2-i-would-argue-that",
    "incorrectContext": "I would argue about that the long-term benefits justify the initial cost.",
    "expectedCorrection": "I would argue that the long-term benefits justify the initial cost.",
    "cue": "Уберите ошибочный предлог перед that-clause после argue."
  },
  {
    "catalogItemId": "lex-b2-what-i-mean-is",
    "incorrectContext": "What I mean it is that the deadline itself remains unchanged.",
    "expectedCorrection": "What I mean is that the deadline itself remains unchanged.",
    "cue": "Уберите лишнее it из рамки What I mean is…."
  },
  {
    "catalogItemId": "lex-b2-i-would-be-grateful-if",
    "incorrectContext": "I would be grateful if you could to confirm the revised delivery date.",
    "expectedCorrection": "I would be grateful if you could confirm the revised delivery date.",
    "cue": "Уберите ошибочный to после модального could."
  },
  {
    "catalogItemId": "lex-b2-as-far-as-i-can-tell",
    "incorrectContext": "As far as I can to tell, both versions contain the same data.",
    "expectedCorrection": "As far as I can tell, both versions contain the same data.",
    "cue": "Уберите ошибочный to после can в осторожном выводе."
  }
] as const satisfies readonly AuthoredActivationErrorPair[]
