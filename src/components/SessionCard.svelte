<script lang="ts">
  import { app } from '../lib/app.svelte'
  import { catalog, sessionProgress } from '../lib/state'

  let { sessionKey, next = false }: { sessionKey: string; next?: boolean } = $props()

  const session = $derived(catalog[sessionKey])
  const p = $derived(sessionProgress(app.state, sessionKey))
  const status = $derived(p.complete ? 'Terminée' : p.partial ? 'Partielle' : p.count ? 'En cours' : next ? 'À faire' : '')
</script>

<button class="session" class:complete={p.complete} class:next onclick={() => app.go({ name: 'workout', key: sessionKey })}>
  <span class="top">
    <span class="day">{session.day}</span>
    <span class="title">{session.title}</span>
    {#if status}<span class="status">{status}</span>{/if}
  </span>
  <span class="bar" aria-hidden="true"><span style:width="{p.pct}%"></span></span>
  <span class="meta">
    <span>{p.count}/{p.total} exercices</span>
    <span>{p.pct}%</span>
  </span>
</button>

<style>
  .session {
    display: block; width: 100%; text-align: left; padding: 14px 16px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    transition: border-color 0.2s, transform 0.1s;
  }
  .session:active { transform: scale(0.99); }
  .session.next { border-color: color-mix(in srgb, var(--phase) 60%, transparent); }
  .session.complete {
    border-color: var(--phase);
    background: linear-gradient(155deg, color-mix(in srgb, var(--phase) 22%, transparent), var(--surface) 70%);
  }
  .top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .day { color: var(--phase-ink); font-weight: 800; font-size: 0.85rem; text-transform: uppercase; width: 2.6em; flex: none; }
  .title { font-weight: 700; flex: 1; }
  .status {
    font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;
    padding: 4px 10px; border-radius: 999px; background: var(--bg); color: var(--muted); flex: none;
  }
  .complete .status { color: var(--text); }
  .meta { display: flex; justify-content: space-between; color: var(--muted); font-size: 0.82rem; margin-top: 8px; }
</style>
