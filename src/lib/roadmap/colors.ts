// Internal work gets vibrant hues; not-my-team work is forced to grey so
// ownership is legible before any label is read. The chosen hue is kept in the
// model either way, so flipping a task back restores its colour.

import type { Task } from './types'

/**
 * One ramp, used for every task regardless of ownership.
 *
 * Colour identifies the PROJECT, not who is doing the work — so a glance at a
 * block says which project it belongs to, and ownership is carried by weight
 * instead. Tuned for the warm near-black page, warm end first; the violet and
 * slate an existing roadmap may already use are both included so stored
 * colours still light up a swatch in the editor.
 */
export const PROJECT_COLORS = [
  '#e44332', '#f97316', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6',
  '#64748b', '#8d8279',
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

export const palette = (): string[] => PROJECT_COLORS

export const isHex = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9a-f]{3,6}$/i.test(v)

/**
 * The hue a block is drawn in. `projectHue` wins when supplied, so every stage
 * of a project reads as that project even when an imported file gave its
 * other-team stages a different colour.
 */
export function baseColor(task: Pick<Task, 'color'>, projectHue?: string): string {
  if (isHex(projectHue)) return projectHue
  return isHex(task.color) ? task.color : PROJECT_COLORS[0]
}

export interface Skin {
  fill: string
  border: string
  text: string
}

// The page the blocks sit on, and the lightest ink available.
const PAGE = '#14110f'
const INK = '#f3ede7'

/** WCAG contrast ratio between two opaque colours. */
export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/**
 * Re-weight a colour until it sits at `target` contrast against the page,
 * darkening toward the page or lightening toward the ink as needed.
 *
 * Mixing by a fixed RATIO does not work here: how dark the result lands
 * depends entirely on how dark the chosen hue already was, so a slate blue
 * recedes into invisibility while a yellow stays loud. Targeting the ratio
 * itself makes every hue land at the same visual weight.
 */
function atContrast(base: string, target: number): string {
  const toward = contrastRatio(base, PAGE) > target ? PAGE : INK
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    const over = contrastRatio(mix(base, toward, mid), PAGE) > target
    if (toward === PAGE ? over : !over) lo = mid
    else hi = mid
  }
  return mix(base, toward, (lo + hi) / 2)
}

/**
 * The floor no block may fall through, whatever its hue.
 *
 * `atContrast` aims at a target but cannot always land on it: colours are
 * quantised to 8-bit channels, so the search settles within ~0.015 of the
 * mark. That is invisible, except at the very bottom of the scale where it
 * could tip the quietest block under the minimum — so the minimum is enforced
 * rather than assumed.
 */
const MIN_FILL_CONTRAST = 1.3

function atLeastContrast(c: string, min: number): string {
  let out = c
  for (let i = 0; i < 40 && contrastRatio(out, PAGE) < min; i++) {
    out = mix(out, INK, 0.04)
  }
  return out
}

/**
 * Where each block's fill sits against the page, loudest first.
 *
 * Since hue now identifies the PROJECT, ownership has to be carried entirely
 * by weight — and a gentle dimming was not enough to read at a glance. So the
 * two bands are kept apart: my team is SOLID (>= 1.7:1) and other teams are
 * GHOSTED (<= 1.5:1), which reads as filled-vs-outlined rather than as
 * "slightly darker". Intensity still steps within each band.
 *
 * Nothing is allowed to reach the page itself: the quietest combination still
 * separates at 1.3:1.
 */
const FILL_TARGET: Record<Task['status'], { mine: number; theirs: number }> = {
  intensive: { mine: 2.45, theirs: 1.52 },
  background: { mine: 2.0, theirs: 1.42 },
  // kept clear of MIN_FILL_CONTRAST: if the floor had to lift this one, the
  // lift is toward a warm ink and would disturb the ordering it sits in.
  hold: { mine: 1.7, theirs: 1.34 },
}

/**
 * The border carries the block's boundary, so it clears WCAG 1.4.11's 3:1 for
 * non-text contrast in every state — that is what keeps a ghosted block
 * unambiguously present rather than merely faint. Other-team blocks keep the
 * full-strength border precisely because their fill is so light: the hue lives
 * in the outline, which is what makes the project still readable.
 */
const BORDER_TARGET: Record<Task['status'], number> = {
  intensive: 5.4,
  background: 4.2,
  hold: 3.2,
}

/** Fill / border / text for a block, derived from one base hue. */
export function blockSkin(
  task: Pick<Task, 'color' | 'isMyTeam' | 'status'>,
  projectHue?: string,
): Skin {
  const base = baseColor(task, projectHue)
  const fillTarget = FILL_TARGET[task.status][task.isMyTeam ? 'mine' : 'theirs']
  const fill = atLeastContrast(atContrast(base, fillTarget), MIN_FILL_CONTRAST)
  const border = atContrast(base, Math.max(3.05, BORDER_TARGET[task.status]))
  return { fill, border, text: luminance(fill) > 0.42 ? '#14110f' : '#f3ede7' }
}
