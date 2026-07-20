import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Archive, BookMarked, ChevronRight, CircleAlert, Filter, ListChecks, Pencil, Search, Trash2, Volume2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { FieldShell, Input, Select, Textarea } from '../components/ui/Field'
import { MarginNote } from '../components/ui/MarginNote'
import { Rule } from '../components/ui/Rule'
import { Stamp } from '../components/ui/Stamp'
import { derivePhraseStatus } from '../domain/lifecycle'
import { PERSONAL_CATALOG_ENRICHMENT_TAG } from '../domain/lexicalCatalog'
import { isMatcherOnlyPattern } from '../domain/normalization'
import { calculatePhraseEvidence, type PhraseEvidence } from '../domain/progress'
import { isDue } from '../domain/scheduler'
import type { Phrase, PhraseStatus } from '../domain/types'
import { useForgeStore } from '../store/useForgeStore'

/**
 * `active` и `retained` — два соседних состояния одного пути. Раньше они
 * различались только словом при ОДИНАКОВОМ зелёном бейдже. Теперь они одной
 * краски, но разной насыщенности заливки и рамки (teal → positive), и каждое
 * по-прежнему подписано словом: ничто не держится на восприятии цвета.
 */
const statusTone: Record<PhraseStatus, 'neutral' | 'amber' | 'teal' | 'positive' | 'danger'> = {
  needs_enrichment: 'amber', new: 'neutral', learning: 'amber', active: 'teal', retained: 'positive', archived: 'neutral',
}
const statusLabel: Record<PhraseStatus, string> = {
  needs_enrichment: 'нужно дополнить', new: 'новое', learning: 'изучается', active: 'активное', retained: 'закреплено', archived: 'архив',
}
const skillLabel = {
  meaning_recall: 'вспоминание значения', cloze: 'восстановление в контексте', written_productive: 'письменное употребление', spoken_productive: 'устное употребление', grammar_repair: 'исправление ошибок',
} as const

function activeEvidenceCount(phrase: Phrase, evidence: PhraseEvidence): number {
  return Number((phrase.activationStage ?? 0) >= 8)
    + Math.min(2, evidence.productivePasses)
}

function needsPersonalStepSix(phrase: Phrase): boolean {
  return phrase.tags.includes(PERSONAL_CATALOG_ENRICHMENT_TAG) && !phrase.activationError
}

function formatDueRu(value: string, now = new Date()): string {
  const difference = new Date(value).getTime() - now.getTime()
  if (difference <= 0) return 'уже пора'
  const hours = Math.ceil(difference / 3_600_000)
  if (hours < 24) return `через ${hours} ч`
  const days = Math.ceil(hours / 24)
  return days === 1 ? 'завтра' : `через ${days} дн.`
}

/**
 * Правило 7 просит моноширинные цифры, правило 6 — гротеск на русском интерфейсе.
 * Поэтому .numeral достаётся только числовым фрагментам срока, а слова вокруг
 * («через», «дн.», «уже пора») остаются набранными гротеском.
 */
function DueText({ value }: { value: string }) {
  return <>{formatDueRu(value).split(/(\d+)/).map((part, index) => (
    /^\d+$/.test(part) ? <span key={index} className="numeral">{part}</span> : part
  ))}</>
}

export function PhraseBankPage() {
  const store = useForgeStore(useShallow((state) => ({
    phrases: state.phrases,
    skillStates: state.skillStates,
    reviews: state.reviews,
    missions: state.missions,
    speakingAttempts: state.speakingAttempts,
    updatePhrase: state.updatePhrase,
    archivePhrase: state.archivePhrase,
    restorePhrase: state.restorePhrase,
    deletePhrase: state.deletePhrase,
  })))
  const { phrases, skillStates, updatePhrase, archivePhrase, restorePhrase, deletePhrase } = store
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | PhraseStatus>('all')
  const [dueOnly, setDueOnly] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')
  const enrichmentCount = phrases.filter((phrase) => derivePhraseStatus(store, phrase) === 'needs_enrichment').length
  const stepSixEnrichment = phrases.filter((phrase) => phrase.status !== 'archived' && needsPersonalStepSix(phrase))

  const rows = useMemo(() => phrases.filter((phrase) => {
    const lifecycle = derivePhraseStatus(store, phrase)
    if (lifecycle === 'archived') return status === 'archived'
    if (status !== 'all' && lifecycle !== status) return false
    const haystack = `${phrase.canonical} ${phrase.meaning} ${phrase.context} ${phrase.source} ${phrase.tags.join(' ')}`.toLocaleLowerCase()
    if (query && !haystack.includes(query.toLocaleLowerCase())) return false
    if (dueOnly && !skillStates.some((state) => state.phraseId === phrase.id && state.skill !== 'spoken_productive' && isDue(state))) return false
    return true
  }), [phrases, status, query, dueOnly, skillStates, store])

  const selectedId = params.get('selected')
  const selected = rows.find((phrase) => phrase.id === selectedId) ?? rows[0]
  const selectedStates = skillStates.filter((state) => state.phraseId === selected?.id)
  const selectedPracticeStates = selectedStates.filter((state) => state.skill !== 'spoken_productive')
  const nextDue = [...selectedPracticeStates].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt
  const selectedStatus = selected ? derivePhraseStatus(store, selected) : undefined
  const selectedEvidence = selected ? calculatePhraseEvidence(store, selected.id) : undefined
  const selectedEvidenceCount = selected && selectedEvidence ? activeEvidenceCount(selected, selectedEvidence) : 0
  const selectedNeedsStepSix = Boolean(selected && needsPersonalStepSix(selected))
  const selectedVisibleAcceptedForms = selected?.acceptedForms.filter((form) => !isMatcherOnlyPattern(form)) ?? []

  useEffect(() => {
    if (selectedId && params.get('edit') === '1') setEditing(true)
  }, [params, selectedId])

  function select(id: string) {
    setParams({ selected: id })
    setEditing(false)
  }

  const liveCount = phrases.filter((phrase) => phrase.status !== 'archived').length

  return (
    <div className="space-y-5">
      {/* Колонтитул оттиска: рубрика слева, колонцифра справа. */}
      <header className="rule-double flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 pb-3">
        <p className="section-kicker">Личный словарь</p>
        <p className="inspector-label">
          <span className="numeral">{rows.length}</span> из <span className="numeral">{liveCount}</span> выражений
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          <Card level="leaf" className="min-w-0 overflow-hidden">
            <div className="rule-double flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" placeholder="Найти выражение, значение, источник или тег" aria-label="Поиск по личному словарю" /></div>
              <div className="flex flex-wrap gap-2">
                {enrichmentCount > 0 && <button onClick={() => { setStatus('needs_enrichment'); const next = phrases.find((phrase) => derivePhraseStatus(store, phrase) === 'needs_enrichment'); if (next) select(next.id) }} className="detent lamp flex min-h-11 items-center gap-2 rounded-[3px] border border-amber/45 bg-amber/15 px-3 text-sm font-semibold text-amber shadow-[var(--lift-1)]"><ListChecks className="size-4" /> Нужно дополнить <Badge tone="amber" className="numeral">{enrichmentCount}</Badge></button>}
                {stepSixEnrichment.length > 0 && <button onClick={() => { setStatus('all'); select(stepSixEnrichment[0].id) }} className="detent lamp flex min-h-11 items-center gap-2 rounded-[3px] border border-amber/30 bg-amber/10 px-3 text-sm font-semibold text-amber shadow-[var(--lift-1)]"><CircleAlert className="size-4" /> Нужен шаг 6 <Badge tone="amber" className="numeral">{stepSixEnrichment.length}</Badge></button>}
                <label className="relative"><span className="sr-only">Фильтр по статусу</span><Select className="w-auto text-secondary" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Все статусы</option><option value="needs_enrichment">Нужно дополнить</option><option value="new">Новые</option><option value="learning">Изучаются</option><option value="active">Активные</option><option value="retained">Закреплены</option><option value="archived">Архив</option></Select></label>
                <button onClick={() => setDueOnly((value) => !value)} aria-pressed={dueOnly} className={`detent lamp flex min-h-11 items-center gap-2 rounded-[3px] border px-3 text-sm font-semibold shadow-[var(--lift-1)] ${dueOnly ? 'border-amber/40 bg-amber/10 text-amber' : 'border-border bg-elevated text-secondary'}`}><Filter className="size-4" /> Пора повторить</button>
              </div>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left">
                <thead><tr className="rule-double bg-recess text-muted"><th className="label-caps px-5 py-2.5">Выражение</th><th className="label-caps px-4 py-2.5">Статус</th><th className="label-caps w-52 px-4 py-2.5">Свидетельства</th><th className="label-caps px-4 py-2.5">Следующее повторение</th><th className="w-12 px-3 py-2.5"><span className="sr-only">Действия</span></th></tr></thead>
                <tbody>{rows.map((phrase) => {
                  const states = skillStates.filter((state) => state.phraseId === phrase.id)
                  const practiceStates = states.filter((state) => state.skill !== 'spoken_productive')
                  const due = [...practiceStates].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt
                  const lifecycle = derivePhraseStatus(store, phrase)
                  const evidence = calculatePhraseEvidence(store, phrase.id)
                  const evidenceCount = activeEvidenceCount(phrase, evidence)
                  const current = selected?.id === phrase.id
                  return <tr key={phrase.id} className={`border-b border-border last:border-0 ${current ? 'bg-recess' : 'hover:bg-elevated/55'}`}>
                    {/* Текущая строка помечена рубрикой на поле — как галочка корректора, а не заливкой. */}
                    <td className={`relative max-w-[420px] px-5 py-4 ${current ? 'before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:bg-rubric before:content-[""]' : ''}`}><button onClick={() => select(phrase.id)} className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"><p lang="en" className="reading-en truncate text-[0.9375rem] text-primary">{phrase.canonical}</p><p className="mt-1 truncate text-xs text-muted">{phrase.meaning || phrase.context || 'Добавьте значение или контекст, чтобы открыть практику'}</p></button></td>
                    <td className="px-4 py-4 align-top"><div className="flex flex-wrap gap-1.5"><Badge tone={statusTone[lifecycle]}>{statusLabel[lifecycle]}</Badge>{needsPersonalStepSix(phrase) && <Badge tone="amber">нужен шаг 6</Badge>}</div></td>
                    <td className="px-4 py-4 align-top"><Rule value={evidenceCount} max={3} /><p className="mt-1 text-[0.6875rem] leading-4 text-muted">{lifecycle === 'retained' ? 'закреплено' : lifecycle === 'active' ? 'активное употребление' : 'до активного статуса'}</p></td>
                    <td className="px-4 py-4 align-top text-xs text-secondary">{due ? <DueText value={due} /> : 'не запланировано'}</td>
                    <td className="px-3 py-4 align-top"><button onClick={() => select(phrase.id)} aria-label="Открыть детали выражения" className="detent grid size-11 place-items-center rounded-[3px] text-muted hover:bg-elevated hover:text-primary"><ChevronRight className="size-4" /></button></td>
                  </tr>
                })}</tbody>
              </table>
            </div>

            <div className="divide-y divide-border lg:hidden">{rows.map((phrase) => { const lifecycle = derivePhraseStatus(store, phrase); return <button key={phrase.id} onClick={() => select(phrase.id)} className={`flex min-h-14 w-full items-center gap-3 p-4 text-left ${selected?.id === phrase.id ? 'bg-recess' : 'hover:bg-elevated'}`}><div className="min-w-0 flex-1"><p lang="en" className="reading-en truncate text-[0.9375rem] text-primary">{phrase.canonical}</p><p className="mt-1 truncate text-xs text-muted">{phrase.meaning || phrase.source}</p></div><div className="flex flex-col items-end gap-1"><Badge tone={statusTone[lifecycle]}>{statusLabel[lifecycle]}</Badge>{needsPersonalStepSix(phrase) && <Badge tone="amber">шаг 6</Badge>}</div><ChevronRight className="size-4 text-muted" /></button> })}</div>

            {!rows.length && <div className="empty-state py-16"><BookMarked className="size-7" /><div><p className="font-semibold text-primary">Ничего не найдено.</p><p className="mt-1 text-sm text-muted">Очистите поиск или измените фильтры.</p></div></div>}
          </Card>
          <MarginNote className="xl:max-w-none">Локальный профиль</MarginNote>
        </div>

        {selected ? <aside aria-label="Детали выражения" className="xl:sticky xl:top-[104px] xl:self-start"><Card level="leaf">
          <div className="rule-double p-5"><div className="flex flex-wrap gap-2"><Badge tone={statusTone[selectedStatus!]}>{statusLabel[selectedStatus!]}</Badge>{selectedNeedsStepSix && <Badge tone="amber">нужен шаг 6</Badge>}</div><h2 lang="en" className="reading-en mt-4 text-2xl text-primary">{selected.canonical}</h2><p className="mt-2 text-sm leading-6 text-secondary">{selected.meaning || 'Добавьте краткое значение или контекст, чтобы открыть практику.'}</p></div>
          {editing ? <EditPhraseForm phrase={selected} onSave={(patch) => { const result = updatePhrase(selected.id, patch); if (result.id) setEditing(false); return result }} onCancel={() => setEditing(false)} /> : <CardBody className="space-y-6">
            {/* Закрытая практика — не сломанный экран, а штемпель «закрыто». */}
            {selectedStatus === 'needs_enrichment' && <Stamp caption="практика пока закрыта"><p className="text-xs leading-5 text-secondary">Добавьте краткое значение или живой контекст. Остальные поля помогают активному употреблению, но не блокируют быстрое сохранение.</p><Button size="sm" className="mt-3" onClick={() => setEditing(true)}>Дополнить</Button></Stamp>}
            {selectedNeedsStepSix && <Card level="slip" className="p-4"><div className="flex gap-3"><CircleAlert className="mt-0.5 size-5 shrink-0 text-amber" /><div><p className="text-sm font-semibold text-amber">Первые пять шагов доступны</p><p className="mt-1 text-xs leading-5 text-secondary">Справочная карточка сохранена лично и не добавлена в Daily Ten. Полный цикл остановится перед шагом 6, пока вы не запишете одну реальную ошибку, её исправление и короткую подсказку.</p><Button size="sm" variant="secondary" className="mt-3" onClick={() => setEditing(true)}>Добавить паттерн шага 6</Button></div></div></Card>}

            <section><p className="inspector-label">Контекст</p>{selected.context ? <blockquote lang="en" className="set-text reading-en reading-en-block mt-2.5 text-sm text-secondary">{selected.context}</blockquote> : <p className="mt-2 text-sm text-muted">Пример пока не сохранён.</p>}{selected.source && <p lang="en" className="reading-en mt-2 text-xs text-muted">{selected.source}</p>}{selected.note && <Card level="recess" className="mt-3 p-3 text-xs leading-5 text-secondary"><strong className="text-primary">Заметка:</strong> {selected.note}</Card>}</section>

            <section className="grid gap-3 sm:grid-cols-2">
              <Card level="recess" className="p-3.5"><p className="metric-label">Свидетельства активного употребления</p><Rule className="mt-3" value={selectedEvidenceCount} max={3} /></Card>
              <Card level="recess" className="p-3.5"><p className="metric-label">Следующее повторение</p><p className="mt-3 text-sm font-semibold text-primary">{nextDue ? <DueText value={nextDue} /> : 'не задано'}</p></Card>
            </section>

            {selectedEvidence && <section><p className="inspector-label">Основание статуса</p><Card level="recess" className="mt-3 space-y-3 p-4">
              <EvidenceRule label="Цикл активации из 8 шагов" value={Math.min(8, selected.activationStage ?? 0)} max={8} />
              <EvidenceRule label="Продуктивные извлечения без помощи" value={Math.min(2, selectedEvidence.productivePasses)} max={2} />
              <EvidenceFlag label="Дополнительный перенос в Mission" value={selectedEvidence.missionCompletedAt !== undefined ? 'засчитан как продуктивное свидетельство' : 'необязателен'} done={selectedEvidence.missionCompletedAt !== undefined} />
              <EvidenceFlag label="Новое извлечение через 30+ дней" value={selectedEvidence.retained ? 'подтверждено' : 'ещё нет'} done={selectedEvidence.retained} />
            </Card></section>}

            <section><p className="inspector-label">Расписание навыков</p><div className="mt-3 divide-y divide-border border-y border-border">{selectedStates.map((state) => <div key={state.skill} className="flex items-center justify-between gap-3 py-2 text-xs"><span className="text-secondary">{skillLabel[state.skill]}</span><span className="text-right text-muted">попыток: <span className="numeral">{state.attempts}</span> · <DueText value={state.dueAt} /></span></div>)}</div></section>

            <section><p className="inspector-label">Глубина знания</p><Card level="recess" className="mt-3 space-y-3 p-4 text-xs leading-5 text-secondary"><DepthLine label="Грамматическая модель" value={selected.depth.grammarFrame} lang="en" /><DepthLine label="Сочетаемость" value={selected.depth.collocates.join(' · ')} lang="en" /><DepthLine label="Ограничения" value={selected.depth.constraints.join(' · ')} /><DepthLine label="Оттенок" value={selected.depth.connotation} />{selected.depth.contrasts.map((contrast) => <DepthLine key={`${contrast.alternative}-${contrast.distinction}`} label={`сравните с ${contrast.alternative}`} value={contrast.distinction} />)}<DepthLine icon={<Volume2 className="size-3.5" />} label="Произношение" value={selected.depth.pronunciationNote} lang="en" />{!depthCount(selected) && <p className="text-muted">Детали употребления пока не добавлены.</p>}</Card></section>

            {(selectedVisibleAcceptedForms.length > 0 || selected.examples.length > 0) && <section><p className="inspector-label">Формы и примеры</p><div className="mt-3 space-y-2.5">{selectedVisibleAcceptedForms.length > 0 && <p className="text-xs leading-5 text-secondary"><strong className="text-primary">Допустимые формы:</strong> <span lang="en" className="reading-en">{selectedVisibleAcceptedForms.join(', ')}</span></p>}{selected.examples.map((example) => <blockquote lang="en" key={example.id} className="set-text reading-en reading-en-block text-xs leading-5 text-secondary">{example.text}</blockquote>)}</div></section>}

            <div className="flex flex-wrap gap-2">{selected.tags.map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}<Badge tone="neutral">{selected.cefr}</Badge>{selected.register.map((item) => <Badge key={item} tone="neutral">{item}</Badge>)}</div>
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-5"><Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Изменить</Button><Button disabled={selectedStatus === 'needs_enrichment'} onClick={() => { window.location.hash = `#/practice?phrase=${encodeURIComponent(selected.id)}&support=1` }}>Тренировать в практике</Button></div>
            {deleteMessage && <p role="alert" className="text-xs leading-5 text-ember-text">{deleteMessage}</p>}
            <div className="flex justify-between">{selected.status === 'archived' ? <Button variant="ghost" size="sm" onClick={() => restorePhrase(selected.id)}><Archive className="size-4" /> Вернуть из архива</Button> : <Button variant="ghost" size="sm" onClick={() => archivePhrase(selected.id)}><Archive className="size-4" /> В архив</Button>}<Button variant="ghost" size="sm" className="text-ember-text" onClick={() => { if (!window.confirm(`Удалить «${selected.canonical}» и всю историю повторений?`)) return; const result = deletePhrase(selected.id); setDeleteMessage(result.error ?? '') }}><Trash2 className="size-4" /> Удалить</Button></div>
          </CardBody>}
        </Card></aside> : <Card level="leaf"><CardBody className="empty-state"><BookMarked className="size-6" /><p>Выберите выражение, чтобы увидеть детали.</p></CardBody></Card>}
      </div>
    </div>
  )
}

function EditPhraseForm({ phrase, onSave, onCancel }: { phrase: Phrase; onSave: (patch: Partial<Phrase>) => { id?: string; duplicateId?: string; error?: string }; onCancel: () => void }) {
  const [canonical, setCanonical] = useState(phrase.canonical)
  const [meaning, setMeaning] = useState(phrase.meaning)
  const [context, setContext] = useState(phrase.context)
  const [source, setSource] = useState(phrase.source)
  const [note, setNote] = useState(phrase.note)
  const [tags, setTags] = useState(phrase.tags.join(', '))
  const matcherOnlyForms = phrase.acceptedForms.filter(isMatcherOnlyPattern)
  const [acceptedForms, setAcceptedForms] = useState(phrase.acceptedForms.filter((form) => !isMatcherOnlyPattern(form)).join('\n'))
  const [examples, setExamples] = useState(phrase.examples.map((example) => example.text).join('\n'))
  const [grammarFrame, setGrammarFrame] = useState(phrase.depth.grammarFrame)
  const [collocates, setCollocates] = useState(phrase.depth.collocates.join('\n'))
  const [constraints, setConstraints] = useState(phrase.depth.constraints.join('\n'))
  const [contrasts, setContrasts] = useState(phrase.depth.contrasts.map((contrast) => `${contrast.alternative} | ${contrast.distinction}`).join('\n'))
  const [connotation, setConnotation] = useState(phrase.depth.connotation)
  const [pronunciationNote, setPronunciationNote] = useState(phrase.depth.pronunciationNote)
  const [activationIncorrect, setActivationIncorrect] = useState(phrase.activationError?.incorrectContext ?? '')
  const [activationCorrection, setActivationCorrection] = useState(phrase.activationError?.expectedCorrection ?? '')
  const [activationCue, setActivationCue] = useState(phrase.activationError?.cue ?? '')
  const [error, setError] = useState('')
  function save() {
    const lines = (value: string) => value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
    const result = onSave({
      canonical, meaning, context, source, note,
      tags: lines(tags), acceptedForms: [...matcherOnlyForms, ...lines(acceptedForms)],
      examples: lines(examples).map((text, index) => ({ id: phrase.examples[index]?.id ?? crypto.randomUUID(), text })),
      activationError: activationIncorrect.trim() || activationCorrection.trim() || activationCue.trim() ? {
        incorrectContext: activationIncorrect,
        expectedCorrection: activationCorrection,
        cue: activationCue,
      } : undefined,
      depth: {
        grammarFrame: grammarFrame.trim(), collocates: lines(collocates), constraints: lines(constraints),
        contrasts: contrasts.split('\n').map((line) => { const [alternative, ...rest] = line.split('|'); return { alternative: alternative.trim(), distinction: rest.join('|').trim() } }).filter((item) => item.alternative),
        connotation: connotation.trim(), pronunciationNote: pronunciationNote.trim(),
      },
    })
    if (result.error) setError(result.error)
    else if (result.duplicateId) setError('Другое активное выражение уже имеет такое написание.')
  }
  return <div className="max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto p-5"><FieldShell label="Выражение" htmlFor="edit-phrase" error={error}><Input id="edit-phrase" lang="en" className="reading-en" value={canonical} aria-invalid={Boolean(error)} onChange={(event) => { setCanonical(event.target.value); setError('') }} /></FieldShell><FieldShell label="Значение" htmlFor="edit-meaning" required><Input id="edit-meaning" value={meaning} onChange={(event) => setMeaning(event.target.value)} /></FieldShell><FieldShell label="Свой пример" htmlFor="edit-context" hint="Напишите по-английски"><Textarea id="edit-context" lang="en" className="reading-en" value={context} onChange={(event) => setContext(event.target.value)} /></FieldShell><FieldShell label="Личная ассоциация или подсказка" htmlFor="edit-note"><Textarea id="edit-note" value={note} onChange={(event) => setNote(event.target.value)} className="min-h-20" /></FieldShell><FieldShell label="Источник" htmlFor="edit-source"><Input id="edit-source" value={source} onChange={(event) => setSource(event.target.value)} /></FieldShell><FieldShell label="Допустимые формы" htmlFor="edit-forms" hint="По одной на строке"><Textarea id="edit-forms" lang="en" value={acceptedForms} onChange={(event) => setAcceptedForms(event.target.value)} className="reading-en min-h-20" /></FieldShell><FieldShell label="Дополнительные примеры" htmlFor="edit-examples" hint="По одному на строке"><Textarea id="edit-examples" lang="en" value={examples} onChange={(event) => setExamples(event.target.value)} className="reading-en min-h-24" /></FieldShell><div className="border-t border-border pt-4"><p className="section-kicker">Шаг 6 · одна проверяемая ошибка</p><p className="mt-1 text-xs leading-5 text-muted">Без этого паттерна карточка сохранится, но полный цикл активации будет ждать редакторской проверки.</p></div><FieldShell label="Предложение с одной ошибкой" htmlFor="edit-activation-incorrect"><Textarea id="edit-activation-incorrect" lang="en" value={activationIncorrect} onChange={(event) => setActivationIncorrect(event.target.value)} className="reading-en min-h-20" /></FieldShell><FieldShell label="Исправленное предложение" htmlFor="edit-activation-correction" hint="Должно содержать целевое выражение"><Textarea id="edit-activation-correction" lang="en" value={activationCorrection} onChange={(event) => setActivationCorrection(event.target.value)} className="reading-en min-h-20" /></FieldShell><FieldShell label="Короткая подсказка" htmlFor="edit-activation-cue"><Input id="edit-activation-cue" value={activationCue} onChange={(event) => setActivationCue(event.target.value)} /></FieldShell><div className="border-t border-border pt-4"><p className="section-kicker">Глубина словарного знания</p><p className="mt-1 text-xs leading-5 text-muted">Добавляйте только те детали употребления, в которых уверены.</p></div><FieldShell label="Грамматическая модель" htmlFor="edit-frame"><Input id="edit-frame" lang="en" className="reading-en" value={grammarFrame} onChange={(event) => setGrammarFrame(event.target.value)} placeholder="something falls short of + noun / -ing" /></FieldShell><FieldShell label="Сочетаемость" htmlFor="edit-collocates" hint="По одной на строке"><Textarea id="edit-collocates" lang="en" value={collocates} onChange={(event) => setCollocates(event.target.value)} className="reading-en min-h-20" /></FieldShell><FieldShell label="Ограничения употребления" htmlFor="edit-constraints" hint="По одному на строке"><Textarea id="edit-constraints" value={constraints} onChange={(event) => setConstraints(event.target.value)} className="min-h-20" /></FieldShell><FieldShell label="Контрасты" htmlFor="edit-contrasts" hint="альтернатива | практическое различие"><Textarea id="edit-contrasts" value={contrasts} onChange={(event) => setContrasts(event.target.value)} className="min-h-20" /></FieldShell><FieldShell label="Оттенок и регистр" htmlFor="edit-connotation"><Textarea id="edit-connotation" value={connotation} onChange={(event) => setConnotation(event.target.value)} className="min-h-20" /></FieldShell><FieldShell label="Заметка о произношении" htmlFor="edit-pronunciation"><Input id="edit-pronunciation" lang="en" className="reading-en" value={pronunciationNote} onChange={(event) => setPronunciationNote(event.target.value)} /></FieldShell><FieldShell label="Теги" htmlFor="edit-tags"><Input id="edit-tags" value={tags} onChange={(event) => setTags(event.target.value)} /></FieldShell><div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-surface py-3"><Button variant="ghost" onClick={onCancel}>Отмена</Button><Button onClick={save}>Сохранить</Button></div></div>
}

function depthCount(phrase: Phrase) {
  return Number(Boolean(phrase.depth.grammarFrame)) + phrase.depth.collocates.length + phrase.depth.constraints.length + phrase.depth.contrasts.length + Number(Boolean(phrase.depth.connotation)) + Number(Boolean(phrase.depth.pronunciationNote))
}

/** Дробь — всегда строкомер, никогда не проценты. */
function EvidenceRule({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="flex items-center justify-between gap-4 text-xs"><span className="min-w-0 text-secondary">{label}</span><Rule className="w-28 shrink-0" value={value} max={max} /></div>
}

/** Двоичное свидетельство: дроби нет, значит и строкомера нет — только слово. */
function EvidenceFlag({ label, value, done }: { label: string; value: string; done: boolean }) {
  return <div className="flex items-center justify-between gap-3 text-xs"><span className="text-secondary">{label}</span><Badge tone={done ? 'positive' : 'neutral'}>{value}</Badge></div>
}

function DepthLine({ label, value, icon, lang }: { label: string; value: string; icon?: ReactNode; lang?: 'en' }) {
  if (!value) return null
  return <div><p className="flex items-center gap-1.5 font-semibold text-primary">{icon}{label}</p><p lang={lang} className={lang === 'en' ? 'reading-en mt-0.5' : 'mt-0.5'}>{value}</p></div>
}
