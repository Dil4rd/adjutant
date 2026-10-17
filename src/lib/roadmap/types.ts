export const STATUSES = ['active', 'intensive', 'hold'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<Status, string> = {
  active: 'Active',
  intensive: 'Intensive',
  hold: 'On-hold',
}

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
