import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check, Maximize2, Minimize2, ShieldCheck, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonVariants'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { MarginNote } from '../components/ui/MarginNote'
import { Rule } from '../components/ui/Rule'
import { Textarea } from '../components/ui/Field'
import { cn } from '../lib/utils'
import { DUR, motionScale } from '../lib/motion'
import { missionConfigurationIsValid, missionRequirementsForLevel } from '../domain/mission'
import { activationRecognitionLabel, redactAcceptedForms } from '../domain/practice'
import type { Phrase } from '../domain/types'
import { detectMissionTargets, useForgeStore } from '../store/useForgeStore'

/**
 * ВЫНОСКА КОРРЕКТОРА — сигнатурный момент приложения.
 *
 * Правая колонка — не список карточек, а ПОЛЕ ПОЛОСЫ: стопка корректорских
 * слипов с чередующимся наклоном и римской колонцифрой. Найденная в черновике
 * цель отрабатывается тремя перекрывающимися тактами (settle / strike /
 * leader-draw), плюс перенабор счётчика в колонтитуле основной колонки.
 *
 * ГЕОМЕТРИЯ ВЫНОСКИ ФИКСИРОВАНА: линейка идёт от левого края слипа к краю
 * колонки текста на высоте самого слипа. Ни одного измерения текста внутри
 * <textarea> — ни Range.getBoundingClientRect, ни canvas.measureText, ни
 * mirror-div. Линия, уверенно указывающая на НЕ ТО слово, хуже отсутствия
 * линии.
 *
 * СЕКРЕТНОСТЬ — жёсткий инвариант: каноническая форма не попадает в DOM
 * нигде. Слип подписан только колонцифрой и редактированной подсказкой;
 * SVG-выноска несёт aria-hidden и ни одного текстового узла.
 */

const ROMAN: readonly string[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function folio(index: number): string {
  return ROMAN[index] ?? String(index + 1)
}

function redactTargetForms(value: string, targets: readonly Phrase[]): string {
  return targets.reduce(
    (redacted, phrase) => redactAcceptedForms(redacted, phrase.canonical, phrase.acceptedForms),
    value,
  )
}

function missionRetrievalCue(phrase: Phrase, targets: readonly Phrase[]): string {
  const meaning = redactTargetForms(activationRecognitionLabel(phrase), targets)
  if (/\p{L}|\p{N}/u.test(meaning)) return meaning
  const context = redactTargetForms(phrase.context, targets)
  if (/\p{L}|\p{N}/u.test(context)) return context
  return `Вспомните сохранённое выражение уровня ${phrase.cefr}.`
}

function contentLanguage(value: string): 'ru' | 'en' {
  return /\p{Script=Cyrillic}/u.test(value) ? 'ru' : 'en'
}

/** Штрих вычёркивания поверх колонцифры. Ни одного текстового узла. */
function StrikeMark({ animate }: { animate: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 16"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    >
      <path
        d="M3 11.5 C 11 9, 21 7, 29 4.5"
        fill="none"
        stroke="var(--rubric)"
        strokeWidth="1.75"
        strokeLinecap="round"
        className={animate ? 'strike-draw' : undefined}
        style={{ '--dash': 30 } as CSSProperties}
      />
    </svg>
  )
}

/**
 * Выносная волосяная линейка: от левого края слипа в жёлоб к краю колонки
 * текста, на высоте самого слипа. Заканчивается маленькой галкой.
 */
function LeaderRule({ animate }: { animate: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 22 16"
      preserveAspectRatio="none"
      className="pointer-events-none absolute right-full top-5 z-10 hidden h-4 w-[22px] xl:block"
    >
      <path
        d="M22 8 H 12"
        fill="none"
        stroke="var(--rubric)"
        strokeWidth="1"
        strokeLinecap="round"
        className={animate ? 'leader-draw' : undefined}
        style={{ '--dash': 10 } as CSSProperties}
      />
      <path
        d="M1.5 8.5 l 3.2 3.5 L 10 3.5"
        fill="none"
        stroke="var(--rubric)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animate ? 'leader-draw' : undefined}
        style={{ '--dash': 14 } as CSSProperties}
      />
    </svg>
  )
}

export function MissionPage() {
  const missions = useForgeStore((state) => state.missions)
  const phrases = useForgeStore((state) => state.phrases)
  const currentLevel = useForgeStore((state) => state.preferences.currentLevel)
  const updateDraft = useForgeStore((state) => state.updateMissionDraft)
  const completeMission = useForgeStore((state) => state.completeMission)
  const createSuggestedMission = useForgeStore((state) => state.createSuggestedMission)
  const deleteMission = useForgeStore((state) => state.deleteMission)
  const quarantinedDraft = missions.find((item) => item.legacyContract && item.status !== 'done')
  const activeMission = missions.find((item) => !item.legacyContract && item.status !== 'done' && item.level === currentLevel && missionConfigurationIsValid(item, phrases))
  const mission = activeMission ?? (quarantinedDraft ? undefined : missions.find((item) => !item.legacyContract && item.status === 'done' && item.level === currentLevel))
  const [error, setError] = useState('')
  const [selfConfirmed, setSelfConfirmed] = useState(false)
  const [immersed, setImmersed] = useState(false)
  const requirements = missionRequirementsForLevel(currentLevel)
  const targetPhrases = useMemo<Phrase[]>(() => mission?.targetPhraseIds
    .map((id) => phrases.find((phrase) => phrase.id === id))
    .filter((phrase): phrase is Phrase => Boolean(phrase)) ?? [], [mission, phrases])
  const detected = mission ? detectMissionTargets(mission, phrases, mission.draft) : []

  const confirmed = detected

  // Такты выноски. Никаких transitionend/animationend — только setTimeout на
  // авторскую длительность, умноженную на motionScale().
  const detectedKey = detected.join('|')
  const previousDetected = useRef<string[] | null>(null)
  const [flashing, setFlashing] = useState<readonly string[]>([])
  // Каждая волна детекта живёт своим таймером. Общий таймер сбрасывался бы на
  // каждой новой цели и обрывал партитуру предыдущего слипа посреди такта.
  const flashTimers = useRef<number[]>([])

  useEffect(() => () => {
    flashTimers.current.forEach((timer) => window.clearTimeout(timer))
    flashTimers.current = []
  }, [])

  useEffect(() => {
    const current = detectedKey ? detectedKey.split('|') : []
    const previous = previousDetected.current
    previousDetected.current = current
    if (previous === null) return
    const added = current.filter((id) => !previous.includes(id))
    if (added.length === 0) return
    setFlashing((active) => [...active, ...added.filter((id) => !active.includes(id))])
    const timer = window.setTimeout(() => {
      setFlashing((active) => active.filter((id) => !added.includes(id)))
      flashTimers.current = flashTimers.current.filter((item) => item !== timer)
    }, (DUR.leader + 220) * motionScale())
    flashTimers.current.push(timer)
  }, [detectedKey])

  if (!mission && quarantinedDraft) return (
    <Card className="mx-auto max-w-3xl">
      <CardBody className="space-y-5 p-6 sm:p-8">
        <Badge tone="amber">Сохранённый черновик</Badge>
        <div>
          <h2 className="text-h2 font-light tracking-tight text-primary">Старое задание сохранено только для чтения.</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">Его условия больше не соответствуют текущему уровню или карточкам. Текст не удалён и не засчитывается как новое учебное свидетельство.</p>
        </div>
        <div className="rounded-[3px] bg-recess p-4 shadow-[var(--bevel-down)]">
          <p className="text-sm font-semibold text-primary">{quarantinedDraft.title}</p>
          <p lang="en" className="reading-en reading-en-block mt-3 whitespace-pre-wrap text-sm text-secondary">{quarantinedDraft.draft || 'Черновик был пуст.'}</p>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { if (!createSuggestedMission()) setError('Сначала изучите нужное количество выражений текущего уровня.') }}>Создать новое задание уровня {currentLevel}</Button>
          <Button variant="secondary" onClick={() => { if (window.confirm('Удалить этот сохранённый черновик без возможности восстановления?')) deleteMission(quarantinedDraft.id) }}><Trash2 className="size-4" /> Удалить черновик</Button>
        </div>
      </CardBody>
    </Card>
  )

  if (!mission) return (
    <Card className="mx-auto max-w-3xl">
      <CardBody className="empty-state py-16">
        <p className="section-kicker">Задание на перенос</p>
        <div>
          <h2 className="text-h2 font-light tracking-tight text-primary">Задание на перенос пока не создано.</h2>
          <p className="mt-2 text-sm text-muted">Сначала выполните практический шаг минимум с {requirements.minTargetPhrases} {requirements.minTargetPhrases === 1 ? 'выражением' : 'выражениями'} уровня {currentLevel}, затем создайте задание.</p>
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </div>
        <Button onClick={() => { if (!createSuggestedMission()) setError('Сначала изучите нужное количество выражений текущего уровня.') }}>Создать задание</Button>
      </CardBody>
    </Card>
  )

  if (mission.status === 'done') return <CompletedMission mission={mission} phrases={phrases} onCreate={() => createSuggestedMission()} onDelete={() => deleteMission(mission.id)} />

  const words = mission.draft.trim() ? mission.draft.trim().split(/\s+/).length : 0
  const safeTitle = redactTargetForms(mission.title, targetPhrases)
  const safePrompt = redactTargetForms(mission.prompt, targetPhrases)
  const safeGrammarTarget = mission.grammarTarget ? redactTargetForms(mission.grammarTarget, targetPhrases) : undefined
  const wordsOutOfRange = words > 0 && (words < mission.minWords || words > mission.maxWords)

  function finish() {
    if (!mission) return
    if (words < mission.minWords || words > mission.maxWords) { setError(`Нужен законченный ответ объёмом от ${mission.minWords} до ${mission.maxWords} слов.`); return }
    if (!selfConfirmed) { setError('Подтвердите, что ответ осмысленный, завершённый и использует выражения в новом контексте.'); return }
    if (!completeMission(mission.id, confirmed, selfConfirmed)) { setError(`Используйте все целевые выражения (${mission.targetPhraseCount}) в связном ответе без механических повторов и попробуйте снова.`); return }
    setError('')
  }

  return (
    <div className={cn('grid gap-6', !immersed && 'xl:grid-cols-[minmax(0,1fr)_360px]')}>
      <Card className={cn('overflow-visible border-border-strong', immersed && 'mx-auto w-full max-w-4xl')}>
        {/* ШАПКА ПОЛОСЫ — рубрика, объём, число целей, затем сам бриф. */}
        <div className="border-b border-border p-6 shadow-[0_1px_0_var(--paper-hi)] sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className="section-kicker">Задание на перенос</p>
            <span aria-hidden="true" className="h-px flex-1 border-b border-dotted border-border" />
            <Badge tone="neutral">{mission.minWords}–{mission.maxWords} слов</Badge>
            <Badge tone="neutral">Целевых выражений: {mission.targetPhraseCount}</Badge>
          </div>
          <h2 lang="en" className="reading-en reading-en-block mt-5 text-readlg font-normal tracking-tight text-primary">{safeTitle}</h2>
          <p lang="en" className="reading-en reading-en-block set-text mt-4 text-sm text-secondary">{safePrompt}</p>
        </div>

        <CardBody className="space-y-5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="mission-response" className="text-sm font-semibold text-primary">Ваш ответ</label>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className={cn('numeral', wordsOutOfRange && 'text-amber')}>{words} слов</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setImmersed((value) => !value)}
              >
                {immersed ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                {immersed ? 'Выйти из погружения' : 'Режим погружения'}
              </Button>
            </div>
          </div>
          <p id="mission-writing-hint" className="text-xs leading-5 text-muted">Сначала напишите ответ, не подглядывая в формулировки; затем проверьте ясность и форму.</p>
          <Textarea
            id="mission-response"
            lang="en"
            value={mission.draft}
            onChange={(event) => { updateDraft(mission.id, event.target.value); setSelfConfirmed(false); setError('') }}
            className={cn('reading-en min-h-[360px] text-read', immersed && 'reading-en-block min-h-[560px]')}
            aria-describedby={error ? 'mission-writing-hint mission-error' : 'mission-writing-hint'}
          />

          {/* КОЛОНТИТУЛ ОСНОВНОЙ КОЛОНКИ — сюда перенабирается счётчик. */}
          <div
            aria-live="polite"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
          >
            <span className="inspector-label">Подтверждено в черновике</span>
            <span
              key={`${confirmed.length}-${targetPhrases.length}`}
              className={cn('numeral text-sm text-teal', flashing.length > 0 && 'typeset')}
            >
              {confirmed.length}/{targetPhrases.length}
            </span>
          </div>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[3px] bg-recess p-3 text-sm leading-5 text-secondary shadow-[var(--bevel-down)]">
            <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-verified)]" checked={selfConfirmed} onChange={(event) => setSelfConfirmed(event.target.checked)} />
            <span>Я перечитал(а) ответ: он осмысленный и завершённый, а целевые выражения использованы естественно в новом контексте.</span>
          </label>
          {error && <p id="mission-error" role="alert" className="text-sm text-danger">{error}</p>}

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-5 text-muted">Целевые формы скрыты до завершения. Засчитываются только выражения, которые приложение действительно находит в тексте; это одно продуктивное свидетельство, а не автоматическое освоение.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { if (window.confirm('Удалить это задание и его черновик без возможности восстановления?')) deleteMission(mission.id) }}><Trash2 className="size-4" /> Удалить</Button>
              <Button onClick={finish}>Завершить задание <Check className="size-4" /></Button>
            </div>
          </div>
          <MarginNote className="flex items-center gap-1.5 xl:mt-2 xl:max-w-none xl:[transform:none]">
            <ShieldCheck className="size-3.5 text-teal" aria-hidden="true" /> Черновик сохранён локально
          </MarginNote>
        </CardBody>
      </Card>

      {/* ПОЛЕ ПОЛОСЫ — стопка корректорских слипов. */}
      {!immersed && (
        <aside className="space-y-6 xl:sticky xl:top-[104px] xl:self-start">
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="section-kicker">Целевые выражения</p>
                <h2 className="card-title">Вспомните по смыслу: <span className="numeral">{targetPhrases.length}</span></h2>
              </div>
              <Rule value={confirmed.length} max={targetPhrases.length} showFraction={false} className="w-20 shrink-0 pb-1.5" />
            </div>

            <div className="stagger mt-4 space-y-3">
              {targetPhrases.map((phrase, index) => {
                const cue = missionRetrievalCue(phrase, targetPhrases)
                const language = contentLanguage(cue)
                const found = confirmed.includes(phrase.id)
                const animate = flashing.includes(phrase.id)
                const turn = index % 2 === 1 ? '0.28deg' : '-0.35deg'
                return (
                  <Card
                    key={phrase.id}
                    level="slip"
                    className={cn(
                      'relative px-4 py-3.5',
                      animate && 'settle',
                      found && 'border-verified/45',
                    )}
                    style={{
                      '--i': index,
                      '--slip-turn': turn,
                      // .stagger задерживает ЛЮБУЮ анимацию слипа на --i * 40ms.
                      // Для входа это партитура, для settle — рассинхрон с
                      // strike/leader-draw на вложенных SVG, которые задержки не
                      // знают. На время такта детекта задержку снимаем.
                      ...(animate ? { animationDelay: '0ms' } : null),
                      // Найденный слип прижимается к листу: --lift-2 → --lift-1.
                      ...(found
                        ? { transform: 'rotate(0deg)', background: 'var(--verified-soft)', boxShadow: 'var(--lift-1)' }
                        : null),
                    } as CSSProperties}
                  >
                    {found && <LeaderRule animate={animate} />}
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'numeral relative mt-0.5 grid h-4 w-8 shrink-0 place-items-center text-micro font-bold tracking-[0.08em]',
                          found ? 'text-secondary' : 'text-muted',
                        )}
                      >
                        {folio(index)}
                        {found && <StrikeMark animate={animate} />}
                      </span>
                      <div className="min-w-0">
                        {/* Колонцифра — графика, поэтому aria-hidden. Порядковый
                            номер цели скринридер получает отсюда. */}
                        <span className="sr-only">Цель {index + 1}</span>
                        <p
                          lang={language}
                          className={cn(
                            'text-sm leading-6',
                            language === 'en' && 'reading-en',
                            found ? 'text-primary' : 'text-muted',
                          )}
                        >
                          {cue}
                        </p>
                        {found && <span className="mt-2 inline-block text-micro font-semibold text-teal">Найдено в черновике</span>}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {safeGrammarTarget && (
            <Card>
              <CardHeader>
                <div>
                  <p className="section-kicker">Грамматический фокус</p>
                  <h2 className="card-title">Одно главное ограничение</h2>
                </div>
              </CardHeader>
              <CardBody>
                <p lang="en" className="reading-en text-sm text-secondary">{safeGrammarTarget}</p>
              </CardBody>
            </Card>
          )}
        </aside>
      )}
    </div>
  )
}

function CompletedMission({ mission, phrases, onCreate, onDelete }: { mission: ReturnType<typeof useForgeStore.getState>['missions'][number]; phrases: ReturnType<typeof useForgeStore.getState>['phrases']; onCreate: () => void; onDelete: () => void }) {
  const used = mission.targetResults.filter((target) => target.confirmed)
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardBody className="p-6 sm:p-8">
          <p className="section-kicker">Задание завершено</p>
          <h2 className="mt-2 text-h1 font-light tracking-tight text-primary">
            Выражений перенесено в новый контекст: <span className="numeral">{used.length}</span>.
          </h2>
          <p className="mt-3 text-sm leading-6 text-secondary">Одно употребление — свидетельство, а не освоение. Эти выражения вернутся в отложенном вспоминании и другом контексте.</p>

          <Rule value={used.length} max={mission.targetResults.length} className="mt-5 max-w-56" />

          <div className="mt-6 rounded-[3px] bg-recess p-5 shadow-[var(--bevel-down)]">
            <p className="inspector-label">Сохранённый ответ</p>
            <p lang="en" className="reading-en reading-en-block mt-3 whitespace-pre-wrap text-sm text-secondary">{mission.response}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {mission.targetResults.map((target) => {
              const phrase = phrases.find((item) => item.id === target.phraseId)
              return phrase ? <Badge key={target.phraseId} tone={target.confirmed ? 'positive' : 'neutral'}>{target.confirmed ? 'Использовано' : 'Не найдено'} · <span lang="en" className="reading-en">{phrase.canonical}</span></Badge> : null
            })}
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <Button onClick={onCreate}>Создать следующее задание</Button>
            <Link to="/progress" className={buttonClass({ variant: 'secondary' })}>Открыть прогресс</Link>
            <Button variant="secondary" onClick={() => { if (window.confirm('Удалить завершённое задание и его свидетельство без возможности восстановления?')) onDelete() }}><Trash2 className="size-4" /> Удалить</Button>
            <Link to="/" className={buttonClass({ variant: 'ghost' })}>На главную</Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
