<script lang="ts">
  import { DOW, MONTHS, iso, todayISO } from '../lib/roadmap/dates'
  import type { WeekLayout } from '../lib/roadmap/layout'
  import type { Surface } from '../lib/roadmap/colors'
  import TaskBlock from './TaskBlock.svelte'

  let {
    year,
    month,
    weeks,
    laneCounts,
    hues,
    surface,
    showProject,
    laneH,
    blockH,
    lanePad,
  }: {
    year: number
    month: number
    /** Laid out by the calendar, which can see across the whole row. */
    weeks: { days: Date[]; start: string; layout: WeekLayout }[]
    /** Lane count per week AFTER levelling against the rest of the row. */
    laneCounts: number[]
    hues: Map<string, string>
    surface: Surface
    showProject: boolean
    laneH: number
    blockH: number
    lanePad: number
  } = $props()

  const today = todayISO()
  // The levelled count, never the month's own — that is what keeps the grid
  // lines of every month on this row at the same height.
  const heightOf = (i: number) => {
    const count = laneCounts?.[i] ?? weeks[i].layout.laneCount
    return count ? count * laneH + lanePad : 6
  }
</script>

<section class="month">
  <h2>{MONTHS[month]} <span class="yr">{year}</span></h2>
  <div class="dow">
    {#each DOW as d, i (d)}
      <div class:we={i > 4}>{d}</div>
    {/each}
  </div>

  {#each weeks as week, wi (week.start)}
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
      <div class="week-blocks" style="height:{heightOf(wi)}px">
        {#each week.layout.segs as seg (seg.task.id)}
          <TaskBlock {seg} hue={hues.get(seg.task.project)} {surface} {showProject} {laneH} {blockH} {lanePad} />
        {/each}
      </div>
    </div>
  {/each}
</section>
