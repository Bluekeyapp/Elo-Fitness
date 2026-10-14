import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('es-state-v2') ?? 'null'))
const pill = (page: Page) => page.locator('.player .pill')
const heading = (page: Page) => page.locator('.player h1')

/** Home → session intro screen of week 1, Monday. */
async function openFirstSession(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: /Commencer/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fessiers priorité' })).toBeVisible()
}

test('a whole guided session, set by set, ends on the Bravo screen and is recorded once', async ({ page }) => {
  await page.clock.install()
  await openFirstSession(page)
  await page.getByRole('button', { name: '▶ Commencer' }).click()
  await expect(pill(page)).toHaveText('Série 1/4')
  await expect(heading(page)).toHaveText('Poussée de hanches au sol')

  // Work through every set: regular sets, rests and the timed plank (both left to run out).
  const actions = ['Série suivante ›', 'Exercice suivant ›', 'Terminer', '▶ Démarrer']
  for (let guard = 0; guard < 80 && !page.url().includes('#/fin/'); guard++) {
    if (await page.getByRole('button', { name: '❚❚ Pause' }).isVisible()) { await page.clock.runFor(121_000); continue }
    for (const name of actions) {
      const button = page.getByRole('button', { name, exact: true })
      if (await button.isVisible()) { await button.click(); break }
    }
  }
  await expect(page.getByRole('heading', { name: 'Bravo !' })).toBeVisible()
  expect((await stored(page)).sessions['w1-a'].checked).toEqual([true, true, true, true, true, true])

  await page.goto('./')
  await expect(page.locator('.stats')).toContainText('1/48')
  expect(Object.keys((await stored(page)).sessions)).toEqual(['w1-a'])
})

test('finishing a set starts a full-screen rest that can be paused, adjusted, then offers the next set', async ({ page }) => {
  await page.clock.install()
  await openFirstSession(page)
  await page.getByRole('button', { name: '▶ Commencer' }).click()
  await page.getByRole('button', { name: 'Terminer' }).click()

  const rest = page.getByRole('region', { name: 'Repos' })
  await expect(rest.getByRole('timer')).toContainText('1:00')
  await expect(rest).toContainText('Série 2/4')
  await page.getByRole('button', { name: 'Ajouter 15 secondes' }).click()
  await expect(rest.getByRole('timer')).toContainText('1:15')

  await page.getByRole('button', { name: '❚❚ Pause' }).click()
  await page.clock.runFor(120_000)
  await expect(rest.getByRole('timer')).toContainText('1:15')
  await page.getByRole('button', { name: '▶ Reprendre' }).click()
  await page.clock.runFor(76_000)

  // Once the rest is over, the next set waits for the user.
  await expect(rest.getByRole('heading', { name: "C'est reparti !" })).toBeVisible()
  await page.getByRole('button', { name: 'Série suivante ›' }).click()
  await expect(pill(page)).toHaveText('Série 2/4')
  await expect(heading(page)).toHaveText('Poussée de hanches au sol')
})

test('the last set of an exercise checks it off and the next exercise follows', async ({ page }) => {
  await page.clock.install()
  await openFirstSession(page)
  await page.getByRole('button', { name: '▶ Commencer' }).click()
  for (let set = 1; set <= 4; set++) {
    await expect(pill(page)).toHaveText(`Série ${set}/4`)
    await page.getByRole('button', { name: 'Terminer' }).click()
    if (set < 4) {
      await page.clock.runFor(61_000)
      await page.getByRole('button', { name: 'Série suivante ›' }).click()
    }
  }
  await expect(page.getByRole('region', { name: 'Repos' })).toContainText('Squat sumo')
  expect((await stored(page)).sessions['w1-a'].checked[0]).toBe(true)
  await page.clock.runFor(61_000)
  await page.getByRole('button', { name: 'Exercice suivant ›' }).click()
  await expect(heading(page)).toHaveText('Squat sumo')
  await expect(pill(page)).toHaveText('Série 1/3')
})

test('timed exercises count down the effort, per side when needed, then rest', async ({ page }) => {
  await page.clock.install()
  await page.goto('./#/seance/w1-c')
  await page.getByRole('button', { name: 'Commencer par Planche latérale' }).click()
  await expect(pill(page)).toHaveText('Série 1/3 • Côté 1/2')
  await page.getByRole('button', { name: '▶ Démarrer' }).click()
  await page.clock.runFor(26_000)
  await expect(pill(page)).toHaveText('Série 1/3 • Côté 2/2')
  await page.getByRole('button', { name: '▶ Côté 2' }).click()
  await page.clock.runFor(26_000)
  await expect(page.getByRole('region', { name: 'Repos' })).toContainText('Série 2/3')
})

test('circuits are done in rounds with the rest after each round', async ({ page }) => {
  await page.clock.install()
  await page.goto('./#/seance/w5-d2')
  await expect(page.locator('.circuit-label')).toHaveText('Circuit • 4 tours')
  await page.getByRole('button', { name: '▶ Commencer' }).click()
  for (const [position, name] of ['Squat sauté', 'Fente sautée', 'balancier kettlebell'].entries()) {
    await expect(pill(page)).toHaveText(`Tour 1/4 • ${position + 1}/4`)
    await expect(heading(page)).toHaveText(`Circuit : ${name}`)
    await page.getByRole('button', { name: 'Terminer' }).click()
  }
  await expect(heading(page)).toHaveText('Circuit : Planche + grimpeur')
  await page.getByRole('button', { name: '▶ Démarrer' }).click()
  await page.clock.runFor(31_000)
  const rest = page.getByRole('region', { name: 'Repos' })
  await expect(rest.getByRole('timer')).toContainText(/1:(30|2\d)/) // 90s rest, a moment already elapsed
  await expect(rest).toContainText('Tour 2/4 • 1/4')
})

test('previous and skip move between sets without counting them', async ({ page }) => {
  await openFirstSession(page)
  await page.getByRole('button', { name: '▶ Commencer' }).click()
  await expect(page.getByRole('button', { name: 'Série précédente' })).toBeDisabled()
  await page.getByRole('button', { name: 'Passer cette série' }).click()
  await expect(pill(page)).toHaveText('Série 2/4')
  await page.getByRole('button', { name: 'Série précédente' }).click()
  await expect(pill(page)).toHaveText('Série 1/4')
  expect(await stored(page)).toMatchObject({ sessions: {} })
})

test('a partial session asks for confirmation and is shown as partial', async ({ page }) => {
  await openFirstSession(page)
  await page.getByRole('button', { name: 'Cocher Poussée de hanches au sol' }).click()
  await page.getByRole('button', { name: 'Cocher Squat sumo' }).click()
  await expect(page.getByRole('button', { name: /Reprendre • exercice 3/ })).toBeVisible()

  await page.getByRole('button', { name: 'Terminer la séance maintenant' }).click()
  await expect(page.getByRole('dialog')).toContainText('2 / 6 exercices cochés')
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/#\/seance\/w1-a$/)

  await page.getByRole('button', { name: 'Terminer la séance maintenant' }).click()
  await page.getByRole('button', { name: 'Terminer quand même' }).click()
  await expect(page.getByRole('heading', { name: 'Séance partielle' })).toBeVisible()

  await page.goto('./#/progres')
  await expect(page.locator('.history')).toContainText('Partielle 2/6')
  await expect(page.locator('.overview')).toContainText('0/48')
})

test('a logged weight is suggested the next time the exercise comes up', async ({ page }) => {
  await openFirstSession(page)
  await page.getByRole('button', { name: 'Commencer par Squat sumo' }).click()
  const field = page.getByLabel('Charge utilisée')
  await field.fill('14kg')
  await field.press('Enter')
  await expect.poll(async () => (await stored(page)).sessions['w1-a'].loads[1]).toBe('14kg')

  await page.goto('./#/seance/w2-a')
  await page.getByRole('button', { name: 'Commencer par Squat sumo' }).click()
  await expect(page.getByLabel('Charge utilisée')).toHaveAttribute('placeholder', '14kg (dernière fois)')
  await page.getByRole('button', { name: 'Reprendre 14kg' }).click()
  await expect(page.getByLabel('Charge utilisée')).toHaveValue('14kg')
  expect((await stored(page)).sessions['w2-a'].loads[1]).toBe('14kg')
})

test('reopening a session resumes at the first unfinished exercise', async ({ page }) => {
  await openFirstSession(page)
  await page.getByRole('button', { name: 'Cocher Poussée de hanches au sol' }).click()
  await page.getByRole('button', { name: /Reprendre • exercice 2/ }).click()
  await expect(heading(page)).toHaveText('Squat sumo')
  await page.reload()
  await expect(heading(page)).toHaveText('Squat sumo')
})

test('the phone back button leaves the workout, then returns to the home screen', async ({ page }) => {
  await openFirstSession(page)
  await page.getByRole('button', { name: '▶ Commencer' }).click()
  await expect(pill(page)).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Fessiers priorité' })).toBeVisible()
  await page.goBack()
  await expect(page.locator('.stats')).toBeVisible()
})

test('week and phase navigation update the active week', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Semaine suivante' }).click()
  await expect(page.locator('.badge')).toHaveText('Semaine 2')
  await page.getByRole('button', { name: 'Sculpture' }).click()
  await expect(page.locator('.badge')).toHaveText('Semaine 9')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fessiers max')
  await page.reload()
  await expect(page.locator('.badge')).toHaveText('Semaine 9')
})

test('progress saved by the original GLUTELAB app is kept', async ({ page }) => {
  const v1 = JSON.stringify({
    version: 1, week: 3, legacy: {},
    sessions: { 'w1-a': { checked: [true, true, true, true, true, true], completedAt: '2026-10-01T10:00:00.000Z', endedAt: null } },
  })
  await page.addInitScript(value => { if (!localStorage.getItem('gl-state-v1')) localStorage.setItem('gl-state-v1', value) }, v1)
  await page.goto('./')
  await expect(page.locator('.badge')).toHaveText('Semaine 3')
  await expect(page.locator('.stats')).toContainText('1/48')
  expect(await page.evaluate(() => localStorage.getItem('gl-state-v1'))).toBe(v1)
})

test('progress from the very first app version is recovered with a visible notice', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('gl-week')) return
    localStorage.setItem('gl-week', '5')
    localStorage.setItem('gl-done', JSON.stringify({ 'w1-a-0': true }))
  })
  await page.goto('./')
  await expect(page.getByRole('status').first()).toContainText('Ancienne progression récupérée')
  await expect(page.locator('.badge')).toHaveText('Semaine 5')
})

test('export then import restores progress; a bad file is refused', async ({ page }, info) => {
  await openFirstSession(page)
  await page.getByRole('button', { name: 'Cocher Squat sumo' }).click()
  await page.goto('./#/conseils')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter ma progression' }).click()
  const backup = info.outputPath('backup.json')
  await (await download).saveAs(backup)
  expect(JSON.parse(await readFile(backup, 'utf8')).sessions['w1-a'].checked[1]).toBe(true)

  await page.evaluate(() => localStorage.clear())
  await page.reload()

  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Importer une sauvegarde' }).click()
  await (await chooser).setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  await expect(page.getByRole('status').first()).toContainText('Import refusé')

  const chooser2 = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Importer une sauvegarde' }).click()
  await (await chooser2).setFiles(backup)
  await page.getByRole('button', { name: 'Remplacer' }).click()
  await expect(page.getByRole('status').first()).toContainText('Sauvegarde importée')
  expect((await stored(page)).sessions['w1-a'].checked[1]).toBe(true)
})

test('the app works offline after the first visit', async ({ page, context }) => {
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // let the worker take control of the page
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: /Commencer/ })).toBeVisible()
  await page.getByRole('button', { name: 'Conseils' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Conseils' })).toBeVisible()
  await context.setOffline(false)
})
