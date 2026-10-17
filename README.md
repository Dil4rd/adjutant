# Adjutant — Project Roadmap Calendar

An interactive, multi-month project roadmap calendar that builds to **one
self-contained `index.html`** — no network calls, no backend, no dependencies at
runtime. Your roadmap is encrypted in the browser under a key only your passkey
can unwrap.

Architecture follows [Dil4rd/hindsightly](https://github.com/Dil4rd/hindsightly):
**WebAuthn PRF → HKDF → AES-GCM**, with no server and no signature verification.
Security rests on the fact that only the authenticator holding the credential
secret can reproduce the PRF output.

## Stack

Svelte 5 · Vite + vite-plugin-singlefile · TypeScript · Vitest.
Native WebAuthn + WebCrypto, no auth dependency. Zero runtime dependencies.

```bash
npm install
npm run dev      # dev server (localhost is a WebAuthn secure context)
npm run check    # svelte-check + tsc
npm test         # Vitest — the pure domain layer
npm run build    # -> dist/index.html, self-contained and CSP-locked
```

Or build in a pinned environment and export just the artifact:

```bash
docker build --target artifact -o dist .     # -> ./dist/index.html
docker build --target serve -t adjutant .    # or run it behind nginx
docker run -p 8080:80 adjutant
```

Pushing a `v*` tag builds the file and attaches it to a GitHub Release.

## Security model

Hindsightly encrypts a short API token once per enrolled passkey. The secret
here is the dataset itself, which grows, so this uses **envelope encryption**:

```
passkey PRF output ──HKDF(info: adjutant/kek/v1)──► KEK ──unwraps──► DEK ──AES-GCM──► roadmap
passphrase ────────PBKDF2-SHA256, 600k iters──────► KEK ──unwraps──► DEK
```

- One random 256-bit **DEK** encrypts the roadmap.
- Every *recipient* — each passkey, plus an optional passphrase — wraps its own
  copy of that 32-byte DEK. Any recipient unlocks; losing one is a non-event,
  and **+ Backup key** enrolls another without re-encrypting any data.
- The DEK exists only in memory for the session. **Lock** drops it.
- `localStorage` holds two keys, neither readable without unlocking:
  `adjutant:vault:v1` (wrapped DEKs) and `adjutant:data:v1` (AES-GCM ciphertext).
- The production build carries a strict CSP whose `script-src` is the SHA-256 of
  the inlined bundle, so injected script cannot execute. Because the app talks to
  nothing, it also runs `default-src 'none'; connect-src 'none'` — there is no
  origin to exfiltrate to even if it did.

`frame-ancestors` is deliberately **not** in the `<meta>` CSP: browsers ignore it
there. Clickjacking protection comes from a real header — see `deploy/nginx.conf`.

Passkeys need a secure context: serve over `https://` or `localhost`. The
passphrase path is the fallback for browsers or authenticators without PRF.
There is no recovery if every recipient is lost — that is the design. Enrol a
backup key, and treat Export JSON as the real backup.

## Visual encoding

| | |
|---|---|
| **Active** | solid border |
| **Intensive / crunch** | dashed border + diagonal stripes |
| **On-hold / blocked** | dotted border + dot pattern, dimmed fill |
| **Internal / my team** | vibrant hues |
| **External / contractor / client** | grey tones |

Weeks start **Monday** everywhere. A task spanning several weeks renders one
segment per week row; cut edges lose their border and radius so they read as
"continues" rather than "ends here", and only true end edges are resizable.

## Interaction

- **Click** a block to edit everything about it, or delete it.
- **Drag** a block to move it; **drag an edge** to resize. Both snap to days and
  cross week rows and month panels.
- 1 / 2 / 3 month views, Previous / Next / Today, and a project filter bar
  generated from the data.
- Edits autosave (debounced, encrypted) and survive reload.

## Data format

These field names are canonical: they are what the app holds in memory,
encrypts to disk and writes on export, so no translation layer can drift out of
step with an imported file.

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
Legacy aliases (`title`, `start`, `end`, `team`, `notes`, `owner`) still load.

**Export** writes the envelope — tasks *and* metadata — but every object inside
`tasks` is exactly the shape above, and re-importing an export is a no-op.

## Layout

```
src/lib/auth/        webauthn.ts (PRF oracle) · vault.ts (envelope) · store.ts
src/lib/roadmap/     types · dates · colors · model · layout · io · storage
src/components/      Unlock · Toolbar · Filters · Calendar · MonthPanel ·
                     TaskBlock · EditModal · ImportModal · Legend
tests/               Vitest over the pure layer (no DOM required)
build/csp-plugin.ts  hashes the inlined bundle, emits the strict CSP
```

The domain layer is deliberately DOM-free, which is why the dates, colours,
layout packing, import/export and the whole crypto envelope are unit-testable
without a browser.

## Notes on the supplied roadmap

`seedTasks()` holds the Example Programme roadmap, so a fresh browser opens
on real data. Worth a look: **every stage is `"active"`**, so the dashed/striped
and dotted treatments never appear in this dataset, and the paired oversight
tracks render identically to the delivery work they shadow. The `comments` on
four stages say *"low-intensity"* — a real distinction in intensity that
`status` is the natural home for.
