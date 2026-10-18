// Light / dark switching.
//
// The preference is kept in PLAIN localStorage, not in the encrypted blob:
// the lock screen has to be drawn before anything has been unlocked, and
// "which theme do you like" is not a secret worth protecting.

import { SURFACES, type Surface, type ThemeName } from './roadmap/colors'

const KEY = 'adjutant:theme'

export type ThemePref = ThemeName | 'system'

export function storedPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function storePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    /* a browser with storage disabled still gets a working theme */
  }
}

export function systemTheme(): ThemeName {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

/** The theme actually in force, resolving "system" against the OS setting. */
export function resolveTheme(pref: ThemePref): ThemeName {
  return pref === 'system' ? systemTheme() : pref
}

export const surfaceOf = (theme: ThemeName): Surface => SURFACES[theme]

/** Put the theme on <html> so the CSS token sets switch over. */
export function applyTheme(theme: ThemeName): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
}
