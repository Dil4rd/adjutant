import { SAMPLE_RECORD as SPEC, sampleTasks } from './fixtures'
import { describe, expect, it } from 'vitest'
import {
  clearedFilters, filterOptions, isFiltering, matchesView, normalizeTask, normalizeView,
  projectHues, pruneView, uid,
} from '../src/lib/roadmap/model'
import { diffDays, todayISO } from '../src/lib/roadmap/dates'
import { palette } from '../src/lib/roadmap/colors'


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
    const pal = palette()
    expect(normalizeTask({ isMyTeam: true }, 0).color).toBe(pal[0])
    expect(normalizeTask({ isMyTeam: true }, 3).color).toBe(pal[3])
    expect(normalizeTask({ isMyTeam: true }, pal.length).color).toBe(pal[0])
    // ownership no longer changes which ramp is used
    expect(normalizeTask({ isMyTeam: false }, 0).color).toBe(pal[0])
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

describe('project hue', () => {
  it('takes the colour of the earliest my-team stage', () => {
    const hues = projectHues([
      normalizeTask({ id: 'b', project: 'P', startDate: '2026-02-01', isMyTeam: true, color: '#22c55e' }),
      normalizeTask({ id: 'a', project: 'P', startDate: '2026-01-01', isMyTeam: true, color: '#3b82f6' }),
    ])
    expect(hues.get('P')).toBe('#3b82f6')
  })

  it('ignores other-team colours when my team is present', () => {
    // exactly the mixed-file case: ownership used to be carried by hue
    const hues = projectHues([
      normalizeTask({ id: 'x', project: 'P', startDate: '2026-01-01', isMyTeam: false, color: '#64748b' }),
      normalizeTask({ id: 'y', project: 'P', startDate: '2026-01-05', isMyTeam: true, color: '#8b5cf6' }),
    ])
    expect(hues.get('P')).toBe('#8b5cf6')
  })

  it('falls back to the earliest stage when nothing is mine', () => {
    const hues = projectHues([
      normalizeTask({ id: 'x', project: 'P', startDate: '2026-03-01', isMyTeam: false, color: '#f97316' }),
      normalizeTask({ id: 'y', project: 'P', startDate: '2026-01-01', isMyTeam: false, color: '#eab308' }),
    ])
    expect(hues.get('P')).toBe('#eab308')
  })

  it('keeps projects independent', () => {
    const hues = projectHues([
      normalizeTask({ id: 'a', project: 'P', isMyTeam: true, color: '#3b82f6' }),
      normalizeTask({ id: 'b', project: 'Q', isMyTeam: true, color: '#e44332' }),
    ])
    expect(hues.get('P')).toBe('#3b82f6')
    expect(hues.get('Q')).toBe('#e44332')
    expect(hues.size).toBe(2)
  })

  it('is deterministic when dates tie', () => {
    const build = () => [
      normalizeTask({ id: 'zzz', project: 'P', startDate: '2026-01-01', isMyTeam: true, color: '#22c55e' }),
      normalizeTask({ id: 'aaa', project: 'P', startDate: '2026-01-01', isMyTeam: true, color: '#3b82f6' }),
    ]
    expect(projectHues(build()).get('P')).toBe('#3b82f6') // id breaks the tie
    expect(projectHues(build().reverse()).get('P')).toBe('#3b82f6')
  })

  it('handles an empty roadmap', () => {
    expect(projectHues([]).size).toBe(0)
  })

  it('gives the whole seeded programme one hue', () => {
    const hues = projectHues(sampleTasks())
    expect(hues.size).toBe(1)
    expect([...hues.values()][0]).toBe('#8b5cf6')
  })
})

describe('view normalisation', () => {
  const ANCHOR = '2026-10-01'
  const EMPTY = { months: 2, anchor: ANCHOR, projects: [], executors: [], teams: [], statuses: [] }

  it('fills a fresh view with empty (non-filtering) sets', () => {
    const v = normalizeView(null, ANCHOR)
    expect(v).toEqual(EMPTY)
    expect(isFiltering(v)).toBe(false)
  })

  it('migrates the original showOtherTeams flag', () => {
    expect(normalizeView({ showOtherTeams: false }, ANCHOR).teams).toEqual(['mine'])
    expect(normalizeView({ showOtherTeams: true }, ANCHOR).teams).toEqual([])
  })

  it('migrates the single-select filter bar', () => {
    const v = normalizeView({ project: 'Alpha', executor: 'Core Team', team: 'theirs' }, ANCHOR)
    expect(v.projects).toEqual(['Alpha'])
    expect(v.executors).toEqual(['Core Team'])
    expect(v.teams).toEqual(['theirs'])
  })

  it('treats the old "All" sentinel as not filtering', () => {
    const v = normalizeView({ project: 'All', executor: 'All', team: 'all' }, ANCHOR)
    expect(isFiltering(v)).toBe(false)
  })

  it('prefers the set form when both are present', () => {
    const v = normalizeView({ projects: ['Beta'], project: 'Alpha' }, ANCHOR)
    expect(v.projects).toEqual(['Beta'])
  })

  it('keeps a valid stored view intact', () => {
    const v = { months: 3 as const, anchor: '2027-01-01', projects: ['Alpha', 'Beta'],
      executors: ['Core Team'], teams: ['mine' as const], statuses: ['hold' as const] }
    expect(normalizeView(v, ANCHOR)).toEqual(v)
  })

  it('discards junk inside the sets rather than trusting it', () => {
    const v = normalizeView(
      { projects: ['ok', 5, null, ''], teams: ['mine', 'nonsense'], statuses: ['hold', 'active'] },
      ANCHOR,
    )
    expect(v.projects).toEqual(['ok'])
    expect(v.teams).toEqual(['mine'])
    expect(v.statuses).toEqual(['hold']) // "active" was retired
  })

  it('falls back to showing everything rather than hiding work', () => {
    for (const junk of ['string', 42, [], { teams: 'mine' }, { projects: 'Alpha' }]) {
      expect(isFiltering(normalizeView(junk, ANCHOR))).toBe(false)
    }
  })

  it('rejects an out-of-range month count and a malformed anchor', () => {
    expect(normalizeView({ months: 7 }, ANCHOR).months).toBe(2)
    expect(normalizeView({ anchor: 'last tuesday' }, ANCHOR).anchor).toBe(ANCHOR)
  })
})

describe('filtering', () => {
  const ANCHOR = '2026-10-01'
  const base = normalizeView(null, ANCHOR)
  const mine = normalizeTask({ project: 'Alpha', executor: 'Core Team', isMyTeam: true, status: 'intensive' })
  const theirs = normalizeTask({ project: 'Beta', executor: 'Partner', isMyTeam: false, status: 'hold' })

  it('passes everything when every set is empty', () => {
    expect(matchesView(mine, base)).toBe(true)
    expect(matchesView(theirs, base)).toBe(true)
  })

  it('filters by project, and accepts SEVERAL', () => {
    expect(matchesView(mine, { ...base, projects: ['Alpha'] })).toBe(true)
    expect(matchesView(theirs, { ...base, projects: ['Alpha'] })).toBe(false)
    const both = { ...base, projects: ['Alpha', 'Beta'] }
    expect(matchesView(mine, both)).toBe(true)
    expect(matchesView(theirs, both)).toBe(true)
  })

  it('filters by executor, and accepts several', () => {
    expect(matchesView(mine, { ...base, executors: ['Core Team'] })).toBe(true)
    expect(matchesView(theirs, { ...base, executors: ['Core Team'] })).toBe(false)
    expect(matchesView(theirs, { ...base, executors: ['Core Team', 'Partner'] })).toBe(true)
  })

  it('filters by team, both ways and both at once', () => {
    expect(matchesView(mine, { ...base, teams: ['mine'] })).toBe(true)
    expect(matchesView(theirs, { ...base, teams: ['mine'] })).toBe(false)
    expect(matchesView(theirs, { ...base, teams: ['theirs'] })).toBe(true)
    const both = { ...base, teams: ['mine' as const, 'theirs' as const] }
    expect(matchesView(mine, both)).toBe(true)
    expect(matchesView(theirs, both)).toBe(true)
  })

  it('filters by intensity, and accepts several', () => {
    expect(matchesView(mine, { ...base, statuses: ['intensive'] })).toBe(true)
    expect(matchesView(theirs, { ...base, statuses: ['intensive'] })).toBe(false)
    expect(matchesView(theirs, { ...base, statuses: ['hold'] })).toBe(true)
    const both = { ...base, statuses: ['intensive' as const, 'hold' as const] }
    expect(matchesView(mine, both)).toBe(true)
    expect(matchesView(theirs, both)).toBe(true)
  })

  it('combines dimensions with AND, values within one with OR', () => {
    const v = { ...base, projects: ['Alpha', 'Beta'], teams: ['mine' as const] }
    expect(matchesView(mine, v)).toBe(true)
    expect(matchesView(theirs, v)).toBe(false) // right project, wrong team
  })

  it('reports whether anything is being filtered', () => {
    expect(isFiltering(base)).toBe(false)
    expect(isFiltering({ ...base, projects: ['Alpha'] })).toBe(true)
    expect(isFiltering({ ...base, executors: ['Core Team'] })).toBe(true)
    expect(isFiltering({ ...base, teams: ['mine'] })).toBe(true)
    expect(isFiltering({ ...base, statuses: ['hold'] })).toBe(true)
  })

  it('clears every dimension at once', () => {
    expect(isFiltering({ ...base, ...clearedFilters() })).toBe(false)
  })
})

describe('filter options', () => {
  it('offers only values present in the data, sorted and deduped', () => {
    const { projects, executors } = filterOptions(sampleTasks())
    expect(projects).toEqual(['Example Programme'])
    expect(executors).toEqual(['Core Team', 'Partner Team'])
  })

  it('omits blank executors rather than offering an empty option', () => {
    const { executors } = filterOptions([
      normalizeTask({ project: 'P', executor: '' }),
      normalizeTask({ project: 'P', executor: 'Named' }),
    ])
    expect(executors).toEqual(['Named'])
  })

  it('handles an empty roadmap', () => {
    expect(filterOptions([])).toEqual({ projects: [], executors: [] })
  })
})

describe('pruning stale filters', () => {
  const ANCHOR = '2026-10-01'
  const tasks = [normalizeTask({ project: 'Alpha', executor: 'Core Team' })]
  const base = normalizeView(null, ANCHOR)

  it('drops only the values that are gone, keeping the rest', () => {
    const v = { ...base, projects: ['Alpha', 'Deleted'] }
    expect(pruneView(v, tasks).projects).toEqual(['Alpha'])
  })

  it('drops an executor that no longer exists', () => {
    expect(pruneView({ ...base, executors: ['Departed'] }, tasks).executors).toEqual([])
  })

  it('leaves filters that still match, by identity', () => {
    const v = { ...base, projects: ['Alpha'], executors: ['Core Team'] }
    expect(pruneView(v, tasks)).toBe(v)
  })

  it('never touches team or intensity, which cannot go stale', () => {
    const v = { ...base, teams: ['theirs' as const], statuses: ['hold' as const], projects: ['Gone'] }
    const out = pruneView(v, tasks)
    expect(out.teams).toEqual(['theirs'])
    expect(out.statuses).toEqual(['hold'])
  })

  it('clears both when the roadmap is emptied', () => {
    const v = { ...base, projects: ['Alpha'], executors: ['Core Team'] }
    expect(pruneView(v, [])).toMatchObject({ projects: [], executors: [] })
  })
})
