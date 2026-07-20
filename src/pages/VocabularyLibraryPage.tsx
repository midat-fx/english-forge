import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookHeart, Brain, Check, Layers3, PenLine, Plus, Search, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonVariants'
import { Card, CardBody } from '../components/ui/Card'
import { Input, Select } from '../components/ui/Field'
import { MarginNote } from '../components/ui/MarginNote'
import { Rule } from '../components/ui/Rule'
import { lexicalCatalogLevelCounts, lexicalCatalogTotalCount } from '../data/lexicalCatalogLoader'
import { lexicalCatalogMethodology } from '../data/lexicalCatalogMethodology'
import { activationBacklogSize, activationNewEnrollmentLimit } from '../domain/activation'
import { DAILY_NEW_ITEM_COUNT, dailyVocabularyItems, isPracticeReadyPhrase, localDayKey, resolveDailyVocabularyAssignment } from '../domain/dailyVocabulary'
import { phraseFingerprint } from '../domain/normalization'
import { buildPracticeQueue } from '../domain/queue'
import { useLocalToday } from '../hooks/useLocalToday'
import { useLexicalCatalogLevel } from '../hooks/useLexicalCatalogLevel'
import type { CatalogKind, CatalogLevel, LexicalCatalogItem } from '../domain/lexicalCatalog'
import { cn } from '../lib/utils'
import { useForgeStore } from '../store/useForgeStore'

const LEVELS: CatalogLevel[] = ['A2', 'B1', 'B2', 'C1']
const PAGE_SIZE = 40
const KIND_LABELS: Record<CatalogKind | 'all', string> = {
  all: 'Все типы', word: 'Слова', collocation: 'Коллокации', phrasal_verb: 'Phrasal verbs',
  discourse_marker: 'Связующие фразы', grammar_frame: 'Полезные модели', register_formula: 'Разговорные формулы',
}

function stableChoiceOrder(value: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function recognitionChoices(item: LexicalCatalogItem, catalog: readonly LexicalCatalogItem[]): string[] {
  const distractors = catalog
    .filter((candidate) => candidate.id !== item.id && candidate.translationRu !== item.translationRu)
    .sort((left, right) =>
      Number(right.kind === item.kind) - Number(left.kind === item.kind)
      || stableChoiceOrder(`${item.id}:${left.id}`) - stableChoiceOrder(`${item.id}:${right.id}`))
    .map((candidate) => candidate.translationRu)
  return [...new Set([item.translationRu, ...distractors])]
    .slice(0, 3)
    .sort((left, right) => stableChoiceOrder(`${item.id}:${left}`) - stableChoiceOrder(`${item.id}:${right}`))
}

export function VocabularyLibraryPage() {
  const store = useForgeStore(useShallow((state) => ({
    dailyVocabularyAssignment: state.dailyVocabularyAssignment,
    dailyVocabularyAssignments: state.dailyVocabularyAssignments,
    phrases: state.phrases,
    skillStates: state.skillStates,
    reviews: state.reviews,
    preferences: state.preferences,
    archivePhrase: state.archivePhrase,
    enrollCatalogItem: state.enrollCatalogItem,
    ensureDailyVocabularyAssignment: state.ensureDailyVocabularyAssignment,
    markDailyVocabularyPreviewed: state.markDailyVocabularyPreviewed,
    replaceDailyVocabularyItem: state.replaceDailyVocabularyItem,
    saveReferenceCatalogItem: state.saveReferenceCatalogItem,
  })))
  const ensureDailyVocabularyAssignment = store.ensureDailyVocabularyAssignment
  const today = useLocalToday()
  const [level, setLevel] = useState<CatalogLevel>(store.preferences.currentLevel)
  const [kind, setKind] = useState<CatalogKind | 'all'>('all')
  const [topic, setTopic] = useState('all')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [recognitionNeedsRetry, setRecognitionNeedsRetry] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const { items: browseCatalog, error: browseError, loading: browseLoading } = useLexicalCatalogLevel(level)
  const { items: dailyCatalog, error: dailyError, loading: dailyLoading } = useLexicalCatalogLevel(store.preferences.currentLevel)
  const owned = useMemo(() => new Set(store.phrases.filter((phrase) => phrase.status !== 'archived' && isPracticeReadyPhrase(phrase)).map((phrase) => phraseFingerprint(phrase.canonical))), [store.phrases])
  const dailyResolution = useMemo(
    () => dailyCatalog ? resolveDailyVocabularyAssignment(dailyCatalog, store.preferences.currentLevel, store.phrases, today, DAILY_NEW_ITEM_COUNT, store.dailyVocabularyAssignments.find((item) => item.dayKey === localDayKey(today) && item.level === store.preferences.currentLevel) ?? store.dailyVocabularyAssignment, store.dailyVocabularyAssignments) : null,
    [dailyCatalog, store.dailyVocabularyAssignment, store.dailyVocabularyAssignments, store.phrases, store.preferences.currentLevel, today],
  )
  const dailyAssignment = dailyResolution?.assignment ?? null
  const dailyItems = useMemo(() => dailyCatalog && dailyAssignment ? dailyVocabularyItems(dailyCatalog, store.preferences.currentLevel, store.phrases, today, DAILY_NEW_ITEM_COUNT, dailyAssignment, store.dailyVocabularyAssignments) : [], [dailyAssignment, dailyCatalog, store.dailyVocabularyAssignments, store.phrases, store.preferences.currentLevel, today])
  const enrolledDailyIds = useMemo(() => new Set(dailyAssignment?.enrolledIds ?? []), [dailyAssignment?.enrolledIds])
  const previewedDailyIds = useMemo(() => new Set(dailyAssignment?.previewedIds ?? []), [dailyAssignment?.previewedIds])
  const assignedDailyIds = useMemo(() => new Set(dailyAssignment?.itemIds ?? []), [dailyAssignment?.itemIds])
  const dailyLearned = enrolledDailyIds.size
  const dailyPreviewed = dailyItems.filter((item) => previewedDailyIds.has(item.id)).length
  const dueReviews = buildPracticeQueue(store.skillStates, store.phrases, store.preferences, today, undefined, dailyAssignment, store.reviews).length
  const deepEligibleDailyItems = dailyItems.filter((item) => item.activationReady === true)
  const dailySelectionTarget = Math.min(deepEligibleDailyItems.length, store.preferences.maxNewPhrases, activationNewEnrollmentLimit(store.preferences.dailyMinutes, dueReviews, activationBacklogSize(store.phrases, store.preferences.currentLevel)))
  const browseReadyCount = useMemo(() => (browseCatalog ?? []).filter((item) => item.activationReady === true).length, [browseCatalog])
  const topics = useMemo(() => ['all', ...new Set((browseCatalog ?? []).map((item) => item.topic))].sort(), [browseCatalog])
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('en-US')
    return (browseCatalog ?? []).filter((item) =>
      (kind === 'all' || item.kind === kind)
      && (topic === 'all' || item.topic === topic)
      && (!query || [item.expression, item.translationRu, item.meaningEn, item.example, item.exampleTranslationRu, item.topic].some((value) => value.toLocaleLowerCase('en-US').includes(query))),
    )
  }, [browseCatalog, kind, search, topic])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleItems = filtered.slice(Math.min(page, pageCount - 1) * PAGE_SIZE, (Math.min(page, pageCount - 1) + 1) * PAGE_SIZE)

  useEffect(() => {
    if (dailyAssignment && dailyResolution && dailyCatalog) ensureDailyVocabularyAssignment()
  }, [dailyAssignment, dailyCatalog, dailyResolution, ensureDailyVocabularyAssignment])

  function addItem(item: LexicalCatalogItem, quiet = false): boolean {
    if (!dailyAssignment) {
      if (!quiet) setMessage('Каталог ещё открывается. Повторите действие через секунду.')
      return false
    }
    const result = store.enrollCatalogItem(item, dailyAssignment)
    if (result.id) {
      if (!quiet) setMessage(item.activationReady === true
        ? `“${item.expression}” добавлено в мои слова с полным маршрутом.`
        : `“${item.expression}” добавлено в мои слова. Этапы 1–5 доступны; для шага 6 добавьте личный паттерн ошибки.`)
      return true
    }
    if (!quiet) setMessage(result.duplicateId ? 'Эта единица уже есть в моих словах.' : result.error ?? 'Не удалось добавить эту единицу.')
    return false
  }

  function saveReferenceItem(item: LexicalCatalogItem) {
    const result = store.saveReferenceCatalogItem(item)
    if (result.id) {
      setMessage(`“${item.expression}” сохранено в мои слова. Первые пять шагов доступны; для шага 6 добавьте личный пример вашей ошибки.`)
      return
    }
    setMessage(result.duplicateId ? 'Эта единица уже есть в моих словах.' : result.error ?? 'Не удалось сохранить эту единицу.')
  }

  function addDailySet() {
    const remainingSlots = Math.max(0, dailySelectionTarget - dailyLearned)
    const discoveredCandidates = deepEligibleDailyItems.filter((item) => previewedDailyIds.has(item.id) && !enrolledDailyIds.has(item.id))
    const added = discoveredCandidates.slice(0, remainingSlots).filter((item) => addItem(item, true)).length
    setMessage(added
      ? `${added} новых единиц добавлено в глубокий цикл без создания будущего долга по повторениям.`
      : !dailyItems.length
        ? 'Каталог этого уровня завершён: переходите к повторению или добавьте собственное выражение.'
        : !discoveredCandidates.length
          ? 'Сначала завершите первичное извлечение хотя бы одной карточки, затем выберите её в глубокий цикл.'
          : `Безопасный лимит глубокого цикла на сегодня — ${dailySelectionTarget}; остальные карточки остаются только в Discovery.`)
  }

  function completeDiscovery(item: LexicalCatalogItem) {
    if (!dailyAssignment) return
    store.markDailyVocabularyPreviewed(item.id, dailyAssignment)
    setRecognitionNeedsRetry((ids) => ids.filter((id) => id !== item.id))
    setMessage(`Первичное извлечение «${item.expression}» сохранено. Глубокий цикл добавляется отдельно по безопасному лимиту.`)
  }

  function answerDiscovery(item: LexicalCatalogItem, answer: string) {
    if (answer === item.translationRu) {
      completeDiscovery(item)
      return
    }
    setRecognitionNeedsRetry((ids) => ids.includes(item.id) ? ids : [...ids, item.id])
    setMessage(`Ответ для «${item.expression}» пока неверный. Посмотрите коррекцию и повторите без подсказки.`)
  }

  function replaceDailyItem(item: LexicalCatalogItem) {
    if (!dailyCatalog) return
    const result = store.replaceDailyVocabularyItem(item.id)
    setMessage(result.replacementId
      ? `«${item.expression}» отложено: на сегодня подобрана другая карточка.`
      : result.error ?? 'Не удалось заменить карточку.')
  }

  function markTooSimple(item: LexicalCatalogItem) {
    if (!dailyAssignment || !dailyCatalog) return
    const enrollment = item.activationReady === true
      ? store.enrollCatalogItem(item, dailyAssignment, 'dismiss')
      : store.saveReferenceCatalogItem(item)
    if (!enrollment.id) {
      setMessage(enrollment.error ?? 'Не удалось отметить карточку.')
      return
    }
    if (item.activationReady !== true) store.archivePhrase(enrollment.id)
    const replacement = store.replaceDailyVocabularyItem(item.id)
    setMessage(replacement.replacementId
      ? `«${item.expression}» отмечено как слишком простое и заменено.`
      : `«${item.expression}» отмечено как слишком простое.`)
  }

  function speak(item: LexicalCatalogItem) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setMessage('Системный голос macOS сейчас недоступен.')
      return
    }
    const utterance = new SpeechSynthesisUtterance(item.expression)
    utterance.lang = store.preferences.englishVariant === 'UK' ? 'en-GB' : store.preferences.englishVariant === 'US' ? 'en-US' : 'en'
    utterance.rate = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setMessage(`Произношение «${item.expression}» воспроизводится локальным голосом macOS.`)
  }

  return (
    <div className="space-y-10">
      {/* ── Колонтитул издания ────────────────────────────────────────────── */}
      <header className="rule-double pb-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="section-kicker">Библиотека полезного английского</p>
            <h2 className="mt-3 text-h1 font-light tracking-[-0.02em] text-primary">Большой словарь без перегрузки.</h2>
            <p className="mt-3 max-w-2xl text-body leading-relaxed text-secondary">
              <span className="numeral">{lexicalCatalogTotalCount}</span> проверенных слов и выражений по уровням. Каждый день вы знакомитесь с новыми выражениями; в полную отработку берутся карточки с авторской парой «ошибка → исправление». Остальные можно сохранить себе для первых пяти шагов и дополнить собственным примером ошибки.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link to="/phrases" className={buttonClass({ variant: 'secondary' })}>
              <BookHeart className="size-4 text-teal" /> Мои слова · <span className="numeral">{store.phrases.filter((phrase) => phrase.status !== 'archived').length}</span>
            </Link>
            <Button onClick={addDailySet} disabled={dailyLoading || !dailyAssignment || !dailyItems.length}>Добавить доступные на сегодня</Button>
          </div>
        </div>
      </header>

      {/* ── Ежедневный набор: обойма ячеек в общей рамке ──────────────────── */}
      <section className="overflow-hidden rounded-[3px] border border-border bg-surface shadow-[var(--lift-1)]">
        <div className="flex flex-col gap-5 border-b border-border p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="section-kicker">Ежедневный набор · {store.preferences.currentLevel}</p>
            <h2 className="mt-2 text-h2 font-light text-primary">Сегодняшние <span className="numeral">10</span> слов и выражений</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="metric-label">Знакомство со скрытым значением</dt>
                <dd className="mt-1.5 flex items-center gap-3">
                  <Rule value={dailyPreviewed} max={dailyItems.length || DAILY_NEW_ITEM_COUNT} showFraction={false} className="w-28" />
                  <span className="numeral text-xs text-secondary">угадано {dailyPreviewed}/{dailyItems.length}</span>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="metric-label">Глубокий цикл</dt>
                <dd className="mt-1.5 flex items-center gap-3">
                  {dailySelectionTarget > 0 && <Rule value={Math.min(dailyLearned, dailySelectionTarget)} max={dailySelectionTarget} showFraction={false} className="w-28" />}
                  <span className="numeral text-xs text-secondary">взято в работу {Math.min(dailyLearned, dailySelectionTarget)} из {dailySelectionTarget}</span>
                </dd>
              </div>
            </dl>
            <MarginNote className="xl:max-w-none">Полную отработку получают карточки с парой «ошибка → исправление»; остальные — первые пять шагов.</MarginNote>
            <p aria-live="polite" className="mt-3 min-h-5 text-xs leading-5 text-teal">{message}</p>
          </div>
          <Button size="lg" className="shrink-0" onClick={addDailySet} disabled={dailyLoading || !dailyAssignment || !dailyItems.length || dailyLearned >= dailySelectionTarget}>
            <Plus className="size-4" /> {dailyLoading ? 'Открываем набор…' : !dailyItems.length ? 'Уровень завершён' : dailyLearned >= dailySelectionTarget ? 'Лимит выбран' : <>Выбрать ещё <span className="numeral">{dailySelectionTarget - dailyLearned}</span></>}
          </Button>
        </div>

        {dailyError && <p role="alert" className="m-5 rounded-[3px] border border-rubric/35 bg-rubric-soft p-4 text-sm text-ember-text">{dailyError}</p>}

        <div aria-busy={dailyLoading} className="grid gap-px bg-border md:grid-cols-2">
          {dailyLoading ? Array.from({ length: DAILY_NEW_ITEM_COUNT }, (_, index) => (
            <div key={index} className="min-h-44 animate-pulse bg-recess p-5 motion-reduce:animate-none">
              <div className="h-3 w-8 rounded-[2px] bg-elevated" />
              <div className="mt-4 h-4 w-3/4 rounded-[2px] bg-elevated" />
              <div className="mt-3 h-3 w-full rounded-[2px] bg-elevated" />
            </div>
          )) : dailyItems.map((item, index) => {
            const added = enrolledDailyIds.has(item.id)
            const discovered = previewedDailyIds.has(item.id)
            const needsRetry = recognitionNeedsRetry.includes(item.id)
            const stage = added ? 3 : discovered ? 2 : 1
            const phraseId = store.phrases.find((phrase) => phrase.status !== 'archived' && phraseFingerprint(phrase.canonical) === phraseFingerprint(item.expression))?.id
            return (
              <article
                key={item.id}
                className={cn(
                  'flex min-h-72 flex-col p-5',
                  // Неоткрытая ячейка ВРЕЗАНА в лист и матовая; открытая — сам лист.
                  discovered ? 'bg-surface' : 'bg-recess shadow-[var(--bevel-down)]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="numeral text-xs text-muted">{String(index + 1).padStart(2, '0')}</span>
                      <Badge tone="neutral">Знакомство</Badge>
                      {discovered && <Badge tone="positive">Узнано ✓</Badge>}
                      {added && <Badge tone="amber">В работе</Badge>}
                    </div>
                    {/* Лестница Знакомство → Узнано ✓ → В работе */}
                    <Rule value={stage} max={3} showFraction={false} className="mt-2.5 w-20" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => speak(item)} aria-label={`Услышать произношение: ${item.expression}`} title="Локальный голос macOS"><Volume2 className="size-4" /></Button>
                </div>

                <h3 lang="en" className="reading-en mt-3 text-readlg text-primary">{item.expression}</h3>
                <p className="inspector-label mt-1">{item.activationReady === true ? <><span className="numeral">8</span> шагов</> : <>Первые <span className="numeral">5</span> шагов</>}</p>

                {discovered ? (
                  <>
                    <p lang="ru" className="mt-2 text-sm font-semibold text-teal">{item.translationRu}</p>
                    <p lang="en" className="set-text reading-en mt-4 text-read text-primary">{item.example}</p>
                    <p lang="ru" className="mt-2 text-xs leading-5 text-muted">{item.exampleTranslationRu}</p>
                    <div className="mt-auto grid gap-2 pt-6 sm:grid-cols-2">
                      {phraseId ? (
                        <>
                          <Link to={`/phrases?selected=${encodeURIComponent(phraseId)}&edit=1`} className={buttonClass({ variant: 'secondary', size: 'sm' })}><PenLine className="size-4" /> Свой пример</Link>
                          <Link to={`/practice?phrase=${encodeURIComponent(phraseId)}&support=1`} className={buttonClass({ size: 'sm' })}><Brain className="size-4" /> Тренировать</Link>
                        </>
                      ) : item.activationReady === true ? (
                        <Button type="button" disabled={dailyLearned >= dailySelectionTarget} onClick={() => addItem(item)} title={dailyLearned >= dailySelectionTarget ? 'Сначала завершите запланированные активации и SRS-повторы.' : undefined}><Plus className="size-4" /> В глубокий цикл</Button>
                      ) : (
                        <Button type="button" variant="secondary" onClick={() => saveReferenceItem(item)}><BookHeart className="size-4" /> Сохранить этапы 1–5</Button>
                      )}
                      <Button type="button" variant="secondary" onClick={() => replaceDailyItem(item)}>Отложить и заменить</Button>
                      <Button type="button" variant="ghost" onClick={() => markTooSimple(item)}>Слишком просто</Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 flex flex-1 flex-col">
                    <p className="text-sm leading-6 text-secondary">Выберите точное значение. Перевод и пример скрыты до правильного ответа.</p>
                    {needsRetry ? (
                      <div className="mt-4 rounded-[3px] border border-amber/40 bg-amber/10 p-4 shadow-[var(--bevel-down)]" role="status">
                        <p className="text-sm text-primary">Пока неверно. Коррекция: <strong lang="ru" className="text-rubric">{item.translationRu}</strong></p>
                        <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => setRecognitionNeedsRetry((ids) => ids.filter((id) => id !== item.id))}>Повторить без подсказки</Button>
                      </div>
                    ) : (
                      <div role="group" aria-label={`Значение выражения ${item.expression}`} className="mt-4 grid gap-2">
                        {recognitionChoices(item, dailyCatalog ?? []).map((choice) => (
                          <Button key={choice} type="button" variant="secondary" className="h-auto min-h-11 justify-start whitespace-normal py-2.5 text-left font-normal" onClick={() => answerDiscovery(item, choice)}>{choice}</Button>
                        ))}
                      </div>
                    )}
                    <div className="mt-auto grid gap-2 pt-6 sm:grid-cols-2">
                      <Button type="button" variant="secondary" onClick={() => replaceDailyItem(item)}>Отложить</Button>
                      <Button type="button" variant="ghost" onClick={() => markTooSimple(item)}>Слишком просто</Button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
          {!dailyLoading && !dailyItems.length && (
            <div className="col-span-full bg-surface p-10 text-center">
              <Check className="mx-auto size-7 text-teal" />
              <h3 className="mt-4 text-h3 font-light text-primary">Каталог уровня {store.preferences.currentLevel} завершён.</h3>
              <p className="mx-auto mt-2 max-w-2xl text-body leading-relaxed text-secondary">Сначала закройте отложенные повторения, накопительную грамматику и Mission, затем подтвердите следующий уровень новой диагностикой.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link to="/practice" className={buttonClass()}>К повторениям</Link>
                <Link to="/grammar" className={buttonClass({ variant: 'secondary' })}>Накопительная грамматика</Link>
                <Link to="/level-test" className={buttonClass({ variant: 'secondary' })}>Проверить переход</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Аппарат поиска: сегмент клавиш + врезанные поля ───────────────── */}
      <section className="space-y-5">
        <p className="section-kicker">Полный корпус</p>
        <Card>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-4 gap-2" aria-label="Уровень словаря">
              {LEVELS.map((itemLevel) => (
                <button
                  key={itemLevel}
                  type="button"
                  aria-pressed={level === itemLevel}
                  onClick={() => { setLevel(itemLevel); setTopic('all'); setPage(0) }}
                  className={cn(
                    'detent lamp flex min-h-12 flex-col items-center justify-center rounded-[3px] border px-3 py-2',
                    level === itemLevel
                      ? 'border-verified bg-verified-soft text-teal shadow-[var(--press)]'
                      : 'border-border bg-elevated text-secondary shadow-[var(--lift-1)] hover:text-primary',
                  )}
                >
                  <span className="numeral text-sm font-bold">{itemLevel}</span>
                  <span className="numeral mt-0.5 hidden text-[0.6875rem] text-muted sm:inline">{lexicalCatalogLevelCounts[itemLevel]} справ.</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
              <label className="relative">
                <span className="sr-only">Поиск по библиотеке</span>
                <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" />
                <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} className="pl-10" placeholder="Найти слово, перевод или пример…" />
              </label>
              <Select aria-label="Тип выражения" value={kind} onChange={(event) => { setKind(event.target.value as CatalogKind | 'all'); setPage(0) }}>{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
              <Select aria-label="Тема" value={topic} onChange={(event) => { setTopic(event.target.value); setPage(0) }} className="capitalize">{topics.map((value) => <option key={value} value={value}>{value === 'all' ? 'Все темы' : value}</option>)}</Select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
              <span>{browseLoading ? `Открываем каталог ${level}…` : <>Уровень {level}: <span className="numeral">{lexicalCatalogLevelCounts[level]}</span> справочных · <span className="numeral">{browseReadyCount}</span> готовы к активному курсу · найдено <span className="numeral">{filtered.length}</span> · страница <span className="numeral">{Math.min(page, pageCount - 1) + 1}</span> из <span className="numeral">{pageCount}</span></>}</span>
              <span className="text-teal">{message}</span>
            </div>
          </CardBody>
        </Card>
      </section>

      {browseError && <p role="alert" className="rounded-[3px] border border-rubric/35 bg-rubric-soft p-4 text-sm text-ember-text">{browseError}</p>}

      <section aria-busy={browseLoading} className="grid gap-4 lg:grid-cols-2">
        {browseLoading ? Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="min-h-72 animate-pulse rounded-[3px] border border-border bg-surface p-5 shadow-[var(--lift-1)] motion-reduce:animate-none">
            <div className="h-5 w-24 rounded-[2px] bg-elevated" />
            <div className="mt-5 h-6 w-1/2 rounded-[2px] bg-elevated" />
            <div className="mt-5 h-4 w-full rounded-[2px] bg-elevated" />
          </div>
        )) : visibleItems.map((item) => {
          const added = owned.has(phraseFingerprint(item.expression))
          const activationReady = item.activationReady === true
          return (
            <article key={item.id} className="lamp flex flex-col rounded-[3px] border border-border bg-surface p-5 shadow-[var(--lift-1)]">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="teal">{item.level}</Badge>
                    <Badge tone="neutral">{KIND_LABELS[item.kind]}</Badge>
                    <Badge tone={activationReady ? 'positive' : 'neutral'}>{activationReady ? 'Активный курс' : 'Справочник'}</Badge>
                    <span className="text-xs capitalize text-muted">{item.topic}</span>
                  </div>
                  <h3 lang="en" className="reading-en mt-3 text-readlg text-primary">{item.expression}</h3>
                  <p lang="ru" className="mt-1 text-sm font-semibold text-teal">{item.translationRu}</p>
                </div>
                {activationReady ? (
                  <button
                    type="button"
                    disabled={added || !assignedDailyIds.has(item.id) || !previewedDailyIds.has(item.id) || dailyLearned >= dailySelectionTarget}
                    onClick={() => addItem(item)}
                    aria-label={added ? `«${item.expression}» уже есть в личном словаре` : `Добавить «${item.expression}» в личный словарь`}
                    title={!assignedDailyIds.has(item.id) ? 'Активные карточки добавляются через сегодняшний ежедневный набор.' : !previewedDailyIds.has(item.id) ? 'Сначала правильно узнайте значение в разделе «Знакомство».' : dailyLearned >= dailySelectionTarget ? 'Дневной лимит карточек в отработку исчерпан.' : undefined}
                    className={cn(
                      'detent lamp grid size-11 shrink-0 place-items-center rounded-[3px] border shadow-[var(--lift-1)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none',
                      added ? 'border-verified/60 bg-verified/20 text-teal' : 'border-border bg-elevated text-secondary hover:text-primary',
                    )}
                  >
                    {added ? <Check className="size-5" /> : <Plus className="size-5" />}
                  </button>
                ) : (
                  <Button type="button" size="sm" variant="secondary" disabled={added} onClick={() => saveReferenceItem(item)} aria-label={added ? `«${item.expression}» сохранено в мои слова для дополнения` : `Сохранить «${item.expression}» и дополнить в моих словах`} title="Сохранить полную карточку лично; шаг 6 откроется после вашего проверяемого паттерна ошибки">
                    <BookHeart className="size-4 text-teal" />{added ? 'Сохранено' : 'Сохранить и дополнить'}
                  </Button>
                )}
              </div>
              <p lang="en" className="reading-en reading-en-block mt-4 text-read text-secondary">{item.meaningEn}</p>
              <div className="mt-4">
                <p className="inspector-label">Пример</p>
                <p lang="en" className="set-text reading-en mt-2 text-read text-primary">{item.example}</p>
                <p lang="ru" className="mt-2 text-sm leading-6 text-muted">{item.exampleTranslationRu}</p>
              </div>
              {(item.pattern || item.note) && (
                <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs leading-5 text-muted">
                  {item.pattern && <p><span className="inspector-label mr-1.5">Модель</span>{item.pattern}</p>}
                  {item.note && <p>{item.note}</p>}
                </div>
              )}
            </article>
          )
        })}
      </section>

      {filtered.length > PAGE_SIZE && (
        <nav aria-label="Страницы словаря" className="flex items-center justify-center gap-4">
          <Button variant="secondary" disabled={page <= 0} onClick={() => { setPage((value) => Math.max(0, value - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><ArrowLeft className="size-4" /> Назад</Button>
          <span className="numeral text-sm text-muted">{Math.min(page, pageCount - 1) + 1} / {pageCount}</span>
          <Button variant="secondary" disabled={page >= pageCount - 1} onClick={() => { setPage((value) => Math.min(pageCount - 1, value + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Дальше <ArrowRight className="size-4" /></Button>
        </nav>
      )}
      {!filtered.length && !browseLoading && (
        <div className="empty-state rounded-[3px] border border-border bg-recess shadow-[var(--bevel-down)]">
          <Layers3 className="size-7" />
          <p>По этим фильтрам ничего не найдено.</p>
        </div>
      )}

      <details className="rounded-[3px] border border-border bg-surface p-4 text-xs text-muted shadow-[var(--lift-1)]">
        <summary className="cursor-pointer font-semibold text-secondary">Как исследовался словарь</summary>
        <p className="mt-3 max-w-4xl leading-5">Уровни CEFR описывают коммуникативные умения, а не жёстко закрепляют каждое слово за одним уровнем. Определения, переводы и примеры в приложении сформулированы самостоятельно; охват программы сопоставлен с материалами Совета Европы, English Profile, British Council и Cambridge.</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {lexicalCatalogMethodology.sources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="ink-underline inline-flex items-center gap-1 text-teal">{source.organisation} <ArrowRight className="size-3" /></a>
          ))}
        </div>
      </details>
    </div>
  )
}
