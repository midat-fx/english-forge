import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { PlacementListeningPanel } from '../components/PlacementListeningPanel'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Rule } from '../components/ui/Rule'
import { PLACEMENT_QUESTIONS, PLACEMENT_QUESTION_SET_VERSION, placementSelectionFromAnswers, recommendedPlacementLessonIds, scorePlacement, type PlacementResult, type PlacementSkill } from '../data/placementTest'
import type { CEFRLevel } from '../domain/types'
import type { PlacementListeningDiagnostic } from '../domain/placementListening'
import { cn } from '../lib/utils'
import { useForgeStore } from '../store/useForgeStore'

/**
 * ПЕРВЫЙ ЛИСТ ВЫПУСКА. Экран живёт ВНЕ AppShell — ни рельса, ни панели
 * инструментов, ни одной чужой рамки: полноэкранный лист на столе, колонтитул
 * сверху, колонцифра над строкомером. Это первое, что видит человек, которому
 * передали приложение, поэтому здесь нет ни одного дрейфующего пикселя.
 *
 * ИНВАРИАНТЫ ТЕСТОВ (PlacementPage.test.tsx), менять запрещено:
 *   · кнопки «Открыть последний профиль», «Закрыть профиль», «Пройти снова»,
 *     «Сохранить и проверить ещё 3 навыка»;
 *   · текст «Сохранённая диагностика»;
 *   · role="progressbar" с именем вида «грамматика: 7 из 8» и aria-valuenow,
 *     равным числу верных ответов, — <Rule progressbar> сохраняет и роль, и
 *     имя, и valuenow;
 *   · «CEFR‑профиля» набрано через неразрывный дефис U+2011 — это ДРУГОЙ
 *     символ, чем обычный дефис, и нормализация его ломает поиск в тесте.
 */
type Phase = 'intro' | 'questions' | 'result'
const LEVELS: CEFRLevel[] = ['A2', 'B1', 'B2', 'C1']
const SKILL_LABELS: Record<PlacementSkill, string> = { grammar: 'грамматика', vocabulary: 'лексика', reading: 'чтение', use_of_english: 'Use of English' }

const AFTER_STEPS: Array<[string, string, string]> = [
  ['01', 'Ваш уровень', 'Покажем приблизительный рабочий диапазон, а не выдуманный сертификат.'],
  ['02', 'Ваш маршрут', 'Закроем пробелы A2 и постепенно добавим материал B1/B2.'],
  ['03', 'Ваша база', 'Вы сами добавляете лучшие слова и выражения из большой библиотеки.'],
]

const INTRO_FACTS: Array<[string, string]> = [
  ['Время', '12–18 минут'],
  ['Области', '4'],
  ['Диапазон', 'A2 → C1'],
]

export function PlacementPage() {
  const completePlacement = useForgeStore((state) => state.completePlacement)
  const previousAttempts = useForgeStore((state) => state.placementAttempts)
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [listeningDiagnostic, setListeningDiagnostic] = useState<PlacementListeningDiagnostic>()
  const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({})
  const [reopenedAttemptId, setReopenedAttemptId] = useState<string>()
  const latestAttempt = previousAttempts[0]
  const latestSelection = useMemo(() => latestAttempt?.questionSetVersion === PLACEMENT_QUESTION_SET_VERSION
    ? placementSelectionFromAnswers(latestAttempt.answers)
    : undefined, [latestAttempt])
  const result = useMemo<PlacementResult | undefined>(() => phase === 'result' ? scorePlacement(selected) : undefined, [phase, selected])
  const recommendedLessonIds = useMemo(() => phase === 'result' ? recommendedPlacementLessonIds(selected) : [], [phase, selected])
  const question = PLACEMENT_QUESTIONS[index]
  const answered = selected[question?.id] !== undefined

  useEffect(() => {
    if (!recommendedLessonIds.length) return
    let active = true
    void import('../data/grammarAcademy').then(({ grammarAcademyLessons }) => {
      if (!active) return
      setLessonTitles(Object.fromEntries(grammarAcademyLessons.map((lesson) => [lesson.id, lesson.title])))
    })
    return () => { active = false }
  }, [recommendedLessonIds])

  function next() {
    if (!answered) return
    if (index === PLACEMENT_QUESTIONS.length - 1) setPhase('result')
    else setIndex((value) => value + 1)
  }

  function startNewAttempt() {
    setSelected({})
    setListeningDiagnostic(undefined)
    setReopenedAttemptId(undefined)
    setIndex(0)
    setPhase('questions')
  }

  function reopenLatestProfile() {
    if (!latestAttempt || !latestSelection) return
    setSelected(latestSelection)
    setListeningDiagnostic(latestAttempt.listeningDiagnostic)
    setReopenedAttemptId(latestAttempt.id)
    setIndex(0)
    setPhase('result')
  }

  async function saveResult(destination = '/') {
    if (!result) return
    if (await completePlacement(selected, listeningDiagnostic)) window.location.hash = `#${destination}`
  }

  function moveBetweenChoices(event: ReactKeyboardEvent<HTMLButtonElement>, choiceIndex: number) {
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? -1
        : 0
    if (!direction && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? question.choices.length - 1
        : (choiceIndex + direction + question.choices.length) % question.choices.length
    setSelected((answers) => ({ ...answers, [question.id]: nextIndex }))
    const group = event.currentTarget.closest('[role="radiogroup"]')
    group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
  }

  return (
    <main className="min-h-screen min-h-dvh bg-canvas text-primary">
      {/* Колонтитул выпуска: знак слева, служебная строка справа, двойная линейка под ними. */}
      <header className="rule-double">
        <div className="mx-auto flex w-full max-w-6xl items-center px-5 py-5 sm:px-8">
          <BrandMark />
        </div>
      </header>

      {phase === 'intro' && (
        <section className="sheet-in mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:pt-16">
          <div>
            <p className="section-kicker">Первый шаг</p>
            <h1 className="mt-4 max-w-3xl text-display font-light tracking-[-0.02em]">Сначала определим ваш рабочий уровень английского.</h1>
            <p className="mt-6 max-w-2xl text-lede text-secondary"><span className="numeral">32</span> коротких вопроса: грамматика, лексика, чтение и Use of English. По результату программа подберёт уроки и слова вашего уровня — без лишнего сложного материала.</p>
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              {INTRO_FACTS.map(([term, value]) => (
                <div key={term}>
                  <dt className="inspector-label">{term}</dt>
                  <dd className="numeral mt-1 text-sm text-primary">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-9 flex flex-wrap gap-3"><Button size="lg" onClick={startNewAttempt}>Начать диагностику <ArrowRight className="size-4" /></Button>{latestSelection && <Button size="lg" variant="secondary" onClick={reopenLatestProfile}>Открыть последний профиль</Button>}</div>
            {previousAttempts.length > 0 && <p className="mt-4 text-xs text-muted">Предыдущий результат: <span className="numeral">{previousAttempts[0].suggestedLevel}</span>. Новая попытка сохранится отдельно.</p>}
          </div>

          <Card level="leaf" className="p-6 sm:p-8">
            <p className="section-kicker">Что будет после</p>
            <ol className="mt-6 space-y-6">
              {AFTER_STEPS.map(([folio, title, text]) => (
                <li key={folio} className="flex gap-4">
                  <span className="numeral w-[2ch] flex-none pt-0.5 text-right text-xs text-muted">{folio}</span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-primary">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted">Это ориентир для программы, а не официальный экзамен на уровень.</p>
          </Card>
        </section>
      )}

      {phase === 'questions' && question && (
        <section className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
          {/* Колонцифра и строкомер: сколько листов набрано и сколько осталось. */}
          <div className="flex items-center justify-between gap-4">
            <span aria-live="polite" className="inspector-label">Вопрос <span className="numeral">{index + 1}</span> из <span className="numeral">{PLACEMENT_QUESTIONS.length}</span></span>
            <Badge tone="neutral"><span className="numeral">{question.level}</span> · {SKILL_LABELS[question.skill]}</Badge>
          </div>
          <Rule
            className="mt-3"
            value={index + 1}
            max={PLACEMENT_QUESTIONS.length}
            showFraction={false}
            progressbar
            ariaLabel="Прогресс диагностики"
          />

          {/* Единственное место экрана с перспективой: лист снимают со стопки. */}
          <div className="card-stage mt-8">
            <Card key={question.id} level="leaf" className="card-in p-5 sm:p-8">
              {question.context && <p lang="en" className="set-text reading-en reading-en-block mb-6 text-sm text-secondary">{question.context}</p>}
              <h1 id="placement-question" lang="en" className="reading-en reading-en-block text-readlg font-semibold text-primary">{question.prompt}</h1>

              <div role="radiogroup" aria-labelledby="placement-question" className="mt-8 grid gap-2.5">
                {question.choices.map((choice, choiceIndex) => {
                  const active = selected[question.id] === choiceIndex
                  return (
                    <button
                      key={choice}
                      lang="en"
                      data-testid={`placement-choice-${choiceIndex}`}
                      role="radio"
                      aria-checked={active}
                      tabIndex={active || (!answered && choiceIndex === 0) ? 0 : -1}
                      type="button"
                      onKeyDown={(event) => moveBetweenChoices(event, choiceIndex)}
                      onClick={() => setSelected((answers) => ({ ...answers, [question.id]: choiceIndex }))}
                      className={cn(
                        'reading-en detent flex min-h-tap items-center gap-4 rounded-[3px] border px-4 py-3 text-left text-read focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                        active
                          ? 'border-verified bg-verified-soft text-primary shadow-[var(--bevel-up)]'
                          : 'border-border bg-recess text-secondary shadow-[var(--bevel-down)] hover:text-primary',
                      )}
                    >
                      {/* Литера — клавиша наборной кассы, а не кружок. */}
                      <span className={cn(
                        'numeral grid size-7 shrink-0 place-items-center rounded-[2px] border text-xs',
                        active ? 'border-verified bg-verified text-ink' : 'border-border bg-elevated text-muted shadow-[var(--bevel-up)]',
                      )}>{active ? <Check className="size-4" aria-hidden="true" /> : String.fromCharCode(65 + choiceIndex)}</span>
                      {choice}
                    </button>
                  )
                })}
              </div>

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
                <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ArrowLeft className="size-4" /> Назад</Button>
                <Button data-testid="placement-next" disabled={!answered} onClick={next}>{index === PLACEMENT_QUESTIONS.length - 1 ? 'Получить результат' : 'Дальше'} <ArrowRight className="size-4" /></Button>
              </div>
            </Card>
          </div>
        </section>
      )}

      {phase === 'result' && result && (
        <section className="sheet-in mx-auto w-full max-w-5xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
          <Card level="leaf" className="p-6 sm:p-10">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="section-kicker">{reopenedAttemptId ? 'Сохранённая диагностика' : 'Диагностика завершена'}</p>
                <h1 className="mt-3 text-h1 font-light tracking-[-0.02em]">{result.foundationReview ? 'Сначала укрепим основы A2' : `Ваш рабочий диапазон: ${result.suggestedLevel}`}</h1>
                <p className="mt-4 text-body leading-7 text-secondary">{result.foundationReview ? 'В заданиях A2 пока много ошибок, поэтому начнём с основ.' : `Программа поведёт вас по уровню ${result.suggestedLevel} и начнёт с тем, где были ошибки.`} {result.weakestSkill ? <>Слабее всего сейчас: <strong className="text-primary">{SKILL_LABELS[result.weakestSkill]}</strong>.</> : 'Результат ровный по всем четырём областям.'}</p>
              </div>
              <Card level="recess" className="shrink-0 px-7 py-5 text-center">
                <p className="metric-value">{result.score}/{result.maxScore}</p>
                <p className="metric-label">правильных ответов</p>
              </Card>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              {LEVELS.map((level) => (
                <Card key={level} level="recess" className="p-4">
                  <span className="numeral block text-sm font-bold text-primary">{level}</span>
                  <Rule className="mt-3" value={result.bandScores[level].correct} max={result.bandScores[level].total} />
                </Card>
              ))}
            </div>

            <section aria-labelledby="skill-profile-title" className="mt-8 border-t border-border pt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="section-kicker">Профиль четырёх областей</p>
                  <h2 id="skill-profile-title" className="card-title">Сильные стороны и ближайший фокус</h2>
                </div>
                <Badge tone={result.diagnosticConfidence === 'moderate' ? 'teal' : 'amber'}>Точность оценки: {result.diagnosticConfidence === 'moderate' ? 'умеренная' : 'низкая'}</Badge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.entries(result.skillScores) as [PlacementSkill, PlacementResult['skillScores'][PlacementSkill]][]).map(([skill, score]) => (
                  <Card key={skill} level="recess" className="p-4">
                    <span className="block text-sm font-semibold text-primary">{SKILL_LABELS[skill]}</span>
                    {/* role="progressbar" + имя «грамматика: 7 из 8» + valuenow — контракт теста. */}
                    <Rule
                      className="mt-3"
                      value={score.correct}
                      max={score.total}
                      progressbar
                      ariaLabel={`${SKILL_LABELS[skill]}: ${score.correct} из ${score.total}`}
                    />
                    {skill === result.weakestSkill && <p className="mt-2 text-xs font-semibold text-amber">Ближайший фокус</p>}
                  </Card>
                ))}
              </div>
            </section>

            <p className="mt-8 rounded-[3px] border-l-2 border-rubric bg-recess px-5 py-4 text-sm leading-6 text-secondary shadow-[var(--bevel-down)]"><strong className="text-primary">Важно:</strong> это ориентир по <span className="numeral">32</span> заданиям, а не полный CEFR‑профиль — речь, письмо и понимание на слух он не оценивает.</p>

            {recommendedLessonIds.length > 0 && (
              <div className="mt-6">
                <p className="inspector-label">С чего начать</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendedLessonIds.slice(0, 5).map((lessonId) => (
                    <span key={lessonId} className="rounded-[2px] border border-border bg-elevated px-3 py-1.5 text-xs text-secondary shadow-[var(--bevel-up)]">{lessonTitles[lessonId] ?? lessonId}</span>
                  ))}
                </div>
              </div>
            )}

            {reopenedAttemptId
              ? listeningDiagnostic && <PlacementListeningPanel value={listeningDiagnostic} onComplete={setListeningDiagnostic} readOnly />
              : <PlacementListeningPanel value={listeningDiagnostic} onComplete={setListeningDiagnostic} />}

            {PLACEMENT_QUESTIONS.some((item) => selected[item.id] !== item.correctIndex) && (
              <details className="mt-6 rounded-[3px] border border-border bg-recess p-5 shadow-[var(--bevel-down)]">
                <summary className="min-h-tap cursor-pointer text-sm font-bold text-primary">Разобрать ошибки</summary>
                <div className="mt-4 space-y-5">
                  {PLACEMENT_QUESTIONS.filter((item) => selected[item.id] !== item.correctIndex).map((item) => (
                    <div key={item.id} className="border-t border-border pt-4 first:border-0 first:pt-0">
                      <p lang="en" className="reading-en reading-en-block text-sm font-semibold text-primary">{item.prompt}</p>
                      {/* Исправленная форма — законное место для рубрики: это правка редактора, а не отметка провала пользователя. */}
                      <p className="mt-1.5 text-xs text-secondary">Правильный ответ: <span lang="en" className="reading-en text-rubric [text-decoration-line:underline] [text-underline-offset:3px]">{item.choices[item.correctIndex]}</span></p>
                      <p className="mt-1.5 text-xs leading-5 text-muted">{item.explanation}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {reopenedAttemptId
              ? <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => { setReopenedAttemptId(undefined); setPhase('intro') }}>Закрыть профиль</Button><Button size="lg" onClick={startNewAttempt}>Пройти диагностику заново <ArrowRight className="size-4" /></Button></div>
              : <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={startNewAttempt}>Пройти заново</Button><Button variant="secondary" onClick={() => void saveResult('/diagnostics')}>Сохранить и проверить ещё 3 навыка</Button><Button size="lg" onClick={() => void saveResult()}>Создать мой учебный маршрут <ArrowRight className="size-4" /></Button></div>}
          </Card>
        </section>
      )}
    </main>
  )
}
