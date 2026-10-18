<script lang="ts">
  import { readText } from '../lib/clipboard'

  let {
    onImport,
    onCancel,
  }: { onImport: (text: string, mode: 'replace' | 'merge') => string | null; onCancel: () => void } =
    $props()

  let text = $state('')
  let mode = $state<'replace' | 'merge'>('replace')
  let error = $state('')
  let over = $state(false)
  let fileInput: HTMLInputElement
  let box: HTMLTextAreaElement

  async function takeFile(f: File | undefined) {
    if (f) text = await f.text()
  }

  async function paste() {
    const r = await readText()
    if (r.ok) {
      text = r.text
      error = ''
      return
    }
    // Reading the clipboard is the half browsers restrict, so fall back to the
    // box the user can always paste into themselves.
    error = r.reason
    box?.focus()
  }

  function run() {
    error = onImport(text, mode) ?? ''
  }
</script>

<div id="importModal" class="overlay">
  <div class="sheet">
    <h3>Import JSON</h3>
    <p class="hint">
      Paste a JSON array of tasks, or a full export object (<code
        >&lbrace; "meta": …, "tasks": […] &rbrace;</code
      >). Fields:
      <code>id, project, stage, executor, startDate, endDate, status, isMyTeam, color, comments</code
      > — unknown ones are ignored, missing ones get sensible defaults, and <code>endDate</code> is inclusive.
    </p>

    <div class="field">
      <textarea
        id="importText"
        style="min-height:180px"
        bind:this={box}
        bind:value={text}
        placeholder={'[{"id":"s1","project":"Example Programme","stage":"Stage 1: Baseline & Testing","executor":"Core Team","startDate":"2026-10-19","endDate":"2026-10-28","status":"intensive","isMyTeam":true,"color":"#8b5cf6","comments":"…"}]'}
      ></textarea>
    </div>

    <div
      class="drop-zone"
      class:over
      id="dropZone"
      role="region"
      aria-label="Drop a JSON file"
      ondragover={(e) => {
        e.preventDefault()
        over = true
      }}
      ondragenter={(e) => {
        e.preventDefault()
        over = true
      }}
      ondragleave={() => (over = false)}
      ondrop={(e) => {
        e.preventDefault()
        over = false
        takeFile(e.dataTransfer?.files?.[0])
      }}
    >
      Drop a <strong>.json</strong> file here,
      <button id="btnPickFile" class="link" onclick={() => fileInput.click()}>choose a file</button>, or
      <button id="btnPaste" class="link" onclick={paste}>paste from the clipboard</button>
      <input
        id="fileInput"
        type="file"
        accept=".json,application/json"
        class="hidden"
        bind:this={fileInput}
        onchange={(e) => {
          takeFile((e.currentTarget as HTMLInputElement).files?.[0])
          ;(e.currentTarget as HTMLInputElement).value = ''
        }}
      />
    </div>

    <div class="field">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>On import</label>
      <div class="seg" id="importMode">
        <button data-mode="replace" class:on={mode === 'replace'} onclick={() => (mode = 'replace')}>
          Replace all
        </button>
        <button data-mode="merge" class:on={mode === 'merge'} onclick={() => (mode = 'merge')}>
          Merge (by id)
        </button>
      </div>
    </div>

    <p id="importErr" class="error">{error}</p>

    <div class="actions">
      <div class="spacer"></div>
      <button id="btnCancelImport" onclick={onCancel}>Cancel</button>
      <button id="btnDoImport" class="primary" onclick={run}>Import</button>
    </div>
  </div>
</div>
