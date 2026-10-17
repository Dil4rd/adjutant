<script lang="ts">
  import { blockSkin } from '../lib/roadmap/colors'
  import { STATUS_SHORT } from '../lib/roadmap/types'
  import type { Segment } from '../lib/roadmap/layout'

  let {
    seg,
    showProject,
    laneH,
    blockH,
    lanePad,
  }: {
    seg: Segment
    showProject: boolean
    laneH: number
    blockH: number
    lanePad: number
  } = $props()

  const t = $derived(seg.task)
  const skin = $derived(blockSkin(t))
  const insetL = $derived(seg.clipS ? 0 : 2)
  const insetR = $derived(seg.clipE ? 0 : 2)

  const style = $derived(
    [
      `left:calc(${((seg.col / 7) * 100).toFixed(4)}% + ${insetL}px)`,
      `width:calc(${((seg.span / 7) * 100).toFixed(4)}% - ${insetL + insetR}px)`,
      `top:${seg.lane * laneH + lanePad}px`,
      `height:${blockH}px`,
      `background-color:${skin.fill}`,
      `border-color:${skin.border}`,
      `color:${skin.text}`,
    ].join(';'),
  )

  const tip = $derived(
    `${t.project} — ${t.stage}` +
      (t.executor ? `\nExecutor: ${t.executor}` : '') +
      `\n${t.startDate} → ${t.endDate}` +
      `\n${STATUS_SHORT[t.status]} · ${t.isMyTeam ? 'My team' : 'Not my team'}` +
      (t.comments ? `\n\n${t.comments}` : ''),
  )
</script>

<div
  class="block s-{t.status}"
  class:clip-s={seg.clipS}
  class:clip-e={seg.clipE}
  data-id={t.id}
  {style}
  title={tip}
>
  <div class="handle l" data-edge="start"></div>
  <div class="t1">{showProject ? `${t.project} · ${t.stage}` : t.stage}</div>
  {#if t.executor}<div class="t2">{t.executor}</div>{/if}
  <div class="handle r" data-edge="end"></div>
</div>
