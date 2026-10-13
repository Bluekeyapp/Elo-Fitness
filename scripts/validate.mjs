import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['sw.js', ...readdirSync('js').filter(f => f.endsWith('.js')).map(f => `js/${f}`)]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
const sw = readFileSync('sw.js', 'utf8'), html = readFileSync('index.html', 'utf8');
const release = sw.match(/const RELEASE = '([^']+)'/)[1];
for (const file of ['index.html', ...readdirSync('js').map(f => `js/${f}`)]) {
  for (const [, ref] of readFileSync(file, 'utf8').matchAll(/(?:src=|href=|from )['"](\.\/[^'"]+)['"]/g)) {
    const path = file.includes('/') ? `js/${ref.slice(2).split('?')[0]}` : ref.slice(2).split('?')[0];
    assert.ok(existsSync(path), `${file}: missing ${path}`);
    if (/\.(js|css)(\?|$)/.test(ref)) assert.equal(ref.split('?v=')[1], release, `Version mismatch: ${ref}`);
  }
}
for (const [, asset] of sw.matchAll(/'(\.\/[^']+)'/g)) {
  if (!asset.includes('?') && !/\.(html|svg|webmanifest)$/.test(asset)) continue;
  assert.ok(existsSync(asset.split('?')[0]), `Missing shell asset ${asset}`);
  if (asset.includes('?v=')) assert.equal(asset.split('?v=')[1], release, `Worker version mismatch: ${asset}`);
}
assert.match(html, /<html lang="fr">/);
JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
execFileSync(process.execPath, ['--test'], { stdio: 'inherit' });
console.log('Syntax, assets, release versions, manifest and regression tests validated.');
