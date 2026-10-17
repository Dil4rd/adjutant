import { beforeEach, describe, expect, it } from 'vitest'
import { sampleTasks } from './fixtures'
import {
  enrolPasskey, hasRecipients, isUnopenable, kekFromPrf, loadVault, newDek,
  resetVault, unwrapDekWith, wrapDekFor, type Recipient,
} from '../src/lib/auth/vault'
import { readData, writeData } from '../src/lib/roadmap/storage'
import type { Persisted } from '../src/lib/roadmap/types'

// A minimal localStorage, so the vault and storage modules run unmodified
// under the node test environment.
class MemoryStorage {
  private m = new Map<string, string>()
  getItem = (k: string) => this.m.get(k) ?? null
  setItem = (k: string, v: string) => void this.m.set(k, String(v))
  removeItem = (k: string) => void this.m.delete(k)
  clear = () => this.m.clear()
  key = (i: number) => [...this.m.keys()][i] ?? null
  get length() { return this.m.size }
}

/* A passkey's PRF output is just 32 high-entropy bytes. Feeding synthetic ones
 * exercises the exact production path — HKDF → AES-GCM → wrap/unwrap — with no
 * authenticator involved; the browser ceremony around it is covered e2e. */
const prf = (seed: number): ArrayBuffer => {
  const b = new Uint8Array(32)
  for (let i = 0; i < 32; i++) b[i] = (seed * 31 + i * 7) % 256
  return b.buffer
}
const rawOf = async (k: CryptoKey) => Buffer.from(await crypto.subtle.exportKey('raw', k)).toString('base64')

const payload = (): Persisted => ({
  meta: { version: 1, name: 'Roadmap', updatedAt: null },
  tasks: sampleTasks(),
  view: { months: 2, anchor: '2026-10-01', project: 'All' },
})

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage
})

describe('key derivation', () => {
  it('is deterministic for the same PRF output', async () => {
    const dek = await newDek()
    const a = await wrapDekFor(prf(1), dek, 'c1', 'k')
    expect(await rawOf(await unwrapDekWith(prf(1), a))).toBe(await rawOf(dek))
  })

  it('yields a different KEK for a different PRF output', async () => {
    const dek = await newDek()
    const entry = await wrapDekFor(prf(1), dek, 'c1', 'k')
    await expect(unwrapDekWith(prf(2), entry)).rejects.toThrow()
  })

  it('produces an AES-GCM key that cannot be exported as a KEK', async () => {
    const kek = await kekFromPrf(prf(1))
    expect(kek.algorithm.name).toBe('AES-GCM')
    expect(kek.extractable).toBe(false)
  })
})

describe('wrapping', () => {
  it('never stores the data key in the clear', async () => {
    const dek = await newDek()
    const entry = await wrapDekFor(prf(1), dek, 'c1', 'k')
    expect(JSON.stringify(entry)).not.toContain(await rawOf(dek))
  })

  it('uses a fresh nonce every time', async () => {
    const dek = await newDek()
    const a = await wrapDekFor(prf(1), dek, 'c1', 'k')
    const b = await wrapDekFor(prf(1), dek, 'c1', 'k')
    expect(a.iv).not.toBe(b.iv)
    expect(a.wrapped).not.toBe(b.wrapped)
  })

  it('fails closed on a tampered wrap', async () => {
    const dek = await newDek()
    const entry = await wrapDekFor(prf(1), dek, 'c1', 'k')
    const bad = { ...entry, wrapped: entry.wrapped.slice(0, -4) + 'AAAA' }
    await expect(unwrapDekWith(prf(1), bad)).rejects.toThrow()
  })

  it('records the credential it belongs to', async () => {
    const entry = await wrapDekFor(prf(1), await newDek(), 'cred-abc', 'Laptop')
    expect(entry.kind).toBe('prf')
    expect(entry.credentialId).toBe('cred-abc')
    expect(entry.label).toBe('Laptop')
    expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('envelope encryption across passkeys', () => {
  it('lets a second passkey unwrap the SAME data key', async () => {
    const dek = await newDek()
    const first = await wrapDekFor(prf(1), dek, 'c1', 'Primary')
    const second = await wrapDekFor(prf(2), dek, 'c2', 'Backup')
    expect(await rawOf(await unwrapDekWith(prf(1), first))).toBe(await rawOf(dek))
    expect(await rawOf(await unwrapDekWith(prf(2), second))).toBe(await rawOf(dek))
  })

  it('leaves the ciphertext untouched when a backup key is enrolled', async () => {
    const dek = await newDek()
    await writeData(dek, payload())
    const before = localStorage.getItem('adjutant:data:v1')
    await wrapDekFor(prf(2), dek, 'c2', 'Backup')
    expect(localStorage.getItem('adjutant:data:v1')).toBe(before)
  })

  it('still opens the roadmap through the backup key', async () => {
    const dek = await newDek()
    await writeData(dek, payload())
    const backup = await wrapDekFor(prf(9), dek, 'c9', 'Backup')
    const recovered = await unwrapDekWith(prf(9), backup)
    expect((await readData(recovered))!.tasks).toEqual(payload().tasks)
  })
})

describe('vault storage', () => {
  const entry = (credentialId: string): Recipient => ({
    kind: 'prf', credentialId, label: 'k', iv: 'aaaa', wrapped: 'bbbb',
    createdAt: new Date().toISOString(),
  })

  it('starts empty', () => {
    expect(loadVault()).toBeUndefined()
    expect(hasRecipients(loadVault())).toBe(false)
    expect(isUnopenable()).toBe(false)
  })

  it('loads a well-formed vault', () => {
    localStorage.setItem('adjutant:vault:v1', JSON.stringify({ version: 1, recipients: [entry('c1')] }))
    expect(loadVault()!.recipients).toHaveLength(1)
    expect(hasRecipients(loadVault())).toBe(true)
  })

  it('ignores a vault of the wrong version', () => {
    localStorage.setItem('adjutant:vault:v1', JSON.stringify({ version: 99, recipients: [entry('c1')] }))
    expect(loadVault()).toBeUndefined()
  })

  it('ignores non-passkey recipients left by an older build', () => {
    localStorage.setItem('adjutant:vault:v1', JSON.stringify({
      version: 1,
      recipients: [{ kind: 'passphrase', salt: 'x', iterations: 600000, iv: 'a', wrapped: 'b' }],
    }))
    expect(loadVault()!.recipients).toHaveLength(0)
    // and the UI must be able to tell "stranded" from "first run"
    expect(isUnopenable()).toBe(true)
  })

  it('keeps the passkeys and drops the rest from a mixed record', () => {
    localStorage.setItem('adjutant:vault:v1', JSON.stringify({
      version: 1, recipients: [{ kind: 'passphrase', iv: 'a', wrapped: 'b' }, entry('c1')],
    }))
    expect(loadVault()!.recipients.map((r) => r.credentialId)).toEqual(['c1'])
    expect(isUnopenable()).toBe(false)
  })

  it('survives a corrupt record', () => {
    localStorage.setItem('adjutant:vault:v1', 'not json at all')
    expect(loadVault()).toBeUndefined()
  })

  it('wipes on reset', () => {
    localStorage.setItem('adjutant:vault:v1', JSON.stringify({ version: 1, recipients: [entry('c1')] }))
    resetVault()
    expect(loadVault()).toBeUndefined()
    expect(isUnopenable()).toBe(false)
  })
})

describe('ceremony guard', () => {
  it('reports WebAuthn missing rather than throwing obscurely', async () => {
    await expect(enrolPasskey('x')).rejects.toThrow(/WebAuthn is not available/)
  })
})

describe('data at rest', () => {
  it('is opaque', async () => {
    const dek = await newDek()
    await writeData(dek, payload())
    const raw = localStorage.getItem('adjutant:data:v1')!
    expect(raw).not.toContain('Example Programme')
    expect(raw).not.toContain('Core Team')
    expect(raw).not.toContain('Baseline')
  })

  it('uses a fresh nonce per write', async () => {
    const dek = await newDek()
    await writeData(dek, payload())
    const a = JSON.parse(localStorage.getItem('adjutant:data:v1')!)
    await writeData(dek, payload())
    const b = JSON.parse(localStorage.getItem('adjutant:data:v1')!)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('reports nothing stored as null, not a crash', async () => {
    expect(await readData(await newDek())).toBeNull()
  })

  it('fails closed on a tampered ciphertext', async () => {
    const dek = await newDek()
    await writeData(dek, payload())
    const blob = JSON.parse(localStorage.getItem('adjutant:data:v1')!)
    blob.ciphertext = blob.ciphertext.slice(0, -4) + 'AAAA'
    localStorage.setItem('adjutant:data:v1', JSON.stringify(blob))
    await expect(readData(dek)).rejects.toThrow()
  })

  it('cannot be read by a different key', async () => {
    const dek = await newDek()
    await writeData(dek, payload())
    await expect(readData(await newDek())).rejects.toThrow()
  })

  it('round-trips meta, tasks and view', async () => {
    const dek = await newDek()
    await writeData(dek, payload())
    expect(await readData(dek)).toEqual(payload())
  })
})
