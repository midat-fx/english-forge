import { useState } from 'react'
import { CalendarDays, Table2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Contents, type ContentsItem } from '../components/ui/Contents'
import { MarginNote } from '../components/ui/MarginNote'
import { calculateProgress } from '../domain/progress'
import { isSpeakingEvidenceAttempt, speakingEvidencePhraseIds } from '../domain/speaking'
import { formatShortDate } from '../lib/utils'
import { useForgeStore } from '../store/useForgeStore'

export function ProgressPage() {
  const store = useForgeStore(useShallow((state) => ({
    phrases: state.phrases,
    skillStates: state.skillStates,
    reviews: state.reviews,
    errors: state.errors,
    missions: state.missions,
    speakingAttempts: state.speakingAttempts,
  })))
  const [showTable, setShowTable] = useState(false)
  const metrics = calculateProgress(store)
  const active = metrics.provisional
  const retained = metrics.retained
  const notActive = Math.max(0, metrics.captured - active - retained)
  const now = Date.now()
  const weekStart = now - 7 * 86_400_000
  const successfulThisWeek = store.reviews.filter((review) => review.grade >= 2 && new Date(review.reviewedAt).getTime() > weekStart && new Date(review.reviewedAt).getTime() <= now).length
  const recentReviews = store.reviews.filter((review) => new Date(review.reviewedAt).getTime() <= now).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).slice(0, 8)
  const spokenEvidence = store.speakingAttempts.filter((attempt) => isSpeakingEvidenceAttempt(attempt, store.phrases) && new Date(attempt.createdAt).getTime() <= now)
  const weeks = buildWeeklySeries(store.reviews)
  const peak = Math.max(1, ...weeks.map((week) => week.total))

  const output: ContentsItem[] = [
    { id: 'captured', folio: 'I', title: <Line label="Сохранено" detail="слов и выражений" />, value: <Figure value={metrics.captured} /> },
    { id: 'recalls', folio: 'II', title: <Line label="Вспомнили сами" detail="без подсказок" />, value: <Figure value={metrics.successfulProductiveRecalls} /> },
    { id: 'missions', folio: 'III', title: <Line label="Использовано в заданиях" detail="подтверждено вами" />, value: <Figure value={metrics.phrasesUsedInMissions} /> },
    { id: 'retained', folio: 'IV', title: <Line label="Закреплено" detail="проверено через 30+ дней" />, value: <Figure value={metrics.retained} /> },
    { id: 'takes', folio: 'V', title: <Line label="Записи речи" detail="попыток записано" />, value: <Figure value={metrics.speakingAttempts} /> },
    { id: 'minutes', folio: 'VI', title: <Line label="Время речи" detail="минут записано" />, value: <Figure value={metrics.speakingMinutes} /> },
  ]

  const funnel: ContentsItem[] = [
    { id: 'f-captured', folio: '1', title: <Line label="Сохранено" detail="в личной базе" />, value: <Figure value={metrics.captured} small /> },
    { id: 'f-idle', folio: '2', title: <Line label="Ещё в работе" detail="новое или мало повторений" />, value: <Figure value={notActive} small /> },
    { id: 'f-active', folio: '3', title: <Line label="Отработано" detail="дважды вспомнили сами" />, value: <Figure value={active} small /> },
    { id: 'f-retained', folio: '4', title: <Line label="Закреплено" detail="вспомнили и через 30 дней" />, value: <Figure value={retained} small /> },
  ]

  return <div className="space-y-8">
    <section aria-label="Итоги">
      <div className="mb-3 flex items-baseline justify-between gap-4 rule-double pb-2">
        <p className="section-kicker">Итоги</p>
        <p className="inspector-label">на <span className="numeral">{formatShortDate(new Date(now).toISOString())}</span></p>
      </div>
      <div className="grid gap-x-10 gap-y-1 lg:grid-cols-2">
        <Contents items={output.slice(0, 3)} />
        <Contents items={output.slice(3)} />
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <Card><CardHeader><div><p className="section-kicker">По неделям</p><h2 className="card-title">Активность повторений</h2></div><Button size="sm" variant="ghost" onClick={() => setShowTable((value) => !value)}><Table2 className="size-4" /> {showTable ? 'Показать график' : 'Показать таблицу'}</Button></CardHeader><CardBody>
        {showTable ? (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="label-caps border-b border-border-strong pb-2">Неделя</th>
                <th scope="col" className="label-caps border-b border-border-strong pb-2 text-right">Повторения</th>
                <th scope="col" className="label-caps border-b border-border-strong pb-2 text-right">Успешные</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => <tr key={week.label} className="border-b border-border last:border-0">
                <td className="py-3 text-secondary"><WeekLabel label={week.label} /></td>
                <td className="numeral py-3 text-right text-primary">{week.total}</td>
                <td className="numeral py-3 text-right text-verified">{week.successful}</td>
              </tr>)}
            </tbody>
          </table>
        ) : (
          <div>
            <div role="img" className="relative flex h-56 items-end gap-3 border-b border-border-strong px-1" aria-label="График повторений по неделям">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bottom-0">
                {[0, 25, 50, 75].map((offset) => <span key={offset} className="absolute inset-x-0 border-t border-dotted border-border" style={{ top: `${offset}%` }} />)}
              </div>
              {weeks.map((week) => {
                const totalPct = week.total ? Math.max(4, week.total / peak * 100) : 0
                const donePct = week.total ? week.successful / peak * 100 : 0
                return <div key={week.label} className="relative flex h-full flex-1 items-end">
                  <div className="relative mx-auto flex h-full w-full max-w-7 items-end rounded-[2px] bg-recess shadow-[var(--bevel-down)]">
                    <div className="hatched w-full border-t border-border-strong" style={{ height: `${totalPct}%` }} />
                    <div className="absolute inset-x-0 bottom-0 bg-verified" style={{ height: `${donePct}%` }} />
                  </div>
                </div>
              })}
            </div>
            <div className="flex gap-3 px-1">
              {weeks.map((week) => <p key={week.label} className="flex-1 pt-2 text-center text-[11px] text-muted"><WeekLabel label={week.label} /></p>)}
            </div>
            <div className="mt-4 flex items-center gap-6">
              <span className="inspector-label flex items-center gap-2"><i className="h-2.5 w-4 rounded-[2px] bg-verified" /> Успешные</span>
              <span className="inspector-label flex items-center gap-2"><i className="hatched h-2.5 w-4 rounded-[2px] border border-border-strong" /> Остальные</span>
            </div>
          </div>
        )}
        <MarginNote className="mt-5 xl:max-w-none">За последние <span className="numeral">7</span> дней: <span className="numeral">{metrics.reviewedThisWeek}</span> повторений, из них <span className="numeral">{successfulThisWeek}</span> успешных.</MarginNote>
      </CardBody></Card>

      <Card><CardHeader><div><p className="section-kicker">Путь выражения</p><h2 className="card-title">Сохранено → закреплено</h2></div></CardHeader><CardBody className="space-y-5">
        <div className="relative pl-2">
          <span aria-hidden="true" className="absolute inset-y-3 left-0 w-px bg-border-strong" />
          <Contents items={funnel} />
        </div>
        <p className="border-t border-border pt-4 text-xs leading-5 text-secondary">Выражение закрепляется, когда вы дважды вспомнили его сами, а потом ещё раз — через <span className="numeral">30</span> дней.</p>
      </CardBody></Card>
    </section>

    <Card><CardHeader><div><p className="section-kicker">Журнал</p><h2 className="card-title">Недавние повторения</h2></div></CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" className="label-caps border-b border-border-strong px-5 py-3">Дата</th>
              <th scope="col" className="label-caps border-b border-border-strong px-4 py-3">Выражение</th>
              <th scope="col" className="label-caps border-b border-border-strong px-4 py-3">Навык</th>
              <th scope="col" className="label-caps border-b border-border-strong px-4 py-3">Результат</th>
              <th scope="col" className="label-caps border-b border-border-strong px-4 py-3">Следующий срок</th>
            </tr>
          </thead>
          <tbody>{recentReviews.map((review) => {
            const phrase = store.phrases.find((item) => item.id === review.targetId)
            return <tr key={review.id} className="border-b border-border last:border-0">
              <td className="numeral px-5 py-4 text-xs text-muted">{formatShortDate(review.reviewedAt)}</td>
              <td lang="en" className="reading-en px-4 py-4 text-sm text-primary">{phrase?.canonical ?? 'Удалённое выражение'}</td>
              <td className="px-4 py-4 text-xs text-secondary">{reviewSkillLabel(review.skill)}</td>
              <td className="px-4 py-4"><Verdict grade={review.grade} /></td>
              <td className="numeral px-4 py-4 text-xs text-secondary">{formatShortDate(review.dueAfter)}</td>
            </tr>
          })}</tbody>
        </table>
        {!recentReviews.length && <div className="empty-state py-12"><CalendarDays className="size-6" /><p>Завершите первые повторения, чтобы появилась исходная точка.</p></div>}
      </div>
    </Card>

    {spokenEvidence.length > 0 && <Card><CardHeader><div><p className="section-kicker">Устная речь</p><h2 className="card-title">Недавние записи</h2></div><span className="inspector-label">Использовано выражений: <span className="numeral">{metrics.phrasesUsedInSpeech}</span></span></CardHeader><CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{spokenEvidence.slice(0, 6).map((attempt) => <Card key={attempt.id} level="recess" className="p-4">
      <div className="flex items-baseline justify-between gap-3"><p className="inspector-label">{speakingModeLabel(attempt.mode)}</p><span className="numeral text-xs text-muted">{attempt.durationSeconds} с</span></div>
      <p lang="en" className="reading-en mt-2 line-clamp-2 text-xs leading-5 text-secondary">{attempt.transcript || attempt.prompt}</p>
      <p className="mt-3 text-[11px] text-muted">Целевых выражений: <span className="numeral">{speakingEvidencePhraseIds(attempt, store.phrases).length}</span> · ясность <span className="numeral">{attempt.selfRating.clarity}/5</span> · плавность <span className="numeral">{attempt.selfRating.flow}/5</span></p>
    </Card>)}</CardBody></Card>}
  </div>
}

/**
 * Заголовок строки оглавления: название плюс служебное уточнение в том же кегле.
 * `text-primary` задаётся здесь явно: Contents без `state` считает строку
 * будущей и красит её самой блёклой краской, а на числовой странице названия
 * величин — это первый план, а не задел.
 */
function Line({ label, detail }: { label: string; detail: string }) {
  return <span className="inline-flex flex-wrap items-baseline gap-x-2 text-primary">{label}<span className="text-xs font-normal text-muted">{detail}</span></span>
}

/** «−3 нед.»: цифра — моно (правило 7), слово — гротеск. «Сейчас» цифры не несёт. */
function WeekLabel({ label }: { label: string }) {
  const match = /^(−\d+)\s+(.+)$/.exec(label)
  if (!match) return <>{label}</>
  return <><span className="numeral">{match[1]}</span> {match[2]}</>
}

function Figure({ value, small }: { value: number; small?: boolean }) {
  return <span className={small ? 'numeral text-base text-primary' : 'metric-value'}>{value}</span>
}

/**
 * Оценка повторения — не пилюля, а корректорская помета: единственный знак,
 * который корректор ставит рядом со строкой, к которой придётся вернуться.
 * Точка янтарная, а не рубричная: рубрика не маркирует промах пользователя
 * (железное правило 2), а «Снова» — именно промах извлечения. Форма — квадрат
 * 2px, круглые метки живут только в Badge (правило 8).
 */
function Verdict({ grade }: { grade: number }) {
  const word = ['Снова', 'Трудно', 'Хорошо', 'Легко'][grade]
  const tone = grade >= 2 ? 'text-verified' : 'text-amber'
  return <span className="label-caps inline-flex items-center gap-1.5">
    {grade === 0 && <i aria-hidden="true" className="size-1.5 rounded-[2px] bg-amber" />}
    <span className={tone}>{word}</span>
  </span>
}

function reviewSkillLabel(skill: ReturnType<typeof useForgeStore.getState>['reviews'][number]['skill']) {
  return ({ meaning_recall: 'вспоминание значения', cloze: 'восстановление в контексте', written_productive: 'письменное употребление', spoken_productive: 'устное употребление', grammar_repair: 'исправление ошибок' } as const)[skill]
}

function speakingModeLabel(mode: ReturnType<typeof useForgeStore.getState>['speakingAttempts'][number]['mode']) {
  return ({ targeted_response: 'ответ с целевыми фразами', fluency_432: 'лестница беглости 60/45/30', shadowing: 'повтор за образцом' } as const)[mode]
}

function buildWeeklySeries(reviews: ReturnType<typeof useForgeStore.getState>['reviews']) {
  const today = new Date()
  return Array.from({ length: 6 }, (_, reverseIndex) => {
    const weeksAgo = 5 - reverseIndex
    const end = new Date(today.getTime() - weeksAgo * 7 * 86_400_000)
    const start = new Date(end.getTime() - 7 * 86_400_000)
    const events = reviews.filter((review) => { const time = new Date(review.reviewedAt); return time > start && time <= end })
    return { label: weeksAgo === 0 ? 'Сейчас' : `−${weeksAgo} нед.`, total: events.length, successful: events.filter((review) => review.grade >= 2).length }
  })
}
