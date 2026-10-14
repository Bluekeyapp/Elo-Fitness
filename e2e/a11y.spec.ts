import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Automated WCAG 2.1 A/AA checks (contrast, labels, roles, names) on every screen.
const screens: [string, string][] = [
  ['Accueil', './#/'],
  ['Séance', './#/seance/w1-a'],
  ['Progrès', './#/progres'],
  ['Conseils', './#/conseils'],
  ['Fin de séance', './#/fin/w1-a'],
]

for (const [name, url] of screens) {
  test(`accessibility: ${name}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(url)
    await expect(page.locator('main h1')).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    const summary = results.violations.map(v => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map(n => n.target.join(' ')).join('\n  ')}`)
    expect(summary, summary.join('\n')).toEqual([])
  })
}

const scan = async (page: import('@playwright/test').Page) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations.map(v => `${v.id}: ${v.help} → ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
}

test('accessibility: guided workout (exercise, timed effort, rest)', async ({ page }) => {
  // Without motion, screens are scanned in their final state rather than mid-transition.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./#/seance/w1-a')
  await page.getByRole('button', { name: '▶ Commencer' }).click()
  await expect(page.locator('.player .pill')).toHaveText('Série 1/4')
  let issues = await scan(page)
  expect(issues, issues.join('\n')).toEqual([])

  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.getByRole('region', { name: 'Repos' })).toBeVisible()
  issues = await scan(page)
  expect(issues, issues.join('\n')).toEqual([])

  await page.goto('./#/seance/w1-a')
  await page.getByRole('button', { name: 'Commencer par Gainage planche' }).click()
  await page.getByRole('button', { name: '▶ Démarrer' }).click()
  issues = await scan(page)
  expect(issues, issues.join('\n')).toEqual([])
})

test('text can be zoomed to 200% without content being cut off sideways', async ({ page }) => {
  for (const url of ['./#/', './#/seance/w1-a', './#/progres', './#/conseils']) {
    await page.goto(url)
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(overflow, `${url} overflows by ${overflow}px`).toBeLessThanOrEqual(0)
  }
})
