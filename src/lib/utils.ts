import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatRelativeDue(value: string, now = new Date()): string {
  const difference = new Date(value).getTime() - now.getTime()
  if (difference <= 0) return 'Due now'
  const hours = Math.ceil(difference / 3_600_000)
  if (hours < 24) return `In ${hours}h`
  const days = Math.ceil(hours / 24)
  return days === 1 ? 'Tomorrow' : `In ${days} days`
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}
