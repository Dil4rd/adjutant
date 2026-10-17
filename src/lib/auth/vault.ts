// The encrypted vault.
//
// Hindsightly encrypts a short API token once PER enrolled credential. The
// secret here is the dataset itself, which grows, so this is envelope
// encryption instead: one random 256-bit DEK encrypts the roadmap, and every
// enrolled passkey wraps its own copy of that 32-byte DEK. Any passkey unlocks;
// enrolling a backup key therefore never re-encrypts the data. Keys are derived
// on demand from the PRF output and never stored.
//
// The WebAuthn ceremony (browser-only) is kept separate from the crypto
// (pure), so the whole envelope is unit-testable without an authenticator.

import {
  b64uDecode,
  b64uEncode,
  getPrfOutput,
  isWebAuthnAvailable,
  randomBytes,
  registerCredential,
} from './webauthn'
import { vaultClear, vaultGet, vaultSet } from './store'

export interface Recipient {
  kind: 'prf'
  credentialId: string // base64url
  label: string
  iv: string // base64url — AES-GCM nonce
  wrapped: string // base64url — AES-GCM(raw DEK)
  createdAt: string // ISO
}

export interface Vault {
  version: 1
  recipients: Recipient[]
}

const enc = new TextEncoder()
// Fixed, non-secret HKDF salt (the PRF output is already high-entropy; HKDF's
// role here is domain separation via `info`).
const HKDF_SALT = enc.encode('adjutant:hkdf:v1')
const KEK_INFO = enc.encode('adjutant/kek/v1')

// --- the crypto core (no WebAuthn, no DOM) ----------------------------------

/** PRF output → the key-encryption key that wraps the DEK. */
export async function kekFromPrf(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: KEK_INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function newDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

/** Wrap `dek` for the holder of `prfOutput`, producing a storable recipient. */
export async function wrapDekFor(
  prfOutput: ArrayBuffer,
  dek: CryptoKey,
  credentialId: string,
  label: string,
): Promise<Recipient> {
  const kek = await kekFromPrf(prfOutput)
  const raw = await crypto.subtle.exportKey('raw', dek)
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw)
  return {
    kind: 'prf',
    credentialId,
    label,
    iv: b64uEncode(iv),
    wrapped: b64uEncode(ct),
    createdAt: new Date().toISOString(),
  }
}

/** Recover the DEK from a recipient, given that credential's PRF output. */
export async function unwrapDekWith(
  prfOutput: ArrayBuffer,
  entry: Recipient,
): Promise<CryptoKey> {
  const kek = await kekFromPrf(prfOutput)
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64uDecode(entry.iv) },
    kek,
    b64uDecode(entry.wrapped),
  )
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

// --- vault storage ----------------------------------------------------------

export function loadVault(): Vault | undefined {
  const v = vaultGet<Vault>()
  if (!v || v.version !== 1 || !Array.isArray(v.recipients)) return undefined
  // Only passkeys can unlock. Anything else in an older record is ignored
  // rather than half-trusted, so the UI can offer a clean re-enrolment.
  const recipients = v.recipients.filter((r) => r?.kind === 'prf' && !!r.credentialId)
  return { version: 1, recipients }
}

export function hasRecipients(v: Vault | undefined): v is Vault {
  return !!v && v.recipients.length > 0
}

/** A vault exists but holds nothing that can open it — offer a reset. */
export function isUnopenable(): boolean {
  return vaultGet() !== undefined && !hasRecipients(loadVault())
}

function putRecipient(entry: Recipient): void {
  const existing = loadVault()
  vaultSet<Vault>({
    version: 1,
    recipients: [
      ...(existing?.recipients ?? []).filter((r) => r.credentialId !== entry.credentialId),
      entry,
    ],
  })
}

// --- ceremonies -------------------------------------------------------------

/**
 * Enroll a passkey. With `existingDek` this is backup-key enrolment against the
 * key already unlocked in this session; without, a fresh DEK is minted.
 * Re-enrolling the same credential id replaces its entry.
 */
export async function enrolPasskey(label: string, existingDek?: CryptoKey): Promise<CryptoKey> {
  if (!isWebAuthnAvailable()) throw new Error('WebAuthn is not available in this browser.')
  const { credentialId, prfOutput } = await registerCredential(label)
  const dek = existingDek ?? (await newDek())
  putRecipient(await wrapDekFor(prfOutput, dek, credentialId, label))
  return dek
}

/** Prompt for any enrolled passkey and return the unwrapped data key. */
export async function unlockWithPasskey(vault: Vault): Promise<CryptoKey> {
  if (!vault.recipients.length) throw new Error('No passkey is enrolled in this vault.')
  const { credentialId, prfOutput } = await getPrfOutput(
    vault.recipients.map((r) => r.credentialId),
  )
  const entry = vault.recipients.find((r) => r.credentialId === credentialId)
  if (!entry) throw new Error('The credential used is not enrolled in this vault.')
  try {
    return await unwrapDekWith(prfOutput, entry)
  } catch {
    throw new Error(
      'Could not unwrap the data key. Use "Reset & erase local data" and enrol again.',
    )
  }
}

export function resetVault(): void {
  vaultClear()
}
