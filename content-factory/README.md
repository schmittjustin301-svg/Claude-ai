# AI Content Factory — Phase 1 MVP

Bulk short-form video generation: upload a library of Hook / Main Content / CTA
clips, auto-generate hundreds of unique combinations, render them server-side
with ffmpeg, and review the results in a dashboard.

This is **Phase 1** of the platform described in the original brief (auth,
dashboard, clip library, combination engine, rendering, preview, export).
Phases 2–4 (Jarvis AI categorization, captions/hashtags, social publishing,
analytics, A/B testing) are architected for but not built yet — see
[Roadmap](#roadmap--whats-not-built-yet) below.

## Architecture

```
content-factory/
  apps/
    api/      Express + TypeScript + Prisma (Postgres) + BullMQ (Redis)
              REST API: auth, projects, clips, combinations, videos, dashboard
    worker/   BullMQ consumer that renders videos with ffmpeg
    web/      React + Vite + TypeScript + Tailwind v4 dashboard UI
  packages/
    shared/   Shared TypeScript types/DTOs used by web and api
  docker-compose.yml   Postgres + Redis for local dev
```

**Why a separate render worker instead of rendering inline in the API?**
ffmpeg jobs can take from seconds to minutes. The API enqueues a `RenderJob`
into a BullMQ/Redis queue and returns immediately; the worker process (which
can be scaled independently, or run on a machine with more CPU) picks jobs
off the queue and renders them. This is what keeps the website responsive
under load, per the brief's requirement for async rendering.

### Where your files live

Everything sits under one folder — `content-factory/storage/` by default,
set by `STORAGE_ROOT` (the API and worker must point at the same place).
It's laid out to be browsable by hand in Explorer or Finder:

```
storage/
  road-to-olympia/                one folder per project, named after it
    hooks/
      why-your-legs-wont-grow.mp4
      12-week-transformation.mp4
    main/
      squat-depth-breakdown.mp4
      the-diet-nobody-follows.mp4
    cta/
      follow-for-more.mp4
      link-in-bio.mp4
    broll/
    outro/
    finished/                     ← ready-to-post videos
      12-week-transformation__the-diet-nobody-follows__link-in-bio__d4bff7ea.mp4
      why-your-legs-wont-grow__volume-beats-weight__comment-plan__b4d575d5.mp4
  _thumbnails/                    preview images (app-internal)
  _incoming/                      upload staging, empties itself
```

Clips are named after the clip, not by id, so the folders mean something on
their own. A finished video is named after the three clips it was built
from — `hook__main__cta__id` — so you can tell what any file is without
opening the app. The trailing id keeps names unique when the same
combination of names recurs; duplicates within a folder get `-2`, `-3`.

**Moving a clip between categories in the UI moves the file on disk**, and
renaming a clip renames its file, so the folders never drift out of sync
with the library.

To put the storage somewhere else — an external drive, say — point
`STORAGE_ROOT` at it in both `apps/api/.env` and `apps/worker/.env`. Paths
in the database are relative to that root, so the whole tree can be moved
as long as both processes agree on where it is.

Storage is a local-disk adapter (`apps/api/src/lib/storage.ts` /
`apps/worker/src/storage.ts`). Swapping to S3/GCS later means rewriting
those two modules — no caller changes.

### Data model

Every generated video keeps a hard link back to the exact clips that made
it, which is the whole point of the platform (component-level performance
analysis in later phases):

```
Clip (HOOK | MAIN | CTA | BROLL | OUTRO)
  └─ Combination (hookClipId, mainClipId, ctaClipId, brollClipId?, outroClipId?)
       └─ GeneratedVideo (status, outputPath, caption, hashtags)
            └─ RenderJob (queue status, progress, error)
```

See `apps/api/prisma/schema.prisma` for the full schema.

### Combination engine

`apps/api/src/lib/combinationEngine.ts` is a pure function (no DB access —
easy to unit test) that:

1. Computes the possible combination space (`hooks × mains × ctas`).
2. If `allowRepeats` is false, caps the requested count at what's actually
   available (existing combinations in the project count against that cap,
   so re-running "generate 150" never recreates a combo you already have).
3. Weighted-randomly picks hook → main → cta. When `usePriorityWeighting` is
   on, higher-priority clips (set per-clip, 1–10) get picked more often. When
   `useTagAffinity` is on, a main/cta clip sharing a tag with the
   hook/main gets a weight boost — e.g. a hook tagged `transformation` is
   preferentially paired with a main clip also tagged `transformation`.
4. Optional B-roll/outro are attached at random from their pools if provided
   (not part of the uniqueness key — only hook/main/cta define a "unique
   combination", matching the brief's combinatorics).

### Rendering pipeline

`apps/worker/src/ffmpegPipeline.ts`: for each combination, concatenates
`hook → main → [broll] → cta → [outro]` into one 1080×1920 MP4 using a single
ffmpeg `filter_complex` graph — each input is scaled+cropped to fill the
vertical frame (cover-fit, keeps subjects centered/safe) and the audio tracks
are concatenated and loudness-normalized (`loudnorm`).

The poster is the video's **first frame** — what a viewer sees when the post
loads — with the **hook's name set in Anton across the lower third**, since
the hook is what the video is about. The headline steps down through four
sizes to fit inside four lines; a word wider than the line shrinks the type
rather than being broken mid-word (`apps/worker/src/posterText.ts`).

Two things keep the subject visible:

- **The type sits low, not centred.** In a 9:16 reel the face is in the
  upper-middle, so centred text lands straight on it. The headline is
  centred horizontally but anchored to the bottom, clearing
  `BOTTOM_SAFE_MARGIN` (400px of 1920) so Instagram's and TikTok's own
  overlays don't cover it. Extra lines grow upward, never downward.
- **A gradient scrim instead of a flat dim.** Only the bottom ~60% darkens,
  ramping in smoothly, so the face keeps its original brightness while the
  type stays readable over whatever is behind it.

Anton ships in `assets/fonts/` because ffmpeg's `drawtext` needs a real font
file on disk and Anton is not installed on a typical host — bundling it means
identical posters on every machine. Override with `POSTER_FONT_PATH` to use a
different typeface.

> If your source clips fade in from black, so will the poster. Shift
> `FIRST_FRAME_AT` in `ffmpegPipeline.ts` to grab slightly later.

## Known limitations (read before demoing)

- **Clips must have an audio track.** The filtergraph references `[i:a]` for
  every input; a silent clip will fail the render (status flips to `FAILED`
  with the ffmpeg error attached, it won't crash the worker). Adding a
  silent-audio fallback for music-only/no-audio clips is a good next task.
- **Hard cuts only** — no crossfade transitions, captions/subtitles, burned-in
  text overlays, logos, or background music *in the video itself* yet. (The
  poster image does get an Anton headline; the video frames do not.) The brief
  lists these under "Automatic Video Editing"; they're real scope on their own
  and are Phase 2 work once the core pipeline is proven out.
- **No trimming** — the full duration of each clip is used as uploaded.
- Local-disk storage only (fine for one server; swap `storage.ts` for S3 to
  scale beyond one machine).
- Single render worker process by default (`RENDER_CONCURRENCY` env var
  controls in-process concurrency; run multiple worker processes/containers
  to scale further).

## Setup

This runs on your own computer. Three things need to be installed first:

| | Windows | macOS | Linux |
|---|---|---|---|
| **Node 20+** | [nodejs.org](https://nodejs.org) installer | `brew install node` | `apt install nodejs npm` |
| **Docker Desktop** (runs Postgres + Redis) | [docker.com](https://docker.com/products/docker-desktop) | same | `apt install docker.io docker-compose-v2` |
| **ffmpeg + ffprobe** (does the rendering) | `winget install Gyan.FFmpeg` | `brew install ffmpeg` | `apt install ffmpeg` |

Check ffmpeg landed correctly — both must print a version:

```bash
ffmpeg -version
ffprobe -version
```

Then, once (Docker Desktop must be running):

```bash
cd content-factory
npm install

cp .env.example apps/api/.env
cp .env.example apps/worker/.env    # same values — must share STORAGE_ROOT
cp .env.example apps/web/.env       # only VITE_API_PROXY_TARGET is read

npm run setup     # starts Postgres + Redis, creates the database schema
```

And every time you want to use it:

```bash
npm run dev       # starts API + render worker + web UI together
```

Then open **http://localhost:5173**. Ctrl-C stops all three.

<details>
<summary>Running the three processes separately (for debugging)</summary>

```bash
npm run dev:api      # http://localhost:4000
npm run dev:worker   # picks up render jobs from Redis
npm run dev:web      # http://localhost:5173
npm run db:generate  # regenerate the Prisma client after a schema change
```
</details>

Open `http://localhost:5173`, register an account, create a project, and:

1. **Content Library** — upload clips, drag them between Hook / Main / CTA /
   B-Roll / Outro columns, tag them.
2. **Video Generator** — set a target count (e.g. 150), toggle smart tag
   matching / priority weighting / allow-repeats, generate. Select
   combinations (or "render all pending") to enqueue rendering.
3. **Videos** — watch status move `QUEUED → RENDERING → READY` (polls every
   4s while jobs are in flight), preview, edit caption/hashtags, download,
   regenerate, or delete.
4. **Dashboard** — clip/combination/video counts and status breakdown for
   the active project.

## Roadmap — what's not built yet

Per the original brief's own phase ordering:

- **Phase 2**: Jarvis AI clip auto-categorization from a natural-language
  description; AI-generated platform-specific captions/hashtags; full
  Campaign entity (this MVP's `Project` is the simplified stand-in);
  content calendar.
- **Phase 3**: Instagram/TikTok/YouTube Shorts OAuth + publishing APIs. The
  `GeneratedVideo` model already has `status: SCHEDULED | PUBLISHED` and a
  `caption`/`hashtags` fields ready for this; a `SocialAccount` /
  `PublishedPost` table pair needs adding to the schema.
  publishing calendar UI.
- **Phase 4**: cross-platform analytics ingestion, per-component (hook/main/
  cta) performance rollups, AI recommendation assistant, automated A/B
  testing.

None of these can be wired up without real API credentials/accounts
(Meta/TikTok/YouTube developer apps, an LLM API key for Jarvis) — the
architecture above is built so adding them is additive, not a rewrite.
