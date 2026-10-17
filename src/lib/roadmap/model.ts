import { isValidISO, todayISO } from './dates'
import { isHex, paletteFor } from './colors'
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

  const pal = paletteFor(isMyTeam)

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
 * The roadmap a fresh browser starts with. Stored in exactly the interchange
 * shape, so it round-trips through Export JSON unchanged.
 *
 * The three stages whose comments say "Low-intensity" are tagged `background`;
 * the delivery stages they shadow are `intensive`. That distinction was only
 * ever in the prose before there was a status that could carry it.
 */
export function seedTasks(): Task[] {
  return [
    { id: 'sample-01a', project: 'Example Programme', stage: 'Stage 1: Baseline & Testing', executor: 'Core Team',
      startDate: '2026-10-19', endDate: '2026-10-28', status: 'intensive', isMyTeam: true, color: '#8b5cf6',
      comments: 'Establish the baseline, run internal testing, and scope the wider pilot group.' },
    { id: 'sample-01b', project: 'Example Programme', stage: 'Stage 1: Policy & Testing Support', executor: 'Partner Team',
      startDate: '2026-10-19', endDate: '2026-10-28', status: 'intensive', isMyTeam: false, color: '#64748b',
      comments: 'Answer technical queries, draft policies, and assist with testing.' },
    { id: 'sample-02a', project: 'Example Programme', stage: 'Stage 2: Wider Pilot', executor: 'Partner Team',
      startDate: '2026-10-29', endDate: '2026-11-30', status: 'intensive', isMyTeam: false, color: '#64748b',
      comments: 'Validate the baseline across a wider group and define the next cohort.' },
    { id: 'sample-02b', project: 'Example Programme', stage: 'Stage 2: Pilot Oversight', executor: 'Core Team',
      startDate: '2026-10-29', endDate: '2026-11-30', status: 'background', isMyTeam: true, color: '#8b5cf6',
      comments: 'Low-intensity support and coordination during the wider pilot.' },
    { id: 'sample-03a', project: 'Example Programme', stage: 'Stage 3: Cohort Onboarding', executor: 'Partner Team',
      startDate: '2026-12-14', endDate: '2027-01-08', status: 'intensive', isMyTeam: false, color: '#64748b',
      comments: 'Onboard the pilot cohort and define the full rollout groups.' },
    { id: 'sample-03b', project: 'Example Programme', stage: 'Stage 3: Escalation Support', executor: 'Core Team',
      startDate: '2026-12-14', endDate: '2027-01-08', status: 'background', isMyTeam: true, color: '#8b5cf6',
      comments: 'Low-intensity technical guidance and escalation cover for the cohort.' },
    { id: 'sample-04a', project: 'Example Programme', stage: 'Stage 4: Full Rollout', executor: 'Partner Team',
      startDate: '2027-01-11', endDate: '2027-02-26', status: 'intensive', isMyTeam: false, color: '#64748b',
      comments: 'Execute the rollout in phased deployment waves.' },
    { id: 'sample-04b', project: 'Example Programme', stage: 'Stage 4: Rollout Support', executor: 'Core Team',
      startDate: '2027-01-11', endDate: '2027-02-26', status: 'background', isMyTeam: true, color: '#8b5cf6',
      comments: 'Low-intensity steering and issue escalation during the rollout.' },
  ].map((t) => normalizeTask(t))
}
