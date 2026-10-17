import { beforeEach, describe, expect, it } from 'vitest'
import {
  enrolPasskey, enrolPassphrase, hasKind, hasRecipients, loadVault,
  resetVault, unlockWithPassphrase, type Vault,
} from '../src/lib/auth/vault'
import { readData, writeData } from '../src/lib/roadmap/storage'
import { seedTasks } from '../src/lib/roadmap/model'
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

const PASS = 'correct-horse-battery-staple'
const payload = (): Persisted => ({
  meta: { version: 1, name: 'Roadmap', updatedAt: null },
  tasks: seedTasks(),
  view: { months: 2, anchor: '2026-10-01', project: 'All' },
})

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage
})

describe('vault lifecycle', () => {
  it('starts empty', () => {
    expect(loadVault()).toBeUndefined()
    expect(hasRecipients(loadVault())).toBe(false)
  })

  it('enrols a passphrase recipient', async () => {
    await enrolPassphrase(PASS)
    const v = loadVault()!
    expect(v.version).toBe(1)
    expect(v.recipients).toHaveLength(1)
    expect(v.recipients[0].kind).toBe('passphrase')
    expect(hasKind(v, 'passphrase')).toBe(true)
    expect(hasKind(v, 'prf')).toBe(false)
  })

  it('never stores the data key in the clear', async () => {
    const dek = await enrolPassphrase(PASS)
    const raw = JSON.stringify(loadVault())
    const exported = Buffer.from(await crypto.subtle.exportKey('raw', dek)).toString('base64')
    expect(raw).not.toContain(exported)
    expect(raw).not.toContain(PASS)
  })

  it('uses a fresh salt and iv per enrolment', async () => {
    const a = await enrolPassphrase(PASS)
    const first = loadVault()!.recipients[0]
    globalThis.localStorage = new MemoryStorage() as unknown as Storage
    await enrolPassphrase(PASS, a)
    const second = loadVault()!.recipients[0]
    expect(first).not.toEqual(second)
    if (first.kind === 'passphrase' && second.kind === 'passphrase') {
      expect(first.salt).not.toBe(second.salt)
    }
    expect(first.iv).not.toBe(second.iv)
  })

  it('records a hardened iteration count', async () => {
    await enrolPassphrase(PASS)
    const r = loadVault()!.recipients[0]
    if (r.kind !== 'passphrase') throw new Error('wrong kind')
    expect(r.iterations).toBeGreaterThanOrEqual(600_000)
  })

  it('wipes on reset', async () => {
    await enrolPassphrase(PASS)
    resetVault()
    expect(loadVault()).toBeUndefined()
  })

  it('ignores a vault of the wrong version', async () => {
    await enrolPassphrase(PASS)
    const v = loadVault()! as Vault & { version: number }
    localStorage.setItem('adjutant:vault:v1', JSON.stringify({ ...v, version: 99 }))
    expect(loadVault()).toBeUndefined()
  })

  it('reports WebAuthn missing rather than throwing obscurely', async () => {
    await expect(enrolPasskey('x')).rejects.toThrow(/WebAuthn is not available/)
  })
})

describe('unlock', () => {
  it('returns a key that decrypts what the enrolment key encrypted', async () => {
    const dek = await enrolPassphrase(PASS)
    await writeData(dek, payload())
    const again = await unlockWithPassphrase(loadVault()!, PASS)
    expect((await readData(again))!.tasks).toEqual(payload().tasks)
  })

  it('rejects the wrong passphrase', async () => {
    await enrolPassphrase(PASS)
    await expect(unlockWithPassphrase(loadVault()!, 'wrong')).rejects.toThrow(/Wrong passphrase/)
  })

  it('rejects when no passphrase is enrolled', async () => {
    await enrolPassphrase(PASS)
    const v = loadVault()!
    await expect(unlockWithPassphrase({ ...v, recipients: [] }, PASS)).rejects.toThrow(
      /No passphrase is enrolled/,
    )
  })
})

describe('envelope encryption', () => {
  it('lets a second recipient unwrap the SAME data key', async () => {
    const dek = await enrolPassphrase(PASS)
    await writeData(dek, payload())
    // re-enrolling against the live DEK is what "+ Backup key" does
    await enrolPassphrase('a-different-passphrase-entirely', dek)
    const viaSecond = await unlockWithPassphrase(loadVault()!, 'a-different-passphrase-entirely')
    const read = await readData(viaSecond)
    expect(read!.tasks).toEqual(payload().tasks)
  })

  it('does not re-encrypt the data when a recipient is added', async () => {
    const dek = await enrolPassphrase(PASS)
    await writeData(dek, payload())
    const before = localStorage.getItem('adjutant:data:v1')
    await enrolPassphrase('another-one-here-please', dek)
    expect(localStorage.getItem('adjutant:data:v1')).toBe(before)
  })
})

describe('data at rest', () => {
  it('is opaque', async () => {
    const dek = await enrolPassphrase(PASS)
    await writeData(dek, payload())
    const raw = localStorage.getItem('adjutant:data:v1')!
    expect(raw).not.toContain('BYOD')
    expect(raw).not.toContain('Ross')
    expect(raw).not.toContain('Baseline')
  })

  it('uses a fresh nonce per write', async () => {
    const dek = await enrolPassphrase(PASS)
    await writeData(dek, payload())
    const a = JSON.parse(localStorage.getItem('adjutant:data:v1')!)
    await writeData(dek, payload())
    const b = JSON.parse(localStorage.getItem('adjutant:data:v1')!)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('reports nothing stored as null, not a crash', async () => {
    const dek = await enrolPassphrase(PASS)
    expect(await readData(dek)).toBeNull()
  })

  it('fails closed on a tampered ciphertext', async () => {
    const dek = await enrolPassphrase(PASS)
    await writeData(dek, payload())
    const blob = JSON.parse(localStorage.getItem('adjutant:data:v1')!)
    blob.ciphertext = blob.ciphertext.slice(0, -4) + 'AAAA'
    localStorage.setItem('adjutant:data:v1', JSON.stringify(blob))
    await expect(readData(dek)).rejects.toThrow()
  })

  it('round-trips the view state too', async () => {
    const dek = await enrolPassphrase(PASS)
    await writeData(dek, payload())
    expect((await readData(dek))!.view).toEqual(payload().view)
  })
})
