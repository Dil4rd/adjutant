<script lang="ts">
  import {
    enrolPasskey, enrolPassphrase, hasKind, loadVault, resetVault,
    unlockWithPasskey, unlockWithPassphrase,
  } from '../lib/auth/vault'
  import { isWebAuthnAvailable } from '../lib/auth/webauthn'
  import { clearData } from '../lib/roadmap/storage'

  let { mode, onUnlocked }: { mode: 'enrol' | 'unlock'; onUnlocked: (dek: CryptoKey, fresh: boolean) => void } =
    $props()

  let label = $state('Roadmap')
  let pass1 = $state('')
  let pass2 = $state('')
  let pass = $state('')
  let error = $state('')
  let busy = $state(false)

  const vault = $derived(mode === 'unlock' ? loadVault() : undefined)
  const hasPass = $derived(hasKind(vault, 'passphrase'))
  const hasPrf = $derived(hasKind(vault, 'prf'))

  const webauthn = isWebAuthnAvailable()
  const secure = typeof window !== 'undefined' && window.isSecureContext

  if (!webauthn) error = 'This browser has no WebAuthn support — use a passphrase.'
  else if (!secure)
    error =
      'Passkeys need a secure context (https:// or localhost). Serve this file over https or use a passphrase.'

  async function attempt(fn: () => Promise<CryptoKey>, fresh: boolean) {
    error = ''
    busy = true
    try {
      onUnlocked(await fn(), fresh)
    } catch (e) {
      error = (e as Error).message || String(e)
    } finally {
      busy = false
    }
  }

  function enrolWithPassphrase() {
    if (pass1.length < 10) return (error = 'Use at least 10 characters.')
    if (pass1 !== pass2) return (error = 'The two passphrases do not match.')
    attempt(() => enrolPassphrase(pass1), true)
  }

  function reset() {
    if (!confirm('Erase the encrypted roadmap and all enrolled keys from this browser? This cannot be undone.'))
      return
    resetVault()
    clearData()
    error = ''
    location.reload()
  }
</script>

<div id="lock">
  <div class="lock-card">
    <h1>Adjutant</h1>
    <p class="sub">Project roadmap calendar — encrypted in your browser.</p>

    {#if mode === 'enrol'}
      <div id="lockEnrol">
        <p class="hint">
          Your roadmap is encrypted with a key that only your passkey can unwrap. Nothing is sent
          anywhere; the data never leaves this browser.
        </p>
        <div class="field">
          <label for="enrolLabel">Passkey label</label>
          <input id="enrolLabel" bind:value={label} autocomplete="off" />
        </div>
        <div class="row">
          <button
            id="btnEnrol"
            class="primary"
            disabled={busy || !webauthn}
            onclick={() => attempt(() => enrolPasskey(label.trim() || 'Roadmap'), true)}
          >
            Create passkey &amp; start
          </button>
        </div>

        <div class="lock-sep">or</div>
        <p class="hint">No passkey support? Use a passphrase instead (PBKDF2, 600k iterations).</p>
        <div class="field">
          <input
            id="enrolPass"
            type="password"
            placeholder="Passphrase (min 10 chars)"
            autocomplete="new-password"
            bind:value={pass1}
          />
        </div>
        <div class="field">
          <input
            id="enrolPass2"
            type="password"
            placeholder="Repeat passphrase"
            autocomplete="new-password"
            bind:value={pass2}
          />
        </div>
        <div class="row">
          <button id="btnEnrolPass" disabled={busy} onclick={enrolWithPassphrase}>
            Use a passphrase
          </button>
        </div>
      </div>
    {:else}
      <div id="lockUnlock">
        <p class="hint">This browser holds an encrypted roadmap. Unlock it to continue.</p>
        {#if hasPrf}
          <div class="row">
            <button
              id="btnUnlock"
              class="primary"
              disabled={busy}
              onclick={() => attempt(() => unlockWithPasskey(vault!), false)}
            >
              Unlock with passkey
            </button>
          </div>
        {/if}
        {#if hasPass}
          <!-- Only an "or" when there is genuinely a choice of two ways in. -->
          {#if hasPrf}<div class="lock-sep" id="unlockSep">or</div>{/if}
          <div class="field">
            <input
              id="unlockPass"
              type="password"
              placeholder="Passphrase"
              autocomplete="current-password"
              bind:value={pass}
            />
          </div>
          <div class="row">
            <button
              id="btnUnlockPass"
              disabled={busy}
              onclick={() => attempt(() => unlockWithPassphrase(vault!, pass), false)}
            >
              Unlock with passphrase
            </button>
          </div>
        {/if}
        <div class="row" style="margin-top:1.25rem">
          <button id="btnReset" class="danger" onclick={reset}>Reset &amp; erase local data</button>
        </div>
      </div>
    {/if}

    <p id="lockErr" class="error" style="margin-top:0.9rem">{error}</p>
  </div>
</div>
