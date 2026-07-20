import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Headphones, RotateCcw, Volume2 } from 'lucide-react'
import { PLACEMENT_LISTENING_PROMPTS } from '../data/listeningPromptBank'
import {
  derivePlacementListeningResult,
  type PlacementListeningAnswer,
  type PlacementListeningDiagnostic,
} from '../domain/placementListening'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Textarea } from './ui/Field'
import { Rule } from './ui/Rule'

/**
 * Дополнительный блок аудирования — вкладыш к основному оттиску.
 *
 * ПЕРЕПИСАНО ТОЛЬКО ПРЕДСТАВЛЕНИЕ. Роуминг-radiogroup собран вручную
 * (role="radio", управляемый tabindex 0/-1, aria-checked, ArrowDown/End,
 * choiceRefs) и МЕНЯТЬ ЕГО НЕЛЬЗЯ: ни на нативные <input type="radio">, ни на
 * Radix. PlacementListeningPanel.test.tsx проверяет ровно эту механику —
 * порядок фокуса, значения tabindex и aria-checked после ArrowDown и End.
 * Точно так же неприкосновенны имена кнопок «Начать listening» /
 * «Прослушать полностью», role="status" у сообщения в неактивном состоянии и
 * строка про неразрывный дефис «CEFR‑результат».
 */

interface PlacementListeningPanelProps {
  value?: PlacementListeningDiagnostic
  onComplete: (diagnostic: PlacementListeningDiagnostic) => void
  readOnly?: boolean
}

function speechIsAvailable(): boolean {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function PlacementListeningPanel({ value, onComplete, readOnly = false }: PlacementListeningPanelProps) {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<PlacementListeningAnswer[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>()
  const [dictation, setDictation] = useState('')
  const choiceRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [playbackCompleted, setPlaybackCompleted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [replayCount, setReplayCount] = useState(0)
  const [message, setMessage] = useState('')
  const prompt = PLACEMENT_LISTENING_PROMPTS[index]
  const result = useMemo(() => value ? derivePlacementListeningResult(value) : null, [value])

  useEffect(() => () => {
    if (speechIsAvailable()) window.speechSynthesis.cancel()
  }, [])

  function resetPrompt(nextIndex: number) {
    setIndex(nextIndex)
    setSelectedIndex(undefined)
    setDictation('')
    setPlaybackCompleted(false)
    setPlaying(false)
    setReplayCount(0)
    setMessage('')
  }

  function start() {
    if (!speechIsAvailable()) {
      setMessage('На этом Mac недоступен системный синтез речи. Listening-блок можно пропустить без изменения результата.')
      return
    }
    setActive(true)
    resetPrompt(0)
    setAnswers([])
  }

  function play() {
    if (!prompt || playing || !speechIsAvailable()) return
    const isReplay = playbackCompleted
    if (isReplay && replayCount >= 5) {
      setMessage('Доступно не больше пяти повторов одного фрагмента.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(prompt.text)
    utterance.lang = 'en-GB'
    utterance.rate = 0.92
    utterance.onend = () => {
      setPlaying(false)
      setPlaybackCompleted(true)
      setMessage('Аудио завершилось. Теперь ответьте по смыслу и запишите услышанное.')
    }
    utterance.onerror = () => {
      setPlaying(false)
      setMessage('Системный голос не смог воспроизвести фрагмент. Этот дополнительный блок можно пропустить.')
    }
    if (isReplay) setReplayCount((count) => count + 1)
    setPlaying(true)
    setMessage('Слушайте до конца: текст останется скрытым.')
    window.speechSynthesis.speak(utterance)
  }

  function saveAnswer() {
    if (!prompt || !playbackCompleted || selectedIndex === undefined || !dictation.trim()) return
    const nextAnswers = [...answers, {
      promptId: prompt.id,
      selectedIndex,
      dictation: dictation.trim(),
      playbackCompleted: true,
      replayCount,
    }]
    if (index < PLACEMENT_LISTENING_PROMPTS.length - 1) {
      setAnswers(nextAnswers)
      resetPrompt(index + 1)
      return
    }
    const diagnostic: PlacementListeningDiagnostic = {
      evidenceVersion: 1,
      promptSetVersion: 1,
      answers: nextAnswers,
      completedAt: new Date().toISOString(),
    }
    onComplete(diagnostic)
    setActive(false)
  }

  function moveChoice(current: number, key: string) {
    const last = prompt.choices.length - 1
    const next = key === 'Home' ? 0
      : key === 'End' ? last
        : key === 'ArrowRight' || key === 'ArrowDown' ? (current + 1) % prompt.choices.length
          : key === 'ArrowLeft' || key === 'ArrowUp' ? (current - 1 + prompt.choices.length) % prompt.choices.length
            : undefined
    if (next === undefined) return
    setSelectedIndex(next)
    choiceRefs.current[next]?.focus()
  }

  if (value && result && !active) {
    return (
      <section aria-labelledby="placement-listening-title" className="mt-6">
        <Card level="slip" className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="section-kicker">Дополнительный listening</p>
              <h2 id="placement-listening-title" className="card-title">Профиль сохранён отдельно от уровня</h2>
              {/* Абзац НАМЕРЕННО плоский: getNodeText в testing-library склеивает только
                  ПРЯМЫЕ текстовые узлы, поэтому обёртка дробей в <span className="numeral">
                  разорвала бы строку и уронила getByText(/Понимание смысла: 8\/8/). */}
              <p className="mt-2 max-w-2xl text-xs leading-5 text-secondary">Понимание смысла: {result.comprehension.correct}/{result.comprehension.total}. Точный диктант: {result.dictation.matched}/{result.dictation.total}; средняя точность слов {Math.round(result.dictation.averageWordAccuracy * 100)}%. Данные сохранены для самостоятельного сравнения и не меняют основной CEFR‑результат или учебный маршрут.</p>
            </div>
            {!readOnly && <Button variant="ghost" size="sm" className="shrink-0" onClick={start}><RotateCcw className="size-4" /> Пройти снова</Button>}
          </div>
        </Card>
      </section>
    )
  }

  if (!active) {
    return (
      <section aria-labelledby="placement-listening-title" className="mt-6">
        <Card level="recess" className="p-5">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-[2px] border border-border bg-elevated text-secondary shadow-[var(--bevel-up)]"><Headphones className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="inspector-label">Необязательно · около 6 минут</p>
              <h2 id="placement-listening-title" className="card-title">Добавить короткий listening‑профиль</h2>
              <p className="mt-2 text-xs leading-5 text-secondary">Восемь фрагментов системного голоса: по два A2–C1. После полного прослушивания — вопрос по смыслу и диктант. Основной результат {value ? 'останется' : 'уже рассчитан и останется'} без изменений.</p>
              <Button variant="secondary" className="mt-4" onClick={start}><Headphones className="size-4" /> Начать listening</Button>
              {message && <p role="status" className="mt-3 text-xs leading-5 text-amber">{message}</p>}
            </div>
          </div>
        </Card>
      </section>
    )
  }

  return (
    <section aria-labelledby="placement-listening-question" className="mt-6">
      <Card level="leaf" className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-kicker">Listening <span className="numeral">{index + 1}</span> из <span className="numeral">{PLACEMENT_LISTENING_PROMPTS.length}</span></p>
            <h2 id="placement-listening-question" className="card-title"><span className="numeral">{prompt.level}</span> · текст скрыт</h2>
          </div>
          <span className="numeral shrink-0 text-xs text-muted">повторы {replayCount}/5</span>
        </div>

        <Rule
          className="mt-4"
          value={index + 1}
          max={PLACEMENT_LISTENING_PROMPTS.length}
          showFraction={false}
          progressbar
          ariaLabel="Прогресс listening-диагностики"
        />

        <Button className="mt-5" variant="secondary" disabled={playing || (playbackCompleted && replayCount >= 5)} onClick={play}><Volume2 className="size-4" /> {playing ? 'Воспроизводится…' : playbackCompleted ? 'Прослушать ещё раз' : 'Прослушать полностью'}</Button>
        <p aria-live="polite" className="mt-3 text-xs leading-5 text-muted">{message || 'Вопрос и поле диктанта откроются только после окончания аудио.'}</p>

        {playbackCompleted && (
          <div className="mt-6 space-y-6 border-t border-border pt-6">
            {/* Роуминг-radiogroup. Разметка ниже — контракт теста, см. шапку файла. */}
            <fieldset role="radiogroup" aria-labelledby="placement-listening-comprehension">
              <legend id="placement-listening-comprehension" lang="en" className="reading-en reading-en-block text-read font-semibold text-primary">{prompt.question}</legend>
              <div className="mt-3 grid gap-2">
                {prompt.choices.map((choice, choiceIndex) => (
                  <button
                    key={choice}
                    ref={(element) => { choiceRefs.current[choiceIndex] = element }}
                    type="button"
                    role="radio"
                    aria-checked={selectedIndex === choiceIndex}
                    tabIndex={selectedIndex === choiceIndex || (selectedIndex === undefined && choiceIndex === 0) ? 0 : -1}
                    lang="en"
                    onKeyDown={(event) => { if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); moveChoice(choiceIndex, event.key) } }}
                    onClick={() => setSelectedIndex(choiceIndex)}
                    className={cn(
                      'reading-en detent flex min-h-tap items-center gap-3 rounded-[3px] border px-4 py-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      selectedIndex === choiceIndex
                        ? 'border-verified bg-verified-soft text-primary shadow-[var(--bevel-up)]'
                        : 'border-border bg-recess text-secondary shadow-[var(--bevel-down)] hover:text-primary',
                    )}
                  >
                    <span className={cn(
                      'numeral grid size-6 shrink-0 place-items-center rounded-[2px] border text-[10px]',
                      selectedIndex === choiceIndex ? 'border-verified bg-verified text-ink' : 'border-border bg-elevated text-muted shadow-[var(--bevel-up)]',
                    )}>{selectedIndex === choiceIndex ? <Check className="size-3.5" aria-hidden="true" /> : String.fromCharCode(65 + choiceIndex)}</span>
                    {choice}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-semibold text-primary">Запишите всё, что услышали<Textarea lang="en" value={dictation} onChange={(event) => setDictation(event.target.value.slice(0, 2_000))} rows={3} className="reading-en mt-2 min-h-24 font-normal" autoComplete="off" spellCheck={false} /></label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => { window.speechSynthesis.cancel(); setActive(false) }}>Пропустить блок</Button>
              <Button disabled={selectedIndex === undefined || !dictation.trim()} onClick={saveAnswer}>{index === PLACEMENT_LISTENING_PROMPTS.length - 1 ? 'Завершить listening' : 'Следующий фрагмент'} <Check className="size-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  )
}
