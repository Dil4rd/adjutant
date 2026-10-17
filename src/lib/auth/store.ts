// Where the vault and the encrypted roadmap live.
//
// Hindsightly uses IndexedDB; the brief for this app asks for local storage, and
// the payload is a single small JSON blob, so a two-key localStorage store is
// the honest fit. Both values are useless without unlocking.

const LS_VAULT = 'adjutant:vault:v1'
const LS_DATA = 'adjutant:data:v1'

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export const vaultGet = <T>() => read<T>(LS_VAULT)
export const vaultSet = <T>(v: T) => localStorage.setItem(LS_VAULT, JSON.stringify(v))
export const vaultClear = () => localStorage.removeItem(LS_VAULT)

export const dataGet = <T>() => read<T>(LS_DATA)
export const dataSet = <T>(v: T) => localStorage.setItem(LS_DATA, JSON.stringify(v))
export const dataClear = () => localStorage.removeItem(LS_DATA)
