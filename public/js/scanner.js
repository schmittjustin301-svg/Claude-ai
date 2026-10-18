// Barcode-/QR-Scanner. Bibliothek liegt lokal (vendor/) und wird erst beim Scannen geladen.
// Bekannte Produkte werden offline erkannt; neue werden aus Open Food Facts vorausgefüllt.
// An Open Food Facts geht nur die Barcode-Nummer – keine persönlichen Daten.
import { app, A, openSheet, closeSheet, toast } from './core.js';
import { $, esc, icon } from './ui.js';
import { num, r0, r1 } from './logic.js';
import { foodEditSheet, showPickerWithFood, currentPick } from './views/nutrition.js';

let scanner = null;
let busy = false;

function scanSheet() {
  return `<h2>Barcode scannen</h2>
    <div id="reader" class="reader" style="width:100%;min-height:240px;border-radius:14px;overflow:hidden;background:#000"></div>
    <p id="scanMsg" class="muted small center" style="margin:10px 0 12px">Kamera wird gestartet …</p>
    <div class="row mb"><input id="manualCode" class="grow" inputmode="numeric" placeholder="oder Barcode-Nummer eintippen" autocomplete="off"><button type="button" class="btn" data-a="scanManual">OK</button></div>
    <button type="button" class="btn ghost block" data-a="scanCancel">Abbrechen</button>`;
}
scanSheet.keepAlive = true; // Kamerabild nicht durch Neuzeichnen zerstören

export function startScan() {
  openSheet(scanSheet, { onClose: stopScanner });
  run();
}
async function loadLib() {
  if (window.__Html5QrcodeLibrary__) return window.__Html5QrcodeLibrary__;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/vendor/html5-qrcode.min.js';
    s.onload = res;
    s.onerror = () => rej(new Error('Scanner konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
  return window.__Html5QrcodeLibrary__;
}
async function run() {
  const msg = (t) => { const m = $('#scanMsg'); if (m) m.innerHTML = t; };
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera wird hier nicht unterstützt');
    const lib = await loadLib();
    if (app.ui.sheet !== scanSheet || !$('#reader')) return;
    const F = lib.Html5QrcodeSupportedFormats;
    const sc = new lib.Html5Qrcode('reader', { verbose: false, formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.QR_CODE, F.CODE_128], useBarCodeDetectorIfSupported: true });
    scanner = sc;
    await sc.start({ facingMode: 'environment' }, { fps: 12, qrbox: (w, h) => ({ width: Math.max(50, Math.floor(w * 0.85)), height: Math.max(50, Math.floor(Math.min(w * 0.55, h * 0.8))) }) }, (text) => onScan(text), () => {});
    if (scanner !== sc) { try { await sc.stop(); sc.clear(); } catch { /* schon weg */ } return; }
    msg('Barcode in den Rahmen halten');
  } catch (e) {
    scanner = null;
    const denied = /permission|notallowed/i.test(String(e && (e.name || e.message || e)));
    msg(denied ? 'Kein Kamerazugriff. iPhone: Einstellungen → Safari → Kamera → „Erlauben“. Oder Nummer unten eintippen.' : `Kamera nicht verfügbar (${esc(e?.message || e)}). Nummer unten eintippen.`);
  }
}
async function stopScanner() {
  const sc = scanner;
  scanner = null;
  if (!sc) return;
  try { if (sc.isScanning) await sc.stop(); sc.clear(); } catch { /* egal */ }
}
async function onScan(text) {
  if (busy) return;
  busy = true;
  if (navigator.vibrate) navigator.vibrate(60);
  await stopScanner();
  try { await handleCode(text); } finally { busy = false; }
}
/** EAN/UPC direkt oder GS1-Digital-Link-QR (…/01/<GTIN>…). */
export function extractCode(text) {
  const t = String(text).trim();
  if (/^\d{8,14}$/.test(t)) return t;
  const m = t.match(/\/01\/(\d{14})(?:\/|\?|$)/);
  return m ? m[1] : null;
}
const sameCode = (a, b) => a.replace(/^0+/, '') === b.replace(/^0+/, '');

async function handleCode(text) {
  const code = extractCode(text);
  if (!code) {
    openSheet(() => `<h2>Kein Produkt-Barcode</h2><div class="card elev small" style="word-break:break-all">${esc(text)}</div><p class="muted small">Dazu gibt es keine Nährwerte.</p><button type="button" class="btn primary block" data-a="scan">Nochmal scannen</button>`);
    return;
  }
  const local = app.S.foods.find((f) => f.barcode && sameCode(f.barcode, code));
  if (local) {
    local.used = Date.now();
    if (currentPick()) showPickerWithFood(local.id); else openSheet(foodEditSheet(local.id));
    toast(`Erkannt: ${local.name}`);
    return;
  }
  const loading = () => `<h2>Suche Produkt …</h2><p class="muted small">Barcode ${esc(code)}</p>`;
  openSheet(loading);
  let prod = null, failed = false;
  try { prod = await lookup(code); } catch { failed = true; }
  if (app.ui.sheet !== loading) return;
  const note = prod ? 'Gefunden in Open Food Facts. Werte kurz mit der Packung vergleichen und speichern – beim nächsten Scan geht es sofort, auch offline.'
    : failed ? 'Datenbank nicht erreichbar (offline?). Werte von der Packung eintragen – der Barcode wird gespeichert.'
      : 'Produkt nicht in der Datenbank. Werte von der Packung eintragen – der Barcode wird gespeichert.';
  openSheet(foodEditSheet(null, { barcode: code, ...prod }, note));
}
async function lookup(code) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_de,brands,nutriments,serving_quantity`, { signal: ctrl.signal });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.status !== 1 || !j.product) return null;
    const p = j.product, n = p.nutriments || {};
    const val = (k) => (n[k] != null && n[k] !== '' && Number.isFinite(+n[k]) ? +n[k] : null);
    let kcal = val('energy-kcal_100g');
    if (kcal == null && val('energy_100g') != null) kcal = val('energy_100g') / 4.184;
    const brand = p.brands ? String(p.brands).split(',')[0].trim() : '';
    const base = (p.product_name_de || p.product_name || '').trim();
    const name = base ? (brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${base} (${brand})` : base) : `Produkt ${code}`;
    const serving = num(p.serving_quantity);
    const opt = (k) => (val(k) != null ? r1(val(k)) : null);
    return { src: 'Open Food Facts', fiber: opt('fiber_100g'), sugar: opt('sugars_100g'), satFat: opt('saturated-fat_100g'), salt: val('salt_100g') != null ? Math.round(val('salt_100g') * 100) / 100 : null,
      name, kcal: kcal != null ? r0(kcal) : '', p: val('proteins_100g') != null ? r1(val('proteins_100g')) : '', c: val('carbohydrates_100g') != null ? r1(val('carbohydrates_100g')) : '', f: val('fat_100g') != null ? r1(val('fat_100g')) : '', portion: serving > 0 && serving < 2000 ? r0(serving) : 100 };
  } finally { clearTimeout(timer); }
}

A.scanManual = () => {
  const v = ($('#manualCode').value || '').replace(/\D/g, '');
  if (v.length < 8) return toast('Ein Barcode hat 8–14 Ziffern', true);
  stopScanner();
  handleCode(v);
};
A.scanCancel = () => { if (currentPick()) A.pickBack(); else closeSheet(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'manualCode') A.scanManual(); });
export { icon };
