// Import / export, kept free of the DOM so it is directly testable.

import { todayISO } from './dates'
import { normalizeTask } from './model'
import type { ExportEnvelope, Meta, Task } from './types'

export function buildExport(meta: Meta, tasks: Task[]): ExportEnvelope {
  return {
    version: 1,
    app: 'adjutant-roadmap',
    exportedAt: new Date().toISOString(),
    meta: {
      ...meta,
      taskCount: tasks.length,
      projects: [...new Set(tasks.map((t) => t.project))].sort(),
    },
    tasks,
  }
}

/** The exact bytes both Export JSON and Copy produce. */
export function exportText(meta: Meta, tasks: Task[]): string {
  return JSON.stringify(buildExport(meta, tasks), null, 2)
}

export interface ParsedImport {
  tasks: Task[]
  name?: string
}

/**
 * Accepts a bare array of tasks or a full export envelope. Throws with a
 * message fit to show the user — the caller renders it verbatim.
 */
export function parseImport(text: string): ParsedImport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new Error('That is not valid JSON: ' + (err as Error).message)
  }

  const envelope = parsed as Partial<ExportEnvelope> | undefined
  const rawTasks = Array.isArray(parsed)
    ? parsed
    : Array.isArray(envelope?.tasks)
      ? envelope.tasks
      : null

  if (!rawTasks) throw new Error('Expected a JSON array, or an object with a "tasks" array.')
  if (!rawTasks.length) throw new Error('That file contains no tasks.')

  const name = typeof envelope?.meta?.name === 'string' ? envelope.meta.name : undefined
  return { tasks: rawTasks.map((t, i) => normalizeTask(t, i)), name }
}

/** Merge incoming over existing by id, preserving existing order. */
export function mergeById(existing: Task[], incoming: Task[]): Task[] {
  const byId = new Map(existing.map((t) => [t.id, t]))
  for (const t of incoming) byId.set(t.id, t)
  return [...byId.values()]
}

/** Earliest start across the set; today's date when the set is empty. */
export const earliestStart = (tasks: Task[]): string =>
  tasks.length ? tasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), tasks[0].startDate) : todayISO()
