// Everything is an ISO "YYYY-MM-DD" day string — fixed width, so lexicographic
// compare is chronological compare, and no timezone ever leaks into the model.
// Date objects are only used for arithmetic, always at noon local so a DST
// shift can never roll a day over.

const DAY_MS = 86_400_000

export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export function iso(d: Date): string {
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  )
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const shiftISO = (s: string, n: number): string => iso(addDays(parseISO(s), n))
export const diffDays = (a: string, b: string): number =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY_MS)
export const todayISO = (): string => iso(new Date())

/** Monday of the week containing d — weeks start on Monday throughout. */
export const mondayOf = (d: Date): Date => addDays(d, -((d.getDay() + 6) % 7))

export const firstOfMonth = (d: Date): string =>
  iso(new Date(d.getFullYear(), d.getMonth(), 1, 12))

export const addMonths = (anchorISO: string, n: number): string => {
  const a = parseISO(anchorISO)
  return iso(new Date(a.getFullYear(), a.getMonth() + n, 1, 12))
}

export const isValidISO = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** Monday-aligned weeks covering the whole of one month. */
export function monthWeeks(year: number, month: number): Date[][] {
  const last = new Date(year, month + 1, 0, 12)
  const weeks: Date[][] = []
  let cur = mondayOf(new Date(year, month, 1, 12))
  while (cur <= last) {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) days.push(addDays(cur, i))
    weeks.push(days)
    cur = addDays(cur, 7)
  }
  return weeks
}
