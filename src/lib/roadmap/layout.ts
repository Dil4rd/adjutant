import { diffDays, shiftISO } from './dates'
import type { Task } from './types'

export interface Segment {
  task: Task
  col: number // 0..6, Monday-based
  span: number // 1..7 days
  clipS: boolean // continues before this week
  clipE: boolean // continues after this week
  lane: number
}

export interface WeekLayout {
  segs: Segment[]
  laneCount: number
}

/**
 * A month grid wraps time, so a multi-week task is not one rectangle — it is
 * one segment per week row, clipped to that week. Lanes are packed per week
 * with a greedy first-fit (earliest start, then longest), which keeps rows as
 * short as possible; the cost is that a task may sit in a different lane from
 * one week to the next, which the clip flags make legible.
 */
export function layoutWeek(weekStartISO: string, tasks: Task[]): WeekLayout {
  const we = shiftISO(weekStartISO, 6)
  const segs: Segment[] = []

  for (const t of tasks) {
    if (t.endDate < weekStartISO || t.startDate > we) continue
    const s = t.startDate < weekStartISO ? weekStartISO : t.startDate
    const e = t.endDate > we ? we : t.endDate
    segs.push({
      task: t,
      col: diffDays(weekStartISO, s),
      span: diffDays(s, e) + 1,
      clipS: t.startDate < weekStartISO,
      clipE: t.endDate > we,
      lane: 0,
    })
  }

  segs.sort((a, b) => a.col - b.col || b.span - a.span || a.task.id.localeCompare(b.task.id))

  const lanes: Segment[][] = []
  for (const sg of segs) {
    let li = 0
    while (lanes[li]?.some((o) => sg.col < o.col + o.span && o.col < sg.col + sg.span)) li++
    ;(lanes[li] ??= []).push(sg)
    sg.lane = li
  }

  return { segs, laneCount: lanes.length }
}

/**
 * Give every month on the same row the same height for each week.
 *
 * Each month packs its own lanes, so a month carrying blocks grows rows that
 * an empty month does not — and the two panels' grid lines drift apart down
 * the page. Taking the per-row maximum for each week INDEX keeps those lines
 * level across the row.
 *
 * `perMonth[i]` is month i's own lane counts, week by week. Grouping is by
 * `cols`, which must be the number of columns actually rendered: the layout
 * collapses to fewer columns on a narrow window, and aligning against the
 * wrong grouping would be worse than not aligning at all.
 */
export function alignLanes(perMonth: number[][], cols: number): number[][] {
  if (cols < 2) return perMonth
  const out = perMonth.map((m) => [...m])
  for (let start = 0; start < out.length; start += cols) {
    const row = out.slice(start, start + cols)
    const weeks = Math.max(...row.map((m) => m.length))
    for (let w = 0; w < weeks; w++) {
      const tallest = Math.max(...row.map((m) => m[w] ?? 0))
      for (const m of row) if (w < m.length) m[w] = tallest
    }
  }
  return out
}
