import { sampleTasks } from './fixtures'
import { normalizeTask } from '../src/lib/roadmap/model'
import { describe, expect, it } from 'vitest'
import { buildExport, earliestStart, exportText, mergeById, parseImport } from '../src/lib/roadmap/io'
import type { Meta } from '../src/lib/roadmap/types'

const META: Meta = { version: 1, name: 'Roadmap', updatedAt: null }

const SPEC_ARRAY = sampleTasks().slice(0, 2)

describe('import', () => {
  it('accepts a current-format array verbatim', () => {
    expect(parseImport(JSON.stringify(SPEC_ARRAY)).tasks).toEqual(SPEC_ARRAY)
  })

  it('upgrades a legacy file whose stages are all "active"', () => {
    const legacy = SPEC_ARRAY.map((t) => ({ ...t, status: 'active' }))
    const { tasks } = parseImport(JSON.stringify(legacy))
    expect(tasks.every((t) => t.status === 'intensive')).toBe(true)
    // everything else survives the upgrade untouched
    expect(tasks.map(({ status, ...rest }) => rest)).toEqual(
      SPEC_ARRAY.map(({ status, ...rest }) => rest),
    )
  })

  it('accepts an export envelope', () => {
    const env = buildExport(META, sampleTasks())
    const back = parseImport(JSON.stringify(env))
    expect(back.tasks).toEqual(env.tasks)
    expect(back.name).toBe('Roadmap')
  })

  it('rejects malformed JSON with a readable message', () => {
    expect(() => parseImport('{not json')).toThrow(/not valid JSON/)
  })

  it('rejects the wrong shape', () => {
    expect(() => parseImport('{"nope":1}')).toThrow(/Expected a JSON array/)
    expect(() => parseImport('42')).toThrow(/Expected a JSON array/)
    expect(() => parseImport('"a string"')).toThrow(/Expected a JSON array/)
  })

  it('rejects an empty set', () => {
    expect(() => parseImport('[]')).toThrow(/no tasks/)
    expect(() => parseImport('{"tasks":[]}')).toThrow(/no tasks/)
  })

  it('fills defaults for a sparse record', () => {
    const [t] = parseImport('[{"project":"P","stage":"S"}]').tasks
    expect(t.status).toBe('intensive')
    expect(t.isMyTeam).toBe(true)
    expect(t.executor).toBe('')
    expect(t.id).toMatch(/^t_/)
  })

  it('normalises junk entries instead of throwing', () => {
    expect(() => parseImport('[null, 5, {"project":"ok"}]')).not.toThrow()
    expect(parseImport('[null, 5, {"project":"ok"}]').tasks).toHaveLength(3)
  })
})

describe('export', () => {
  const tasks = sampleTasks()
  const env = buildExport(META, tasks)

  it('carries tasks and metadata', () => {
    expect(env.version).toBe(1)
    expect(env.app).toBe('adjutant-roadmap')
    expect(env.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(env.meta.taskCount).toBe(tasks.length)
    expect(env.meta.projects).toEqual(['Example Programme'])
  })

  it('writes tasks in the interchange shape', () => {
    expect(Object.keys(env.tasks[0]).sort()).toEqual([
      'color', 'comments', 'endDate', 'executor', 'id',
      'isMyTeam', 'project', 'stage', 'startDate', 'status',
    ])
  })

  it('round-trips through import unchanged', () => {
    expect(parseImport(JSON.stringify(env)).tasks).toEqual(tasks)
  })

  it('sorts and dedupes the project list', () => {
    const mixed = [...tasks, { ...tasks[0], id: 'x', project: 'Alpha' }]
    expect(buildExport(META, mixed).meta.projects).toEqual(['Alpha', 'Example Programme'])
  })
})

describe('merge', () => {
  const tasks = sampleTasks()

  it('overwrites by id and keeps the count', () => {
    const edited = { ...tasks[0], stage: 'Rewritten' }
    const merged = mergeById(tasks, [edited])
    expect(merged).toHaveLength(tasks.length)
    expect(merged.find((t) => t.id === edited.id)!.stage).toBe('Rewritten')
  })

  it('appends genuinely new ids', () => {
    const merged = mergeById(tasks, [{ ...tasks[0], id: 'brand-new' }])
    expect(merged).toHaveLength(tasks.length + 1)
  })

  it('preserves existing order', () => {
    const merged = mergeById(tasks, [{ ...tasks[2], stage: 'Changed' }])
    expect(merged.map((t) => t.id)).toEqual(tasks.map((t) => t.id))
  })
})

describe('viewport targeting', () => {
  it('finds the earliest start', () => {
    expect(earliestStart(sampleTasks())).toBe('2026-10-19')
  })
})

describe('export text', () => {
  const tasks = sampleTasks()

  it('is what the download and the clipboard both carry', () => {
    const text = exportText(META, tasks)
    expect(JSON.parse(text)).toEqual({ ...buildExport(META, tasks), exportedAt: JSON.parse(text).exportedAt })
  })

  it('is pretty-printed, so a pasted roadmap stays readable', () => {
    expect(exportText(META, tasks)).toContain('\n  "tasks": [')
  })

  it('round-trips straight back through import', () => {
    expect(parseImport(exportText(META, tasks)).tasks).toEqual(tasks)
  })

  it('handles an empty roadmap without throwing', () => {
    expect(() => exportText(META, [])).not.toThrow()
    expect(JSON.parse(exportText(META, [])).tasks).toEqual([])
  })
})

describe('export completeness', () => {
  /**
   * Export must carry the WHOLE roadmap. What is on the calendar is a
   * function of the filters and the twelve-month window; neither has any
   * business narrowing a backup.
   */
  const far = normalizeTask({ id: 'far', project: 'Alpha', stage: 'Years out', startDate: '2031-04-01', endDate: '2031-04-20' })
  const past = normalizeTask({ id: 'past', project: 'Alpha', stage: 'Long past', startDate: '2019-01-07', endDate: '2019-02-02' })
  const hidden = normalizeTask({ id: 'hid', project: 'Beta', stage: 'Other team', isMyTeam: false })
  const all = [far, past, hidden]

  it('includes tasks far outside any rendered window', () => {
    const ids = buildExport(META, all).tasks.map((t) => t.id)
    expect(ids).toEqual(['far', 'past', 'hid'])
  })

  it('counts and lists every project, not just the filtered ones', () => {
    const env = buildExport(META, all)
    expect(env.meta.taskCount).toBe(3)
    expect(env.meta.projects).toEqual(['Alpha', 'Beta'])
  })

  it('round-trips the whole set', () => {
    expect(parseImport(exportText(META, all)).tasks).toEqual(all)
  })

  it('keeps a nameless stage rather than dropping or renaming it', () => {
    const nameless = normalizeTask({ id: 'n', project: 'Alpha', stage: '' })
    const back = parseImport(exportText(META, [nameless])).tasks[0]
    expect(back.stage).toBe('')
    expect(back).toEqual(nameless)
  })
})
