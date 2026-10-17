// Erinnerungen: Systembenachrichtigung + Hinweis in der App, solange IRONCORE geöffnet ist.
// Grenze der Plattform: Web-Apps (auch auf dem Home-Bildschirm) können ohne Push-Server keine Benachrichtigungen
// zu einer festen Uhrzeit planen, wenn sie geschlossen sind. Für zuverlässige Hintergrund-Erinnerungen gibt es den
// Kalender-Export (.ics) – dann übernimmt der Kalender des Handys den Alarm.
import { app, A, C, registerView, commit, save, toast } from './core.js';
import { dkey, addDays } from './logic.js';
import { esc, icon, fmtClock } from './ui.js';
import { timeline, buildICS } from './schedule.js';

export const supported = () => typeof window !== 'undefined' && 'Notification' in window;
export const permission = () => (supported() ? Notification.permission : 'unsupported');
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Fällige Termine einmalig melden. Schlüssel = Termin + Fälligkeitszeit → kein Doppel-Alarm, Schlummern meldet neu. */
export function checkReminders(now = Date.now()) {
  const S = app.S;
  if (!S.notify.enabled) return [];
  const date = dkey(new Date(now)), lead = (S.notify.lead || 0) * 60000;
  const sent = (S.notified[date] = S.notified[date] || {});
  const fired = [];
  for (const e of timeline(S, date, now)) {
    if (!['due', 'upcoming', 'snoozed'].includes(e.status)) continue;
    if (e.kind === 'supp') { if (!S.notify.supps) continue; const sc = S.supps.find((x) => x.id === e.id)?.schedule.find((x) => x.id === e.schedId); if (sc && sc.remind === false) continue; }
    if (e.kind === 'meal' && !S.notify.meals) continue;
    if (e.status === 'snoozed' && e.due > now) continue;
    if (e.due - lead > now) continue; // noch nicht dran
    if (now - e.due > 2 * 3600e3) continue; // länger als 2 h her: nur in der App anzeigen, nicht nachträglich alarmieren
    const k = `${e.key}@${e.due}`;
    if (sent[k]) continue;
    sent[k] = now;
    fired.push(e);
  }
  for (const d of Object.keys(S.notified)) if (d < addDays(date, -3)) delete S.notified[d];
  if (fired.length) { save(); fired.forEach((e) => show(e, date)); }
  return fired;
}
async function show(e, date) {
  const title = e.kind === 'supp' ? `Supplement: ${e.title}` : `Mahlzeit: ${e.title}`;
  const body = e.kind === 'supp' ? `${e.time}${e.amount != null ? ` · ${String(e.amount).replace('.', ',')} ${e.unit}` : ''} – dein geplanter Termin` : `${e.time} – geplante Mahlzeit`;
  if (document.visibilityState === 'visible') toast(`${title} · ${e.time}`);
  if (permission() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, tag: `${date}|${e.key}`, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/?v=day' }, renotify: false };
    if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
  } catch { /* Benachrichtigung nicht möglich – Hinweis in der App reicht */ }
}
export function startReminderLoop() {
  setInterval(() => checkReminders(), 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
  setTimeout(() => checkReminders(), 1500);
}

// ---------- Einstellungen ----------
function view() {
  const N = app.S.notify, perm = permission();
  const platform = !supported() ? 'Dieser Browser unterstützt keine Benachrichtigungen.'
    : isIOS() && !isStandalone() ? 'Auf dem iPhone funktionieren Benachrichtigungen nur, wenn IRONCORE über „Zum Home-Bildschirm“ installiert ist (iOS 16.4+).'
      : perm === 'denied' ? 'Benachrichtigungen sind in den System-Einstellungen blockiert. Dort für IRONCORE erlauben.' : '';
  return `<div class="topbar"><button type="button" class="back" data-a="back">${icon('left', 'sm')} Zurück</button></div>
  <h1 class="mb">Erinnerungen</h1>
  <div class="card">
    <label class="check"><input type="checkbox" data-c="notifyOn" ${N.enabled ? 'checked' : ''}> <b>Erinnerungen aktiv</b></label>
    <div class="muted small" style="margin-top:8px">Status: ${perm === 'granted' ? '<span class="gold">Systembenachrichtigungen erlaubt</span>' : perm === 'denied' ? 'blockiert' : perm === 'unsupported' ? 'nicht unterstützt' : 'noch nicht erlaubt – wird beim Einschalten abgefragt'}</div>
    ${platform ? `<div class="faint tiny" style="margin-top:6px">${platform}</div>` : ''}
    <hr class="divider">
    <label class="check"><input type="checkbox" data-c="notifyPref" data-f="supps" ${N.supps ? 'checked' : ''}> Supplements</label>
    <label class="check mt"><input type="checkbox" data-c="notifyPref" data-f="meals" ${N.meals ? 'checked' : ''}> Mahlzeiten</label>
    <label class="field mt"><span>Vorlauf</span><select data-c="notifyLead">${[0, 5, 10, 15, 30].map((m) => `<option value="${m}" ${N.lead === m ? 'selected' : ''}>${m ? `${m} Minuten vorher` : 'Zur geplanten Zeit'}</option>`).join('')}</select></label>
    ${N.enabled && perm === 'granted' ? `<button type="button" class="btn sm" data-a="testNotify">${icon('bolt', 'sm')} Test-Benachrichtigung</button>` : ''}
  </div>
  <div class="card" style="border-color:var(--gold-edge)">
    <div class="card-h"><span class="t">${icon('lock')} Wichtig: Grenzen</span></div>
    <p class="small muted" style="margin:0 0 8px">Solange IRONCORE geöffnet ist (oder gerade im Hintergrund), meldet die App fällige Termine. <b>Ist die App geschlossen, kann eine Web-App keine Erinnerung zu einer festen Uhrzeit auslösen</b> – dafür bräuchte es einen Push-Server, den IRONCORE bewusst nicht hat. Beim nächsten Öffnen siehst du sofort, was fällig ist.</p>
    <p class="small muted" style="margin:0">Für Erinnerungen, die immer kommen: <b>Kalender-Export</b>. Dein Plan wird als wiederkehrende Termine mit Alarm in den Kalender des Handys übernommen.</p>
  </div>
  <div class="card">
    <div class="card-h"><span class="t">${icon('calendar')} Kalender-Export (.ics)</span></div>
    <label class="check"><input type="checkbox" id="icsSupps" checked> Supplement-Zeiten</label>
    <label class="check mt"><input type="checkbox" id="icsMeals"> Mahlzeiten</label>
    <button type="button" class="btn primary block mt" data-a="exportICS">${icon('download', 'sm')} Kalender-Datei erstellen</button>
    <p class="faint tiny">iPhone: Datei öffnen → „Alle hinzufügen“. Nach Änderungen am Plan die alten IRONCORE-Termine im Kalender löschen und neu importieren, sonst gibt es doppelte Termine.</p>
  </div>
  <p class="faint tiny center">Erinnerungen geben deinen eigenen Plan wieder – keine medizinische Empfehlung.</p>`;
}
registerView('reminders', view, 'home');
C.notifyOn = async (el) => {
  if (el.checked && supported() && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { /* ignoriert */ }
  }
  app.S.notify.enabled = el.checked;
  // Termine, die schon vorbei sind, nicht nachträglich alle auf einmal melden
  if (el.checked) { const d = dkey(); const sent = (app.S.notified[d] = app.S.notified[d] || {}); for (const e of timeline(app.S, d)) if (e.due < Date.now() - 60000) sent[`${e.key}@${e.due}`] = Date.now(); }
  commit();
};
C.notifyPref = (el) => { app.S.notify[el.dataset.f] = el.checked; commit(); };
C.notifyLead = (el) => { app.S.notify.lead = Number(el.value); commit(); };
A.testNotify = () => show({ kind: 'supp', title: 'Test', time: fmtClock(Date.now()), amount: null, key: 'test' + Date.now() }, dkey());
A.exportICS = async () => {
  const ics = buildICS(app.S, { supps: document.querySelector('#icsSupps').checked, meals: document.querySelector('#icsMeals').checked, lead: app.S.notify.lead || 0 });
  if (!/BEGIN:VEVENT/.test(ics)) return toast('Keine Termine zum Exportieren – erst Zeiten festlegen', true);
  const file = new File([ics], 'ironcore-tagesplan.ics', { type: 'text/calendar' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'IRONCORE Tagesplan' }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const url = URL.createObjectURL(file), a = document.createElement('a');
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
export { esc };
