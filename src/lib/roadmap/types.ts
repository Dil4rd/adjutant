export const STATUSES = ['intensive', 'background', 'hold'] as const
export type Status = (typeof STATUSES)[number]

/** Loudest to quietest — the order the editor and legend present them in. */
export const STATUS_LABEL: Record<Status, string> = {
  intensive: 'Intensive',
  background: 'Background / tentative',
  hold: 'On-hold',
}

/** Short form, for places where the full label will not fit. */
export const STATUS_SHORT: Record<Status, string> = {
  intensive: 'Intensive',
  background: 'Background',
  hold: 'On-hold',
}

/** The state a task takes when none is given, or an unknown one is supplied. */
export const DEFAULT_STATUS: Status = 'intensive'

/**
 * The interchange record. These field names are canonical — they are what the
 * app holds in memory, encrypts to disk and writes on export, so there is no
 * translation layer that can drift out of step with an imported file.
 *
 * `endDate` is INCLUSIVE: a stage ending 2026-10-28 occupies the 28th, and the
 * next stage starts on the 29th.
 */
export interface Task {
  id: string
  project: string
  stage: string
  executor: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD, inclusive
  /**
   * How hard the work is running, loudest to quietest:
   * `intensive` (full throttle) · `background` (low-intensity or not yet
   * committed) · `hold` (blocked). There is no neutral "active" state — a
   * stage is either being driven, ticking over, or stopped.
   */
  status: Status
  /**
   * Deliberately binary: the only distinction that matters is whether the work
   * is mine to drive. Cross-functional teams, contractors and third-party
   * vendors are all simply *not my team*, and all recede to grey.
   */
  isMyTeam: boolean
  color: string // #rgb or #rrggbb
  comments: string
}

export interface ViewState {
  months: 1 | 2 | 3
  anchor: string // ISO first-of-month for the leftmost panel
  project: string // "All" or an exact project name
  /** Show work owned by anyone other than my team. Persisted with the view. */
  showOtherTeams: boolean
}

export interface Meta {
  version: number
  name: string
  updatedAt: string | null
}

/** What Export JSON writes, and what Import JSON accepts alongside a bare array. */
export interface ExportEnvelope {
  version: 1
  app: 'adjutant-roadmap'
  exportedAt: string
  meta: Meta & { taskCount: number; projects: string[] }
  tasks: Task[]
}

/** The shape persisted (encrypted) to local storage. */
export interface Persisted {
  meta: Meta
  tasks: Task[]
  view: ViewState
}
