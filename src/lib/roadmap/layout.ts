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
