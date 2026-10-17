<script lang="ts">
  let { saveState = '' }: { saveState?: string } = $props()
</script>

<div class="legend">
  <div class="set">
    <strong>State</strong>
    <div class="item">
      <span class="swatch s-active" style="border-color:#60a5fa;background-color:#1e3a5f"></span> Active
    </div>
    <div class="item">
      <span class="swatch s-intensive" style="border-color:#60a5fa;background-color:#1e3a5f"></span> Intensive / crunch
    </div>
    <div class="item">
      <span class="swatch s-hold" style="border-color:#62708a;background-color:#18202e"></span> On-hold / blocked
    </div>
  </div>
  <div class="set">
    <strong>Ownership</strong>
    <div class="item">
      <span class="dot" style="background:#8b5cf6"></span><span class="dot" style="background:#3b82f6"></span><span
        class="dot"
        style="background:#22c55e"
      ></span> Internal / core team
    </div>
    <div class="item">
      <span class="dot" style="background:#64748b"></span><span class="dot" style="background:#9ca3af"></span> External
      / contractor / client
    </div>
  </div>
  <div class="spacer"></div>
  <div id="saveState">{saveState}</div>
</div>
