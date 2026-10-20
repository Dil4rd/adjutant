<script lang="ts">
  import { enrolPasskey, hasRecipients, isUnopenable, loadVault } from './lib/auth/vault'
  import { addMonths, firstOfMonth, parseISO, todayISO } from './lib/roadmap/dates'
  import { earliestStart, exportText, mergeById, parseImport } from './lib/roadmap/io'
  import { copyText } from './lib/clipboard'
  import { normalizeTask, projectHues } from './lib/roadmap/model'
  import { clearData, readData, writeData } from './lib/roadmap/storage'
  import type { Meta, Task, ViewState } from './lib/roadmap/types'
  import {
    applyTheme, resolveTheme, storePref, storedPref, surfaceOf, systemTheme, type ThemePref,
  } from './lib/theme'

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
    showOtherTeams: true,
  })

  // How many months are laid out below the anchor. Not persisted: it is a
  // scroll position, not a preference, and it regrows on demand.
  const ROWS_AHEAD = 3
  // A year ahead is as far as the board goes: enough to plan against, and it
  // keeps the laid-out run bounded instead of growing without end.
  const MAX_MONTHS = 12
  let rendered = $state(6)
  // Which months are actually on screen, as offsets from the anchor — the
  // header reports this rather than the whole laid-out run, which would read
  // "Oct 2026 – Jun 2030" after a long scroll and tell you nothing.
  let onScreen = $state({ first: 0, last: 1 })
  const resetRun = () => {
    rendered = view.months * ROWS_AHEAD
    onScreen = { first: 0, last: view.months - 1 }
  }

  let themePref = $state<ThemePref>(storedPref())
  const theme = $derived(resolveTheme(themePref))
  const surface = $derived(surfaceOf(theme))
  $effect(() => applyTheme(theme))

  // While the preference is "system", follow the OS if it changes mid-session.
  $effect(() => {
    if (themePref !== 'system' || typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyTheme(systemTheme())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  })

  function toggleTheme() {
    themePref = theme === 'dark' ? 'light' : 'dark'
    storePref(themePref)
  }

  let saveState = $state('')
  // Transient feedback ("copied", "backup key enrolled") gets its own channel:
  // sharing saveState meant a debounced autosave landing a moment later could
  // wipe the message the user was meant to read.
  let notice = $state('')
  let noticeTimer: ReturnType<typeof setTimeout> | null = null
  function flash(message: string) {
    notice = message
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice = ''), 2500)
  }
  let editing = $state<{ task: Task | null } | null>(null)
  let importing = $state(false)

  const visible = $derived(
    tasks.filter(
      (t) =>
        (view.project === 'All' || t.project === view.project) &&
        (view.showOtherTeams || t.isMyTeam),
    ),
  )
  // Hue identifies the project, so it is derived from the whole dataset — not
  // from whatever happens to be on screen.
  const hues = $derived(projectHues(tasks))
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
      // a view saved before the toggle existed has no preference recorded
      if (typeof view.showOtherTeams !== 'boolean') view.showOtherTeams = true
      if (!view.anchor) view.anchor = firstOfMonth(new Date())
      saveState = 'encrypted · local only'
    } else {
      // Nothing stored and nothing predefined: start on an empty board at the
      // current month, and let the user add or import their own work.
      tasks = []
      view.anchor = firstOfMonth(new Date())
    }
    resetRun()
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
      flash(`backup key enrolled · ${loadVault()?.recipients.length ?? 0} keys can unlock`)
    } catch (e) {
      flash('enrolment failed: ' + (e as Error).message)
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
    // Colour belongs to the project, so applying it here keeps every stage of
    // that project in step instead of leaving the board half-recoloured.
    for (const t of tasks) if (t.project === next.project) t.color = next.color
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

  const roadmapText = () => exportText($state.snapshot(meta), $state.snapshot(tasks))

  async function doCopy(): Promise<boolean> {
    const r = await copyText(roadmapText())
    flash(r.ok ? 'roadmap copied to the clipboard' : r.reason)
    return r.ok
  }

  function doExport() {
    const url = URL.createObjectURL(new Blob([roadmapText()], { type: 'application/json' }))
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
      // Don't let the current filters swallow what was just merged: if none of
      // the incoming stages would be on screen, clear whatever is hiding them.
      const wouldShow = (t: Task) =>
        (view.project === 'All' || t.project === view.project) &&
        (view.showOtherTeams || t.isMyTeam)
      if (!parsed.tasks.some(wouldShow)) {
        view.project = 'All'
        view.showOtherTeams = true
      }
    } else {
      tasks = parsed.tasks
      view.project = 'All'
      view.showOtherTeams = true
    }
    if (parsed.name) meta.name = parsed.name
    // Jump to where the IMPORTED work is, not to the earliest task overall —
    // merging a late update into an existing roadmap should show you the
    // update, not scroll back to the start of the programme.
    view.anchor = firstOfMonth(parseISO(earliestStart(parsed.tasks)))
    resetRun()
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
      from={onScreen.first}
      to={onScreen.last}
      {theme}
      onToggleTheme={toggleTheme}
      onMonths={(n) => {
        view.months = n
        resetRun()
        scheduleSave()
      }}
      onShift={(n) => {
        view.anchor = addMonths(view.anchor, n)
        resetRun()
        scheduleSave()
      }}
      onToday={() => {
        view.anchor = firstOfMonth(new Date())
        resetRun()
        scheduleSave()
      }}
      onNew={() => (editing = { task: null })}
      onExport={doExport}
      onCopy={doCopy}
      onImport={() => (importing = true)}
      onBackupKey={backupKey}
      onLock={lock}
    />

    <Filters
      {tasks}
      project={view.project}
      showOtherTeams={view.showOtherTeams}
      onSelect={(p) => {
        view.project = p
        scheduleSave()
      }}
      onToggleOtherTeams={() => {
        view.showOtherTeams = !view.showOtherTeams
        scheduleSave()
      }}
    />

    <Calendar
      tasks={visible}
      {view}
      {hues}
      {surface}
      {rendered}
      isEmpty={tasks.length === 0}
      hiddenByFilters={tasks.length > 0 && visible.length === 0}
      onEdit={(t) => (editing = { task: t })}
      onCommit={scheduleSave}
      onExtend={() => {
        if (rendered < MAX_MONTHS) rendered = Math.min(MAX_MONTHS, rendered + view.months * 2)
      }}
      onVisible={(first, last) => {
        if (first !== onScreen.first || last !== onScreen.last) onScreen = { first, last }
      }}
    />

    <Legend saveState={notice || saveState} {surface} />
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
