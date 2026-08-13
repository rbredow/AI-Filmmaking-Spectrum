# AI Filmmaking Spectrum

A real-time, collaborative interactive graph for visualizing the "Utility vs. Readiness" of AI tools in filmmaking.

You can [view the project online here](https://rbredow.github.io/AI-Filmmaking-Spectrum/)

## Features

### 1. Interactive Graph
*   **Real-time Voting:** Users drag dots to vote on where they believe a tool sits on the spectrum.
*   **Consensus Engine:** The main colored dot represents the live average of all active votes.
*   **Personal Vote:** Your vote is visualized as a blue ring connected to the consensus dot by a dashed line.
*   **Live Updates:** Changes propagate instantly to all connected clients with smooth animations.

### 2. View Modes
*   **2D View:** The standard X/Y graph (Utility vs. Readiness).
    *   *Top ("Ready") items* have labels pointing down-right.
    *   *Bottom ("Not Ready") items* have labels floating above.
*   **1D View:** A simplified spectrum (Utility only).
    *   Dots flatten to the center line.
    *   Voting only affects the X-axis (preserving the Y-value from previous votes).
    *   Transition between views is a smooth 3-second animation.

### 3. Tool Management
*   **Add New Tool:** Users can propose new tools via the "+" button (top right).
*   **Dynamic Metadata:** Tooltips show concise stats (`Gen: 88% | Ready: 44%`) and your personal vote.

### 4. Admin Suite
*   **Hidden Access:** Login via `/?admin=true`.
*   **Google Auth:** Restricted to specific admin accounts.
*   **Master Controls:**
    *   **Edit:** Rename or change descriptions of tools.
    *   **Reset Votes:** Two modes:
        *   *Bake Consensus:* Sets current average as the new default start.
        *   *Revert:* Wipes votes and returns to original/baked default.
    *   **Delete:** Remove tools entirely.
    *   **Master Reset:** Wipe the entire database and restore original seed data.

## Technical Stack
*   **Frontend:** Vanilla JS (ES6), HTML5, CSS3.
*   **Backend:** Google Firebase Realtime Database.
*   **Auth:** Firebase Anonymous Auth (for voters) & Google Auth (for Admin).
*   **Hosting:** Local static server (for dev).

## Development & Setup

1. **Clone repository.**
2. **Install / Run locally:**
   ```bash
   npm run dev
   ```
   *Runs `http-server` on `http://localhost:8000`.*

## Database Backup & Snapshotting

The app includes a built-in snapshot tool to back up the live Firebase Realtime Database and freeze data for static viewing:

```bash
npm run snapshot
```

### What this does:
* **Pulls live data:** Fetches all `/items`, `/votes`, and `/settings` directly from the production Firebase Realtime Database via read-only REST endpoints (no credentials required).
* **Saves locally:** Writes a pretty-printed, deep-key-sorted JSON file to `data/snapshot.json`.
* **Drives static mode:** When voting is closed (`votingEnabled: false`), visitors to GitHub Pages view `data/snapshot.json` directly without establishing open database WebSocket connections.

> **Tip:** Always run `npm run snapshot` and commit the updated `data/snapshot.json` after concluding a live voting session or before performing administrative resets.

## Firebase Quota Note
* **Free Tier (Spark):** Limited to **100 concurrent connections**.
* **Recommendation:** For an audience >100, upgrade to **Blaze Plan** (Pay-as-you-go). Cost is negligible for this data volume, but it removes the connection cap.
