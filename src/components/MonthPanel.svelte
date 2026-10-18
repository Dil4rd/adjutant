<script lang="ts">
  import { DOW, MONTHS, iso, monthWeeks, todayISO } from '../lib/roadmap/dates'
  import { layoutWeek } from '../lib/roadmap/layout'
  import type { Task } from '../lib/roadmap/types'
  import TaskBlock from './TaskBlock.svelte'

  let {
    year,
    month,
    tasks,
    hues,
    showProject,
    laneH,
    blockH,
    lanePad,
  }: {
    year: number
    month: number
    tasks: Task[]
    hues: Map<string, string>
    showProject: boolean
    laneH: number
    blockH: number
    lanePad: number
  } = $props()

  const today = todayISO()
  const weeks = $derived(
    monthWeeks(year, month).map((days) => ({
      days,
      start: iso(days[0]),
      layout: layoutWeek(iso(days[0]), tasks),
    })),
  )
</script>

<section class="month">
  <h2>{MONTHS[month]} <span class="yr">{year}</span></h2>
  <div class="dow">
    {#each DOW as d, i (d)}
      <div class:we={i > 4}>{d}</div>
    {/each}
  </div>

  {#each weeks as week (week.start)}
    <div class="week" data-week-start={week.start}>
      <div class="week-days">
        {#each week.days as day, i (i)}
          {@const ds = iso(day)}
          <div
            class="day"
            class:out={day.getMonth() !== month}
            class:we={i > 4}
            class:today={ds === today}
            data-date={ds}
          >
            <span class="n">{day.getDate()}</span>
          </div>
        {/each}
      </div>
      <div
        class="week-blocks"
        style="height:{week.layout.laneCount ? week.layout.laneCount * laneH + lanePad : 6}px"
      >
        {#each week.layout.segs as seg (seg.task.id)}
          <TaskBlock {seg} hue={hues.get(seg.task.project)} {showProject} {laneH} {blockH} {lanePad} />
        {/each}
      </div>
    </div>
  {/each}
</section>
