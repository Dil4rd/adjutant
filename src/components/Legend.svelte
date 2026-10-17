<script lang="ts">
  import { MY_TEAM_COLORS, OTHER_TEAM_COLORS } from '../lib/roadmap/colors'
  let { saveState = '' }: { saveState?: string } = $props()

  // Swatches are drawn from the real ramps, so the legend cannot drift from
  // the palette the editor offers.
  const mine = MY_TEAM_COLORS.slice(0, 3)
  const theirs = OTHER_TEAM_COLORS.slice(0, 2)
</script>

<div class="legend">
  <div class="set">
    <strong>Intensity</strong>
    <div class="item">
      <span class="swatch s-intensive" style="border-color:#f0796a;background-color:#4a1f18"></span> Intensive
    </div>
    <div class="item">
      <span class="swatch s-background" style="border-color:#8a564d;background-color:#2b1b17"></span> Background / tentative
    </div>
    <div class="item">
      <span class="swatch s-hold" style="border-color:#6a5249;background-color:#231a16"></span> On-hold
    </div>
  </div>
  <div class="set">
    <strong>Ownership</strong>
    <div class="item">
      {#each mine as c (c)}<span class="dot" style="background:{c}"></span>{/each} My team
    </div>
    <div class="item">
      {#each theirs as c (c)}<span class="dot" style="background:{c}"></span>{/each} Not my team
    </div>
  </div>
  <div class="spacer"></div>
  <div id="saveState">{saveState}</div>
</div>
