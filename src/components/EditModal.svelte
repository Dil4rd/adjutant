<script lang="ts">
  import { untrack } from 'svelte'
  import { paletteFor } from '../lib/roadmap/colors'
  import { shiftISO, todayISO } from '../lib/roadmap/dates'
  import { normalizeTask } from '../lib/roadmap/model'
  import type { Status, Task } from '../lib/roadmap/types'

  let {
    task,
    defaultProject,
    projects,
    executors,
    onSave,
    onDelete,
    onCancel,
  }: {
    task: Task | null
    defaultProject: string
    projects: string[]
    executors: string[]
    onSave: (t: Task, isNew: boolean) => void
    onDelete: (t: Task) => void
    onCancel: () => void
  } = $props()

  // The modal seeds its form from the task ONCE and then owns the draft — the
  // caller remounts it per task (see the {#key} in App.svelte), so reading the
  // props non-reactively here is the intent, not an oversight.
  const seed = untrack(() => ({
    task,
    draft: task
      ? { ...task }
      : normalizeTask({
          project: defaultProject,
          stage: '',
          startDate: todayISO(),
          endDate: shiftISO(todayISO(), 6),
        }),
    project: task ? task.project : defaultProject,
  }))

  const isNew = seed.task === null

  let draft = $state<Task>(seed.draft)
  // a brand-new task starts with empty text fields rather than placeholders
  let project = $state(seed.project)
  let stage = $state(seed.task ? seed.task.stage : '')
  let executor = $state(seed.task ? seed.task.executor : '')
  let startDate = $state(seed.draft.startDate)
  let endDate = $state(seed.draft.endDate)
  let comments = $state(seed.task ? seed.task.comments : '')
  let error = $state('')

  const palette = $derived(paletteFor(draft.isMyTeam))

  function setTeam(isMyTeam: boolean) {
    draft.isMyTeam = isMyTeam
    // Snap to the palette for the new classification so the hierarchy holds.
    const pal = paletteFor(isMyTeam)
    if (!pal.some((c) => c.toLowerCase() === draft.color.toLowerCase())) draft.color = pal[0]
  }

  function save() {
    if (!project.trim()) return (error = 'Project name is required.')
    if (!stage.trim()) return (error = 'Stage / milestone title is required.')
    if (!startDate || !endDate) return (error = 'Both start and end dates are required.')
    if (endDate < startDate) return (error = 'The end date cannot precede the start date.')
    onSave(
      normalizeTask({
        ...draft,
        project: project.trim(),
        stage: stage.trim(),
        executor: executor.trim(),
        startDate,
        endDate,
        comments,
      }),
      isNew,
    )
  }
</script>

<div id="editModal" class="overlay">
  <div class="sheet">
    <h3 id="editTitle">{isNew ? 'New task' : 'Edit task'}</h3>

    <div class="grid2">
      <div>
        <label for="fProject">Project name</label>
        <input id="fProject" list="projectList" autocomplete="off" bind:value={project} />
        <datalist id="projectList">
          {#each projects as p (p)}<option value={p}></option>{/each}
        </datalist>
      </div>
      <div>
        <label for="fTitle">Stage / milestone title</label>
        <input id="fTitle" autocomplete="off" bind:value={stage} />
      </div>
    </div>

    <div class="grid2" style="margin-top:0.75rem">
      <div>
        <label for="fExecutor">Executor / owner</label>
        <input id="fExecutor" list="executorList" autocomplete="off" bind:value={executor} />
        <datalist id="executorList">
          {#each executors as e (e)}<option value={e}></option>{/each}
        </datalist>
      </div>
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Team classification</label>
        <div class="seg" id="fTeam">
          <button data-myteam="true" class:on={draft.isMyTeam} onclick={() => setTeam(true)}>
            Internal
          </button>
          <button data-myteam="false" class:on={!draft.isMyTeam} onclick={() => setTeam(false)}>
            External
          </button>
        </div>
      </div>
    </div>

    <div class="grid2" style="margin-top:0.75rem">
      <div>
        <label for="fStart">Start date</label>
        <input id="fStart" type="date" bind:value={startDate} />
      </div>
      <div>
        <label for="fEnd">End date</label>
        <input id="fEnd" type="date" bind:value={endDate} />
      </div>
    </div>

    <div class="field">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Status</label>
      <div class="seg" id="fStatus">
        {#each [['active', 'Active'], ['intensive', 'Intensive'], ['hold', 'On-hold']] as [key, text] (key)}
          <button
            data-status={key}
            class:on={draft.status === key}
            onclick={() => (draft.status = key as Status)}>{text}</button
          >
        {/each}
      </div>
    </div>

    <div class="field">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label id="fColorLabel">
        {draft.isMyTeam
          ? 'Colour — internal work uses vibrant tones'
          : 'Colour — external work uses grey tones'}
      </label>
      <div class="swatches" id="fColor">
        {#each palette as c (c)}
          <button
            type="button"
            data-color={c}
            style="background:{c}"
            class:on={c.toLowerCase() === draft.color.toLowerCase()}
            onclick={() => (draft.color = c)}
            aria-label={c}
          ></button>
        {/each}
      </div>
    </div>

    <div class="field">
      <label for="fNotes">Scope notes / comments</label>
      <textarea id="fNotes" placeholder="Deliverables, dependencies, blockers…" bind:value={comments}
      ></textarea>
    </div>

    <p id="editErr" class="error">{error}</p>

    <div class="actions">
      {#if !isNew}
        <button id="btnDelete" class="danger" onclick={() => onDelete(task!)}>Delete task</button>
      {/if}
      <div class="spacer"></div>
      <button id="btnCancelEdit" onclick={onCancel}>Cancel</button>
      <button id="btnSaveEdit" class="primary" onclick={save}>Save</button>
    </div>
  </div>
</div>
