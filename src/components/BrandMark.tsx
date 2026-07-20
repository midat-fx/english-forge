/**
 * Знак издания. Рамка листа с волосяной линейкой поля и рубричный ¶ внутри.
 *
 * ПОЛНОСТЬЮ СТАТИЧЕН И ТАКИМ ОБЯЗАН ОСТАТЬСЯ. Знак висит в постоянно видимой
 * хроме (шапка AppShell, шапка диагностики, экран выбора профиля) — всё, что
 * здесь дышит по таймеру, дышит весь сеанс, у самого края поля зрения, пока
 * пользователь читает английский текст. Прежняя версия держала тут искру с
 * бесконечной анимацией нагрева — единственной незатухающей в приложении.
 */
export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[3px] border border-border bg-elevated shadow-[var(--bevel-up)]">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
          {/* рамка листа */}
          <rect
            x="2.75"
            y="2.75"
            width="18.5"
            height="18.5"
            rx="1"
            stroke="var(--border-strong)"
            strokeWidth="1"
          />
          {/* волосяная линейка поля для пометок */}
          <path d="M7.5 2.75V21.25" stroke="var(--border-strong)" strokeWidth="0.75" opacity="0.75" />
          {/* рубричный знак абзаца */}
          <g stroke="var(--rubric)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 6.6V17.4" />
            <path d="M13.4 17.4V6.6h-.6a2.9 2.9 0 0 0 0 5.8h.6" />
            <path d="M12.4 6.6H17.6" />
          </g>
        </svg>
      </span>
      <div>
        <div lang="en" className="reading-en text-sm font-bold tracking-wide text-primary">English Forge</div>
        <div className="text-[11px] text-muted">Ваш английский под правкой</div>
      </div>
    </div>
  )
}
