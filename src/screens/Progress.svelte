<script lang="ts">
  import { app } from '../lib/app.svelte'
  import { P } from '../data/program'
  import {
    WEEKS, catalog, completedKeys, historyEntries, phaseForWeek, sessionProgress, sessionsForWeek, weekIsDone,
  } from '../lib/state'

  const week = $derived(app.state.week)
  const phase = $derived(P[phaseForWeek(week)])
  const totalSessions = Object.keys(catalog).length
  const done = $derived(completedKeys(app.state).length)
  const pct = $derived(Math.round((done / totalSessions) * 100))
  const history = $derived(historyEntries(app.state))
  const weeks = Array.from({ length: WEEKS }, (_, i) => i + 1)
  let showAllHistory = $state(false)

  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date inconnue'
</script>

<div class="page">
  <header class="page-head">
    <h1 tabindex="-1">Progrès</h1>
    <p>Ton parcours sur les 12 semaines</p>
  </header>

  <section class="card overview" aria-label="Programme">
    <div class="ov-top">
      <div><span>Programme</span><strong>{pct}%</strong></div>
      <div class="ov-count">{done}<small>/{totalSessions} séances</small></div>
    </div>
    <div class="bar" aria-hidden="true"><span style:width="{pct}%"></span></div>
  </section>

  <section class="section" aria-labelledby="weeks-title">
    <div class="section-title"><h2 id="weeks-title">Semaines</h2><span>Touche une semaine pour l'ouvrir</span></div>
    <div class="weeks">
      {#each weeks as w}
        {@const ph = P[phaseForWeek(w)]}
        <button
          class="wk" class:current={w === week} class:full={weekIsDone(app.state, w)} style:--c={ph.color}
          aria-label="Semaine {w}, {sessionsForWeek(w).filter(s => sessionProgress(app.state, s.key).complete).length} séances terminées sur 4"
          aria-current={w === week ? 'true' : undefined}
          onclick={() => { app.setWeek(w); app.go({ name: 'home' }) }}
        >
          <span class="wk-n">S{w}</span>
          <span class="dots" aria-hidden="true">
            {#each sessionsForWeek(w) as s}
              {@const sp = sessionProgress(app.state, s.key)}
              <i class:on={sp.complete} class:half={!sp.complete && sp.count > 0}></i>
            {/each}
          </span>
        </button>
      {/each}
    </div>
    <div class="legend" aria-hidden="true">
      {#each P as p}<span><i style:background={p.color}></i>{p.name}</span>{/each}
    </div>
  </section>

  <section class="section" aria-labelledby="goals-title">
    <div class="section-title"><h2 id="goals-title">Objectifs de la phase</h2><span>{phase.name} • {phase.wk}</span></div>
    <ul class="card goals">
      {#each phase.prog as goal}<li>{goal}</li>{/each}
    </ul>
  </section>

  <section class="section" aria-labelledby="history-title">
    <div class="section-title"><h2 id="history-title">Historique</h2><span>{history.length} séance{history.length > 1 ? 's' : ''}</span></div>
    {#if !history.length}
      <p class="empty">Aucune séance terminée pour le moment. La première arrive vite !</p>
    {:else}
      <ul class="history">
        {#each showAllHistory ? history : history.slice(0, 8) as e (e.key)}
          <li>
            <button onclick={() => app.go({ name: 'workout', key: e.key })}>
              <span class="h-main"><strong>{e.session}</strong><span>Semaine {e.week} • {date(e.date)}</span></span>
              <span class="h-tag" class:partial={!e.complete}>{e.complete ? 'Terminée' : `Partielle ${e.count}/${e.total}`}</span>
            </button>
          </li>
        {/each}
      </ul>
      {#if history.length > 8 && !showAllHistory}
        <button class="btn ghost block more" onclick={() => (showAllHistory = true)}>Voir tout l'historique ({history.length})</button>
      {/if}
    {/if}
  </section>
</div>

<style>
  .overview { padding: 18px; }
  .ov-top { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
  .ov-top span { display: block; color: var(--muted); font-size: 0.85rem; }
  .ov-top strong { font-size: 2.4rem; line-height: 1; }
  .ov-count { font-size: 1.4rem; font-weight: 800; }
  .ov-count small { font-size: 0.8rem; color: var(--muted); font-weight: 600; }
  .overview .bar { height: 10px; }

  .weeks { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .wk {
    padding: 10px 8px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border);
    display: grid; gap: 8px; justify-items: center;
  }
  .wk.current { border-color: var(--c); box-shadow: inset 0 0 0 1px var(--c); }
  .wk.full { background: color-mix(in srgb, var(--c) 20%, var(--surface)); }
  .wk-n { font-weight: 800; font-size: 0.85rem; }
  .dots { display: flex; gap: 4px; }
  .dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--border); }
  .dots i.on { background: var(--c); border-color: var(--c); }
  .dots i.half { background: color-mix(in srgb, var(--c) 40%, transparent); border-color: var(--c); }
  .legend { display: flex; gap: 14px; margin-top: 10px; font-size: 0.78rem; color: var(--muted); flex-wrap: wrap; }
  .legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }

  .goals { list-style: none; margin: 0; padding: 6px 16px; }
  .goals li { padding: 10px 0 10px 18px; position: relative; border-top: 1px solid var(--border); font-size: 0.92rem; }
  .goals li:first-child { border-top: 0; }
  .goals li::before { content: ''; position: absolute; left: 0; top: 17px; width: 7px; height: 7px; border-radius: 50%; background: var(--phase); }

  .empty { color: var(--muted); }
  .history { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
  .history button {
    width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; text-align: left;
    padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
  }
  .h-main { display: grid; min-width: 0; }
  .h-main span { color: var(--muted); font-size: 0.82rem; }
  .h-tag { flex: none; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--ok); }
  .h-tag.partial { color: var(--muted); }
  .more { margin-top: 10px; }
</style>
