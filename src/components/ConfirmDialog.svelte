<script lang="ts">
  import { app } from '../lib/app.svelte'

  let dialog: HTMLDialogElement | undefined = $state()
  const c = $derived(app.confirmation)

  $effect(() => {
    if (!dialog) return
    if (c && !dialog.open) dialog.showModal()
    else if (!c && dialog.open) dialog.close()
  })
</script>

<dialog bind:this={dialog} oncancel={() => c?.resolve(false)} aria-labelledby="confirm-text">
  {#if c}
    <p id="confirm-text">{c.message}</p>
    <div class="actions">
      <button class="btn ghost" onclick={() => c.resolve(false)}>Annuler</button>
      <button class="btn primary" onclick={() => c.resolve(true)}>{c.confirmLabel}</button>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(420px, calc(100% - 2 * var(--gutter))); padding: 20px; border-radius: var(--radius);
    background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
  }
  dialog::backdrop { background: rgb(0 0 0 / 0.7); }
  p { line-height: 1.5; }
  .actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; flex-wrap: wrap; }
  .actions .btn { flex: 1 1 auto; }
</style>
