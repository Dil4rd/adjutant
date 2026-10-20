<script lang="ts">
  import { clearedFilters, filterOptions, isFiltering } from '../lib/roadmap/model'
  import {
    STATUSES, STATUS_LABEL, TEAM_LABEL, TEAM_VALUES,
    type Status, type Task, type TeamValue, type ViewState,
  } from '../lib/roadmap/types'
  import FilterSelect from './FilterSelect.svelte'

  let {
    tasks,
    view,
    onChange,
  }: {
    tasks: Task[]
    view: ViewState
    onChange: (patch: Partial<ViewState>) => void
  } = $props()

  // Project and executor options come from the data, so a filter can never
  // offer a value that matches nothing. Team and intensity are fixed
  // vocabularies, always offered in full.
  const options = $derived(filterOptions(tasks))
  const filtering = $derived(isFiltering(view))
  const asOptions = (xs: string[]) => xs.map((v) => ({ value: v, label: v }))
</script>

<div class="filters" id="filters">
  <FilterSelect
    id="filterProject"
    label="Project"
    options={asOptions(options.projects)}
    selected={view.projects}
    onChange={(projects) => onChange({ projects })}
  />
  <FilterSelect
    id="filterExecutor"
    label="Executor"
    options={asOptions(options.executors)}
    selected={view.executors}
    onChange={(executors) => onChange({ executors })}
  />
  <FilterSelect
    id="filterTeam"
    label="Team"
    options={TEAM_VALUES.map((v) => ({ value: v, label: TEAM_LABEL[v] }))}
    selected={view.teams}
    onChange={(teams) => onChange({ teams: teams as TeamValue[] })}
  />
  <FilterSelect
    id="filterStatus"
    label="Intensity"
    options={STATUSES.map((v) => ({ value: v, label: STATUS_LABEL[v] }))}
    selected={view.statuses}
    onChange={(statuses) => onChange({ statuses: statuses as Status[] })}
  />

  {#if filtering}
    <button id="btnClearFilters" class="link" onclick={() => onChange(clearedFilters())}>
      Clear filters
    </button>
  {/if}
</div>
