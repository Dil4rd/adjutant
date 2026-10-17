import { SAMPLE_RECORD as SPEC, sampleTasks } from './fixtures'
import { describe, expect, it } from 'vitest'
import { normalizeTask,  uid } from '../src/lib/roadmap/model'
import { diffDays, todayISO } from '../src/lib/roadmap/dates'
import { paletteFor } from '../src/lib/roadmap/colors'


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
    expect(normalizeTask({ status: 'nope' }).status).toBe('intensive')
  })

  it('defaults a missing status to intensive', () => {
    expect(normalizeTask({}).status).toBe('intensive')
  })

  it('accepts all three intensities', () => {
    for (const st of ['intensive', 'background', 'hold'] as const) {
      expect(normalizeTask({ status: st }).status).toBe(st)
    }
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

  it('assigns palette colours by index, cycling when they run out', () => {
    const mine = paletteFor(true)
    const theirs = paletteFor(false)
    expect(normalizeTask({ isMyTeam: true }, 0).color).toBe(mine[0])
    expect(normalizeTask({ isMyTeam: true }, 3).color).toBe(mine[3])
    expect(normalizeTask({ isMyTeam: true }, mine.length).color).toBe(mine[0])
    expect(normalizeTask({ isMyTeam: false }, 0).color).toBe(theirs[0])
  })

  it('keeps an explicit colour over the palette default', () => {
    expect(normalizeTask({ isMyTeam: true, color: '#8b5cf6' }, 0).color).toBe('#8b5cf6')
    expect(normalizeTask({ isMyTeam: false, color: '#64748b' }, 0).color).toBe('#64748b')
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
  it('upgrades the retired "active" status to intensive', () => {
    // 'active' was the old neutral state; it no longer exists.
    expect(normalizeTask({ status: 'active' }).status).toBe('intensive')
  })
  it('treats team:"internal" as mine', () => {
    expect(normalizeTask({ team: 'internal' }).isMyTeam).toBe(true)
  })
  it('prefers the canonical field when both are present', () => {
    expect(normalizeTask({ stage: 'new', title: 'old' }).stage).toBe('new')
    expect(normalizeTask({ isMyTeam: true, team: 'external' }).isMyTeam).toBe(true)
  })
})

describe('seed roadmap', () => {
  const seed = sampleTasks()

  it('is eight stages of one programme', () => {
    expect(seed).toHaveLength(8)
    expect(new Set(seed.map((t) => t.project)).size).toBe(1)
  })

  it('is already normalised', () => {
    expect(seed.map((t) => normalizeTask(t))).toEqual(seed)
  })

  it('pairs my team with the other team', () => {
    expect(seed.filter((t) => t.isMyTeam)).toHaveLength(4)
  })

  it('tags the low-intensity oversight stages as background', () => {
    const background = seed.filter((t) => t.status === 'background')
    expect(background.map((t) => t.id)).toEqual(['sample-02b', 'sample-03b', 'sample-04b'])
    // and each of those is exactly the one whose comment says so
    expect(background.every((t) => /low-intensity/i.test(t.comments))).toBe(true)
  })

  it('leaves no stage on a retired status', () => {
    expect(seed.every((t) => ['intensive', 'background', 'hold'].includes(t.status))).toBe(true)
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
