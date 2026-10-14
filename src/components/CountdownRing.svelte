<script lang="ts">
  let { remaining, total, label = '', light = false }: { remaining: number; total: number; label?: string; light?: boolean } = $props()

  const R = 88, C = 2 * Math.PI * R
  const fraction = $derived(total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0)
  const clock = $derived(`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`)
</script>

<div class="ring" class:light role="timer" aria-label="{remaining} secondes restantes">
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <circle class="track" cx="100" cy="100" r={R} />
    <circle class="arc" cx="100" cy="100" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - fraction)} />
  </svg>
  <div class="center">
    <span class="clock">{clock}</span>
    {#if label}<span class="label">{label}</span>{/if}
  </div>
</div>

<style>
  .ring { position: relative; width: min(72vw, 300px, 36dvh); aspect-ratio: 1; margin: 0 auto; }
  svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  circle { fill: none; stroke-width: 10; }
  .track { stroke: var(--surface-2); }
  .arc { stroke: var(--phase); stroke-linecap: round; transition: stroke-dashoffset 0.25s linear; }
  .light .track { stroke: rgb(255 255 255 / 0.18); }
  .light .arc { stroke: #fff; }
  .center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
  .clock { font-size: clamp(2.6rem, min(17vw, 8dvh), 4.6rem); font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; letter-spacing: -0.02em; }
  .label { margin-top: 6px; font-size: 0.95rem; font-weight: 700; opacity: 0.85; }
</style>
