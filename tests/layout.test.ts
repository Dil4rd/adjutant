import { sampleTasks } from './fixtures'
import { describe, expect, it } from 'vitest'
import { layoutWeek } from '../src/lib/roadmap/layout'
import { normalizeTask } from '../src/lib/roadmap/model'
import { monthWeeks, iso } from '../src/lib/roadmap/dates'
import type { Task } from '../src/lib/roadmap/types'

const task = (id: string, startDate: string, endDate: string): Task =>
  normalizeTask({ id, project: 'X', stage: id, startDate, endDate })

// week of Mon 2026-10-12 .. Sun 2026-10-18
const WEEK = '2026-10-12'

describe('segment geometry', () => {
  it('places a task at the right column and span', () => {
    const { segs } = layoutWeek(WEEK, [task('a', '2026-10-12', '2026-10-14')])
    expect(segs[0].col).toBe(0)
    expect(segs[0].span).toBe(3)
    expect(segs[0].clipS).toBe(false)
    expect(segs[0].clipE).toBe(false)
  })

  it('clips a task that spans the whole week', () => {
    const { segs } = layoutWeek(WEEK, [task('z', '2026-10-05', '2026-10-30')])
    expect(segs[0].col).toBe(0)
    expect(segs[0].span).toBe(7)
    expect(segs[0].clipS).toBe(true)
    expect(segs[0].clipE).toBe(true)
  })

  it('clips only the trailing edge when the task starts mid-week', () => {
    const { segs } = layoutWeek(WEEK, [task('b', '2026-10-15', '2026-10-30')])
    expect(segs[0].col).toBe(3)
    expect(segs[0].span).toBe(4)
    expect(segs[0].clipS).toBe(false)
    expect(segs[0].clipE).toBe(true)
  })

  it('excludes tasks outside the week', () => {
    expect(layoutWeek(WEEK, [task('before', '2026-10-01', '2026-10-11')]).segs).toHaveLength(0)
    expect(layoutWeek(WEEK, [task('after', '2026-10-19', '2026-10-25')]).segs).toHaveLength(0)
  })

  it('includes tasks touching the boundary days', () => {
    expect(layoutWeek(WEEK, [task('mon', '2026-10-05', '2026-10-12')]).segs).toHaveLength(1)
    expect(layoutWeek(WEEK, [task('sun', '2026-10-18', '2026-10-25')]).segs).toHaveLength(1)
  })

  it('handles a single-day task', () => {
    const { segs } = layoutWeek(WEEK, [task('one', '2026-10-14', '2026-10-14')])
    expect(segs[0].span).toBe(1)
    expect(segs[0].col).toBe(2)
  })
})

describe('lane packing', () => {
  const tasks = [
    task('a', '2026-10-12', '2026-10-14'),
    task('b', '2026-10-13', '2026-10-16'),
    task('c', '2026-10-15', '2026-10-18'),
  ]

  it('reuses a lane for non-overlapping segments', () => {
    const { segs, laneCount } = layoutWeek(WEEK, tasks)
    const byId = Object.fromEntries(segs.map((s) => [s.task.id, s]))
    expect(laneCount).toBe(2)
    expect(byId.a.lane).toBe(0)
    expect(byId.c.lane).toBe(0) // starts after a ends
    expect(byId.b.lane).toBe(1) // overlaps both
  })

  it('never collides within a lane', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      task('t' + i, `2026-10-${12 + (i % 7)}`, `2026-10-${12 + ((i % 7) + (i % 3))}`),
    )
    const { segs } = layoutWeek(WEEK, many)
    for (const p of segs) {
      for (const q of segs) {
        if (p === q || p.lane !== q.lane) continue
        expect(p.col < q.col + q.span && q.col < p.col + p.span).toBe(false)
      }
    }
  })

  it('packs into the minimum number of lanes for a simple chain', () => {
    const chain = [
      task('x', '2026-10-12', '2026-10-13'),
      task('y', '2026-10-14', '2026-10-15'),
      task('z', '2026-10-16', '2026-10-18'),
    ]
    expect(layoutWeek(WEEK, chain).laneCount).toBe(1)
  })

  it('is deterministic regardless of input order', () => {
    const forward = layoutWeek(WEEK, tasks).segs.map((s) => [s.task.id, s.lane])
    const reversed = layoutWeek(WEEK, [...tasks].reverse()).segs.map((s) => [s.task.id, s.lane])
    expect(reversed).toEqual(forward)
  })

  it('reports no lanes for an empty week', () => {
    expect(layoutWeek(WEEK, []).laneCount).toBe(0)
  })
})

describe('whole-month coverage', () => {
  it('renders every seeded task somewhere across its months', () => {
    const seed = sampleTasks()
    const seen = new Set<string>()
    for (const [y, m] of [[2026, 9], [2026, 10], [2026, 11], [2027, 0], [2027, 1]] as const) {
      for (const week of monthWeeks(y, m)) {
        for (const sg of layoutWeek(iso(week[0]), seed).segs) seen.add(sg.task.id)
      }
    }
    expect(seen.size).toBe(seed.length)
  })

  it('splits a multi-week task into contiguous segments that sum to its length', () => {
    const t = task('long', '2026-10-19', '2026-11-30')
    let days = 0
    const weeks = new Set<string>()
    for (const [y, m] of [[2026, 9], [2026, 10]] as const) {
      for (const week of monthWeeks(y, m)) {
        const ws = iso(week[0])
        if (weeks.has(ws)) continue // month grids overlap at the edges
        weeks.add(ws)
        for (const sg of layoutWeek(ws, [t]).segs) days += sg.span
      }
    }
    expect(days).toBe(43) // 2026-10-19 .. 2026-11-30 inclusive
  })
})
