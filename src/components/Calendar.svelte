<script lang="ts">
  import { diffDays, parseISO, shiftISO } from '../lib/roadmap/dates'
  import type { Task, ViewState } from '../lib/roadmap/types'
  import MonthPanel from './MonthPanel.svelte'

  let {
    tasks,
    view,
    onEdit,
    onCommit,
  }: {
    tasks: Task[]
    view: ViewState
    onEdit: (t: Task) => void
    onCommit: () => void
  } = $props()

  // Slim: one line per block, so a dense week stays short.
  const LANE_H = 25
  const BLOCK_H = 21
  const LANE_PAD = 3

  let host: HTMLDivElement

  const panels = $derived.by(() => {
    const a = parseISO(view.anchor)
    return Array.from({ length: view.months }, (_, i) => {
      const d = new Date(a.getFullYear(), a.getMonth() + i, 1, 12)
      return { key: `${d.getFullYear()}-${d.getMonth()}`, year: d.getFullYear(), month: d.getMonth() }
    })
  })

  /* When every visible task belongs to one project, the project name on each
     block is pure repetition that crowds out the stage title — which is the
     part that actually distinguishes them. The filter bar already names the
     project, and the hover tooltip always carries it. */
  const showProject = $derived(new Set(tasks.map((t) => t.project)).size > 1)

  interface Drag {
    task: Task
    mode: 'move' | 'resize-start' | 'resize-end'
    grabbed: string
    origin: { startDate: string; endDate: string }
    x0: number
    y0: number
    moved: boolean
  }
  let drag: Drag | null = null

  /** Which day is under the pointer, by geometry rather than hit-testing cells.
      While a gesture is live, .dragging sets pointer-events:none on every block,
      so elementFromPoint resolves to the enclosing .week; the column then comes
      from clientX against that week's rect. One code path, and it crosses week
      rows and month panels for free. */
  function dayUnderPointer(x: number, y: number): string | null {
    const week = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('.week')
    if (!(week instanceof HTMLElement) || !week.dataset.weekStart) return null
    const r = week.getBoundingClientRect()
    const col = Math.max(0, Math.min(6, Math.floor(((x - r.left) / r.width) * 7)))
    return shiftISO(week.dataset.weekStart, col)
  }

  function onPointerDown(ev: PointerEvent) {
    if (ev.button !== 0) return
    const el = ev.target as HTMLElement
    const block = el.closest('.block')
    if (!(block instanceof HTMLElement) || !block.dataset.id) return
    const task = tasks.find((t) => t.id === block.dataset.id)
    if (!task) return
    const grabbed = dayUnderPointer(ev.clientX, ev.clientY)
    if (!grabbed) return

    const handle = el.closest('.handle')
    const edge = handle instanceof HTMLElement ? handle.dataset.edge : null
    drag = {
      task,
      mode: edge === 'start' ? 'resize-start' : edge === 'end' ? 'resize-end' : 'move',
      grabbed,
      origin: { startDate: task.startDate, endDate: task.endDate },
      x0: ev.clientX,
      y0: ev.clientY,
      moved: false,
    }
    document.body.classList.add('dragging')
    // Capture on the (stable) container, not the block: a re-render replaces
    // the block node, which would silently drop capture mid-gesture.
    host.setPointerCapture(ev.pointerId)
    ev.preventDefault()
  }

  function onPointerMove(ev: PointerEvent) {
    if (!drag) return
    if (Math.abs(ev.clientX - drag.x0) + Math.abs(ev.clientY - drag.y0) > 4) drag.moved = true
    const hit = dayUnderPointer(ev.clientX, ev.clientY)
    if (!hit) return

    const { origin, mode } = drag
    let next: { startDate: string; endDate: string }
    if (mode === 'move') {
      const delta = diffDays(drag.grabbed, hit)
      next = { startDate: shiftISO(origin.startDate, delta), endDate: shiftISO(origin.endDate, delta) }
    } else if (mode === 'resize-start') {
      next = { startDate: hit > origin.endDate ? origin.endDate : hit, endDate: origin.endDate }
    } else {
      next = { startDate: origin.startDate, endDate: hit < origin.startDate ? origin.startDate : hit }
    }

    const t = drag.task
    if (next.startDate === t.startDate && next.endDate === t.endDate) return
    t.startDate = next.startDate
    t.endDate = next.endDate
  }

  function endDrag() {
    if (!drag) return
    const d = drag
    drag = null
    document.body.classList.remove('dragging')
    const changed =
      d.task.startDate !== d.origin.startDate || d.task.endDate !== d.origin.endDate
    if (changed) onCommit()
    else if (!d.moved) onEdit(d.task) // a click, not a drag
  }
</script>

<!-- A custom pointer-driven drag surface; role=application tells assistive
     tech to pass keys/pointer through rather than impose grid semantics. -->
<div
  id="months"
  role="application"
  aria-label="Roadmap calendar"
  bind:this={host}
  style="grid-template-columns:{view.months === 1
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(330px, 1fr))'}"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={endDrag}
  onpointercancel={endDrag}
>
  {#each panels as p (p.key)}
    <MonthPanel
      year={p.year}
      month={p.month}
      {tasks}
      {showProject}
      laneH={LANE_H}
      blockH={BLOCK_H}
      lanePad={LANE_PAD}
    />
  {/each}
</div>
