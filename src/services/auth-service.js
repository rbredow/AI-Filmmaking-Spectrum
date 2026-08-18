// Authentication, anonymous voter sessions, and username state management
import {
    auth,
    googleProvider,
    db,
} from "../config/firebase.js";
import {
    signInAnonymously,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
} from "firebase/auth";
import { ref, update } from "firebase/database";
import { ADMIN_EMAIL } from "../config/constants.js";
import { state, setState } from "../state/app-state.js";
import { generateDefaultUsername } from "../core/formatters.js";

export function ensureDisplayName() {
    if (!state.userDisplayName) {
        let storedName = "";
        let confirmed = false;
        if (typeof localStorage !== "undefined") {
            storedName = localStorage.getItem("voter_name") || "";
            confirmed = !!localStorage.getItem("voter_name_confirmed");
        }
        const name = storedName || generateDefaultUsername();
        setState({
            userDisplayName: name,
            hasConfirmedName: confirmed,
        });
    }
    updateUsernameUI();
}

export function updateUsernameUI() {
    const nameSpan = document.getElementById("current-username");
    if (nameSpan) nameSpan.innerText = state.userDisplayName;
}

export async function setUsername(newName) {
    if (!newName) return;
    setState({
        userDisplayName: newName,
        hasConfirmedName: true,
    });
    if (typeof localStorage !== "undefined") {
        localStorage.setItem("voter_name", newName);
        localStorage.setItem("voter_name_confirmed", "true");
    }
    updateUsernameUI();
    await updateAllUserVotes(newName);
}

export async function updateAllUserVotes(newName, updateGraphCallback = null) {
    if (!state.currentUser) return;

    if (state.isLocalPreviewMode) {
        const LOCAL_PREVIEW_UID = "local-mobile-preview";
        const nextVotes = JSON.parse(JSON.stringify(state.previousData || {}));
        Object.values(nextVotes).forEach((votes) => {
            if (votes?.[LOCAL_PREVIEW_UID]) {
                votes[LOCAL_PREVIEW_UID].username = newName;
            }
        });
        setState({ previousData: nextVotes });
        if (updateGraphCallback) {
            updateGraphCallback(nextVotes);
        }
        return;
    }

    const updates = {};
    let hasUpdates = false;

    for (const [itemId, votes] of Object.entries(state.previousData || {})) {
        if (votes && votes[state.currentUser.uid]) {
            updates[`votes/${itemId}/${state.currentUser.uid}/username`] = newName;
            hasUpdates = true;
        }
    }

    if (hasUpdates) {
        try {
            await update(ref(db), updates);
        } catch (e) {
            console.error("Failed to update usernames on votes", e);
        }
    }
}

export function initAuth({ onUserReady } = {}) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const isAdmin = user.email === ADMIN_EMAIL;
            setState({
                currentUser: user,
                isAdmin,
            });
            ensureDisplayName();
            if (onUserReady) onUserReady(user, isAdmin);
        } else {
            signInAnonymously(auth).catch((e) => console.error("Anon Auth failed", e));
        }
    });
}

export async function loginAdmin() {
    return signInWithPopup(auth, googleProvider);
}
