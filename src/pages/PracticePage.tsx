import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, CheckCircle2, CircleHelp, Flag, Keyboard, Lightbulb } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonVariants'
import { Card, CardBody } from '../components/ui/Card'
import { MarginNote } from '../components/ui/MarginNote'
import { Rule } from '../components/ui/Rule'
import { Textarea } from '../components/ui/Field'
import { activationDailyQuota, activationNewAdmissionLimit, activationWorkDoneToday, buildDailyActivationQueue, buildTargetedActivationQueue, type ActivationMode } from '../domain/activation'
import { localDayKey } from '../domain/dailyVocabulary'
import { activationErrorResponseMatches, activationRecognitionLabel, buildActivationChoices, buildActivationErrorPrompt, buildPracticePrompt, clozeExpectedAnswer, redactAcceptedForms, responseMatchesPractice } from '../domain/practice'
import { buildPracticeQueue, dailyReviewPlan, estimatePracticeMinutes, practiceTaskCapacityForMinutes, wasDueWhenReviewed } from '../domain/queue'
import type { Grade, Phrase, Skill } from '../domain/types'
import { useLexicalCatalogLevel } from '../hooks/useLexicalCatalogLevel'
import { useForgeStore } from '../store/useForgeStore'
import { DUR, motionScale } from '../lib/motion'
import { cn } from '../lib/utils'

interface QueueItem { phraseId: string; skill: Skill; key: string; mode?: ActivationMode }

/** Вердикт последней проверки: рамка листа на ~400ms, затем покой.
 *  Класс снимается по таймеру — постоянный transform на контейнере с
 *  английским текстом держал бы поддерево растрированным. */
type Verdict = 'matched' | 'missed' | null

function activationPrompt(phrase: Phrase, mode: ActivationMode) {
  const standard = buildPracticePrompt(phrase, mode === 'own_sentence' ? 'written_productive' : mode === 'cloze' || mode === 'error_repair' ? 'cloze' : 'meaning_recall')
  if (mode === 'recognition') return { instruction: 'Шаг 1 из 8 · узнавание значения', cue: phrase.canonical, context: 'Выберите точное значение выражения.' }
  if (mode === 'context_choice') return { instruction: 'Шаг 2 из 8 · правильный контекст', cue: phrase.canonical, context: 'Выберите предложение, в котором выражение показано в нужном значении.' }
  if (mode === 'cloze') return { ...standard, instruction: 'Шаг 3 из 8 · пропуск с вводом' }
  if (mode === 'russian_recall') return { ...standard, instruction: 'Шаг 4 из 8 · по русской подсказке', cue: phrase.meaning.split(' · ')[0] || phrase.meaning }
  if (mode === 'own_sentence') return { ...standard, instruction: 'Шаг 5 из 8 · собственное предложение' }
  return buildActivationErrorPrompt(phrase)
}

export function PracticePage() {
  const [params] = useSearchParams()
  const phrases = useForgeStore((state) => state.phrases)
  const skillStates = useForgeStore((state) => state.skillStates)
  const reviews = useForgeStore((state) => state.reviews)
  const recordPracticeExposure = useForgeStore((state) => state.recordPracticeExposure)
  const recordReview = useForgeStore((state) => state.recordReview)
  const advancePhraseActivation = useForgeStore((state) => state.advancePhraseActivation)
  const recordUnqualifiedActivationAttempt = useForgeStore((state) => state.recordUnqualifiedActivationAttempt)
  const preferences = useForgeStore((state) => state.preferences)
  const dailyVocabularyAssignment = useForgeStore((state) => state.dailyVocabularyAssignment)
  const resumeSuspendedSkills = useForgeStore((state) => state.resumeSuspendedSkills)
  const { items: catalogItems } = useLexicalCatalogLevel(preferences.currentLevel)
  const targetId = params.get('phrase')
  const handoffSupportUsed = params.get('support') === '1'
  const targetedPhrase = phrases.find((phrase) => phrase.id === targetId && phrase.status !== 'archived' && phrase.status !== 'needs_enrichment')
  const [minutes, setMinutes] = useState(preferences.dailyMinutes)
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>(['meaning_recall', 'cloze', 'written_productive'])
  const [started, setStarted] = useState(Boolean(targetedPhrase))
  const [index, setIndex] = useState(0)
  const [response, setResponse] = useState('')
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [revealUsed, setRevealUsed] = useState(false)
  const [flagged, setFlagged] = useState(false)
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [productionSelfChecked, setProductionSelfChecked] = useState(false)
  const [summary, setSummary] = useState<{ grade: Grade; phrase: string }[]>([])
  const [retryNotice, setRetryNotice] = useState('')
  const [activationTrainingOnly, setActivationTrainingOnly] = useState(false)
  const [sessionSupportUsed, setSessionSupportUsed] = useState(handoffSupportUsed)
  // Уходящий лист: снимок предыдущего рендера карточки. Индекс меняется
  // синхронно, поэтому фаза out играет на копии, а не задерживает состояние.
  const [outgoingLeaf, setOutgoingLeaf] = useState<ReactNode>(null)
  const leafSnapshot = useRef<ReactNode>(null)
  const incomingLeaf = useRef<HTMLDivElement>(null)
  const gradedKeys = useRef(new Set<string>())
  const timers = useRef<number[]>([])
  // Уход с маршрута в первые 140/400 мс не должен ронять setState на
  // размонтированном дереве: реестр таймеров вместо подписок на события.
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); timers.current = [] }, [])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const [sessionQueue, setSessionQueue] = useState<QueueItem[]>(() => targetedPhrase
    ? targetedQueue(targetedPhrase)
    : [])

  useEffect(() => {
    setStarted(Boolean(targetedPhrase))
    setIndex(0)
    setSummary([])
    setRetryNotice('')
    setActivationTrainingOnly(false)
    setSessionQueue(targetedPhrase ? targetedQueue(targetedPhrase) : [])
    setSessionSupportUsed(handoffSupportUsed)
    gradedKeys.current.clear()
    resetCard()
    // A new target is a new session; same-target query edits cannot remove support provenance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId])

  useEffect(() => {
    if (handoffSupportUsed) setSessionSupportUsed(true)
  }, [handoffSupportUsed])

  // Фокус на входящий лист — СРАЗУ при смене индекса, до конца фазы out.
  useEffect(() => {
    const node = incomingLeaf.current
    if (!node) return
    const field = node.querySelector<HTMLTextAreaElement>('#practice-response')
    if (field) field.focus()
    else node.focus()
  }, [index])

  const current = sessionQueue[index]
  const phrase = phrases.find((item) => item.id === current?.phraseId)
  const suspendedCount = skillStates.filter((skillState) => skillState.phase === 'suspended' && phrases.some((item) => item.id === skillState.phraseId && item.status !== 'archived')).length
  const catalogChoicePool = useMemo<Phrase[]>(() => (catalogItems ?? []).map((item) => ({
    id: `catalog-choice-${item.id}`, canonical: item.expression, normalizedKey: item.expression.toLocaleLowerCase('en-US'),
    meaning: item.translationRu, kind: item.kind, cefr: item.level, register: [item.register], context: item.example,
    source: 'Reviewed bundled catalog', tags: [item.topic], note: item.note ?? '', acceptedForms: [], examples: [],
    depth: { grammarFrame: item.pattern ?? '', collocates: [], constraints: [], contrasts: [], connotation: '', pronunciationNote: '' },
    status: 'new', createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:00.000Z',
  })), [catalogItems])
  const choiceMode = current?.mode === 'recognition' || current?.mode === 'context_choice' ? current.mode : undefined
  const choiceOptions = phrase && current ? buildActivationChoices([...phrases, ...catalogChoicePool], phrase, choiceMode) : []
  const choiceOptionsReady = !choiceMode || choiceOptions.length >= 3
  const activationError = phrase && current?.mode === 'error_repair' ? buildActivationErrorPrompt(phrase) : undefined
  const expectedAnswer = phrase && current?.mode === 'recognition'
    ? activationRecognitionLabel(phrase)
    : phrase && current?.mode === 'context_choice'
      ? redactAcceptedForms(phrase.context, phrase.canonical, phrase.acceptedForms)
      : activationError?.expectedCorrection ?? (phrase && current?.skill === 'cloze' ? clozeExpectedAnswer(phrase) : phrase?.canonical ?? '')

  function resetCard() {
    setResponse('')
    setChecked(false)
    setCorrect(false)
    setHintsUsed(0)
    setRevealUsed(false)
    setFlagged(false)
    setVerdict(null)
    setProductionSelfChecked(false)
  }

  /** Фазовая машина листа. Строго на setTimeout: 0ms-анимация никогда не
   *  выстрелит animationend, слушатель повис бы навсегда. */
  function turnLeaf() {
    if (motionScale() === 0) return
    setOutgoingLeaf(leafSnapshot.current)
    later(() => setOutgoingLeaf(null), DUR.cardOut * motionScale())
  }

  function markVerdict(value: Exclude<Verdict, null>) {
    setVerdict(value)
    later(() => setVerdict(null), 400 * motionScale())
  }

  function check() {
    if (!phrase || !current || !response.trim() || !choiceOptionsReady) return
    const success = current.mode === 'recognition' || current.mode === 'context_choice'
      ? response === expectedAnswer
      : current.mode === 'error_repair' && activationError
        ? activationErrorResponseMatches(activationError, phrase, response)
      : responseMatchesPractice(phrase, current.skill, response)
    // Persist before rendering feedback: closing or remounting at the feedback
    // boundary must not yield another independent task for this phrase.
    recordPracticeExposure(phrase.id, current.skill, current.key, 'feedback')
    setCorrect(success)
    setChecked(true)
    setRetryNotice('')
    markVerdict(success ? 'matched' : 'missed')
  }

  function reveal() {
    if (phrase && current) recordPracticeExposure(phrase.id, current.skill, current.key, 'reveal')
    setRevealUsed(true)
    setChecked(true)
    setCorrect(false)
  }

  function grade(value: Grade) {
    if (!phrase || !current || (!checked && !revealUsed)) return
    if (current.mode === 'own_sentence' && correct && !productionSelfChecked && value > 0) return
    if (gradedKeys.current.has(current.key)) return
    gradedKeys.current.add(current.key)
    const schedulesDelayedReview = !current.mode || ['cloze', 'russian_recall', 'own_sentence'].includes(current.mode)
    const awardedGrade = schedulesDelayedReview
      ? recordReview({ phraseId: phrase.id, skill: current.skill, response, answerMatched: correct, requestedGrade: value, hintsUsed, revealUsed, supportUsed: sessionSupportUsed, idempotencyKey: current.key })
      : (!correct ? 0 : revealUsed || hintsUsed > 0 || sessionSupportUsed ? Math.min(value, 1) : value) as Grade
    const validatedActivationStep = current.mode !== 'error_repair' || activationError?.kind === 'typical'
    const activationQualified = correct && !revealUsed && hintsUsed === 0 && !sessionSupportUsed && validatedActivationStep
      && (current.mode !== 'own_sentence' || productionSelfChecked)
    if (current.mode && activationQualified) advancePhraseActivation(phrase.id, activationStageForMode(current.mode), response, productionSelfChecked)
    setSummary((items) => [...items, { grade: awardedGrade, phrase: phrase.canonical }])
    if (current.mode && !activationQualified) {
      recordUnqualifiedActivationAttempt(phrase.id, activationStageForMode(current.mode), sessionSupportUsed || revealUsed || hintsUsed > 0 || !correct)
      setActivationTrainingOnly(true)
      setRetryNotice('Этап не засчитан как самостоятельный: попытка с подсказкой, открытым ответом или обратной связью сохранена как тренировка и вернётся в другой день.')
      turnLeaf()
      setIndex((value) => value + 1)
      resetCard()
      return
    }
    turnLeaf()
    setIndex((value) => value + 1)
    resetCard()
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) && !checked) return
      if (checked && ['1', '2', '3', '4'].includes(event.key)) grade((Number(event.key) - 1) as Grade)
      if (!checked && event.key.toLowerCase() === 'h') setHintsUsed((value) => Math.min(2, value + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  function sessionItems(): QueueItem[] {
    const customPreferences = { ...preferences, dailyMinutes: minutes }
    const now = new Date()
    const itemLimit = practiceTaskCapacityForMinutes(minutes)
    const scheduled = buildPracticeQueue(skillStates, phrases, customPreferences, now, selectedSkills, dailyVocabularyAssignment, reviews)
    const dueReviewsToday = reviews.filter((review) => review.targetType === 'phrase'
      && localDayKey(new Date(review.reviewedAt)) === localDayKey(now)
      && wasDueWhenReviewed(review)).length
    const activationQuota = activationDailyQuota(phrases, dailyVocabularyAssignment, minutes, now, preferences.currentLevel, scheduled.length)
    const activationRemaining = Math.max(0, activationQuota - activationWorkDoneToday(phrases, now, preferences.currentLevel))
    const reviewPlan = dailyReviewPlan(scheduled.length, dueReviewsToday, minutes, activationQuota)
    const plannedReviews = scheduled.slice(0, reviewPlan.remaining)
    const activationSlots = Math.max(0, itemLimit - plannedReviews.length)
    const activation = buildDailyActivationQueue(phrases, dailyVocabularyAssignment, now, Math.min(activationRemaining, activationSlots), activationNewAdmissionLimit(minutes, scheduled.length), preferences.currentLevel)
    const activationKeys = new Set(activation.map((item) => `${item.phraseId}:${item.skill}`))
    const remainingScheduled = plannedReviews.filter((item) => !activationKeys.has(`${item.phraseId}:${item.skill}`))
    return [...activation, ...remainingScheduled].slice(0, itemLimit).map((item) => ({ ...item, key: crypto.randomUUID() }))
  }

  function startSession() {
    setSessionQueue(sessionItems())
    setStarted(true)
  }

  if (!started) return <SessionBuilder minutes={minutes} setMinutes={setMinutes} selectedSkills={selectedSkills} setSelectedSkills={setSelectedSkills} due={sessionItems()} suspendedCount={suspendedCount} onResumeSuspended={resumeSuspendedSkills} onStart={startSession} invalidTarget={Boolean(targetId && !targetedPhrase)} />
  if (!sessionQueue.length) return targetedPhrase ? <ActivationContinuation phrase={targetedPhrase} /> : <EmptyPractice />
  if (!current || !phrase) return targetedPhrase
    ? <ActivationContinuation phrase={targetedPhrase} guided={(sessionSupportUsed || activationTrainingOnly) && summary.length > 0} />
    : <SessionSummary items={summary} />

  const prompt = current.mode ? activationPrompt(phrase, current.mode) : buildPracticePrompt(phrase, current.skill)
  const currentPosition = index + 1
  const stageNumber = current.mode ? activationStageForMode(current.mode) : undefined
  const englishCue = current.mode === 'recognition' || current.mode === 'context_choice'
  const englishContext = current.mode === 'context_choice' || current.mode === 'cloze' || current.mode === 'error_repair'

  // Один и тот же лист печатается в двух фазах. Уходящий снимок НЕ несёт
  // .card-in (иначе выезжал бы внутрь, пока родитель .card-out гаснет) и НЕ
  // держит ref — иначе размонтирование призрака обнулит указатель на живой лист.
  const renderLeaf = (phase: 'in' | 'out') => (
    <div key={index} ref={phase === 'in' ? incomingLeaf : null} tabIndex={-1} className={cn('outline-none', phase === 'in' && 'card-in')}>
    <Card
      level="leaf"
      className={cn(
        'overflow-hidden',
        verdict === 'matched' && 'border-verified',
        verdict === 'missed' && 'border-amber nudge',
      )}
    >
      <div className="rule-double bg-elevated/40 px-6 py-5 sm:px-8">
        <div className="flex items-start justify-between gap-3">
          <p className="section-kicker">{prompt.instruction}</p>
          <button
            type="button"
            className={cn('detent grid size-9 shrink-0 place-items-center rounded-[3px]', flagged ? 'text-amber shadow-[var(--press)]' : 'text-muted hover:text-primary')}
            aria-label={flagged ? 'Снять отметку' : 'Отметить сложное задание'}
            aria-pressed={flagged}
            onClick={() => setFlagged((value) => !value)}
          >
            <Flag className="size-4" />
          </button>
        </div>

        {/* Врезка .set-text (рубричная скоба) — только под английский набор.
            Русская инструкция набирается обычным заголовком. */}
        {englishCue
          ? <h2 lang="en" className="set-text reading-en reading-en-block mt-4 text-xl leading-snug text-primary sm:text-2xl">{prompt.cue}</h2>
          : <h2 className="mt-4 text-2xl font-light leading-snug tracking-tight text-primary sm:text-3xl">{current.mode === 'error_repair' ? 'Найдите и исправьте ошибку в предложении.' : prompt.cue}</h2>}

        {flagged && <p aria-live="polite" className="mt-2 text-xs font-semibold text-amber">Отмечено: вернитесь к заданию перед оценкой.</p>}

        {prompt.context && (englishContext
          ? <p lang="en" className="set-text reading-en reading-en-block mt-4 text-[15px] text-secondary">{prompt.context}</p>
          : <p className="mt-4 text-[15px] leading-7 text-secondary">{prompt.context}</p>)}
      </div>

      <CardBody className="space-y-5 p-6 sm:p-8">
        {choiceMode ? choiceOptionsReady ? (
          <fieldset disabled={checked}>
            <legend className="inspector-label mb-2">Выберите один вариант</legend>
            <div className="grid gap-2">
              {choiceOptions.map((choice) => {
                const picked = response === choice
                return (
                  <button
                    key={choice}
                    lang={current.mode === 'context_choice' ? 'en' : 'ru'}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => setResponse(choice)}
                    className={cn(
                      'detent min-h-12 rounded-[3px] border p-3 text-left text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                      current.mode === 'context_choice' && 'reading-en',
                      picked
                        ? 'border-border-strong border-l-2 border-l-rubric bg-recess text-primary shadow-[var(--press)]'
                        : 'border-border bg-elevated text-secondary shadow-[var(--bevel-up)] hover:border-border-strong',
                    )}
                  >
                    {choice}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : (
          <div role="status" className="rounded-[3px] border border-amber/25 bg-amber/10 p-4 text-sm leading-6 text-secondary">Подбираем три качественных варианта из проверенного каталога. Задание не засчитывается с единственной очевидной кнопкой.</div>
        ) : (
          <div>
            <label htmlFor="practice-response" className="inspector-label mb-2 block">Ваш ответ</label>
            <Textarea id="practice-response" lang="en" autoFocus value={response} disabled={checked} onChange={(event) => setResponse(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') check() }} placeholder={current.mode === 'error_repair' ? 'Перепишите всё предложение с исправлением…' : current.skill === 'written_productive' ? 'Напишите одно естественное предложение…' : 'Введите выражение полностью…'} className="reading-en min-h-32 text-base" />
          </div>
        )}

        {!checked && hintsUsed > 0 && <div className="rounded-[3px] border border-amber/30 bg-amber/10 p-4 text-sm text-secondary"><p className="label-caps text-amber">Подсказка {hintsUsed}</p><p className="mt-1.5">{current.mode === 'error_repair' && activationError ? activationError.cue : choiceOptions.length ? (hintsUsed === 1 ? 'Сначала исключите вариант с другим смыслом или ситуацией.' : `Нужное выражение: ${phrase.canonical}`) : hintsUsed === 1 ? `Выражение начинается с «${phrase.canonical.split(' ')[0]}…»` : phrase.context || `Значение: ${phrase.meaning}`}</p></div>}

        {!checked ? (
          <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setHintsUsed((value) => Math.min(2, value + 1))}><Lightbulb className="size-4" /> Подсказка</Button>
              <Button variant="ghost" onClick={reveal}>Показать ответ</Button>
            </div>
            <Button onClick={check} disabled={!response.trim() || !choiceOptionsReady}>Проверить <ArrowRight className="size-4" /></Button>
          </div>
        ) : (
          <Feedback answer={expectedAnswer} correct={correct} revealUsed={revealUsed} hintsUsed={hintsUsed} supportUsed={sessionSupportUsed} response={response} limitedCheck={current.mode === 'own_sentence'} selfChecked={productionSelfChecked} onSelfCheck={setProductionSelfChecked} onGrade={grade} />
        )}
      </CardBody>
    </Card>
    </div>
  )
  const leaf = renderLeaf('in')
  leafSnapshot.current = renderLeaf('out')

  const ladder = stageNumber !== undefined ? (
    <>
      <div aria-hidden="true" className="mb-4 xl:hidden">
        <p className="inspector-label mb-1.5">Цикл активизации</p>
        <Rule value={stageNumber - 1} max={8} showFraction={false} />
      </div>
      {/* top-28 clears the 80px sticky header (--spacing-bar) plus breathing room;
          at top-10 the ladder slid underneath it and its first rungs were cut off. */}
      <div aria-hidden="true" className="hidden xl:sticky xl:top-28 xl:flex xl:h-96 xl:flex-col xl:items-center xl:gap-3">
        <Rule value={stageNumber - 1} max={8} orientation="vertical" showFraction={false} className="flex-1" />
        <p className="inspector-label [writing-mode:vertical-rl] [transform:rotate(180deg)]">Цикл активизации</p>
      </div>
    </>
  ) : null

  return (
    <div className="mx-auto max-w-3xl xl:max-w-[62rem]">
      <div className="xl:grid xl:grid-cols-[2.5rem_minmax(0,1fr)] xl:gap-8">
        {/* Без self-start: колонка тянется на всю высоту строки грида, и у
            липкой шкалы появляется ход вдоль длинной карточки. */}
        <div className="xl:relative">{ladder}</div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <div className="flex items-center gap-3">
              <span className="numeral text-secondary">{index + 1} / {sessionQueue.length}</span>
              <Badge tone="teal">{current.mode ? labelActivationMode(current.mode) : labelSkill(current.skill)}</Badge>
              {targetedPhrase && <Badge tone="neutral">Один шаг активизации</Badge>}
            </div>
            <span>осталось ≈ <span className="numeral">{estimatePracticeMinutes(sessionQueue.length - index)}</span> мин</span>
          </div>

          <div role="progressbar" aria-label="Прогресс занятия" aria-valuemin={1} aria-valuemax={sessionQueue.length} aria-valuenow={currentPosition} className="mb-6">
            <Rule value={currentPosition} max={sessionQueue.length} showFraction={false} />
          </div>

          {sessionSupportUsed && <p role="status" className="mb-4 rounded-[3px] border border-amber/30 bg-amber/10 p-3 text-sm leading-6 text-secondary">Перед переходом целевая формулировка была видна. Это полезная тренировка, но она не продвинет самостоятельную активизацию и не станет доказательством извлечения из памяти.</p>}
          {retryNotice && <p role="status" className="mb-4 rounded-[3px] border border-amber/30 bg-amber/10 p-3 text-sm leading-6 text-amber">{retryNotice}</p>}

          <div className="card-stage relative">
            {outgoingLeaf && <div aria-hidden="true" inert className="card-out pointer-events-none absolute inset-x-0 top-0">{outgoingLeaf}</div>}
            {leaf}
          </div>

          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted"><Keyboard className="size-4" /><span><kbd>⌘ Enter</kbd> проверить · <kbd>H</kbd> подсказка · <kbd>1–4</kbd> оценка</span></p>
        </div>
      </div>
    </div>
  )
}

function targetedQueue(phrase: Phrase, now = new Date()): QueueItem[] {
  return buildTargetedActivationQueue(phrase, now)
    .map(({ phraseId, skill, mode }) => ({ phraseId, skill, mode, key: crypto.randomUUID() }))
}

function activationStageForMode(mode: ActivationMode): 1 | 2 | 3 | 4 | 5 | 6 {
  return ({ recognition: 1, context_choice: 2, cloze: 3, russian_recall: 4, own_sentence: 5, error_repair: 6 } as const)[mode]
}

/** Сегмент клавиш с детентом: выбранная утоплена и несёт рубричную скобу. */
const keyBase = 'detent min-h-12 rounded-[3px] border px-3 text-sm font-semibold'
const keyOn = 'border-border-strong border-l-2 border-l-rubric bg-recess text-primary shadow-[var(--press)]'
const keyOff = 'border-border bg-elevated text-secondary shadow-[var(--bevel-up)] hover:border-border-strong'

function SessionBuilder({ minutes, setMinutes, selectedSkills, setSelectedSkills, due, suspendedCount, onResumeSuspended, onStart, invalidTarget }: {
  minutes: number
  setMinutes: (value: number) => void
  selectedSkills: Skill[]
  setSelectedSkills: (value: Skill[]) => void
  due: { phraseId: string; skill: Skill }[]
  suspendedCount: number
  onResumeSuspended: () => number
  onStart: () => void
  invalidTarget: boolean
}) {
  const choices: { skill: Skill; title: string; detail: string }[] = [
    { skill: 'meaning_recall', title: 'Вспомнить выражение', detail: 'Значение → полная фраза' },
    { skill: 'cloze', title: 'Вставить в контекст', detail: 'Восстановить фразу в предложении' },
    { skill: 'written_productive', title: 'Составить пример', detail: 'Создать новый естественный контекст' },
  ]
  const included = due.length
  return (
    <div className="mx-auto max-w-3xl py-4">
      <Card level="leaf" className="overflow-hidden">
        <div className="rule-double bg-elevated/40 p-6 sm:p-8">
          <p className="section-kicker">Настройка занятия</p>
          <h2 className="mt-2 text-2xl font-light tracking-tight text-primary sm:text-3xl">Сколько повторить сегодня?</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-secondary">Занятие берёт столько следующих шагов активации, сколько помещается в выбранное время, — не больше одного шага на выражение в день, — затем добавляет повторения по расписанию. Произношение и аудирование находятся в «Голосе».</p>
          {invalidTarget && <p role="alert" className="mt-4 rounded-[3px] border border-amber/30 bg-amber/10 p-3 text-sm text-amber">Это выражение недоступно или ещё не заполнено. Вместо него готово обычное занятие.</p>}
          {suspendedCount > 0 && <div className="mt-4 flex flex-col gap-3 rounded-[3px] border border-amber/30 bg-amber/10 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm leading-6 text-secondary"><strong className="text-amber">Нужна поддержка: {suspendedCount}.</strong> Эти сложные навыки были остановлены после повторных ошибок и не исчезнут молча.</p><Button type="button" variant="secondary" onClick={() => onResumeSuspended()}>Вернуть в мягкое переобучение</Button></div>}
        </div>
        <CardBody className="space-y-6 p-6 sm:p-8">
          <fieldset>
            <legend className="inspector-label">Время</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[5, 10, 20, 30].map((value) => (
                <button key={value} type="button" aria-pressed={minutes === value} onClick={() => setMinutes(value)} className={cn(keyBase, minutes === value ? keyOn : keyOff)}>
                  <span className="numeral">{value}</span> мин
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="inspector-label">Типы заданий</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {choices.map((choice) => {
                const checked = selectedSkills.includes(choice.skill)
                return (
                  <label key={choice.skill} className={cn('detent block cursor-pointer rounded-[3px] border p-4', checked ? keyOn : keyOff)}>
                    <input type="checkbox" className="mr-2 accent-[var(--verified)]" checked={checked} onChange={() => setSelectedSkills(checked ? selectedSkills.filter((skill) => skill !== choice.skill) : [...selectedSkills, choice.skill])} />
                    <span className="text-sm font-semibold text-primary">{choice.title}</span>
                    <span className="mt-2 block text-xs font-normal leading-5 text-muted">{choice.detail}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="flex flex-col justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center">
            <div>
              {/* Число обязано остаться ПРЯМЫМ текстовым узлом этого <p>:
                  getByText('Заданий: 3') склеивает только прямых потомков,
                  вложенный <span className="numeral"> ломает контракт теста. */}
              <p key={included} className="typeset numeral text-lg font-bold text-primary">Заданий: {included}</p>
              <p className="mt-0.5 text-xs text-muted">≈ <span className="numeral">{estimatePracticeMinutes(included)}</span> мин активного повторения</p>
            </div>
            <Button size="lg" disabled={!included || !selectedSkills.length} onClick={onStart}>Начать занятие <ArrowRight className="size-4" /></Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function labelSkill(skill: Skill) { return ({ meaning_recall: 'Вспоминание', cloze: 'Пропуск', written_productive: 'Свой пример', spoken_productive: 'Устная речь', grammar_repair: 'Грамматика' } as const)[skill] }
function labelActivationMode(mode: ActivationMode) { return ({ recognition: 'Узнавание', context_choice: 'Контекст', cloze: 'Пропуск', russian_recall: 'RU → EN', own_sentence: 'Свой пример', error_repair: 'Коррекция' } as const)[mode] }

function Feedback({ answer, correct, revealUsed, hintsUsed, supportUsed, response, limitedCheck, selfChecked, onSelfCheck, onGrade }: { answer: string; correct: boolean; revealUsed: boolean; hintsUsed: number; supportUsed: boolean; response: string; limitedCheck: boolean; selfChecked: boolean; onSelfCheck: (checked: boolean) => void; onGrade: (grade: Grade) => void }) {
  const maxGrade: Grade = revealUsed || !correct ? 0 : hintsUsed > 0 || supportUsed ? 1 : 3
  const labels = ['Снова', 'Трудно', 'Хорошо', 'Легко'] as const
  // Маргиналия объясняет ПРИЧИНУ среза. Обычный неверный ответ ничем не
  // ограничен — он просто неверен, и приписывать ему «открытый ответ» ложь.
  const limitNote = revealUsed
    ? 'ОГРАНИЧЕНО ОТКРЫТЫМ ОТВЕТОМ'
    : hintsUsed > 0 || supportUsed
      ? 'ОГРАНИЧЕНО ПОДСКАЗКОЙ'
      : null
  return (
    <div className="space-y-5">
      <div role="status" className={cn('rounded-[3px] border p-4', correct ? 'border-verified/40 bg-verified-soft' : 'border-amber/30 bg-amber/10')}>
        <div className="flex items-start gap-3">
          {correct ? <Check className="mt-0.5 size-5 shrink-0 text-verified" /> : <CircleHelp className="mt-0.5 size-5 shrink-0 text-amber" />}
          <div className="min-w-0">
            <p className={cn('label-caps', correct ? 'text-verified' : 'text-amber')}>{correct ? limitedCheck ? 'Целевое выражение найдено; качество не оценено' : 'Ответ совпал' : revealUsed ? 'Ответ показан — скоро попробуйте вспомнить снова' : 'Ответ пока не совпал'}</p>
            <div className="mt-2 text-sm leading-6 text-secondary">
              {limitedCheck
                ? <p>Приложение проверило только наличие выражения и минимальную длину. Грамматику, смысл и естественность предложения оно не умеет оценить.</p>
                : <p>Правильный вариант: <strong lang="en" className="reading-en text-primary">{answer}</strong><span aria-hidden="true" className="typeset mt-1 block h-px w-full max-w-64 bg-verified" /></p>}
            </div>
            {response && !correct && <p className="mt-1 text-sm text-muted">Ваш ответ: {response}</p>}
            {maxGrade < 3 && <p className="mt-2 text-xs text-muted">{maxGrade === 0 ? (revealUsed ? 'Ответ был показан — засчитывается как «Снова», скоро повторим.' : 'Неузнанный ответ записывается как «Снова».') : 'Вы использовали помощь, поэтому максимум — «Трудно».'}</p>}
          </div>
        </div>
      </div>

      {limitedCheck && correct && <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[3px] border border-border bg-elevated p-3 text-left text-xs leading-5 text-secondary"><input type="checkbox" className="mt-1 size-4 accent-[var(--verified)]" checked={selfChecked} onChange={(event) => onSelfCheck(event.target.checked)} /><span>Я перечитал(а) предложение и сам(а) проверил(а), что смысл понятен, форма выглядит грамматичной, а выражение подходит контексту.</span></label>}

      <div>
        <p className="inspector-label mb-3 text-center">Насколько трудно было вспомнить?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([0, 1, 2, 3] as Grade[]).map((grade) => (
            <Button key={grade} disabled={grade > maxGrade || (limitedCheck && correct && !selfChecked && grade > 0)} variant={grade === 2 && grade <= maxGrade ? 'primary' : 'secondary'} onClick={() => onGrade(grade)}>
              <span className="numeral text-xs opacity-65">{grade + 1}</span>{labels[grade]}
            </Button>
          ))}
        </div>
        {limitNote && <MarginNote className="text-center">{limitNote}</MarginNote>}
      </div>
    </div>
  )
}

function EmptyPractice() {
  return <div className="mx-auto max-w-xl py-12"><Card level="leaf"><CardBody className="empty-state py-14"><p className="section-kicker">Занятие</p><div><h2 className="text-xl font-light text-primary">На сегодня всё повторено.</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted">Сейчас нет заданий по расписанию. Добавьте полезное выражение из базы или изучите одну тему грамматики.</p></div><div className="flex flex-wrap justify-center gap-2"><Link to="/library" className={buttonClass({ variant: 'secondary' })}>Открыть базу слов</Link><Link to="/grammar" className={buttonClass()}>Учить грамматику</Link></div></CardBody></Card></div>
}

function ActivationContinuation({ phrase, guided = false }: { phrase: Phrase; guided?: boolean }) {
  const stage = phrase.activationStage ?? 0
  const lacksReviewedError = stage === 5 && buildActivationErrorPrompt(phrase).kind !== 'typical'
  const title = guided ? 'Тренировочная попытка завершена.' : stage >= 8 ? 'Цикл активизации завершён.' : stage >= 7 ? 'Теперь нужен отложенный повтор.' : stage === 6 ? 'Шаги 1–6 сохранены.' : lacksReviewedError ? 'Пять шагов сохранены; шестой пока недоступен.' : stage === 0 ? 'Первый шаг пока не назначен.' : `Шаг ${stage} сохранён.`
  const detail = guided
    ? 'Во время этой попытки была доступна опора, подсказка или корректирующая обратная связь, поэтому этап не засчитан. Самостоятельная попытка вернётся в другой день.'
    : stage >= 8
    ? 'Вы прошли узнавание, активное воспроизведение, устную попытку и отложенное извлечение.'
    : stage >= 7
      ? 'Устная попытка сохранена. Следующий шаг откроется по расписанию не раньше чем через 12 часов.'
      : lacksReviewedError
        ? 'В карточке нет проверенного паттерна типичной ошибки. Приложение не подменяет его случайной опечаткой и не считает выражение полностью активированным.'
        : stage === 6
          ? 'Устную попытку лучше выполнить позже, не подсматривая форму. Немедленный переход доступен только как тренировка с опорой и не повысит статус выражения.'
          : stage === 0
            ? 'Узнавание и следующие четыре безопасных шага доступны без паттерна ошибки. Если попытка уже была сегодня, следующий самостоятельный шаг вернётся в другой локальный день.'
            : 'Следующий этап появится в обычном занятии в другой локальный день: приложение не прокручивает несколько шагов одного выражения подряд.'
  return (
    <div className="mx-auto max-w-xl py-12">
      <Card level="leaf">
        <CardBody className="empty-state py-14">
          <CheckCircle2 className="size-7 text-verified" />
          <div>
            <h2 className="text-xl font-light text-primary">{title}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">{detail}</p>
          </div>
          <div aria-hidden="true" className="w-full max-w-56"><Rule value={Math.min(stage, 8)} max={8} showFraction={false} /></div>
          <div className="flex flex-wrap justify-center gap-2">
            {!guided && stage === 6 && <Link to={`/voice?phrase=${encodeURIComponent(phrase.id)}&support=1`} className={buttonClass()}>Репетиция устного ответа</Link>}
            {stage === 7 && <Link to="/practice" className={buttonClass({ variant: 'secondary' })}>Открыть повторения по расписанию</Link>}
            <Link to="/" className={buttonClass({ variant: 'ghost' })}>На главную</Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function SessionSummary({ items }: { items: { grade: Grade; phrase: string }[] }) {
  const strong = items.filter((item) => item.grade >= 2).length
  return (
    <div className="mx-auto max-w-xl py-8">
      <Card level="leaf">
        <CardBody className="p-8 text-center">
          <p className="section-kicker">Занятие завершено</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-primary">Без серьёзной помощи: <span className="numeral">{strong}</span></h2>
          <p className="mt-3 text-sm leading-6 text-secondary">Повторено заданий: {items.length}. Выражение считается закреплённым только после успешного отложенного повторения и применения в задании.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Card level="recess" className="p-4"><p className="metric-value">{strong}</p><p className="metric-label">Хорошо / легко</p></Card>
            <Card level="recess" className="p-4"><p className="metric-value">{items.length - strong}</p><p className="metric-label">Нужно повторить</p></Card>
          </div>
          <Link to="/" className={buttonClass({ variant: 'secondary', className: 'mt-6' })}>На главную</Link>
        </CardBody>
      </Card>
    </div>
  )
}
