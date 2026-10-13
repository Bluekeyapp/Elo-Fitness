import { mkdirSync, copyFileSync } from 'node:fs';
const files = ['index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icon.svg',
  'js/program.js', 'js/state.js', 'js/storage.js', 'js/timer.js', 'js/ui.js', 'js/updates.js'];
mkdirSync('dist/js', { recursive: true });
for (const file of files) copyFileSync(file, `dist/${file}`);
console.log('Static GitHub Pages artifact written to dist/.');
