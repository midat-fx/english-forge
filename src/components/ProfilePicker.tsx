import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Plus, UserRound } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Input } from './ui/Field'
import type { ProfileSummary } from '../data/profileStorage'

/**
 * ПЕРВЫЙ ЭКРАН ПРИЛОЖЕНИЯ. Ноль ambient-движения: здесь ничего не дрейфует,
 * не пульсирует и не тянется за курсором. Прежняя версия держала фоновый
 * градиентный дрейф и наклон каждой карточки к курсору —
 * подпись «generic dark dashboard» ровно там, где человек знакомится с
 * инструментом. Отклик остаётся, но он событийный: детент нажатия и блик
 * лампы по верхней кромке слипа.
 *
 * Карточка профиля — СЛИП: наклеенный сверху бумажный талон. Поворот берётся
 * из Card level="slip" (плоский 2D-rotate на контейнере), а нажатие живёт на
 * самой кнопке, поэтому трансформы не спорят друг с другом.
 */
function ProfileCard({ profile, disabled, onChoose }: { profile: ProfileSummary; disabled: boolean; onChoose: (id: string) => void }) {
  return (
    <Card level="slip" className="lamp p-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChoose(profile.id)}
        className="detent flex w-full items-center gap-4 rounded-[2px] p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-60"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-[2px] border border-border bg-recess text-lg font-bold text-primary shadow-[var(--bevel-down)]">{profile.name.trim().charAt(0).toUpperCase() || '•'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-primary">{profile.name}</span>
          <span className="mt-0.5 block text-xs text-muted">{profile.placementCompleted ? `Уровень ${profile.level}` : 'Диагностика не пройдена'}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>
    </Card>
  )
}

interface ProfilePickerProps {
  profiles: ProfileSummary[]
  onSelect: (id: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
}

export function ProfilePicker({ profiles, onSelect, onCreate }: ProfilePickerProps) {
  const [creating, setCreating] = useState(profiles.length === 0)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    // On success the picker unmounts; on failure release the lock so the screen stays usable.
    try { await onCreate(name.trim()) } catch { setBusy(false); setError('Не удалось создать профиль. Попробуйте ещё раз.') }
  }

  async function choose(id: string) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await onSelect(id) } catch { setBusy(false); setError('Не удалось открыть профиль. Попробуйте ещё раз.') }
  }

  return (
    <main className="grid min-h-screen min-h-dvh place-items-center bg-canvas p-6 text-primary">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center"><BrandMark /></div>

        <p className="section-kicker mt-10 text-center">Оттиск на подпись</p>
        <h1 className="mt-2 text-center text-display font-light tracking-[-0.02em]">Кто занимается?</h1>
        <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-secondary">Каждый профиль хранит свой уровень и прогресс отдельно. Можно передать это приложение другу — он заведёт свой профиль и пройдёт диагностику.</p>

        <div className="mt-9 grid gap-3 sm:grid-cols-2">
          {profiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} disabled={busy} onChoose={choose} />
          ))}

          {creating ? (
            <Card level="leaf" className="sm:col-span-2">
              <form onSubmit={submit} className="flex flex-col gap-2 p-4">
                <label htmlFor="new-profile-name" className="text-sm font-semibold text-primary">Имя нового профиля</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="new-profile-name" ref={inputRef} autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Например: Друг" maxLength={40} />
                  <Button type="submit" variant="ember" disabled={!name.trim() || busy} className="shrink-0">Создать <ArrowRight className="size-4" /></Button>
                </div>
                {profiles.length > 0 && <button type="button" className="ink-underline mt-1 min-h-11 self-start text-xs font-semibold text-muted hover:text-secondary" onClick={() => { setCreating(false); setName('') }}>Отмена</button>}
              </form>
            </Card>
          ) : (
            // Пустое гнездо — врезка, а не ещё один слип: место, куда талон ещё не наклеен.
            <button
              type="button"
              disabled={busy}
              onClick={() => setCreating(true)}
              className="detent flex items-center gap-4 rounded-[3px] border border-dashed border-border-strong bg-recess p-4 text-left shadow-[var(--bevel-down)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-[2px] border border-border bg-elevated text-muted shadow-[var(--bevel-up)]"><Plus className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold text-primary">Новый профиль</span><span className="mt-0.5 block text-xs text-muted">Отдельный уровень и прогресс</span></span>
              <UserRound className="size-4 shrink-0 text-muted" aria-hidden="true" />
            </button>
          )}
        </div>
        {error && <p role="alert" className="mt-4 text-center text-sm text-danger">{error}</p>}
      </div>
    </main>
  )
}
