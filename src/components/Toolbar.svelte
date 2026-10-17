<script lang="ts">
  import { MONTHS, parseISO } from '../lib/roadmap/dates'
  import type { ViewState } from '../lib/roadmap/types'

  let {
    view,
    total,
    visible,
    onMonths,
    onShift,
    onToday,
    onNew,
    onExport,
    onImport,
    onBackupKey,
    onLock,
  }: {
    view: ViewState
    total: number
    visible: number
    onMonths: (n: 1 | 2 | 3) => void
    onShift: (n: number) => void
    onToday: () => void
    onNew: () => void
    onExport: () => void
    onImport: () => void
    onBackupKey: () => void
    onLock: () => void
  } = $props()

  const range = $derived.by(() => {
    const a = parseISO(view.anchor)
    const b = new Date(a.getFullYear(), a.getMonth() + view.months - 1, 1, 12)
    const head =
      MONTHS[a.getMonth()].slice(0, 3) +
      ' ' +
      a.getFullYear() +
      (view.months > 1 ? ' – ' + MONTHS[b.getMonth()].slice(0, 3) + ' ' + b.getFullYear() : '')
    const count = visible === total ? `${total} tasks` : `${visible} of ${total} tasks`
    return `${head}  ·  ${count}`
  })
</script>

<header class="bar">
  <div class="brand">Adjutant <span>roadmap</span></div>
  <div class="group boxed" id="viewToggle">
    {#each [1, 2, 3] as n (n)}
      <button data-months={n} class:on={view.months === n} onclick={() => onMonths(n as 1 | 2 | 3)}>
        {n} Month{n > 1 ? 's' : ''}
      </button>
    {/each}
  </div>
  <div class="group">
    <button id="btnPrev" title="Previous month" onclick={() => onShift(-1)}>&larr;</button>
    <button id="btnToday" onclick={onToday}>Today</button>
    <button id="btnNext" title="Next month" onclick={() => onShift(1)}>&rarr;</button>
  </div>
  <div class="range" id="rangeLabel">{range}</div>
  <div class="spacer"></div>
  <button id="btnNew" class="primary" onclick={onNew}>+ New Task</button>
  <button id="btnExport" onclick={onExport}>Export JSON</button>
  <button id="btnImport" onclick={onImport}>Import JSON</button>
  <button id="btnEnrolMore" class="ghost" title="Enrol a backup passkey" onclick={onBackupKey}>
    + Backup key
  </button>
  <button id="btnLock" class="ghost" title="Lock and clear the key from memory" onclick={onLock}>
    Lock
  </button>
</header>
