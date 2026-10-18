import { describe, expect, it } from 'vitest'
import {
  PROJECT_COLORS, SURFACES, baseColor, blockSkin, contrastRatio, hexToRgb, luminance, mix, palette,
} from '../src/lib/roadmap/colors'
import { STATUSES, type Status } from '../src/lib/roadmap/types'

describe('colour maths', () => {
  it('expands shorthand hex', () => {
    expect(hexToRgb('#abc')).toEqual([0xaa, 0xbb, 0xcc])
  })

  it('mixes endpoints exactly', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('orders luminance', () => {
    expect(luminance('#ffffff')).toBeGreaterThan(luminance('#808080'))
    expect(luminance('#808080')).toBeGreaterThan(luminance('#000000'))
  })
})

describe('colour identifies the project, not the owner', () => {
  it('uses the project hue for every stage, whoever owns it', () => {
    const hue = '#3b82f6'
    expect(baseColor({ color: '#8b5cf6' }, hue)).toBe(hue)
    expect(baseColor({ color: '#64748b' }, hue)).toBe(hue)
  })

  it('falls back to the task colour when no project hue is known', () => {
    expect(baseColor({ color: '#8b5cf6' })).toBe('#8b5cf6')
    expect(baseColor({ color: '#8b5cf6' }, 'not-a-colour')).toBe('#8b5cf6')
  })

  it('falls back again when the task colour is junk', () => {
    expect(baseColor({ color: 'rebeccapurple' })).toBe(PROJECT_COLORS[0])
  })

  it('offers one ramp regardless of ownership', () => {
    expect(palette()).toBe(PROJECT_COLORS)
    expect(palette()).toContain('#8b5cf6')
    expect(palette()).toContain('#64748b')
  })

  it('draws both owners of a project in the same hue', () => {
    const hue = '#22c55e'
    const mine = blockSkin({ color: hue, isMyTeam: true, status: 'intensive' }, hue)
    const theirs = blockSkin({ color: '#64748b', isMyTeam: false, status: 'intensive' }, hue)
    // same hue family: both sit on the line between the page and that hue
    const hueness = (c: string) => {
      const [r, g, b] = hexToRgb(c)
      return (g + 1) / (r + b + 2)
    }
    expect(Math.abs(hueness(mine.fill) - hueness(theirs.fill))).toBeLessThan(0.25)
    // but ownership still separates them by weight
    expect(luminance(theirs.fill)).toBeLessThan(luminance(mine.fill))
  })
})

const PAGE = '#14110f'

describe('block legibility', () => {
  const combos = STATUSES.flatMap((status) =>
    [true, false].map((isMyTeam) => ({ status, isMyTeam })),
  )
  // every ramp colour, plus adversarial choices an import could carry
  const hues = [...PROJECT_COLORS, '#000000', '#ffffff', '#0a0a0a', '#1a1a2e']

  it('never lets a block sink into the page', () => {
    for (const hue of hues) {
      for (const c of combos) {
        const { fill } = blockSkin({ ...c, color: hue }, hue)
        expect(contrastRatio(fill, PAGE)).toBeGreaterThanOrEqual(1.29)
      }
    }
  })

  it('keeps every block boundary at WCAG 1.4.11 non-text contrast (3:1)', () => {
    for (const hue of hues) {
      for (const c of combos) {
        const { border } = blockSkin({ ...c, color: hue }, hue)
        expect(contrastRatio(border, PAGE)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('keeps label text readable on every fill', () => {
    for (const hue of hues) {
      for (const c of combos) {
        const { fill, text } = blockSkin({ ...c, color: hue }, hue)
        // 4.5:1 is AA for the small type used inside a block
        expect(contrastRatio(text, fill)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps my team and other teams in separate weight bands', () => {
    for (const hue of hues) {
      const mine = STATUSES.map((status) =>
        contrastRatio(blockSkin({ color: hue, isMyTeam: true, status }, hue).fill, PAGE),
      )
      const theirs = STATUSES.map((status) =>
        contrastRatio(blockSkin({ color: hue, isMyTeam: false, status }, hue).fill, PAGE),
      )
      // the quietest of mine still outweighs the loudest of theirs, so
      // ownership reads at a glance rather than needing a label
      expect(Math.min(...mine)).toBeGreaterThan(Math.max(...theirs))
    }
  })

  it('lands any hue at the same visual weight, dark or light', () => {
    const c = { status: 'intensive' as Status, isMyTeam: true }
    const black = contrastRatio(blockSkin({ ...c, color: '#000000' }, '#000000').fill, PAGE)
    const white = contrastRatio(blockSkin({ ...c, color: '#ffffff' }, '#ffffff').fill, PAGE)
    expect(Math.abs(black - white)).toBeLessThan(0.15)
  })
})

describe('block skin', () => {
  const base = { color: '#8b5cf6', isMyTeam: true } as const

  it('orders the three intensities loudest to quietest', () => {
    const intensive = luminance(blockSkin({ ...base, status: 'intensive' }, base.color).fill)
    const background = luminance(blockSkin({ ...base, status: 'background' }, base.color).fill)
    const hold = luminance(blockSkin({ ...base, status: 'hold' }, base.color).fill)
    expect(intensive).toBeGreaterThan(background)
    expect(background).toBeGreaterThan(hold)
  })

  it('also steps the border weight down', () => {
    const b = (status: 'intensive' | 'background' | 'hold') =>
      luminance(blockSkin({ ...base, status }, base.color).border)
    expect(b('intensive')).toBeGreaterThan(b('background'))
    expect(b('background')).toBeGreaterThan(b('hold'))
  })

  it('recedes not-my-team below my team at the same intensity', () => {
    for (const status of STATUSES) {
      const mine = contrastRatio(blockSkin({ color: '#8b5cf6', isMyTeam: true, status }, '#8b5cf6').fill, PAGE)
      const theirs = contrastRatio(blockSkin({ color: '#8b5cf6', isMyTeam: false, status }, '#8b5cf6').fill, PAGE)
      expect(theirs).toBeLessThan(mine)
    }
  })

  it('picks a readable text colour on both ends', () => {
    expect(blockSkin({ color: '#eab308', isMyTeam: true, status: 'intensive' }, '#eab308').text).toBeTruthy()
    const dark = blockSkin({ color: '#14110f', isMyTeam: true, status: 'intensive' }, '#14110f')
    expect(dark.text).toBe('#f3ede7')
  })
})

describe('both themes', () => {
  const themes = ['dark', 'light'] as const
  const combos = STATUSES.flatMap((status) =>
    [true, false].map((isMyTeam) => ({ status, isMyTeam })),
  )
  const hues = [...PROJECT_COLORS, '#000000', '#ffffff']

  it.each(themes)('%s: no block sinks into the page', (name) => {
    const surface = SURFACES[name]
    for (const hue of hues) {
      for (const c of combos) {
        const { fill } = blockSkin({ ...c, color: hue }, hue, surface)
        expect(contrastRatio(fill, surface.page)).toBeGreaterThanOrEqual(1.29)
      }
    }
  })

  it.each(themes)('%s: every border clears 3:1 non-text contrast', (name) => {
    const surface = SURFACES[name]
    for (const hue of hues) {
      for (const c of combos) {
        const { border } = blockSkin({ ...c, color: hue }, hue, surface)
        expect(contrastRatio(border, surface.page)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it.each(themes)('%s: label text stays readable on every fill', (name) => {
    const surface = SURFACES[name]
    for (const hue of hues) {
      for (const c of combos) {
        const { fill, text } = blockSkin({ ...c, color: hue }, hue, surface)
        expect(contrastRatio(text, fill)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it.each(themes)('%s: ownership bands stay separated', (name) => {
    const surface = SURFACES[name]
    for (const hue of hues) {
      const mine = STATUSES.map((status) =>
        contrastRatio(blockSkin({ color: hue, isMyTeam: true, status }, hue, surface).fill, surface.page),
      )
      const theirs = STATUSES.map((status) =>
        contrastRatio(blockSkin({ color: hue, isMyTeam: false, status }, hue, surface).fill, surface.page),
      )
      expect(Math.min(...mine)).toBeGreaterThan(Math.max(...theirs))
    }
  })

  it.each(themes)('%s: intensity still steps loudest to quietest', (name) => {
    const surface = SURFACES[name]
    const c = (status: Status, isMyTeam: boolean) =>
      contrastRatio(blockSkin({ color: '#3b82f6', isMyTeam, status }, '#3b82f6', surface).fill, surface.page)
    for (const mine of [true, false]) {
      expect(c('intensive', mine)).toBeGreaterThan(c('background', mine))
      expect(c('background', mine)).toBeGreaterThan(c('hold', mine))
    }
  })

  it('picks opposite text colours for the same hue in each theme', () => {
    const d = blockSkin({ color: '#3b82f6', isMyTeam: true, status: 'intensive' }, '#3b82f6', SURFACES.dark)
    const l = blockSkin({ color: '#3b82f6', isMyTeam: true, status: 'intensive' }, '#3b82f6', SURFACES.light)
    expect(d.text).not.toBe(l.text)
  })

  it('defaults to the dark surface when none is given', () => {
    const a = blockSkin({ color: '#3b82f6', isMyTeam: true, status: 'intensive' }, '#3b82f6')
    const b = blockSkin({ color: '#3b82f6', isMyTeam: true, status: 'intensive' }, '#3b82f6', SURFACES.dark)
    expect(a).toEqual(b)
  })
})
