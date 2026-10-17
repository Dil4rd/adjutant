import { describe, expect, it } from 'vitest'
import {
  EXTERNAL_COLORS, INTERNAL_COLORS, baseColor, blockSkin, hexToRgb, luminance, mix,
  paletteFor, saturationSpread, toGrey,
} from '../src/lib/roadmap/colors'

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

  it('greys to a true neutral', () => {
    const [r, g, b] = hexToRgb(toGrey('#ef4444'))
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(10)
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
    for (const c of [...INTERNAL_COLORS, ...EXTERNAL_COLORS, '#ff0000', '#00ff88']) {
      expect(saturationSpread(baseColor({ color: c, isMyTeam: false }))).toBeLessThanOrEqual(40)
    }
  })

  it('offers the matching palette', () => {
    expect(paletteFor(true)).toBe(INTERNAL_COLORS)
    expect(paletteFor(false)).toBe(EXTERNAL_COLORS)
    expect(paletteFor(true)).toContain('#8b5cf6')
    expect(paletteFor(false)).toContain('#64748b')
  })

  it('falls back when the colour is junk', () => {
    expect(baseColor({ color: 'rebeccapurple', isMyTeam: true })).toBe(INTERNAL_COLORS[0])
  })
})

describe('block skin', () => {
  it('dims on-hold relative to active', () => {
    const base = { color: '#8b5cf6', isMyTeam: true } as const
    const active = blockSkin({ ...base, status: 'active' })
    const hold = blockSkin({ ...base, status: 'hold' })
    expect(luminance(hold.fill)).toBeLessThan(luminance(active.fill))
  })

  it('picks a readable text colour on both ends', () => {
    expect(blockSkin({ color: '#eab308', isMyTeam: true, status: 'active' }).text).toBeTruthy()
    const dark = blockSkin({ color: '#0d1117', isMyTeam: true, status: 'active' })
    expect(dark.text).toBe('#eef4fb')
  })
})
