// Capture the live RTDB into data/snapshot.json for safekeeping and to drive
// the app's static-first boot (see app.js boot()). Run with `npm run snapshot`.
//
// items/votes/settings are all world-readable, so this needs no credentials.
// Output is deep-key-sorted + pretty-printed so commits produce clean diffs.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DB = "https://ai-filmmaking-spectrum-default-rtdb.firebaseio.com";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "data", "snapshot.json");

function sortDeep(v) {
    if (Array.isArray(v)) return v.map(sortDeep);
    if (v && typeof v === "object") {
        return Object.fromEntries(
            Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]),
        );
    }
    return v;
}

async function fetchPath(path) {
    const res = await fetch(`${DB}/${path}.json`);
    if (!res.ok) throw new Error(`GET /${path}.json -> HTTP ${res.status}`);
    return res.json();
}

const [settings, items, votes] = await Promise.all([
    fetchPath("settings"),
    fetchPath("items"),
    fetchPath("votes"),
]);

const snapshot = {
    capturedAt: new Date().toISOString(),
    source: "ai-filmmaking-spectrum-default-rtdb.firebaseio.com",
    settings: sortDeep(settings),
    items: sortDeep(items),
    votes: sortDeep(votes),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");

const itemCount = Object.keys(items || {}).length;
const voteCount = Object.values(votes || {}).reduce(
    (n, group) => n + Object.keys(group || {}).length,
    0,
);
console.log(
    `Wrote ${OUT}\n  ${itemCount} items, ${voteCount} votes, settings ${JSON.stringify(settings)}`,
);
