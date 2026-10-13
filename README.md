# GLUTELAB

PWA française de 12 semaines, sans framework ni serveur applicatif. Le programme,
les conseils et l'identité sombre/rouge sont conservés. Les seules dépendances
d'exécution sont les API du navigateur. Police système locale pour fonctionner
sans Google Fonts et hors ligne.

## Développement local

Node.js 22 ou plus récent pour les tests et la construction. Aucune installation
npm nécessaire pour ces commandes :

```sh
npm test
npm run validate
npm run build
```

`dist/` contient uniquement le site à publier. Servir le dossier avec un serveur
HTTP statique, par exemple avec Python 3 (si installé) :

```sh
python -m http.server 8000 --directory dist
```

Ouvrir `http://localhost:8000`. Ne pas ouvrir `index.html` en `file://` : les modules
JavaScript et le service worker nécessitent HTTP local ou HTTPS. Pour vérifier le
sous-chemin GitHub Pages, servir le dossier parent puis ouvrir
`http://localhost:8000/eloisesportapp/`.

## Organisation

- `index.html`, `styles.css` : structure et présentation responsive.
- `js/program.js` : programme et conseils originaux, sans modification de contenu.
- `js/state.js` : transitions pures, validation, compteurs et historique dérivés.
- `js/storage.js` : persistance, migration et validation des imports.
- `js/timer.js` : minuteur fondé sur une échéance absolue.
- `js/ui.js` : interactions françaises et rendu ; ses tables de lecture sont
  recalculées depuis l'état canonique, jamais enregistrées séparément.
- `js/updates.js`, `sw.js` : installation, cache hors ligne et mise à jour.
- `test/` : régressions avec le lanceur intégré de Node.
- `scripts/` : validation, préparation de l'artefact et contrôle navigateur optionnel.

## Progression et sauvegarde

`gl-state-v1` est un document atomique de version `1` :

```json
{
  "version": 1,
  "week": 1,
  "sessions": {
    "w1-a": {
      "checked": [true, false, false, false, false, false],
      "completedAt": null,
      "endedAt": null
    }
  },
  "legacy": {}
}
```

Une séance est complète **uniquement si tous ses exercices sont cochés**.
La dernière coche crée automatiquement une seule entrée complète dans l'historique.
« Terminer » ne coche rien. Une séance partielle nécessite confirmation et apparaît
comme partielle, sans augmenter le total des séances terminées. Une séance vide
n'ajoute aucune entrée. Répéter la fin ne duplique ni l'entrée ni sa date.
Décocher rouvre la séance et retire sa validation et son historique de fin ; les
autres coches restent intactes. Recocher la valide à nouveau. Les semaines ne
changent jamais automatiquement : une action explicite permet d'avancer.

Migration au premier lancement : `gl-done`, `gl-sessions`, `gl-history`, `gl-week`
restent inchangées et sont aussi archivées dans `legacy`. Les coches valides sont
reprises. Les anciennes déclarations de fin et lignes d'historique contradictoires
restent archivées avec avertissement, sans inventer d'exercices réalisés. Cela peut
corriger un ancien total artificiellement élevé. Une date absente reste inconnue.
Le logiciel ne peut pas déterminer si les anciennes coches ont été créées par la
personne ou par l'ancien bouton qui cochait tout : ces coches sont conservées.

Dans **Sauvegarde et mises à jour**, exporter la progression JSON avant de changer
d'appareil. L'import valide entièrement le document et demande confirmation avant
de remplacer les progrès. Un fichier inconnu, mal formé ou de plus de 5 Mo est
refusé. Les noms affichés viennent du programme intégré ; le texte archivé importé
n'est jamais injecté dans le HTML. L'export « données originales » est un diagnostic
brut, pas un fichier directement réimportable.

Une sauvegarde courante corrompue ou de version inconnue bloque les écritures pour
préserver l'original. Exporter le diagnostic puis importer une sauvegarde valide.
Les erreurs de quota ou de permission sont visibles ; le travail reste en mémoire
et peut être exporté. Le bouton de mise à jour ne recharge pas si des changements
ne sont pas sauvegardés. Un onglet ayant une ancienne copie ne peut pas écraser une
modification déjà enregistrée par un autre onglet : exporter puis recharger.
Il n'y a pas de synchronisation entre appareils ; éviter les modifications
simultanées dans plusieurs onglets (localStorage n'offre pas de transaction entre
son contrôle de version et son écriture).

## Hors ligne, minuteur et mises à jour

Le minuteur utilise `Date.now()` et une échéance, jamais un compteur décrémenté.
Le retour au premier plan, `pageshow` et la reprise du focus réconcilient l'affichage.
« Repos terminé » reste visible jusqu'à fermeture ; la vibration est facultative.
La fin d'une séance et l'annulation arrêtent le minuteur. Une fermeture complète ou
un rechargement de l'application réinitialise le minuteur, mais pas les exercices.

Après une installation en ligne réussie, le shell est disponible hors ligne.
Les navigations demandent du HTML frais au réseau (délai de 4 secondes), puis
utilisent le document en cache si le réseau échoue. Le fallback HTML ne s'applique
jamais aux ressources. Seules les ressources connues, réussies et non redirigées
sont mises en cache. Les assets versionnés sont immuables pour une release.
Du HTML plus récent peut être servi en ligne sans remplacer le shell hors ligne
cohérent de la release précédente, tant que son worker n'est pas installé.

Les caches portent le préfixe GLUTELAB et le scope de l'installation. L'activation
supprime uniquement les anciennes versions de ce scope et les deux anciens caches
historiques `glutelab-v1/v2`. Les autres caches de l'origine sont conservés.

Pour chaque changement de shell, incrémenter `RELEASE` dans `sw.js` **et tous les
`?v=`** dans HTML, modules et liste d'assets du worker. La validation vérifie ces
références. Le worker est revalidé à l'ouverture et au retour au premier plan.
Une mise à jour prête ouvre le panneau proposant **Mettre à jour et recharger**.
Elle conserve localStorage. Exception de transition : les anciennes pages v1/v2
n'ont pas de bouton de mise à jour ; leur nouveau worker s'active après installation,
et la prochaine navigation/recharge charge l'interface récente.

## Vérification navigateur optionnelle

Installer Playwright dans l'environnement de test, sans l'ajouter au site livré :

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node scripts/browser-check.mjs
```

`PLAYWRIGHT_MODULE` peut désigner une installation externe et `BROWSER_CHANNEL`
peut valoir `msedge`. Le script lance un profil temporaire et un serveur local au
sous-chemin `/eloisesportapp/`. Il vérifie le clavier/focus, migration,
fin/annulation/rechargement, séances partielles, objectifs, import refusé/annulé,
texte malveillant archivé, fin du programme, navigation manuelle, un vrai changement
de service worker et un rechargement hors ligne. Captures dans `test-results/`.

Compléter sur appareils physiques : Safari/iOS et Chrome/Android installés en PWA,
verrouillage prolongé, vibration et absence de vibration, lecture VoiceOver/TalkBack,
zoom texte et stockage privé/quota. Les tests simulés ne remplacent pas ces contrôles.

## GitHub Pages

Tous les chemins restent relatifs. Configurer Pages avec la source GitHub Actions.
Le workflow exécute `npm run build` (syntaxe, références, manifeste, tests) avant de
transmettre `dist/` au job de déploiement. Les pull requests valident seulement ;
un push sur `main` ou une exécution manuelle publie l'artefact validé. Aucun secret
applicatif ni backend n'est requis. Ne pas publier les fichiers de diagnostic ou
les sauvegardes utilisateurs.
