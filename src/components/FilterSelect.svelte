<script lang="ts">
  /**
   * A multi-select filter: a button that reports the current selection, and a
   * popover of checkboxes.
   *
   * Not a <select multiple>: that needs ctrl-click to deselect, grows the bar
   * vertically, and cannot show "2 selected" in a single line. The popover
   * keeps the bar one line whatever the data holds.
   */
  let {
    id,
    label,
    options,
    selected,
    onChange,
  }: {
    id: string
    label: string
    options: { value: string; label: string }[]
    /** Empty means "not filtering on this dimension". */
    selected: string[]
    onChange: (next: string[]) => void
  } = $props()

  let open = $state(false)
  let root: HTMLDivElement

  const summary = $derived.by(() => {
    if (!selected.length) return 'All'
    if (selected.length === 1) {
      return options.find((o) => o.value === selected[0])?.label ?? selected[0]
    }
    return `${selected.length} selected`
  })

  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    )
  }

  // Close on an outside click or Escape — a popover you cannot dismiss is a
  // worse problem than the one it solves.
  $effect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.contains(e.target as Node)) open = false
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        open = false
      }
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  })
</script>

<div class="fsel" bind:this={root}>
  <span class="label" id="{id}Label">{label}</span>
  <button
    {id}
    class="fsel-btn"
    class:on={selected.length > 0}
    aria-haspopup="true"
    aria-expanded={open}
    aria-labelledby="{id}Label {id}"
    onclick={() => (open = !open)}
  >
    {summary}<span class="caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div class="fsel-pop" id="{id}Pop" role="group" aria-labelledby="{id}Label">
      <button
        class="fsel-all"
        disabled={selected.length === 0}
        onclick={() => onChange([])}
      >
        All
      </button>
      {#each options as o (o.value)}
        <label class="fsel-opt">
          <input
            type="checkbox"
            value={o.value}
            checked={selected.includes(o.value)}
            onchange={() => toggle(o.value)}
          />
          <span>{o.label}</span>
        </label>
      {/each}
      {#if !options.length}
        <p class="fsel-none">Nothing to filter by yet.</p>
      {/if}
    </div>
  {/if}
</div>
