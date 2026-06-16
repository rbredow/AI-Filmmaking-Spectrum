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
  into `data/snapshot.json` for safekeeping and to render the closed-voting
  (static) view.

## Boot: live when voting is open, snapshot when it's closed

`boot()` (app.js, top) makes ONE read-only REST GET of the live `/settings`
("is voting open?") and branches:
- **Live mode** — voting is open (or `?live=1`, or the live check failed but the
  snapshot's flag says open): the normal path runs (anon sign-in + the three
  `onValue` listeners on items/votes/settings). So **flipping voting on in the
  admin panel takes effect for new visitors immediately — no redeploy needed.**
- **Static mode** — voting is closed: render `data/snapshot.json` once and open
  **no** further Firebase connection (no `onValue`, no RTDB websocket).
  `currentUser` stays null, which gates off every drag/vote/write path.

Notes:
- The `/settings` REST read is world-readable + CORS-enabled, so it's a cheap
  (~tens of bytes) check on every load — NOT a websocket. The snapshot fetch and
  this settings check run in parallel.
- `?live=1` always forces live; admins use it for admin UI + writes, and the
  in-app admin login reloads into `?live=1`.
- Google Analytics still loads in both modes — that's not the DB. Firebase Auth
  may also do one `accounts:lookup` to refresh a *persisted* anon session from a
  prior live visit; it does NOT set `currentUser` in static mode, so writes stay
  gated.

⚠️ The committed `data/snapshot.json` is what static (voting-closed) visitors see.
It no longer gates live mode — only the closed-state display. After you **close**
a voting session, **re-run `npm run snapshot` and commit** to freeze the final
tally into the static view; otherwise closed-state visitors see the last
committed snapshot, not the latest results.

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
functions once from the snapshot (see "Boot" above).
- `createItemElements()` (app.js:1070) — builds each tool's dot + **tooltip**
  (first render, uses `innerHTML`).
- `updateItemMetadata()` (app.js:1215) — live updates; uses `innerText` (safe).
- `updateGraphFromData()` (app.js:1533) — recomputes consensus + voter dots from
  all votes; main per-update render loop.
- `setupDrag()` (app.js:1257) — drag-to-vote; writes to `/votes`.
- `resolveAllLabelOverlaps()` (app.js:1800) — OBB-based label collision avoidance.
  Fiddly geometry; change carefully and eyeball the result.
- **View modes:** 2D (X/Y) and 1D (X only); ~3s animated transition.

## Interface layout — graph + tool-detail panel (desktop & mobile)

The page is `#header` above `#main-layout`, a flex container holding two
siblings: `#graph-container` (the scatter) and `#tool-panel` (a scrollable list
of every tool). **Put nothing new INSIDE `#graph-container` in index.html** —
`initApp()` rebuilds that element's inner scaffold via `container.innerHTML`
(~app.js:529, the axis labels + `#top-right-controls`), wiping static children.
The panel lives OUTSIDE the graph for this reason.

- **Wide (desktop/landscape):** `#main-layout` is a row — graph (flex-grow) on
  the left, `#tool-panel` (~340px) on the right, each its own height.
- **Portrait (`max-width:600px`):** `#main-layout` is a column — graph pinned to
  the top (~48dvh), panel fills the rest. On mobile, `html,body` are
  `height:100dvh; overflow:hidden` so **the body never scrolls — only
  `#tool-panel` scrolls internally** (`overflow-y:auto`, `min-height:0`). This is
  deliberate: tapping a dot must scroll the panel while the graph stays put.

**Panel rows** are built by `renderToolPanel()` (module scope), called at the end
of `applyItems`. Each row is `#panel-row-<id>` with `data-item-id`, showing name,
two metric bars (Generative=x, Readiness=y) + %, description, and tag chips. Live
consensus updates the bars/numbers inside `updateGraphFromData` (ids
`bar-gen-<id>` / `bar-ready-<id>` / `num-*`) — it does NOT rebuild the list.

**Readiness bar color** is a SOLID color from the value via `readinessColor(y)`
(near `updateDotColor`), interpolating the same spectrum as the y-axis
(0% `#ff3d00` red → 50% `#ffea00` yellow → 100% `#00e676` green). Set inline as
`background-color`; the `.panel-metric-bar-ready` CSS must stay gradient-free or
it paints over. Generative bar stays blue. If you add a gradient back, the solid
color breaks.

**Highlight (bidirectional locator)** — `highlightItem(id)` / `clearHighlight()`
(module scope) add `.highlighted` to `dot-<id>` and `.row-active` to its row.
Hovering a panel row (desktop `mouseenter`) or tapping/clicking a dot highlights;
tapping a dot ALSO `scrollIntoView({behavior:'smooth', block:'center'})` on its
row so you watch the list fly to it. The tap path is `setupTapTooltip()`
(touchend) + a desktop `click` handler on each dot.
- ⚠️ The highlight must enlarge the dot via **width/height + box-shadow ring,
  NOT `transform: scale()`**. The `.dot-label` is a child of the dot, so a scale
  transform balloons the rotated label (a fixed + reverted regression). Keep
  `.dot.highlighted { transform: translate(-50%,50%) }` (base centering only).

**Typography — one 5-step token scale.** All font sizes come from `:root` vars in
`style.css`: `--fs-xs:12 / --fs-sm:14 / --fs-base:16 / --fs-lg:18 / --fs-xl:24`
(px). Rules:
- Use a token for every `font-size`; **no raw px/rem and no inline `font-size`**
  (the only exception is the `#add-item-btn { font-size:0 }` + `::before
  { font-size:20px }` "+" icon glyph hack). Don't reintroduce inline sizes in
  modals/tooltips.
- **12px is the floor** — nothing readable smaller (axis labels included; they
  used to drop to 6–8px on mobile).
- Roles: `xl`=page title (desktop; `lg` on mobile); `lg`=tool/section names
  (panel row name, tooltip title, modal h3); `base`=inputs/buttons/tooltip body;
  `sm`=descriptions, %, voter chip, header links; `xs`=axis labels, tags, metric
  mini-labels, dot labels.
- One font family (Segoe UI stack); weights 400/600/700.

For UI verification, drive the browser via chrome-devtools MCP at 1440×900
(desktop), 390×844 (portrait), 844×390 (landscape). Static mode (`localhost:8000`)
renders the real 32 items, so layout/fonts/panel match live with zero prod-DB
writes.

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
