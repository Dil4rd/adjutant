<script lang="ts">
  import { enrolPasskey, hasRecipients, isUnopenable, loadVault } from './lib/auth/vault'
  import { addMonths, firstOfMonth, parseISO, todayISO } from './lib/roadmap/dates'
  import { buildExport, earliestStart, mergeById, parseImport } from './lib/roadmap/io'
  import { normalizeTask, seedTasks } from './lib/roadmap/model'
  import { clearData, readData, writeData } from './lib/roadmap/storage'
  import type { Meta, Task, ViewState } from './lib/roadmap/types'

  import Calendar from './components/Calendar.svelte'
  import EditModal from './components/EditModal.svelte'
  import Filters from './components/Filters.svelte'
  import ImportModal from './components/ImportModal.svelte'
  import Legend from './components/Legend.svelte'
  import Toolbar from './components/Toolbar.svelte'
  import Unlock from './components/Unlock.svelte'

  let dek = $state<CryptoKey | null>(null)
  // A vault that exists but holds no passkey is NOT a first run: showing the
  // enrolment screen there would mint a new key against undecryptable data and
  // strand the user with no explanation. Route it to the unlock screen, which
  // says what happened and offers a reset.
  let lockMode = $state<'enrol' | 'unlock'>(
    hasRecipients(loadVault()) || isUnopenable() ? 'unlock' : 'enrol',
  )

  let meta = $state<Meta>({ version: 1, name: 'Roadmap', updatedAt: null })
  let tasks = $state<Task[]>([])
  let view = $state<ViewState>({
    months: 2,
    anchor: firstOfMonth(new Date()),
    project: 'All',
  })

  let saveState = $state('')
  let editing = $state<{ task: Task | null } | null>(null)
  let importing = $state(false)

  const visible = $derived(
    view.project === 'All' ? tasks : tasks.filter((t) => t.project === view.project),
  )
  const projects = $derived([...new Set(tasks.map((t) => t.project))].sort())
  const executors = $derived([...new Set(tasks.map((t) => t.executor).filter(Boolean))].sort())

  // ---- session -------------------------------------------------------------

  async function start(key: CryptoKey, fresh: boolean) {
    let loaded = null
    try {
      loaded = await readData(key)
    } catch {
      if (!fresh) {
        // An existing key that cannot read the stored blob is the wrong key;
        // stay locked rather than silently presenting an empty roadmap.
        alert('The stored roadmap could not be decrypted with that key.')
        return
      }
      // A brand-new passkey can never decrypt a blob written under an older
      // one — that data is already unrecoverable, so drop it and start clean
      // rather than dead-ending on an error.
      clearData()
    }
    dek = key
    if (loaded && Array.isArray(loaded.tasks)) {
      meta = { ...meta, ...loaded.meta }
      tasks = loaded.tasks.map((t) => normalizeTask(t))
      view = { ...view, ...loaded.view }
      if (!view.anchor) view.anchor = firstOfMonth(new Date())
      saveState = 'encrypted · local only'
    } else {
      tasks = seedTasks()
      view.anchor = firstOfMonth(parseISO(earliestStart(tasks)))
    }
    if (fresh || !loaded) await save()
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleSave() {
    if (!dek) return
    saveState = 'saving…'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(save, 400)
  }

  async function save() {
    if (!dek) return
    saveTimer = null
    meta.updatedAt = new Date().toISOString()
    try {
      // $state proxies are not structured-cloneable or JSON-stable across
      // realms, so snapshot to plain objects before encrypting.
      await writeData(dek, {
        meta: $state.snapshot(meta),
        tasks: $state.snapshot(tasks),
        view: $state.snapshot(view),
      })
      saveState = 'encrypted · saved ' + new Date().toLocaleTimeString()
    } catch (e) {
      saveState = 'save failed: ' + (e as Error).message
    }
  }

  function lock() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      save()
    }
    dek = null
    tasks = []
    lockMode = 'unlock'
  }

  async function backupKey() {
    if (!dek) return
    const label = prompt('Label for the backup passkey:', 'Backup key')
    if (label === null) return
    try {
      await enrolPasskey(label.trim() || 'Backup key', dek)
      saveState = `backup key enrolled · ${loadVault()?.recipients.length ?? 0} keys can unlock`
    } catch (e) {
      saveState = 'enrolment failed: ' + (e as Error).message
    }
  }

  // ---- task editing --------------------------------------------------------

  function saveTask(next: Task, isNew: boolean) {
    if (isNew) {
      tasks.push(next)
    } else {
      // Mutate in place: "the task with this id" stays one object for the life
      // of the session, so a live reference (a drag in flight, say) can't drift.
      const existing = tasks.find((t) => t.id === next.id)
      if (existing) Object.assign(existing, next)
      else tasks.push(next)
    }
    editing = null
    scheduleSave()
  }

  function deleteTask(t: Task) {
    if (!confirm(`Delete "${t.project} — ${t.stage}"? This cannot be undone.`)) return
    tasks = tasks.filter((x) => x.id !== t.id)
    editing = null
    scheduleSave()
  }

  // ---- import / export -----------------------------------------------------

  function doExport() {
    const payload = buildExport($state.snapshot(meta), $state.snapshot(tasks))
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'roadmap-' + todayISO() + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function doImport(text: string, mode: 'replace' | 'merge'): string | null {
    let parsed
    try {
      parsed = parseImport(text)
    } catch (e) {
      return (e as Error).message
    }
    if (mode === 'merge') {
      tasks = mergeById($state.snapshot(tasks), parsed.tasks)
    } else {
      tasks = parsed.tasks
      view.project = 'All'
    }
    if (parsed.name) meta.name = parsed.name
    // Jump the viewport to where the imported work actually is.
    view.anchor = firstOfMonth(parseISO(earliestStart(tasks)))
    importing = false
    scheduleSave()
    return null
  }

  // ---- keyboard ------------------------------------------------------------

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (editing) editing = null
    else if (importing) importing = false
  }
</script>

<svelte:window
  onkeydown={onKeydown}
  onbeforeunload={() => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      save()
    }
  }}
/>

{#if !dek}
  <Unlock mode={lockMode} onUnlocked={start} />
{:else}
  <div class="shell">
    <Toolbar
      {view}
      total={tasks.length}
      visible={visible.length}
      onMonths={(n) => {
        view.months = n
        scheduleSave()
      }}
      onShift={(n) => {
        view.anchor = addMonths(view.anchor, n)
        scheduleSave()
      }}
      onToday={() => {
        view.anchor = firstOfMonth(new Date())
        scheduleSave()
      }}
      onNew={() => (editing = { task: null })}
      onExport={doExport}
      onImport={() => (importing = true)}
      onBackupKey={backupKey}
      onLock={lock}
    />

    <Filters
      {tasks}
      project={view.project}
      onSelect={(p) => {
        view.project = p
        scheduleSave()
      }}
    />

    <Calendar tasks={visible} {view} onEdit={(t) => (editing = { task: t })} onCommit={scheduleSave} />

    <Legend {saveState} />
  </div>

  {#if editing}
    {#key editing.task?.id ?? 'new'}
    <EditModal
      task={editing.task}
      defaultProject={view.project !== 'All' ? view.project : ''}
      {projects}
      {executors}
      onSave={saveTask}
      onDelete={deleteTask}
      onCancel={() => (editing = null)}
    />
    {/key}
  {/if}

  {#if importing}
    <ImportModal onImport={doImport} onCancel={() => (importing = false)} />
  {/if}
{/if}
