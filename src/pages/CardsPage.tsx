import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonVariants'
import { Card, CardBody } from '../components/ui/Card'
import { MarginNote } from '../components/ui/MarginNote'
import { Rule } from '../components/ui/Rule'
import { activationRecognitionLabel, buildActivationChoices } from '../domain/practice'
import { buildPracticeQueue } from '../domain/queue'
import { dailyVocabularyItems, localDayKey, resolveDailyVocabularyAssignment } from '../domain/dailyVocabulary'
import type { Phrase } from '../domain/types'
import { useLexicalCatalogLevel } from '../hooks/useLexicalCatalogLevel'
import { useLocalToday } from '../hooks/useLocalToday'
import { useForgeStore } from '../store/useForgeStore'
import { cn } from '../lib/utils'
import { DUR, motionScale } from '../lib/motion'

/**
 * «Занятие» — карточки как ядро приложения.
 *
 * Одна простая петля: видишь слово → выбираешь ответ → сразу видишь вердикт и
 * перевод с примером → дальше по кнопке или Enter, темп задаёт ученик. Никакой терминологии
 * машины запоминания на поверхности; расписание работает под капотом:
 * карточка повторения пишет обычную оценку в планировщик (верно → «Хорошо»,
 * неверно → «Снова»), новая карточка отмечает «Узнано» в сегодняшнем наборе.
 * Раунды сверх плана — чистая тренировка, они не искажают расписание.
 */

type Direction = 'en-ru' | 'ru-en' | 'mixed'

interface TrainingCard {
  key: string
  kind: 'new' | 'review'
  phraseId?: string
  itemId?: string
  cue: string
  cueLang: 'en' | 'ru'
  choices: string[]
  choiceLang: 'en' | 'ru'
  answerIndex: number
  translation: string
  example?: string
}

function shuffle<T>(items: readonly T[]): T[] {
  const list = [...items]
  for (let index = list.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[list[index], list[other]] = [list[other], list[index]]
  }
  return list
}

const COUNT_CHOICES = [10, 20, 30] as const

export function CardsPage() {
  const store = useForgeStore(useShallow((state) => ({
    phrases: state.phrases,
    skillStates: state.skillStates,
    reviews: state.reviews,
    preferences: state.preferences,
    dailyVocabularyAssignment: state.dailyVocabularyAssignment,
    dailyVocabularyAssignments: state.dailyVocabularyAssignments,
    recordReview: state.recordReview,
    markDailyVocabularyPreviewed: state.markDailyVocabularyPreviewed,
    archivePhrase: state.archivePhrase,
  })))
  const today = useLocalToday()
  const level = store.preferences.currentLevel
  const { items: levelCatalog } = useLexicalCatalogLevel(level)
  const dailyNewTarget = Math.min(30, Math.max(1, store.preferences.dailyNewWords ?? 10))

  const dailyResolution = useMemo(
    () => levelCatalog ? resolveDailyVocabularyAssignment(levelCatalog, level, store.phrases, today, dailyNewTarget, store.dailyVocabularyAssignments.find((item) => item.dayKey === localDayKey(today) && item.level === level) ?? store.dailyVocabularyAssignment, store.dailyVocabularyAssignments) : null,
    [dailyNewTarget, level, levelCatalog, store.dailyVocabularyAssignment, store.dailyVocabularyAssignments, store.phrases, today],
  )
  const dailyAssignment = dailyResolution?.assignment ?? null
  const dailyItems = useMemo(() => levelCatalog && dailyAssignment ? dailyVocabularyItems(levelCatalog, level, store.phrases, today, dailyNewTarget, dailyAssignment, store.dailyVocabularyAssignments) : [], [dailyAssignment, dailyNewTarget, level, levelCatalog, store.dailyVocabularyAssignments, store.phrases, today])
  const previewedIds = useMemo(() => new Set(dailyAssignment?.previewedIds ?? []), [dailyAssignment?.previewedIds])

  // Пул для неправильных вариантов: мои слова + весь каталог уровня как псевдофразы.
  const distractorPool = useMemo<Phrase[]>(() => [
    ...store.phrases.filter((phrase) => phrase.status !== 'archived'),
    ...(levelCatalog ?? []).map((item) => ({
      id: `catalog-choice-${item.id}`, canonical: item.expression, normalizedKey: item.expression.toLocaleLowerCase('en-US'),
      meaning: item.translationRu, kind: item.kind, cefr: item.level, register: [item.register], context: item.example,
      source: 'Reviewed bundled catalog', tags: [item.topic], note: item.note ?? '', acceptedForms: [], examples: [],
      depth: { grammarFrame: item.pattern ?? '', collocates: [], constraints: [], contrasts: [], connotation: '', pronunciationNote: '' },
      status: 'new' as const, createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:00.000Z',
    })),
  ], [levelCatalog, store.phrases])

  const dueReviewPhrases = useMemo(() => {
    const queue = buildPracticeQueue(store.skillStates, store.phrases, store.preferences, today, ['meaning_recall'], dailyAssignment, store.reviews)
    const ids = [...new Set(queue.map((item) => item.phraseId))]
    return ids.map((id) => store.phrases.find((phrase) => phrase.id === id)).filter((phrase): phrase is Phrase => Boolean(phrase))
  }, [dailyAssignment, store.phrases, store.preferences, store.reviews, store.skillStates, today])

  const freshItems = useMemo(() => dailyItems.filter((item) => !previewedIds.has(item.id)), [dailyItems, previewedIds])

  const [phase, setPhase] = useState<'setup' | 'run' | 'done'>('setup')
  const [direction, setDirection] = useState<Direction>('mixed')
  const [count, setCount] = useState<number>(20)
  const [deck, setDeck] = useState<TrainingCard[]>([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const [training, setTraining] = useState(false)
  const sessionId = useRef(crypto.randomUUID())
  // Уходящий лист: снимок предыдущего рендера карточки (паттерн PracticePage).
  const [outgoingCard, setOutgoingCard] = useState<ReactNode>(null)
  const cardSnapshot = useRef<ReactNode>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); timers.current = [] }, [])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  function pickDirection(position: number): 'en-ru' | 'ru-en' {
    if (direction !== 'mixed') return direction
    return position % 2 === 0 ? 'en-ru' : 'ru-en'
  }

  function buildDeck(trainingRound: boolean): TrainingCard[] {
    const cards: TrainingCard[] = []
    const catalogByOthers = (excludeId: string, field: 'translationRu' | 'expression', exclude: string) =>
      shuffle((levelCatalog ?? []).filter((other) => other.id !== excludeId && other[field] !== exclude)).slice(0, 2)

    const newSource = trainingRound ? dailyItems : freshItems
    for (const item of newSource) {
      const cardDirection = pickDirection(cards.length)
      if (cardDirection === 'en-ru') {
        const others = catalogByOthers(item.id, 'translationRu', item.translationRu)
        if (others.length < 2) continue
        const choices = shuffle([item.translationRu, ...others.map((other) => other.translationRu)])
        cards.push({ key: `new-${item.id}`, kind: 'new', itemId: item.id, cue: item.expression, cueLang: 'en', choices, choiceLang: 'ru', answerIndex: choices.indexOf(item.translationRu), translation: item.translationRu, example: item.example })
      } else {
        const others = catalogByOthers(item.id, 'expression', item.expression)
        if (others.length < 2) continue
        const choices = shuffle([item.expression, ...others.map((other) => other.expression)])
        cards.push({ key: `new-${item.id}`, kind: 'new', itemId: item.id, cue: item.translationRu, cueLang: 'ru', choices, choiceLang: 'en', answerIndex: choices.indexOf(item.expression), translation: item.translationRu, example: item.example })
      }
    }

    const reviewSource = trainingRound
      ? shuffle(store.phrases.filter((phrase) => phrase.status !== 'archived' && phrase.meaning.trim())).slice(0, count)
      : dueReviewPhrases
    for (const phrase of reviewSource) {
      const label = activationRecognitionLabel(phrase)
      if (!label) continue
      const cardDirection = pickDirection(cards.length)
      if (cardDirection === 'en-ru') {
        const choices = buildActivationChoices(distractorPool, phrase, 'recognition')
        if (choices.length < 3 || !choices.includes(label)) continue
        cards.push({ key: `rev-${phrase.id}`, kind: 'review', phraseId: phrase.id, cue: phrase.canonical, cueLang: 'en', choices, choiceLang: 'ru', answerIndex: choices.indexOf(label), translation: label, example: phrase.context })
      } else {
        const others = shuffle(distractorPool.filter((other) => other.id !== phrase.id && other.canonical !== phrase.canonical && activationRecognitionLabel(other) !== label)).slice(0, 2)
        if (others.length < 2) continue
        const choices = shuffle([phrase.canonical, ...others.map((other) => other.canonical)])
        cards.push({ key: `rev-${phrase.id}`, kind: 'review', phraseId: phrase.id, cue: label, cueLang: 'ru', choices, choiceLang: 'en', answerIndex: choices.indexOf(phrase.canonical), translation: label, example: phrase.context })
      }
    }
    return shuffle(cards).slice(0, count)
  }

  function start(trainingRound: boolean) {
    const built = buildDeck(trainingRound)
    if (!built.length) return
    sessionId.current = crypto.randomUUID()
    setTraining(trainingRound)
    setDeck(built)
    setIndex(0)
    setPicked(null)
    setScore({ right: 0, total: 0 })
    setPhase('run')
  }

  const card = deck[index]

  function answer(choiceIndex: number) {
    if (!card || picked !== null) return
    setPicked(choiceIndex)
    const correct = choiceIndex === card.answerIndex
    setScore((value) => ({ right: value.right + (correct ? 1 : 0), total: value.total + 1 }))
    if (!training) {
      if (card.kind === 'review' && card.phraseId) {
        store.recordReview({ phraseId: card.phraseId, skill: 'meaning_recall', response: card.choices[choiceIndex], answerMatched: correct, requestedGrade: correct ? 2 : 0, hintsUsed: 0, revealUsed: false, supportUsed: false, idempotencyKey: `cards-${sessionId.current}-${card.key}` })
      }
      if (card.kind === 'new' && card.itemId && dailyAssignment && correct) {
        store.markDailyVocabularyPreviewed(card.itemId, dailyAssignment)
      }
    }
  }

  function next() {
    // Фаза out играет на копии; при motionScale() === 0 смена мгновенная.
    if (index + 1 < deck.length && motionScale() !== 0) {
      setOutgoingCard(cardSnapshot.current)
      later(() => setOutgoingCard(null), DUR.cardOut * motionScale())
    }
    setPicked(null)
    if (index + 1 >= deck.length) setPhase('done')
    else setIndex((value) => value + 1)
  }

  function markKnown() {
    if (card?.kind === 'review' && card.phraseId) store.archivePhrase(card.phraseId)
    next()
  }

  if (phase === 'setup') {
    const plannedNew = freshItems.length
    const plannedReview = dueReviewPhrases.length
    const nothingPlanned = plannedNew + plannedReview === 0
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card level="leaf">
          <CardBody className="space-y-5 p-6">
            <div>
              <p className="section-kicker">Занятие</p>
              <h2 className="mt-1 text-h2 font-light text-primary">Карточки на сегодня</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">
                {nothingPlanned
                  ? 'Всё по плану сделано. Можно пройти тренировочный раунд по изученным словам — он не влияет на расписание.'
                  : <>Новых слов: <span className="numeral font-semibold text-primary">{plannedNew}</span> · на повторении: <span className="numeral font-semibold text-primary">{plannedReview}</span>. Темп ваш: дальше — по кнопке или по Enter.</>}
              </p>
            </div>

            <div>
              <p className="inspector-label">Направление</p>
              <div className="mt-2 flex gap-px overflow-hidden rounded-[3px] bg-border">
                {([['en-ru', 'EN → RU'], ['ru-en', 'RU → EN'], ['mixed', 'Вперемешку']] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={direction === value} onClick={() => setDirection(value)}
                    className={cn('detent relative min-h-11 flex-1 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus', direction === value ? 'bg-recess text-primary shadow-[var(--press)]' : 'bg-elevated text-secondary shadow-[var(--bevel-up)] hover:text-primary')}>
                    {direction === value && <span aria-hidden="true" className="bracket-in absolute inset-y-1.5 left-0 w-[3px] bg-rubric" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="inspector-label">Сколько карточек</p>
              <div className="mt-2 flex gap-px overflow-hidden rounded-[3px] bg-border">
                {COUNT_CHOICES.map((value) => (
                  <button key={value} type="button" aria-pressed={count === value} onClick={() => setCount(value)}
                    className={cn('detent numeral relative min-h-11 flex-1 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus', count === value ? 'bg-recess text-primary shadow-[var(--press)]' : 'bg-elevated text-secondary shadow-[var(--bevel-up)] hover:text-primary')}>
                    {count === value && <span aria-hidden="true" className="bracket-in absolute inset-y-1.5 left-0 w-[3px] bg-rubric" />}
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {nothingPlanned
                ? <Button size="lg" onClick={() => start(true)} disabled={!store.phrases.length && !dailyItems.length}><RotateCcw className="size-4" /> Тренировочный раунд</Button>
                : <Button size="lg" onClick={() => start(false)}>Начать <ArrowRight className="size-4" /></Button>}
              <Link to="/practice" className={buttonClass({ variant: 'ghost' })}>Углублённая практика</Link>
            </div>
          </CardBody>
        </Card>
        <MarginNote>Карточка повторения записывает обычную оценку в расписание: верно — «Хорошо», неверно — «Снова». Тренировочные раунды на расписание не влияют.</MarginNote>
      </div>
    )
  }

  if (phase === 'done') {
    const perfect = score.total > 0 && score.right === score.total
    return (
      <div className="mx-auto max-w-2xl">
        <Card level="leaf">
          <CardBody className="empty-state py-14">
            <Check className="stamp-in size-7 text-verified" />
            <div>
              {perfect && (
                <p>
                  <span className="dialog-in label-caps inline-block rounded-[2px] border border-verified/60 px-3 py-1 text-verified [transform:rotate(-2.5deg)]">
                    принято · без правки
                  </span>
                </p>
              )}
              <h2 className="text-h2 font-light text-primary">{perfect ? 'Без единой ошибки.' : 'Занятие закончено.'}</h2>
              <p className="typeset numeral mt-2 text-sm text-secondary">Верно {score.right} из {score.total}{training ? ' · тренировочный раунд' : ''}</p>
            </div>
            <div aria-hidden="true" className="rise-in w-full max-w-56"><Rule value={score.right} max={Math.max(1, score.total)} showFraction={false} /></div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => start(true)}><RotateCcw className="size-4" /> Ещё раунд</Button>
              <Link to="/" className={buttonClass({ variant: 'secondary' })}>На главную</Link>
            </div>
            {!training && <MarginNote className="text-center xl:[transform:none]">Раунды сверх плана — тренировка: расписание повторений они не трогают.</MarginNote>}
          </CardBody>
        </Card>
      </div>
    )
  }

  if (!card) return null
  const answered = picked !== null
  const correct = answered && picked === card.answerIndex

  // Один и тот же лист печатается в двух фазах (паттерн PracticePage).
  // Уходящий снимок НЕ несёт .card-in и не перехватывает autoFocus.
  const renderCard = (cardPhase: 'in' | 'out') => (
    <Card key={card.key} level="leaf" className={cn(cardPhase === 'in' && 'card-in', 'transition-[border-color]', answered && (correct ? 'border-verified' : 'border-amber'), answered && !correct && 'nudge')}>
      <CardBody className="space-y-5 p-6">
        <p className="inspector-label">{card.kind === 'new' ? 'Новое слово' : 'Повторение'} · {card.cueLang === 'en' ? 'что это значит?' : 'как это по-английски?'}</p>
        {card.cueLang === 'en'
          ? <p lang="en" className="set-text reading-en text-readlg text-primary">{card.cue}</p>
          : <p lang="ru" className="text-h2 font-light text-primary">{card.cue}</p>}

        <div className="grid gap-2">
          {card.choices.map((choice, choiceIndex) => {
            const isAnswer = choiceIndex === card.answerIndex
            const isPicked = choiceIndex === picked
            return (
              <button
                key={choice}
                type="button"
                lang={card.choiceLang}
                aria-pressed={isPicked}
                disabled={answered}
                onClick={() => answer(choiceIndex)}
                className={cn(
                  'detent relative min-h-11 rounded-[3px] border p-3 pl-4 text-left text-base',
                  card.choiceLang === 'en' && 'reading-en',
                  !answered && 'lamp border-border bg-elevated text-secondary shadow-[var(--lift-1)] hover:border-border-strong hover:text-primary',
                  answered && isAnswer && 'border-verified bg-verified-soft text-primary',
                  answered && isPicked && !isAnswer && 'border-amber bg-amber/10 text-primary',
                  answered && !isPicked && !isAnswer && 'border-border bg-elevated text-muted opacity-60',
                )}
              >
                {answered && isAnswer && <span aria-hidden="true" className="bracket-in absolute inset-y-2 left-0 w-[3px] bg-verified" />}
                {choice}
              </button>
            )
          })}
        </div>

        {answered && (
          <div className="rise-in space-y-2">
            {correct && (
              <span className="dialog-in label-caps inline-block w-fit rounded-[2px] border border-verified/60 px-2.5 py-1 text-verified [transform:rotate(-2deg)]">
                Зачёт ✓
              </span>
            )}
            <p lang="ru" className="text-sm font-semibold text-teal-strong">{card.translation}</p>
            {card.example && <p lang="en" className="set-text reading-en text-read text-primary">{card.example}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              {/* Автофокус: Enter или пробел листают дальше — темп задаёт ученик. */}
              <Button size="sm" autoFocus={cardPhase === 'in'} onClick={next}>Дальше <ArrowRight className="size-4" /></Button>
              {card.kind === 'review' && !training && <Button size="sm" variant="ghost" onClick={markKnown}>Уже знаю — не повторять</Button>}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
  cardSnapshot.current = renderCard('out')

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Rule progressbar value={index + (answered ? 1 : 0)} max={deck.length} ariaLabel="Прогресс занятия" className="max-w-64 flex-1" />
        <p key={score.right} className="typeset numeral text-xs text-muted">верно {score.right}</p>
      </div>

      <div className="card-stage relative">
        {outgoingCard && <div aria-hidden="true" inert className="card-out pointer-events-none absolute inset-x-0 top-0">{outgoingCard}</div>}
        {renderCard('in')}
      </div>

      <p className="text-xs leading-5 text-muted">{answered ? (correct ? 'Верно! Дальше — когда будете готовы.' : 'Запомните правильный ответ и идите дальше.') : 'Выберите один из трёх вариантов.'}</p>
    </div>
  )
}
