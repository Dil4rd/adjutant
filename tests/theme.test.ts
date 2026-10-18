import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveTheme, storePref, storedPref, surfaceOf, systemTheme } from '../src/lib/theme'
import { SURFACES } from '../src/lib/roadmap/colors'

class MemoryStorage {
  private m = new Map<string, string>()
  getItem = (k: string) => this.m.get(k) ?? null
  setItem = (k: string, v: string) => void this.m.set(k, String(v))
  removeItem = (k: string) => void this.m.delete(k)
  clear = () => this.m.clear()
  key = (i: number) => [...this.m.keys()][i] ?? null
  get length() { return this.m.size }
}

const setSystem = (light: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: light && q.includes('light') }))

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage
  vi.unstubAllGlobals()
})

describe('preference storage', () => {
  it('defaults to following the system', () => {
    expect(storedPref()).toBe('system')
  })

  it('round-trips an explicit choice', () => {
    storePref('light')
    expect(storedPref()).toBe('light')
    storePref('dark')
    expect(storedPref()).toBe('dark')
  })

  it('clears back to system', () => {
    storePref('light')
    storePref('system')
    expect(storedPref()).toBe('system')
  })

  it('ignores a corrupt value', () => {
    localStorage.setItem('adjutant:theme', 'chartreuse')
    expect(storedPref()).toBe('system')
  })

  it('does not store the theme with the encrypted data', () => {
    storePref('light')
    // the vault and roadmap keys must be untouched by a theme change
    expect(localStorage.getItem('adjutant:vault:v1')).toBeNull()
    expect(localStorage.getItem('adjutant:data:v1')).toBeNull()
  })
})

describe('resolution', () => {
  it('honours an explicit choice over the system', () => {
    setSystem(true)
    expect(resolveTheme('dark')).toBe('dark')
    setSystem(false)
    expect(resolveTheme('light')).toBe('light')
  })

  it('follows the system when asked to', () => {
    setSystem(true)
    expect(resolveTheme('system')).toBe('light')
    setSystem(false)
    expect(resolveTheme('system')).toBe('dark')
  })

  it('falls back to dark where matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(systemTheme()).toBe('dark')
    expect(resolveTheme('system')).toBe('dark')
  })
})

describe('surfaces', () => {
  it('maps each theme to its page and ink', () => {
    expect(surfaceOf('dark')).toBe(SURFACES.dark)
    expect(surfaceOf('light')).toBe(SURFACES.light)
  })

  it('inverts page and ink between themes', () => {
    expect(SURFACES.dark.page).toBe(SURFACES.light.ink === '#1b1714' ? '#14110f' : SURFACES.dark.page)
    // the dark page must be darker than the light page
    expect(SURFACES.dark.page < SURFACES.light.page).toBe(true)
  })
})
