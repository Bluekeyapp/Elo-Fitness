# Elo Fitness

Programme de musculation de 12 semaines, en français, sous forme d'appli web installable (PWA).
Gratuite, sans compte : la progression reste sur l'appareil (export/import possible).

En ligne : https://bluekeyapp.github.io/eloisesportapp/

## Développement

```bash
npm install
npm run dev        # serveur local
npm run check      # vérification des types
npm test           # tests unitaires (Vitest)
npm run e2e        # tests de parcours et d'accessibilité (Playwright)
npm run build      # version de production dans dist/
```

Chaque push sur `main` reconstruit et publie l'appli sur GitHub Pages
(`.github/workflows/static.yml`).

## Notes

- Stack : Vite, Svelte 5, TypeScript, vite-plugin-pwa.
- Données : `localStorage` (`es-state-v2` ; le préfixe `es-` vient de l'ancien nom Eloise Sport et ne doit pas changer, sinon la progression serait perdue). La progression de l'ancienne version GLUTELAB
  (`gl-state-v1` et clés `gl-*`) est reprise automatiquement, sans être modifiée.
- L'ancienne version est conservée sous l'étiquette git `glutelab-final`.
- Décisions et checklists : voir `PLAN.md`.
