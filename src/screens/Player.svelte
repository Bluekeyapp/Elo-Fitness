<script lang="ts">
  import { tick } from 'svelte'
  import { app } from '../lib/app.svelte'
  import { catalog, previousLoad } from '../lib/state'
  import { workStepFrom, type WorkStep } from '../lib/flow'
  import CountdownRing from '../components/CountdownRing.svelte'

  let { sessionKey }: { sessionKey: string } = $props()

  const session = $derived(catalog[sessionKey])
  const player = $derived(app.player)
  const step = $derived(app.step)
  const timer = $derived(app.timer)
  const paused = $derived(timer.status === 'paused')
  const record = $derived(app.state.sessions[sessionKey])

  // The exercise shown: the current one, or during a rest, the one coming next.
  const nextWork = $derived.by(() => {
    if (!player) return null
    const i = workStepFrom(player.steps, player.index, 1)
    return i === null ? null : (player.steps[i] as WorkStep)
  })
  const work = $derived(step?.kind === 'work' ? step : null)
  const ex = $derived(work ? session.ex[work.ex] : null)
  const restOver = $derived(step?.kind === 'rest' && timer.status === 'complete')
  // "Série suivante" when the rest is between two sets of the same exercise.
  const sameExercise = $derived.by(() => {
    if (!player || !nextWork) return false
    const i = workStepFrom(player.steps, player.index, -1)
    return i !== null && (player.steps[i] as WorkStep).ex === nextWork.ex
  })
  const load = $derived(work ? record?.loads[work.ex] ?? '' : '')
  const previous = $derived(work ? previousLoad(app.state, sessionKey, work.ex) : '')
  const hasEquipment = (w: string) => w.trim() !== '—'
  const isCount = (r: string) => /^\d+$/.test(r.trim())

  // Each new step (next set, rest, next exercise) re-creates its heading, which takes focus
  // so screen readers announce it.
  const focusOnMount = (node: HTMLElement) => { tick().then(() => node.focus({ preventScroll: true })) }

  const setLabel = (s: WorkStep) =>
    s.circuit ? `Tour ${s.set}/${s.sets} • ${s.circuit.position}/${s.circuit.size}` : `Série ${s.set}/${s.sets}`
</script>

{#if player && step}
  <div class="player" class:resting={step.kind === 'rest'}>
    <header class="top">
      <button class="icon" onclick={() => app.go({ name: 'workout', key: sessionKey })} aria-label="Quitter et voir la liste des exercices">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <div class="progress" role="progressbar" aria-label="Exercices faits" aria-valuemin={0} aria-valuemax={session.ex.length} aria-valuenow={record?.checked.filter(Boolean).length ?? 0}>
        {#each session.ex as _, i}
          <span class:done={record?.checked[i]} class:current={(work ?? nextWork)?.ex === i}></span>
        {/each}
      </div>
      <span class="count">{((work ?? nextWork)?.ex ?? 0) + 1}/{session.ex.length}</span>
    </header>

    {#if step.kind === 'rest'}
      <!-- ───── Rest ───── -->
      {#key `${player.index}-${restOver}`}
      <section class="body rest" class:over={restOver} aria-label="Repos">
        {#if restOver}
          <p class="pill">Repos terminé</p>
          <h1 tabindex="-1" class="ready" use:focusOnMount>C'est reparti !</h1>
        {:else}
        <p class="pill">Repos</p>
        <h1 tabindex="-1" class="sr-only" use:focusOnMount>Repos</h1>
        <CountdownRing remaining={timer.remaining} total={timer.total || step.seconds} label={paused ? 'En pause' : 'Respire'} light />
        <div class="adjust">
          <button onclick={() => app.adjustTimer(-15)} aria-label="Retirer 15 secondes">−15</button>
          <button class="pause" onclick={() => (paused ? app.resumeTimer() : app.pauseTimer())}>
            {paused ? '▶ Reprendre' : '❚❚ Pause'}
          </button>
          <button onclick={() => app.adjustTimer(15)} aria-label="Ajouter 15 secondes">+15</button>
        </div>
        {/if}
        {#if nextWork}
          <div class="next">
            <span>À suivre</span>
            <strong>{session.ex[nextWork.ex].n}</strong>
            <em>{setLabel(nextWork)} • {session.ex[nextWork.ex].r}</em>
          </div>
        {/if}
      </section>
      {/key}
      <footer class="actions">
        {#if restOver}
          <button class="btn block main light go" onclick={() => app.skipRest()}>
            {sameExercise ? 'Série suivante ›' : 'Exercice suivant ›'}
          </button>
        {/if}
      </footer>
    {:else if work && ex}
      <!-- ───── Exercise ───── -->
      {#key `${player.index}-${player.side}`}
      <section class="body">
        <p class="pill">{setLabel(work)}{work.sides === 2 ? ` • Côté ${player.side}/2` : ''}</p>
        <h1 tabindex="-1" use:focusOnMount>{ex.n}</h1>

        {#if work.duration}
          <CountdownRing
            remaining={player.phase === 'effort' ? timer.remaining : work.duration}
            total={work.duration}
            label={player.phase === 'effort' ? (paused ? 'En pause' : 'Effort') : work.sides === 2 ? `Côté ${player.side}` : 'Prête ?'}
          />
        {:else}
          <div class="reps">
            <strong>{ex.r}</strong>
            {#if isCount(ex.r)}<span>répétitions</span>{/if}
          </div>
        {/if}

        {#if hasEquipment(ex.w)}<p class="equipment">{ex.w}</p>{/if}

        <p class="tip">💡 {ex.tip}</p>

        {#if hasEquipment(ex.w)}
          <div class="load">
            <label for="load-input">Charge utilisée</label>
            <div class="load-row">
              <input
                id="load-input"
                value={load}
                placeholder={previous ? `${previous} (dernière fois)` : 'ex. 10kg'}
                maxlength="40"
                enterkeyhint="done"
                onchange={e => app.setLoad(sessionKey, work.ex, e.currentTarget.value)}
                onkeydown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              />
              {#if previous && !load}
                <button class="reuse" onclick={() => app.setLoad(sessionKey, work.ex, previous)}>Reprendre {previous}</button>
              {/if}
            </div>
          </div>
        {/if}
      </section>
      {/key}

      <footer class="actions">
        <button class="nav" onclick={() => app.previous()} disabled={workStepFrom(player.steps, player.index, -1) === null} aria-label="Série précédente">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" /></svg>
        </button>
        {#if work.duration && player.phase === 'effort'}
          <button class="btn primary main" onclick={() => (paused ? app.resumeTimer() : app.pauseTimer())}>
            {paused ? '▶ Reprendre' : '❚❚ Pause'}
          </button>
        {:else if work.duration}
          <button class="btn primary main" onclick={() => app.startEffort()}>
            ▶ {work.sides === 2 && player.side === 2 ? 'Côté 2' : 'Démarrer'}
          </button>
        {:else}
          <button class="btn primary main pulse" onclick={() => app.completeSet()}>
            Terminer
          </button>
        {/if}
        <button class="nav" onclick={() => app.skip()} aria-label="Passer cette série">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
        </button>
      </footer>
    {/if}
  </div>
{/if}

<style>
  .player {
    min-height: 100dvh; display: flex; flex-direction: column; max-width: 560px; margin: 0 auto;
    padding: calc(env(safe-area-inset-top, 0px) + 12px) var(--gutter) 0;
  }
  .player.resting {
    max-width: none;
    background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--phase-strong) 85%, #000), #0b0b0b 75%);
  }
  .resting > * { width: 100%; max-width: 528px; margin-left: auto; margin-right: auto; }

  .top { display: flex; align-items: center; gap: 12px; }
  .icon {
    width: 44px; height: 44px; border-radius: 50%; flex: none; display: grid; place-items: center;
    background: var(--surface); border: 1px solid var(--border);
  }
  .resting .icon { background: rgb(255 255 255 / 0.12); border-color: transparent; }
  svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .progress { flex: 1; display: flex; gap: 4px; }
  .progress span { flex: 1; height: 6px; border-radius: 999px; background: var(--surface-2); }
  .resting .progress span { background: rgb(255 255 255 / 0.18); }
  .progress span.done { background: var(--phase); }
  .resting .progress span.done { background: #fff; }
  .progress span.current { box-shadow: 0 0 0 2px var(--text); }
  .count { font-weight: 800; font-variant-numeric: tabular-nums; flex: none; }

  .body { animation: enter 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .rest.body { animation-name: enter-rest; }
  .reps strong { animation: pop 0.45s 0.1s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
  @keyframes enter { from { opacity: 0; transform: translateX(28px); } }
  @keyframes enter-rest { from { opacity: 0; transform: scale(0.94); } }
  @keyframes pop { from { opacity: 0; transform: scale(0.6); } }
  .body { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; padding: 28px 0 24px; }
  .pill {
    padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.02em;
    background: color-mix(in srgb, var(--phase) 18%, var(--surface)); color: var(--phase-ink);
  }
  .resting .pill { background: rgb(255 255 255 / 0.15); color: #fff; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.12em; }
  h1 { font-size: clamp(1.9rem, 8.5vw, 2.6rem); line-height: 1.1; letter-spacing: -0.02em; max-width: 18ch; }

  .reps { display: grid; justify-items: center; margin: 10px 0; }
  .reps strong { font-size: clamp(3.6rem, 22vw, 6rem); line-height: 1; font-weight: 900; letter-spacing: -0.03em; color: var(--phase-ink); }
  .reps span { color: var(--muted); font-weight: 700; }
  .equipment { padding: 6px 14px; border-radius: 999px; background: var(--surface-2); color: var(--muted); font-weight: 600; font-size: 0.92rem; }

  .load { width: 100%; text-align: left; display: grid; gap: 6px; margin-top: auto; }
  .load label { font-size: 0.8rem; font-weight: 700; color: var(--muted); }
  .load-row { display: flex; gap: 8px; }
  .load input {
    flex: 1; min-width: 0; min-height: 48px; padding: 0 14px; border-radius: var(--radius-sm); border: 1px solid var(--border);
    background: var(--surface); font-size: 1rem; font-weight: 600;
  }
  .load input:focus { border-color: var(--phase); outline: none; }
  .load input::placeholder { color: var(--faint); font-weight: 500; }
  .reuse { flex: none; padding: 0 14px; border-radius: var(--radius-sm); font-weight: 700; font-size: 0.85rem; border: 1px solid color-mix(in srgb, var(--phase) 50%, var(--border)); }
  .tip { color: var(--muted); font-size: 0.95rem; max-width: 34ch; }

  .adjust { display: flex; gap: 10px; justify-content: center; }
  .adjust button { min-height: 48px; padding: 0 18px; border-radius: 999px; font-weight: 800; background: rgb(255 255 255 / 0.14); }
  .adjust .pause { min-width: 140px; }
  .next { margin-top: 8px; display: grid; gap: 2px; padding: 14px 18px; border-radius: var(--radius); background: rgb(0 0 0 / 0.35); width: 100%; }
  .next span { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; }
  .next strong { font-size: 1.2rem; }
  .ready { font-size: clamp(2.4rem, 11vw, 3.4rem); margin-top: 4vh; animation: pop 0.5s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
  .over .next { padding: 22px 18px; margin-top: 16px; }
  .over .next strong { font-size: 1.6rem; }
  .main.go { animation: pulse 1.6s ease-in-out infinite; }
  .main.pulse { animation: pulse-phase 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { box-shadow: 0 0 0 10px rgb(255 255 255 / 0.15); } }
  @keyframes pulse-phase { 50% { box-shadow: 0 0 0 10px color-mix(in srgb, var(--phase) 25%, transparent); } }
  .next em { font-style: normal; opacity: 0.85; font-size: 0.9rem; }

  .actions {
    position: sticky; bottom: 0; display: flex; align-items: center; gap: 12px;
    padding: 12px 0 calc(16px + var(--safe-bottom));
    background: linear-gradient(transparent, var(--bg) 30%);
  }
  .resting .actions { background: none; }
  .nav {
    width: 56px; height: 56px; border-radius: 50%; flex: none; display: grid; place-items: center;
    background: var(--surface); border: 1px solid var(--border);
  }
  .main { flex: 1; min-height: 60px; font-size: 1.15rem; }
  .main.light { background: #fff; color: #111; }

  /* Short phones: tighten spacing so the next-up card clears the bottom button. */
  @media (max-height: 700px) {
    .body { gap: 10px; padding: 14px 0 12px; }
    .next { padding: 10px 14px; margin-top: 0; }
    .actions { padding-top: 8px; }
  }
</style>
