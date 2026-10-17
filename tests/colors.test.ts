import { describe, expect, it } from 'vitest'
import {
  MY_TEAM_COLORS, OTHER_TEAM_COLORS, baseColor, blockSkin, contrastRatio, hexToRgb,
  luminance, mix, paletteFor, saturationSpread, toGrey,
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

  it('measures distance from grey', () => {
    expect(saturationSpread('#808080')).toBe(0)
    expect(saturationSpread('#64748b')).toBeLessThanOrEqual(40)
    expect(saturationSpread('#8b5cf6')).toBeGreaterThan(40)
  })

  it('greys to a WARM neutral — still unmistakably grey', () => {
    for (const hue of ['#ef4444', '#3b82f6', '#22c55e', '#8b5cf6']) {
      const [r, g, b] = hexToRgb(toGrey(hue))
      // warm: red leads, blue trails
      expect(r).toBeGreaterThan(b)
      // but nowhere near a chromatic colour
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(20)
    }
  })

  it('greys monotonically — a lighter input stays lighter', () => {
    expect(luminance(toGrey('#ffffff'))).toBeGreaterThan(luminance(toGrey('#808080')))
    expect(luminance(toGrey('#808080'))).toBeGreaterThan(luminance(toGrey('#000000')))
  })
})

describe('ownership hierarchy', () => {
  it('keeps my team vibrant', () => {
    expect(baseColor({ color: '#8b5cf6', isMyTeam: true })).toBe('#8b5cf6')
  })

  it('flattens a saturated hue for not-my-team', () => {
    expect(baseColor({ color: '#ef4444', isMyTeam: false })).toBe(toGrey('#ef4444'))
  })

  it('leaves a deliberate neutral alone', () => {
    expect(baseColor({ color: '#64748b', isMyTeam: false })).toBe('#64748b')
  })

  it('never renders external work vibrant, whatever the input', () => {
    for (const c of [...MY_TEAM_COLORS, ...OTHER_TEAM_COLORS, '#ff0000', '#00ff88']) {
      expect(saturationSpread(baseColor({ color: c, isMyTeam: false }))).toBeLessThanOrEqual(40)
    }
  })

  it('offers the matching palette', () => {
    expect(paletteFor(true)).toBe(MY_TEAM_COLORS)
    expect(paletteFor(false)).toBe(OTHER_TEAM_COLORS)
    // the colours the stored roadmap already uses must stay selectable
    expect(paletteFor(true)).toContain('#8b5cf6')
    expect(paletteFor(false)).toContain('#64748b')
    expect(paletteFor(true)).toContain('#e44332')
  })

  it('falls back when the colour is junk', () => {
    expect(baseColor({ color: 'rebeccapurple', isMyTeam: true })).toBe(MY_TEAM_COLORS[0])
  })
})

const PAGE = '#14110f'

describe('block legibility', () => {
  const combos = STATUSES.flatMap((status) =>
    [true, false].map((isMyTeam) => ({ status, isMyTeam })),
  )
  // every ramp colour, plus adversarial choices an import could carry
  const hues = [...MY_TEAM_COLORS, ...OTHER_TEAM_COLORS, '#000000', '#ffffff', '#0a0a0a', '#1a1a2e']

  it('never lets a block sink into the page', () => {
    for (const hue of hues) {
      for (const c of combos) {
        const { fill } = blockSkin({ ...c, color: hue })
        expect(contrastRatio(fill, PAGE)).toBeGreaterThanOrEqual(1.29)
      }
    }
  })

  it('keeps every block boundary at WCAG 1.4.11 non-text contrast (3:1)', () => {
    for (const hue of hues) {
      for (const c of combos) {
        const { border } = blockSkin({ ...c, color: hue })
        expect(contrastRatio(border, PAGE)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('keeps label text readable on every fill', () => {
    for (const hue of hues) {
      for (const c of combos) {
        const { fill, text } = blockSkin({ ...c, color: hue })
        // 4.5:1 is AA for the small type used inside a block
        expect(contrastRatio(text, fill)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('lands any hue at the same visual weight, dark or light', () => {
    const c = { status: 'intensive' as Status, isMyTeam: true }
    const black = contrastRatio(blockSkin({ ...c, color: '#000000' }).fill, PAGE)
    const white = contrastRatio(blockSkin({ ...c, color: '#ffffff' }).fill, PAGE)
    expect(Math.abs(black - white)).toBeLessThan(0.15)
  })
})

describe('block skin', () => {
  const base = { color: '#8b5cf6', isMyTeam: true } as const

  it('orders the three intensities loudest to quietest', () => {
    const intensive = luminance(blockSkin({ ...base, status: 'intensive' }).fill)
    const background = luminance(blockSkin({ ...base, status: 'background' }).fill)
    const hold = luminance(blockSkin({ ...base, status: 'hold' }).fill)
    expect(intensive).toBeGreaterThan(background)
    expect(background).toBeGreaterThan(hold)
  })

  it('also steps the border weight down', () => {
    const b = (status: 'intensive' | 'background' | 'hold') =>
      luminance(blockSkin({ ...base, status }).border)
    expect(b('intensive')).toBeGreaterThan(b('background'))
    expect(b('background')).toBeGreaterThan(b('hold'))
  })

  it('recedes not-my-team below my team at the same intensity', () => {
    for (const status of STATUSES) {
      const mine = contrastRatio(blockSkin({ color: '#8b5cf6', isMyTeam: true, status }).fill, PAGE)
      const theirs = contrastRatio(blockSkin({ color: '#8b5cf6', isMyTeam: false, status }).fill, PAGE)
      expect(theirs).toBeLessThan(mine)
    }
  })

  it('picks a readable text colour on both ends', () => {
    expect(blockSkin({ color: '#eab308', isMyTeam: true, status: 'intensive' }).text).toBeTruthy()
    const dark = blockSkin({ color: '#14110f', isMyTeam: true, status: 'intensive' })
    expect(dark.text).toBe('#f3ede7')
  })
})
