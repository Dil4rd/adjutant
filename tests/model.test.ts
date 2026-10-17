import { describe, expect, it } from 'vitest'
import { normalizeTask, seedTasks, uid } from '../src/lib/roadmap/model'
import { diffDays, todayISO } from '../src/lib/roadmap/dates'
import type { Task } from '../src/lib/roadmap/types'

const SPEC: Task = {
  id: 'byod-mac-01a',
  project: 'BYOD - Mac Migration',
  stage: 'Stage 1: Baseline & Internal Testing',
  executor: 'Ross',
  startDate: '2026-10-19',
  endDate: '2026-10-28',
  status: 'active',
  isMyTeam: true,
  color: '#8b5cf6',
  comments: 'Define baseline, conduct internal testing, and define the wider pilot group for Stage 2.',
}

describe('the interchange record', () => {
  it('survives normalisation untouched', () => {
    expect(normalizeTask(SPEC)).toEqual(SPEC)
  })

  it('is idempotent', () => {
    expect(normalizeTask(normalizeTask(SPEC))).toEqual(SPEC)
  })

  it('exposes exactly the canonical keys', () => {
    expect(Object.keys(normalizeTask(SPEC)).sort()).toEqual([
      'color', 'comments', 'endDate', 'executor', 'id',
      'isMyTeam', 'project', 'stage', 'startDate', 'status',
    ])
  })

  it('treats endDate as inclusive', () => {
    expect(diffDays(SPEC.startDate, SPEC.endDate) + 1).toBe(10)
  })
})

describe('coercion', () => {
  it('swaps an inverted range rather than rejecting it', () => {
    const t = normalizeTask({ startDate: '2026-05-20', endDate: '2026-05-10' })
    expect([t.startDate, t.endDate]).toEqual(['2026-05-10', '2026-05-20'])
  })

  it('defaults missing dates to today', () => {
    const t = normalizeTask({})
    expect(t.startDate).toBe(todayISO())
    expect(t.endDate).toBe(todayISO())
  })

  it('rejects an unknown status', () => {
    expect(normalizeTask({ status: 'nope' }).status).toBe('active')
  })

  it('rejects a malformed date', () => {
    expect(normalizeTask({ startDate: '19/10/2026' }).startDate).toBe(todayISO())
  })

  it('defaults isMyTeam to true', () => {
    expect(normalizeTask({}).isMyTeam).toBe(true)
  })

  it('generates an id when absent, and keeps one when given', () => {
    expect(normalizeTask({}).id).toMatch(/^t_/)
    expect(normalizeTask({ id: 'keep-me' }).id).toBe('keep-me')
  })

  it('mints distinct ids', () => {
    expect(new Set(Array.from({ length: 200 }, uid)).size).toBe(200)
  })

  it('survives junk input entirely', () => {
    for (const junk of [null, undefined, 42, 'string', [], true]) {
      expect(() => normalizeTask(junk)).not.toThrow()
      expect(normalizeTask(junk).project).toBe('Unassigned')
    }
  })

  it('assigns palette colours by index', () => {
    expect(normalizeTask({ isMyTeam: true }, 0).color).toBe('#8b5cf6')
    expect(normalizeTask({ isMyTeam: false }, 0).color).toBe('#64748b')
  })

  it('clamps overlong text', () => {
    expect(normalizeTask({ project: 'x'.repeat(500) }).project.length).toBe(120)
    expect(normalizeTask({ comments: 'x'.repeat(9000) }).comments.length).toBe(4000)
  })
})

describe('legacy aliases still load', () => {
  const legacy = normalizeTask({
    project: 'P', title: 'Old title', start: '2026-01-05', end: '2026-01-09',
    team: 'external', notes: 'note body', owner: 'Owner Name',
  })

  it('maps title to stage', () => expect(legacy.stage).toBe('Old title'))
  it('maps start/end to startDate/endDate', () => {
    expect(legacy.startDate).toBe('2026-01-05')
    expect(legacy.endDate).toBe('2026-01-09')
  })
  it('maps team to isMyTeam', () => expect(legacy.isMyTeam).toBe(false))
  it('maps notes to comments', () => expect(legacy.comments).toBe('note body'))
  it('maps owner to executor', () => expect(legacy.executor).toBe('Owner Name'))
  it('treats team:"internal" as mine', () => {
    expect(normalizeTask({ team: 'internal' }).isMyTeam).toBe(true)
  })
  it('prefers the canonical field when both are present', () => {
    expect(normalizeTask({ stage: 'new', title: 'old' }).stage).toBe('new')
    expect(normalizeTask({ isMyTeam: true, team: 'external' }).isMyTeam).toBe(true)
  })
})

describe('seed roadmap', () => {
  const seed = seedTasks()

  it('is the BYOD migration', () => {
    expect(seed).toHaveLength(8)
    expect(seed.every((t) => t.project === 'BYOD - Mac Migration')).toBe(true)
  })

  it('is already normalised', () => {
    expect(seed.map((t) => normalizeTask(t))).toEqual(seed)
  })

  it('pairs my team with the external team', () => {
    expect(seed.filter((t) => t.isMyTeam)).toHaveLength(4)
  })

  it('runs its stages consecutively without overlap', () => {
    const mine = seed.filter((t) => t.isMyTeam)
    for (let i = 1; i < mine.length; i++) {
      expect(mine[i - 1].endDate < mine[i].startDate).toBe(true)
    }
  })

  it('has unique ids', () => {
    expect(new Set(seed.map((t) => t.id)).size).toBe(seed.length)
  })
})
