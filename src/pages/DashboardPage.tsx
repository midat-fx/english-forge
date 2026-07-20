import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, ArrowRight, Check, LibraryBig, Plus, Target } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import type { AppOutletContext } from '../components/AppShell'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonVariants'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Contents, type ContentsItem } from '../components/ui/Contents'
import { MarginNote } from '../components/ui/MarginNote'
import { Rule } from '../components/ui/Rule'
import { Input } from '../components/ui/Field'
import { grammarAcademyLessons } from '../data/grammarAcademy'
import { buildGrammarCheckpoint, dueGrammarLessonIds } from '../data/grammarCheckpoint'
import { recommendedPlacementLessonIdsFromAnswers } from '../data/placementTest'
import { activationBacklogSize, activationBlockedByMissingErrorPattern, activationDailyQuota, activationNewEnrollmentLimit, activationWorkDoneToday, hasQualifiedActivationThrough } from '../domain/activation'
import { DAILY_NEW_ITEM_COUNT, dailyVocabularyItems, localDayKey, resolveDailyVocabularyAssignment } from '../domain/dailyVocabulary'
import { useLexicalCatalogLevel } from '../hooks/useLexicalCatalogLevel'
import { useLocalToday } from '../hooks/useLocalToday'
import { calculateProgress } from '../domain/progress'
import { grammarLessonForError } from '../domain/grammarRecommendation'
import { listeningAttemptHasVerifiedEvidence } from '../domain/listening'
import { isCompletedSpeakingPractice, speakingEvidencePhraseIds } from '../domain/speaking'
import { buildPracticeQueue, dailyReviewPlan, estimatePracticeMinutes, wasDueWhenReviewed } from '../domain/queue'
import { useForgeStore } from '../store/useForgeStore'

/** Правило 7: любое число — моно + tabular-nums, включая числа во вспомогательных строках. */
function N({ children }: { children: ReactNode }) {
  return <span className="numeral">{children}</span>
}

export function DashboardPage() {
  const { openAddPhrase } = useOutletContext<AppOutletContext>()
  const store = useForgeStore(useShallow((state) => ({
    dailyVocabularyAssignment: state.dailyVocabularyAssignment,
    dailyVocabularyAssignments: state.dailyVocabularyAssignments,
    phrases: state.phrases,
    skillStates: state.skillStates,
    reviews: state.reviews,
    errors: state.errors,
    missions: state.missions,
    speakingAttempts: state.speakingAttempts,
    listeningAttempts: state.listeningAttempts,
    placementAttempts: state.placementAttempts,
    grammarProgress: state.grammarProgress,
    preferences: state.preferences,
    addPhrase: state.addPhrase,
    ensureDailyVocabularyAssignment: state.ensureDailyVocabularyAssignment,
  })))
  const ensureDailyVocabularyAssignment = store.ensureDailyVocabularyAssignment
  const today = useLocalToday()
  const [quickWord, setQuickWord] = useState('')
  const [message, setMessage] = useState('')
  const metrics = calculateProgress(store)
  const level = store.preferences.currentLevel
  const { items: levelCatalog, error: catalogError, loading: catalogLoading } = useLexicalCatalogLevel(level)
  const lessons = grammarAcademyLessons.filter((lesson) => lesson.level === level)
  const completedLessons = new Set(store.grammarProgress.filter((item) => item.completedAt).map((item) => item.lessonId))
  const latestPlacement = store.placementAttempts[0]
  const recommendedIds = latestPlacement
    ? recommendedPlacementLessonIdsFromAnswers(latestPlacement.answers, latestPlacement.suggestedLevel)
    : []
  const activeError = [...store.errors].filter((error) => error.status !== 'resolved').sort((left, right) => right.occurrences - left.occurrences || left.dueAt.localeCompare(right.dueAt))[0]
  const errorLesson = grammarLessonForError(activeError, grammarAcademyLessons, completedLessons)
  const placementLesson = grammarAcademyLessons.find((lesson) => recommendedIds.includes(lesson.id) && !completedLessons.has(lesson.id))
  const strugglingLesson = [...store.grammarProgress]
    .filter((progress) => !progress.completedAt && lessons.some((lesson) => lesson.id === progress.lessonId))
    .sort((left, right) => (left.bestScore / left.totalQuestions) - (right.bestScore / right.totalQuestions) || right.lastAttemptedAt.localeCompare(left.lastAttemptedAt))
    .map((progress) => lessons.find((lesson) => lesson.id === progress.lessonId))
    .find(Boolean)
  const dueGrammarIds = dueGrammarLessonIds(grammarAcademyLessons, store.grammarProgress, level, today)
  const correctiveLesson = dueGrammarIds.length === 1 ? grammarAcademyLessons.find((lesson) => lesson.id === dueGrammarIds[0]) : undefined
  const nextLesson = correctiveLesson ?? errorLesson ?? placementLesson ?? strugglingLesson ?? lessons.find((lesson) => !completedLessons.has(lesson.id)) ?? lessons[0]
  // Почему выбран именно этот урок. Единственное место, где программа объясняет
  // свой выбор пользователю, — без него строка оглавления сообщает «что», но не «почему».
  const grammarRecommendationReason = correctiveLesson
    ? 'Точечное возвращение единственной темы, срок повторения которой наступил'
    : errorLesson
      ? `По категории и формулировке записи Error Lab: ${activeError?.label}`
      : activeError
        ? 'Следующая тема программы; для текущей записи Error Lab нет надёжного соответствия уроку'
        : placementLesson
          ? 'По результатам диагностики'
          : strugglingLesson
            ? 'По последней сложной проверке'
            : `Следующая тема уровня ${level}`
  const cumulativeDueCount = buildGrammarCheckpoint(grammarAcademyLessons, store.grammarProgress, level, today).length
  const needsFoundationReview = (latestPlacement?.bandScores.A2.correct ?? 8) < 5
  const recent = store.phrases.filter((phrase) => phrase.status !== 'archived').sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5)
  const wordsAtLevel = store.phrases.filter((phrase) => phrase.status !== 'archived' && phrase.cefr === level).length
  const dailyResolution = useMemo(
    () => levelCatalog ? resolveDailyVocabularyAssignment(levelCatalog, level, store.phrases, today, DAILY_NEW_ITEM_COUNT, store.dailyVocabularyAssignments.find((item) => item.dayKey === localDayKey(today) && item.level === level) ?? store.dailyVocabularyAssignment, store.dailyVocabularyAssignments) : null,
    [level, levelCatalog, store.dailyVocabularyAssignment, store.dailyVocabularyAssignments, store.phrases, today],
  )
  const dailyAssignment = dailyResolution?.assignment ?? null
  const dailyItems = useMemo(() => levelCatalog && dailyAssignment ? dailyVocabularyItems(levelCatalog, level, store.phrases, today, DAILY_NEW_ITEM_COUNT, dailyAssignment, store.dailyVocabularyAssignments) : [], [dailyAssignment, level, levelCatalog, store.dailyVocabularyAssignments, store.phrases, today])
  const enrolledDailyIds = useMemo(() => new Set(dailyAssignment?.enrolledIds ?? []), [dailyAssignment?.enrolledIds])
  const previewedDailyIds = useMemo(() => new Set(dailyAssignment?.previewedIds ?? []), [dailyAssignment?.previewedIds])
  const dailyLearned = enrolledDailyIds.size
  const dailyPreviewed = dailyItems.filter((item) => previewedDailyIds.has(item.id)).length
  const activationReadyCatalogCount = levelCatalog?.filter((item) => item.activationReady === true).length ?? 0
  const referenceOnlyCatalogCount = Math.max(0, (levelCatalog?.length ?? 0) - activationReadyCatalogCount)
  const todayKey = localDayKey(today)
  const happenedToday = (value?: string) => Boolean(value && localDayKey(new Date(value)) === todayKey)
  const grammarDoneToday = store.grammarProgress.some((item) => happenedToday(item.lastAttemptedAt) && (item.lastScore ?? 0) / item.totalQuestions >= 0.8)
  const awaitingStageSevenIds = new Set(store.phrases.filter((phrase) => phrase.cefr === level
    && phrase.status !== 'archived'
    && phrase.status !== 'needs_enrichment'
    && (phrase.activationStage ?? 0) === 6
    && hasQualifiedActivationThrough(phrase, 6, today)).map((phrase) => phrase.id))
  const dueSpokenIds = new Set(store.skillStates.filter((state) => state.skill === 'spoken_productive'
    && state.phase !== 'suspended'
    && new Date(state.dueAt).getTime() <= today.getTime()
    && store.phrases.some((phrase) => phrase.id === state.phraseId
      && phrase.cefr === level
      && phrase.status !== 'archived'
      && phrase.status !== 'needs_enrichment'
      && (phrase.activationStage ?? 0) >= 7
      && hasQualifiedActivationThrough(phrase, 6, today))).map((state) => state.phraseId))
  const speakingDoneToday = store.speakingAttempts.some((item) => happenedToday(item.createdAt)
    && isCompletedSpeakingPractice(item, today)
    && (!awaitingStageSevenIds.size || speakingEvidencePhraseIds(item, store.phrases, today).some((id) => awaitingStageSevenIds.has(id)))
    && (awaitingStageSevenIds.size > 0 || !dueSpokenIds.size || speakingEvidencePhraseIds(item, store.phrases, today).some((id) => dueSpokenIds.has(id))))
  const listeningDoneToday = store.listeningAttempts.some((item) => happenedToday(item.createdAt)
    && item.sourceId.startsWith('daily-local-')
    && listeningAttemptHasVerifiedEvidence(item)
    && item.playbackCompleted === true
    && item.answerMatched
    && Boolean(item.referenceTranscript?.trim())
    && item.comprehensionMatched === true
    && !item.revealUsed)
  const availableReviewQueue = buildPracticeQueue(store.skillStates, store.phrases, store.preferences, today, undefined, dailyAssignment, store.reviews)
  const actionableDue = availableReviewQueue.length
  const rawWrittenReviewBacklog = Math.max(0, metrics.due - metrics.spokenDue)
  const activationDoneToday = activationWorkDoneToday(store.phrases, today, level)
  const activationBacklog = activationBacklogSize(store.phrases, level)
  const activationBlocked = activationBlockedByMissingErrorPattern(store.phrases, level)
  const activationQuota = activationDailyQuota(store.phrases, dailyAssignment, store.preferences.dailyMinutes, today, level, actionableDue)
  const activationAdmissionLimit = activationNewEnrollmentLimit(store.preferences.dailyMinutes, actionableDue, activationBacklog)
  const deepEligibleDailyItems = dailyItems.filter((item) => item.activationReady === true)
  const dailySelectionTarget = Math.min(deepEligibleDailyItems.length, store.preferences.maxNewPhrases, activationAdmissionLimit)
  const activationRemaining = Math.max(0, activationQuota - activationDoneToday)
  const dueReviewsToday = store.reviews.filter((review) => happenedToday(review.reviewedAt) && wasDueWhenReviewed(review)).length
  const reviewPlan = dailyReviewPlan(actionableDue, dueReviewsToday, store.preferences.dailyMinutes, activationQuota)
  const reviewsDoneToday = reviewPlan.remaining === 0
  const vocabularyDoneToday = !catalogLoading
    && dailyPreviewed >= dailyItems.length
    && activationRemaining === 0
    && dailyLearned >= dailySelectionTarget
  const completedRouteSteps = [vocabularyDoneToday, grammarDoneToday, reviewsDoneToday, listeningDoneToday, speakingDoneToday].filter(Boolean).length
  const plannedPracticeMinutes = estimatePracticeMinutes(reviewPlan.remaining)
  const pendingDailyEnrollments = Math.max(0, dailySelectionTarget - dailyLearned)
  const pendingDailyDiscoveries = Math.max(0, dailyItems.length - dailyPreviewed)
  const fullPracticeMinutes = estimatePracticeMinutes(reviewPlan.remaining) + estimatePracticeMinutes(activationRemaining)
  const fullRouteMinutes = (pendingDailyDiscoveries || pendingDailyEnrollments ? 4 : 0) + fullPracticeMinutes + 7 + 4 + 4

  useEffect(() => {
    if (dailyAssignment && dailyResolution && levelCatalog) ensureDailyVocabularyAssignment()
  }, [dailyAssignment, dailyResolution, ensureDailyVocabularyAssignment, levelCatalog])

  function quickCapture(event: FormEvent) {
    event.preventDefault()
    if (!quickWord.trim()) return
    const result = store.addPhrase({ canonical: quickWord, meaning: '', context: '', source: 'Quick capture', kind: 'word', cefr: level, register: ['neutral'], tags: [], note: '' })
    if (result.error) setMessage(result.error)
    else if (result.duplicateId) setMessage('Это слово уже есть в разделе «Мои слова».')
    else { setMessage('Сохранено. Позже добавьте значение или пример.'); setQuickWord('') }
  }

  const nextAction = pendingDailyDiscoveries || pendingDailyEnrollments
    ? { label: 'Открыть новые слова', to: '/library' }
    : reviewPlan.remaining
      ? { label: 'Начать повторение', to: '/practice' }
      : activationRemaining
        ? { label: 'Продолжить отработку', to: '/practice' }
        : { label: 'Открыть практику', to: '/practice' }

  const issueDate = today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  // ── ОГЛАВЛЕНИЕ ВЫПУСКА: единственный носитель маршрута дня ───────────────
  const routeSteps: Array<{ id: string; folio: string; title: string; detail: ReactNode; time: string; to: string; done: boolean }> = [
    {
      id: 'vocabulary',
      folio: 'I',
      title: 'Новые слова',
      detail: <>Знакомство <N>{dailyPreviewed}/{dailyItems.length}</N> правильных ответов · взято в отработку <N>{Math.min(dailyLearned, dailySelectionTarget)}/{dailySelectionTarget}</N> · <N>{activationDoneToday}/{activationQuota}</N> следующих шагов · хвост: <N>{activationBacklog}</N></>,
      time: pendingDailyDiscoveries || pendingDailyEnrollments ? '≈ 4 мин на извлечение' : activationRemaining ? `≈ ${estimatePracticeMinutes(activationRemaining)} мин` : 'Готово',
      to: pendingDailyDiscoveries || pendingDailyEnrollments ? '/library' : '/practice',
      done: vocabularyDoneToday,
    },
    {
      id: 'grammar',
      folio: 'II',
      title: 'Грамматика',
      detail: cumulativeDueCount === 1 && correctiveLesson ? `Точечное возвращение: ${correctiveLesson.title}` : cumulativeDueCount > 1 ? <>Накопительная проверка: пора вернуть <N>{cumulativeDueCount}</N> тем</> : nextLesson ? `${nextLesson.title} · ${grammarRecommendationReason}` : `Урок уровня ${level}`,
      time: '≈ 7 мин',
      to: cumulativeDueCount ? '/grammar' : `/grammar${nextLesson ? `?lesson=${nextLesson.id}` : ''}`,
      done: grammarDoneToday,
    },
    {
      id: 'review',
      folio: 'III',
      title: 'Повторение',
      detail: rawWrittenReviewBacklog === 0
        ? 'На сегодня нет заданий по расписанию'
        : reviewPlan.quota
          ? <><N>{reviewPlan.completed}/{reviewPlan.quota}</N> по плану · всего накопилось: <N>{rawWrittenReviewBacklog}</N> · доступно самостоятельно сейчас: <N>{actionableDue}</N></>
          : <>Всего накопилось: <N>{rawWrittenReviewBacklog}</N> · доступно самостоятельно сейчас: <N>0</N> после недавнего показа ответа</>,
      time: reviewPlan.remaining ? `≈ ${plannedPracticeMinutes} мин` : 'План выполнен',
      to: '/practice',
      done: reviewsDoneToday,
    },
    {
      id: 'listening',
      folio: 'IV',
      title: 'Аудирование',
      detail: 'Локальный диктант без открытого текста',
      time: '≈ 4 мин',
      to: '/voice?tab=listening',
      done: listeningDoneToday,
    },
    {
      id: 'speaking',
      folio: 'V',
      title: 'Речь',
      detail: <>Записанный ответ без открытой подсказки · ждут шага <N>7</N>: <N>{awaitingStageSevenIds.size}</N> · устных повторов по сроку: <N>{dueSpokenIds.size}</N></>,
      time: '≈ 4 мин',
      to: '/voice',
      done: speakingDoneToday,
    },
  ]
  const currentStepId = routeSteps.find((step) => !step.done)?.id
  const routeItems: ContentsItem[] = routeSteps.map((step) => ({
    id: step.id,
    folio: step.folio,
    state: step.done ? 'done' : step.id === currentStepId ? 'current' : 'future',
    to: step.to,
    title: (
      <>
        {step.title}
        <span className="ml-2 text-xs font-normal text-muted">{step.detail}</span>
      </>
    ),
    value: step.done
      ? <><Check aria-hidden="true" className="inline size-4 text-verified" /><span className="sr-only">выполнено</span></>
      : step.time,
  }))

  return (
    <div className="space-y-7">
      {/* 1 · КОЛОНТИТУЛ — в потоке, без плиты */}
      <header className="rule-double flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 pb-2.5">
        <p className="section-kicker">English Forge · выпуск от {issueDate}</p>
        <p className="inspector-label">Уровень {level} → {store.preferences.targetLevel}</p>
      </header>

      {/* 2 · ГЕРОЙ — единственный крупный объект первого экрана */}
      <Card level="leaf" className="p-6 sm:p-9">
        <Badge tone="ember">{needsFoundationReview ? 'Сначала укрепляем основы A2' : `Ваш рабочий уровень: ${level}`}</Badge>
        <h2 className="mt-5 max-w-3xl text-display font-light tracking-[-0.02em] text-primary">Двигаемся к {store.preferences.targetLevel} без перегрузки.</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-secondary">Несколько полезных выражений, одна понятная тема грамматики и короткое повторение уже дают хороший ежедневный шаг.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to={nextAction.to} className={buttonClass({ variant: 'ember', size: 'lg' })}>{nextAction.label} <ArrowRight className="size-4" aria-hidden="true" /></Link>
          <Link to="/level-test" className={buttonClass({ variant: 'secondary', size: 'lg' })}>{latestPlacement ? 'Пройти тест заново' : 'Пройти диагностику'}</Link>
        </div>
      </Card>

      {/* 3 · ОГЛАВЛЕНИЕ ВЫПУСКА — единственный носитель маршрута дня */}
      <section aria-labelledby="daily-route-title">
        <Card level="leaf">
          <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="section-kicker">Ежедневный маршрут</p>
              <h2 id="daily-route-title" className="card-title">Пять коротких шагов — в одном месте</h2>
            </div>
            <Rule progressbar value={completedRouteSteps} max={5} ariaLabel="Готовность" className="w-full shrink-0 sm:w-44" />
          </CardHeader>
          <CardBody className="px-2 py-4 sm:px-3">
            <Contents items={routeItems} />
          </CardBody>
          <div className="flex flex-col gap-2 border-t border-border px-5 py-3 xl:flex-row xl:items-start xl:justify-between xl:gap-8">
            <p className="text-xs leading-5 text-muted">Прогресс считается только по сохранённым действиям: словам, проверке грамматики, повторению и голосовым попыткам.</p>
            <MarginNote className="xl:max-w-64">Полный маршрут сегодня: ≈ <N>{fullRouteMinutes}</N> мин; блок повторений ограничен настройкой <N>{store.preferences.dailyMinutes}</N> мин. Можно разделить на несколько подходов.</MarginNote>
          </div>
        </Card>
      </section>

      {/* 4 · ВЫХОДНЫЕ ДАННЫЕ — одна строка, волосяные разделители */}
      <Card level="recess" className="grid grid-cols-2 sm:grid-cols-4">
        <SimpleMetric value={wordsAtLevel} label={`сохранено на ${level}`} />
        <SimpleMetric value={metrics.due} label="нужно повторить" divider />
        <SimpleMetric value={completedLessons.size} label="тем проверено дважды" divider className="border-t border-border sm:border-t-0" />
        <SimpleMetric value={metrics.speakingMinutes} label="минут речи" divider className="border-t border-border sm:border-t-0" />
      </Card>

      {/* 5 · СЕГОДНЯШНИЕ 10 СЛОВ */}
      <section className="overflow-hidden rounded-[3px] border border-border bg-surface shadow-[var(--lift-1)]">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="section-kicker">План на сегодня</p>
            <h2 className="card-title">Сегодняшние 10 слов и выражений</h2>
            <p className="mt-2 text-sm text-secondary">Знакомство со скрытым значением, из всего двуязычного справочника: <span className="numeral font-semibold text-primary">{dailyPreviewed}/{dailyItems.length}</span>; взято в отработку: <span className="numeral font-semibold text-primary">{Math.min(dailyLearned, dailySelectionTarget)}/{dailySelectionTarget}</span>.</p>
          </div>
          <Link to="/library" className={buttonClass({ variant: 'secondary', size: 'lg', className: 'shrink-0' })}>Открыть набор <ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
        {catalogError && <p role="alert" className="m-5 rounded-[3px] border border-rubric/40 bg-rubric-soft p-4 text-sm text-ember-text">{catalogError} Перезапустите приложение и попробуйте снова.</p>}
        <div aria-busy={catalogLoading} className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
          {catalogLoading
            ? Array.from({ length: DAILY_NEW_ITEM_COUNT }, (_, index) => (
              <div key={index} className="min-h-24 animate-pulse bg-surface p-4 shadow-[var(--bevel-down)] motion-reduce:animate-none">
                <div className="h-3 w-8 rounded-[2px] bg-elevated" />
                <div className="mt-3 h-4 w-3/4 rounded-[2px] bg-elevated" />
                <div className="mt-2 h-3 w-1/2 rounded-[2px] bg-elevated" />
              </div>
            ))
            : dailyItems.map((item, index) => {
              const learned = enrolledDailyIds.has(item.id)
              const discovered = previewedDailyIds.has(item.id)
              return (
                <div key={item.id} className="group relative bg-surface p-4 shadow-[var(--bevel-down)] transition-colors hover:bg-elevated">
                  <div className="flex items-center justify-between">
                    <span className="numeral text-xs text-muted">{String(index + 1).padStart(2, '0')}</span>
                    {learned
                      ? <span><Check aria-hidden="true" className="size-4 text-verified" /><span className="sr-only">Выбрано в глубокую активацию</span></span>
                      : discovered
                        ? <span className="text-xs font-bold text-verified">Узнано ✓</span>
                        : null}
                  </div>
                  <p lang="en" className="reading-en mt-2 text-[15px] font-semibold text-primary">{item.expression}</p>
                  {discovered
                    ? <p lang="ru" className="mt-1 text-xs text-secondary">{item.translationRu}</p>
                    : <p className="mt-1 text-center text-xs text-muted">Значение скрыто до ответа</p>}
                </div>
              )
            })}
          {!catalogLoading && !dailyItems.length && (
            <div className="col-span-full bg-surface p-6 text-center text-sm leading-6 text-secondary">
              <p>Проверенный набор уровня {level} завершён. Мост к следующему уровню: неделя отложенных повторений, накопительная грамматика и задание на перенос, затем новая диагностика — материал следующего уровня не подмешивается без подтверждения.</p>
              <Link to="/level-test" className={buttonClass({ variant: 'secondary', className: 'mt-3' })}>Проверить готовность к следующему уровню</Link>
            </div>
          )}
        </div>
        <details className="group border-t border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 py-3 text-xs font-semibold text-muted transition-colors hover:text-secondary [&::-webkit-details-marker]:hidden"><ArrowRight className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" /> Как это устроено</summary>
          <div className="px-5 pb-4 xl:flex xl:gap-8">
            <p className="max-w-2xl text-xs leading-5 text-muted">Каждый день из всего двуязычного каталога уровня {level} выбираются <N>10</N> выражений. Полный восьмишаговый маршрут {level}: <N>{activationReadyCatalogCount}</N>; справочные этапы <N>1</N>–<N>5</N>: <N>{referenceOnlyCatalogCount}</N>.</p>
            <MarginNote className="xl:max-w-64">Когда накопленных повторений слишком много, новые поступления ставятся на паузу: работа по циклу <N>{activationDoneToday}/{activationQuota}</N>, хвост <N>{activationBacklog}</N>, ждут вашей личной ошибки <N>{activationBlocked}</N>.</MarginNote>
          </div>
        </details>
      </section>

      {/* 6 · ДВЕ КАРТОЧКИ-АНОНСА */}
      <section aria-label="Перенос навыков и работа над ошибками" className="grid gap-4 sm:grid-cols-2">
        <AnnounceCard
          to="/mission"
          icon={<Target className="size-5" />}
          kicker="Еженедельный перенос"
          title="Задание на перенос"
          note={<>Соберите изученные выражения в одном реальном ответе. Активных заданий: <span className="numeral">{store.missions.filter((mission) => !mission.legacyContract && mission.status !== 'done' && mission.level === level).length}</span>.</>}
        />
        <AnnounceCard
          to="/errors"
          icon={<AlertCircle className="size-5" />}
          kicker="Персональная коррекция"
          title="Лаборатория ошибок"
          note={<>Исправьте повторяющиеся ошибки и проверьте перенос на новом примере. Активных паттернов: <span className="numeral">{store.errors.filter((error) => error.status !== 'resolved').length}</span>.</>}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><div><p className="section-kicker">Ваша личная база</p><h2 className="card-title">Быстро сохранить слово</h2></div><Plus className="size-5 text-verified" aria-hidden="true" /></CardHeader>
          <CardBody>
            <form onSubmit={quickCapture} className="space-y-3">
              <Input value={quickWord} onChange={(event) => setQuickWord(event.target.value)} placeholder="Введите слово или выражение…" aria-label="Быстро добавить слово" />
              <Button type="submit" className="w-full">Сохранить в мои слова</Button>
            </form>
            <p aria-live="polite" className="mt-3 text-xs leading-5 text-muted">{message || 'Всё остаётся на этом Mac.'}</p>
            <button type="button" onClick={openAddPhrase} className="ink-underline mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-teal">Добавить значение, пример и детали</button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><div><p className="section-kicker">Мои слова</p><h2 className="card-title">Недавно сохранённые</h2></div><Link to="/phrases" className="ink-underline inline-flex min-h-11 items-center text-sm font-semibold text-teal">Открыть все</Link></CardHeader>
          <CardBody className="p-0">
            {recent.length
              ? recent.map((phrase) => (
                <div key={phrase.id} className="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-0">
                  <Badge tone="neutral">{phrase.cefr}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-primary">{phrase.canonical}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{phrase.meaning || phrase.context || 'Нужно добавить значение или пример'}</p>
                  </div>
                </div>
              ))
              : <div className="empty-state"><LibraryBig className="size-6" aria-hidden="true" /><p>Добавьте первое слово из библиотеки.</p></div>}
          </CardBody>
        </Card>
      </section>
    </div>
  )
}

/** Выходные данные: моно-значение над капительной подписью, волосяной разделитель слева. */
function SimpleMetric({ value, label, divider, className }: { value: number; label: string; divider?: boolean; className?: string }) {
  return (
    <div className={['px-5 py-4', divider ? 'border-l border-border' : '', className ?? ''].filter(Boolean).join(' ')}>
      <p className="metric-value numeral">{value}</p>
      <p className="metric-label">{label}</p>
    </div>
  )
}

function AnnounceCard({ to, icon, kicker, title, note }: { to: string; icon: ReactNode; kicker: string; title: string; note: ReactNode }) {
  return (
    <Link
      to={to}
      className="lamp ink-underline group flex min-h-32 items-start gap-4 rounded-[3px] border border-border bg-surface p-5 shadow-[var(--lift-1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-[3px] border border-border bg-elevated text-secondary shadow-[var(--bevel-up)]">{icon}</span>
      <span className="min-w-0">
        <span className="section-kicker block">{kicker}</span>
        <span className="card-title block">{title}</span>
        <span className="mt-1.5 block text-xs leading-5 text-muted">{note}</span>
      </span>
      <ArrowRight className="ml-auto mt-3 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </Link>
  )
}
