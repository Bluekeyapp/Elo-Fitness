// Generates the app icons in public/ from brand/logo.webp.
// Run with `npm run icons` after changing the logo.
import sharp from 'sharp'

const SOURCE = 'brand/logo.webp'
const BACKGROUND = { r: 254, g: 252, b: 251 } // the logo's off-white

// Find the "E" monogram: everything that differs from the background above the "ELOISE" wordmark.
const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const wordmarkTop = Math.round(info.height * 0.58)
let left = info.width, top = info.height, right = 0, bottom = 0
for (let y = 0; y < wordmarkTop; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3
    const diff = Math.abs(data[i] - BACKGROUND.r) + Math.abs(data[i + 1] - BACKGROUND.g) + Math.abs(data[i + 2] - BACKGROUND.b)
    if (diff > 60) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
  }
}
const monogram = await sharp(SOURCE)
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
  .png().toBuffer()

/** `fill` = share of the icon the monogram may occupy (smaller for maskable icons, which get cropped to a circle). */
async function icon(file, size, fill) {
  const inner = Math.round(size * fill)
  const mark = await sharp(monogram).resize(inner, inner, { fit: 'contain', background: { ...BACKGROUND, alpha: 1 } }).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 3, background: BACKGROUND } })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(`public/${file}`)
  console.log(`public/${file}`)
}

/**
 * Monogram for dark backgrounds: black strokes become off-white, the red swoosh stays red,
 * the background becomes transparent. Anti-aliased edges keep their smoothness via alpha.
 */
async function lightMark(file, height) {
  const { data: px, info: m } = await sharp(monogram).resize({ height: height * 2 }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(m.width * m.height * 4)
  const bg = [BACKGROUND.r, BACKGROUND.g, BACKGROUND.b], white = [245, 245, 241]
  for (let i = 0, o = 0; i < px.length; i += 3, o += 4) {
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]]
    const alpha = Math.max(0, Math.min(1, (bg[1] - Math.min(g, b)) / bg[1]))
    // Un-blend from the background to recover the ink color, then decide red vs. black ink.
    const ink = [r, g, b].map((c, k) => alpha > 0.02 ? (c - (1 - alpha) * bg[k]) / alpha : 0)
    const isRed = ink[0] - Math.max(ink[1], ink[2]) > 60
    const color = isRed ? ink.map(c => Math.max(0, Math.min(255, Math.round(c)))) : white
    out.set([...color, Math.round(alpha * 255)], o)
  }
  await sharp(out, { raw: { width: m.width, height: m.height, channels: 4 } })
    .resize({ height }).png({ compressionLevel: 9 }).toFile(`public/${file}`)
  console.log(`public/${file}`)
}

await lightMark('logo-mark-light.png', 96)
await icon('icon-192.png', 192, 0.72)
await icon('icon-512.png', 512, 0.72)
await icon('icon-maskable-512.png', 512, 0.56)
await icon('apple-touch-icon.png', 180, 0.68)
await icon('favicon-48.png', 48, 0.86)
