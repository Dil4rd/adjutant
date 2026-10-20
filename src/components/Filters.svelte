<script lang="ts">
  import { filterOptions, isFiltering } from '../lib/roadmap/model'
  import { ANY, TEAM_FILTERS, TEAM_FILTER_LABEL, type Task, type TeamFilter, type ViewState } from '../lib/roadmap/types'

  let {
    tasks,
    view,
    onChange,
  }: {
    tasks: Task[]
    view: ViewState
    onChange: (patch: Partial<ViewState>) => void
  } = $props()

  // NB: these ids are deliberately prefixed. The edit modal has its own
  // fProject / fExecutor fields, and an unprefixed id here would duplicate
  // them in the document whenever that modal is open.
  // Options come from the data, so a filter can never offer a value that
  // matches nothing.
  const options = $derived(filterOptions(tasks))
  const filtering = $derived(isFiltering(view))

  const clear = () => onChange({ project: ANY, executor: ANY, team: 'all' })
</script>

<div class="filters" id="filters">
  <label class="label" for="filterProject">Project</label>
  <select
    id="filterProject"
    class:on={view.project !== ANY}
    value={view.project}
    onchange={(e) => onChange({ project: (e.currentTarget as HTMLSelectElement).value })}
  >
    <option value={ANY}>All</option>
    {#each options.projects as p (p)}<option value={p}>{p}</option>{/each}
  </select>

  <label class="label" for="filterExecutor">Executor</label>
  <select
    id="filterExecutor"
    class:on={view.executor !== ANY}
    value={view.executor}
    onchange={(e) => onChange({ executor: (e.currentTarget as HTMLSelectElement).value })}
  >
    <option value={ANY}>All</option>
    {#each options.executors as x (x)}<option value={x}>{x}</option>{/each}
  </select>

  <label class="label" for="filterTeam">Team</label>
  <select
    id="filterTeam"
    class:on={view.team !== 'all'}
    value={view.team}
    onchange={(e) => onChange({ team: (e.currentTarget as HTMLSelectElement).value as TeamFilter })}
  >
    {#each TEAM_FILTERS as t (t)}<option value={t}>{TEAM_FILTER_LABEL[t]}</option>{/each}
  </select>

  {#if filtering}
    <button id="btnClearFilters" class="link" onclick={clear}>Clear filters</button>
  {/if}
</div>
