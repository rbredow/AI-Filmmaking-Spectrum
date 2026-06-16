# CLAUDE.md

Guidance for working in this repo (AI Filmmaking Spectrum).

## What this is

A real-time collaborative voting graph: users drag dots to rate AI filmmaking
tools on "Utility vs. Readiness," and a consensus dot shows the live average.
**Plain static site — no build step, no framework, no bundler.** Vanilla ES6
modules + Firebase Realtime Database (RTDB), served as static files.

- `index.html` — all markup, including every modal (username, vote-confirm,
  add/edit tool, reset, admin panel).
- `app.js` (~1900 lines) — **all** logic. Firebase init, auth, realtime
  listeners, rendering, drag/vote handling, label-overlap geometry.
- `style.css` — all styling.
- `privacy.html` — standalone privacy policy page.

## Run & deploy

- **Dev:** `npm run dev` → `http-server` on `http://localhost:8000`. No build.
  Just edit a file and reload.
- **Deploy:** push to `main` → **auto-deploys via GitHub Pages**. There is no
  staging. ⚠️ The app talks to a **live production Firebase database**, so a
  local dev session reads/writes real data shared with everyone. Don't run
  destructive flows (master reset, clear votes) casually.
- **Snapshot:** `npm run snapshot` (scripts/snapshot.mjs) captures the live RTDB
  into `data/snapshot.json` for safekeeping and to drive static-first boot.

## Static-first boot (no DB ping when voting is off)

`boot()` (app.js, top) fetches `data/snapshot.json` and branches:
- **Static mode** — when the snapshot's `settings.votingEnabled` is false: render
  the snapshot once and open **no** Firebase connection (no anon sign-in, no
  `onValue`, no RTDB websocket). `currentUser` stays null, which gates off every
  drag/vote/write path. (Google Analytics still loads — that's not the DB.)
- **Live mode** — when the snapshot says voting is open, the snapshot is
  missing/unreadable, OR the URL has `?live=1`: the normal path runs (anon auth +
  the three `onValue` listeners). **Admins must use `?live=1`** to get admin UI
  and writes; the in-app admin login reloads into `?live=1` automatically.

⚠️ The committed `data/snapshot.json` is the source of truth for static mode. When
you change voting state or want fresh data live on the site, **re-run
`npm run snapshot` and commit** — otherwise the deployed page serves stale frozen
data. Live mode reads RTDB directly and ignores the snapshot contents.

### Doing UI work? Read this first

- For **layout, labels, dot/tooltip styling, view-mode transitions** — plain
  `npm run dev` + `localhost:8000` is ideal. Static mode renders the real 32
  items / 92 votes identically to a live first-paint, with zero prod-DB writes.
- For **drag-to-vote, the vote-confirm flow, add/edit-tool, or admin UI** — these
  are inert in static mode (`currentUser` is null, voting/adding are off). Load
  `localhost:8000/?live=1` to exercise them. ⚠️ `?live=1` writes to the **live
  prod DB** — don't leave junk votes/tools around.
- Static first-paint waits on a `fetch` of `data/snapshot.json` before rendering;
  it lands well within the 2s `window.appLaunchTime` guard that suppresses
  entry animations / `triggerMegaSplash`, so timing matches live. If you add
  startup animation logic, sanity-check both `/` and `/?live=1`.

## Architecture (for UI work)

Render is driven (live mode) by RTDB listeners in `initApp()` (app.js:495):
`onValue` on `items`, `votes`, `settings` → the `applyItems`/`applyVotes`/
`applySettings` functions → re-render. Static mode calls those same apply
functions once from the snapshot (see "Static-first boot" above).
- `createItemElements()` (app.js:1070) — builds each tool's dot + **tooltip**
  (first render, uses `innerHTML`).
- `updateItemMetadata()` (app.js:1215) — live updates; uses `innerText` (safe).
- `updateGraphFromData()` (app.js:1533) — recomputes consensus + voter dots from
  all votes; main per-update render loop.
- `setupDrag()` (app.js:1257) — drag-to-vote; writes to `/votes`.
- `resolveAllLabelOverlaps()` (app.js:1800) — OBB-based label collision avoidance.
  Fiddly geometry; change carefully and eyeball the result.
- **View modes:** 2D (X/Y) and 1D (X only); ~3s animated transition.

## Data model (RTDB paths)

- `/items/{id}` — `{ name, desc, x, y, tags[], createdBy }`. World-readable.
- `/votes/{itemId}/{uid}` — `{ x, y, username }`. World-readable.
- `/settings` — `{ votingEnabled, addingEnabled }`. Admin-write only.

IDs for user-added tools are `"user_item_" + Date.now()`.

## Security & privacy — don't regress these

- **The Firebase config in app.js (apiKey etc.) is public by design.** The real
  access control is the **RTDB security rules**, configured in the Firebase
  console (NOT in this repo). Admin gating in JS (`isAdmin`, `ADMIN_EMAIL`,
  `updateAdminUI` app.js:490) is **cosmetic** — it only shows/hides UI; the rules
  enforce who can actually write.
- **XSS: any untrusted value rendered via `innerHTML` MUST go through
  `escapeHtml()` (app.js:58).** Tool name/desc/tags and voter usernames are
  user input broadcast to every client. The tooltip and voter-dot renders are
  already escaped — keep new `innerHTML` that includes these fields escaped, or
  prefer `textContent`/`innerText`.
- **Votes and chosen usernames are PUBLIC** and disclosed as such in
  `privacy.html` and the username/vote-confirm modals. Don't reintroduce
  "anonymous voting" copy — voting is pseudonymous and visible to all.

## Conventions

- ES module loaded via importmap in `index.html` (Firebase SDK pinned to 10.7.1
  on gstatic). No package install for runtime deps.
- Admin actions wired to `window.*` (e.g. `window.deleteItem`) for inline
  `onclick` handlers in generated tooltip HTML.
- Commit only when asked; pushing `main` deploys to production.
