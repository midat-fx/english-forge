import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface FieldShellProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export function FieldShell({ label, htmlFor, hint, error, required, children }: FieldShellProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-primary">
          {label}{required && <span className="ml-1 text-amber" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (обязательное поле)</span>}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
      {error && <p id={`${htmlFor}-error`} role="alert" className="text-sm text-amber">{error}</p>}
    </div>
  )
}

/** The field is physically CUT INTO the sheet — the three-level hierarchy in action. */
export const fieldClass = 'w-full rounded-[3px] border border-border-input bg-recess px-3.5 py-3 text-sm text-primary outline-none shadow-[var(--bevel-down)] placeholder:text-muted transition-[border-color,box-shadow] focus:border-verified focus:shadow-[var(--bevel-down),0_0_0_3px_var(--verified-soft)] disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldClass, 'h-11', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldClass, 'min-h-28 resize-y', className)} {...props} />
))
Textarea.displayName = 'Textarea'

/** Тот же вырез в листе, что у Input, плюс место справа под стрелку списка. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldClass, 'h-11 pr-8', className)} {...props} />
))
Select.displayName = 'Select'
