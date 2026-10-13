export async function registerUpdates(button, status, canReload = () => true) {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  let reloadRequested = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) location.reload();
  });
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    function offer() {
      if (!registration.waiting) return;
      button.hidden = false;
      button.closest('details')?.setAttribute('open', '');
      status.textContent = 'Une mise à jour est prête. La progression enregistrée sera conservée.';
    }
    button.addEventListener('click', () => {
      if (!registration.waiting || !canReload()) return;
      reloadRequested = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', offer);
    });
    offer();
    const check = () => registration.update().catch(() => {
      status.textContent = 'Vérification des mises à jour indisponible. Réessayez avec une connexion.';
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    await check();
  } catch {
    status.textContent = 'Mode hors ligne indisponible : chargement du service worker impossible.';
  }
}
