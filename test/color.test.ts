import { test, expect } from 'vitest'
import { contrast, hexToRgb, mix, phaseShades } from '../src/lib/color'
import { P } from '../src/data/program'

test('every phase color gets shades that meet WCAG AA', () => {
  for (const { color } of P) {
    const { strong, ink } = phaseShades(color)
    expect(contrast(hexToRgb(strong), [255, 255, 255])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hexToRgb(ink), mix([0x1c, 0x1c, 0x1c], hexToRgb(color), 0.22))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hexToRgb(ink), [0x05, 0x05, 0x05])).toBeGreaterThanOrEqual(4.5)
  }
})

test('a color that already passes is left unchanged', () => {
  expect(phaseShades('#9B2335').strong).toBe('#9b2335')
})
