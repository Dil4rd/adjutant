// The roadmap at rest: AES-GCM under the session's data key.

import { b64uDecode, b64uEncode, randomBytes } from '../auth/webauthn'
import { dataClear, dataGet, dataSet } from '../auth/store'
import type { Persisted } from './types'

interface Blob {
  version: 1
  iv: string
  ciphertext: string
}

export async function readData(dek: CryptoKey): Promise<Persisted | null> {
  const blob = dataGet<Blob>()
  if (!blob) return null
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64uDecode(blob.iv) },
    dek,
    b64uDecode(blob.ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(pt)) as Persisted
}

export async function writeData(dek: CryptoKey, payload: Persisted): Promise<void> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dek,
    new TextEncoder().encode(JSON.stringify(payload)),
  )
  dataSet<Blob>({ version: 1, iv: b64uEncode(iv), ciphertext: b64uEncode(ct) })
}

export const clearData = dataClear
