// Internal work gets vibrant hues; not-my-team work is forced to grey so
// ownership is legible before any label is read. The chosen hue is kept in the
// model either way, so flipping a task back restores its colour.

import type { Task } from './types'

export const INTERNAL_COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#f97316',
  '#ec4899', '#14b8a6', '#eab308', '#ef4444',
]
export const EXTERNAL_COLORS = [
  '#64748b', '#9ca3af', '#7b8794', '#6b7280', '#525a66', '#d1d5db',
]

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

/** Desaturate to the grey ramp while preserving perceived lightness. */
export function toGrey(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  return rgbToHex(y * 0.55 + 118 * 0.45, y * 0.55 + 120 * 0.45, y * 0.55 + 125 * 0.45)
}

export const paletteFor = (isMyTeam: boolean): string[] =>
  isMyTeam ? INTERNAL_COLORS : EXTERNAL_COLORS

export const isHex = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9a-f]{3,6}$/i.test(v)

export function baseColor(task: Pick<Task, 'color' | 'isMyTeam'>): string {
  const c = isHex(task.color) ? task.color : INTERNAL_COLORS[0]
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

/** Fill / border / text for a block, derived from one base hue. */
export function blockSkin(task: Pick<Task, 'color' | 'isMyTeam' | 'status'>): Skin {
  const base = baseColor(task)
  // On-hold recedes through a dimmer fill; fading the element itself would take
  // the label with it and make blocked work the hardest thing on screen to read.
  const hold = task.status === 'hold'
  const fill = mix(base, '#0d1117', hold ? 0.74 : 0.62)
  const border = mix(base, '#ffffff', hold ? 0.02 : 0.18)
  return { fill, border, text: luminance(fill) > 0.42 ? '#0b0f14' : '#eef4fb' }
}
