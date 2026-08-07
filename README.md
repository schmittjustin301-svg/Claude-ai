# GRIND EMPIRE

Persönliche Business-Tycoon-App, die den Aufbau eines Content-/Editing-Business gamifiziert. Nur für den Eigengebrauch — kein Multi-User, kein App Store.

Dies ist **Phase 0 + Phase 1** aus dem Projekt-Brief: eine React-PWA mit dem kompletten Gameplay-Feature-Set, lokal persistiert. Phase 2–5 (JARVIS-Backend, YouTube/Instagram/TikTok) sind vorbereitet, aber noch nicht live geschaltet, weil sie eigene Secrets/Accounts brauchen.

## Starten

```bash
npm install
npm run dev
```

Öffnet unter `http://localhost:5173`. Auf dem Handy: Vite mit `--host` starten und die angezeigte LAN-URL öffnen, oder `npm run build && npm run preview` für einen Produktions-Build, den man als PWA installieren kann ("Zum Homescreen hinzufügen").

## Athleten-Datenbank & Grafik-Studio

Der Athletes-Tab hat drei Bereiche:

**Studio** — Namen eintippen (einer pro Zeile), fertige Grafik rausbekommen. Die Suche ist tippfehlertolerant: „Missy Truscot" findet „Missy Truscott" und zeigt die Trefferquote an. Das Layout wird automatisch nach Anzahl gewählt (1 = Hero, 2 = Side by Side, 3 = Triple, 4–6 = Grid, >6 = mehrere Reihen). Export als PNG einzeln oder in allen 9 Formaten (Instagram Feed/Story, Facebook, X, YouTube Community/Thumbnail, Square, Portrait, Landscape).

**Datenbank** — Athleten anlegen, bearbeiten, löschen, Bilder je Kategorie verwalten (Portrait, Stage, Front/Side/Back Pose, Progress). Bulk-Bildupload: Dateiname = Athletenname, bestehende Profile werden ergänzt statt dupliziert.

**Templates** — Hintergrund, Farben, Fonts, Rahmen, Schatten, Eckenradius, Logo, Abstände und Bildanteil pro Marke einstellbar. Vier Vorlagen sind dabei (Full Access Weekly, Female Bodybuilding Channel, Muscle Media TV, Olympia Coverage); für eine eigene Marke duplizieren.

### Athleten per JARVIS anlegen

Im JARVIS-Tab Bilder über 📎 anhängen und die Details dazuschreiben:

```
Name: Missy Truscott
Division: Fitness
Country: USA
Coach: Rafael Zimmermann
```

JARVIS prüft zuerst auf ein bestehendes Profil, legt an oder ergänzt, ordnet das Bild einer Kategorie zu und speichert alles — ohne manuelles Bearbeiten der Datenbank.

**Wichtige Einschränkung:** JARVIS kann Personen **nicht am Gesicht erkennen**. Die Zuordnung läuft über den Namen, den du mitschickst, bzw. über Text, der im Bild lesbar ist (Namen auf Promo-Grafiken, Screenshots, Wettkampf-Overlays). Was JARVIS selbstständig aus dem Bild ableitet, ist die **Bildkategorie** (Portrait, Bühne, Posing-Richtung). Ohne erkennbaren Namen fragt JARVIS nach, statt zu raten.

**Speicherort:** Athleten und Bilder liegen in IndexedDB (nicht localStorage — Bilder sprengen dessen ~5 MB sofort). Der Speicherverbrauch wird im Datenbank-Tab angezeigt. Wie beim Rest der App sind die Daten bis zur Supabase-Anbindung gerätelokal.

## JARVIS — Sprach-Assistent

Im JARVIS-Tab kann man per Mikrofon sprechen und bekommt eine gesprochene Antwort. Kern antippen → sprechen → kurze Pause beendet den Zug automatisch.

- **Hands-free:** nach der Antwort startet die Aufnahme automatisch neu, für ein durchgehendes Gespräch. Die Aufnahme startet erst, wenn die Stimme fertig gesprochen hat, damit sich JARVIS nicht selbst zuhört.
- **Sprachausgabe:** Antworten werden vorgelesen (abschaltbar).
- Der Orb spiegelt den Zustand: rot = bereit, grün = hört zu (reagiert auf die Mikrofon-Lautstärke), gold = denkt nach.

Spracherkennung und Sprachausgabe laufen über die **Web Speech API** direkt im Browser — kein API-Key, keine Kosten, keine externe Übertragung durch die App selbst. Voraussetzung: **Chrome, Edge oder Safari** (Firefox kann keine Spracherkennung — Tippen funktioniert dort weiterhin). Auf iOS muss die Seite per HTTPS oder localhost laufen, damit das Mikrofon freigegeben wird.

### Zum Reden braucht JARVIS einen Anthropic-Key

Sprachein- und -ausgabe funktionieren sofort, aber die eigentlichen Antworten kommen von der Anthropic API:

```bash
cp .env.example .env
# ANTHROPIC_API_KEY=sk-ant-... eintragen
npm run dev
```

Im Dev-Modus läuft der Chat über einen lokalen Proxy (`vite-plugin-chat-dev-proxy.ts`, Endpoint `/api/chat`). Der Key wird ausschließlich im Node-Prozess gelesen und landet **nie** im Browser-Bundle. Für Produktions-Builds bzw. das Handy wird stattdessen die Supabase Edge Function genutzt (siehe Phase 2).

## Architektur

```
src/
  lib/
    types.ts        # Datenmodell — 1:1 identisch zum geplanten Supabase-Schema
    db.ts            # Persistenz-Layer (aktuell localStorage)
    gameLogic.ts      # XP/Level/Tier-Mathematik, Prestige, Boss, Streak, Empire Health, Random Events
    seed.ts           # Statische Referenzdaten (Kanäle, Skills, Achievements, Roadmap, Bosse, Events)
    sound.ts          # WebAudio-Synth-Sounds (keine externen Assets)
    speech.ts          # Web Speech API: Mikrofon-Diktat + deutsche Sprachausgabe
    micLevel.ts         # Mikrofon-Lautstärke für die Orb-Animation
    aiTools.ts           # Tool-Definitionen + Ausführung für JARVIS
    aiClient.ts           # Client für den Chat-Proxy (Anthropic-Key bleibt serverseitig)
    systemPrompt.ts        # Persona/Kontext-Prompt für JARVIS
  lib/athletes/
    types.ts          # Athleten-Datenmodell + Bildkategorien
    athleteDb.ts       # IndexedDB (Athleten, Bilder als Blob, Templates)
    repository.ts       # Duplikat-sicheres Anlegen/Zusammenführen — einziger Schreibpfad
    search.ts            # Levenshtein-basierte Fuzzy-Suche + Namenslisten-Parsing
    layout.ts             # Layout-Wahl nach Athletenanzahl
    templates.ts           # Design-Templates (Marken-Vorlagen)
    render.ts               # Canvas-Renderer — Vorschau und Export teilen sich den Pfad
    exportFormats.ts         # Zielgrößen der 9 Exportformate
    countries.ts              # Land → Flaggen-Emoji
    athleteTools.ts            # Athleten-Tools für JARVIS + Upload-Puffer
  store/
    empireStore.ts      # Zustand-Store — einzige Schnittstelle zwischen UI/AI-Tools und Datenlayer
    athleteStore.ts      # Athleten-Store über der IndexedDB-Schicht
  features/            # Ein Ordner pro Tab (overview, today, boss, earnings, roadmap, skills, achievements, chat)
  components/          # Geteilte UI-Bausteine (Nav, Toasts, LevelUpOverlay, RandomEventBanner, ui.tsx)
supabase/functions/chat/     # Chat-Proxy für Produktion (Deno Edge Function)
vite-plugin-chat-dev-proxy.ts # Chat-Proxy für lokale Entwicklung (nur `npm run dev`)
```

**Wichtiges Prinzip:** UI-Komponenten und der JARVIS-Tool-Layer sprechen ausschließlich mit `empireStore.ts`, nie direkt mit `db.ts`. Das bedeutet: die Umstellung von localStorage auf Supabase betrifft nur `src/lib/db.ts` (und optional die Actions in `empireStore.ts`, falls sie async/await gegen die Supabase-Client-Library brauchen) — der Rest der App bleibt unverändert.

## Nächste Schritte laut Phasenplan

### Phase 0/1 — was schon geht
- Alle 9 Kern-Features aus dem Prototyp: Empire Overview mit Skyline, Today (Contracts + Tagesliste + Streak), Boss Fights, Earnings mit Chart, Roadmap, Skill Tree, Achievements, Random Events, Sound-/Animations-Feedback
- Design-Tokens (Farben, Fonts, Grid-HUD-Look) exakt nach Brief
- Installierbare PWA (Manifest + Service Worker über `vite-plugin-pwa`)
- Datenmodell bereits im Supabase-Schema-Format

### Phase 0 — Supabase anbinden
1. Supabase-Projekt anlegen, Tabellen aus `src/lib/types.ts` per Migration erstellen (Spalten entsprechen den Interfaces 1:1)
2. `@supabase/supabase-js` installieren, `src/lib/db.ts` auf Supabase-Queries umstellen (Interface `Database`/`loadDatabase`/`saveDatabase` beibehalten oder durch Supabase-Realtime-Subscriptions ersetzen)
3. Minimal-Auth (Single-User) einrichten, damit Handy und PC syncen

### Phase 2 — JARVIS auch auf dem Handy
Lokal (`npm run dev`) läuft JARVIS bereits über den mitgelieferten Dev-Proxy — siehe oben. Für die installierte PWA auf dem Handy braucht es einen erreichbaren Proxy:

1. `supabase/functions/chat/index.ts` deployen: `supabase functions deploy chat` und `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
2. In der `.env` `VITE_CHAT_PROXY_URL` auf die deployte Function-URL setzen und neu bauen
3. Der Chat-Tab führt dann echte Tool-Calls gegen den Store aus (`createContract`, `completeContract`, `addDailyTask`, `logEarning`, `addRoadmapItem`, `updateRoadmapStatus`, `updateSkill`, `getEmpireStatus`, `getEarningsSummary`)

Ist kein Proxy erreichbar, zeigt (und spricht) der Chat-Tab einen Hinweis statt zu crashen.

### Phase 3–4 — YouTube / Instagram
Noch nicht implementiert (brauchen OAuth-Consent-Flow + eigene Developer-Apps). Die Tabelle `social_stats` im Datenmodell ist bereits vorbereitet, um gecachte Kennzahlen abzulegen.

### Phase 5 — Feinschliff
TikTok-Anbindung, Push-Notifications, weitere Polish-Themen — offen.

## Design

Farben, Fonts und Look sind über `@theme`-Tokens in `src/index.css` sowie Tailwind-Utility-Klassen (`ge-glow-*`, `ge-grid-bg`) zentral definiert — siehe Projekt-Brief für die Werte.
