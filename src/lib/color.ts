// Derives readable variants of a phase color so text always meets WCAG AA contrast (4.5:1).

type RGB = [number, number, number]

export const hexToRgb = (hex: string): RGB =>
  [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as RGB
export const rgbToHex = (c: RGB) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
export const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t) as RGB

function luminance([r, g, b]: RGB) {
  const ch = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}
export function contrast(a: RGB, b: RGB) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Move `color` toward `target` in small steps until it reaches `ratio` against `against`. */
function adjust(color: RGB, target: RGB, against: RGB, ratio: number): RGB {
  for (let t = 0; t <= 1; t += 0.02) {
    const c = mix(color, target, t)
    if (contrast(c, against) >= ratio) return c
  }
  return target
}

const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0]
const SURFACE: RGB = [0x1c, 0x1c, 0x1c] // lightest dark surface text sits on

/**
 * `strong`: background for white text (buttons, active pills, finished timer).
 * `ink`: text/icon color on dark surfaces, including surfaces lightly tinted with the phase color.
 */
export function phaseShades(hex: string, ratio = 4.5) {
  const base = hexToRgb(hex)
  const strong = adjust(base, BLACK, WHITE, ratio)
  const tinted = mix(SURFACE, base, 0.22) // e.g. the rest button background
  const ink = adjust(base, WHITE, tinted, ratio)
  return { strong: rgbToHex(strong), ink: rgbToHex(ink) }
}
