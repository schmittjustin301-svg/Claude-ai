# FIT – privater Fitness-Tracker

Persönliche Fitness-App nur für den Eigengebrauch: Training, Ernährung, Makros und Körperwerte an einem Ort. Kein Konto, kein Server, keine Werbung. **Alle Daten bleiben auf dem Handy.**

## Funktionen

- **Heute:** Kalorien-Ring mit Makros, Training des Tages, Wasser, Schlaf, Schritte, Gewicht, Cardio, Supplements zum Abhaken
- **Training:** Trainingsplan mit festen Wochentagen (Vorlagen Push/Pull/Beine oder Ober/Unter), Sätze mit Gewicht und Wiederholungen loggen, „Letztes Mal“-Werte, Pausen-Timer mit Signal, Rekorde (geschätztes 1RM) mit Verlauf pro Übung, Wochenübersicht
- **Essen:** eigene Lebensmittel-Liste (Werte je 100 g, Favoriten), Mahlzeiten pro Tag, Schnelleintrag nur mit Makros, „von gestern kopieren“
- **Barcode-/QR-Scanner:** Produkt scannen. Bekannte Produkte werden sofort erkannt, auch offline. Neue werden mit Nährwerten aus [Open Food Facts](https://world.openfoodfacts.org) vorausgefüllt, dabei wird nur die Barcode-Nummer gesendet.
- **Makro-Rechner:** Kalorienbedarf nach Mifflin-St Jeor, Aktivität, Defizit, Protein und Fett pro kg Körpergewicht → Tagesziel
- **Körper:** Gewicht mit 7-Tage-Schnitt, Abnehm-Tempo und Prognose bis zum Zielgewicht, Maße, Fortschrittsfotos mit Vorher/Nachher-Vergleich

## Aufs iPhone

1. Die Vercel-Adresse in **Safari** öffnen.
2. **Teilen** → **Zum Home-Bildschirm**.
3. FIT startet danach wie eine normale App, auch ohne Internet.

## Daten & Backup

Die Daten liegen im Browser-Speicher des Geräts (localStorage, Fotos in IndexedDB). Unter **Mehr → Backup erstellen** wird eine JSON-Datei erzeugt. Die am besten in „Dateien“ oder iCloud Drive sichern. Mit **Backup laden** kommt alles zurück, auch auf einem neuen Handy.

Die Daten hängen an der Web-Adresse. Wechselt die Adresse, zieht man per Backup um.

## Technik

Reines HTML/CSS/JavaScript ohne Framework und ohne Build-Schritt. Alles liegt in `public/`:

| Datei | Zweck |
|---|---|
| `index.html`, `styles.css`, `app.js` | die App |
| `sw.js` | Service Worker für den Offline-Betrieb |
| `manifest.webmanifest`, Icons | Installation als Home-Bildschirm-App |
| `vendor/html5-qrcode.min.js` | Scanner-Bibliothek (Apache-2.0), wird erst beim Scannen geladen |

Vercel liefert `public/` direkt aus (siehe `vercel.json`). Jeder Push auf den Produktions-Branch geht automatisch online. Lokal starten:

```bash
npm run dev
```

Öffnet unter `http://localhost:5173`.
