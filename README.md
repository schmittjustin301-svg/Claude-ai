# GRIND EMPIRE

Persönliche Business-Tycoon-App, die den Aufbau eines Content-/Editing-Business gamifiziert. Nur für den Eigengebrauch — kein Multi-User, kein App Store.

Dies ist **Phase 0 + Phase 1** aus dem Projekt-Brief: eine React-PWA mit dem kompletten Gameplay-Feature-Set, lokal persistiert. Phase 2–5 (JARVIS-Backend, YouTube/Instagram/TikTok) sind vorbereitet, aber noch nicht live geschaltet, weil sie eigene Secrets/Accounts brauchen.

## Starten

```bash
npm install
npm run dev
```

Öffnet unter `http://localhost:5173`. Auf dem Handy: Vite mit `--host` starten und die angezeigte LAN-URL öffnen, oder `npm run build && npm run preview` für einen Produktions-Build, den man als PWA installieren kann ("Zum Homescreen hinzufügen").

## Architektur

```
src/
  lib/
    types.ts        # Datenmodell — 1:1 identisch zum geplanten Supabase-Schema
    db.ts            # Persistenz-Layer (aktuell localStorage)
    gameLogic.ts      # XP/Level/Tier-Mathematik, Prestige, Boss, Streak, Empire Health, Random Events
    seed.ts           # Statische Referenzdaten (Kanäle, Skills, Achievements, Roadmap, Bosse, Events)
    sound.ts          # WebAudio-Synth-Sounds (keine externen Assets)
    aiTools.ts         # Tool-Definitionen + Ausführung für JARVIS
    aiClient.ts         # Client für den Chat-Proxy (Anthropic-Key bleibt serverseitig)
    systemPrompt.ts      # Persona/Kontext-Prompt für JARVIS
  store/
    empireStore.ts      # Zustand-Store — einzige Schnittstelle zwischen UI/AI-Tools und Datenlayer
  features/            # Ein Ordner pro Tab (overview, today, boss, earnings, roadmap, skills, achievements, chat)
  components/          # Geteilte UI-Bausteine (Nav, Toasts, LevelUpOverlay, RandomEventBanner, ui.tsx)
supabase/functions/chat/ # Referenz-Implementierung des Chat-Proxys (Deno Edge Function)
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

### Phase 2 — JARVIS-Modus aktivieren
1. `supabase/functions/chat/index.ts` deployen: `supabase functions deploy chat` und `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
2. `.env` anlegen (Vorlage: `.env.example`) und `VITE_CHAT_PROXY_URL` auf die deployte Function-URL setzen
3. Fertig — der Chat-Tab führt dann echte Tool-Calls gegen den Store aus (`createContract`, `completeContract`, `addDailyTask`, `logEarning`, `addRoadmapItem`, `updateRoadmapStatus`, `updateSkill`, `getEmpireStatus`, `getEarningsSummary`)

Ohne gesetztes `VITE_CHAT_PROXY_URL` zeigt der Chat-Tab einen Hinweis statt zu crashen.

### Phase 3–4 — YouTube / Instagram
Noch nicht implementiert (brauchen OAuth-Consent-Flow + eigene Developer-Apps). Die Tabelle `social_stats` im Datenmodell ist bereits vorbereitet, um gecachte Kennzahlen abzulegen.

### Phase 5 — Feinschliff
TikTok-Anbindung, Push-Notifications, weitere Polish-Themen — offen.

## Design

Farben, Fonts und Look sind über `@theme`-Tokens in `src/index.css` sowie Tailwind-Utility-Klassen (`ge-glow-*`, `ge-grid-bg`) zentral definiert — siehe Projekt-Brief für die Werte.
