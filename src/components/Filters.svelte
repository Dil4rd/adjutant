<script lang="ts">
  import type { Task } from '../lib/roadmap/types'

  let {
    tasks,
    project,
    showOtherTeams,
    onSelect,
    onToggleOtherTeams,
  }: {
    tasks: Task[]
    project: string
    showOtherTeams: boolean
    onSelect: (p: string) => void
    onToggleOtherTeams: () => void
  } = $props()

  const projects = $derived([...new Set(tasks.map((t) => t.project))].sort((a, b) => a.localeCompare(b)))
  const otherCount = $derived(tasks.filter((t) => !t.isMyTeam).length)
</script>

<div class="filters" id="filters">
  <span class="label">Project</span>
  <button data-project="All" class:on={project === 'All'} onclick={() => onSelect('All')}>All</button>
  {#each projects as p (p)}
    <button data-project={p} class:on={project === p} onclick={() => onSelect(p)}>{p}</button>
  {/each}

  <span class="spacer"></span>
  <button
    id="btnOtherTeams"
    class="toggle"
    class:on={showOtherTeams}
    aria-pressed={showOtherTeams}
    title={showOtherTeams ? 'Hide work owned by other teams' : 'Show work owned by other teams'}
    onclick={onToggleOtherTeams}
  >
    <span class="box" aria-hidden="true"></span>
    Other teams{otherCount ? ` (${otherCount})` : ''}
  </button>
</div>
