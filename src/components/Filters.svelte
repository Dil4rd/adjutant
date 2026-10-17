<script lang="ts">
  import type { Task } from '../lib/roadmap/types'

  let {
    tasks,
    project,
    onSelect,
  }: { tasks: Task[]; project: string; onSelect: (p: string) => void } = $props()

  const projects = $derived([...new Set(tasks.map((t) => t.project))].sort((a, b) => a.localeCompare(b)))
</script>

<div class="filters" id="filters">
  <span class="label">Project</span>
  <button data-project="All" class:on={project === 'All'} onclick={() => onSelect('All')}>All</button>
  {#each projects as p (p)}
    <button data-project={p} class:on={project === p} onclick={() => onSelect(p)}>{p}</button>
  {/each}
</div>
