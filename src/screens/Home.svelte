<script lang="ts">
  import { app } from '../lib/app.svelte'
  import { P } from '../data/program'
  import {
    WEEKS, completedKeys, phaseForWeek, programIsDone, sessionProgress, sessionsForWeek, suggestedSession, weekIsDone,
  } from '../lib/state'
  import { phaseShades } from '../lib/color'
  import SessionCard from '../components/SessionCard.svelte'
  import WeekStepper from '../components/WeekStepper.svelte'

  const week = $derived(app.state.week)
  const phaseIndex = $derived(phaseForWeek(week))
  const phase = $derived(P[phaseIndex])
  const sessions = $derived(sessionsForWeek(week))
  const next = $derived(suggestedSession(app.state))
  const nextProgress = $derived(sessionProgress(app.state, next.key))
  const weekDone = $derived(weekIsDone(app.state, week))
  const allDone = $derived(programIsDone(app.state))
  const doneThisWeek = $derived(sessions.filter(s => sessionProgress(app.state, s.key).complete).length)
  const total = $derived(completedKeys(app.state).length)
</script>

<div class="page">
  <header class="brand-row">
    <div class="brand">
      <img src="{import.meta.env.BASE_URL}logo-mark-light.png" alt="" width="34" height="32" />
      <span>Elo <em>Fitness</em></span>
    </div>
    <div class="badge">Semaine {week}</div>
  </header>

  <section class="hero" aria-labelledby="hero-title">
    <p class="kicker">{phase.name} • {phase.wk}</p>
    {#if allDone}
      <h1 id="hero-title" tabindex="-1">Programme terminé !</h1>
      <p class="sub">Bravo pour les 12 semaines. Tu peux revoir chaque séance.</p>
    {:else if weekDone}
      <h1 id="hero-title" tabindex="-1">Semaine {week} terminée !</h1>
      <p class="sub">{week < WEEKS ? 'Prête pour la semaine suivante ?' : 'Complète les séances restantes des autres semaines.'}</p>
      {#if week < WEEKS}
        <button class="btn hero-btn" onclick={() => app.setWeek(week + 1)}>Semaine {week + 1} →</button>
      {/if}
    {:else}
      <h1 id="hero-title" tabindex="-1">{next.title}</h1>
      <p class="sub">{next.day} • {next.ex.length} exercices • {nextProgress.count ? `${nextProgress.count}/${nextProgress.total} faits` : 'pas encore commencée'}</p>
      <button class="btn hero-btn" onclick={() => app.go({ name: 'workout', key: next.key })}>
        ▶ {nextProgress.count ? 'Reprendre' : 'Commencer'}
      </button>
    {/if}
  </section>

  <div class="stats">
    <div><strong>{week}<small>/12</small></strong><span>Semaine</span></div>
    <div><strong>{doneThisWeek}<small>/{sessions.length}</small></strong><span>Cette semaine</span></div>
    <div><strong>{total}<small>/48</small></strong><span>Séances</span></div>
  </div>

  <div class="section"><WeekStepper /></div>

  <section class="section" aria-labelledby="phases-title">
    <div class="section-title"><h2 id="phases-title">Phases</h2><span>{phase.wk}</span></div>
    <div class="pills">
      {#each P as p, i}
        <button class:on={i === phaseIndex} style:--c={p.color} style:--c-strong={phaseShades(p.color).strong} aria-pressed={i === phaseIndex} onclick={() => app.setWeek(i * 4 + 1)}>
          {p.name}
        </button>
      {/each}
    </div>
  </section>

  <section class="section" aria-labelledby="sessions-title">
    <div class="section-title"><h2 id="sessions-title">Séances</h2><span>{sessions.length} séances • semaine {week}</span></div>
    <div class="list">
      {#each sessions as s (s.key)}
        <SessionCard sessionKey={s.key} next={!weekDone && s.key === next.key} />
      {/each}
    </div>
  </section>
</div>

<style>
  .brand-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 10px; font-size: 1.35rem; font-weight: 900; letter-spacing: -0.02em; }
  .brand img { height: 32px; width: auto; display: block; }
  .brand em { font-style: normal; color: var(--accent); }
  .badge { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); font-weight: 700; font-size: 0.85rem; }

  .hero {
    padding: 22px 20px; border-radius: 24px; border: 1px solid color-mix(in srgb, var(--phase) 40%, var(--border));
    background: radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--phase) 45%, transparent), transparent 60%), var(--surface);
  }
  .kicker { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; font-weight: 800; color: var(--muted); }
  .hero h1 { font-size: clamp(1.7rem, 7vw, 2.2rem); line-height: 1.1; margin: 6px 0; letter-spacing: -0.02em; }
  .sub { color: var(--muted); }
  .hero-btn { margin-top: 18px; }

  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
  .stats div { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; }
  .stats strong { display: block; font-size: 1.3rem; }
  .stats small { color: var(--faint); font-size: 0.8rem; font-weight: 600; }
  .stats span { color: var(--muted); font-size: 0.78rem; }

  .pills { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
  .pills button {
    flex: 1; min-height: 44px; padding: 0 14px; border-radius: 999px; font-weight: 700; font-size: 0.9rem; white-space: nowrap;
    border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); background: var(--surface);
  }
  .pills button.on { background: var(--c-strong); border-color: var(--c-strong); color: #fff; }
  .list { display: grid; gap: 10px; }
</style>
