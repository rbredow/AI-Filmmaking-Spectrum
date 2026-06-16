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

## Architecture (for UI work)

Render is driven by RTDB listeners in `initApp()` (app.js:435):
`onValue` on `items`, `votes`, `settings` → re-render.
- `createItemElements()` (app.js:999) — builds each tool's dot + **tooltip**
  (first render, uses `innerHTML`).
- `updateItemMetadata()` (app.js:1144) — live updates; uses `innerText` (safe).
- `updateGraphFromData()` (app.js:1462) — recomputes consensus + voter dots from
  all votes; main per-update render loop.
- `setupDrag()` (app.js:1186) — drag-to-vote; writes to `/votes`.
- `resolveAllLabelOverlaps()` (app.js:1729) — OBB-based label collision avoidance.
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
  `updateAdminUI` app.js:430) is **cosmetic** — it only shows/hides UI; the rules
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
