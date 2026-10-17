// The encrypted vault.
//
// Hindsightly encrypts a short API token once PER enrolled credential. The
// secret here is the dataset itself, which grows, so this is envelope
// encryption instead: one random 256-bit DEK encrypts the roadmap, and every
// recipient — each passkey, plus an optional passphrase — wraps its own copy of
// that 32-byte DEK. Any recipient unlocks; enrolling a backup key therefore
// never re-encrypts the data. Keys are derived on demand and never stored.

import {
  b64uDecode,
  b64uEncode,
  getPrfOutput,
  isWebAuthnAvailable,
  randomBytes,
  registerCredential,
} from './webauthn'
import { vaultClear, vaultGet, vaultSet } from './store'

export interface PrfRecipient {
  kind: 'prf'
  credentialId: string // base64url
  label: string
  iv: string // base64url — AES-GCM nonce
  wrapped: string // base64url — AES-GCM(raw DEK)
  createdAt: string // ISO
}

export interface PassphraseRecipient {
  kind: 'passphrase'
  label: string
  salt: string // base64url — PBKDF2 salt
  iterations: number
  iv: string
  wrapped: string
  createdAt: string
}

export type Recipient = PrfRecipient | PassphraseRecipient

export interface Vault {
  version: 1
  recipients: Recipient[]
}

const enc = new TextEncoder()
// Fixed, non-secret HKDF salt (PRF output is already high-entropy; HKDF's role
// here is domain separation via `info`).
const HKDF_SALT = enc.encode('adjutant:hkdf:v1')
const KEK_INFO = enc.encode('adjutant/kek/v1')
export const PBKDF2_ITER = 600_000

async function kekFromPrf(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: KEK_INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function kekFromPassphrase(
  passphrase: string,
  salt: BufferSource,
  iterations: number,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function loadVault(): Vault | undefined {
  const v = vaultGet<Vault>()
  return v && v.version === 1 && Array.isArray(v.recipients) ? v : undefined
}

export function hasRecipients(v: Vault | undefined): v is Vault {
  return !!v && v.recipients.length > 0
}

export const hasKind = (v: Vault | undefined, kind: Recipient['kind']): boolean =>
  !!v && v.recipients.some((r) => r.kind === kind)

export async function newDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

async function wrapDek(dek: CryptoKey, kek: CryptoKey) {
  const raw = await crypto.subtle.exportKey('raw', dek)
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw)
  return { iv: b64uEncode(iv), wrapped: b64uEncode(ct) }
}

async function unwrapDek(entry: Recipient, kek: CryptoKey): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64uDecode(entry.iv) },
    kek,
    b64uDecode(entry.wrapped),
  )
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

function putRecipient(entry: Recipient, replace: (r: Recipient) => boolean): Vault {
  const existing = loadVault()
  const vault: Vault = {
    version: 1,
    recipients: [...(existing?.recipients ?? []).filter((r) => !replace(r)), entry],
  }
  vaultSet(vault)
  return vault
}

/**
 * Enroll a passkey. With `existingDek` this is backup-key enrolment against the
 * key already unlocked in this session; without, a fresh DEK is minted.
 * Re-enrolling the same credential id replaces its entry.
 */
export async function enrolPasskey(label: string, existingDek?: CryptoKey): Promise<CryptoKey> {
  if (!isWebAuthnAvailable()) throw new Error('WebAuthn is not available in this browser.')
  const { credentialId, prfOutput } = await registerCredential(label)
  const dek = existingDek ?? (await newDek())
  const { iv, wrapped } = await wrapDek(dek, await kekFromPrf(prfOutput))
  putRecipient(
    { kind: 'prf', credentialId, label, iv, wrapped, createdAt: new Date().toISOString() },
    (r) => r.kind === 'prf' && r.credentialId === credentialId,
  )
  return dek
}

export async function enrolPassphrase(
  passphrase: string,
  existingDek?: CryptoKey,
): Promise<CryptoKey> {
  const salt = randomBytes(16)
  const kek = await kekFromPassphrase(passphrase, salt, PBKDF2_ITER)
  const dek = existingDek ?? (await newDek())
  const { iv, wrapped } = await wrapDek(dek, kek)
  putRecipient(
    {
      kind: 'passphrase',
      label: 'Passphrase',
      salt: b64uEncode(salt),
      iterations: PBKDF2_ITER,
      iv,
      wrapped,
      createdAt: new Date().toISOString(),
    },
    (r) => r.kind === 'passphrase',
  )
  return dek
}

/** Prompt for any enrolled passkey and return the unwrapped data key. */
export async function unlockWithPasskey(vault: Vault): Promise<CryptoKey> {
  const ids = vault.recipients.filter((r) => r.kind === 'prf').map((r) => r.credentialId)
  if (!ids.length) throw new Error('No passkey is enrolled in this vault.')
  const { credentialId, prfOutput } = await getPrfOutput(ids)
  const entry = vault.recipients.find(
    (r): r is PrfRecipient => r.kind === 'prf' && r.credentialId === credentialId,
  )
  if (!entry) throw new Error('The credential used is not enrolled in this vault.')
  try {
    return await unwrapDek(entry, await kekFromPrf(prfOutput))
  } catch {
    throw new Error(
      'Could not unwrap the data key. Use "Reset & erase local data" and enrol again.',
    )
  }
}

export async function unlockWithPassphrase(vault: Vault, passphrase: string): Promise<CryptoKey> {
  const entry = vault.recipients.find((r): r is PassphraseRecipient => r.kind === 'passphrase')
  if (!entry) throw new Error('No passphrase is enrolled in this vault.')
  const kek = await kekFromPassphrase(passphrase, b64uDecode(entry.salt), entry.iterations)
  try {
    return await unwrapDek(entry, kek)
  } catch {
    throw new Error('Wrong passphrase.')
  }
}

export function resetVault(): void {
  vaultClear()
}
