// Internal work gets vibrant hues; not-my-team work is forced to grey so
// ownership is legible before any label is read. The chosen hue is kept in the
// model either way, so flipping a task back restores its colour.

import type { Task } from './types'

// Tuned for hindsightly's warm near-black (#14110f), warm end first. The
// violet and slate your roadmap already uses are kept in the ramps so stored
// colours still light up a swatch in the editor.
export const MY_TEAM_COLORS = [
  '#e44332', '#f97316', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6',
]
export const OTHER_TEAM_COLORS = [
  '#7d7169', '#6b6158', '#8d8279', '#5b534c', '#9c9189', '#64748b',
]

/** @deprecated kept so older imports keep resolving */
export const INTERNAL_COLORS = MY_TEAM_COLORS
export const EXTERNAL_COLORS = OTHER_TEAM_COLORS

export function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ]
}

const clamp255 = (v: number) => Math.round(Math.max(0, Math.min(255, v)))
export const rgbToHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t)
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** How far a colour strays from grey: max channel spread, 0..255. */
export function saturationSpread(hex: string): number {
  const c = hexToRgb(hex)
  return Math.max(...c) - Math.min(...c)
}

// A warm neutral to pull greyed colours toward, so they sit on the warm
// near-black rather than floating cold above it.
const GREY_TINT: [number, number, number] = [134, 120, 106]
const GREY_MIX = 0.45

/** Desaturate to a warm grey, preserving perceived lightness. */
export function toGrey(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  // One coefficient for every channel: the tint supplies the warmth, so
  // lightness stays monotonic across r/g/b.
  const k = 1 - GREY_MIX
  return rgbToHex(
    y * k + GREY_TINT[0] * GREY_MIX,
    y * k + GREY_TINT[1] * GREY_MIX,
    y * k + GREY_TINT[2] * GREY_MIX,
  )
}

export const paletteFor = (isMyTeam: boolean): string[] =>
  isMyTeam ? MY_TEAM_COLORS : OTHER_TEAM_COLORS

export const isHex = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9a-f]{3,6}$/i.test(v)

export function baseColor(task: Pick<Task, 'color' | 'isMyTeam'>): string {
  const c = isHex(task.color) ? task.color : MY_TEAM_COLORS[0]
  // Not-my-team work is out of focus, always. A colour that is already a grey
  // or slate (#64748b, say) is left alone so a deliberate neutral keeps its
  // character; only a genuinely saturated hue gets flattened. Either way the
  // invariant holds: nothing external ever renders vibrant.
  if (task.isMyTeam) return c
  return saturationSpread(c) > 40 ? toGrey(c) : c
}

export interface Skin {
  fill: string
  border: string
  text: string
}

// How far each state's fill is pulled back toward the page, loudest first.
// Intensity is carried by weight as well as by border style and texture, so
// the three states read apart even in a grey screenshot.
const FILL_TOWARD_BG: Record<Task['status'], number> = {
  intensive: 0.52,
  background: 0.74,
  hold: 0.82,
}
const BORDER_TOWARD_WHITE: Record<Task['status'], number> = {
  intensive: 0.24,
  background: 0.10,
  hold: 0.02,
}

// Work that is not mine recedes a further step, on top of whatever its
// intensity already does — "out of focus" is about weight, not only hue.
const NOT_MINE_EXTRA_RECESSION = 0.1

/** Fill / border / text for a block, derived from one base hue. */
export function blockSkin(task: Pick<Task, 'color' | 'isMyTeam' | 'status'>): Skin {
  const base = baseColor(task)
  // Quieter states recede through a dimmer fill; fading the element itself
  // would take the label with it and make the quietest work the hardest to read.
  const recede = Math.min(
    0.9,
    FILL_TOWARD_BG[task.status] + (task.isMyTeam ? 0 : NOT_MINE_EXTRA_RECESSION),
  )
  const fill = mix(base, '#14110f', recede)
  const border = mix(
    base,
    '#f3ede7',
    task.isMyTeam ? BORDER_TOWARD_WHITE[task.status] : BORDER_TOWARD_WHITE[task.status] * 0.5,
  )
  return { fill, border, text: luminance(fill) > 0.42 ? '#14110f' : '#f3ede7' }
}
