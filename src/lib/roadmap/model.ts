import { isValidISO, todayISO } from './dates'
import { isHex, palette } from './colors'
import { DEFAULT_STATUS, STATUSES, type Status, type Task } from './types'

export const uid = (): string =>
  't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** A record as it may arrive from an import: anything at all. */
type RawTask = Record<string, unknown>

/**
 * `active` was the old neutral state. It no longer exists: a stage is either
 * being driven, ticking over, or stopped. Legacy records land on `intensive`,
 * the state that actually means "work is happening" — re-tag anything that was
 * really ticking over as `background`.
 */
function coerceStatus(v: unknown): Status {
  if (STATUSES.includes(v as Status)) return v as Status
  if (v === 'active') return 'intensive'
  return DEFAULT_STATUS
}

const str = (v: unknown, max: number, fallback = ''): string =>
  (typeof v === 'string' && v ? v : fallback).slice(0, max)

/**
 * Coerce anything import-shaped into a valid task.
 *
 * Canonical field names are the interchange ones. Looser aliases (title, start,
 * end, team, notes, owner) are still accepted on the way in, which keeps
 * hand-written JSON and older exports loadable.
 */
export function normalizeTask(raw: unknown, i = 0): Task {
  const t: RawTask = raw && typeof raw === 'object' ? (raw as RawTask) : {}

  const date = (v: unknown): string | null => (isValidISO(v) ? v : null)
  let startDate = date(t.startDate) ?? date(t.start) ?? todayISO()
  let endDate = date(t.endDate) ?? date(t.end) ?? startDate
  if (endDate < startDate) [startDate, endDate] = [endDate, startDate]

  const isMyTeam =
    typeof t.isMyTeam === 'boolean'
      ? t.isMyTeam
      : typeof t.team === 'string'
        ? t.team !== 'external'
        : true

  const pal = palette()

  return {
    id: str(t.id, 64) || uid(),
    project: str(t.project, 120, 'Unassigned'),
    stage: str(t.stage, 160) || str(t.title, 160, 'Untitled stage'),
    executor: str(t.executor, 120) || str(t.owner, 120),
    startDate,
    endDate,
    status: coerceStatus(t.status),
    isMyTeam,
    color: isHex(t.color) ? t.color : pal[i % pal.length],
    comments: str(t.comments, 4000) || str(t.notes, 4000),
  }
}

/**
 * The hue that identifies a project on the board.
 *
 * An imported file may well colour its other-team stages differently from the
 * team's own (ownership used to be carried by hue). So the project takes the
 * colour of its earliest MY-TEAM stage, falling back to its earliest stage of
 * any kind — which makes a mixed file read as one project immediately, with no
 * manual recolouring.
 */
export function projectHues(tasks: Task[]): Map<string, string> {
  const order = (a: Task, b: Task) =>
    a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)
  const out = new Map<string, string>()
  for (const project of new Set(tasks.map((t) => t.project))) {
    const own = tasks.filter((t) => t.project === project)
    const mine = own.filter((t) => t.isMyTeam).sort(order)
    const pick = mine[0] ?? [...own].sort(order)[0]
    if (pick) out.set(project, pick.color)
  }
  return out
}
