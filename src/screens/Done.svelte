<script lang="ts">
  import { app } from '../lib/app.svelte'
  import { catalog, sessionProgress, suggestedSession } from '../lib/state'

  let { sessionKey }: { sessionKey: string } = $props()

  const session = $derived(catalog[sessionKey])
  const p = $derived(sessionProgress(app.state, sessionKey))
  const loads = $derived(session.ex.map((ex, i) => ({ name: ex.n, load: app.state.sessions[sessionKey]?.loads[i] ?? '' })).filter(l => l.load))
  const next = $derived(suggestedSession(app.state))
  const hasNext = $derived(next.key !== sessionKey && !sessionProgress(app.state, next.key).complete)
</script>

<div class="page done">
  <div class="emoji" aria-hidden="true">{p.complete ? '🎉' : '💪'}</div>
  <h1 tabindex="-1">{p.complete ? 'Bravo !' : p.count ? 'Séance partielle' : 'Séance arrêtée'}</h1>
  <p class="msg">
    {#if p.complete}
      <strong>{session.title}</strong> est terminée : les {p.total} exercices sont cochés.
    {:else}
      {p.count} / {p.total} exercices faits. Tu peux reprendre cette séance à tout moment.
    {/if}
  </p>

  {#if loads.length}
    <div class="card loads">
      <h2>Charges notées</h2>
      <ul>
        {#each loads as l}<li><span>{l.name}</span><strong>{l.load}</strong></li>{/each}
      </ul>
    </div>
  {/if}

  <div class="actions">
    {#if hasNext}
      <button class="btn primary block" onclick={() => app.go({ name: 'workout', key: next.key })}>Séance suivante : {next.title}</button>
    {/if}
    <button class="btn block" class:ghost={hasNext} onclick={() => app.go({ name: 'home' })}>Retour à l'accueil</button>
  </div>
</div>

<style>
  .done { text-align: center; padding-top: calc(env(safe-area-inset-top, 0px) + 12vh); }
  .emoji { font-size: 4rem; animation: pop 0.5s cubic-bezier(0.2, 1.6, 0.4, 1); }
  @keyframes pop { from { transform: scale(0.3); opacity: 0; } }
  h1 { font-size: 2.2rem; margin: 8px 0; }
  .msg { color: var(--muted); max-width: 32ch; margin: 0 auto; }
  .msg strong { color: var(--text); }
  .loads { text-align: left; margin-top: 28px; }
  .loads h2 { font-size: 1rem; margin-bottom: 8px; }
  .loads ul { list-style: none; padding: 0; margin: 0; }
  .loads li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--border); font-size: 0.92rem; }
  .loads li span { color: var(--muted); }
  .actions { display: grid; gap: 10px; margin-top: 28px; }
</style>
