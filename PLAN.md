# Eloise Sport: rewrite plan

Fresh rewrite of the GLUTELAB PWA, renamed **Eloise Sport** (old version: `../../eloisesportapp`).
Developed **locally** in this folder. Once ready, it replaces the old code in
`github.com/Bluekeyapp/eloisesportapp` and the old version is deleted.

## Decisions

| Topic | Decision |
|---|---|
| Platform | Web app (installable PWA), same as today |
| Approach | Fresh rewrite |
| Name | Eloise Sport |
| Language | French only |
| Accounts | None. Data stays on the device (localStorage) |
| Price | Free |
| Stack | Vite + TypeScript + Svelte, vite-plugin-pwa |
| Hosting | GitHub Pages (same repo and URL as the old app) |

## Must not break: existing users' progress

Existing users' progress lives in localStorage under `gl-state-v1` on
`bluekeyapp.github.io/eloisesportapp/`.

- Deploy the rewrite to the **same repo and URL** so the data stays readable.
- New data is saved under `es-state-v2`. On first launch the app upgrades from
  `gl-state-v1` (or the older `gl-done`, `gl-sessions`, `gl-history`, `gl-week` keys)
  and never modifies or deletes those old keys. Old JSON backups can still be imported.
- The new service worker must cleanly replace the old one (old caches are
  prefixed `glutelab`).

## Features

**Keep:** 12-week program (content unchanged), exercise checkboxes,
complete/partial sessions, rest timer, offline + install, JSON export/import,
tips page.

**Improve:** design, week navigation, progress screen.

**New in v1:**
- Sound + vibration when rest ends (phone is usually put down during rest)
- Weight used per exercise, pre-filled from last time (supports the program's
  phase-by-phase weight increases)

**Guided workout (full screen):** session intro (warm-up, exercise preview, Commencer)
then one screen per set with a big main button, a full-screen rest timer after every set
(pause, ±15s) that ends with a "C'est reparti !" screen offering the next exercise, effort countdowns for timed exercises (per
side when needed), circuits and supersets done in rounds, screen kept awake.

**Not in v1:** notes per exercise (low use, clutters the workout screen), reminders
(need a server and are unreliable for web apps on iPhone).

## Phases

### 1. Specs
- [x] Final feature list for v1
- [x] Final app name: Eloise Sport
- [x] 5 screens: Home, Workout, Session done, Progress, Tips (built directly)

### 2. Setup
- [x] Vite + Svelte + TypeScript project
- [x] vite-plugin-pwa (replaces hand-written `sw.js` and `?v=` versioning)
- [x] Vitest for logic
- [x] Playwright end-to-end tests (`e2e/`), incl. offline and upgrade from the old app
- [x] Structure: `src/data/program.ts`, `src/lib/{state,storage,timer}.ts`, `src/screens/`

### 3. Build
- [x] Port program data and progress rules + their tests from the old app
      (a session is complete only when every exercise is checked)
- [x] Screens
- [x] Rest timer logic based on an absolute end time (survives screen lock)
- [x] Rest timer UI with sound + vibration
- [x] Weight field per exercise
- [x] Offline, install prompt, "update available" banner
- [x] Migration from old format (logic + tests)
- [x] Backup export/import UI

### 4. Before launch
- [x] Health disclaimer and short privacy note (no data collected)
- [x] PNG icons from the Eloise logo (`npm run icons` regenerates them from `brand/logo.webp`)
- [x] Automated accessibility checks (WCAG 2.1 AA on every screen, 200% text zoom)
- [ ] Manual screen reader check: VoiceOver (iPhone), TalkBack (Android)
- [ ] Real devices: iPhone Safari and Android Chrome installed to home screen,
      timer with screen locked, offline, **update from old version with existing progress**
- [ ] Beta: 3–5 people, 1–2 weeks of real workouts

### Test copy (for phones)

Live at **https://bluekeyapp.github.io/eloisesport-test/** (repo `Bluekeyapp/eloisesport-test`,
public, built app only). Built with `npm run build:test`: own address, own storage key
(`es-test-state-v2`), never touches the old app's data or caches, yellow "Version de test"
banner, installs as "Eloise Test". It reads the old app's progress, so the upgrade can be
tested on a phone that already has GLUTELAB.

To update it: `npm run build:test`, copy `dist-test/` into a clone of the test repo, commit, push.

Phone checklist (iPhone Safari + Android Chrome):
- [ ] Open the link on a phone that has the old app with progress: progress shows up
- [ ] Add to home screen: Eloise icon and name "Eloise Test"
- [ ] Do a workout: check exercises, log a weight, finish
- [ ] Rest timer with the screen locked: sound/vibration, "Repos terminé" on return
- [ ] Airplane mode: app still opens and works
- [ ] VoiceOver / TalkBack: exercises and buttons are read clearly
- [ ] Larger text setting: nothing cut off

### 5. Launch
- [x] Tag the old version in git (rollback point): `glutelab-final`
- [x] Replace the old code in the repo with this project, update the GitHub Actions workflow
- [x] Push to `main` → GitHub Pages deploys
- [x] Delete the test repo `Bluekeyapp/eloisesport-test`
- [ ] Optional: custom domain, privacy-friendly analytics

## Commands

```sh
npm install      # once
npm run dev      # http://localhost:5173/eloisesportapp/
npm test         # logic tests
npm run e2e      # end-to-end + accessibility tests (builds the app first)
npm run icons    # regenerate icons from brand/logo.webp
npm run check    # type check
npm run build    # production build in dist/
```
