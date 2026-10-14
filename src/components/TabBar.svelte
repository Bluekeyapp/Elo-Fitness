<script lang="ts">
  import { app, type Route } from '../lib/app.svelte'

  const tabs: { route: Route; label: string; icon: string }[] = [
    { route: { name: 'home' }, label: 'Séances', icon: 'M4 12h3m10 0h3M7 8v8m10-8v8M9 12h6' },
    { route: { name: 'progress' }, label: 'Progrès', icon: 'M5 19V11m7 8V5m7 14v-6' },
    { route: { name: 'tips' }, label: 'Conseils', icon: 'M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3Zm-2.5 17h5' },
  ]
</script>

<nav aria-label="Navigation principale">
  {#each tabs as tab}
    {@const active = app.route.name === tab.route.name}
    <button class:active aria-current={active ? 'page' : undefined} onclick={() => app.go(tab.route)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={tab.icon} /></svg>
      {tab.label}
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed; z-index: 20; left: 50%; transform: translateX(-50%);
    bottom: calc(12px + var(--safe-bottom)); width: min(560px - 2 * var(--gutter), calc(100% - 2 * var(--gutter)));
    height: var(--tabbar-h); display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 6px;
    background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px); border: 1px solid var(--border); border-radius: 999px;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);
  }
  button {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: var(--muted); transition: background 0.2s, color 0.2s;
  }
  button.active { background: var(--text); color: var(--bg); }
  svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
