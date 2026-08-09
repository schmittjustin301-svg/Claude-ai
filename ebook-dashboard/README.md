# LeanLead Dashboard (Mockup)

Dashboard-Konzept für ein KI-gestütztes Ebook-Business: ein Abnehm-Ebook für Business-Leute,
das automatisch zu Content für Instagram, TikTok, YouTube und LinkedIn verarbeitet und von
einem zentralen Dashboard aus gesteuert wird.

**Status: reines UI-Mockup mit Beispieldaten.** Es ist noch keine echte KI-Anbindung und keine
echte Social-Media-API-Integration verbaut. Das "Mit KI weiterschreiben" auf der Ebook-Seite
simuliert nur einen Fortschritt, es ruft kein Sprachmodell auf.

## Seiten

- **Übersicht** – KPIs (Ebook-Fortschritt, Posts in Pipeline, Reichweite, verbundene Plattformen), Content-Verteilung pro Plattform, zuletzt veröffentlichte Posts.
- **Ebook** – Kapitelliste mit Status (Idee/Gliederung/Entwurf/Fertig) und Wortfortschritt.
- **Content-Kalender** – Alle geplanten/veröffentlichten Posts, filterbar nach Plattform.
- **Plattformen** – Verbindungsstatus und Auto-Posting-Schalter pro Kanal.

## Starten

```bash
cd ebook-dashboard
npm install
npm run dev
```

## Was für den nächsten Schritt (echte Automatisierung) fehlt

Jede Plattform braucht eigene Zugänge, die der Betreiber selbst einrichten muss, bevor eine
KI wirklich automatisch posten kann:

- **Instagram / Facebook**: Meta-Business-Account + App-Review für die Graph API (Content Publishing).
- **TikTok**: TikTok-for-Developers-App + Content Posting API, inkl. Freigabeprozess.
- **YouTube**: Google-Cloud-Projekt + YouTube Data API v3 (OAuth), Quota-Antrag für Uploads.
- **LinkedIn**: LinkedIn-Developer-App mit `w_member_social`-Scope (oder Company-Page-Zugriff).

Zusätzlich braucht die eigentliche Ebook- und Content-Generierung eine Anbindung an ein
Sprachmodell (z. B. Claude über die Anthropic API) sowie eine Backend-/Datenbankschicht
(aktuell laufen alle Daten nur im Speicher des Browsers).
