// WebAuthn ceremonies used purely as a PRF key-derivation oracle.
// No server, no signature verification — security rests on the fact that the
// correct PRF output can only be produced by the authenticator that holds the
// credential secret.

const RP_NAME = 'Adjutant'

// --- base64url helpers ------------------------------------------------------

export function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64uDecode(str: string): Uint8Array<ArrayBuffer> {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials
  )
}

/**
 * Normalize a PRF result to an ArrayBuffer. Authenticators/passkey providers
 * return it as an ArrayBuffer or a typed-array view; anything else (or absent)
 * yields null so callers can fall back or fail with a clear message — instead
 * of WebCrypto's cryptic "Key data must be a BufferSource".
 */
export function toArrayBuffer(v: unknown): ArrayBuffer | null {
  if (v instanceof ArrayBuffer) return v
  if (ArrayBuffer.isView(v)) {
    const view = v as ArrayBufferView
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
  }
  // 1Password returns the PRF result as a plain number[] (not spec-compliant
  // ArrayBuffer) — accept that shape too.
  if (Array.isArray(v) && v.every((n) => typeof n === 'number')) {
    return new Uint8Array(v as number[]).buffer
  }
  return null
}

// Fixed app-wide PRF input ("salt"). Not secret — it's a domain-separation
// label. The PRF output is still unique per credential, so one shared salt
// suffices and lets us use the most widely supported request shape: top-level
// `eval` (1Password doesn't honor `evalByCredential`).
const PRF_SALT = new TextEncoder().encode('adjutant:prf:v1')

const prfExtension = () =>
  ({ prf: { eval: { first: PRF_SALT } } }) as AuthenticationExtensionsClientInputs

// --- registration -----------------------------------------------------------

export interface NewCredential {
  credentialId: string // base64url
  prfOutput: ArrayBuffer
}

/** Register a new passkey and obtain its PRF output. */
export async function registerCredential(label: string): Promise<NewCredential> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: location.hostname },
      user: { id: randomBytes(16), name: label, displayName: label },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      extensions: prfExtension(),
    },
  })) as PublicKeyCredential | null

  if (!cred) throw new Error('Registration was cancelled.')

  const credentialId = b64uEncode(cred.rawId)
  const ext = cred.getClientExtensionResults() as PrfExtensionResults

  // Accept a create()-time PRF result only if it's a real buffer; otherwise
  // obtain it via an assertion ceremony.
  let prfOutput = toArrayBuffer(ext?.prf?.results?.first)
  if (!prfOutput) {
    prfOutput = (await getPrfOutput([credentialId])).prfOutput
  }

  return { credentialId, prfOutput }
}

// --- assertion (unlock) -----------------------------------------------------

export interface PrfResult {
  credentialId: string // base64url — which credential the user actually used
  prfOutput: ArrayBuffer
}

/**
 * Run an assertion across the given credential ids and return the PRF output of
 * whichever one the user picked, evaluated against the fixed app PRF salt.
 */
export async function getPrfOutput(credentialIds: string[]): Promise<PrfResult> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: location.hostname,
      userVerification: 'required',
      allowCredentials: credentialIds.map((id) => ({
        type: 'public-key' as const,
        id: b64uDecode(id),
      })),
      extensions: prfExtension(),
    },
  })) as PublicKeyCredential | null

  if (!assertion) throw new Error('Unlock was cancelled.')

  const ext = assertion.getClientExtensionResults() as PrfExtensionResults
  const prfOutput = toArrayBuffer(ext?.prf?.results?.first)
  if (!prfOutput) {
    throw new Error(
      'No usable PRF output returned (this passkey/authenticator lacks PRF support). Use a passphrase instead.',
    )
  }
  return { credentialId: b64uEncode(assertion.rawId), prfOutput }
}

// PRF results aren't in the stock DOM typings yet.
interface PrfExtensionResults {
  prf?: { results?: { first?: unknown } }
}
