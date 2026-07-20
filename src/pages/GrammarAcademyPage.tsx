import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Diff } from '../components/ui/Diff'
import { Input, Select, Textarea } from '../components/ui/Field'
import { MarginNote } from '../components/ui/MarginNote'
import { Rule } from '../components/ui/Rule'
import { Stamp } from '../components/ui/Stamp'
import { grammarAcademyLessons, grammarQuizForAttempt } from '../data/grammarAcademy'
import { buildGrammarCheckpoint, nextGrammarCheckpointAt, type GrammarCheckpointItem } from '../data/grammarCheckpoint'
import { grammarAcademySources } from '../data/grammarAcademySources'
import { russianGrammarExplanation } from '../data/grammarAcademyRussian'
import { grammarLessonExperience, grammarLevels, grammarLexicalCandidates, type GrammarCategory, type GrammarLevel } from '../domain/grammarAcademy'
import { grammarCorrectionKey } from '../domain/grammarEvidence'
import { includesPhrase, normalizePhrase } from '../domain/normalization'
import { cn } from '../lib/utils'
import { useForgeStore } from '../store/useForgeStore'

const CATEGORY_LABELS: Record<GrammarCategory | 'all', string> = {
  all: 'Все темы', tenses: 'Времена', questions: 'Вопросы и инструкции', 'nouns-and-articles': 'Существительные и артикли',
  'adjectives-and-adverbs': 'Прилагательные и наречия', modals: 'Модальные глаголы', 'clauses-and-linking': 'Связь частей предложения',
  'verb-patterns': 'Модели глаголов', 'advanced-structures': 'Другие конструкции',
}

const GRAMMAR_LESSON_IDS = grammarAcademyLessons.map((lesson) => lesson.id)

/**
 * Римские колонцифры вместо арабских там, где номер — это порядок в наборе,
 * а не количество. Это ещё и единственный безопасный способ пронумеровать
 * что-либо на этом экране: `getAllByText(/^[123]$/)` в
 * GrammarAcademyPage.route.test.tsx ждёт РОВНО три узла с одиночной цифрой —
 * это номера вопросов контрольной обоймы, и больше ничего.
 */
const FOLIO = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/**
 * Отсрочка печатается как отсчёт, а не как `toLocaleString('ru-RU')`.
 * Дата-время в сыром виде заставляет считать в уме; «через 4 ч 20 мин» — нет.
 * Значение вычисляется на рендере: никакого таймера, ни одной бесконечной
 * анимации и ни одного интервала на этом экране.
 */
function untilLabel(target: number, now: number): string {
  const minutes = Math.ceil((target - now) / 60000)
  if (minutes <= 0) return 'сейчас'
  if (minutes < 60) return `через ${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `через ${hours} ч ${rest} мин` : `через ${hours} ч`
}

function lessonReferenceTexts(lesson: (typeof grammarAcademyLessons)[number]): string[] {
  return [...lesson.examples, lesson.commonMistake.wrong, lesson.commonMistake.correct]
}

export function GrammarAcademyPage() {
  const [searchParams] = useSearchParams()
  const requestedLessonId = searchParams.get('lesson')

  // Route-owned lesson work remounts as one unit, so no stale lesson state is committed during a handoff.
  return <GrammarAcademyContent key={requestedLessonId ?? 'browse'} requestedLessonId={requestedLessonId} />
}

function GrammarAcademyContent({ requestedLessonId }: { requestedLessonId: string | null }) {
  const store = useForgeStore(useShallow((state) => ({
    grammarProgress: state.grammarProgress,
    phrases: state.phrases,
    preferences: state.preferences,
    recordGrammarCorrection: state.recordGrammarCorrection,
    recordGrammarProgress: state.recordGrammarProgress,
    recordGrammarTransferCheck: state.recordGrammarTransferCheck,
    saveGrammarProduction: state.saveGrammarProduction,
    saveGrammarTransfer: state.saveGrammarTransfer,
  })))
  const requestedLesson = grammarAcademyLessons.find((lesson) => lesson.id === requestedLessonId)
  const initialLesson = requestedLesson ?? grammarAcademyLessons.find((lesson) => lesson.level === store.preferences.currentLevel)
  const initialProgress = initialLesson ? store.grammarProgress.find((item) => item.lessonId === initialLesson.id) : undefined
  const initialTargetCandidates = initialLesson ? grammarLexicalCandidates(store.phrases, initialLesson.id, initialLesson.level) : []
  const initialTargetIndex = initialProgress
    ? (initialProgress.productionTargetPhraseId
        ? (() => { const index = initialTargetCandidates.findIndex((phrase) => phrase.id === initialProgress.productionTargetPhraseId); return index >= 0 ? index : initialTargetCandidates.length })()
        : initialTargetCandidates.length)
    : 0
  const [level, setLevel] = useState<GrammarLevel>(requestedLesson?.level ?? store.preferences.currentLevel)
  const [category, setCategory] = useState<GrammarCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(requestedLesson?.id ?? '')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [productionDraft, setProductionDraft] = useState(initialProgress?.productionDraft ?? '')
  const [productionConfirmed, setProductionConfirmed] = useState(Boolean(initialProgress?.productionSelfConfirmedAt))
  const [productionMessage, setProductionMessage] = useState('')
  const [transferDraft, setTransferDraft] = useState(initialProgress?.transferDraft ?? '')
  const [transferConfirmed, setTransferConfirmed] = useState(Boolean(initialProgress?.transferSelfConfirmedAt))
  const [transferMessage, setTransferMessage] = useState('')
  const [correctionDraft, setCorrectionDraft] = useState('')
  const [correctionChecked, setCorrectionChecked] = useState(false)
  const [quizAttemptSeed, setQuizAttemptSeed] = useState(initialProgress?.attempts ?? 0)
  const [lexicalTargetIndex, setLexicalTargetIndex] = useState(initialTargetIndex)
  const lessons = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('en-US')
    return grammarAcademyLessons.filter((lesson) => lesson.level === level && (category === 'all' || lesson.category === category) && (!query || `${lesson.title} ${lesson.explanation} ${lesson.formula}`.toLocaleLowerCase('en-US').includes(query)))
  }, [category, level, search])
  const active = lessons.find((lesson) => lesson.id === selectedId) ?? lessons[0]
  const progress = new Map(store.grammarProgress.map((item) => [item.lessonId, item]))
  const levelLessons = grammarAcademyLessons.filter((lesson) => lesson.level === level)
  const completed = levelLessons.filter((lesson) => progress.get(lesson.id)?.completedAt).length
  const showRussian = store.preferences.explanationLanguage === 'Russian'
  const activeProgress = active ? progress.get(active.id) : undefined
  const attemptQuiz = active ? grammarQuizForAttempt(active, quizAttemptSeed) : []
  const lexicalCandidates = active ? grammarLexicalCandidates(store.phrases, active.id, active.level) : []
  const lexicalTarget = lexicalTargetIndex < lexicalCandidates.length ? lexicalCandidates[lexicalTargetIndex] : undefined
  const productionHasTarget = !lexicalTarget || includesPhrase(productionDraft, lexicalTarget.canonical, lexicalTarget.acceptedForms)
  const transferHasTarget = !lexicalTarget || includesPhrase(transferDraft, lexicalTarget.canonical, lexicalTarget.acceptedForms)
  const transferReadyAt = activeProgress?.productionSavedAt ? new Date(activeProgress.productionSavedAt).getTime() + 12 * 60 * 60 * 1000 : undefined
  const transferIsDue = transferReadyAt !== undefined && Date.now() >= transferReadyAt
  const blindTransferActive = Boolean(transferIsDue && activeProgress?.productionSavedAt && !activeProgress.transferSavedAt)
  const correctionPassed = active ? grammarCorrectionKey(correctionDraft) === grammarCorrectionKey(active.commonMistake.correct) : false

  // Четыре части критерия освоения — одна шкала, а не четыре разноцветные пилюли.
  const mastery = [
    { label: 'Две проверки с перерывом', done: (activeProgress?.passes ?? 0) >= 2, state: `${Math.min(2, activeProgress?.passes ?? 0)} из 2` },
    { label: 'Исправленная типичная ошибка', done: Boolean(activeProgress?.correctionPassedAt), state: activeProgress?.correctionPassedAt ? 'готово' : 'нужна' },
    { label: 'Собственный пример', done: Boolean(activeProgress?.productionSelfConfirmedAt), state: activeProgress?.productionSelfConfirmedAt ? 'подтверждён' : 'нужен' },
    { label: 'Отложенный перенос', done: Boolean(activeProgress?.transferSelfConfirmedAt), state: activeProgress?.transferSelfConfirmedAt ? 'готов' : 'нужен' },
  ]
  const masteryDone = mastery.filter((item) => item.done).length

  function hydrateLessonWork(lesson: (typeof grammarAcademyLessons)[number] | undefined) {
    setAnswers({})
    setSubmitted(false)
    const saved = lesson ? store.grammarProgress.find((item) => item.lessonId === lesson.id) : undefined
    setProductionDraft(saved?.productionDraft ?? '')
    setProductionConfirmed(Boolean(saved?.productionSelfConfirmedAt))
    setProductionMessage('')
    setTransferDraft(saved?.transferDraft ?? '')
    setTransferConfirmed(Boolean(saved?.transferSelfConfirmedAt))
    setTransferMessage('')
    setCorrectionDraft('')
    setCorrectionChecked(false)
    setQuizAttemptSeed(saved?.attempts ?? 0)
    const targetCandidates = lesson ? grammarLexicalCandidates(store.phrases, lesson.id, lesson.level) : []
    const savedTargetIndex = saved
      ? (saved.productionTargetPhraseId ? targetCandidates.findIndex((phrase) => phrase.id === saved.productionTargetPhraseId) : targetCandidates.length)
      : 0
    setLexicalTargetIndex(savedTargetIndex >= 0 ? savedTargetIndex : targetCandidates.length)
  }

  /* oxlint-disable react-hooks/exhaustive-deps */
  // Drafts hydrate only when the lesson identity changes; same-lesson store writes must not erase in-progress answers.
  useEffect(() => {
    hydrateLessonWork(active)
  }, [active?.id])
  /* oxlint-enable react-hooks/exhaustive-deps */

  async function checkQuiz() {
    if (!active || attemptQuiz.some((question) => answers[question.id] === undefined)) return
    const saved = await store.recordGrammarProgress(active.id, quizAttemptSeed, attemptQuiz.map((question) => ({ questionId: question.id, selectedIndex: answers[question.id] })))
    if (saved) setSubmitted(true)
  }

  async function checkCorrection() {
    if (!active) return
    const passed = grammarCorrectionKey(correctionDraft) === grammarCorrectionKey(active.commonMistake.correct)
    setCorrectionChecked(true)
    if (passed) await store.recordGrammarCorrection(active.id, correctionDraft)
  }

  function saveProduction() {
    if (!active) return
    setProductionMessage(store.saveGrammarProduction(active.id, productionDraft, active.quiz.length, productionConfirmed, lexicalTarget?.id, lessonReferenceTexts(active))
      ? 'Пример сохранён. Перенос откроется через 12 часов.'
      : 'Нужно новое предложение минимум из шести слов с указанным выражением — и галочка самопроверки.')
  }

  async function saveTransfer() {
    if (!active) return
    const selections = attemptQuiz.map((question) => ({ questionId: question.id, selectedIndex: answers[question.id] }))
    const constructVerified = await store.recordGrammarTransferCheck(active.id, quizAttemptSeed, selections)
    if (!constructVerified) {
      setTransferMessage('Пока не все три ответа верны. Варианты перемешаны — попробуйте ещё раз по памяти.')
      setAnswers({})
      setQuizAttemptSeed((seed) => seed + 1)
      return
    }
    setTransferMessage(store.saveGrammarTransfer(active.id, transferDraft, active.quiz.length, transferConfirmed, lexicalTarget?.id, lessonReferenceTexts(active))
      ? 'Перенос и ответы сохранены. Урок снова открыт.'
      : 'Напишите другое предложение минимум из шести слов с показанным выражением и поставьте галочку самопроверки.')
  }

  const answerButtonClass = 'detent reading-en min-h-11 w-full rounded-[3px] border px-4 py-2.5 text-left text-sm shadow-[var(--lift-1)]'

  return (
    <div className="space-y-7">
      {/* ── КОЛОНТИТУЛ ───────────────────────────────────────────────── */}
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="section-kicker">Грамматика · свод правил</p>
          <p className="label-caps text-muted">Уровень {level}</p>
        </div>
        <h2 className="mt-3 text-h1 font-light tracking-[-0.02em] text-primary">Понятный порядок от A2 до C1.</h2>
        <div className="rule-double mt-4 pb-4" />
        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
          <p className="text-body leading-relaxed text-secondary">
            {grammarAcademyLessons.length} тем: простое объяснение, формула, три примера, типичная ошибка и короткая проверка. Для A2–B1 доступны русские пояснения.
          </p>
          <Card level="recess" className="px-4 py-3.5">
            <p className="inspector-label">Проверено дважды · {level}</p>
            <Rule
              className="mt-2.5"
              value={completed}
              max={levelLessons.length}
              progressbar
              ariaLabel={`Проверено дважды на уровне ${level}`}
            />
          </Card>
        </div>
      </header>

      {!blindTransferActive && <><CumulativeCheckpoint key={level} level={level} />

      {/* ── ФИЛЬТР НАБОРА ────────────────────────────────────────────── */}
      <Card><CardBody className="space-y-4">
        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[3px] bg-border">
          {grammarLevels.map((itemLevel) => (
            <button
              key={itemLevel}
              type="button"
              aria-pressed={level === itemLevel}
              onClick={() => { setLevel(itemLevel); setSelectedId(''); setCategory('all'); setSearch('') }}
              className={cn(
                'detent min-h-11 px-2 text-sm font-bold',
                level === itemLevel
                  ? 'border-l-2 border-rubric bg-recess text-primary shadow-[var(--press)]'
                  : 'bg-elevated text-secondary shadow-[var(--lift-1)] hover:text-primary',
              )}
            >
              {itemLevel}
              <span className="numeral ml-2 hidden text-xs font-normal text-muted sm:inline">
                {grammarAcademyLessons.filter((lesson) => lesson.level === itemLevel).length}
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <label className="relative">
            <span className="sr-only">Поиск тем грамматики</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" placeholder="Найти тему…" />
          </label>
          <Select
            aria-label="Категория грамматики"
            value={category}
            onChange={(event) => setCategory(event.target.value as GrammarCategory | 'all')}
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
      </CardBody></Card></>}

      <section className={blindTransferActive ? 'grid items-start gap-6' : 'grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]'}>
        {/* ── ОГЛАВЛЕНИЕ УРОКОВ ──────────────────────────────────────── */}
        {!blindTransferActive && <nav aria-label="Grammar lessons" className="max-h-[720px] overflow-y-auto rounded-[3px] border border-border bg-surface p-2 shadow-[var(--lift-1)]">
          {lessons.map((lesson, lessonIndex) => {
            const lessonProgress = progress.get(lesson.id)
            const current = active?.id === lesson.id
            return (
              <button
                key={lesson.id}
                type="button"
                aria-current={current ? 'true' : undefined}
                onClick={() => setSelectedId(lesson.id)}
                className={cn(
                  'detent flex w-full items-baseline gap-3 rounded-[2px] px-3 py-2.5 text-left',
                  current ? 'border-l-2 border-rubric bg-recess shadow-[var(--bevel-down)]' : 'border-l-2 border-transparent hover:bg-elevated',
                )}
              >
                <span className={cn('numeral shrink-0 text-xs', lessonProgress?.completedAt ? 'text-teal' : 'text-muted')}>
                  {lessonProgress?.completedAt ? <Check className="size-3.5" aria-hidden="true" /> : String(lessonIndex + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-5 text-primary">{lesson.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{CATEGORY_LABELS[lesson.category]}</span>
                </span>
              </button>
            )
          })}
          {!lessons.length && <div className="empty-state py-10"><Search className="size-5" /><p>По этим фильтрам тем нет.</p></div>}
        </nav>}

        {active && (blindTransferActive ? (
          /* ── ЗАКРЫТЫЙ ЛИСТ: отложенный перенос без подсказок ───────── */
          <article className="rounded-[3px] border border-border-strong bg-surface p-5 shadow-[var(--lift-2)] sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ember">Отложенный перенос</Badge>
              <Badge tone="neutral">{active.level}</Badge>
            </div>
            <h2 className="mt-4 text-h1 font-light tracking-[-0.02em] text-primary">Вспомните конструкцию без подсказок.</h2>
            <p className="mt-3 max-w-[62ch] text-body leading-relaxed text-secondary">
              Формула, примеры и первый ответ временно скрыты — вспомните правило сами.
            </p>

            <Card level="recess" className="mt-5 px-4 py-3.5">
              <p className="section-kicker">Коммуникативная цель</p>
              <p className="mt-2 text-body leading-relaxed text-primary">{grammarLessonExperience(grammarAcademyLessons, active).objective}</p>
              {lexicalTarget && (
                <p className="mt-3 text-body leading-relaxed text-secondary">
                  Используйте выражение <strong lang="en" className="reading-en text-primary">{lexicalTarget.canonical}</strong> — {lexicalTarget.meaning}.
                </p>
              )}
            </Card>

            <label htmlFor="grammar-transfer-blind" className="mt-6 block text-sm font-semibold text-primary">Новое предложение для переноса</label>
            <Textarea
              id="grammar-transfer-blind"
              lang="en"
              value={transferDraft}
              onChange={(event) => { setTransferDraft(event.target.value); setTransferConfirmed(false); setTransferMessage('') }}
              className="reading-en mt-2 min-h-40"
              placeholder="Write a different complete sentence from memory…"
            />
            <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-[3px] border border-border bg-elevated p-3 text-sm leading-5 text-secondary shadow-[var(--lift-1)]">
              <input type="checkbox" className="mt-0.5 size-5 accent-[var(--rubric)]" checked={transferConfirmed} onChange={(event) => setTransferConfirmed(event.target.checked)} />
              <span>Это новое предложение; я написал(а) его без формулы, примеров и первого ответа.</span>
            </label>

            <fieldset className="mt-8">
              {/* legend остаётся ПРЯМЫМ ребёнком fieldset — иначе группа теряет доступное имя. */}
              <legend className="rule-double label-caps w-full pb-2 text-primary">Контроль той же конструкции · 3/3</legend>
              <MarginNote className="xl:max-w-none">Три верных ответа подтверждают, что правило действительно вспомнилось.</MarginNote>
              <div className="mt-5 space-y-6">
                {attemptQuiz.map((question, questionIndex) => (
                  <div key={question.id}>
                    <p lang="en" className="reading-en text-sm font-semibold leading-6 text-primary">
                      <span className="numeral mr-2 text-xs text-rubric">{questionIndex + 1}</span>{question.prompt}
                    </p>
                    <div className="mt-2.5 grid gap-2">
                      {question.choices.map((choice, choiceIndex) => (
                        <button
                          key={choice}
                          type="button"
                          lang="en"
                          aria-pressed={answers[question.id] === choiceIndex}
                          onClick={() => setAnswers((current) => ({ ...current, [question.id]: choiceIndex }))}
                          className={cn(
                            answerButtonClass,
                            answers[question.id] === choiceIndex
                              ? 'border-transparent border-l-2 border-l-rubric bg-recess text-primary shadow-[var(--press)]'
                              : 'border-border bg-elevated text-secondary hover:text-primary',
                          )}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="rule-double mt-6 pb-4" />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p role="status" aria-live="polite" className="max-w-[52ch] text-xs leading-5 text-muted">
                {transferMessage || 'После сохранения урок откроется снова.'}
              </p>
              <Button
                type="button"
                onClick={saveTransfer}
                disabled={transferDraft.trim().split(/\s+/u).length < 6 || !transferConfirmed || !transferHasTarget || normalizePhrase(transferDraft) === normalizePhrase(productionDraft) || attemptQuiz.some((question) => answers[question.id] === undefined)}
              >
                Проверить и сохранить
              </Button>
            </div>
          </article>
        ) : (
          /* ── ЛИСТ УРОКА ───────────────────────────────────────────── */
          <article className="rounded-[3px] border border-border bg-surface p-5 shadow-[var(--lift-1)] sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="teal">{active.level}</Badge>
              <Badge tone="neutral">{CATEGORY_LABELS[active.category]}</Badge>
              {activeProgress?.completedAt && <Badge tone="positive"><Check className="size-3" aria-hidden="true" /> Проверено дважды</Badge>}
            </div>
            <h2 lang="en" className="reading-en mt-4 text-h1 font-normal tracking-[-0.01em] text-primary">{active.title}</h2>

            <Card level="recess" className="mt-5 px-4 py-3.5">
              <p className="section-kicker">После урока</p>
              <p className="mt-1.5 text-body leading-relaxed text-primary">{grammarLessonExperience(grammarAcademyLessons, active).objective}</p>
            </Card>

            {showRussian && russianGrammarExplanation(active.id) && (
              <div className="mt-5 border-l-2 border-rubric pl-4">
                <p className="section-kicker">Объяснение по-русски</p>
                <p className="mt-1.5 text-body leading-relaxed text-primary">{russianGrammarExplanation(active.id)}</p>
              </div>
            )}

            <p lang="en" className="reading-en reading-en-block mt-6 text-read text-secondary">{active.explanation}</p>

            <div className="mt-6">
              <p className="section-kicker">Формула</p>
              <p lang="en" className="set-text numeral mt-2 text-sm leading-6 text-primary">{active.formula}</p>
            </div>

            <section className="mt-8">
              <div className="rule-double pb-2"><h2 className="label-caps text-primary">Примеры</h2></div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {active.examples.map((example, index) => (
                  <div key={example}>
                    <span className="label-caps text-muted">{FOLIO[index]}</span>
                    <p lang="en" className="set-text reading-en mt-1.5 text-sm leading-6 text-primary">{example}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="rule-double pb-2"><h2 className="label-caps text-rubric">Исправьте типичную ошибку</h2></div>
              {!correctionChecked && (
                <p lang="en" className="reading-en mt-4 text-read text-muted [text-decoration-color:var(--rubric)] [text-decoration-line:line-through] [text-decoration-thickness:1px]">
                  {active.commonMistake.wrong}
                </p>
              )}
              <label htmlFor="grammar-correction" className="mt-4 block text-sm font-semibold text-primary">Напишите весь исправленный вариант</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input id="grammar-correction" lang="en" className="reading-en" value={correctionDraft} onChange={(event) => { setCorrectionDraft(event.target.value); setCorrectionChecked(false) }} disabled={correctionChecked} />
                <Button type="button" variant="secondary" disabled={!correctionDraft.trim() || correctionChecked} onClick={checkCorrection}>Проверить</Button>
              </div>
              {correctionChecked && (
                <div aria-live="polite" className="mt-4 rounded-[3px] border border-border bg-elevated p-4 shadow-[var(--lift-1)]">
                  <p className={cn('label-caps', correctionPassed ? 'text-teal' : 'text-amber')}>
                    {correctionPassed ? 'Форма совпала и сохранена.' : 'Сравните с целевым вариантом:'}
                  </p>
                  <Diff className="mt-3" before={active.commonMistake.wrong} after={active.commonMistake.correct} />
                  <p className="mt-3 text-xs leading-5 text-secondary">{active.commonMistake.note}</p>
                  <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => { setCorrectionDraft(''); setCorrectionChecked(false) }}>Попробовать снова</Button>
                </div>
              )}
            </section>

            <section className="mt-8">
              <div className="rule-double pb-2"><h2 className="label-caps text-primary">Активное применение</h2></div>
              <p className="mt-4 text-body leading-relaxed text-secondary">{grammarLessonExperience(grammarAcademyLessons, active).productionPrompt}</p>

              {lexicalCandidates.length > 0 && (
                <Card level="recess" className="mt-4 px-4 py-3.5">
                  <div className="text-body leading-relaxed text-secondary">
                    {lexicalTarget ? (
                      <>
                        <span>Используйте в своём примере знакомое выражение: <strong lang="en" className="reading-en text-primary">{lexicalTarget.canonical}</strong> — {lexicalTarget.meaning}.</span>
                        {lexicalTarget.context && <p lang="en" className="reading-en mt-1 text-xs text-muted">{lexicalTarget.context}</p>}
                      </>
                    ) : <span>Выражение не подходит к этому правилу — пишите пример без него.</span>}
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => { setLexicalTargetIndex((index) => (index + 1) % (lexicalCandidates.length + 1)); setProductionConfirmed(false); setTransferConfirmed(false) }}>
                    {lexicalTarget ? 'Другое выражение' : 'Вернуть выражение'}
                  </Button>
                </Card>
              )}

              <label htmlFor="grammar-production" className="mt-5 block text-sm font-semibold text-primary">Ваш новый пример</label>
              <Textarea
                id="grammar-production"
                lang="en"
                value={productionDraft}
                onChange={(event) => { setProductionDraft(event.target.value); setProductionConfirmed(false); setProductionMessage('') }}
                className="reading-en mt-2 min-h-28"
                placeholder="Write your own complete sentence…"
              />
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-[3px] border border-border bg-elevated p-3 text-sm leading-5 text-secondary shadow-[var(--lift-1)]">
                <input type="checkbox" className="mt-0.5 size-5 accent-[var(--rubric)]" checked={productionConfirmed} onChange={(event) => setProductionConfirmed(event.target.checked)} />
                <span>Я сверил(а) форму с правилом и примерами; это моё новое предложение, а не копия образца.</span>
              </label>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p role="status" aria-live="polite" className="max-w-[52ch] text-xs leading-5 text-muted">
                  {productionMessage || (activeProgress?.productionSavedAt ? 'Это ваш сохранённый пример.' : 'Перед сохранением сверьте предложение с правилом и поставьте галочку.')}
                </p>
                <Button type="button" variant="secondary" onClick={saveProduction} disabled={productionDraft.trim().split(/\s+/u).length < 6 || !productionConfirmed || !productionHasTarget}>
                  Сохранить пример
                </Button>
              </div>

              {activeProgress?.productionSavedAt && (
                <div className="mt-6">
                  <div className="rule-double pb-2"><h3 className="label-caps text-primary">Отложенный перенос в новый контекст</h3></div>
                  {!transferIsDue ? (
                    <div className="mt-4">
                      <Stamp caption="Откроется позже">
                        <span className="numeral">{transferReadyAt ? untilLabel(transferReadyAt, Date.now()) : 'через 12 ч'}</span>
                      </Stamp>
                      <MarginNote className="xl:max-w-none">Пауза в 12 часов помогает проверить, что правило действительно запомнилось.</MarginNote>
                    </div>
                  ) : (
                    <>
                      <p className="mt-4 text-body leading-relaxed text-secondary">
                        Не глядя на первый ответ, напишите другое предложение по той же формуле.
                        {lexicalTarget ? <> Снова естественно используйте <strong lang="en" className="reading-en text-primary">{lexicalTarget.canonical}</strong>.</> : null}
                      </p>
                      <label htmlFor="grammar-transfer" className="mt-4 block text-sm font-semibold text-primary">Новое предложение для переноса</label>
                      <Textarea
                        id="grammar-transfer"
                        lang="en"
                        value={transferDraft}
                        onChange={(event) => { setTransferDraft(event.target.value); setTransferConfirmed(false); setTransferMessage('') }}
                        className="reading-en mt-2 min-h-28"
                        placeholder="Write a different sentence in a new context…"
                      />
                      <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-[3px] border border-border bg-elevated p-3 text-sm leading-5 text-secondary shadow-[var(--lift-1)]">
                        <input type="checkbox" className="mt-0.5 size-5 accent-[var(--rubric)]" checked={transferConfirmed} onChange={(event) => setTransferConfirmed(event.target.checked)} />
                        <span>Я проверил(а), что контекст новый, предложение отличается и форма соответствует правилу.</span>
                      </label>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p role="status" aria-live="polite" className="text-xs leading-5 text-muted">{transferMessage || 'Этот ответ хранится отдельно от первого примера.'}</p>
                        <Button type="button" variant="secondary" onClick={saveTransfer} disabled={transferDraft.trim().split(/\s+/u).length < 6 || !transferConfirmed || !transferHasTarget || normalizePhrase(transferDraft) === normalizePhrase(productionDraft)}>
                          Сохранить перенос
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* ── КОРОТКАЯ ПРОВЕРКА ────────────────────────────────────── */}
            <section className="mt-9">
              <div className="rule-double flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2">
                <p className="section-kicker">Короткая проверка</p>
                {activeProgress && (
                  <p className="numeral text-xs text-muted">
                    {`Лучший результат: ${activeProgress.bestScore}/${activeProgress.totalQuestions} · успешных: ${activeProgress.passes}/2`}
                  </p>
                )}
              </div>
              <h2 className="mt-3 text-h3 font-light text-primary">Проверьте эту тему</h2>

              <div className="mt-5 space-y-7">
                {attemptQuiz.map((question, questionIndex) => (
                  <fieldset key={question.id}>
                    <legend lang="en" className="reading-en text-sm font-semibold leading-6 text-primary">
                      <span className="numeral mr-2 text-xs text-rubric">{questionIndex + 1}</span>{question.prompt}
                    </legend>
                    <div className="mt-3 grid gap-2">
                      {question.choices.map((choice, choiceIndex) => {
                        const chosen = answers[question.id] === choiceIndex
                        const correct = submitted && choiceIndex === question.answerIndex
                        const wrong = submitted && chosen && !correct
                        return (
                          <button
                            key={choice}
                            lang="en"
                            data-testid={`grammar-answer-${questionIndex}-${choiceIndex}`}
                            aria-pressed={chosen}
                            type="button"
                            disabled={submitted}
                            onClick={() => setAnswers((value) => ({ ...value, [question.id]: choiceIndex }))}
                            className={cn(
                              answerButtonClass,
                              // Неверный ответ — амбер, никогда не рубрика: красный на этом
                              // экране принадлежит редактору, а не провалу читателя.
                              correct ? 'border-verified/50 bg-verified-soft text-teal'
                                : wrong ? 'border-amber/50 bg-amber/10 text-amber'
                                : chosen ? 'border-transparent border-l-2 border-l-rubric bg-recess text-primary shadow-[var(--press)]'
                                : 'border-border bg-elevated text-secondary hover:text-primary',
                            )}
                          >
                            {choice}
                          </button>
                        )
                      })}
                    </div>
                    {submitted && <p lang="en" className="reading-en mt-2 text-xs leading-5 text-muted">{question.explanation}</p>}
                  </fieldset>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p aria-live="polite" className="max-w-[52ch] text-xs leading-5 text-muted">
                  {submitted
                    ? attemptQuiz.filter((question) => answers[question.id] === question.answerIndex).length === attemptQuiz.length
                      ? activeProgress?.completedAt
                        ? '3/3. Тема полностью пройдена.'
                        : (activeProgress?.passes ?? 0) >= 2
                          ? '3/3. Осталось исправить типичную ошибку, написать свой пример и сделать отложенный перенос.'
                          : '3/3. Проверка сохранена; следующая засчитается не раньше чем через 12 часов.'
                      : `${attemptQuiz.filter((question) => answers[question.id] === question.answerIndex).length}/${attemptQuiz.length}. Посмотрите объяснения и попробуйте снова.`
                    : 'Ответьте на все три вопроса.'}
                </p>
                {submitted
                  ? <Button variant="secondary" onClick={() => { setAnswers({}); setSubmitted(false); setQuizAttemptSeed((seed) => seed + 1) }}>Попробовать снова</Button>
                  : <Button data-testid="grammar-check" disabled={attemptQuiz.some((question) => answers[question.id] === undefined)} onClick={checkQuiz}>Проверить ответы</Button>}
              </div>

              {/* Четыре части критерия — один строкомер вместо четырёх пилюль. */}
              <Card level="recess" className="mt-6 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="inspector-label">Критерий освоения</p>
                  <Rule className="w-32 shrink-0" value={masteryDone} max={4} progressbar ariaLabel="Части критерия освоения" />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">{grammarLessonExperience(grammarAcademyLessons, active).masteryCriterion}</p>
                <dl className="mt-4 space-y-1.5">
                  {mastery.map((item) => (
                    <div key={item.label} className="flex items-baseline gap-2 text-xs">
                      {/* Отточие живёт ВНУТРИ dt: голый span между dt и dd в dl невалиден. */}
                      <dt className={cn('flex min-w-0 flex-1 items-baseline gap-2', item.done ? 'text-primary' : 'text-muted')}>
                        <span className="shrink-0">{item.label}</span>
                        <span aria-hidden="true" className="min-w-4 flex-1 translate-y-[-2px] border-b border-dotted border-border-strong" />
                      </dt>
                      <dd className={cn('numeral shrink-0', item.done ? 'text-teal' : 'text-muted')}>{item.state}</dd>
                    </div>
                  ))}
                </dl>
                {activeProgress?.legacyCompletedAt && !activeProgress.completedAt && (
                  <p className="mt-3 text-xs leading-5 text-amber">Раньше тема считалась пройденной по старым правилам. Дата сохранена, но проверки нужно пройти заново.</p>
                )}
              </Card>
            </section>

            <nav aria-label="Переход между уроками" className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
              {grammarLessonExperience(grammarAcademyLessons, active).previousLessonId
                ? <Button variant="ghost" onClick={() => setSelectedId(grammarLessonExperience(grammarAcademyLessons, active).previousLessonId!)}><ArrowLeft className="size-4" aria-hidden="true" /> Предыдущая тема</Button>
                : <span />}
              {grammarLessonExperience(grammarAcademyLessons, active).nextLessonId
                && <Button variant="secondary" onClick={() => setSelectedId(grammarLessonExperience(grammarAcademyLessons, active).nextLessonId!)}>Следующая тема <ArrowRight className="size-4" aria-hidden="true" /></Button>}
            </nav>
          </article>
        ))}
      </section>

      <details className="rounded-[3px] border border-border bg-surface p-4 text-xs text-muted shadow-[var(--lift-1)]">
        <summary className="label-caps cursor-pointer text-secondary">Источники учебной программы</summary>
        <p className="mt-3 leading-5">Тексты уроков, примеры и вопросы оригинальные; список тем сверен с этими учебниками.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {grammarAcademySources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="ink-underline text-teal">{source.publisher} — {source.title}</a>)}
        </div>
      </details>
    </div>
  )
}

function CumulativeCheckpoint({ level }: { level: GrammarLevel }) {
  const store = useForgeStore(useShallow((state) => ({
    grammarProgress: state.grammarProgress,
    recordGrammarCheckpoint: state.recordGrammarCheckpoint,
  })))
  const [session, setSession] = useState<GrammarCheckpointItem[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const lessons = grammarAcademyLessons.filter((lesson) => lesson.level === level)
  const available = buildGrammarCheckpoint(grammarAcademyLessons, store.grammarProgress, level)
  const nextAt = nextGrammarCheckpointAt(store.grammarProgress, new Set(lessons.map((lesson) => lesson.id)))

  function submit() {
    if (!session || session.some((item) => answers[item.question.id] === undefined)) return
    const results = session.map((item) => ({ lessonId: item.lessonId, correct: answers[item.question.id] === item.question.answerIndex }))
    if (store.recordGrammarCheckpoint(results, GRAMMAR_LESSON_IDS)) setSubmitted(true)
  }

  const answered = session ? session.filter((item) => answers[item.question.id] !== undefined).length : 0

  return <Card><CardBody>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-[62ch]">
        <p className="section-kicker">{available.length === 1 ? 'Повторение одной темы' : 'Накопительная проверка'}</p>
        <h2 className="mt-1.5 text-h3 font-light text-primary">{available.length === 1 ? 'Повторите одну тему' : 'Повторите несколько прошлых тем'}</h2>
        <p className="mt-2 text-body leading-relaxed text-secondary">
          {available.length === 1
            ? 'Один вопрос по теме, которую пора повторить. После ошибки она вернётся завтра, после успеха — позже.'
            : 'По одному вопросу из тем, которые пора повторить. После ошибки тема вернётся завтра, после успеха — позже.'}
        </p>
      </div>
      {!session && <Button type="button" variant="secondary" disabled={!available.length} onClick={() => { setSession(available); setAnswers({}); setSubmitted(false) }}>Начать · {available.length}</Button>}
    </div>

    {!session && !available.length && (
      <div className="mt-5">
        <Stamp caption="Повторять пока нечего">
          <span>Все темы повторены вовремя.</span>
        </Stamp>
        {nextAt && nextAt > Date.now() && (
          <MarginNote className="xl:max-w-none">Следующее повторение <span className="numeral">{untilLabel(nextAt, Date.now())}</span>.</MarginNote>
        )}
      </div>
    )}

    {session && <>
      <div className="rule-double mt-6 pb-4" />
      <div className="mt-1 flex items-center justify-end">
        <Rule className="w-32" value={answered} max={session.length} progressbar ariaLabel="Отвечено в накопительной проверке" />
      </div>
      <div className="mt-4 space-y-6">
        {session.map((item, index) => (
          <fieldset key={item.question.id} disabled={submitted}>
            <legend className="text-sm font-semibold text-primary">
              <span className="label-caps mr-2 text-rubric">{FOLIO[index] ?? String(index + 1)}</span>
              <span lang="en" className="reading-en">{item.question.prompt}</span>
              {submitted && <span className="mt-1 block text-xs font-normal text-muted">Тема: {item.lessonTitle}</span>}
            </legend>
            <div className="mt-2.5 grid gap-2">
              {item.question.choices.map((choice, choiceIndex) => {
                const chosen = answers[item.question.id] === choiceIndex
                const correct = submitted && choiceIndex === item.question.answerIndex
                const wrong = submitted && chosen && !correct
                return (
                  <button
                    key={choice}
                    type="button"
                    lang="en"
                    aria-pressed={chosen}
                    onClick={() => setAnswers((current) => ({ ...current, [item.question.id]: choiceIndex }))}
                    className={cn(
                      'detent reading-en min-h-11 w-full rounded-[3px] border px-4 py-2.5 text-left text-sm shadow-[var(--lift-1)]',
                      correct ? 'border-verified/50 bg-verified-soft text-teal'
                        : wrong ? 'border-amber/50 bg-amber/10 text-amber'
                        : chosen ? 'border-transparent border-l-2 border-l-rubric bg-recess text-primary shadow-[var(--press)]'
                        : 'border-border bg-elevated text-secondary hover:text-primary',
                    )}
                  >
                    {choice}
                  </button>
                )
              })}
            </div>
            {submitted && <p lang="en" className="reading-en mt-2 text-xs leading-5 text-muted">{item.question.explanation}</p>}
          </fieldset>
        ))}
      </div>
      <div className="rule-double mt-6 pb-4" />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="max-w-[52ch] text-xs leading-5 text-muted">
          {submitted
            ? `Сохранено: ${session.filter((item) => answers[item.question.id] === item.question.answerIndex).length}/${session.length}. Темы с ошибкой вернутся завтра, остальные — позже.`
            : 'Ответьте на каждый вопрос.'}
        </p>
        {submitted
          ? <Button type="button" variant="ghost" onClick={() => { setSession(null); setAnswers({}); setSubmitted(false) }}>Закрыть</Button>
          : <Button type="button" disabled={session.some((item) => answers[item.question.id] === undefined)} onClick={submit}>Сохранить проверку</Button>}
      </div>
    </>}
  </CardBody></Card>
}
