import { isValidISO, todayISO } from './dates'
import { isHex, palette } from './colors'
import {
  DEFAULT_STATUS, STATUSES, TEAM_VALUES,
  type Status, type Task, type TeamValue, type ViewState,
} from './types'

/** The sentinel single-select views used for "not filtering". */
const LEGACY_ANY = 'All'

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

/** Keep only the strings from an unknown array. */
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : []

/** Keep only the members of a known vocabulary. */
const within = <T extends string>(v: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(v) ? v.filter((x): x is T => allowed.includes(x as T)) : []

/**
 * Coerce a stored view into the current shape.
 *
 * Views are persisted, so older browsers hand back two earlier formats:
 *   - `showOtherTeams: false` (before the filter bar) meant "hide other teams"
 *   - `project: 'Beta' | 'All'`, `team: 'mine' | 'all'` (single-select)
 * Both map onto the set form. Anything unrecognised falls back to not
 * filtering, because a view that silently hides work is worse than one that
 * shows too much.
 */
export function normalizeView(raw: unknown, fallbackAnchor: string): ViewState {
  const v: Record<string, unknown> = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const months = v.months === 1 || v.months === 2 || v.months === 3 ? v.months : 2
  const anchor = isValidISO(v.anchor) ? v.anchor : fallbackAnchor

  // single-select -> set, with "All" as the old do-nothing sentinel
  const fromSingle = (plural: unknown, single: unknown): string[] => {
    const set = strings(plural)
    if (set.length || !(typeof single === 'string') || !single || single === LEGACY_ANY) return set
    return [single]
  }

  let teams = within<TeamValue>(v.teams, TEAM_VALUES)
  if (!teams.length) {
    if (v.team === 'mine' || v.team === 'theirs') teams = [v.team]
    else if (v.team === undefined && v.showOtherTeams === false) teams = ['mine']
  }

  return {
    months,
    anchor,
    projects: fromSingle(v.projects, v.project),
    executors: fromSingle(v.executors, v.executor),
    teams,
    statuses: within<Status>(v.statuses, STATUSES),
  }
}

/** Does this task survive the current filters? Dimensions combine with AND. */
export function matchesView(t: Task, view: ViewState): boolean {
  if (view.projects.length && !view.projects.includes(t.project)) return false
  if (view.executors.length && !view.executors.includes(t.executor)) return false
  if (view.teams.length && !view.teams.includes(t.isMyTeam ? 'mine' : 'theirs')) return false
  if (view.statuses.length && !view.statuses.includes(t.status)) return false
  return true
}

/** The filter bar's data-driven options. */
export function filterOptions(tasks: Task[]): { projects: string[]; executors: string[] } {
  const by = (a: string, b: string) => a.localeCompare(b)
  return {
    projects: [...new Set(tasks.map((t) => t.project))].sort(by),
    executors: [...new Set(tasks.map((t) => t.executor).filter(Boolean))].sort(by),
  }
}

/** Is anything actually being filtered out? */
export const isFiltering = (view: ViewState): boolean =>
  view.projects.length > 0 ||
  view.executors.length > 0 ||
  view.teams.length > 0 ||
  view.statuses.length > 0

/** The filters cleared, leaving the layout and position alone. */
export const clearedFilters = (): Pick<ViewState, 'projects' | 'executors' | 'teams' | 'statuses'> => ({
  projects: [],
  executors: [],
  teams: [],
  statuses: [],
})

/**
 * Drop filter VALUES that no longer match anything in the data.
 *
 * Filter to a project, delete its last stage, and the filter would otherwise
 * point at a project that no longer exists — a blank board with no obvious way
 * back. Team and intensity are fixed vocabularies, so they cannot go stale.
 */
export function pruneView(view: ViewState, tasks: Task[]): ViewState {
  const { projects, executors } = filterOptions(tasks)
  const keptP = view.projects.filter((p) => projects.includes(p))
  const keptE = view.executors.filter((e) => executors.includes(e))
  const same = keptP.length === view.projects.length && keptE.length === view.executors.length
  return same ? view : { ...view, projects: keptP, executors: keptE }
}
