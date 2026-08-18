// Data access layer, RTDB synchronization, snapshot boot, and mutations
import {
    ref,
    set,
    update,
    remove,
    onValue,
} from "firebase/database";
import { db, firebaseConfig } from "../config/firebase.js";
import { state, setState } from "../state/app-state.js";
import { initialItems, ACADEMY_BRANCHES } from "../config/constants.js";
import { showToast } from "../ui/toast.js";

export const LOCAL_PREVIEW_UID = "local-mobile-preview";

export function allowProductionMutation() {
    if (!state.isStaticMode) return true;
    showToast(
        state.isLocalPreviewMode
            ? "Local preview — production changes are disabled"
            : "Changes are unavailable in static mode",
    );
    return false;
}

export async function fetchBootConfig() {
    const [snapshot, liveSettings] = await Promise.all([
        fetch("./data/snapshot.json", { cache: "no-cache" })
            .then((r) => (r.ok ? r.json() : null))
            .catch((e) => {
                console.warn("Snapshot unavailable.", e);
                return null;
            }),
        fetch(firebaseConfig.databaseURL + "/settings.json", { cache: "no-cache" })
            .then((r) => (r.ok ? r.json() : null))
            .catch((e) => {
                console.warn("Live voting-state check failed.", e);
                return null;
            }),
    ]);

    return { snapshot, liveSettings };
}

export function setPreviewVote(itemId, vote, onUpdateGraph) {
    const nextVotes = JSON.parse(JSON.stringify(state.previousData || {}));
    if (!nextVotes[itemId]) nextVotes[itemId] = {};
    nextVotes[itemId][LOCAL_PREVIEW_UID] = vote;
    setState({ previousData: nextVotes });
    if (onUpdateGraph) {
        onUpdateGraph(nextVotes);
    }
}

export function saveVote(itemId, vote, onUpdateGraph = null) {
    if (state.isLocalPreviewMode) {
        setPreviewVote(itemId, vote, onUpdateGraph);
        return Promise.resolve();
    }
    if (!state.currentUser) return Promise.reject(new Error("No user logged in"));
    return set(ref(db, `votes/${itemId}/${state.currentUser.uid}`), vote);
}

export async function saveItem(item) {
    if (!allowProductionMutation()) return;
    return set(ref(db, `items/${item.id}`), item);
}

export async function deleteItem(id) {
    if (!allowProductionMutation()) return;
    await Promise.all([
        remove(ref(db, `items/${id}`)),
        remove(ref(db, `votes/${id}`)),
    ]);
}

export async function resetItemVotes(id, mode, currentAvg = null) {
    if (!allowProductionMutation()) return;
    if (mode === "bake" && currentAvg) {
        const itemRef = ref(db, `items/${id}`);
        await update(itemRef, {
            x: Math.round(currentAvg.x * 10) / 10,
            y: Math.round(currentAvg.y * 10) / 10,
        });
    }
    await remove(ref(db, `votes/${id}`));
}

export async function globalBakeConsensus(itemsCache, computeConsensusFn) {
    if (!allowProductionMutation()) return;
    const updates = {};
    Object.keys(itemsCache).forEach((id) => {
        const item = itemsCache[id];
        const consensus = computeConsensusFn(item, state.previousData[id]);
        updates[`items/${id}/x`] = Math.round(consensus.x * 10) / 10;
        updates[`items/${id}/y`] = Math.round(consensus.y * 10) / 10;
    });
    updates["votes"] = null;
    await update(ref(db), updates);
}

export async function globalClearVotes() {
    if (!allowProductionMutation()) return;
    await remove(ref(db, "votes"));
}

export async function globalNuke() {
    if (!allowProductionMutation()) return;
    const updates = {};
    updates["votes"] = null;
    updates["items"] = null;
    initialItems.forEach((item) => {
        updates[`items/${item.id}`] = item;
    });
    await update(ref(db), updates);
}

export async function migrateDefaultTags(itemsCache) {
    if (!allowProductionMutation()) return;
    const initialMap = {};
    initialItems.forEach((i) => {
        initialMap[i.id] = i.tags || [];
    });

    const updates = {};
    let count = 0;
    Object.keys(itemsCache).forEach((id) => {
        const currentItem = itemsCache[id];
        if (currentItem && (!currentItem.tags || currentItem.tags.length === 0)) {
            const defaultTags = initialMap[id] || [];
            if (defaultTags.length > 0) {
                updates[`items/${id}/tags`] = defaultTags;
                count++;
            }
        }
    });

    if (count > 0) {
        await update(ref(db), updates);
        showToast(`Migrated tags for ${count} items.`);
    } else {
        showToast("All items already have tags.");
    }
}

export async function updateSettings(settings) {
    if (!allowProductionMutation()) return;
    return update(ref(db, "settings"), settings);
}

export function subscribeData({ applyItems, applyVotes, applySettings }) {
    if (state.isStaticMode) {
        const snap = state.staticSnapshot || {};
        applyItems(snap.items || null);
        applyVotes(snap.votes || {});
        applySettings(snap.settings || null);
    } else {
        onValue(ref(db, "items"), (snapshot) => applyItems(snapshot.val()));
        onValue(ref(db, "votes"), (snapshot) => applyVotes(snapshot.val() || {}));
        onValue(ref(db, "settings"), (snapshot) => applySettings(snapshot.val()));
    }
}
