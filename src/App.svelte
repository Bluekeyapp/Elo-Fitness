<script lang="ts">
  import { tick } from 'svelte'
  import { registerSW } from 'virtual:pwa-register'
  import { app } from './lib/app.svelte'
  import { P } from './data/program'
  import { catalog, phaseForWeek } from './lib/state'
  import { phaseShades } from './lib/color'
  import Home from './screens/Home.svelte'
  import Workout from './screens/Workout.svelte'
  import Player from './screens/Player.svelte'
  import Done from './screens/Done.svelte'
  import Progress from './screens/Progress.svelte'
  import Tips from './screens/Tips.svelte'
  import TabBar from './components/TabBar.svelte'
  import ConfirmDialog from './components/ConfirmDialog.svelte'

  const route = $derived(app.route)
  const phaseColor = $derived(
    P['key' in route ? catalog[route.key].phase : phaseForWeek(app.state.week)].color,
  )

  $effect(() => {
    const root = document.documentElement.style, shades = phaseShades(phaseColor)
    root.setProperty('--phase', phaseColor)
    root.setProperty('--phase-strong', shades.strong)
    root.setProperty('--phase-ink', shades.ink)
  })

  // On every screen change: back to top, and move focus to the heading for screen readers.
  let first = true
  $effect(() => {
    void route
    if (first) { first = false; return }
    window.scrollTo(0, 0)
    tick().then(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }))
  })

  // Offline support + "update available" prompt. Re-check when the app comes back to the foreground.
  const updateSW = registerSW({
    onNeedRefresh() { app.updateReady = () => void updateSW(true) },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      document.addEventListener('visibilitychange', () => { if (!document.hidden) registration.update().catch(() => {}) })
    },
  })
</script>

<main>
  {#if __TEST_BUILD__}
    <div class="test-banner">Version de test • ta progression ici est séparée de l'app actuelle</div>
  {/if}
  {#if app.notice}
    <div class="banner" role="status">
      <p>{app.notice}</p>
      <button onclick={() => (app.notice = '')} aria-label="Fermer le message">✕</button>
    </div>
  {/if}
  {#if app.updateReady}
    <div class="banner update" role="status">
      <p>Une nouvelle version est prête. Ta progression sera conservée.</p>
      <button class="btn" onclick={() => app.applyUpdate()}>Mettre à jour</button>
    </div>
  {/if}

  {#if route.name === 'play'}
    <Player sessionKey={route.key} />
  {:else if route.name === 'workout'}
    {#key route.key}<Workout sessionKey={route.key} />{/key}
  {:else if route.name === 'done'}
    <Done sessionKey={route.key} />
  {:else if route.name === 'progress'}
    <Progress />
  {:else if route.name === 'tips'}
    <Tips />
  {:else}
    <Home />
  {/if}
</main>

{#if route.name === 'home' || route.name === 'progress' || route.name === 'tips'}
  <TabBar />
{/if}
<ConfirmDialog />

<style>
  .test-banner {
    padding: calc(env(safe-area-inset-top, 0px) + 6px) var(--gutter) 6px; text-align: center;
    font-size: 0.78rem; font-weight: 700; background: #f5c542; color: #1a1400;
  }
  .banner {
    max-width: 560px; margin: 0 auto; padding: calc(env(safe-area-inset-top, 0px) + 12px) var(--gutter) 12px;
    display: flex; gap: 12px; align-items: center; background: var(--surface-2); border-bottom: 1px solid var(--border);
    font-size: 0.88rem;
  }
  .banner p { flex: 1; }
  .banner > button:not(.btn) { width: 36px; height: 36px; flex: none; color: var(--muted); }
  .banner .btn { min-height: 40px; padding: 0 16px; flex: none; }
  .banner + :global(.page), .banner + .banner { padding-top: 16px; }
</style>
