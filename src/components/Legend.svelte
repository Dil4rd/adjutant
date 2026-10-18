<script lang="ts">
  import { blockSkin } from '../lib/roadmap/colors'
  let { saveState = '' }: { saveState?: string } = $props()

  // Built from the real skin function, so the legend cannot drift from what
  // the board actually draws.
  const HUE = '#3b82f6'
  const demo = (status: 'intensive' | 'background' | 'hold', isMyTeam: boolean) =>
    blockSkin({ color: HUE, status, isMyTeam }, HUE)
  const styleOf = (s: ReturnType<typeof blockSkin>) =>
    `background-color:${s.fill};border-color:${s.border}`
</script>

<div class="legend">
  <div class="set">
    <strong>Intensity</strong>
    <div class="item">
      <span class="swatch s-intensive" style={styleOf(demo('intensive', true))}></span> Intensive
    </div>
    <div class="item">
      <span class="swatch s-background" style={styleOf(demo('background', true))}></span> Background / tentative
    </div>
    <div class="item">
      <span class="swatch s-hold" style={styleOf(demo('hold', true))}></span> On-hold
    </div>
  </div>
  <div class="set">
    <strong>Ownership</strong>
    <div class="item">
      <span class="swatch s-intensive" style={styleOf(demo('intensive', true))}></span> My team
    </div>
    <div class="item">
      <span class="swatch s-intensive other-team" style={styleOf(demo('intensive', false))}></span>
      Other team — same project colour, dimmed
    </div>
  </div>
  <div class="spacer"></div>
  <div id="saveState">{saveState}</div>
</div>
