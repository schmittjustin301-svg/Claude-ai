// Coach: Maskottchen-Dateien, Tour-Ziele und Texte prüfen (ohne Browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MASCOT_FILES, mascotFile, mascot } from '../public/js/mascot.js';
import { TOUR, pageHelp, tipsFor, ALL_TIPS } from '../public/js/tour.js';

const PUB = new URL('../public/', import.meta.url).pathname;
const src = () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(join(d, f.name)) : f.name.endsWith('.js') ? [join(d, f.name)] : []));
  return walk(join(PUB, 'js')).map((f) => readFileSync(f, 'utf8')).join('\n') + readFileSync(join(PUB, 'index.html'), 'utf8');
};
// Breite/Höhe aus dem WebP-Kopf (VP8 verlustbehaftet)
function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 12, 16), 'VP8 ', `${file}: unerwartetes WebP-Format`);
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
}

test('Jedes Maskottchen-Motiv existiert mit der hinterlegten Größe', () => {
  for (const [id, m] of Object.entries(MASCOT_FILES)) {
    const f = join(PUB, 'images/mascot', id + '.webp');
    assert.ok(existsSync(f), `${id}.webp fehlt`);
    assert.deepEqual(webpSize(f), { w: m.w, h: m.h }, `${id}: Größe stimmt nicht`);
  }
  const files = readdirSync(join(PUB, 'images/mascot'));
  assert.equal(files.length, Object.keys(MASCOT_FILES).length, 'nicht zugeordnete Bilddateien');
});

test('Konzeptbild liegt nicht in der App', () => {
  const all = (d) => readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? all(join(d, f.name)) : [f.name]));
  assert.ok(!all(PUB).some((f) => /sheet|concept/i.test(f)));
  assert.ok(!/mascot-sheet/.test(src()));
});

test('Alle benötigten Ausdrücke vorhanden, unbekannte fallen auf ein vorhandenes Motiv zurück', () => {
  for (const s of ['neutral', 'welcome', 'explaining', 'motivated', 'focused', 'thinking', 'celebrating', 'supportive']) assert.equal(mascotFile(s).id, s);
  assert.equal(mascotFile('explain').id, 'explaining');
  assert.equal(mascotFile('gibt-es-nicht').id, 'neutral');
  assert.match(mascot('water', { size: 'sm' }), /src="\/images\/mascot\/water\.webp".*alt="IRONCORE-Löwe/);
});

test('Tour und Tipps zeigen nur auf vorhandene Elemente', () => {
  const code = src();
  for (const s of [...TOUR, ...ALL_TIPS]) {
    if (s.target) assert.ok(code.includes(`data-tour="${s.target}"`), `Ziel ${s.target} existiert nicht`);
    assert.ok(MASCOT_FILES[s.mascot], `Motiv ${s.mascot} fehlt`);
    assert.ok(s.title && s.text && s.text.length < 320, `Text zu ${s.title}`);
  }
  assert.equal(new Set(TOUR.map((s) => s.id)).size, TOUR.length);
  assert.equal(TOUR.at(-1).id, 'done');
});

test('Seitenhilfe und Tipps je Ansicht', () => {
  assert.equal(pageHelp('food', { tab: 'shop' }).step, 'shopping');
  assert.equal(pageHelp('food', {}).step, 'nutrition');
  assert.equal(pageHelp('session').step, null);
  assert.ok(pageHelp('unbekannt').text);
  assert.deepEqual(tipsFor('food', { tab: 'shop' }).map((t) => t.target), ['gen-list']);
  assert.deepEqual(tipsFor('session'), []);
});

test('Keine Dosierungsempfehlung in Coach-Texten', () => {
  const texts = [...TOUR, ...ALL_TIPS].map((s) => s.text).join(' ') + readFileSync(join(PUB, 'js/coach.js'), 'utf8');
  assert.ok(!/\d+\s?(mg|g|IE|µg)\s+(täglich|pro Tag)/i.test(texts));
  assert.ok(!/(solltest|musst) .*(nehmen|einnehmen)/i.test(texts));
});
