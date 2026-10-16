# IRONCORE — Personal Fitness OS

Private Fitness-App nur für den Eigengebrauch: Training, Ernährung, Körper und Ziele an einem Ort. Kein Konto, kein Server, kein Tracking. **Alle Daten bleiben auf dem Gerät.**

## Funktionen

**Dashboard**
- Gewicht als 7-Tage-Trend, Ziel, Veränderung über 7 und 30 Tage
- Kalorien und Makros des Tages
- Heutiges Training mit „Letzte Leistung“ und Start
- Wochenfortschritt, letzte Rekorde, Wasser, Schlaf, Schritte, Supplements
- Schnellzugriff: Gewicht · Essen · Training

**Training**
- Mehrere Pläne, Trainingstage mit festen Wochentagen
- Pro Übung Sätze, Wiederholungen, Ziel-kg, Pause und Notiz
- Pläne und Tage duplizieren
- Übungsbibliothek mit 46 Übungen (Muskelgruppe, Gerät, Ausführung, eigene Notizen, Verlauf), eigene Übungen jederzeit
- Fokus-Modus im Gym: aktuelle Übung, letzte Leistung, Satz-Eingabe, Pausen-Timer mit Signal, Dauer, Notizen
- Jede Eingabe wird sofort gespeichert, Neuladen oder Schließen verliert nichts
- Analyse: Volumen, Einheiten und Sätze pro Woche, Sätze pro Muskelgruppe, Rekorde (e1RM), Vergleich mit der letzten Einheit
- Verlauf: abgeschlossene Trainings bearbeiten, wiederholen, löschen

**Ernährung**
- Tagesziele, Mahlzeiten (Frühstück, Mittag, Abend, Snacks)
- Favoriten und zuletzt genutzte Lebensmittel oben
- Gespeicherte Mahlzeiten, „Wie gestern“ pro Mahlzeit oder ganzer Tag
- Schnelleintrag nur mit Makros
- Barcode-Scanner mit [Open Food Facts](https://world.openfoodfacts.org), dabei wird nur die Barcode-Nummer gesendet
- 14-Tage-Verlauf

**Fortschritt**
- Gewichtsmessungen mit Datum und Uhrzeit
- Diagramm mit Messung und 7-Tage-Trend getrennt, Ansichten Woche, Monat, Jahr, Alles
- Tempo pro Woche, Prognose bis zum Zielgewicht
- Maße (Brust, Taille, Hüfte, Arme, Oberschenkel und eigene Felder) mit Verlauf
- Private Fortschrittsfotos mit Vorher/Nachher-Vergleich

**Ziele**
- Zielgewicht, Trainings pro Woche, Ernährungsziele mit Zielerreichung der letzten 7 Tage
- Kraftziele (z. B. 100 kg × 5), Fortschritt automatisch aus den Trainings
- Eigene Meilensteine
- Rekorde und erreichte Ziele werden mit einer dezenten Gold-Animation gefeiert

Alle Kennzahlen kommen aus echten Einträgen. Reichen die Daten nicht (z. B. 30-Tage-Veränderung nach einer Woche), zeigt die App das an, statt Werte zu erfinden.

## Daten & Privatsphäre

| | |
|---|---|
| Speicherort | Browser-Speicher des Geräts: Daten in `localStorage`, Fotos in IndexedDB |
| Konto / Server | keins |
| Externe Anfragen | nur der Barcode-Scanner (Barcode-Nummer an Open Food Facts); Schriften liegen lokal |
| Backup | Einstellungen → Daten → **Backup** (JSON inkl. Fotos), am besten in „Dateien“ / iCloud Drive |
| Export | CSV für Gewicht, Trainingssätze, Ernährung pro Tag, Maße |
| Korrigieren / Löschen | jeder Eintrag ist bearbeit- und löschbar, plus „Alle Daten löschen“ |

**Grenzen der lokalen Speicherung:** Die Daten gelten nur für dieses Gerät und diese Web-Adresse. Bei Gerätewechsel, verlorenem Handy oder gelöschten Safari-Website-Daten sind sie ohne Backup weg. Die App fordert dauerhaften Speicher an und erinnert nach einer Woche ohne Backup. Für mehrere Geräte bräuchte es ein Backend mit privater Anmeldung. Darauf ist bewusst verzichtet, solange ein Gerät genügt.

Daten aus der Vorgänger-App **FIT** werden beim ersten Start automatisch übernommen. FIT-Backups lassen sich ebenfalls laden.

## Aufs iPhone

1. Die Vercel-Adresse in **Safari** öffnen.
2. **Teilen** → **Zum Home-Bildschirm**.
3. IRONCORE startet im Vollbild und läuft auch offline.

## Technik

Statische Web-App aus HTML, CSS und JavaScript-Modulen (ES Modules), ohne Framework, ohne Build-Schritt und ohne Laufzeit-Abhängigkeiten. Vercel liefert `public/` direkt aus.

```
public/
  index.html, manifest.webmanifest, sw.js (Offline-Cache), Icons
  css/ironcore.css      Black-&-Gold-Design-System
  fonts/                Inter, Space Grotesk (lokal, OFL)
  js/
    logic.js            reine Rechenlogik (Trends, Rekorde, Ziele, Validierung) – getestet
    store.js            Datenmodell, Migration aus FIT, Speichern, Foto-Datenbank
    seed.js             Übungsbibliothek, Lebensmittel, Plan-Vorlagen
    core.js             Zustand, Navigation, Sheets, Rückmeldungen
    domain.js           Abfragen auf dem Zustand
    ui.js               Formatierung, Icons, Diagramme
    scanner.js          Barcode-Scanner
    views/              home, training, session, nutrition, progress, goals, settings
  vendor/               html5-qrcode (Apache-2.0)
tests/                  node:test – Logik, Migration, Offline-Cache, keine Fremd-Requests
```

```bash
npm run dev    # lokal starten: http://localhost:5173
npm test       # Tests
```

Bei Änderungen an App-Dateien in `public/sw.js` die `VERSION` erhöhen. Der Test prüft, dass jede Datei im Offline-Cache steht.
