import { describe, expect, it } from 'vitest'
import { buildExport, earliestStart, mergeById, parseImport } from '../src/lib/roadmap/io'
import { seedTasks } from '../src/lib/roadmap/model'
import type { Meta } from '../src/lib/roadmap/types'

const META: Meta = { version: 1, name: 'Roadmap', updatedAt: null }

const SPEC_ARRAY = [
  {
    id: 'byod-mac-01a', project: 'BYOD - Mac Migration',
    stage: 'Stage 1: Baseline & Internal Testing', executor: 'Ross',
    startDate: '2026-10-19', endDate: '2026-10-28', status: 'active',
    isMyTeam: true, color: '#8b5cf6',
    comments: 'Define baseline, conduct internal testing, and define the wider pilot group for Stage 2.',
  },
  {
    id: 'byod-mac-01b', project: 'BYOD - Mac Migration',
    stage: 'Stage 1: Policy & Testing Support', executor: 'External Team',
    startDate: '2026-10-19', endDate: '2026-10-28', status: 'active',
    isMyTeam: false, color: '#64748b',
    comments: 'Support internal team: answer technical queries, create policies, and assist with testing.',
  },
]

describe('import', () => {
  it('accepts the supplied array verbatim', () => {
    expect(parseImport(JSON.stringify(SPEC_ARRAY)).tasks).toEqual(SPEC_ARRAY)
  })

  it('accepts an export envelope', () => {
    const env = buildExport(META, seedTasks())
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
    expect(t.status).toBe('active')
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
  const tasks = seedTasks()
  const env = buildExport(META, tasks)

  it('carries tasks and metadata', () => {
    expect(env.version).toBe(1)
    expect(env.app).toBe('adjutant-roadmap')
    expect(env.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(env.meta.taskCount).toBe(tasks.length)
    expect(env.meta.projects).toEqual(['BYOD - Mac Migration'])
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
    expect(buildExport(META, mixed).meta.projects).toEqual(['Alpha', 'BYOD - Mac Migration'])
  })
})

describe('merge', () => {
  const tasks = seedTasks()

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
    expect(earliestStart(seedTasks())).toBe('2026-10-19')
  })
})
