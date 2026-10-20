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
```

- One random 256-bit **DEK** encrypts the roadmap.
- Every enrolled **passkey** wraps its own copy of that 32-byte DEK. Any passkey
  unlocks; losing one is a non-event, and **+ Backup key** enrolls another
  without re-encrypting any data.
- **Passkeys are the only way in.** There is no password and no passphrase
  fallback, so there is nothing to phish, guess, or brute-force — and nothing
  weaker than the authenticator sitting beside the strong path.
- The DEK exists only in memory for the session. **Lock** drops it.
- `localStorage` holds two keys, neither readable without unlocking:
  `adjutant:vault:v1` (wrapped DEKs) and `adjutant:data:v1` (AES-GCM ciphertext).
- The production build carries a strict CSP whose `script-src` is the SHA-256 of
  the inlined bundle, so injected script cannot execute. Because the app talks to
  nothing, it also runs `default-src 'none'; connect-src 'none'` — there is no
  origin to exfiltrate to even if it did.

`frame-ancestors` is deliberately **not** in the `<meta>` CSP: browsers ignore
it there. Clickjacking protection comes from real headers, set in `vercel.json`
for the hosted deploy and `deploy/nginx.conf` for the container. Multiple CSP
policies intersect, so the header adds framing protection without loosening the
meta policy.

`vercel.json` also pins a `Permissions-Policy` that **explicitly keeps
`publickey-credentials-create` and `publickey-credentials-get` available to this
origin**. That is the browser default, stated so it cannot be lost by accident —
dropping those two entries would break unlocking entirely.

Passkeys need a secure context: serve over `https://` or `localhost`; a
`file://` path will not do. The authenticator must support the **PRF
extension** — current Chrome, Safari, Edge and the major password managers do;
a very old security key may not, and the app will say so rather than fail
obscurely.

There is no recovery if every passkey is lost — that is the design, not an
oversight. **Enrol a second passkey from "+ Backup key" on day one**, and treat
Export JSON as the real backup. A vault left with no usable passkey is detected
on load and offered a clean reset instead of a dead end.

## Deployments

| Branch | URL | Notes |
|---|---|---|
| `main` | https://adjutant.dil4rd.me | Vercel builds `npm run build` and serves `dist/` |
| `dev` | https://adjutant-dev.dil4rd.me | same build, for work in progress |

**Passkeys are scoped to the hostname.** WebAuthn binds every credential to an
RP ID, which is the origin's host — so a passkey enrolled on
`adjutant.dil4rd.me` cannot unlock `adjutant-dev.dil4rd.me`, or vice versa, and
each origin keeps its own `localStorage` vault. That is a property of WebAuthn,
not a setting: treat the two as separate installs, enrol a passkey on each, and
move roadmaps between them with Export / Import JSON.

The same applies to `localhost` during development: a third origin, a third
vault.

## Dependency advisories

The shipped artifact has **zero runtime dependencies** — it is one static HTML
file — so advisories here only ever concern the build machine and CI.

`braces`/`micromatch` (reached via `vite-plugin-singlefile`) carries a
stack-exhaustion DoS advisory with **no patched version available**: `braces` is
already at its latest, 3.0.3. `npm audit fix --force` "resolves" it by
downgrading `vite-plugin-singlefile` from 2.x to 0.9.0, which would break the
single-file build outright, so it is deliberately not applied. The only input
reaching those globs is this repo's own Vite config.

## Visual encoding

Intensity runs loudest to quietest. There is no neutral state: a stage is
either being driven, ticking over, or stopped.

| Intensity | Treatment |
|---|---|
| **Intensive** | solid border, strongest fill, faint diagonal sheen |
| **Background / tentative** | dashed border, muted fill, no texture |
| **On-hold** | dotted border, dimmest fill, dot texture |

Loud work reads *clean and confident* rather than busy — the stripe texture is
deliberately near-invisible at a glance, because `intensive` is the common
state and texturing everything would just be noise.

| Ownership | Treatment |
|---|---|
| **My team** | solid fill |
| **Other team** | ghosted: same project colour, very light fill, full-strength border |

**Colour identifies the project, not the owner.** Every stage of a project is
drawn in that project's hue, so a glance says *which project* a block belongs
to. Ownership is carried entirely by weight, in two deliberately separated
bands — my team is solid (>= 1.7:1 against the page), other teams are ghosted
(<= 1.52:1) — which reads as filled-versus-outlined rather than as "slightly
darker". The hue survives in the border, so a ghosted block still announces its
project.

A project's hue comes from its earliest my-team stage (falling back to its
earliest stage of any kind), so an imported file that coloured its other-team
stages differently reads as one project immediately, with no manual
recolouring. Setting the colour in the editor applies it to every stage of that
project, keeping the board coherent.

Ownership is a single boolean. Cross-functional teams, contractors and vendors
are all simply *not my team*.

**Other-team work can be hidden entirely** — set the team filter to *My team*.
*Other teams* does the inverse, which the old show/hide toggle could not
express. A view saved before the filter bar existed is migrated: its
`showOtherTeams: false` becomes the *My team* filter.

Chrome colours follow hindsightly's warm near-black; task colours are tuned to
sit on it, warm end first.

**Contrast is a constraint, not an afterthought.** In BOTH themes, every text
token clears WCAG AA (4.5:1) against the page, including the quietest — de-emphasis comes
from the *step between* tokens, not from fading text toward the background.
Block fills target explicit contrast ratios rather than fixed mix ratios, so
any hue lands at the same visual weight: a slate blue and a yellow recede by
the same amount. Nothing is allowed to reach the page itself (the quietest
combination, on-hold + not-my-team, still separates at 1.3:1), and every block
border clears WCAG 1.4.11's 3:1 for non-text contrast so a receded block stays
unambiguously present. Tests assert all of this across both ownership values,
all three intensities, and adversarial imported colours including pure black
and white.

Weeks start **Monday** everywhere. A task spanning several weeks renders one
segment per week row; cut edges lose their border and radius so they read as
"continues" rather than "ends here", and only true end edges are resizable.

## Interaction

- **Click** a block to edit everything about it, or delete it.
- **Drag** a block to move it; **drag an edge** to resize. Both snap to days and
  cross week rows and month panels.
- **Other teams** in the filter bar hides every stage not owned by my team.
- A month has a **fixed width** (capped at `--month-max`, 560px) and the grid
  is left-aligned, so a month is the same size whichever layout you pick.
  Without the cap, "1 Month" on a wide screen stretched a single month across
  the whole window — day columns over 200px wide. The tracks still shrink when
  the window is too narrow to honour the cap, and every month in a row is
  identical by construction.
- The **1 / 2 / 3 Months** toggle sets how many months sit side by side; the
  run continues below, so looking further ahead is a scroll rather than
  repeated clicks on Next. It extends on demand and **stops at one year** from
  the anchor. Previous / Next / Today jump the anchor and return you to the top.
- The header reports the months **actually on screen**, not the whole laid-out
  run — after a long scroll, "Oct 2026 – Jun 2030" would tell you nothing.
- A **filter bar** with three dimensions — project, executor, and team
  (Everyone / My team / Other teams). They combine with AND, the options are
  generated from the data so a filter can never offer a value that matches
  nothing, an active filter is visibly switched on, and **Clear filters**
  appears only when something is filtered. The choice persists with the view.
  A filter whose value disappears (its last stage deleted, an executor renamed)
  releases itself rather than leaving a blank board behind.
- **Day / night themes**, following the OS until you choose one. The preference
  lives in plain `localStorage`, not the encrypted blob: the lock screen has to
  be drawn before anything is unlocked, and it is not a secret. Block weights
  are computed against the active surface, so the same contrast targets produce
  a dark-on-light board and a light-on-dark one with no per-theme tuning.
- Edits autosave (debounced, encrypted) and survive reload.

## Data format

These field names are canonical: they are what the app holds in memory,
encrypts to disk and writes on export, so no translation layer can drift out of
step with an imported file.

```json
[
  {
    "id": "s1",
    "project": "Example Programme",
    "stage": "Stage 1: Baseline & Testing",
    "executor": "Core Team",
    "startDate": "2026-10-19",
    "endDate": "2026-10-28",
    "status": "intensive",
    "isMyTeam": true,
    "color": "#8b5cf6",
    "comments": "Establish the baseline, run internal testing, and scope the wider pilot group."
  }
]
```

- `status` — `"intensive"` | `"background"` | `"hold"`; anything else falls
  back to `"intensive"`.
- `isMyTeam` — `true` renders a solid block, `false` a ghosted one in the same
  project colour. The flag is
  deliberately binary: the only distinction that matters is whether the work is
  mine to drive. Cross-functional teams inside the company, contractors and
  third-party vendors are all simply *not my team*, and all recede to grey — so
  there is nothing to gain from splitting this into a wider enum.
- `endDate` is **inclusive**: a stage ending `2026-10-28` occupies the 28th, and
  the next starts on the 29th.
- `id` is generated when absent, and is the key that merge-import updates on.
- An inverted range is swapped rather than rejected.

**Import** accepts a bare array of these objects, or an export envelope
`{ version, app, exportedAt, meta, tasks }` — from a dropped file, a file
picker, **or the clipboard**.

**Merge (by id) is the default**, because it cannot lose work: stages with a
matching `id` are updated and everything else is added. Replace discards the
roadmap currently in the browser, so it is the deliberate choice rather than
the accidental one. A stage with no `id` gets a fresh one, so it always counts
as new — exporting first is the way to get ids you can merge against.

After a merge the viewport jumps to the **imported** work rather than to the
earliest task overall, and if the current filters would hide everything that
was just merged, those filters are cleared. Both exist so an import is never
silently invisible.

**Export** downloads a `.json` file in one click, and the ⧉ button beside it
puts the identical text on the clipboard. Both come from the same
`exportText()`, so a pasted roadmap and a downloaded one are byte-identical.

Clipboard support is best-effort by necessity: reading is the half browsers
restrict (Safari confirms each paste, some refuse it to pages outright), so a
blocked read says so and focuses the box you can always paste into yourself.
Copying falls back to a legacy `execCommand` path where the async API is
unavailable.
Legacy aliases (`title`, `start`, `end`, `team`, `notes`, `owner`) still load.

**Migration note.** `"active"` was the old neutral status and no longer exists.
A file containing it still imports — every `"active"` stage becomes
`"intensive"` — but it will *not* round-trip byte-for-byte, because that is the
one field the upgrade rewrites. Re-tag anything that was really ticking over as
`"background"`.

**Export** writes the envelope — tasks *and* metadata — but every object inside
`tasks` is exactly the shape above, and re-importing an export is a no-op.

## Layout

```
src/lib/auth/        webauthn.ts (PRF oracle) · vault.ts (envelope) · store.ts
                     — the ceremony is split from the crypto, so the whole
                     envelope is unit-testable without an authenticator
src/lib/roadmap/     types · dates · colors · model · layout · io · storage
src/components/      Unlock · Toolbar · Filters · Calendar · MonthPanel ·
                     TaskBlock · EditModal · ImportModal · Legend
tests/               Vitest over the pure layer (no DOM required)
build/csp-plugin.ts  hashes the inlined bundle, emits the strict CSP
```

The domain layer is deliberately DOM-free, which is why the dates, colours,
layout packing, import/export and the whole crypto envelope are unit-testable
without a browser. The WebAuthn ceremony on top is covered end to end against
Chromium's virtual authenticator with PRF enabled — including enrolling a
backup passkey, destroying the original credential, and confirming the backup
still opens the vault.

## No predefined projects

The app ships with **no sample data**: a freshly unlocked vault opens on an
empty board at the current month, with a prompt to add a task or import a
roadmap. Nothing about any real project, person or vendor lives in this
repository — the eight-stage programme the tests exercise is generic content in
`tests/fixtures.ts`, which never reaches the bundle.
