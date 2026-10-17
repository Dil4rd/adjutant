import { isValidISO, todayISO } from './dates'
import { isHex, paletteFor } from './colors'
import { STATUSES, type Status, type Task } from './types'

export const uid = (): string =>
  't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** A record as it may arrive from an import: anything at all. */
type RawTask = Record<string, unknown>

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
    status: STATUSES.includes(t.status as Status) ? (t.status as Status) : 'active',
    isMyTeam,
    color: isHex(t.color) ? t.color : pal[i % pal.length],
    comments: str(t.comments, 4000) || str(t.notes, 4000),
  }
}

/**
 * The roadmap a fresh browser starts with. Stored in exactly the interchange
 * shape, so it round-trips through Export JSON unchanged.
 */
export function seedTasks(): Task[] {
  return [
    { id: 'byod-mac-01a', project: 'BYOD - Mac Migration', stage: 'Stage 1: Baseline & Internal Testing', executor: 'Ross',
      startDate: '2026-10-19', endDate: '2026-10-28', status: 'active', isMyTeam: true, color: '#8b5cf6',
      comments: 'Define baseline, conduct internal testing, and define the wider pilot group for Stage 2.' },
    { id: 'byod-mac-01b', project: 'BYOD - Mac Migration', stage: 'Stage 1: Policy & Testing Support', executor: 'External Team',
      startDate: '2026-10-19', endDate: '2026-10-28', status: 'active', isMyTeam: false, color: '#64748b',
      comments: 'Support internal team: answer technical queries, create policies, and assist with testing.' },
    { id: 'byod-mac-02a', project: 'BYOD - Mac Migration', stage: 'Stage 2: Wider Pilot Migration', executor: 'External Team',
      startDate: '2026-10-29', endDate: '2026-11-30', status: 'active', isMyTeam: false, color: '#64748b',
      comments: 'Test baseline and migration across internal team, security, and IT; define the 10-person Stage 3 cohort.' },
    { id: 'byod-mac-02b', project: 'BYOD - Mac Migration', stage: 'Stage 2: Pilot Oversight & Support', executor: 'Ross',
      startDate: '2026-10-29', endDate: '2026-11-30', status: 'active', isMyTeam: true, color: '#8b5cf6',
      comments: 'Low-intensity support and coordination during wider internal pilot testing.' },
    { id: 'byod-mac-03a', project: 'BYOD - Mac Migration', stage: 'Stage 3: 10-User Pilot Onboarding', executor: 'External Team',
      startDate: '2026-12-14', endDate: '2027-01-08', status: 'active', isMyTeam: false, color: '#64748b',
      comments: 'Onboard and complete testing for 10 users (5 tech, 5 non-tech); define full estate rollout groups.' },
    { id: 'byod-mac-03b', project: 'BYOD - Mac Migration', stage: 'Stage 3: Pilot Escalation Support', executor: 'Ross',
      startDate: '2026-12-14', endDate: '2027-01-08', status: 'active', isMyTeam: true, color: '#8b5cf6',
      comments: 'Low-intensity technical guidance and escalation support for the 10-user onboarding cohort.' },
    { id: 'byod-mac-04a', project: 'BYOD - Mac Migration', stage: 'Stage 4: Full Estate Migration', executor: 'External Team',
      startDate: '2027-01-11', endDate: '2027-02-26', status: 'active', isMyTeam: false, color: '#64748b',
      comments: 'Execute complete estate rollout across all target Mac machines in phased deployment waves.' },
    { id: 'byod-mac-04b', project: 'BYOD - Mac Migration', stage: 'Stage 4: Estate Rollout Support', executor: 'Ross',
      startDate: '2027-01-11', endDate: '2027-02-26', status: 'active', isMyTeam: true, color: '#8b5cf6',
      comments: 'Low-intensity steering and issue escalation during company-wide migration.' },
  ].map((t) => normalizeTask(t))
}
