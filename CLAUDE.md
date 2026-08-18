# AGENTS.md

Guidance for working in this repo (AI Filmmaking Spectrum).

## What this is

A real-time collaborative voting graph: users drag dots to rate AI filmmaking
tools on "Utility vs. Readiness," and a consensus dot shows the live average.
**Plain static site — no build step, no framework, no bundler.** Vanilla ES6
modules + Firebase Realtime Database (RTDB), served as static files.

- `index.html` — all markup, including every modal (username, vote-confirm,
  add/edit tool, reset, admin panel).
- `src/` — modular ES6 application code:
  - `src/main.js` — bootstrap and application coordination.
  - `src/config/` — `constants.js` (colors, thresholds, seed items), `firebase.js` (SDK handles).
  - `src/core/` — pure logic modules: `coords.js` (plotting & projections), `consensus.js` (averaging), `clustering.js` (collision detection & fan-out), `colors.js` (spectrum interpolation), `formatters.js` (labels, XSS escaping), `timeline-engine.js` (timestamp inference).
  - `src/state/` — `app-state.js` (observable state store).
  - `src/services/` — `auth-service.js` (auth & usernames), `data-service.js` (RTDB & snapshot loader).
  - `src/ui/` — `graph-renderer.js`, `drag-controller.js`, `mobile-gestures.js`, `tool-panel.js`, `highlight.js`, `modals.js`, `timeline-ui.js`, `onboarding.js`, `toast.js`.
- `style.css` — all styling.
- `privacy.html` — standalone privacy policy page.

## Run, test & deploy

- **Dev:** `npm run dev` → `http-server` on `http://localhost:8000`. No build. Just edit and reload.
- **Test:** `npm test` → Vitest suite testing coordinate conversions, consensus math, cluster fan-out, gesture thresholds, and data isolation.
- **Deploy:** push to `main` → **auto-deploys via GitHub Pages**. There is no
  staging. ⚠️ The app talks to a **live production Firebase database**, so a
  local dev session reads/writes real data shared with everyone. Don't run
  destructive flows (master reset, clear votes) casually.
- **Snapshot:** `npm run snapshot` (scripts/snapshot.mjs) captures the live RTDB
  into `data/snapshot.json` for safekeeping and to render the closed-voting
  (static) view.

## Boot: live when voting is open, snapshot when it's closed

`boot()` (src/main.js) makes ONE read-only REST GET of the live `/settings`
("is voting open?") and branches:
- **Live mode** — voting is open (or `?live=1`, or the live check failed but the
  snapshot's flag says open): the normal path runs (anon sign-in + the three
  `onValue` listeners on items/votes/settings).
- **Static mode** — voting is closed: render `data/snapshot.json` once and open
  **no** further Firebase connection (no `onValue`, no RTDB websocket).
  `currentUser` stays null, which gates off every drag/vote/write path.

Notes:
- The `/settings` REST read is world-readable + CORS-enabled, so it's a cheap
  (~tens of bytes) check on every load — NOT a websocket. The snapshot fetch and
  this settings check run in parallel.
- `?live=1` always forces live; admins use it for admin UI + writes, and the
  in-app admin login reloads into `?live=1`.
- `?preview=1` loads the committed snapshot in local preview mode: dragging and
  voting are functional on the client with zero writes to production Firebase.

⚠️ The committed `data/snapshot.json` is what static (voting-closed) visitors see.
After you **close** a voting session, **re-run `npm run snapshot` and commit** to freeze the final
tally into the static view.

### Doing UI work? Read this first

- For **layout, labels, dot/tooltip styling, view-mode transitions** — plain
  `npm run dev` + `localhost:8000` is ideal. Static mode renders the real 32
  items / 92 votes identically to a live first-paint, with zero prod-DB writes.
- For **drag-to-vote, the vote-confirm flow, add/edit-tool, or admin UI** — these
  can be tested safely in local preview mode (`localhost:8000/?preview=1`) with zero prod DB writes.
  Or load `localhost:8000/?live=1` to exercise production live writes.
- Static first-paint waits on a `fetch` of `data/snapshot.json` before rendering;
  it lands well within the 2s `window.appLaunchTime` guard that suppresses
  entry animations / `triggerMegaSplash`, so timing matches live.

## Architecture

Render is driven by RTDB listeners (in live mode) or single snapshot application (in static mode):
- `createItemElements()` (src/ui/graph-renderer.js) — builds each tool's dot + tooltip.
- `updateItemMetadata()` (src/ui/graph-renderer.js) — live updates using `innerText`/`textContent`.
- `updateGraphFromData()` (src/ui/graph-renderer.js) — recomputes consensus + voter dots from all votes.
- `setupDrag()` (src/ui/drag-controller.js) — drag-to-vote coordinator for desktop and mobile.
- `setupMobileGraphInteractions()` (src/ui/mobile-gestures.js) — pinch zoom, panning, and cluster fan-out.
- **View modes:** 2D (X/Y) and 1D (X only); ~3s animated transition.

## Interface layout — graph + tool-detail panel (desktop & mobile)

The page is `#header` above `#main-layout`, a flex container holding two
siblings: `#graph-container` (the scatter) and `#tool-panel` (a scrollable list of every tool).

- **Wide (desktop/landscape):** `#main-layout` is a row — graph (flex-grow) on
  the left, `#tool-panel` (~340px) on the right, each its own height.
- **Portrait (`max-width:600px`):** `#main-layout` is a column — graph pinned to
  the top (~48dvh), panel fills the rest. On mobile, `html,body` are
  `height:100dvh; overflow:hidden` so **the body never scrolls — only
  `#tool-panel` scrolls internally** (`overflow-y:auto`, `min-height:0`).

**Panel rows** are built by `renderToolPanel()` (src/ui/tool-panel.js). Each row is `#panel-row-<id>` with `data-item-id`, showing name,
two metric bars (Generative=x, Readiness=y) + %, description, and tag chips.

**Readiness bar color** is a SOLID color from the value via `readinessColor(y)`
(src/core/colors.js), interpolating the same spectrum as the y-axis
(0% `#ff3d00` red → 50% `#ffea00` yellow → 100% `#00e676` green).

**Highlight (bidirectional locator)** — `highlightItem(id)` / `clearHighlight()`
(src/ui/highlight.js) add `.highlighted` to `dot-<id>` and `.row-active` to its row.

**Typography — one 5-step token scale.** All font sizes come from `:root` vars in
`style.css`: `--fs-xs:12 / --fs-sm:14 / --fs-base:16 / --fs-lg:18 / --fs-xl:24` (px).

## Data model (RTDB paths)

- `/items/{id}` — `{ name, desc, x, y, tags[], createdBy }`. World-readable.
- `/votes/{itemId}/{uid}` — `{ x, y, username }`. World-readable.
- `/settings` — `{ votingEnabled, addingEnabled }`. Admin-write only.

IDs for user-added tools are `"user_item_" + Date.now()`.

## Security & privacy

- **Firebase config:** public by design; security is enforced by RTDB rules.
- **XSS:** untrusted values rendered via `innerHTML` must go through `escapeHtml()` (src/core/formatters.js).
- **Public data:** votes and usernames are public.
