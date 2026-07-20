import { Headphones, Mic2, PenLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClass } from '../components/ui/buttonVariants'
import { Card, CardBody } from '../components/ui/Card'
import { MarginNote } from '../components/ui/MarginNote'
import { Rule } from '../components/ui/Rule'
import { diagnosticPortfolioStatus, type DiagnosticPortfolioArea } from '../domain/diagnosticPortfolio'
import { formatShortDate } from '../lib/utils'
import { useForgeStore } from '../store/useForgeStore'

const TASKS: Record<DiagnosticPortfolioArea, { folio: string; title: string; description: string; criteria: string; to: string; action: string; icon: typeof Headphones }> = {
  listening: {
    folio: 'I',
    title: 'Listening без открытого текста',
    description: 'Прослушайте фразу до конца, запишите услышанное и ответьте на вопрос по смыслу.',
    criteria: 'Засчитывается совпавший диктант и смысловой ответ без reveal.',
    to: '/voice?tab=listening', action: 'Открыть listening', icon: Headphones,
  },
  speaking: {
    folio: 'II',
    title: 'Самостоятельный speaking sample',
    description: 'Запишите не менее 30 секунд ответа на новую тему без открытых целевых форм.',
    criteria: 'Сохраняется запись и самооценка; приложение не придумывает CEFR или accent score.',
    to: '/voice?tab=speaking', action: 'Записать speaking', icon: Mic2,
  },
  writing: {
    folio: 'III',
    title: 'Связный writing sample',
    description: 'Выполните Mission нужного объёма и используйте подготовленные выражения в новом контексте.',
    criteria: 'Проверяются объём и фактическое наличие целей; качество остаётся для самопроверки или преподавателя.',
    to: '/mission', action: 'Открыть writing Mission', icon: PenLine,
  },
}

export function SkillsDiagnosticPage() {
  const placementAttempts = useForgeStore((state) => state.placementAttempts)
  const listeningAttempts = useForgeStore((state) => state.listeningAttempts)
  const speakingAttempts = useForgeStore((state) => state.speakingAttempts)
  const missions = useForgeStore((state) => state.missions)
  const phrases = useForgeStore((state) => state.phrases)
  const data = { placementAttempts, listeningAttempts, speakingAttempts, missions, phrases }
  const status = diagnosticPortfolioStatus(data)
  const latestPlacement = [...data.placementAttempts].sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0]

  return (
    <div className="mx-auto max-w-5xl">
      {/* КОЛОНТИТУЛ */}
      <p className="section-kicker">Честное дополнение к placement</p>
      <div className="rule-double mt-3" />

      {/* ЛИСТ — единственный крупный объект первого экрана */}
      <Card level="leaf" className="mt-6">
        <CardBody className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-h1 font-light tracking-[-0.02em]">Соберите три образца реального использования.</h2>
              <p className="mt-4 max-w-[66ch] text-sm leading-6 text-secondary">
                Основной тест оценивает <span lang="en" className="reading-en">language knowledge</span>, <span lang="en" className="reading-en">reading</span> и <span lang="en" className="reading-en">Use of English</span>. Этот локальный портфель добавляет наблюдаемое <span lang="en" className="reading-en">listening-</span>, <span lang="en" className="reading-en">speaking-</span> и <span lang="en" className="reading-en">writing-evidence</span>, но не выдаёт самооценку за официальный CEFR.
              </p>
            </div>
            <Card level="recess" className="w-full shrink-0 px-4 py-4 lg:w-56">
              <p className="metric-label">Собрано образцов</p>
              <Rule
                className="mt-2.5"
                value={status.completedCount}
                max={3}
                progressbar
                ariaLabel="Собрано образцов"
                showFraction={false}
              />
              <p className="numeral mt-2 text-xs text-secondary">{status.completedCount}/3 образца</p>
            </Card>
          </div>

          {latestPlacement && (
            <MarginNote className="mt-6 xl:max-w-none xl:[transform:none]">
              Рабочий уровень основного теста: <strong className="text-primary">{latestPlacement.suggestedLevel}</strong> ·{' '}
              <span className="numeral">{formatShortDate(latestPlacement.completedAt)}</span>. Учитываются только более новые образцы.
            </MarginNote>
          )}
        </CardBody>
      </Card>

      {/* ТРИ СЛИПА — наклеенные листки, а не три одинаковых плиты */}
      <section aria-label="Диагностические образцы" className="mt-6 grid gap-4 lg:grid-cols-3">
        {(Object.entries(TASKS) as [DiagnosticPortfolioArea, (typeof TASKS)[DiagnosticPortfolioArea]][]).map(([area, task]) => {
          const evidence = status[area]
          const Icon = task.icon
          return (
            <Card
              key={area}
              level="slip"
              className="lamp flex flex-col"
            >
              <CardBody className="flex h-full flex-col p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="numeral text-xs text-rubric">{task.folio}</span>
                  <span className="label-caps text-muted">
                    {evidence.complete ? 'Образец готов' : 'Образец ещё не готов'}
                  </span>
                </div>
                <div className="rule-double mt-2.5" />

                <div className="mt-4 flex items-start gap-3">
                  <Icon className={`size-5 shrink-0 ${evidence.complete ? 'text-verified' : 'text-muted'}`} aria-hidden="true" />
                  <h3 className="text-h3 font-semibold text-primary">{task.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-secondary">{task.description}</p>
                <p className="mt-3 text-xs leading-5 text-muted">{task.criteria}</p>
                {evidence.completedAt && (
                  <p className="mt-3 text-xs font-semibold text-verified">
                    Последний подходящий образец: <span className="numeral">{formatShortDate(evidence.completedAt)}</span>
                  </p>
                )}

                <div className="mt-auto pt-6">
                  <Link
                    to={task.to}
                    className={buttonClass({ variant: 'secondary', className: 'w-full text-center' })}
                  >
                    {evidence.complete ? 'Записать новый образец' : task.action}
                  </Link>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </section>

      {/* ВЫХОДНЫЕ ДАННЫЕ */}
      <Card level="recess" className="mt-6 flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm">
        <p className="max-w-[66ch] text-secondary">Нужна новая точка отсчёта? Повторный placement обнулит портфель только по времени: старые данные останутся в истории.</p>
        <Link to="/level-test" className="ink-underline text-sm font-semibold text-teal">Повторить основной тест</Link>
      </Card>
    </div>
  )
}
