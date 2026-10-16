// Projekt-Checks: Offline-Cache vollständig, Module syntaktisch ladbar, keine Fremd-Requests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PUB = new URL('../public/', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(PUB).map((p) => '/' + relative(PUB, p));

test('Service Worker cached jede App-Datei', () => {
  const sw = readFileSync(join(PUB, 'sw.js'), 'utf8');
  const assets = [...sw.matchAll(/^\s+'(\/[^']*)',$/gm)].map((m) => m[1]);
  const needed = files.filter((f) => !/\.txt$|^\/sw\.js$/.test(f));
  for (const f of needed) assert.ok(assets.includes(f), `${f} fehlt in ASSETS (sw.js)`);
  for (const a of assets) if (a !== '/') assert.ok(files.includes(a), `${a} in ASSETS existiert nicht`);
});

test('Alle Module importieren nur vorhandene Dateien', () => {
  for (const f of files.filter((x) => x.startsWith('/js/'))) {
    const src = readFileSync(join(PUB, f), 'utf8');
    for (const m of src.matchAll(/from '(\.[^']+)'|import '(\.[^']+)'/g)) {
      const target = new URL(m[1] || m[2], 'file://' + join(PUB, f)).pathname;
      assert.ok(files.includes('/' + relative(PUB, target)), `${f} importiert fehlende Datei ${m[1] || m[2]}`);
    }
  }
});

test('Keine externen Skripte, Schriften oder Tracker', () => {
  const html = readFileSync(join(PUB, 'index.html'), 'utf8');
  assert.ok(!/(src|href)="https?:/.test(html), 'index.html lädt externe Ressourcen');
  const css = readFileSync(join(PUB, 'css/ironcore.css'), 'utf8');
  assert.ok(!/url\(['"]?https?:/.test(css), 'CSS lädt externe Ressourcen');
  for (const f of files.filter((x) => x.startsWith('/js/'))) {
    const src = readFileSync(join(PUB, f), 'utf8');
    const urls = [...src.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]);
    for (const u of urls) assert.ok(u.startsWith('https://world.openfoodfacts.org/'), `${f}: unerwartete externe Adresse ${u}`);
  }
});
