<script lang="ts">
  import { enrolPasskey, isUnopenable, loadVault, resetVault, unlockWithPasskey } from '../lib/auth/vault'
  import { isWebAuthnAvailable } from '../lib/auth/webauthn'
  import { clearData } from '../lib/roadmap/storage'

  let {
    mode,
    onUnlocked,
  }: { mode: 'enrol' | 'unlock'; onUnlocked: (dek: CryptoKey, fresh: boolean) => void } = $props()

  let label = $state('Roadmap')
  let error = $state('')
  let busy = $state(false)

  const vault = $derived(mode === 'unlock' ? loadVault() : undefined)
  const stranded = $derived(mode === 'unlock' && isUnopenable())

  const webauthn = isWebAuthnAvailable()
  const secure = typeof window !== 'undefined' && window.isSecureContext
  const blocked = !webauthn || !secure

  if (!webauthn) {
    error = 'This browser has no WebAuthn support, so there is no way to hold the encryption key.'
  } else if (!secure) {
    error =
      'Passkeys need a secure context. Open this over https:// or localhost — from a file:// path the browser will not allow one.'
  }

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

  function reset() {
    if (
      !confirm('Erase the encrypted roadmap and all enrolled passkeys from this browser? This cannot be undone.')
    )
      return
    resetVault()
    clearData()
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
          <input id="enrolLabel" bind:value={label} autocomplete="off" disabled={blocked} />
        </div>
        <div class="row">
          <button
            id="btnEnrol"
            class="primary"
            disabled={busy || blocked}
            onclick={() => attempt(() => enrolPasskey(label.trim() || 'Roadmap'), true)}
          >
            {busy ? 'Waiting for your passkey…' : 'Create passkey & start'}
          </button>
        </div>
        <p class="hint" style="margin-top:1rem">
          There is no password and no recovery: if every enrolled passkey is lost, the roadmap
          cannot be decrypted by anyone. Enrol a second passkey from <strong>+ Backup key</strong>
          once you are in, and keep an Export JSON copy.
        </p>
      </div>
    {:else}
      <div id="lockUnlock">
        {#if stranded}
          <p class="hint">
            This browser holds an encrypted roadmap, but no passkey is enrolled against it — so
            there is no key that can open it. Reset to start fresh.
          </p>
        {:else}
          <p class="hint">This browser holds an encrypted roadmap. Unlock it with your passkey.</p>
          <div class="row">
            <button
              id="btnUnlock"
              class="primary"
              disabled={busy || blocked}
              onclick={() => attempt(() => unlockWithPasskey(vault!), false)}
            >
              {busy ? 'Waiting for your passkey…' : 'Unlock with passkey'}
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
