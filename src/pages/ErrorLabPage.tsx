import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Pencil, Plus, ShieldQuestion } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Diff } from '../components/ui/Diff'
import { Input, Select, Textarea } from '../components/ui/Field'
import { MarginNote } from '../components/ui/MarginNote'
import { Stamp } from '../components/ui/Stamp'
import { normalizePhrase } from '../domain/normalization'
import type { ErrorPattern } from '../domain/types'
import { useForgeStore } from '../store/useForgeStore'

const statusLabels: Record<ErrorPattern['status'], string> = {
  observed: 'Наблюдение',
  active: 'Активно',
  improving: 'Улучшается',
  resolved: 'Закреплено',
}

const categoryLabels: Record<ErrorPattern['category'], string> = {
  other: 'Другое',
  articles: 'Артикли',
  prepositions: 'Предлоги',
  tense_aspect: 'Время и вид',
  word_order: 'Порядок слов',
  collocation: 'Сочетаемость',
  register: 'Регистр',
}

const retryHints: Record<ErrorPattern['category'], string> = {
  other: 'Сравните структуру предложения с правилом и попробуйте ещё раз.',
  articles: 'Проверьте, нужен ли здесь артикль и какой именно.',
  prepositions: 'Проверьте предлог, которым управляет это слово.',
  tense_aspect: 'Проверьте форму глагола, время и вид.',
  word_order: 'Проверьте порядок слов во всём предложении.',
  collocation: 'Проверьте устойчивое сочетание слов.',
  register: 'Проверьте, подходит ли выражение к этому регистру.',
}

function formatRelativeDueRu(value: string, now = new Date()): string {
  const difference = new Date(value).getTime() - now.getTime()
  if (difference <= 0) return 'сейчас'
  if (difference < 60_000) return `через ${Math.ceil(difference / 1_000)} с`
  if (difference < 3_600_000) return `через ${Math.ceil(difference / 60_000)} мин`
  const hours = Math.ceil(difference / 3_600_000)
  const formatter = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' })
  if (hours < 24) return formatter.format(hours, 'hour')
  return formatter.format(Math.ceil(hours / 24), 'day')
}

function nextClockRefreshDelay(dueAt: number, now: number): number | undefined {
  const difference = dueAt - now
  if (!Number.isFinite(difference) || difference <= 0) return undefined
  const precision = difference <= 60_000
    ? 1_000
    : difference < 3_600_000
      ? 60_000
      : difference < 86_400_000
        ? 3_600_000
        : 86_400_000
  const untilDisplayBoundary = difference % precision || precision
  return Math.min(difference, untilDisplayBoundary)
}

function localizeAddError(error?: string): string {
  if (error === 'Add both the original and corrected sentence.') return 'Добавьте исходное и исправленное предложения.'
  if (error === 'Add a distinct new-context prompt and its accepted transfer answer.') return 'Добавьте отдельное задание для нового контекста и принятый ответ.'
  if (error === 'The transfer must use a genuinely different sentence.') return 'Для переноса нужно действительно другое предложение.'
  return 'Не удалось сохранить паттерн. Проверьте обязательные поля.'
}

export function ErrorLabPage() {
  const errors = useForgeStore((state) => state.errors)
  const recordAttempt = useForgeStore((state) => state.recordErrorAttempt)
  const addError = useForgeStore((state) => state.addError)
  const updateError = useForgeStore((state) => state.updateError)
  const [selectedId, setSelectedId] = useState(errors[0]?.id)
  const [adding, setAdding] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const selected = errors.find((error) => error.id === selectedId) ?? errors[0]
  const needsAttention = errors.filter((error) => error.status === 'active' || error.status === 'observed').length
  const improving = errors.filter((error) => error.status === 'improving').length
  const stable = errors.filter((error) => error.status === 'resolved').length

  useEffect(() => {
    let timerId: number | undefined
    let cancelled = false
    // Store mutations can add a due-now pattern after this page has been idle.
    // Synchronize the render clock once per errors revision before deciding
    // whether any future display boundary needs a timer.
    setNow(Date.now())
    const scheduleNextRefresh = () => {
      const snapshot = Date.now()
      const nextDelay = errors.reduce<number | undefined>((nearest, error) => {
        const delay = nextClockRefreshDelay(new Date(error.dueAt).getTime(), snapshot)
        if (delay === undefined) return nearest
        return nearest === undefined ? delay : Math.min(nearest, delay)
      }, undefined)
      if (nextDelay === undefined || cancelled) return
      timerId = window.setTimeout(() => {
        if (cancelled) return
        setNow(Date.now())
        scheduleNextRefresh()
      }, Math.max(1, nextDelay))
    }
    scheduleNextRefresh()
    return () => {
      cancelled = true
      if (timerId !== undefined) window.clearTimeout(timerId)
    }
  }, [errors])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="section-kicker">Корректурный лист</p>
        <Button variant="secondary" aria-expanded={adding} onClick={() => setAdding((value) => !value)}>
          <Plus className="size-4" /> Добавить личный паттерн
        </Button>
      </div>

      {adding && (
        <AddErrorForm
          onCancel={() => setAdding(false)}
          onAdd={(input) => {
            const result = addError(input)
            if (result.id) { setSelectedId(result.id); setAdding(false) }
            return result
          }}
        />
      )}

      {/* Три отдельные карточки сжаты в одну врезку: вертикаль отдана работе. */}
      <Card level="recess" className="flex flex-wrap items-stretch divide-y divide-border sm:divide-x sm:divide-y-0">
        <Tally label="Нужно внимание" value={needsAttention} detail="активные паттерны" />
        <Tally label="Улучшается" value={improving} detail="ошибки повторяются реже" />
        <Tally label="Закреплено" value={stable} detail="пройден отложенный перенос" />
      </Card>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <p className="section-kicker">Очередь паттернов</p>
              <h2 className="card-title">Свидетельства из вашей практики</h2>
            </div>
            <Badge tone="neutral">Паттернов: {errors.length}</Badge>
          </CardHeader>
          {errors.length ? (
            <ol className="stagger divide-y divide-border">
              {errors.map((error, index) => (
                <li key={error.id} style={{ '--i': index } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(error.id)}
                    aria-label={`Открыть паттерн: ${error.label}`}
                    aria-current={selected?.id === error.id ? 'true' : undefined}
                    className={`relative flex w-full items-baseline gap-4 px-5 py-4 text-left transition-colors hover:bg-elevated ${selected?.id === error.id ? 'bg-elevated' : ''}`}
                  >
                    {selected?.id === error.id && (
                      <span aria-hidden="true" className="absolute inset-y-3 left-0 w-[3px] rounded-[1px] bg-rubric" />
                    )}
                    <span className="numeral w-[2.5ch] flex-none text-right text-xs text-muted">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-primary">{error.label}</span>
                      <span lang="en" className="reading-en mt-1 block truncate text-xs text-muted">{error.original}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{categoryLabels[error.category]}</Badge>
                        <span className="text-xs text-muted">Повторов: <span className="numeral">{error.occurrences}</span></span>
                      </span>
                    </span>
                    <span className="numeral flex-none whitespace-nowrap text-xs text-secondary">
                      {formatRelativeDueRu(error.dueAt, new Date(now))}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <CardBody className="empty-state py-16">
              <div>
                <h2 className="text-xl font-light text-primary">Повторяющихся паттернов пока нет.</h2>
                <p className="mt-2 text-sm text-muted">Добавьте пример из своей письменной практики, чтобы запустить цикл исправления.</p>
              </div>
            </CardBody>
          )}
        </Card>
        {selected && (
          <ErrorWorkbench
            key={selected.id}
            error={selected}
            now={now}
            onAttempt={(response, correct, supportUsed, transfer) => recordAttempt(selected.id, response, correct, supportUsed, transfer)}
            onUpdate={(patch) => updateError(selected.id, patch)}
          />
        )}
      </section>
    </div>
  )
}

function Tally({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="min-w-0 flex-1 basis-48 px-5 py-4">
      <p className="metric-value numeral">{value}</p>
      <p className="metric-label">{label}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  )
}

function ErrorWorkbench({ error, now, onAttempt, onUpdate }: { error: ErrorPattern; now: number; onAttempt: (response: string, correct: boolean, supportUsed: boolean, transfer: boolean) => void; onUpdate: (patch: Partial<ErrorPattern>) => void }) {
  const [response, setResponse] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [message, setMessage] = useState('')
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [supportUsed, setSupportUsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [correction, setCorrection] = useState(error.correction)

  useEffect(() => { setResponse(''); setAttempts(0); setMessage(''); setSolved(false); setRevealed(false); setSupportUsed(false); setEditing(false); setCorrection(error.correction) }, [error.id, error.correction])

  const transferMode = error.status === 'improving' && Boolean(error.transferPrompt && error.transferAnswer)
  const transferReady = new Date(error.dueAt).getTime() <= now
  const wasTransferReady = useRef(transferReady)
  const prompt = (transferMode ? error.transferPrompt : error.original) ?? error.original
  const expected = transferMode ? error.transferAnswer! : error.correction
  const showAccepted = revealed || solved

  useEffect(() => {
    if (!wasTransferReady.current && transferReady) {
      // Feedback from the failed attempt is no longer available when the
      // delayed retry opens; otherwise the nominally independent response is
      // still supported by the rule/message left on screen.
      setResponse('')
      setAttempts(0)
      setMessage('')
      setSolved(false)
      setRevealed(false)
      setSupportUsed(false)
    }
    wasTransferReady.current = transferReady
  }, [transferReady])

  function check() {
    if (!response.trim() || !transferReady) return
    const correct = normalizePhrase(response) === normalizePhrase(expected)
    onAttempt(response, correct, supportUsed, transferMode)
    if (correct) { setSolved(true); setMessage(supportUsed ? 'Верно с подсказкой. Задание скоро вернётся для самостоятельной попытки.' : transferMode ? 'Отложенный перенос принят. Паттерн закреплён.' : 'Исправление принято. Две самостоятельные попытки подряд откроют отложенный новый контекст.') }
    else { setAttempts((value) => value + 1); setSupportUsed(true); setMessage(attempts === 0 ? retryHints[error.category] : 'Пока неверно. Сравните структуру и попробуйте ещё раз.'); setResponse('') }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="section-kicker">Мастерская самоисправления</p>
          <h2 className="card-title">{error.label}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={error.status === 'resolved' ? 'positive' : error.status === 'improving' ? 'teal' : 'amber'}>{statusLabels[error.status]}</Badge>
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-label="Изменить принятый вариант"
            aria-expanded={editing}
            className="grid size-9 place-items-center rounded-[3px] text-muted transition-colors hover:bg-elevated hover:text-primary"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      </CardHeader>

      <CardBody className="space-y-6">
        {/* Оттиск: одна врезка, в которой правка проступает ФОРМОЙ — зачёркивание
            против подчёркивания, а не оттенком. */}
        <div>
          <p className="inspector-label">{transferMode ? 'Перенос в новый контекст' : 'Пример ошибки'}</p>
          <Card level="recess" className="mt-2 px-4 py-4">
            <p className="inspector-label">{showAccepted ? 'Правка' : 'Задание'}</p>
            {showAccepted
              ? <Diff className="mt-2" before={prompt} after={expected} />
              : <p lang="en" className="reading-en mt-2 text-base text-primary">{prompt}</p>}
          </Card>
        </div>

        {editing && (
          <div className="rounded-[3px] border border-verified/30 bg-verified-soft p-4">
            <label htmlFor="canonical-correction" className="mb-2 block text-sm font-medium text-primary">Принятый вариант</label>
            <div className="flex gap-2">
              <Input id="canonical-correction" lang="en" className="reading-en" value={correction} onChange={(event) => setCorrection(event.target.value)} />
              <Button onClick={() => { onUpdate({ correction }); setEditing(false) }}>Сохранить</Button>
            </div>
            <p className="mt-2 text-xs text-muted">Измените вариант или отметьте его как зависящий от контекста, если формулировка спорная.</p>
          </div>
        )}

        {(supportUsed || solved || revealed) && (
          <div>
            <p className="inspector-label">Правило одним предложением</p>
            <p className="mt-2 text-sm leading-6 text-secondary">{error.rule}</p>
          </div>
        )}

        <div className="rounded-[3px] border border-border bg-elevated p-5">
          <p className="text-sm font-medium text-primary">{transferMode ? 'Отложенный перенос' : 'Исправьте самостоятельно'}</p>
          {transferReady && <p className="mt-1 text-xs text-muted">Принятый ответ остаётся скрытым, пока вы печатаете.</p>}
          {!transferReady && (
            <Stamp caption="Отсрочка" className="mt-3">
              {`Перенос откроется ${formatRelativeDueRu(error.dueAt, new Date(now))}: интервал — часть проверки.`}
            </Stamp>
          )}
          <label htmlFor="repair-response" className="sr-only">Ваш исправленный вариант</label>
          <Input
            id="repair-response"
            lang="en"
            className="reading-en mt-4"
            value={response}
            disabled={solved || revealed || !transferReady || error.status === 'resolved'}
            onChange={(event) => setResponse(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') check() }}
            placeholder={!transferReady ? 'Перенос намеренно закрыт до назначенного срока…' : revealed ? 'Скройте исправление перед новой попыткой…' : 'Введите исправленное предложение целиком…'}
          />
          {message && (
            <div
              role="status"
              className={`mt-3 rounded-[3px] border p-3 text-sm ${solved ? 'border-verified/30 bg-verified-soft text-teal' : 'border-amber/30 bg-amber/10 text-amber'}`}
            >
              {message}
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            {revealed ? (
              <Button variant="ghost" onClick={() => { setRevealed(false); setMessage('Теперь введите исправление по памяти. Попытка будет отмечена как выполненная с поддержкой.'); setResponse('') }}>Скрыть и повторить</Button>
            ) : (
              <Button variant="ghost" disabled={attempts < 2 || solved || !transferReady || error.status === 'resolved'} onClick={() => { setRevealed(true); setSupportUsed(true); setMessage('Изучите исправление, затем скройте его перед вводом.'); setResponse('') }}>Показать после двух попыток</Button>
            )}
            <Button disabled={!response.trim() || solved || revealed || !transferReady || error.status === 'resolved'} onClick={check}>
              {solved ? <><Check className="size-4" /> Исправлено</> : <>Проверить <ArrowRight className="size-4" /></>}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <button type="button" onClick={() => onUpdate({ status: 'observed' })} className="flex min-h-11 items-center gap-2 text-xs font-medium text-muted transition-colors hover:text-primary">
            <ShieldQuestion className="size-4" /> Зависит от контекста
          </button>
          <MarginNote className="mt-0 xl:max-w-none">Следующий перенос: {formatRelativeDueRu(error.dueAt, new Date(now))}</MarginNote>
        </div>
      </CardBody>
    </Card>
  )
}

function AddErrorForm({ onAdd, onCancel }: { onAdd: (input: { label: string; category: ErrorPattern['category']; original: string; correction: string; hint: string; rule: string; transferPrompt?: string; transferAnswer?: string }) => { id?: string; duplicateId?: string; error?: string }; onCancel: () => void }) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<ErrorPattern['category']>('other')
  const [original, setOriginal] = useState('')
  const [correction, setCorrection] = useState('')
  const [rule, setRule] = useState('')
  const [transferPrompt, setTransferPrompt] = useState('')
  const [transferAnswer, setTransferAnswer] = useState('')
  const [message, setMessage] = useState('')
  function save() {
    const result = onAdd({ label: label.trim() || 'Личный грамматический паттерн', category, original, correction, rule, transferPrompt, transferAnswer, hint: rule || 'Сравните структуру и попробуйте ещё раз.' })
    if (result.error) setMessage(localizeAddError(result.error))
    else if (result.duplicateId) setMessage('Это исходное предложение уже отслеживается.')
  }
  return (
    <Card level="slip">
      <CardHeader>
        <div>
          <p className="section-kicker">Личные свидетельства</p>
          <h2 className="card-title">Добавьте повторяющийся паттерн</h2>
        </div>
      </CardHeader>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-primary">Название паттерна<Input className="mt-2" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Например, предлог после depend" /></label>
        <label className="text-sm font-medium text-primary">Категория<Select className="mt-2" value={category} onChange={(event) => setCategory(event.target.value as ErrorPattern['category'])}>{Object.entries(categoryLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</Select></label>
        <label className="text-sm font-medium text-primary">Исходное предложение<Textarea lang="en" className="reading-en mt-2" value={original} onChange={(event) => setOriginal(event.target.value)} /></label>
        <label className="text-sm font-medium text-primary">Принятый исправленный вариант<Textarea lang="en" className="reading-en mt-2" value={correction} onChange={(event) => setCorrection(event.target.value)} /></label>
        <label className="text-sm font-medium text-primary sm:col-span-2">Правило или напоминание<Input className="mt-2" value={rule} onChange={(event) => setRule(event.target.value)} /></label>
        <label className="text-sm font-medium text-primary">Задание в новом контексте<Textarea lang="en" className="reading-en mt-2" value={transferPrompt} onChange={(event) => setTransferPrompt(event.target.value)} placeholder="Другое предложение, которое проверяет то же правило" /></label>
        <label className="text-sm font-medium text-primary">Принятый ответ для переноса<Textarea lang="en" className="reading-en mt-2" value={transferAnswer} onChange={(event) => setTransferAnswer(event.target.value)} placeholder="Исправленное предложение в новом контексте" /></label>
        {message && <p role="alert" className="rounded-[3px] border border-amber/30 bg-amber/10 p-3 text-sm text-amber sm:col-span-2">{message}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="ghost" onClick={onCancel}>Отмена</Button><Button onClick={save}>Сохранить паттерн</Button></div>
      </CardBody>
    </Card>
  )
}
