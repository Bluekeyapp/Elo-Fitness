<script lang="ts">
  import { app } from '../lib/app.svelte'
  import { catalog, sessionProgress } from '../lib/state'
  import { buildSteps, estimateMinutes, groups, resumeStep, timing } from '../lib/flow'

  let { sessionKey }: { sessionKey: string } = $props()

  const session = $derived(catalog[sessionKey])
  const record = $derived(app.state.sessions[sessionKey])
  const p = $derived(sessionProgress(app.state, sessionKey))
  const steps = $derived(buildSteps(session.ex))
  const minutes = $derived(estimateMinutes(steps))
  const blocks = $derived(groups(session.ex))
  const resumeAt = $derived.by(() => {
    const s = steps[resumeStep(steps, record?.checked ?? [])]
    return s.kind === 'work' ? s.ex : 0
  })
</script>

<div class="page intro">
  <header class="head">
    <button class="back" onclick={() => app.go({ name: 'home' })} aria-label="Retour aux séances">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" /></svg>
    </button>
    <p class="kicker">Semaine {session.week} • {session.day}</p>
  </header>

  <div class="hero">
    <h1 tabindex="-1">{session.title}</h1>
    <p class="facts">
      <span>{session.ex.length} exercices</span>
      <span aria-hidden="true">•</span>
      <span>≈ {minutes} min</span>
    </p>
    {#if p.count}
      <div class="bar" role="progressbar" aria-label="Exercices faits" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.count}>
        <span style:width="{p.pct}%"></span>
      </div>
    {/if}
  </div>

  <details class="warm">
    <summary><span aria-hidden="true">🔥</span> Échauffement • 5 min</summary>
    <p>{session.warm}</p>
  </details>

  <ol class="blocks">
    {#each blocks as block, b}
      <li class:circuit={block.length > 1} style:--i={b}>
        {#if block.length > 1}
          <p class="circuit-label">{block.length === 2 ? 'Enchaînés' : 'Circuit'} • {session.ex[block[0]].s} tours</p>
        {/if}
        <ul class="list">
          {#each block as i}
            {@const ex = session.ex[i]}
            {@const checked = !!record?.checked[i]}
            <li class="ex" class:checked>
              <button class="check" aria-pressed={checked} aria-label="{checked ? 'Décocher' : 'Cocher'} {ex.n}" onclick={() => app.toggle(sessionKey, i)}>
                {#if checked}
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                {:else}
                  <span aria-hidden="true">{i + 1}</span>
                {/if}
              </button>
              <button class="go" onclick={() => app.play(sessionKey, i)} aria-label="Commencer par {ex.n}">
                <span class="name">{block.length > 1 ? ex.n.replace(/^Circuit\s*:\s*/i, '') : ex.n}</span>
                <span class="dose">{block.length > 1 || ex.s === 1 ? '' : `${ex.s} × `}{ex.r}{timing(ex).duration ? ' ⏱' : ''}</span>
              </button>
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ol>

  <div class="cta">
    <button class="btn primary block start" onclick={() => app.play(sessionKey)}>
      {#if p.complete}↻ Refaire la séance{:else if p.count}▶ Reprendre • exercice {resumeAt + 1}{:else}▶ Commencer{/if}
    </button>
    {#if p.count > 0 && !p.complete}
      <button class="finish" onclick={() => app.finish(sessionKey)}>Terminer la séance maintenant</button>
    {/if}
  </div>
</div>

<style>
  .intro { padding-bottom: 0; display: flex; flex-direction: column; min-height: 100dvh; }
  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .back {
    width: 44px; height: 44px; border-radius: 50%; flex: none; display: grid; place-items: center;
    background: var(--surface); border: 1px solid var(--border);
  }
  .back svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .kicker { color: var(--muted); font-size: 0.9rem; font-weight: 700; }

  .hero { animation: rise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  h1 { font-size: clamp(2.1rem, 9vw, 2.8rem); line-height: 1.05; letter-spacing: -0.03em; }
  .facts { display: flex; gap: 8px; color: var(--muted); font-weight: 600; margin-top: 8px; }
  .bar { margin-top: 14px; }
  .bar span { transition: width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1); }

  .warm {
    margin: 20px 0 22px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border);
    animation: rise 0.45s 0.06s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .warm summary { cursor: pointer; padding: 12px 14px; font-weight: 700; min-height: 44px; display: flex; align-items: center; gap: 8px; }
  .warm summary::after { content: '+'; margin-left: auto; color: var(--muted); font-size: 1.2rem; transition: transform 0.2s; }
  .warm[open] summary::after { transform: rotate(45deg); }
  .warm p { padding: 0 14px 14px; color: var(--muted); font-size: 0.92rem; }

  .blocks, .list { list-style: none; margin: 0; padding: 0; display: grid; }
  .blocks { gap: 10px; }
  .blocks > li { animation: rise 0.45s calc(0.1s + var(--i) * 0.06s) cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .list { gap: 10px; }
  .circuit { border-left: 3px solid var(--phase); padding-left: 10px; }
  .circuit .list { gap: 6px; }
  .circuit-label { font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--phase-ink); margin: 0 0 8px 2px; }

  .ex {
    display: flex; align-items: center; gap: 12px; padding: 8px 14px 8px 8px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    transition: border-color 0.2s, transform 0.15s;
  }
  .ex:active { transform: scale(0.98); }
  .check {
    width: 40px; height: 40px; border-radius: 50%; flex: none; display: grid; place-items: center;
    background: var(--surface-2); font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums;
    transition: background 0.25s;
  }
  .check svg { width: 20px; height: 20px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; animation: pop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1); }
  .checked .check { background: var(--phase-strong); }
  .go { flex: 1; min-width: 0; min-height: 48px; display: flex; align-items: center; gap: 12px; text-align: left; }
  .name { flex: 1; font-weight: 700; font-size: 1.02rem; }
  .checked .name { color: var(--muted); text-decoration: line-through; text-decoration-color: var(--faint); }
  .dose { flex: none; font-weight: 800; color: var(--phase-ink); font-variant-numeric: tabular-nums; font-size: 0.95rem; }
  .checked .dose { color: var(--muted); }

  .cta {
    position: sticky; bottom: 0; margin-top: auto; padding: 24px 0 calc(16px + var(--safe-bottom));
    background: linear-gradient(transparent, var(--bg) 35%); display: grid; gap: 4px;
  }
  .start {
    min-height: 60px; font-size: 1.15rem; position: relative; overflow: hidden;
    box-shadow: 0 10px 30px -10px var(--phase);
    animation: rise 0.45s 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .start::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 0.25) 50%, transparent 70%);
    animation: shine 3.2s 1s ease-in-out infinite;
  }
  .finish { min-height: 44px; color: var(--muted); font-weight: 700; text-decoration: underline; }

  @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
  @keyframes pop { from { transform: scale(0.3); } }
  @keyframes shine { 0%, 60% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
</style>
