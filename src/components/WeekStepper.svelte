<script lang="ts">
  import { app } from '../lib/app.svelte'
  import { WEEKS, weekIsDone } from '../lib/state'

  const week = $derived(app.state.week)
</script>

<div class="stepper">
  <button onclick={() => app.setWeek(week - 1)} disabled={week === 1} aria-label="Semaine précédente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" /></svg></button>
  <div class="label" aria-live="polite">
    Semaine {week}<span>/{WEEKS}</span>
    {#if weekIsDone(app.state, week)}<em>✓ terminée</em>{/if}
  </div>
  <button onclick={() => app.setWeek(week + 1)} disabled={week === WEEKS} aria-label="Semaine suivante"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg></button>
</div>

<style>
  .stepper { display: grid; grid-template-columns: 48px 1fr 48px; gap: 8px; align-items: center; }
  button {
    width: 48px; height: 48px; border-radius: 50%; background: var(--surface);
    border: 1px solid var(--border); display: grid; place-items: center;
  }
  button svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .label {
    height: 48px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center; gap: 2px; font-weight: 700;
  }
  .label span { color: var(--faint); font-weight: 500; }
  em { font-style: normal; color: var(--ok); font-size: 0.8rem; margin-left: 8px; }
</style>
