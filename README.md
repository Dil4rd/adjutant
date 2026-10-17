# Adutant — Project Roadmap Calendar

A single-file, offline project roadmap calendar. Open `index.html` and that is
the whole application: no build step, no dependencies, no network calls.

Architecture follows [Dil4rd/hindsightly](https://github.com/Dil4rd/hindsightly):
**WebAuthn PRF → HKDF → AES-GCM**, with no server and no signature verification.
Security rests on the fact that only the authenticator holding the credential
secret can reproduce the PRF output.

## Security model

Hindsightly encrypts a short Todoist token once per enrolled passkey. Here the
secret *is* the dataset, which grows, so this uses **envelope encryption**:

```
passkey PRF output ──HKDF(info: adutant/kek/v1)──► KEK ──unwraps──► DEK ──AES-GCM──► roadmap
passphrase ────────PBKDF2-SHA256, 600k iters─────► KEK ──unwraps──► DEK
```

- One random 256-bit **DEK** encrypts the roadmap.
- Every *recipient* — each passkey, plus an optional passphrase — wraps its own
  copy of that 32-byte DEK. Any recipient unlocks; losing one is a non-event,
  and **+ Backup key** enrolls another without re-encrypting any data.
- The DEK exists only in memory for the session. **Lock** drops it.
- `localStorage` holds two keys, neither readable without unlocking:
  `adutant:vault:v1` (wrapped DEKs) and `adutant:data:v1` (AES-GCM ciphertext).

Passkeys need a secure context — serve over `https://` or `localhost`. The
passphrase path is the fallback for browsers or authenticators without PRF.

## Visual encoding

| | |
|---|---|
| **Active** | solid border |
| **Intensive / crunch** | dashed border + diagonal stripes |
| **On-hold / blocked** | dotted border + dot pattern, dimmed fill |
| **Internal / core team** | vibrant hues |
| **External / contractor / client** | grey ramp (chosen hue is desaturated at render time, and restored if the task flips back to Internal) |

Weeks start **Monday** everywhere. A task spanning several weeks renders one
segment per week row; cut edges lose their border and radius so they read as
"continues" rather than "ends here", and only the true end edges are resizable.

## Interaction

- **Click** a block to edit everything about it, or delete it.
- **Drag** a block to move it; **drag an edge** to resize. Both snap to days and
  cross week rows and month panels.
- 1 / 2 / 3 month views, Previous / Next / Today, and a project filter bar
  generated from the data.
- Edits autosave (debounced, encrypted) and survive reload.

## Data format

The field names below are the canonical ones: they are what the app stores in
memory, encrypts to disk, and writes on export, so there is no translation
layer that can drift out of step with the interchange format.

```json
[
  {
    "id": "sample-01a",
    "project": "Example Programme",
    "stage": "Stage 1: Baseline & Testing",
    "executor": "Core Team",
    "startDate": "2026-10-19",
    "endDate": "2026-10-28",
    "status": "active",
    "isMyTeam": true,
    "color": "#8b5cf6",
    "comments": "Establish the baseline, run internal testing, and scope the wider pilot group."
  }
]
```

- `status` — `"active"` | `"intensive"` | `"hold"`; anything else falls back to
  `"active"`.
- `isMyTeam` — `true` renders a vibrant hue, `false` a grey tone. The flag is
  deliberately binary: the only distinction that matters is whether the work is
  mine to drive. Cross-functional teams inside the company, contractors and
  third-party vendors are all simply *not my team*, and all recede to grey — so
  there is nothing to gain from splitting this into a wider enum.
- `endDate` is **inclusive**: a stage ending `2026-10-28` occupies the 28th, and
  the next starts on the 29th.
- `id` is generated when absent, and is the key that merge-import updates on.
- An inverted range is swapped rather than rejected.

**Import** accepts a bare array of these objects, or an export envelope
`{ version, app, exportedAt, meta, tasks }`, in replace or merge-by-id mode.
Legacy aliases (`title`, `start`, `end`, `team`, `notes`, `owner`) still load,
so older files and hand-written JSON keep working.

**Export** writes the envelope, because the brief asks for tasks *and*
metadata — but every object inside `tasks` is exactly the shape above, and
re-importing an export is a no-op. If you would rather the file be a bare
array, that is a one-line change.

## Notes on the supplied roadmap

`seedTasks()` holds the Example Programme roadmap, so a fresh browser opens
on real data. Two things worth a look:

- **Every stage is `"active"`.** The dashed/striped and dotted treatments
  therefore never appear in this dataset, and the paired tracks render
  identically to the delivery work they shadow.
- The `comments` on four stages say *"low-intensity"* — Stage 2b, 3b and 4b
  oversight, and the support halves generally. That is a real distinction in
  intensity that `status` is the natural home for, and setting those to a
  quieter state would make the oversight tracks visibly recede behind the
  stages doing the work.
