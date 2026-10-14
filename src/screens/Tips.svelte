<script lang="ts">
  import { app } from '../lib/app.svelte'
  import { NUTR, SHOP } from '../data/program'
  import { prefs, savePrefs, testAlert } from '../lib/alerts.svelte'

  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator
  let fileInput: HTMLInputElement | undefined = $state()

  function onFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (file) void app.importFile(file)
  }
</script>

<div class="page">
  <header class="page-head">
    <h1 tabindex="-1">Conseils</h1>
    <p>Nutrition, récupération, matériel et réglages</p>
  </header>

  <section aria-labelledby="nutr-title">
    <div class="section-title"><h2 id="nutr-title">Nutrition et récupération</h2></div>
    <div class="list">
      {#each NUTR as n}
        <div class="card item"><span class="icon" aria-hidden="true">{n.i}</span><div><h3>{n.t}</h3><p>{n.d}</p></div></div>
      {/each}
    </div>
  </section>

  <section class="section" aria-labelledby="shop-title">
    <div class="section-title"><h2 id="shop-title">Matériel recommandé</h2></div>
    <div class="list">
      {#each SHOP as s}
        <div class="card item"><span class="icon" aria-hidden="true">🛒</span><div><h3>{s.wk}</h3><p>{s.item}</p></div></div>
      {/each}
    </div>
  </section>

  <section class="section" aria-labelledby="settings-title">
    <div class="section-title"><h2 id="settings-title">Fin du repos</h2></div>
    <div class="card settings">
      <label class="toggle">
        <span>Son</span>
        <input type="checkbox" role="switch" bind:checked={prefs.sound} onchange={savePrefs} />
      </label>
      {#if canVibrate}
        <label class="toggle">
          <span>Vibration</span>
          <input type="checkbox" role="switch" bind:checked={prefs.vibrate} onchange={savePrefs} />
        </label>
      {/if}
      <button class="btn ghost" onclick={testAlert}>Tester l'alerte</button>
      <p class="hint">Sur iPhone, le son ne passe pas si le mode silencieux est activé.</p>
    </div>
  </section>

  <section class="section" aria-labelledby="backup-title">
    <div class="section-title"><h2 id="backup-title">Sauvegarde</h2></div>
    <div class="card backup">
      <p>Tes progrès sont enregistrés uniquement sur cet appareil. Exporte-les avant de changer de téléphone.</p>
      <button class="btn ghost block" onclick={() => app.exportProgress()}>Exporter ma progression</button>
      <button class="btn ghost block" onclick={() => fileInput?.click()}>Importer une sauvegarde</button>
      <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={onFile} />
      <button class="link" onclick={() => app.exportRaw()}>Exporter les données brutes (diagnostic)</button>
    </div>
  </section>

  <section class="section about" aria-labelledby="about-title">
    <div class="section-title"><h2 id="about-title">À propos</h2></div>
    <div class="card">
      <p><strong>Santé.</strong> Ce programme est fourni à titre informatif. Consulte un médecin avant de commencer, surtout en cas de douleur, blessure, grossesse ou problème de santé. Arrête un exercice s'il provoque une douleur.</p>
      <p><strong>Confidentialité.</strong> Aucune donnée n'est collectée ni envoyée : tout reste sur ton appareil.</p>
      <p class="version">Elo Fitness • version {__APP_VERSION__}</p>
    </div>
  </section>
</div>

<style>
  .list { display: grid; gap: 8px; }
  .item { display: flex; gap: 14px; align-items: flex-start; padding: 14px; }
  .icon { font-size: 1.5rem; line-height: 1.2; }
  h3 { font-size: 1rem; }
  .item p { color: var(--muted); font-size: 0.92rem; }

  .settings { display: grid; gap: 4px; }
  .toggle { display: flex; justify-content: space-between; align-items: center; min-height: 48px; font-weight: 600; }
  .toggle input {
    appearance: none; width: 52px; height: 30px; border-radius: 999px; background: var(--surface-2);
    border: 1px solid var(--border); position: relative; cursor: pointer; transition: background 0.2s;
  }
  .toggle input::after {
    content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%;
    background: var(--muted); transition: transform 0.2s, background 0.2s;
  }
  .toggle input:checked { background: var(--accent); border-color: var(--accent); }
  .toggle input:checked::after { transform: translateX(22px); background: #fff; }
  .settings .btn { justify-self: start; margin-top: 8px; }
  .hint { color: var(--faint); font-size: 0.8rem; margin-top: 8px; }

  .backup { display: grid; gap: 10px; }
  .backup p { color: var(--muted); font-size: 0.92rem; }
  .link { color: var(--muted); text-decoration: underline; font-size: 0.85rem; justify-self: start; min-height: 36px; }

  .about .card { display: grid; gap: 10px; font-size: 0.9rem; color: var(--muted); }
  .about strong { color: var(--text); }
  .version { color: var(--faint); font-size: 0.8rem; }
</style>
