import { describe, expect, it } from 'vitest'
import {
  addMonths, diffDays, firstOfMonth, iso, isValidISO, mondayOf, monthWeeks, parseISO, shiftISO,
} from '../src/lib/roadmap/dates'

describe('day strings', () => {
  it('round-trips through Date', () => {
    expect(iso(parseISO('2026-10-19'))).toBe('2026-10-19')
  })

  it('compares lexicographically as chronologically', () => {
    expect('2026-10-28' < '2026-10-29').toBe(true)
    expect('2026-12-31' < '2027-01-01').toBe(true)
  })

  it('crosses a DST boundary without rolling a day', () => {
    // Europe/London springs forward 2026-03-29
    expect(shiftISO('2026-03-28', 2)).toBe('2026-03-30')
    // ...and falls back 2026-10-25
    expect(shiftISO('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('crosses a year end', () => {
    expect(shiftISO('2026-12-30', 5)).toBe('2027-01-04')
    expect(diffDays('2026-12-14', '2027-01-08')).toBe(25)
  })

  it('validates shape', () => {
    expect(isValidISO('2026-10-19')).toBe(true)
    expect(isValidISO('19/10/2026')).toBe(false)
    expect(isValidISO(20261019)).toBe(false)
    expect(isValidISO(undefined)).toBe(false)
  })

  it('moves by whole months', () => {
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonths('2027-01-01', -2)).toBe('2026-11-01')
  })

  it('finds the first of a month', () => {
    expect(firstOfMonth(parseISO('2026-10-17'))).toBe('2026-10-01')
  })
})

describe('weeks start on Monday', () => {
  it('resolves a Sunday back to the preceding Monday', () => {
    expect(iso(mondayOf(parseISO('2026-10-18')))).toBe('2026-10-12')
  })

  it('resolves a Monday to itself', () => {
    expect(iso(mondayOf(parseISO('2026-10-19')))).toBe('2026-10-19')
  })

  // every month of a leap year, plus the awkward ones either side
  const cases: [number, number][] = [
    ...Array.from({ length: 12 }, (_, m) => [2024, m] as [number, number]),
    [2026, 0], [2026, 1], [2026, 9], [2026, 11], [2027, 0], [2027, 11],
  ]

  it.each(cases)('month %i-%i is Monday-aligned and fully covered', (y, m) => {
    const weeks = monthWeeks(y, m)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks.every((w) => w[0].getDay() === 1)).toBe(true)
    // the grid must contain every day of the month
    expect(iso(weeks[0][0]) <= iso(new Date(y, m, 1, 12))).toBe(true)
    expect(iso(weeks.at(-1)![6]) >= iso(new Date(y, m + 1, 0, 12))).toBe(true)
    // and weeks must be contiguous
    for (let i = 1; i < weeks.length; i++) {
      expect(diffDays(iso(weeks[i - 1][0]), iso(weeks[i][0]))).toBe(7)
    }
  })
})
