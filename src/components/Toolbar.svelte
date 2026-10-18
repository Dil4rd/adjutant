<script lang="ts">
  import { MONTHS, parseISO } from '../lib/roadmap/dates'
  import type { ViewState } from '../lib/roadmap/types'

  let {
    view,
    from,
    to,
    total,
    visible,
    onMonths,
    onShift,
    onToday,
    onNew,
    onExport,
    onCopy,
    onImport,
    onBackupKey,
    onLock,
    theme,
    onToggleTheme,
  }: {
    view: ViewState
    /** First and last month on screen, as offsets from view.anchor. */
    from: number
    to: number
    total: number
    visible: number
    onMonths: (n: 1 | 2 | 3) => void
    onShift: (n: number) => void
    onToday: () => void
    onNew: () => void
    onExport: () => void
    /** Same JSON, straight to the clipboard. Returns false if the browser refused. */
    onCopy: () => Promise<boolean>
    onImport: () => void
    onBackupKey: () => void
    onLock: () => void
    theme: 'dark' | 'light'
    onToggleTheme: () => void
  } = $props()

  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  async function copy() {
    const ok = await onCopy()
    if (!ok) return
    copied = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied = false), 1600)
  }

  const range = $derived.by(() => {
    const anchor = parseISO(view.anchor)
    const a = new Date(anchor.getFullYear(), anchor.getMonth() + from, 1, 12)
    const b = new Date(anchor.getFullYear(), anchor.getMonth() + to, 1, 12)
    const head =
      MONTHS[a.getMonth()].slice(0, 3) +
      ' ' +
      a.getFullYear() +
      (to > from ? ' – ' + MONTHS[b.getMonth()].slice(0, 3) + ' ' + b.getFullYear() : '')
    const plural = (n: number) => `${n} task${n === 1 ? '' : 's'}`
    const count = visible === total ? plural(total) : `${visible} of ${plural(total)}`
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
  <!-- One primary action with a variant attached, rather than a menu for two
       items: the default (download) stays a single click. -->
  <div class="group boxed">
    <button id="btnExport" title="Download a .json file" onclick={onExport}>Export JSON</button>
    <button
      id="btnExportCopy"
      class="icon"
      title="Copy the roadmap JSON to the clipboard"
      aria-label="Copy the roadmap JSON to the clipboard"
      onclick={copy}
    >
      {copied ? '✓' : '⧉'}
    </button>
  </div>
  <button id="btnImport" onclick={onImport}>Import JSON</button>
  <button
    id="btnTheme"
    class="ghost"
    aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
    title={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
    onclick={onToggleTheme}
  >
    {theme === 'dark' ? '☾' : '☀'}
  </button>
  <button id="btnEnrolMore" class="ghost" title="Enrol a backup passkey" onclick={onBackupKey}>
    + Backup key
  </button>
  <button id="btnLock" class="ghost" title="Lock and clear the key from memory" onclick={onLock}>
    Lock
  </button>
</header>
