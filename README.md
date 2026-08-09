# GRIND EMPIRE

Persönliche Business-Tycoon-App, die den Aufbau eines Content-/Editing-Business gamifiziert. Nur für den Eigengebrauch — kein Multi-User, kein App Store.

Dies ist **Phase 0 + Phase 1** aus dem Projekt-Brief: eine React-PWA mit dem kompletten Gameplay-Feature-Set, lokal persistiert. Phase 2–5 (JARVIS-Backend, YouTube/Instagram/TikTok) sind vorbereitet, aber noch nicht live geschaltet, weil sie eigene Secrets/Accounts brauchen.

## Starten

```bash
npm install
npm run dev
```

Öffnet unter `http://localhost:5173`.

## Ins Internet stellen (einfachster Weg aufs iPhone)

Du brauchst dafür **kein Terminal und kein Node.js auf deinem Rechner**. Alles läuft über die Webseite von Vercel und dein GitHub-Konto.

### 1. Bei Vercel anmelden
[vercel.com](https://vercel.com) öffnen → **Sign Up** → **Continue with GitHub** → GitHub-Zugriff bestätigen.

### 2. Projekt importieren
**Add New…** → **Project** → in der Liste `Claude-ai` suchen → **Import**.

Vercel erkennt Vite automatisch. Build Command und Output Directory stehen schon in `vercel.json` — nichts ändern.

### 3. Anthropic-Key hinterlegen
Noch vor dem ersten Deploy den Bereich **Environment Variables** aufklappen und zwei Einträge anlegen:

| Name | Wert |
|---|---|
| `ANTHROPIC_API_KEY` | dein Key von [console.anthropic.com](https://console.anthropic.com) (beginnt mit `sk-ant-`) |
| `APP_ACCESS_CODE` | ein selbst ausgedachtes Passwort, z.B. `grind2026` |

Dann **Deploy** klicken und ein paar Minuten warten.

**Wozu der Zugangscode:** Die Seite ist öffentlich im Netz erreichbar, und dahinter hängt dein bezahlter API-Key. Ohne Code könnte jeder, der die Adresse kennt, auf deine Rechnung Anfragen stellen. Mit Code fragt die App beim ersten Chat einmal danach und merkt ihn sich. Lässt du `APP_ACCESS_CODE` weg, funktioniert alles trotzdem — die App zeigt dann aber eine Warnung an.

### 4. Am iPhone öffnen
Vercel gibt dir eine Adresse wie `https://claude-ai-xyz.vercel.app`. Die am iPhone in **Safari** öffnen.

Beim ersten JARVIS-Chat fragt die App nach dem Zugangscode aus Schritt 3 — einmal eingeben, fertig.

### 5. Als App auf den Homescreen
In Safari: **Teilen-Button** (Quadrat mit Pfeil nach oben) → **Zum Home-Bildschirm**. Danach startet GRIND EMPIRE wie eine normale App, ohne Browser-Leiste.

### Danach
Jedes Mal, wenn sich am Code etwas ändert und der Branch gepusht wird, baut Vercel automatisch neu. Die Adresse bleibt gleich.

**Was noch nicht geht:** Die Daten (Athleten, Bilder, Gedächtnis, Fortschritt) liegen weiterhin im Browser des jeweiligen Geräts. iPhone und PC haben also getrennte Stände, und iOS kann Daten von Web-Apps löschen, die ~7 Tage nicht geöffnet wurden. Das löst der Supabase-Schritt.

## Lokal auf dem eigenen Rechner testen

Es gibt zwei Wege. Der Unterschied ist entscheidend: **Mikrofon und Spracherkennung brauchen einen „secure context"** — also HTTPS oder localhost. Über die reine LAN-IP blockiert iOS Safari das Mikro.

### Weg 1 — LAN (schnell, aber ohne Sprache)

```bash
npm run dev
```

Vite zeigt neben der Local- auch eine Network-URL wie `http://192.168.1.42:5173`. Die am iPhone im Safari öffnen — PC und iPhone müssen im selben WLAN sein.

Funktioniert: Empire, Today, Boss, Earnings, Athleten-Datenbank, Studio inkl. Export, Gedächtnis, und JARVIS **per Tippen**.
Funktioniert **nicht**: Mikrofon-Diktat und damit der Sprachmodus.

### Weg 2 — HTTPS-Tunnel (alles, inklusive Sprache)

In einem Terminal den Dev-Server starten, in einem zweiten den Tunnel:

```bash
npm run dev            # Terminal 1
npm run dev:tunnel     # Terminal 2
```

Dafür wird `cloudflared` gebraucht (kein Account nötig):

```bash
brew install cloudflared         # macOS
```

Der Tunnel gibt eine `https://…trycloudflare.com`-URL aus. Die am iPhone öffnen — dort funktioniert dann auch das Mikrofon und der komplette Sprachmodus. Alternativ geht `ngrok http 5173` genauso; beide Domains sind in `vite.config.ts` bereits freigegeben.

### Als App auf den Homescreen

In Safari über die HTTPS-URL: Teilen-Button → „Zum Home-Bildschirm". Danach startet GRIND EMPIRE als eigenständige App ohne Browser-Leiste.

### Was du dabei wissen solltest

- Der Tunnel läuft nur, solange dein PC läuft und beide Terminals offen sind. Für dauerhafte Nutzung ohne PC braucht es den Supabase-Schritt plus ein Deployment.
- Die URL wechselt bei jedem Neustart des Tunnels. Eine als PWA installierte Version zeigt dann auf die alte, tote Adresse — nach einem Neustart also neu hinzufügen.
- **Daten sind pro Gerät und pro URL getrennt.** Was du am PC angelegt hast, ist am iPhone nicht da, und eine neue Tunnel-URL bekommt wieder einen leeren Stand. Das löst erst Supabase; fürs Gedächtnis gibt es zwischenzeitlich Export/Import.
- iOS kann Daten von Web-Apps löschen, die ~7 Tage nicht geöffnet wurden. Also nichts dort ablegen, was du nicht woanders auch hast, solange Supabase nicht steht.

## Athleten-Datenbank & Grafik-Studio

Der Athletes-Tab hat drei Bereiche:

**Posts** — Namen eintippen (einer pro Zeile), fertige Grafik rausbekommen. Dazu **Headline** (Anton) und **Subtitel** (Inter, erscheint unten und überdeckt nie einen Athleten — das Grid schrumpft stattdessen). Posts werden gespeichert und lassen sich später wieder öffnen und ändern.

Post-Typ **Show-Lineup** setzt zusätzlich das Logo der gewählten Show mittig über das Athleten-Grid, skaliert relativ zur Canvas-Breite. Shows verwaltest du im **Shows**-Tab (Logo als transparentes PNG, optional eine Glow-Variante). Die Suche ist tippfehlertolerant: „Missy Truscot" findet „Missy Truscott" und zeigt die Trefferquote an. Das Layout wird automatisch nach Anzahl gewählt (1 = Hero, 2 = Side by Side, 3 = Triple, 4–6 = Grid, >6 = mehrere Reihen). Export als PNG einzeln oder in allen 9 Formaten (Instagram Feed/Story, Facebook, X, YouTube Community/Thumbnail, Square, Portrait, Landscape).

**Datenbank** — Athleten anlegen, bearbeiten, löschen, Bilder je Kategorie verwalten (Portrait, Stage, Front/Side/Back Pose, Progress). Bulk-Bildupload: Dateiname = Athletenname, bestehende Profile werden ergänzt statt dupliziert.

**Templates** — Hintergrund, Farben, Fonts, Rahmen, Schatten, Eckenradius, Logo, Abstände und Bildanteil pro Marke einstellbar. Vier Vorlagen sind dabei (Full Access Weekly, Female Bodybuilding Channel, Muscle Media TV, Olympia Coverage); für eine eigene Marke duplizieren.

### Clip Lab

Video-Arbeit ist ein eigenes Modul mit eigenem Tab, getrennt von der Athleten-Bibliothek. Ein Clip *kann* einem Athleten zugeordnet sein, muss aber nicht.

**Aus Foto** — Athletenfoto zu cinematischem Clip (siehe unten).

**Highlights** — Video hochladen, im Player scrubben, Start/Ende setzen, Highlight markieren. Clips werden als Zeitmarken auf dem Original gespeichert, nicht neu kodiert: das Original bleibt unangetastet und das Markieren ist sofort fertig. Echtes Schneiden im Browser bräuchte ffmpeg.wasm (~30 MB Download) oder Echtzeit-Neukodierung mit Qualitätsverlust.

> **Was Higgsfield mit Clips kann — und was nicht:** Die API bietet **keine** Video-zu-Video-Bearbeitung an. Upscaling oder Stilisierung eines bestehenden Clips gibt es dort nicht, nur Bild-zu-Video. Weitergegeben wird deshalb ein Frame aus der Mitte des Segments, aus dem ein neuer Clip generiert wird. Der Hinweis steht auch direkt in der UI.

Der Verbrauch zeigt die von dieser App gestarteten Generierungen. Higgsfield bietet keine Guthaben-Abfrage an — der echte Kontostand steht auf cloud.higgsfield.ai.

### Grind Clicker

Ein Clicker-Minigame im eigenen Tab. Auf dem Desktop liegen **alle** Bereiche als Dashboard nebeneinander — Gym, Training, Aufträge, Ausrüstung, Umziehen, Perks, Ränge, Awards sind gleichzeitig sichtbar, ohne zwischen Tabs zu wechseln. Auf dem Handy ist dafür kein Platz, dort bleiben es drei Panes (Training / Kaufen / Meta).

#### Das Gym

Oben steht dein Gym als gezeichneter Raum (`GymView.tsx`), gefüllt aus dem Spielstand: **jedes gekaufte Upgrade stellt ein Gerät hinein** — Hantelstange, Ringlicht, Squat-Rack, Serverschrank, Kamera, Podium — und jeder **Rebrand zieht dich in ein größeres Gym um**, von der Garage bis zum Olympia-Campus (9 Stufen, jede mit eigener Wand-, Boden- und Akzentfarbe und mehr Fenstern). Geräte belegen der Reihe nach freie Plätze, damit ein junges Gym leer und aufgeräumt wirkt und ein spätes voll.

Es ist flache Vektorgrafik statt Emoji oder Fotos: Emoji sehen auf jedem Gerät anders aus, und Fotos würden dem Rest der App die Aufmerksamkeit wegnehmen.

Die Progression ist geschichtet, damit immer ein nächstes Ziel auf einer anderen Zeitskala offen ist:

- **16 Upgrades** vom Protein Shake bis zu den Olympia-Rechten, mit ×1/×10/MAX-Kauf. Alle 25 Stufen **verdoppelt** sich die Wirkung eines Upgrades — jedes hat damit sein eigenes Langzeitziel. Ein eigener Knopf kauft in einem Zug **genau bis zur nächsten Verdopplung** und nennt den Preis vorher; er ist gesperrt, solange der ganze Sprung nicht bezahlbar ist, damit man nicht auf halber Strecke ohne Reps stehenbleibt.
- **24 Ränge** nach Gesamt-Reps (Rookie bis Endgegner), jeder gibt dauerhaft +8% auf alles.
- **Rebrand (Prestige)** tauscht den Fortschritt in **Clout**.
- **7 Clout-Perks**, die jeden Rebrand überleben: stärkere Klicks, mehr Auto-Ertrag, Startkapital für den nächsten Lauf, längerer Offline-Ertrag, bessere goldene Reps, längere Combos, günstigere Upgrades. Clout ist damit eine Entscheidung statt nur einer größeren Zahl.
- **Legacy** als zweite Prestige-Ebene (ab 5 Rebrands und 50 verdientem Clout): setzt *auch* Clout und Perks zurück und gibt dafür +50% auf alles, dauerhaft.
- **Goldene Reps** tauchen zufällig auf und geben entweder einen Frenzy-Multiplikator auf Klicks oder eine Sofortauszahlung — belohnt aktives Zuschauen.
- **Klick-Combo**, die bei schnellem Klicken hochzählt und wieder abfällt.
- **26 Awards** mit je +2% dauerhaft.
- **Aufträge**: drei Quests gleichzeitig (klicken, Reps verdienen, Upgrades kaufen, goldene Reps fangen, Combo halten), die nach dem Einlösen sofort nachgefüllt werden. Die Schwierigkeit steigt mit der Zahl der erledigten Aufträge, damit sie im späten Spiel nicht trivial werden. Upgrade-Quests zählen nach einem Rebrand von vorn — sonst wären sie durch den Reset unerfüllbar.
- **Coins** sind die Auftrags-Währung, bewusst getrennt von Clout: würden Quests Clout zahlen, könnte man den Prestige-Kreislauf an den Rebrands vorbei abkürzen. Coins gehen stattdessen in die **Gym-Ausstattung** — Hantelbank, Sound-Anlage, Spiegelwand, Saftbar, Stoppuhr (kleine Dauerboni, alle auch im Gym oben sichtbar) sowie zwei Verbrauchsartikel: Pre-Workout (10 Minuten alles ×3) und ein Auftrags-Tausch. Ausstattung und Coins überleben Rebrand *und* Legacy — sie gehören nicht zum Prestige-Kreislauf.

Fortschritt wird überall als Balken gezeigt (nächster Rang, Clout beim nächsten Rebrand, nächster Upgrade-Meilenstein, Legacy-Freischaltung), damit auch ohne Rechnen sichtbar ist, wie weit das nächste Ziel noch weg ist.

Fortschritt läuft offline weiter, beim Öffnen bekommst du den Zwischenertrag gutgeschrieben. Gespeichert wird gedrosselt und beim Verlassen der Seite sofort — schnelles Klicken soll nicht durch Speicher-Schreibvorgänge ruckeln.

Es hängt bewusst nicht am Empire-Fortschritt: eigener Store, eigene Währung, keine Kopplung an XP oder Contracts.

### Brain — Wissensgraph

Der Brain-Tab zeigt als Netzwerk, was die App über dein Business weiß. Knotenfarben: Athleten rot, Shows weiß, Posts & Clips grau, Business grün, Ziele gold. Die Knotengröße wächst mit der Zahl der Verbindungen, Klick öffnet ein Detailpanel mit Link in die Obsidian-Note.

Gebaut wird der Graph aus dem Vault — die Wikilinks deiner Notizen *sind* die Kanten. Ist der Vault nicht erreichbar, fällt er auf die App-Daten zurück und sagt das auch dazu. Je sauberer der Vault-Sync schreibt, desto reicher wird der Graph.

JARVIS hat dafür `queryBrain`: fragt man nach Zusammenhängen („In welchen Posts kommt Missy vor?"), durchsucht er den Graphen — und die Knoten, auf die er sich stützt, leuchten im Brain-Tab auf.

### Vault-Sync

Unter JARVIS → Gedächtnis → **Vault-Sync** lässt sich einschalten, dass alles in den Obsidian-Vault geschrieben wird: erledigte Contracts in die Tagesnotiz, Einnahmen ins Ledger, Athleten/Shows/Posts/Clips als eigene Notes, Boss-Siege und Achievements ins Log — jeweils als Markdown mit YAML-Frontmatter und Wikilinks unter `GRIND EMPIRE/`.

Geschrieben wird **additiv**: Notizen wachsen, von Hand Ergänztes bleibt erhalten. Ist Obsidian zu, wandern die Einträge in eine Warteschlange und werden nachgeholt, sobald es wieder erreichbar ist — nichts geht verloren. Den Stand siehst du im Panel.

### Video — Athletenfoto zu Clip (Higgsfield)

Der Video-Tab macht aus einem gespeicherten Athletenfoto einen cinematischen Clip über [Higgsfield](https://higgsfield.ai) DoP (Director of Photography).

**Einrichten:** Auf [cloud.higgsfield.ai](https://cloud.higgsfield.ai) registrieren, in den Account-Einstellungen die Zugangsdaten holen und bei Vercel als Environment Variable hinterlegen:

| Name | Wert |
|---|---|
| `HIGGSFIELD_CREDENTIALS` | `KEY_ID:KEY_SECRET` — beides mit Doppelpunkt getrennt |

Alternativ `HIGGSFIELD_API_KEY` und `HIGGSFIELD_API_SECRET` einzeln. Danach neu deployen.

**Benutzen:** Athlet suchen → Bild antippen → Bewegung beschreiben → optional eine Kamerafahrt wählen → generieren. Die Presets kommen live aus deinem Higgsfield-Account, sind also nicht fest verdrahtet.

Modelle: `dop-lite` (schnell/günstig), `dop-turbo` (Standard), `dop-standard` (beste Qualität).

**Wie es technisch läuft:** Die API braucht eine öffentlich erreichbare Bild-URL, deine Fotos liegen aber lokal in IndexedDB. Die Serverless-Funktion lädt das Bild deshalb erst zu Higgsfield hoch und referenziert dann die entstandene Adresse. Weil eine Generierung länger dauert als eine Serverless-Funktion laufen darf, wird der Job gestartet und der Browser fragt den Status separat ab — blockierendes Warten würde ins Timeout laufen und eine bezahlte Generierung verlieren.

**Kosten und Schutz:** Jede Generierung kostet Guthaben. Die Schnittstelle liegt hinter demselben `APP_ACCESS_CODE` wie der Chat — ohne den kann niemand über deine öffentliche Adresse auf deine Rechnung Videos erzeugen.

**Ergebnis sichern:** Der Video-Link kommt von Higgsfield und kann ablaufen. Clips, die du behalten willst, herunterladen.

**Per JARVIS starten:** Du kannst Videos auch im Chat auslösen — „Mach mir ein Video von Missy Truscott, langsamer Push-in auf der Bühne". JARVIS sucht den Athleten (tippfehlertolerant), nimmt das passende Bild und startet die Generierung. Weil das Minuten dauert, kommt der Aufruf sofort zurück und die Generierung läuft im Hintergrund weiter — auch wenn du den Tab wechselst oder die App neu lädst. Ist der Clip fertig, kommt eine Benachrichtigung und er erscheint im Video-Tab. Auf „Ist mein Video schon fertig?" antwortet JARVIS mit dem aktuellen Stand.

Da jede Generierung Geld kostet, startet JARVIS nur auf ausdrücklichen Wunsch und fragt bei unklarer Zuordnung nach, statt zu raten.

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

### Gedächtnis

JARVIS hat ein Langzeitgedächtnis, erreichbar über den Tab **Gedächtnis** neben dem Chat.

Der Unterschied zum Chat-Verlauf: der Verlauf ist ein rollierendes Fenster (die letzten 24 Nachrichten gehen an die API) und lässt sich löschen. Das Gedächtnis überlebt beides und wird bei **jeder** Anfrage in den System-Prompt eingebaut.

- JARVIS speichert von sich aus, was dauerhaft relevant ist — Vorlieben, wichtige Personen, Ziele, laufende Projekte. Solche Einträge sind mit „von JARVIS" markiert.
- Eigene Einträge lassen sich im Panel anlegen, bearbeiten und löschen.
- Wiederholte Fakten werden erkannt und aktualisiert statt doppelt gespeichert.
- Kategorien (Business, Vorliebe, Person, Ziel, Projekt, Fakt) und drei Wichtigkeitsstufen steuern, was zuerst in den Kontext kommt. Der Kontext-Block ist auf ~3.500 Zeichen gedeckelt, damit die Kosten nicht mitwachsen; alles darüber bleibt über `searchMemory` erreichbar.

**Gerätestand:** Das Gedächtnis liegt in localStorage, also pro Gerät getrennt — PC und Handy haben bis zur Supabase-Anbindung je einen eigenen Stand. Über **Export/Import** im Panel lässt sich ein Stand auf das andere Gerät übertragen.

**Austauschbarer Speicher:** Alles oberhalb von `src/lib/memory/backends.ts` spricht nur mit dem `MemoryBackend`-Interface. Supabase anzubinden heißt, eine weitere Implementierung zu registrieren — Store, Tools und UI bleiben unverändert.

### Obsidian als Speicherort

Statt im Browser kann das Gedächtnis direkt in deinem Obsidian-Vault liegen, als ganz normale Markdown-Datei.

**Einrichten:**
1. In Obsidian das Community-Plugin **Local REST API** installieren und aktivieren
2. In den Plugin-Einstellungen den API-Key kopieren
3. In der App: JARVIS → Gedächtnis → **Speicherort** aufklappen → Adresse, Key und Dateipfad eintragen → **Verbindung testen** → auf **Obsidian** umschalten

**Wie die Datei aussieht:** Eine Überschrift je Kategorie, darunter eine Aufzählung. Die Metadaten (ID, Wichtigkeit, Herkunft) stecken in einem HTML-Kommentar am Zeilenende, den Obsidian in der Vorschau ausblendet.

```markdown
## Person

- Rafael Zimmermann ist Coach und zahlt fürs Editing. <!-- ge:{"id":"…","imp":3,…} -->
```

**Du kannst mitschreiben:** Eine Zeile, die du selbst als `- Text` in die Datei tippst, hat keinen Kommentar — die App übernimmt sie beim nächsten Laden als neuen Eintrag. Notiz in Obsidian schreiben ist also ein gültiger Weg, JARVIS etwas mitzuteilen.

**Grenzen, die in der Praxis zählen:**
- Obsidian muss geöffnet sein, sonst gibt es keinen Server. Ist es zu, fällt die App automatisch auf „Dieses Gerät" zurück statt zu blockieren.
- Das Plugin serviert HTTPS mit einem **selbstsignierten Zertifikat**. Läuft die App über HTTPS (z.B. auf Vercel), musst du die Plugin-Adresse einmal direkt im Browser öffnen und das Zertifikat akzeptieren — sonst blockiert der Browser die Verbindung.
- Die HTTP-Variante des Plugins (Port 27123) lässt sich von einer HTTPS-Seite gar nicht ansprechen (Mixed Content).
- Realistisch ist das also der Speicher für den Rechner, auf dem Obsidian läuft — nicht fürs iPhone unterwegs. Dafür bleibt Supabase der Weg.

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
  lib/memory/
    types.ts          # Gedächtnis-Modell + MemoryBackend-Interface (Storage-Naht)
    backends.ts        # localStorage-Backend; Obsidian/Supabase docken hier an
    memory.ts           # Dedup, Suche, Kontext-Block, Export/Import
    memoryTools.ts       # rememberFact / searchMemory / forgetMemory für JARVIS
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
