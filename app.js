import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
    getDatabase,
    ref,
    set,
    update,
    remove,
    onValue,
} from "firebase/database";
import {
    getAuth,
    signInAnonymously,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
} from "firebase/auth";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBUyM6Ep-hY6wQthp8IBo5wg0qHqMBlwek",
    authDomain: "ai-filmmaking-spectrum.firebaseapp.com",
    databaseURL: "https://ai-filmmaking-spectrum-default-rtdb.firebaseio.com",
    projectId: "ai-filmmaking-spectrum",
    storageBucket: "ai-filmmaking-spectrum.firebasestorage.app",
    messagingSenderId: "384429643425",
    appId: "1:384429643425:web:66f5fd3c2bd52ccd6702e0",
    measurementId: "G-7WXWDMKW8R",
};

// --- INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// --- STATE ---
window.appLaunchTime = Date.now();
let currentUser = null;
let isAdmin = false;
let votingEnabled = true;
let addingEnabled = true;
let isDragging = null;
let isConfirmingVote = false; // Prevent interactions during confirmation
let previousData = {};
let itemsCache = {}; // Local cache of items for weighted calculations
let svgLayer = null;
let renderedItems = new Set();
let viewMode = "2D"; // Default to 2D View
let isOnboardingActive = false;
let onboardingStep = 0;
let hasLoadedInitialVotes = false;
let baselineSnapshot = null;
let latestLiveVotes = null;
let isTimelineOpen = false;
let isTimelinePlaying = false;
let timelineAnimationId = null;
let timelineMinTime = 0;
let timelineMaxTime = 0;
let currentTimelineTimestamp = 0;
let visibleItemIdsAtCurrentTime = new Set();
let lastScrubDirection = 1;
let lastScrubTimestamp = 0;
const ADMIN_EMAIL = "rob.bredow@gmail.com";

// Escape user-supplied text before interpolating into innerHTML.
// Tool names, descriptions, tags, and voter usernames are untrusted input
// that gets broadcast to every other client, so they must never be treated
// as markup (prevents stored XSS).
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[ch]));
}

let userDisplayName = "";
let hasConfirmedName = false;
const FADE_TIME = 5000; // 5 seconds
const INITIAL_SHOW_TIME = 8000; // 8 seconds on launch

// --- MOBILE DETECTION ---
const isTouchDevice = () =>
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;
const isMobile = () => window.innerWidth <= 600;
const isMobileGraphExperience = () =>
    isTouchDevice() &&
    (window.innerWidth <= 600 ||
        (window.innerHeight <= 500 && window.innerWidth <= 1000));

const MOBILE_FAN_THRESHOLD = 32;
const MOBILE_DRAG_THRESHOLD = 12;
let mobileFanItemIds = [];
let mobileGraphTapStart = null;
let mobileLabelClampFrame = null;

const COLORS = [
    "Pink",
    "Blue",
    "Green",
    "Yellow",
    "Purple",
    "Orange",
    "Red",
    "Teal",
    "Indigo",
    "Cyan",
    "Lime",
    "Amber",
    "Deep-Purple",
    "Light-Blue",
    "Silver",
    "Gold",
];
const ANIMALS = [
    "Giraffe",
    "Hippo",
    "Zebra",
    "Lion",
    "Tiger",
    "Elephant",
    "Penguin",
    "Koala",
    "Panda",
    "Fox",
    "Wolf",
    "Bear",
    "Eagle",
    "Owl",
    "Shark",
    "Dolphin",
    "Whale",
    "Octopus",
];

const ACADEMY_BRANCHES = [
    "Actors",
    "Animation",
    "Artist Representatives",
    "Casting Directors",
    "Cinematographers",
    "Costume Designers",
    "Directors",
    "Documentary",
    "Executives",
    "Film Editors",
    "Makeup Artists and Hairstylists",
    "Marketing and Public Relations",
    "Music",
    "Producers",
    "Production and Technology",
    "Production Design",
    "Short Films",
    "Sound",
    "Visual Effects",
    "Writers",
    "Members-at-Large",
    "Associates"
];

let selectedTags = new Set();


function generateDefaultUsername() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${color}-${animal}-${num}`;
}

// --- INITIAL DATA SEED ---
const initialItems = [
    {
        id: "d01",
        name: "Denoising",
        x: 4,
        y: 98,
        desc: "Mathematical pixel cleanup. Standard in every render engine.",
        tags: ["Visual Effects", "Production and Technology"]
    },
    {
        id: "d02",
        name: "Script Breakdown",
        x: 10,
        y: 96,
        desc: "Scans text to tag props, cast, & scenes automatically.",
        tags: ["Writers", "Directors", "Producers"]
    },
    {
        id: "d03",
        name: "Upscaling",
        x: 16,
        y: 94,
        desc: "Topaz/Nvidia. Essential for remastering archival footage.",
        tags: ["Visual Effects", "Film Editors"]
    },
    {
        id: "d04",
        name: "Audio Separation",
        x: 22,
        y: 92,
        desc: "Splitting vocals from music (stems). Industry standard.",
        tags: ["Sound", "Music"]
    },
    {
        id: "d05",
        name: "Rotoscoping",
        x: 28,
        y: 90,
        desc: "Magic Mask. Automating cutouts. 90% perfect, 10% manual fix.",
        tags: ["Visual Effects", "Animation"]
    },
    {
        id: "d06",
        name: "Auto-Captions",
        x: 34,
        y: 95,
        desc: "Speech-to-text. Integrated into Premiere/DaVinci.",
        tags: ["Film Editors", "Sound"]
    },
    {
        id: "d07",
        name: "Color Match",
        x: 38,
        y: 85,
        desc: "Matching Camera A colors to Camera B automatically.",
        tags: ["Cinematographers", "Visual Effects"]
    },
    {
        id: "d08",
        name: "Text-Based Edit",
        x: 44,
        y: 88,
        desc: "Edit video by deleting words in the transcript.",
        tags: ["Film Editors", "Directors"]
    },
    {
        id: "d09",
        name: "Markerless Mocap",
        x: 48,
        y: 80,
        desc: "Move.ai/Wonder Studio. Video -> 3D Animation.",
        tags: ["Animation", "Visual Effects", "Actors"]
    },
    {
        id: "d10",
        name: "Voice Cloning",
        x: 54,
        y: 75,
        desc: "ElevenLabs. Tone is great, acting performance needs human guiding.",
        tags: ["Sound", "Actors"]
    },
    {
        id: "d11",
        name: "NeRF / Splatting",
        x: 60,
        y: 70,
        desc: "Scanning real locations into 3D space for Virtual Production.",
        tags: ["Visual Effects", "Production Design", "Cinematographers"]
    },
    {
        id: "d12",
        name: "Lip-Sync / Dub",
        x: 62,
        y: 60,
        desc: "Altering mouth movement. Can look 'uncanny' on closeups.",
        tags: ["Sound", "Actors", "Visual Effects"]
    },
    {
        id: "d13",
        name: "In-painting",
        x: 68,
        y: 70,
        desc: "Removing objects. Great for still shots, struggles with motion.",
        tags: ["Visual Effects"]
    },
    {
        id: "d14",
        name: "AI Storyboard",
        x: 74,
        y: 85,
        desc: "Midjourney. High readiness for concepts, but Low utility for final pixel.",
        tags: ["Directors", "Producers", "Production Design", "Writers", "Cinematographers"]
    },
    {
        id: "d15",
        name: "Gen Fill (Bg)",
        x: 78,
        y: 55,
        desc: "Extending sets. Hard to maintain temporal consistency.",
        tags: ["Visual Effects", "Production Design"]
    },
    {
        id: "d16",
        name: "Text-to-SFX",
        x: 82,
        y: 60,
        desc: "Generating foley or background music. Good for filler.",
        tags: ["Sound"]
    },
    {
        id: "d17",
        name: "Text-to-3D",
        x: 88,
        y: 40,
        desc: "Generating 3D props. Topology usually needs manual cleanup.",
        tags: ["Animation", "Visual Effects", "Production Design"]
    },
    {
        id: "d18",
        name: "Text-to-Video",
        x: 94,
        y: 25,
        desc: "Sora/Gen-3. Dream-like visuals. Physics/Continuity break.",
        tags: ["Directors", "Visual Effects", "Animation"]
    },
    {
        id: "d19",
        name: "Text-to-Movie",
        x: 98,
        y: 5,
        desc: "One button to make a film. Pure fantasy right now.",
        tags: ["Directors", "Producers", "Writers"]
    },
];

function showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// --- BOOTSTRAP ----------------------------------------------------------
// On load we ask one cheap, read-only question of the LIVE database: "is
// voting open?" (a single REST GET of /settings, ~tens of bytes, no websocket).
//   - Voting OPEN  -> go live: anon sign-in + the three RTDB onValue listeners,
//                     so everyone sees real-time data the moment voting starts,
//                     with no redeploy needed.
//   - Voting CLOSED -> render the committed snapshot (data/snapshot.json) once
//                     and open no further Firebase connection. currentUser stays
//                     null, which gates off every drag/vote/write path.
//   - ?preview=1    -> render that same snapshot with an in-memory local voter so
//                     the full drag/confirm UI can be reviewed without DB writes.
// If the live check can't be reached we fall back to the snapshot's own flag,
// so a network hiccup never strands us. ?live=1 always forces the live path.
let isStaticMode = false;
let staticSnapshot = null;
let isLocalPreviewMode = false;
const LOCAL_PREVIEW_UID = "local-mobile-preview";

function ensureDisplayName() {
    // Reuse a previously chosen name (for display only — voting needs live mode)
    if (!userDisplayName) {
        userDisplayName =
            localStorage.getItem("voter_name") || generateDefaultUsername();
        hasConfirmedName = !!localStorage.getItem("voter_name_confirmed");
    }
    updateUsernameUI();
}

async function boot() {
    const params = new URLSearchParams(window.location.search);
    const forceLive = params.has("live");
    const forcePreview = params.has("preview");

    // Fetch the committed snapshot (static data) and the LIVE voting flag in
    // parallel. The settings read is a single read-only REST GET, not a
    // websocket, so it's cheap enough to run on every load. Each tolerates its
    // own failure (-> null) without rejecting the Promise.all.
    const [snapshot, liveSettings] = await Promise.all([
        fetch("./data/snapshot.json", { cache: "no-cache" })
            .then((r) => (r.ok ? r.json() : null))
            .catch((e) => { console.warn("Snapshot unavailable.", e); return null; }),
        fetch(firebaseConfig.databaseURL + "/settings.json", { cache: "no-cache" })
            .then((r) => (r.ok ? r.json() : null))
            .catch((e) => { console.warn("Live voting-state check failed.", e); return null; }),
    ]);
    baselineSnapshot = snapshot;

    // Prefer the live voting flag. If it couldn't be read, fall back to the
    // snapshot's own flag so a hiccup never strands us in the wrong mode.
    const votingOpen =
        liveSettings != null
            ? liveSettings.votingEnabled === true
            : !!(snapshot && snapshot.settings && snapshot.settings.votingEnabled);

    // Preview always stays on the committed snapshot, even if production voting
    // happens to open while a phone review is in progress.
    if (forcePreview) {
        if (!snapshot) {
            console.error("Local preview requires data/snapshot.json.");
            showToast("Preview unavailable — snapshot missing");
            return;
        }
        startStatic(snapshot, true);
        return;
    }

    // Go live when forced, when voting is open, or when there is no snapshot to
    // fall back on. Otherwise serve the committed snapshot frozen.
    if (forceLive || votingOpen || !snapshot) {
        startLive();
    } else {
        startStatic(snapshot);
    }
}

function startLive() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            isAdmin = user.email === ADMIN_EMAIL;
            updateAdminUI();
            ensureDisplayName();
            initApp();

            // Remove initial-load class after data has likely settled
            setTimeout(() => {
                document.body.classList.remove("initial-load");
            }, 2000);
        } else {
            signInAnonymously(auth).catch((e) => console.error("Anon Auth failed", e));
        }
    });
}

function startStatic(snapshot, enablePreview = false) {
    // No Firebase auth. Normal static mode keeps currentUser null; preview uses
    // a local-only identity whose writes are intercepted below. Admins use
    // ?live=1 to manage production.
    isStaticMode = true;
    isLocalPreviewMode = enablePreview;
    staticSnapshot = snapshot;
    baselineSnapshot = snapshot;
    isAdmin = false;
    currentUser = enablePreview ? { uid: LOCAL_PREVIEW_UID } : null;
    votingEnabled = enablePreview || !!(snapshot.settings && snapshot.settings.votingEnabled);
    addingEnabled = !!(snapshot.settings && snapshot.settings.addingEnabled);
    updateAdminUI();
    ensureDisplayName();
    initApp();
    if (enablePreview) {
        setTimeout(() => showToast("Local preview — nothing is published"), 250);
    }
    setTimeout(() => {
        document.body.classList.remove("initial-load");
    }, 2000);
}

boot();

function updateUsernameUI() {
    const nameSpan = document.getElementById("current-username");
    if (nameSpan) nameSpan.innerText = userDisplayName;
}

async function updateAllUserVotes(newName) {
    if (!currentUser) return;
    if (isLocalPreviewMode) {
        const nextVotes = JSON.parse(JSON.stringify(previousData));
        Object.values(nextVotes).forEach((votes) => {
            if (votes?.[LOCAL_PREVIEW_UID]) {
                votes[LOCAL_PREVIEW_UID].username = newName;
            }
        });
        updateGraphFromData(nextVotes, document.getElementById("graph-container"));
        return;
    }
    const updates = {};
    let hasUpdates = false;

    // previousData contains all votes: { itemId: { uid: { x, y, username } } }
    for (const [itemId, votes] of Object.entries(previousData)) {
        if (votes[currentUser.uid]) {
            updates[`votes/${itemId}/${currentUser.uid}/username`] = newName;
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

function setPreviewVote(itemId, vote) {
    const nextVotes = JSON.parse(JSON.stringify(previousData));
    if (!nextVotes[itemId]) nextVotes[itemId] = {};
    nextVotes[itemId][LOCAL_PREVIEW_UID] = vote;
    updateGraphFromData(nextVotes, document.getElementById("graph-container"));
}

function removePreviewVote(itemId) {
    const nextVotes = JSON.parse(JSON.stringify(previousData));
    if (nextVotes[itemId]) {
        delete nextVotes[itemId][LOCAL_PREVIEW_UID];
        if (!Object.keys(nextVotes[itemId]).length) delete nextVotes[itemId];
    }
    updateGraphFromData(nextVotes, document.getElementById("graph-container"));
}

function saveVote(itemId, vote) {
    if (isLocalPreviewMode) {
        setPreviewVote(itemId, vote);
        return Promise.resolve();
    }
    return set(ref(db, "votes/" + itemId + "/" + currentUser.uid), vote);
}

function updateVoteName(itemId, username) {
    if (isLocalPreviewMode) {
        const vote = previousData[itemId]?.[LOCAL_PREVIEW_UID];
        if (vote) setPreviewVote(itemId, { ...vote, username });
        return Promise.resolve();
    }
    return update(ref(db, "votes/" + itemId + "/" + currentUser.uid), {
        username,
    });
}

function deleteVote(itemId) {
    if (isLocalPreviewMode) {
        removePreviewVote(itemId);
        return Promise.resolve();
    }
    return remove(ref(db, "votes/" + itemId + "/" + currentUser.uid));
}

function showUsernamePrompt() {
    const modal = document.getElementById("username-modal");
    const input = document.getElementById("username-input");
    const submitBtn = document.getElementById("username-submit-btn");

    if (modal && input && submitBtn) {
        modal.style.display = "flex";
        input.value = userDisplayName;
        input.focus();
        input.select();

        submitBtn.onclick = async () => {
            const val = input.value.trim();
            if (val) {
                userDisplayName = val;
                hasConfirmedName = true;
                localStorage.setItem("voter_name", userDisplayName);
                localStorage.setItem("voter_name_confirmed", "true");
                modal.style.display = "none";
                updateUsernameUI();
                await updateAllUserVotes(val);
            }
        };

        // Also handle 'Enter' key
        input.onkeydown = (e) => {
            if (e.key === "Enter") submitBtn.click();
        };

        const adminTrigger = document.getElementById("admin-login-trigger");
        if (adminTrigger) {
            adminTrigger.onclick = () => {
                signInWithPopup(auth, googleProvider).then(() => {
                    modal.style.display = "none";
                    showToast("Logged in successfully. Reloading...");
                    // Reload into live mode so admin controls + writes work even
                    // when the committed snapshot has voting frozen.
                    setTimeout(() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set("live", "1");
                        window.location.href = url.toString();
                    }, 800);
                }).catch((error) => {
                    console.error(error);
                    alert("Login Failed: " + error.message);
                });
            };
        }
    } else {
        // Fallback if elements not found
        initApp();
    }
}

function updateAdminUI() {
    const resetBtn = document.getElementById("global-reset-btn");
    if (resetBtn) resetBtn.style.display = isAdmin ? "block" : "none";
}

function initApp() {
    const container = document.getElementById("graph-container");

    // Setup toggle button logic
    const toggleBtn = document.getElementById("view-mode-btn");
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            clearMobileFan();
            if (viewMode === "2D") {
                viewMode = "1D";
                toggleBtn.innerText = "1D";
                container.classList.add("mode-1d");
            } else {
                viewMode = "2D";
                toggleBtn.innerText = "2D";
                container.classList.remove("mode-1d");
            }
        };
    }

    container.innerHTML = `
        <div class="y-axis-gradient"></div>
        <div class="grid-line grid-x" style="bottom: 50%"></div>
        <div class="grid-line grid-y" style="left: 50%"></div>
        <div class="axis-label x-label-left">← Algorithmic / Utility</div>
        <div class="axis-label x-label-right">Generative / Creative →</div>
        <div class="axis-label y-label-top">Ready</div>
        <div class="axis-label y-label-bottom">Not Ready</div>
        <div id="top-right-controls">
            <div id="add-item-btn" title="Add New Tool">+ New Tool</div>
            <div id="view-mode-btn" title="Toggle 1D/2D View">2D</div>
            <div id="timeline-btn" title="Open Voting History Timeline & Playback">Timeline</div>
            <div id="branch-filter-container">
                <div id="branch-filter-btn" title="Filter by Branch">Branch ▾</div>
                <div id="branch-filter-dropdown" style="display: none;"></div>
            </div>
            <div id="search-container">
                <span id="search-icon">🔍</span>
                <input type="search" id="search-input" placeholder="Search..." enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            </div>
        </div>
        <!-- TIMELINE SCRUBBER OVERLAY -->
        <div id="timeline-bar" class="timeline-bar" style="display: none;">
            <div class="timeline-controls-left">
                <button id="timeline-play-btn" class="timeline-ctrl-btn" title="Play / Pause Timeline">
                    <svg class="timeline-play-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <svg class="timeline-pause-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                </button>
                <div class="timeline-date-display">
                    <span id="timeline-date-label">Today</span>
                    <span id="timeline-sub-label" class="timeline-sub-label">Live</span>
                </div>
            </div>
            <div class="timeline-slider-wrapper">
                <div class="timeline-track-bg">
                    <div id="timeline-progress-fill" class="timeline-progress"></div>
                </div>
                <div id="timeline-activity-markers" class="timeline-markers"></div>
                <input type="range" id="timeline-slider" min="0" max="100" value="100" step="0.1" aria-label="Voting History Timeline" />
            </div>
            <div class="timeline-controls-right">
                <button id="timeline-live-btn" class="timeline-live-pill active" title="Jump to Current Live Consensus">
                    <span class="live-pulse-dot"></span>
                    <span>LIVE</span>
                </button>
                <button id="timeline-close-btn" class="timeline-close-btn" title="Close Timeline">✕</button>
            </div>
        </div>
        <div id="onboarding-overlay" class="onboarding-overlay" style="display: none;">
            <div id="onboard-word-x-left" class="onboard-hero-word x-left">ALGORITHMIC</div>
            <div id="onboard-word-x-right" class="onboard-hero-word x-right">CREATIVE</div>
            
            <div id="onboard-x-spectrum-line" class="onboard-spectrum-line x-spectrum">
                <svg class="spectrum-arrow-svg arrow-left" width="16" height="24" viewBox="0 0 16 24" aria-hidden="true">
                    <path d="M14 3 L3 12 L14 21" fill="none" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="spectrum-line-bar bar-x"></div>
                <svg class="spectrum-arrow-svg arrow-right" width="16" height="24" viewBox="0 0 16 24" aria-hidden="true">
                    <path d="M2 3 L13 12 L2 21" fill="none" stroke="#60a5fa" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>

            <div id="onboard-word-y-top" class="onboard-hero-word y-top">READY</div>
            <div id="onboard-word-y-bottom" class="onboard-hero-word y-bottom">NOT READY</div>

            <div id="onboard-y-spectrum-line" class="onboard-spectrum-line y-spectrum">
                <svg class="spectrum-arrow-svg arrow-top" width="24" height="16" viewBox="0 0 24 16" aria-hidden="true">
                    <path d="M3 14 L12 3 L21 14" fill="none" stroke="#00e676" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="spectrum-line-bar bar-y"></div>
                <svg class="spectrum-arrow-svg arrow-bottom" width="24" height="16" viewBox="0 0 24 16" aria-hidden="true">
                    <path d="M3 2 L12 13 L21 2" fill="none" stroke="#ff3d00" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>

            <div id="onboard-card-1" class="onboard-sample-card">
                <div class="sample-card-header">
                    <span class="sample-badge badge-algorithmic">Utility</span>
                    <div class="sample-dot ready-high" id="sample-dot-1"><span class="dot-number">1</span></div>
                </div>
                <div class="sample-name">Denoising Sound</div>
            </div>
            <div id="onboard-card-2" class="onboard-sample-card">
                <div class="sample-card-header">
                    <span class="sample-badge badge-middle">In-Between</span>
                    <div class="sample-dot ready-mid" id="sample-dot-2"><span class="dot-number">2</span></div>
                </div>
                <div class="sample-name">Character In-Betweening</div>
            </div>
            <div id="onboard-card-3" class="onboard-sample-card">
                <div class="sample-card-header">
                    <span class="sample-badge badge-creative">Generative</span>
                    <div class="sample-dot ready-low" id="sample-dot-3"><span class="dot-number">3</span></div>
                </div>
                <div class="sample-name">Idea to Script</div>
            </div>
        </div>
    `;
    renderedItems.clear();

    // Re-bind Toggle (since we wiped innerHTML)
    document.getElementById("view-mode-btn").onclick = () => {
        const btn = document.getElementById("view-mode-btn");
        clearMobileFan();
        if (viewMode === "2D") {
            viewMode = "1D";
            btn.innerText = "1D";
            container.classList.add("mode-1d");
        } else {
            viewMode = "2D";
            btn.innerText = "2D";
            container.classList.remove("mode-1d");
        }
    };

    // Setup Timeline Controls
    const timelineBtn = document.getElementById("timeline-btn");
    if (timelineBtn) {
        timelineBtn.onclick = () => {
            if (isTimelineOpen) closeTimeline();
            else openTimeline();
        };
    }

    const timelinePlayBtn = document.getElementById("timeline-play-btn");
    if (timelinePlayBtn) {
        timelinePlayBtn.onclick = () => {
            if (isTimelinePlaying) pauseTimeline();
            else playTimeline();
        };
    }

    const timelineSlider = document.getElementById("timeline-slider");
    if (timelineSlider) {
        timelineSlider.oninput = (e) => {
            pauseTimeline();
            const pct = parseFloat(e.target.value) || 0;
            applyTimelinePosition(pct, { fromSliderInput: true });
        };
    }

    const timelineLiveBtn = document.getElementById("timeline-live-btn");
    if (timelineLiveBtn) {
        timelineLiveBtn.onclick = () => jumpToLive();
    }

    const timelineCloseBtn = document.getElementById("timeline-close-btn");
    if (timelineCloseBtn) {
        timelineCloseBtn.onclick = () => closeTimeline();
    }

    const sliderWrapper = container.querySelector(".timeline-slider-wrapper");
    if (sliderWrapper) {
        sliderWrapper.addEventListener("pointermove", (e) => {
            const markers = sliderWrapper.querySelectorAll(".timeline-marker");
            let hoveredMarker = null;
            markers.forEach((m) => {
                const rect = m.getBoundingClientRect();
                const dist = Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
                if (dist < 14) {
                    hoveredMarker = m;
                }
            });
            markers.forEach((m) => {
                if (m === hoveredMarker) m.classList.add("hover");
                else m.classList.remove("hover");
            });
        });
        sliderWrapper.addEventListener("pointerleave", () => {
            const markers = sliderWrapper.querySelectorAll(".timeline-marker");
            markers.forEach((m) => m.classList.remove("hover"));
        });
    }

    // Re-bind Onboarding controls
    setupOnboardingEventListeners();


    // Setup Branch Filter Logic
    const branchBtn = document.getElementById("branch-filter-btn");
    const branchDropdown = document.getElementById("branch-filter-dropdown");
    if (branchBtn && branchDropdown) {
        branchDropdown.innerHTML = ACADEMY_BRANCHES.map(branch => `
            <label class="branch-checkbox-item">
                <input type="checkbox" value="${branch}">
                ${branch}
            </label>
        `).join('');

        branchBtn.onclick = (e) => {
            e.stopPropagation();
            const isVisible = branchDropdown.style.display === "block";
            branchDropdown.style.display = isVisible ? "none" : "block";
        };

        branchDropdown.onclick = (e) => e.stopPropagation();

        branchDropdown.querySelectorAll("input[type=checkbox]").forEach(cb => {
            cb.onchange = (e) => {
                if (e.target.checked) selectedTags.add(e.target.value);
                else selectedTags.delete(e.target.value);
                applyFilters({ scrollToTop: true });
            };
        });
        
        document.addEventListener("click", () => {
            branchDropdown.style.display = "none";
        });
    }

    // Setup Search Logic
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.oninput = () => applyFilters({ scrollToTop: true });
        searchInput.addEventListener("search", () => applyFilters({ scrollToTop: true }));
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                searchInput.blur();
            } else if (e.key === "Escape") {
                if (searchInput.value) {
                    searchInput.value = "";
                    applyFilters({ scrollToTop: true });
                }
                searchInput.blur();
            }
        });
    }

    svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.id = "connections-layer";
    svgLayer.setAttribute("viewBox", "0 0 100 100");
    svgLayer.setAttribute("preserveAspectRatio", "none");
    container.appendChild(svgLayer);
    setupMobileGraphInteractions(container);

    setupModalLogic();
    setupEditModalLogic();
    setupResetModalLogic();
    setupGlobalResetLogic();
    setupVoteConfirmModal();
    setupGlobalTouchHandlers();

    // Bind username click to modal
    const userDisplay = document.getElementById("user-display");
    if (userDisplay) userDisplay.onclick = () => showUsernamePrompt();

    // Data binding. The same apply* functions render both modes: in live mode
    // they are driven by RTDB onValue listeners; in static mode they run once
    // against the committed snapshot and no socket is ever opened.
    function applyItems(itemsData) {
        itemsCache = itemsData || {};
        if (!itemsData) {
            // Only seed the live DB when it is genuinely empty. Never write from
            // static mode — there is no auth and the snapshot is the source.
            if (isStaticMode) return;
            const updates = {};
            initialItems.forEach((item) => {
                updates["items/" + item.id] = item;
            });
            update(ref(db), updates);
        } else {
            Object.values(itemsData).forEach((item) => {
                if (!renderedItems.has(item.id)) {
                    createItemElements(container, item);
                    renderedItems.add(item.id);
                    if (renderedItems.size > initialItems.length + 1) {
                        triggerMegaSplash(container, item.x, item.y);
                    }
                } else {
                    updateItemMetadata(item);
                }
            });
            renderedItems.forEach((renderedId) => {
                if (!itemsData[renderedId]) {
                    removeItemElements(renderedId);
                    renderedItems.delete(renderedId);
                }
            });
        }
        // After items are created/updated, schedule label de-overlap
        scheduleResolveLabels();
        // Render / refresh the tool panel list
        renderToolPanel();
        if (isTimelineOpen) {
            buildTimelineData();
        }
    }

    function applyVotes(data) {
        latestLiveVotes = data;
        if (isTimelineOpen) {
            buildTimelineData();
            if (isAtLiveTimestamp()) {
                updateGraphFromData(data || {}, container);
            }
            return;
        }
        updateGraphFromData(data || {}, container);
    }

    function applySettings(settings) {
        const s = settings || { votingEnabled: true, addingEnabled: true };
        votingEnabled = isLocalPreviewMode || s.votingEnabled;
        addingEnabled = s.addingEnabled;

        const toggleVoting = document.getElementById("toggle-voting");
        const toggleAdding = document.getElementById("toggle-adding");
        if (toggleVoting) toggleVoting.checked = votingEnabled;
        if (toggleAdding) toggleAdding.checked = addingEnabled;

        // Visual feedback for disabled
        const addBtn = document.getElementById("add-item-btn");
        if (addBtn) {
            addBtn.style.opacity = addingEnabled ? "1" : "0.3";
            addBtn.style.cursor = addingEnabled ? "pointer" : "not-allowed";
        }

        // Update all existing tooltips' Edit button visibility
        renderedItems.forEach(id => {
            const editBtn = document.getElementById(`edit-btn-${id}`);
            if (editBtn) {
                editBtn.style.display = (addingEnabled || isAdmin) ? "block" : "none";
            }
        });
    }

    if (isStaticMode) {
        // Apply once, in dependency order: items (build dots) -> votes
        // (consensus needs itemsCache) -> settings (toggles/edit visibility).
        const snap = staticSnapshot || {};
        applyItems(snap.items || null);
        applyVotes(snap.votes || {});
        applySettings(snap.settings || null);
    } else {
        onValue(ref(db, "items"), (snapshot) => applyItems(snapshot.val()));
        onValue(ref(db, "votes"), (snapshot) => applyVotes(snapshot.val() || {}));
        onValue(ref(db, "settings"), (snapshot) => applySettings(snapshot.val()));
    }
}

// --- GLOBAL TOUCH/CLICK HANDLERS ---
function setupGlobalTouchHandlers() {
    // Close tooltips when clicking/tapping outside dots
    document.addEventListener("click", (e) => {
        // If hint is visible, clicking anywhere dismisses it
        const hint = document.getElementById("mode-hint");
        const btn = document.getElementById("view-mode-btn");
        if (hint && hint.classList.contains("visible")) {
            if (window.onboardingHideTimer) clearTimeout(window.onboardingHideTimer);
            hint.classList.remove("visible");
            if (btn) btn.classList.remove("hint-glow");
        }

        if (!e.target.closest(".dot") && !e.target.closest(".tooltip")) {
            closeAllTooltips();
        }
        // Clear highlight when clicking outside dots, tooltips, and panel rows
        if (!e.target.closest(".dot") && !e.target.closest(".tooltip") && !e.target.closest(".panel-row")) {
            clearHighlight();
        }
    });

    // Prevent pull-to-refresh on mobile while dragging
    document.addEventListener(
        "touchmove",
        (e) => {
            if (isDragging) {
                e.preventDefault();
            }
        },
        { passive: false },
    );

    // Handle orientation change
    window.addEventListener("orientationchange", () => {
        clearMobileFan();
        setTimeout(() => {
            closeAllTooltips();
        }, 100);
    });

    // Handle resize
    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            clearMobileFan();
            closeAllTooltips();
            if (isOnboardingActive) {
                ONBOARD_TOOLS.forEach((tool, index) => {
                    positionOnboardingCard(
                        document.getElementById(`onboard-card-${index + 1}`),
                        tool,
                        index,
                        onboardingStep === 2 ? 2 : 1,
                    );
                });
            }
        }, 250);
    });
}

function closeAllTooltips() {
    document.querySelectorAll(".dot.tooltip-active").forEach((d) => {
        d.classList.remove("tooltip-active");
    });
}

function setupModalLogic() {
    const modal = document.getElementById("new-item-modal");
    const addBtn = document.getElementById("add-item-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const submitBtn = document.getElementById("submit-btn");
    const sliderX = document.getElementById("new-item-x");
    const sliderY = document.getElementById("new-item-y");
    const valX = document.getElementById("slider-x-val");
    const valY = document.getElementById("slider-y-val");

    if (addBtn)
        addBtn.onclick = () => {
            if (!addingEnabled && !isAdmin) {
                showToast("Adding Closed");
                return;
            }
            
            const branchList = document.getElementById("new-item-branches");
            if (branchList) {
                branchList.innerHTML = ACADEMY_BRANCHES.map(branch => `
                    <label class="branch-checkbox-item">
                        <input type="checkbox" value="${branch}">
                        ${branch}
                    </label>
                `).join('');
            }
            
            modal.style.display = "flex";
            document.getElementById("new-item-name").focus();
        };
    if (cancelBtn) cancelBtn.onclick = () => (modal.style.display = "none");

    sliderX.oninput = () => (valX.innerText = sliderX.value);
    sliderY.oninput = () => (valY.innerText = sliderY.value);

    submitBtn.onclick = () => {
        const name = document.getElementById("new-item-name").value.trim();
        const desc = document.getElementById("new-item-desc").value.trim();
        const x = parseInt(sliderX.value);
        const y = parseInt(sliderY.value);
        if (!name) return alert("Please enter a name.");
        if (!addingEnabled && !isAdmin) {
            showToast("Adding Closed");
            modal.style.display = "none";
            return;
        }
        
        const selectedBranchInputs = document.querySelectorAll('#new-item-branches input:checked');
        const tags = Array.from(selectedBranchInputs).map(cb => cb.value);
        
        const newId = "user_item_" + Date.now();
        const newItem = {
            id: newId,
            name: name,
            desc: desc,
            x: x,
            y: y,
            createdBy: currentUser.uid,
            tags: tags,
        };
        set(ref(db, "items/" + newId), newItem);
        set(ref(db, "votes/" + newId + "/" + currentUser.uid), {
            x,
            y,
            username: userDisplayName,
        });
        modal.style.display = "none";
        document.getElementById("new-item-name").value = "";
        document.getElementById("new-item-desc").value = "";
    };
}

function setupEditModalLogic() {
    const modal = document.getElementById("edit-item-modal");
    const cancelBtn = document.getElementById("edit-cancel-btn");
    const submitBtn = document.getElementById("edit-submit-btn");

    if (cancelBtn) cancelBtn.onclick = () => (modal.style.display = "none");
    if (submitBtn) {
        submitBtn.onclick = () => {
            const id = document.getElementById("edit-item-id").value;
            const name = document.getElementById("edit-item-name").value.trim();
            const desc = document.getElementById("edit-item-desc").value.trim();
            
            const selectedBranchInputs = document.querySelectorAll('#edit-item-branches input:checked');
            const tags = Array.from(selectedBranchInputs).map(cb => cb.value);
            
            if (id && name) {
                const payload = { name, desc };
                if (tags.length > 0) {
                    payload.tags = tags;
                } else {
                    payload.tags = null;
                }
                update(ref(db, "items/" + id), payload)
                    .then(() => {
                        modal.style.display = "none";
                    })
                    .catch((error) => {
                        console.error("Save failed:", error);
                        alert("Save failed: " + error.message);
                    });
            }
        };
    }
}

function setupResetModalLogic() {
    const modal = document.getElementById("reset-options-modal");
    const btnBake = document.getElementById("btn-bake");
    const btnClear = document.getElementById("btn-clear");
    const btnCancel = document.getElementById("reset-cancel-btn");

    if (btnCancel) btnCancel.onclick = () => (modal.style.display = "none");

    btnBake.onclick = () => {
        const id = document.getElementById("reset-item-id").value;
        const dot = document.getElementById(`dot-${id}`);
        if (id && dot) {
            // Read current visual position (Consensus)
            const currentX = parseFloat(dot.dataset.realX);
            const currentY = parseFloat(dot.dataset.realY);

            // Update Item Baseline & Clear Votes
            update(ref(db, "items/" + id), { x: currentX, y: currentY });
            remove(ref(db, "votes/" + id));

            modal.style.display = "none";
        }
    };

    btnClear.onclick = () => {
        const id = document.getElementById("reset-item-id").value;
        if (id) {
            remove(ref(db, "votes/" + id));
            modal.style.display = "none";
        }
    };
}

function setupGlobalResetLogic() {
    const modal = document.getElementById("global-reset-modal");
    const btnOpen = document.getElementById("global-reset-btn");
    const btnBake = document.getElementById("btn-global-bake");
    const btnClearVotes = document.getElementById("btn-global-clear-votes");
    const btnNuke = document.getElementById("btn-global-nuke");
    const btnCancel = document.getElementById("global-cancel-btn");

    if (btnOpen) btnOpen.onclick = () => (modal.style.display = "flex");
    if (btnCancel) btnCancel.onclick = () => (modal.style.display = "none");

    const btnMigrate = document.getElementById("btn-migrate-tags");
    if (btnMigrate) {
        btnMigrate.onclick = () => {
            if (confirm("Apply default tags to all existing items? This won't delete any labels or votes, just adds missing branch tags.")) {
                const updates = {};
                Object.values(itemsCache).forEach(item => {
                    const defaultItem = initialItems.find(i => i.name.toLowerCase() === item.name.toLowerCase());
                    if (defaultItem && defaultItem.tags) {
                        // Merge or set tags if they don't exist
                        updates[`items/${item.id}/tags`] = defaultItem.tags;
                    }
                });
                update(ref(db), updates).then(() => {
                    showToast("Tags Migrated");
                    modal.style.display = "none";
                });
            }
        };
    }

    const toggleVoting = document.getElementById("toggle-voting");
    const toggleAdding = document.getElementById("toggle-adding");

    if (toggleVoting) {
        toggleVoting.onchange = () => {
            update(ref(db, "settings"), { votingEnabled: toggleVoting.checked });
        };
    }
    if (toggleAdding) {
        toggleAdding.onchange = () => {
            update(ref(db, "settings"), { addingEnabled: toggleAdding.checked });
        };
    }

    // 1. FACTORY RESET (Nuke)
    btnNuke.onclick = () => {
        if (
            confirm(
                "FINAL WARNING: This will delete ALL user created tools and revert to the original 19 items.",
            )
        ) {
            set(ref(db), {}).then(() => {
                const updates = {};
                initialItems.forEach((item) => {
                    updates["items/" + item.id] = item;
                });
                update(ref(db), updates);
                modal.style.display = "none";
                window.location.reload();
            });
        }
    };

    // 2. CLEAR VOTES (Keep Items)
    btnClearVotes.onclick = () => {
        if (
            confirm(
                "Clear all votes? Items will snap back to their default positions.",
            )
        ) {
            remove(ref(db, "votes"));
            modal.style.display = "none";
        }
    };

    // 3. BAKE CONSENSUS
    btnBake.onclick = () => {
        if (
            confirm(
                "Update all item defaults to their current positions and clear votes?",
            )
        ) {
            const updates = {};

            // Loop through all rendered items to capture their current DOM position (Consensus)
            renderedItems.forEach((id) => {
                const dot = document.getElementById(`dot-${id}`);
                if (dot) {
                    const currentX = parseFloat(dot.dataset.realX);
                    const currentY = parseFloat(dot.dataset.realY);

                    // We only update X/Y, we keep name/desc intact
                    updates[`items/${id}/x`] = currentX;
                    updates[`items/${id}/y`] = currentY;
                }
            });

            updates["votes"] = null;

            update(ref(db), updates);
            modal.style.display = "none";
        }
    };
}

function setupVoteConfirmModal() {
    const modal = document.getElementById("confirm-vote-modal");
    const cancelBtn = document.getElementById("vote-cancel-btn");
    const submitBtn = document.getElementById("vote-submit-btn");
    const nameInput = document.getElementById("confirm-vote-username-input");
    const nameSection = document.getElementById("confirm-vote-username-section");

    cancelBtn.onclick = () => {
        isConfirmingVote = false;
        modal.style.display = "none";
        if (modal.dataset.itemId && currentUser) {
            deleteVote(modal.dataset.itemId).catch((error) => {
                console.error("Could not remove vote", error);
            });
        }
    };

    submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        try {
            // If name input is visible, validate and save it
            if (nameSection.style.display !== "none") {
                const val = nameInput.value.trim();
                if (!val) {
                    alert("Please enter a username.");
                    return;
                }

                // Do not claim success until the server accepts the final name.
                if (modal.dataset.itemId && currentUser) {
                    await updateVoteName(modal.dataset.itemId, val);
                }

                userDisplayName = val;
                hasConfirmedName = true;
                localStorage.setItem("voter_name", userDisplayName);
                localStorage.setItem("voter_name_confirmed", "true");
                updateUsernameUI();
            }

            isConfirmingVote = false;
            modal.style.display = "none";
            showToast(
                isLocalPreviewMode
                    ? "✓ Preview updated — not published"
                    : "✓ Vote recorded",
            );
        } catch (error) {
            console.error("Could not confirm vote", error);
            showToast("Couldn’t confirm vote — try again");
        } finally {
            submitBtn.disabled = false;
        }
    };
}

function createItemElements(container, item) {
    const avgDot = document.createElement("div");
    avgDot.className = "dot" + (isOnboardingActive ? " onboarding-hidden" : "");
    avgDot.id = `dot-${item.id}`;
    updateElementPosition(avgDot, item.x, item.y);
    updateDotColor(avgDot, item.y);

    const numBadge = document.createElement("span");
    numBadge.className = "dot-number";
    numBadge.id = `dotnum-${item.id}`;
    avgDot.appendChild(numBadge);

    const label = document.createElement("div");
    label.className = "dot-label";
    label.id = `label-${item.id}`;
    const labelName = document.createElement("span");
    labelName.className = "dot-label-name";
    labelName.textContent = item.name;
    const labelValues = document.createElement("span");
    labelValues.className = "dot-label-values";
    labelValues.textContent = `G ${Math.round(item.x)} · R ${Math.round(item.y)}`;
    label.append(labelName, labelValues);
    updateLabelPosition(label, item.y);
    avgDot.appendChild(label);

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.id = `tooltip-${item.id}`;

    // NEW TOOLTIP STRUCTURE
    let html = `
        <div style="margin-bottom:2px;"><strong>${escapeHtml(item.name)}</strong></div>
        <div id="tags-${item.id}" style="font-size:var(--fs-xs); color:#3b82f6; margin-bottom:4px; font-weight:600;">
            ${item.tags && item.tags.length > 0 ? escapeHtml(item.tags.join(', ')) : ''}
        </div>
        <div id="desc-${item.id}" style="font-size:var(--fs-xs); color:#aaa; line-height:1.2; margin-bottom:4px;">${escapeHtml(item.desc)}</div>
        <div style="font-size:var(--fs-xs); color:#888;">
            <span style="color:#eee;">Generative: <b id="val-x-${item.id}">${Math.round(item.x)}</b>%</span>
            <span style="margin:0 4px; color:#444;">|</span>
            <span style="color:#eee;">Readiness: <b id="val-y-${item.id}">${Math.round(item.y)}</b>%</span>
            <span id="my-vote-${item.id}" style="margin-left:6px; color:#3b82f6; display:none;"></span>
        </div>
    `;

    html += `<div class="admin-controls">`;
    const canEdit = addingEnabled || isAdmin;
    html += `<div id="edit-btn-${item.id}" class="admin-btn" style="display: ${canEdit ? 'block' : 'none'}" onclick="window.editItem('${item.id}')">Edit</div>`;
    if (isAdmin) {
        html += `<div class="admin-btn" onclick="window.resetVotes('${item.id}')">Reset Votes</div>
                 <div class="admin-btn delete" onclick="window.deleteItem('${item.id}')">Delete</div>`;
    }
    html += `</div>`;

    tooltip.innerHTML = html;

    if (item.x > 80) {
        tooltip.style.left = "auto";
        tooltip.style.right = "0";
        tooltip.style.transform = "translateX(20px)";
    }
    if (item.x < 15) {
        tooltip.style.left = "0";
        tooltip.style.transform = "translateX(-20px)";
    }

    // For dots high on the chart, drop the tooltip BELOW the dot so it doesn't
    // spill off the top of the screen.
    if (item.y > 62) {
        tooltip.style.bottom = "auto";
        tooltip.style.top = "26px";
    }

    avgDot.appendChild(tooltip);
    container.appendChild(avgDot);

    const userDot = document.createElement("div");
    userDot.className = "user-dot";
    userDot.id = `user-dot-${item.id}`;

    // Proxy Hover Events for Tooltip (Class-based)
    userDot.onmouseenter = () => {
        if (isTouchDevice()) return;
        const avgDot = document.getElementById(`dot-${item.id}`);
        if (avgDot) avgDot.classList.add("force-tooltip");
    };
    userDot.onmouseleave = (e) => {
        if (isTouchDevice()) return;
        const avgDot = document.getElementById(`dot-${item.id}`);
        // Only remove if not moving to the avgDot itself
        if (
            avgDot &&
            e.relatedTarget !== avgDot &&
            !avgDot.contains(e.relatedTarget)
        ) {
            avgDot.classList.remove("force-tooltip");
        }
    };

    // Also handle leaving avgDot to not hide if entering userDot
    avgDot.onmouseleave = (e) => {
        if (isTouchDevice()) return;
        if (e.relatedTarget === userDot) {
            avgDot.classList.add("force-tooltip");
        } else {
            avgDot.classList.remove("force-tooltip");
        }
    };

    container.appendChild(userDot);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.id = `line-${item.id}`;
    line.setAttribute("class", "connection-line");
    line.style.display = "none";
    svgLayer.appendChild(line);

    setupDrag(avgDot, userDot, item, container);
    setupTapTooltip(avgDot, item);
}

// --- HIGHLIGHT HELPERS (bidirectional: dot <-> panel row) ---
let _currentHighlightId = null;

function highlightItem(id) {
    // Clear the previous highlight
    clearHighlight();
    _currentHighlightId = id;

    // Highlight the dot via class only — size/ring done in CSS via width/height + box-shadow,
    // NOT transform scale (which would balloon the child .dot-label).
    const dot = document.getElementById(`dot-${id}`);
    if (dot) {
        dot.classList.add("highlighted");
    }

    // Make label visible even on mobile
    const label = document.getElementById(`label-${id}`);
    if (label) label.classList.add("label-highlighted");

    // Highlight the panel row
    const row = document.getElementById(`panel-row-${id}`);
    if (row) row.classList.add("row-active");

    if (isMobileGraphExperience()) {
        scheduleMobileLabelClamp(document.getElementById("graph-container"));
    }
}

function clearHighlight() {
    if (_currentHighlightId) {
        const dot = document.getElementById(`dot-${_currentHighlightId}`);
        if (dot) {
            dot.classList.remove("highlighted");
        }
        const label = document.getElementById(`label-${_currentHighlightId}`);
        if (label) label.classList.remove("label-highlighted");
        const row = document.getElementById(`panel-row-${_currentHighlightId}`);
        if (row) row.classList.remove("row-active");
        _currentHighlightId = null;
    }
}

function mobileTruePoint(id, container) {
    const dot = document.getElementById(`dot-${id}`);
    if (!dot || !container) return null;
    const realX = parseFloat(dot.dataset.realX);
    const realY = parseFloat(dot.dataset.realY);
    if (!Number.isFinite(realX) || !Number.isFinite(realY)) return null;
    return {
        x: (plotPct(realX) / 100) * container.clientWidth,
        y:
            viewMode === "1D"
                ? container.clientHeight / 2
                : (1 - plotPct(realY) / 100) * container.clientHeight,
    };
}

function mobileDisplayedPoint(id, container) {
    const dot = document.getElementById(`dot-${id}`);
    if (!dot || !container) return null;
    const rect = dot.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
    };
}

function nearestMobileItem(clientX, clientY, container, ids, maxDistance = 52) {
    const containerRect = container.getBoundingClientRect();
    const x = clientX - containerRect.left;
    const y = clientY - containerRect.top;
    let nearest = null;
    let nearestDistance = maxDistance;

    ids.forEach((id) => {
        const dot = document.getElementById(`dot-${id}`);
        if (!dot || dot.classList.contains("onboarding-hidden")) return;
        const point = mobileDisplayedPoint(id, container);
        if (!point) return;
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < nearestDistance) {
            nearest = id;
            nearestDistance = distance;
        }
    });
    return nearest;
}

function mobileCollisionCluster(seedId, container) {
    const ids = [...renderedItems];
    const points = new Map(
        ids.map((id) => [id, mobileTruePoint(id, container)]),
    );
    const cluster = new Set([seedId]);
    const queue = [seedId];

    while (queue.length) {
        const currentId = queue.shift();
        const current = points.get(currentId);
        if (!current) continue;
        ids.forEach((candidateId) => {
            if (cluster.has(candidateId)) return;
            const candidate = points.get(candidateId);
            if (
                candidate &&
                Math.hypot(current.x - candidate.x, current.y - candidate.y) <=
                    MOBILE_FAN_THRESHOLD
            ) {
                cluster.add(candidateId);
                queue.push(candidateId);
            }
        });
    }

    return [...cluster].sort((a, b) =>
        (itemsCache[a]?.name || "").localeCompare(itemsCache[b]?.name || ""),
    );
}

function removeMobileFanGraphics() {
    if (!svgLayer) return;
    svgLayer
        .querySelectorAll(".mobile-fan-connector, .mobile-fan-origin")
        .forEach((element) => element.remove());
}

function layoutMobileFan(container) {
    if (!container || !mobileFanItemIds.length || !isMobileGraphExperience()) {
        return;
    }

    removeMobileFanGraphics();
    const points = mobileFanItemIds
        .map((id) => ({ id, point: mobileTruePoint(id, container) }))
        .filter(({ point }) => point);
    if (!points.length) return;

    container.classList.add("mobile-cluster-focus");
    let focusLabel = container.querySelector(".mobile-cluster-focus-label");
    if (!focusLabel) {
        focusLabel = document.createElement("div");
        focusLabel.className = "mobile-cluster-focus-label";
        container.appendChild(focusLabel);
    }
    focusLabel.textContent = `Cluster detail · ${points.length} tools`;

    // A compact grid gives every label a real horizontal cell. This behaves as
    // a local magnified view without changing the meaning of the chart axes.
    const columnLimit = 3;
    const rows = Math.ceil(points.length / columnLimit);
    const topY = rows === 1 ? container.clientHeight * 0.48 : Math.max(105, container.clientHeight * 0.3);
    const bottomY = Math.min(container.clientHeight - 92, container.clientHeight * 0.68);

    points.forEach(({ id, point }, index) => {
        const dot = document.getElementById(`dot-${id}`);
        if (!dot) return;
        const row = Math.floor(index / columnLimit);
        const rowStart = row * columnLimit;
        const rowCount = Math.min(columnLimit, points.length - rowStart);
        const column = index - rowStart;
        const sideInset = rowCount === 3 ? 48 : 62;
        const usableWidth = Math.max(1, container.clientWidth - sideInset * 2);
        const targetX =
            rowCount === 1
                ? container.clientWidth / 2
                : sideInset + (column / (rowCount - 1)) * usableWidth;
        const targetY =
            rows === 1
                ? topY
                : topY + (row / (rows - 1)) * (bottomY - topY);
        dot.classList.remove(
            "mobile-fan-collapsing",
            "mobile-label-left",
            "mobile-label-right",
            "mobile-label-below",
        );
        dot.classList.add("mobile-fanned", "mobile-label-below");
        dot.style.setProperty("--mobile-fan-x", `${targetX - point.x}px`);
        dot.style.setProperty("--mobile-fan-y", `${targetY - point.y}px`);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("class", "mobile-fan-connector");
        line.setAttribute("x1", (point.x / container.clientWidth) * 100);
        line.setAttribute("y1", (point.y / container.clientHeight) * 100);
        line.setAttribute("x2", (targetX / container.clientWidth) * 100);
        line.setAttribute("y2", (targetY / container.clientHeight) * 100);
        svgLayer.appendChild(line);

        const origin = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        origin.setAttribute("class", "mobile-fan-origin");
        origin.setAttribute("cx", (point.x / container.clientWidth) * 100);
        origin.setAttribute("cy", (point.y / container.clientHeight) * 100);
        origin.setAttribute("rx", (7 / container.clientWidth) * 100);
        origin.setAttribute("ry", (7 / container.clientHeight) * 100);
        svgLayer.appendChild(origin);
    });

    scheduleMobileLabelClamp(container);
}

function clearMobileFan() {
    if (!mobileFanItemIds.length) return;
    const collapsingIds = [...mobileFanItemIds];
    mobileFanItemIds = [];
    removeMobileFanGraphics();
    const container = document.getElementById("graph-container");
    if (container) {
        container.classList.remove("mobile-cluster-focus");
        container.querySelector(".mobile-cluster-focus-label")?.remove();
    }
    collapsingIds.forEach((id) => {
        const dot = document.getElementById(`dot-${id}`);
        if (!dot) return;
        dot.classList.add("mobile-fan-collapsing");
        dot.style.setProperty("--mobile-fan-x", "0px");
        dot.style.setProperty("--mobile-fan-y", "0px");
        setTimeout(() => {
            if (mobileFanItemIds.includes(id)) return;
            dot.classList.remove(
                "mobile-fanned",
                "mobile-fan-collapsing",
                "mobile-label-left",
                "mobile-label-right",
                "mobile-label-below",
            );
            dot.style.removeProperty("--mobile-fan-x");
            dot.style.removeProperty("--mobile-fan-y");
            dot.style.removeProperty("--mobile-label-x");
            dot.style.removeProperty("--mobile-label-y");
        }, 240);
    });
}

function expandMobileFan(ids, container) {
    clearMobileFan();
    clearHighlight();
    mobileFanItemIds = ids;
    layoutMobileFan(container);
    showToast(`${ids.length} tools here — choose one`);
}

function selectMobileItem(id) {
    clearMobileFan();
    highlightItem(id);
    const row = document.getElementById(`panel-row-${id}`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
}

function scheduleMobileLabelClamp(container) {
    if (!container || !isMobileGraphExperience()) return;
    if (mobileLabelClampFrame) cancelAnimationFrame(mobileLabelClampFrame);
    mobileLabelClampFrame = requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const labels = container.querySelectorAll(
            ".dot.mobile-fanned .dot-label, .dot.highlighted .dot-label",
        );
        labels.forEach((label) => {
            label.style.setProperty("--mobile-label-x", "0px");
            label.style.setProperty("--mobile-label-y", "0px");
        });
        requestAnimationFrame(() => {
            labels.forEach((label) => {
                const rect = label.getBoundingClientRect();
                const padding = 8;
                let x = 0;
                let y = 0;
                if (rect.left < containerRect.left + padding) {
                    x += containerRect.left + padding - rect.left;
                }
                if (rect.right > containerRect.right - padding) {
                    x -= rect.right - (containerRect.right - padding);
                }
                if (rect.top < containerRect.top + padding) {
                    y += containerRect.top + padding - rect.top;
                }
                if (rect.bottom > containerRect.bottom - padding) {
                    y -= rect.bottom - (containerRect.bottom - padding);
                }
                label.style.setProperty("--mobile-label-x", `${x}px`);
                label.style.setProperty("--mobile-label-y", `${y}px`);
            });
        });
    });
}

function setupMobileGraphInteractions(container) {
    const isInteractiveChrome = (target) =>
        target instanceof Element &&
        target.closest(
            "#top-right-controls, .tooltip, .onboarding-overlay, button, input, a",
        );

    container.addEventListener(
        "touchstart",
        (event) => {
            if (
                !isMobileGraphExperience() ||
                event.touches.length !== 1 ||
                isInteractiveChrome(event.target)
            ) {
                mobileGraphTapStart = null;
                return;
            }
            const touch = event.touches[0];
            mobileGraphTapStart = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now(),
            };
        },
        { passive: true },
    );

    container.addEventListener(
        "touchend",
        (event) => {
            const start = mobileGraphTapStart;
            mobileGraphTapStart = null;
            if (!start || !isMobileGraphExperience() || isDragging) return;
            const touch = event.changedTouches[0];
            if (!touch) return;
            const movement = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
            if (movement > MOBILE_DRAG_THRESHOLD || Date.now() - start.time > 450) return;

            event.preventDefault();
            if (mobileFanItemIds.length) {
                const selectedId = nearestMobileItem(
                    touch.clientX,
                    touch.clientY,
                    container,
                    mobileFanItemIds,
                    48,
                );
                if (selectedId) selectMobileItem(selectedId);
                else clearMobileFan();
                return;
            }

            const nearestId = nearestMobileItem(
                touch.clientX,
                touch.clientY,
                container,
                [...renderedItems],
            );
            if (!nearestId) {
                clearHighlight();
                return;
            }
            const cluster = mobileCollisionCluster(nearestId, container);
            if (cluster.length > 1) expandMobileFan(cluster, container);
            else selectMobileItem(nearestId);
        },
        { passive: false },
    );
}

// --- FILTER AND REORDER LOGIC ---
function applyFilters(options = {}) {
    clearMobileFan();
    const searchInput = document.getElementById("search-input");
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const container = document.getElementById("graph-container");
    const branchBtn = document.getElementById("branch-filter-btn");
    const panelInner = document.getElementById("tool-panel-inner");

    const hasFilter = query !== "" || selectedTags.size > 0;

    if (container) {
        container.classList.toggle("searching", hasFilter);
    }
    if (branchBtn) {
        branchBtn.classList.toggle("active", selectedTags.size > 0);
    }

    const matchingItems = [];
    const nonMatchingItems = [];
    const allItems = Object.values(itemsCache);

    allItems.forEach((item) => {
        let isMatch = true;
        if (hasFilter) {
            let matchesSearch = true;
            if (query) {
                const name = (item.name || "").toLowerCase();
                const desc = (item.desc || "").toLowerCase();
                matchesSearch = name.includes(query) || desc.includes(query);
            }

            let matchesTag = true;
            if (selectedTags.size > 0) {
                if (!item.tags || item.tags.length === 0) {
                    matchesTag = false;
                } else {
                    matchesTag = item.tags.some((tag) => selectedTags.has(tag));
                }
            }

            isMatch = matchesSearch && matchesTag;
        }

        if (!hasFilter || isMatch) {
            matchingItems.push(item);
        } else {
            nonMatchingItems.push(item);
        }

        // Update dot on graph
        const dot = document.getElementById(`dot-${item.id}`);
        if (dot) {
            dot.classList.toggle("search-match", hasFilter && isMatch);
        }

        // Update voter dots on graph
        const voterDots = document.querySelectorAll(
            `.voter-dot[id^="voter-dot-${item.id}-"]`,
        );
        voterDots.forEach((vDot) => {
            vDot.classList.toggle("search-match", hasFilter && isMatch);
        });
    });

    // Sort each group alphabetically by name
    matchingItems.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    nonMatchingItems.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const orderedItems = [...matchingItems, ...nonMatchingItems];

    // Reorder panel rows and update numbering for both tool panel and graph dots
    if (panelInner) {
        orderedItems.forEach((item, index) => {
            const number = index + 1;
            const row = document.getElementById(`panel-row-${item.id}`);
            const isDimmed = hasFilter && index >= matchingItems.length;

            if (row) {
                panelInner.appendChild(row);
                row.classList.toggle("dimmed", isDimmed);

                const rowNum = document.getElementById(`rownum-${item.id}`);
                if (rowNum) {
                    rowNum.textContent = number;
                }
            }

            const dotNum = document.getElementById(`dotnum-${item.id}`);
            if (dotNum) {
                dotNum.textContent = number;
            }
        });
    }

    if (options.scrollToTop && hasFilter) {
        const toolPanel = document.getElementById("tool-panel");
        if (toolPanel) {
            toolPanel.scrollTop = 0;
        }
    }
}

// --- TOOL PANEL RENDER ---
function renderToolPanel() {
    const panelInner = document.getElementById("tool-panel-inner");
    if (!panelInner) return;

    // Clear existing rows first (handles item additions/removals in live mode).
    panelInner.innerHTML = "";

    const items = Object.values(itemsCache);

    items.forEach((item) => {
        // Read consensus position from DOM if available (works in both modes)
        const dot = document.getElementById(`dot-${item.id}`);
        const xVal = dot && dot.dataset.realX != null ? Math.round(parseFloat(dot.dataset.realX)) : Math.round(item.x || 0);
        const yVal = dot && dot.dataset.realY != null ? Math.round(parseFloat(dot.dataset.realY)) : Math.round(item.y || 0);

        const row = document.createElement("div");
        row.className = "panel-row" + (isOnboardingActive ? " onboarding-hidden" : "");
        row.id = `panel-row-${item.id}`;
        row.dataset.itemId = item.id;

        // Tags as chips - built safely via textContent after creation
        const tagsArr = (item.tags && item.tags.length > 0) ? item.tags : [];
        const tagsHtml = tagsArr.map(t => `<span class="panel-tag">${escapeHtml(t)}</span>`).join("");

        // Row HTML — all user fields escaped
        row.innerHTML = `
            <div class="panel-row-head">
                <span class="panel-row-num" id="rownum-${item.id}" style="background-color:${readinessColor(yVal)}; border-color:${readinessColor(yVal)}; color:#0a0a0a;"></span>
                <div class="panel-row-name"></div>
            </div>
            <div class="panel-metrics">
                <div class="panel-metric">
                    <div class="panel-metric-label">Generative</div>
                    <div class="panel-metric-bar-wrap">
                        <div class="panel-metric-bar panel-metric-bar-gen" id="bar-gen-${item.id}" style="width:${xVal}%"></div>
                    </div>
                    <div class="panel-metric-num" id="num-gen-${item.id}">${xVal}%</div>
                </div>
                <div class="panel-metric">
                    <div class="panel-metric-label">Readiness</div>
                    <div class="panel-metric-bar-wrap">
                        <div class="panel-metric-bar panel-metric-bar-ready" id="bar-ready-${item.id}" style="width:${yVal}%; background-color:${readinessColor(yVal)}"></div>
                    </div>
                    <div class="panel-metric-num" id="num-ready-${item.id}">${yVal}%</div>
                </div>
            </div>
            <div class="panel-row-desc"></div>
            <div class="panel-row-tags">${tagsHtml}</div>
        `;

        // Set name and desc via textContent (XSS-safe, no escaping needed)
        row.querySelector(".panel-row-name").textContent = item.name || "";
        row.querySelector(".panel-row-desc").textContent = item.desc || "";

        // Panel -> Dot: mouseenter highlights dot; click/tap also highlights
        row.addEventListener("mouseenter", () => {
            highlightItem(item.id);
        });
        row.addEventListener("mouseleave", () => {
            // Only clear on mouseleave for hover; keep for tap (handled separately)
            if (_currentHighlightId === item.id) clearHighlight();
        });
        row.addEventListener("click", () => {
            // Tap: keep highlight until another is chosen
            clearMobileFan();
            highlightItem(item.id);
        });

        panelInner.appendChild(row);
    });

    // Apply filtering, ordering, and numbering across both rows and dot badges
    applyFilters();
}

// --- TAP-TO-SHOW TOOLTIP FOR TOUCH DEVICES ---
function setupTapTooltip(avgDot, item) {
    let tapStartTime = 0;
    let tapStartX = 0;
    let tapStartY = 0;
    const TAP_THRESHOLD = 200; // ms
    const MOVE_THRESHOLD = 10; // px

    avgDot.addEventListener(
        "touchstart",
        (e) => {
            if (isMobileGraphExperience()) return;
            tapStartTime = Date.now();
            tapStartX = e.touches[0].clientX;
            tapStartY = e.touches[0].clientY;
        },
        { passive: true },
    );

    avgDot.addEventListener("touchend", (e) => {
        if (isMobileGraphExperience()) return;
        const tapDuration = Date.now() - tapStartTime;
        const touch = e.changedTouches[0];
        const moveX = Math.abs(touch.clientX - tapStartX);
        const moveY = Math.abs(touch.clientY - tapStartY);

        // If it was a quick tap without much movement, scroll panel + highlight
        if (
            tapDuration < TAP_THRESHOLD &&
            moveX < MOVE_THRESHOLD &&
            moveY < MOVE_THRESHOLD
        ) {
            // Don't toggle if we just finished dragging
            if (!isDragging) {
                e.preventDefault();
                // Scroll panel row into view and highlight
                const row = document.getElementById(`panel-row-${item.id}`);
                if (row) {
                    row.scrollIntoView({ behavior: "smooth", block: "center" });
                }
                highlightItem(item.id);
                // On wider screens also show the anchored tooltip
                if (window.innerWidth > 600) {
                    document
                        .querySelectorAll(".dot.tooltip-active")
                        .forEach((d) => {
                            if (d !== avgDot) d.classList.remove("tooltip-active");
                        });
                    avgDot.classList.toggle("tooltip-active");
                }
            }
        }
    });

    // Desktop click also scrolls+highlights panel
    avgDot.addEventListener("click", (e) => {
        if (isTouchDevice()) return; // handled by touchend
        const row = document.getElementById(`panel-row-${item.id}`);
        if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        highlightItem(item.id);
    });
}

function updateItemMetadata(item) {
    const label = document.getElementById(`label-${item.id}`);
    const labelName = label?.querySelector(".dot-label-name");
    if (labelName) labelName.textContent = item.name;
    const tooltip = document.getElementById(`tooltip-${item.id}`);
    if (tooltip) {
        const titleStrong = tooltip.querySelector("strong");
        if (titleStrong) titleStrong.innerText = item.name;

        const tagsSpan = document.getElementById(`tags-${item.id}`);
        if (tagsSpan) {
            tagsSpan.innerText = item.tags && item.tags.length > 0 ? item.tags.join(', ') : '';
        }

        const descSpan = document.getElementById(`desc-${item.id}`);
        if (descSpan) descSpan.innerText = item.desc;
        
        // Also refresh Edit button visibility based on current items and settings
        const editBtn = document.getElementById(`edit-btn-${item.id}`);
        if (editBtn) {
            editBtn.style.display = (addingEnabled || isAdmin) ? "block" : "none";
        }
    }
}

function removeItemElements(id) {
    if (mobileFanItemIds.includes(id)) clearMobileFan();
    const dot = document.getElementById(`dot-${id}`);
    const uDot = document.getElementById(`user-dot-${id}`);
    const line = document.getElementById(`line-${id}`);
    if (dot) dot.remove();
    if (uDot) uDot.remove();
    if (line) line.remove();

    // Cleanup all voter dots for this item
    const container = document.getElementById("graph-container");
    if (container) {
        const dots = container.querySelectorAll(
            `.voter-dot[id^="voter-dot-${id}-"]`,
        );
        dots.forEach((d) => d.remove());
    }
}

function setupDrag(avgDot, userDot, item, container) {
    const updateFirebase = throttle((x, y) => {
        if (!currentUser || isConfirmingVote) return;

        if (viewMode === "1D") {
            let targetY = 50;
            const itemVotes = previousData[item.id] || {};
            if (itemVotes[currentUser.uid]) {
                targetY = itemVotes[currentUser.uid].y;
            } else {
                const avgDotDom = document.getElementById(`dot-${item.id}`);
                if (avgDotDom) {
                    const currentBottom = avgDotDom.dataset.realY;
                    if (currentBottom != null) targetY = parseFloat(currentBottom);
                    else targetY = item.y;
                }
            }
            saveVote(item.id, {
                x: Math.round(x * 10) / 10,
                y: Math.round(targetY * 10) / 10,
                username: userDisplayName,
                timestamp: Date.now(),
            });
        } else {
            saveVote(item.id, {
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10,
                username: userDisplayName,
                timestamp: Date.now(),
            });
        }
    }, 50);

    const startDrag = function (clientX, clientY, targetElement, originalEvent) {
        if (!currentUser || isConfirmingVote) return;

        if (isTimelineOpen && !isAtLiveTimestamp()) {
            showToast("Scrub to Live to vote");
            return;
        }

        // Block drag if clicking interactive controls inside tooltip
        if (originalEvent && originalEvent.target) {
            if (
                originalEvent.target.closest(".admin-btn") ||
                originalEvent.target.closest("button") ||
                originalEvent.target.closest("input")
            ) {
                return;
            }
        }

        if (!votingEnabled && !isAdmin) {
            showToast("Voting Closed");
            return;
        }

        if (originalEvent && originalEvent.preventDefault) {
            originalEvent.preventDefault();
        }
        if (originalEvent && originalEvent.stopPropagation) {
            originalEvent.stopPropagation();
        }

        isDragging = item.id;
        const activeDot = userDot;
        activeDot.style.display = "block";
        activeDot.style.zIndex = 1000;

        // CSS Class override for instant response
        activeDot.classList.add("dragging");

        // Close any open tooltips when starting to drag
        closeAllTooltips();

        let shiftX = 0,
            shiftY = 0;

        if (targetElement === avgDot) {
            shiftX = activeDot.offsetWidth / 2;
            shiftY = activeDot.offsetHeight / 2;
        } else {
            const rect = activeDot.getBoundingClientRect();
            shiftX = clientX - rect.left;
            shiftY = clientY - rect.top;
        }

        function moveAt(pageX, pageY) {
            const containerRect = container.getBoundingClientRect();
            let newX = pageX - shiftX - containerRect.left;
            let newY = pageY - shiftY - containerRect.top;
            if (newX < 0) newX = 0;
            if (newX > container.clientWidth) newX = container.clientWidth;
            if (newY < 0) newY = 0;
            if (newY > container.clientHeight) newY = container.clientHeight;
            let pointerX = (newX / container.clientWidth) * 100;
            let pointerY = 100 - (newY / container.clientHeight) * 100;
            let percentX = Math.max(0, Math.min(100, unplotPct(pointerX)));
            let percentY = Math.max(0, Math.min(100, unplotPct(pointerY)));

            updateElementPosition(activeDot, percentX, percentY);
            updateFirebase(percentX, percentY);

            const avgDot = document.getElementById(`dot-${item.id}`);
            if (avgDot) {
                const avgX = parseFloat(avgDot.dataset.realX);
                const avgY = parseFloat(avgDot.dataset.realY);
                updateConnectionLine(item.id, avgX, avgY, percentX, percentY);
            }
            activeDot.dataset.tempX = percentX;
            activeDot.dataset.tempY = percentY;
        }

        function onMouseMove(event) {
            moveAt(event.clientX, event.clientY);
        }

        function onTouchMove(event) {
            if (event.touches.length > 0) {
                moveAt(event.touches[0].clientX, event.touches[0].clientY);
            }
        }

        async function endDrag() {
            document.removeEventListener("mousemove", onMouseMove);
            document.onmouseup = null;
            document.removeEventListener("touchmove", onTouchMove);
            document.ontouchend = null;
            document.ontouchcancel = null;

            if (isDragging === item.id) {
                isDragging = null;
                activeDot.classList.remove("dragging");
                activeDot.style.transition = "";
                activeDot.style.zIndex = "";

                if (activeDot.dataset.tempX) {
                    let x = parseFloat(activeDot.dataset.tempX);
                    let y = parseFloat(activeDot.dataset.tempY);
                    delete activeDot.dataset.tempX;
                    delete activeDot.dataset.tempY;
                    if (viewMode === "1D") {
                        let targetY = 50;
                        const itemVotes = previousData[item.id] || {};
                        if (itemVotes[currentUser.uid]) {
                            targetY = itemVotes[currentUser.uid].y;
                        } else {
                            const avgDotDom = document.getElementById(`dot-${item.id}`);
                            if (avgDotDom) {
                                const currentBottom = avgDotDom.dataset.realY;
                                if (currentBottom != null) targetY = parseFloat(currentBottom);
                                else targetY = item.y;
                            }
                        }
                        y = targetY;
                    }

                    isConfirmingVote = true;
                    showToast(
                        isLocalPreviewMode ? "Updating local preview…" : "Saving vote…",
                    );
                    try {
                        await saveVote(item.id, {
                            x: Math.round(x * 10) / 10,
                            y: Math.round(y * 10) / 10,
                            username: userDisplayName,
                            timestamp: Date.now(),
                        });
                    } catch (error) {
                        console.error("Could not save vote", error);
                        isConfirmingVote = false;
                        showToast("Couldn’t confirm final position — try again");
                        return;
                    }

                    // --- SHOW CONFIRMATION MODAL ---
                    const modal = document.getElementById("confirm-vote-modal");
                    const title = document.getElementById("confirm-vote-title");
                    const stats = document.getElementById("confirm-vote-stats");
                    const nameSection = document.getElementById(
                        "confirm-vote-username-section",
                    );
                    const nameInput = document.getElementById(
                        "confirm-vote-username-input",
                    );

                    modal.dataset.itemId = item.id;
                    title.innerText = `Vote for ${item.name}`;
                    stats.innerHTML = `
                        <div style="margin-top:10px;">
                            <strong>Generative:</strong> ${Math.round(x)}%<br>
                            <strong>Readiness:</strong> ${Math.round(y)}%
                        </div>
                    `;

                    if (!hasConfirmedName) {
                        nameSection.style.display = "block";
                        nameInput.value = userDisplayName;
                    } else {
                        nameSection.style.display = "none";
                    }

                    modal.style.display = "flex";
                    if (!hasConfirmedName && nameSection.style.display !== "none") {
                        setTimeout(() => nameInput.focus(), 100);
                    }
                }
            }
        }

        // Bind mouse events
        document.addEventListener("mousemove", onMouseMove);
        document.onmouseup = endDrag;

        // Bind touch events
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.ontouchend = endDrag;
        document.ontouchcancel = endDrag;

        moveAt(clientX, clientY);
    };

    // --- MOUSE EVENTS ---
    avgDot.onmousedown = (e) => {
        startDrag(e.clientX, e.clientY, avgDot, e);
    };
    userDot.onmousedown = (e) => {
        startDrag(e.clientX, e.clientY, userDot, e);
    };

    // --- TOUCH EVENTS ---
    avgDot.addEventListener(
        "touchstart",
        (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                // Delay slightly to differentiate tap from drag
                avgDot._touchStartTime = Date.now();
                avgDot._touchStartX = touch.clientX;
                avgDot._touchStartY = touch.clientY;
            }
        },
        { passive: true },
    );

    avgDot.addEventListener(
        "touchmove",
        (e) => {
            if (e.touches.length === 1 && avgDot._touchStartTime) {
                const touch = e.touches[0];
                const moveX = Math.abs(touch.clientX - avgDot._touchStartX);
                const moveY = Math.abs(touch.clientY - avgDot._touchStartY);
                const dragThreshold = isMobileGraphExperience()
                    ? MOBILE_DRAG_THRESHOLD
                    : 5;

                // If moved enough, start dragging
                if (moveX > dragThreshold || moveY > dragThreshold) {
                    if (
                        isMobileGraphExperience() &&
                        (_currentHighlightId !== item.id || mobileFanItemIds.length)
                    ) {
                        avgDot._touchStartTime = null;
                        return;
                    }
                    if (!isDragging) {
                        startDrag(touch.clientX, touch.clientY, avgDot, e);
                    }
                    avgDot._touchStartTime = null;
                }
            }
        },
        { passive: false },
    );

    userDot.addEventListener(
        "touchstart",
        (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                userDot._touchStartTime = Date.now();
                userDot._touchStartX = touch.clientX;
                userDot._touchStartY = touch.clientY;
            }
        },
        { passive: true },
    );

    userDot.addEventListener(
        "touchmove",
        (e) => {
            if (e.touches.length === 1 && userDot._touchStartTime) {
                const touch = e.touches[0];
                const moveX = Math.abs(touch.clientX - userDot._touchStartX);
                const moveY = Math.abs(touch.clientY - userDot._touchStartY);
                const dragThreshold = isMobileGraphExperience()
                    ? MOBILE_DRAG_THRESHOLD
                    : 5;

                // If moved enough, start dragging
                if (moveX > dragThreshold || moveY > dragThreshold) {
                    if (!isDragging) {
                        startDrag(touch.clientX, touch.clientY, userDot, e);
                    }
                    userDot._touchStartTime = null;
                }
            }
        },
        { passive: false },
    );
}

function updateGraphFromData(allVotes, container) {
    renderedItems.forEach((itemId) => {
        const itemVotes = allVotes[itemId] || {};
        const baseItem = itemsCache[itemId];
        const prevItemVotes = previousData[itemId] || {};

        if (!baseItem) return;

        // Track which voter dots should exist
        const activeVoters = new Set();

        // --- WEIGHTED AVERAGE CALCULATION ---
        // We give the baseline (default) position a weight of 10
        // And each user vote a weight of 1.
        let totalX = baseItem.x * 10;
        let totalY = baseItem.y * 10;
        let count = 10;

        Object.keys(itemVotes).forEach((uid) => {
            if (uid === currentUser?.uid && isDragging === itemId) {
                activeVoters.add(uid);
                return;
            }
            const vote = itemVotes[uid];
            const prevVote = prevItemVotes[uid];

            // 1. Splash Logic (Only for live incoming updates after initial page load)
            let shouldSplash = false;
            if (hasLoadedInitialVotes) {
                if (!prevVote) shouldSplash = true;
                else if (
                    Math.abs(vote.x - prevVote.x) > 1 ||
                    Math.abs(vote.y - prevVote.y) > 1
                )
                    shouldSplash = true;
            }
            if (shouldSplash) triggerSplash(container, vote.x, vote.y);

            // 2. Voter Dot Logic (Other Users)
            if (uid !== currentUser?.uid) {
                let vDot = document.getElementById(`voter-dot-${itemId}-${uid}`);
                if (!vDot) {
                    vDot = document.createElement("div");
                    vDot.className = "voter-dot";
                    vDot.id = `voter-dot-${itemId}-${uid}`;
                    vDot.innerHTML = `<div class="voter-username">${escapeHtml(vote.username || "Anon")}</div>`;
                    container.appendChild(vDot);
                }

                if (vDot) {
                    const isRecent = vote.timestamp && (Date.now() - vote.timestamp < 120000);
                    if (shouldSplash || isRecent) {
                        vDot.classList.add("visible");
                        clearTimeout(vDot.fadeTimeout);
                        vDot.fadeTimeout = setTimeout(
                            () => vDot.classList.remove("visible"),
                            FADE_TIME,
                        );
                    }
                }

                updateElementPosition(vDot, vote.x, vote.y);
                if (viewMode === "1D") vDot.style.bottom = "50%";
                activeVoters.add(uid);
            } else {
                activeVoters.add(uid);
            }

            // Add to weighted totals
            totalX += vote.x;
            totalY += vote.y;
            count++;
        });

        // Cleanup old voter dots
        const allVoterDots = container.querySelectorAll(
            `.voter-dot[id^="voter-dot-${itemId}-"]`,
        );
        allVoterDots.forEach((dot) => {
            const uid = dot.id.replace(`voter-dot-${itemId}-`, "");
            if (!activeVoters.has(uid)) dot.remove();
        });

        let myVote = null;
        if (currentUser && itemVotes[currentUser.uid]) {
            myVote = itemVotes[currentUser.uid];
            // If dragging, we use the local temp position for the average calculation
            // to provide real-time feedback.
            if (isDragging === itemId) {
                const userDot = document.getElementById(`user-dot-${itemId}`);
                if (userDot && userDot.dataset.tempX) {
                    const tx = parseFloat(userDot.dataset.tempX);
                    const ty = parseFloat(userDot.dataset.tempY);
                    totalX += tx;
                    totalY += ty;
                    count++;
                } else {
                    totalX += myVote.x;
                    totalY += myVote.y;
                    count++;
                }
            }
        }

        let avgX = totalX / count;
        let avgY = totalY / count;

        const avgDot = document.getElementById(`dot-${itemId}`);
        if (avgDot) {
            // If I am dragging THIS item, kill the transition on the Consensus Dot so it follows instantly
            if (isDragging === itemId) {
                avgDot.style.transition = "none";
            } else {
                avgDot.style.transition = ""; // Revert to CSS default (3s)
            }

            updateElementPosition(avgDot, avgX, avgY);
            updateDotColor(avgDot, avgY);
            const label = document.getElementById(`label-${itemId}`);
            if (label) updateLabelPosition(label, avgY);
            const labelValues = label?.querySelector(".dot-label-values");
            if (labelValues) {
                labelValues.textContent = `G ${Math.round(avgX)} · R ${Math.round(avgY)}`;
            }

            // UPDATE TOOLTIP VALUES
            const valX = document.getElementById(`val-x-${itemId}`);
            const valY = document.getElementById(`val-y-${itemId}`);
            if (valX) valX.innerText = Math.round(avgX);
            if (valY) valY.innerText = Math.round(avgY);

            // UPDATE PANEL ROW METRICS (bars + numbers)
            const barGen = document.getElementById(`bar-gen-${itemId}`);
            const barReady = document.getElementById(`bar-ready-${itemId}`);
            const numGen = document.getElementById(`num-gen-${itemId}`);
            const numReady = document.getElementById(`num-ready-${itemId}`);
            if (barGen) barGen.style.width = Math.round(avgX) + "%";
            if (barReady) {
                barReady.style.width = Math.round(avgY) + "%";
                barReady.style.backgroundColor = readinessColor(avgY);
            }
            const rowNum = document.getElementById(`rownum-${itemId}`);
            if (rowNum) {
                const rc = readinessColor(avgY);
                rowNum.style.backgroundColor = rc;
                rowNum.style.borderColor = rc;
            }
            if (numGen) numGen.textContent = Math.round(avgX) + "%";
            if (numReady) numReady.textContent = Math.round(avgY) + "%";

            const myVoteDiv = document.getElementById(`my-vote-${itemId}`);
            if (myVoteDiv) {
                if (myVote) {
                    myVoteDiv.style.display = "inline";
                    myVoteDiv.innerHTML = `<span style="color:#444">|</span> Me: <b>${Math.round(myVote.x)}/${Math.round(myVote.y)}</b>`;
                } else {
                    myVoteDiv.style.display = "none";
                }
            }
        }
        const userDot = document.getElementById(`user-dot-${itemId}`);
        if (userDot) {
            if (myVote) {
                userDot.style.display = "block";
                // Ensure name is on user dot
                let nameLabel = userDot.querySelector(".voter-username");
                if (!nameLabel) {
                    nameLabel = document.createElement("div");
                    nameLabel.className = "voter-username";
                    userDot.appendChild(nameLabel);
                }
                nameLabel.innerText = userDisplayName;

                if (
                    isDragging === itemId ||
                    Date.now() - (window.appLaunchTime || 0) < INITIAL_SHOW_TIME
                ) {
                    nameLabel.classList.add("visible");
                    clearTimeout(nameLabel.fadeTimeout);
                    if (isDragging !== itemId) {
                        nameLabel.fadeTimeout = setTimeout(
                            () => nameLabel.classList.remove("visible"),
                            FADE_TIME,
                        );
                    }
                } else if (!isDragging) {
                    // If we just finished dragging, start the fade
                    if (
                        nameLabel.classList.contains("visible") &&
                        !nameLabel.fadeTimeout
                    ) {
                        nameLabel.fadeTimeout = setTimeout(
                            () => nameLabel.classList.remove("visible"),
                            FADE_TIME,
                        );
                    }
                }

                if (isDragging !== itemId) {
                    updateElementPosition(userDot, myVote.x, myVote.y);
                    updateConnectionLine(itemId, avgX, avgY, myVote.x, myVote.y);
                } else {
                    const currentDomLeft = parseFloat(userDot.dataset.realX);
                    const currentDomBottom = parseFloat(userDot.dataset.realY);
                    updateConnectionLine(
                        itemId,
                        avgX,
                        avgY,
                        currentDomLeft,
                        currentDomBottom,
                    );
                }
            } else {
                userDot.style.display = "none";
                const line = document.getElementById(`line-${itemId}`);
                if (line) line.style.display = "none";
            }
        }
    });
    hasLoadedInitialVotes = true;
    previousData = JSON.parse(JSON.stringify(allVotes));

    // After all dots have moved, schedule label de-overlap pass
    scheduleResolveLabels();
    if (isMobileGraphExperience()) {
        if (mobileFanItemIds.length) layoutMobileFan(container);
        else scheduleMobileLabelClamp(container);
    }
}

function updateConnectionLine(itemId, x1, y1, x2, y2) {
    const line = document.getElementById(`line-${itemId}`);
    if (line) {
        line.style.display = "block";
        line.setAttribute("x1", plotPct(x1));
        line.setAttribute("y1", 100 - plotPct(y1));
        line.setAttribute("x2", plotPct(x2));
        line.setAttribute("y2", 100 - plotPct(y2));
    }
}

function triggerSplash(container, x, y) {
    if (Date.now() - window.appLaunchTime < 2000) return;
    const splash = document.createElement("div");
    splash.className = "splash";
    splash.style.left = plotPct(x) + "%";
    splash.style.bottom = plotPct(y) + "%";
    container.appendChild(splash);
    setTimeout(() => splash.remove(), 600);
}

function triggerMegaSplash(container, x, y) {
    if (Date.now() - window.appLaunchTime < 2000) return;
    const splash = document.createElement("div");
    splash.className = "mega-splash";
    splash.style.left = plotPct(x) + "%";
    splash.style.bottom = plotPct(y) + "%";
    container.appendChild(splash);
    setTimeout(() => splash.remove(), 1200);
}

// Inset the plotting area so dots near the 0%/100% edges keep a margin and
// don't spill off the chart (notably the lower-right corner in portrait).
const PLOT_PAD = 3.5;
const PLOT_SPAN = 100 - 2 * PLOT_PAD;
function plotPct(v) {
    const c = Math.max(0, Math.min(100, v));
    return PLOT_PAD + (c / 100) * PLOT_SPAN;
}
function unplotPct(p) {
    return ((p - PLOT_PAD) / PLOT_SPAN) * 100;
}
function updateElementPosition(element, x, y) {
    element.dataset.realX = x;
    element.dataset.realY = y;
    element.style.left = plotPct(x) + "%";
    element.style.bottom = plotPct(y) + "%";
}
function updateDotColor(dot, y) {
    dot.classList.remove("ready-high", "ready-mid", "ready-low");
    if (y > 80) dot.classList.add("ready-high");
    else if (y > 50) dot.classList.add("ready-mid");
    else dot.classList.add("ready-low");
}

// Solid color for a readiness value, interpolated along the same spectrum as
// the y-axis gradient: 0% red → 50% yellow → 100% green.
// (#ff3d00 → #ffea00 → #00e676)
function readinessColor(y) {
    const v = Math.max(0, Math.min(100, y));
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const red = [255, 61, 0];
    const yellow = [255, 234, 0];
    const green = [0, 230, 118];
    let c;
    if (v <= 50) {
        const t = v / 50;
        c = [lerp(red[0], yellow[0], t), lerp(red[1], yellow[1], t), lerp(red[2], yellow[2], t)];
    } else {
        const t = (v - 50) / 50;
        c = [lerp(yellow[0], green[0], t), lerp(yellow[1], green[1], t), lerp(yellow[2], green[2], t)];
    }
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
function updateLabelPosition(labelElement, y) {
    // Initial class — will be refined by resolveAllLabelOverlaps
    labelElement.classList.remove("label-below", "label-above");
    labelElement.classList.add("label-below");
    labelElement.style.transform = "";
}

// --- LABEL OVERLAP RESOLUTION ---
let _labelResolveTimer = null;
function scheduleResolveLabels() {
    if (_labelResolveTimer) clearTimeout(_labelResolveTimer);
    _labelResolveTimer = setTimeout(resolveAllLabelOverlaps, 250);
}

// Perpendicular slide: labels stay close to the dot.
// SMALL offsets only — prefer overlap over labels drifting far from dots.
// Max offset ±21px = ~15px on screen. Offsets: 0, ±7, ±14, ±21
const PERP_OFFSETS = [0, -7, 7, -14, 14, -21, 21];

const COS45 = 0.707;
const SIN45 = 0.707;
const BASE_ALONG = 10; // fixed distance along the 45° axis
const FONT_HEIGHT = 10; // perpendicular thickness of text at 45° (~13px font * cos45)

function resolveAllLabelOverlaps() {
    // Labels are now revealed on demand (hover/tap/search) as a horizontal pill,
    // so the old always-on 45° de-overlap pass is disabled.
    return;
    /* eslint-disable no-unreachable */
    const container = document.getElementById("graph-container");
    if (!container) return;
    const cW = container.clientWidth;
    const cH = container.clientHeight;

    // 1. Collect all label data
    const items = [];
    renderedItems.forEach((id) => {
        const dot = document.getElementById(`dot-${id}`);
        const label = document.getElementById(`label-${id}`);
        if (!dot || !label) return;

        const dotXPct = parseFloat(dot.style.left) || 0;
        const dotYPct = parseFloat(dot.style.bottom) || 0;
        const dotXPx = (dotXPct / 100) * cW;
        const dotYPx = (1 - dotYPct / 100) * cH;

        // Reset any wrapping from previous version
        label.style.whiteSpace = "nowrap";
        label.style.maxWidth = "";

        // Label dimensions in LOCAL (rotated) coordinate space:
        // - along axis: textLen * charWidth (the length of the text string)
        // - perpendicular: ~FONT_HEIGHT (the height of one text line)
        const textLen = label.innerText.length;
        const charW = 7;
        const textWidth = textLen * charW; // length along the 45° axis

        items.push({ id, label, dotXPx, dotYPx, textWidth });
    });

    // Sort top-left to bottom-right for consistent priority
    items.sort((a, b) => (a.dotYPx + a.dotXPx) - (b.dotYPx + b.dotXPx));

    // 2. Greedy placement using oriented bounding boxes
    // Each placed label is stored as its rotated-axis projection:
    //   { along0, along1, perp0, perp1 }
    // where "along" is the 45° diagonal axis, "perp" is perpendicular to it.
    const placed = [];

    for (const item of items) {
        let bestOffset = 0;
        let bestOBB = calcOBB(item, 0);
        let hasOverlap = placed.some(r => obbOverlap(bestOBB, r));

        if (hasOverlap) {
            for (const perpY of PERP_OFFSETS) {
                if (perpY === 0) continue;
                const candidateOBB = calcOBB(item, perpY);
                // Check screen bounds (use screen-space anchor)
                const sx = item.dotXPx + (BASE_ALONG * COS45 - perpY * SIN45);
                const sy = item.dotYPx + (BASE_ALONG * SIN45 + perpY * COS45);
                if (sy < -10 || sy > cH + 10 || sx < -10 || sx > cW + 10) continue;

                if (!placed.some(r => obbOverlap(candidateOBB, r))) {
                    bestOffset = perpY;
                    bestOBB = candidateOBB;
                    hasOverlap = false;
                    break;
                }
            }
        }

        // If still overlapping, pick smallest overlap
        if (hasOverlap) {
            let minOvlp = Infinity;
            for (const perpY of PERP_OFFSETS) {
                const candidateOBB = calcOBB(item, perpY);
                const sx = item.dotXPx + (BASE_ALONG * COS45 - perpY * SIN45);
                const sy = item.dotYPx + (BASE_ALONG * SIN45 + perpY * COS45);
                if (sy < -10 || sy > cH + 10) continue;
                let total = 0;
                for (const r of placed) total += obbOverlapAmount(candidateOBB, r);
                if (total < minOvlp) {
                    minOvlp = total;
                    bestOffset = perpY;
                    bestOBB = candidateOBB;
                }
            }
        }

        placed.push(bestOBB);

        // Apply CSS transform
        item.label.style.transform = `rotate(45deg) translate(${BASE_ALONG}px, ${bestOffset}px)`;
        item.label.style.transformOrigin = "left center";
    }
}

// Calculate oriented bounding box projections onto the 45° axes.
// "along" axis = direction text reads (45° from horizontal)
// "perp" axis = perpendicular to text (90° from along)
function calcOBB(item, perpY) {
    // The dot position projected onto the rotated axes:
    //   along = dotX * cos45 + dotY * sin45
    //   perp  = -dotX * sin45 + dotY * cos45
    const dotAlong = item.dotXPx * COS45 + item.dotYPx * SIN45;
    const dotPerp = -item.dotXPx * SIN45 + item.dotYPx * COS45;

    // The label starts at (BASE_ALONG, perpY) in local rotated coords
    // In the rotated axis frame:
    //   along start = dotAlong + BASE_ALONG
    //   along end   = dotAlong + BASE_ALONG + textWidth
    //   perp start  = dotPerp + perpY
    //   perp end    = dotPerp + perpY + FONT_HEIGHT
    return {
        along0: dotAlong + BASE_ALONG,
        along1: dotAlong + BASE_ALONG + item.textWidth,
        perp0: dotPerp + perpY,
        perp1: dotPerp + perpY + FONT_HEIGHT,
    };
}

function obbOverlap(a, b) {
    const pad = 1;
    // Two OBBs overlap only if they overlap on BOTH axes
    const alongOverlap = a.along0 < b.along1 + pad && b.along0 < a.along1 + pad;
    const perpOverlap = a.perp0 < b.perp1 + pad && b.perp0 < a.perp1 + pad;
    return alongOverlap && perpOverlap;
}

function obbOverlapAmount(a, b) {
    const alongOvlp = Math.max(0, Math.min(a.along1, b.along1) - Math.max(a.along0, b.along0));
    const perpOvlp = Math.max(0, Math.min(a.perp1, b.perp1) - Math.max(a.perp0, b.perp0));
    return alongOvlp * perpOvlp;
}

window.deleteItem = (id) => {
    if (confirm("Are you sure you want to delete this item?")) {
        remove(ref(db, "items/" + id));
        remove(ref(db, "votes/" + id));
    }
};

window.resetVotes = (id) => {
    const modal = document.getElementById("reset-options-modal");
    document.getElementById("reset-item-id").value = id;
    modal.style.display = "flex";
};

window.editItem = (id) => {
    const modal = document.getElementById("edit-item-modal");
    const name = document.querySelector(`#label-${id} .dot-label-name`)?.innerText || "";
    const desc = document.getElementById(`desc-${id}`).innerText;
    const item = itemsCache[id];
    
    document.getElementById("edit-item-id").value = id;
    document.getElementById("edit-item-name").value = name;
    document.getElementById("edit-item-desc").value = desc;
    
    const branchList = document.getElementById("edit-item-branches");
    if (branchList) {
        branchList.innerHTML = ACADEMY_BRANCHES.map(branch => {
            const isChecked = item && item.tags && item.tags.includes(branch) ? "checked" : "";
            return `<label class="branch-checkbox-item">
                <input type="checkbox" value="${branch}" ${isChecked}>
                ${branch}
            </label>`;
        }).join('');
    }
    
    modal.style.display = "flex";
};

// --- TIMELINE SCRUBBER & PLAYBACK ENGINE ---

function getItemCreationTimestamp(itemId, item) {
    if (itemId && itemId.startsWith("user_item_")) {
        const parsed = parseInt(itemId.replace("user_item_", ""), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (item && item.createdAt) return item.createdAt;
    if (item && item.timestamp) return item.timestamp;
    // Base items seeded at project launch
    return new Date("2026-01-17T00:00:00Z").getTime();
}

// In-memory cache of inferred user session timestamps so we calculate them once per build
let userSessionTimestampsCache = {};

// Baseline snapshot voters captured prior to the August 15 voting session
const BASELINE_SNAPSHOT_UIDS = new Set([
    "0tn0mDj4HOgf5UhinlCi7CvDOk13", "1NNDJHWh5DOXYrmhP1QfwahR1n62",
    "76jSsm0UI5f7m0BKNF9VJMsdDc83", "7T8SclBHHpgLCR1F92pa3F9dZrp2",
    "94is7USmiGNgQgLqy7vGwUXOHBJ3", "9uAhHIP2QXd9nkFIRQt75C35g5r2",
    "AKWGfKJEtHP1WXz2zEKuQ82ZIY73", "JxpPLh8qKlgzVsiEEbOciln4z1x1",
    "L8HYrfj2qyMReIPWI4nJz6CgDYJ3", "UB6TZ5YEnMPMtzM1wwdpBU9qMzG2",
    "YKL5jdKqDba525cosjG5ao5w0Wl2", "gAOpJXK3TTPYlISiKTwi02MuOl52",
    "iIRD8oTraXfQnJc36OeKXcvJjVt2", "kwhj81G4pfWPTDHge13wOIwA5hb2",
    "mA7Bgc3BSdgrMGRz6r48qLGJ1yB3", "oi14FQpMG8U1QAmvc6ZCfnlZlpq1",
    "sQmcrde3fla7B0kj1CedL9EtJzv2", "uVWG6wAXviYp4azo9uqOM2tQRIT2",
    "vpodBq4BKrUYEPh0EUNmxjnoiW73", "wuELvwgy1nTSewKE3ldKDxJOaCC3",
    "xnSXjsXluCT5QM285duZasGsWMR2", "xvxz2VUxN6QLJQcoDCpSNVacwWu1",
    "zOxtZK2qvfbIYyfayL1DSEPQ69I3"
]);

function buildUserSessionTimestamps(items, votes) {
    const itemDates = {};
    Object.keys(items || {}).forEach((id) => {
        itemDates[id] = getItemCreationTimestamp(id, items[id]);
    });

    const userTimestamps = {};
    const aug15Users = [];

    // 1. Scan historical snapshot votes to map each user to the latest tool session they voted on
    Object.keys(votes || {}).forEach((itemId) => {
        const vMap = votes[itemId] || {};
        Object.keys(vMap).forEach((uid) => {
            const v = vMap[uid];
            if (v && v.timestamp) {
                userTimestamps[uid] = v.timestamp;
                return;
            }
            if (BASELINE_SNAPSHOT_UIDS.has(uid)) {
                // Historical voter from Jan - Jun 2026 milestones
                const t = itemDates[itemId] || new Date("2026-01-17T00:00:00Z").getTime();
                if (!userTimestamps[uid] || t > userTimestamps[uid]) {
                    userTimestamps[uid] = t;
                }
            } else {
                // Voter who joined during August 15 session
                if (!aug15Users.includes(uid)) aug15Users.push(uid);
            }
        });
    });

    // 2. For Aug 15 session voters, stagger their timestamps across the Aug 15 voting session window
    // (18:30 to 20:30 UTC) so that as you scrub through Aug 15, votes arrive incrementally and animate!
    const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
    const AUG15_END = new Date("2026-08-15T20:30:00Z").getTime();
    aug15Users.forEach((uid, idx) => {
        if (!userTimestamps[uid]) {
            const step = (AUG15_END - AUG15_START) / Math.max(1, aug15Users.length);
            userTimestamps[uid] = Math.round(AUG15_START + idx * step);
        }
    });

    userSessionTimestampsCache = userTimestamps;
    return userTimestamps;
}

function getVoteTimestamp(itemId, uid, vote) {
    if (vote && vote.timestamp) return vote.timestamp;
    if (vote && vote.createdAt) return vote.createdAt;
    if (userSessionTimestampsCache[uid]) return userSessionTimestampsCache[uid];
    return new Date("2026-01-17T00:00:00Z").getTime();
}

function computeConsensus(item, votesMap) {
    if (!item) return { x: 50, y: 50 };
    let totalX = item.x * 10;
    let totalY = item.y * 10;
    let count = 10;
    if (votesMap) {
        Object.values(votesMap).forEach((vote) => {
            totalX += vote.x;
            totalY += vote.y;
            count++;
        });
    }
    return {
        x: totalX / count,
        y: totalY / count,
    };
}

function isAtLiveTimestamp() {
    return !isTimelineOpen || (currentTimelineTimestamp >= timelineMaxTime - 5000);
}

function formatTimelineDate(timestamp) {
    const d = new Date(timestamp);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return {
        dateStr: `${month} ${day}, ${year}`,
        timeStr: `${hours}:${minutes} ${ampm}`,
        fullStr: `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`,
    };
}

function buildTimelineData() {
    const items = itemsCache || {};
    const votes = latestLiveVotes || previousData || {};

    // Compute user session timestamps across all historical milestones and staggered sessions
    buildUserSessionTimestamps(items, votes, baselineSnapshot);

    let minT = Infinity;
    let maxT = -Infinity;
    const events = [];

    // 1. Gather item events
    Object.keys(items).forEach((itemId) => {
        const item = items[itemId];
        const t = getItemCreationTimestamp(itemId, item);
        minT = Math.min(minT, t);
        maxT = Math.max(maxT, t);
        events.push({ type: "item", id: itemId, name: item.name, time: t });
    });

    // 2. Gather vote events
    Object.keys(votes).forEach((itemId) => {
        const vMap = votes[itemId] || {};
        Object.keys(vMap).forEach((uid) => {
            const v = vMap[uid];
            const t = getVoteTimestamp(itemId, uid, v);
            minT = Math.min(minT, t);
            maxT = Math.max(maxT, t);
            events.push({ type: "vote", itemId, uid, time: t });
        });
    });

    if (minT === Infinity) minT = new Date("2026-01-17T00:00:00Z").getTime();
    maxT = Math.max(maxT, Date.now());

    timelineMinTime = minT;
    timelineMaxTime = maxT;

    // 3. Group by distinct days for visual markers
    const dayGroups = {};
    events.forEach((ev) => {
        const dayKey = new Date(ev.time).toISOString().split("T")[0];
        if (!dayGroups[dayKey]) {
            dayGroups[dayKey] = {
                dayKey,
                time: ev.time,
                items: 0,
                votes: 0,
                itemNames: [],
            };
        }
        if (ev.type === "item") {
            dayGroups[dayKey].items++;
            dayGroups[dayKey].itemNames.push(ev.name);
        }
        if (ev.type === "vote") {
            dayGroups[dayKey].votes++;
        }
    });

    renderTimelineMarkers(Object.values(dayGroups));
}

function renderTimelineMarkers(groups) {
    const markersContainer = document.getElementById("timeline-activity-markers");
    if (!markersContainer) return;
    markersContainer.innerHTML = "";

    const span = Math.max(1, timelineMaxTime - timelineMinTime);

    groups.forEach((g) => {
        const pct = Math.max(0, Math.min(100, ((g.time - timelineMinTime) / span) * 100));
        const marker = document.createElement("div");
        marker.className = "timeline-marker";
        // Calculate exact center matching the slider thumb track travel (insets 9px from edges)
        marker.style.left = `calc(9px + (100% - 18px) * ${(pct / 100).toFixed(4)})`;

        const tick = document.createElement("div");
        tick.className = "timeline-marker-tick";
        marker.appendChild(tick);

        const dot = document.createElement("div");
        dot.className = "timeline-marker-dot";
        marker.appendChild(dot);

        const { dateStr } = formatTimelineDate(g.time);
        let desc = `${dateStr}: `;
        const details = [];
        if (g.items > 0) details.push(`${g.items} tool${g.items > 1 ? "s" : ""} added`);
        if (g.votes > 0) details.push(`${g.votes} vote${g.votes > 1 ? "s" : ""}`);
        desc += details.join(", ") || "Activity recorded";

        const tooltip = document.createElement("div");
        tooltip.className = "timeline-marker-tooltip";
        tooltip.textContent = desc;
        marker.appendChild(tooltip);

        marker.onclick = (e) => {
            e.stopPropagation();
            pauseTimeline();
            const slider = document.getElementById("timeline-slider");
            if (slider) slider.value = pct.toFixed(1);
            applyTimelinePosition(pct, { skipSplashes: false, direction: 1 });
        };

        markersContainer.appendChild(marker);
    });
}

function applyTimelinePosition(sliderPercent, options = {}) {
    const span = timelineMaxTime - timelineMinTime;
    const targetTime = timelineMinTime + (sliderPercent / 100) * span;
    applyTimelineTimestamp(targetTime, options);
}

function applyTimelineTimestamp(targetTime, options = {}) {
    const container = document.getElementById("graph-container");
    if (!container) return;

    const span = Math.max(1, timelineMaxTime - timelineMinTime);
    const sliderPercent = Math.max(0, Math.min(100, ((targetTime - timelineMinTime) / span) * 100));

    const slider = document.getElementById("timeline-slider");
    if (slider && !options.fromSliderInput) {
        slider.value = sliderPercent.toFixed(1);
    }

    const progressFill = document.getElementById("timeline-progress-fill");
    if (progressFill) {
        progressFill.style.width = sliderPercent.toFixed(1) + "%";
    }

    // Direction tracking for splash triggers
    const direction = options.direction !== undefined ? options.direction : (targetTime >= lastScrubTimestamp ? 1 : -1);
    lastScrubTimestamp = targetTime;
    currentTimelineTimestamp = targetTime;

    const isLive = sliderPercent >= 99.8 || targetTime >= timelineMaxTime - 10000;

    // Update Date Display
    const dateLabel = document.getElementById("timeline-date-label");
    const timeLabel = document.getElementById("timeline-sub-label");
    const livePill = document.getElementById("timeline-live-btn");

    if (dateLabel && timeLabel) {
        if (isLive) {
            dateLabel.innerText = "Today";
            timeLabel.innerText = "Live";
        } else {
            const f = formatTimelineDate(targetTime);
            dateLabel.innerText = f.dateStr;
            timeLabel.innerText = f.timeStr;
        }
    }

    if (livePill) {
        if (isLive) livePill.classList.add("active");
        else livePill.classList.remove("active");
    }

    if (isLive) {
        container.classList.remove("mode-timeline");
    } else {
        container.classList.add("mode-timeline");
    }

    const items = itemsCache || {};
    const allVotes = latestLiveVotes || previousData || {};

    renderedItems.forEach((itemId) => {
        const item = items[itemId];
        const dot = document.getElementById(`dot-${itemId}`);
        const panelRow = document.getElementById(`panel-row-${itemId}`);
        if (!item || !dot) return;

        const itemCreated = getItemCreationTimestamp(itemId, item);
        const isActive = itemCreated <= targetTime;

        if (!isActive) {
            // Item was created in the future -> Hide
            if (visibleItemIdsAtCurrentTime.has(itemId)) {
                visibleItemIdsAtCurrentTime.delete(itemId);
            }
            dot.style.transition = "opacity 0.25s ease";
            dot.style.opacity = "0";
            dot.style.pointerEvents = "none";
            if (panelRow) panelRow.style.display = "none";
        } else {
            // Item was active at this historical time
            const isNewlyRevealed = !visibleItemIdsAtCurrentTime.has(itemId);
            visibleItemIdsAtCurrentTime.add(itemId);

            dot.style.opacity = "1";
            dot.style.pointerEvents = isLive ? "" : "none";
            if (panelRow) panelRow.style.display = "";

            // Gather votes that occurred before or at targetTime
            const itemVotes = allVotes[itemId] || {};
            const activeVotes = {};
            Object.keys(itemVotes).forEach((uid) => {
                const v = itemVotes[uid];
                const voteTime = getVoteTimestamp(itemId, uid, v);
                if (voteTime <= targetTime) {
                    activeVotes[uid] = v;
                }
            });

            // Compute consensus for active votes
            const cons = computeConsensus(item, activeVotes);
            let targetX = cons.x;
            let targetY = viewMode === "1D" ? 50 : cons.y;

            // Dot movement animation
            if (options.immediate) {
                dot.style.transition = "none";
            } else if (isTimelinePlaying) {
                dot.style.transition = "left 0.1s linear, bottom 0.1s linear, background-color 0.2s";
            } else {
                dot.style.transition = "left 0.3s ease-out, bottom 0.3s ease-out, background-color 0.3s";
            }

            updateElementPosition(dot, targetX, targetY);
            updateDotColor(dot, targetY);
            const label = document.getElementById(`label-${itemId}`);
            if (label) updateLabelPosition(label, targetY);

            // Update Tooltip values
            const valX = document.getElementById(`val-x-${itemId}`);
            const valY = document.getElementById(`val-y-${itemId}`);
            if (valX) valX.innerText = Math.round(targetX);
            if (valY) valY.innerText = Math.round(targetY);

            // Update Panel Metric Bars
            const barGen = document.getElementById(`bar-gen-${itemId}`);
            const barReady = document.getElementById(`bar-ready-${itemId}`);
            const numGen = document.getElementById(`num-gen-${itemId}`);
            const numReady = document.getElementById(`num-ready-${itemId}`);
            if (barGen) barGen.style.width = Math.round(targetX) + "%";
            if (barReady) {
                barReady.style.width = Math.round(targetY) + "%";
                barReady.style.backgroundColor = readinessColor(targetY);
            }
            const rowNum = document.getElementById(`rownum-${itemId}`);
            if (rowNum) {
                const rc = readinessColor(targetY);
                rowNum.style.backgroundColor = rc;
                rowNum.style.borderColor = rc;
            }
            if (numGen) numGen.textContent = Math.round(targetX) + "%";
            if (numReady) numReady.textContent = Math.round(targetY) + "%";

            // Trigger splash for newly introduced tools when scrubbing/playing forward!
            if (isNewlyRevealed && direction > 0 && !options.skipSplashes) {
                if (itemId.startsWith("user_item_")) {
                    triggerMegaSplash(container, targetX, targetY);
                }
            }
        }
    });

    if (isLive) {
        scheduleResolveLabels();
    }
}

async function openTimeline() {
    isTimelineOpen = true;
    const bar = document.getElementById("timeline-bar");
    const btn = document.getElementById("timeline-btn");
    const container = document.getElementById("graph-container");
    if (btn) btn.classList.add("active");
    if (bar) bar.style.display = "flex";

    closeAllTooltips();

    if (!baselineSnapshot) {
        try {
            const res = await fetch("./data/snapshot.json", { cache: "no-cache" });
            if (res.ok) baselineSnapshot = await res.json();
        } catch (e) {
            console.warn("Could not load snapshot for timeline baseline", e);
        }
    }

    buildTimelineData();

    // Set slider to 100% (Live) initially
    applyTimelinePosition(100, { skipSplashes: true, isLive: true });
}

function closeTimeline() {
    isTimelineOpen = false;
    pauseTimeline();
    const bar = document.getElementById("timeline-bar");
    const btn = document.getElementById("timeline-btn");
    const container = document.getElementById("graph-container");
    if (btn) btn.classList.remove("active");
    if (bar) bar.style.display = "none";
    if (container) container.classList.remove("mode-timeline");

    jumpToLive();
}

function playTimeline() {
    if (isTimelinePlaying) return;
    const slider = document.getElementById("timeline-slider");
    if (!slider) return;

    if (parseFloat(slider.value) >= 99.5) {
        slider.value = "0";
        applyTimelinePosition(0, { skipSplashes: true, immediate: true });
    }

    isTimelinePlaying = true;
    updatePlayPauseIcons(true);

    let lastTime = performance.now();
    const PLAY_SPEED = 10; // Percent per second (~10s total duration)

    function step(now) {
        if (!isTimelinePlaying) return;
        const delta = (now - lastTime) / 1000;
        lastTime = now;

        const currentPct = parseFloat(slider.value) || 0;
        const nextPct = currentPct + delta * PLAY_SPEED;

        if (nextPct >= 100) {
            slider.value = "100";
            applyTimelinePosition(100, { direction: 1, skipSplashes: false });
            pauseTimeline();
            jumpToLive();
            return;
        }

        slider.value = nextPct.toFixed(2);
        applyTimelinePosition(nextPct, { direction: 1, skipSplashes: false });
        timelineAnimationId = requestAnimationFrame(step);
    }

    timelineAnimationId = requestAnimationFrame(step);
}

function pauseTimeline() {
    isTimelinePlaying = false;
    if (timelineAnimationId) {
        cancelAnimationFrame(timelineAnimationId);
        timelineAnimationId = null;
    }
    updatePlayPauseIcons(false);
}

function updatePlayPauseIcons(isPlaying) {
    const playIcon = document.querySelector(".timeline-play-icon");
    const pauseIcon = document.querySelector(".timeline-pause-icon");
    if (playIcon) playIcon.style.display = isPlaying ? "none" : "block";
    if (pauseIcon) pauseIcon.style.display = isPlaying ? "block" : "none";
}

function jumpToLive() {
    pauseTimeline();
    const slider = document.getElementById("timeline-slider");
    if (slider) slider.value = "100";

    const container = document.getElementById("graph-container");
    if (container) container.classList.remove("mode-timeline");

    applyTimelinePosition(100, { skipSplashes: true, isLive: true });

    // Restore full live state and clear inline transitions
    renderedItems.forEach((itemId) => {
        const dot = document.getElementById(`dot-${itemId}`);
        if (dot) {
            dot.style.transition = "";
            dot.style.opacity = "1";
            dot.style.pointerEvents = "";
        }
    });

    const votesData = latestLiveVotes || previousData;
    if (container) updateGraphFromData(votesData, container);
    scheduleResolveLabels();
}

// --- INTERACTIVE ONBOARDING CONTROLLER ---
const ONBOARD_TOOLS = [
    {
        id: "d_sound",
        name: "Denoising Sound",
        badge: "Utility",
        badgeClass: "badge-algorithmic",
        x: 6.6,
        y: 94.9,
    },
    {
        id: "char_inbetween",
        name: "Character In-Betweening",
        badge: "In-Between",
        badgeClass: "badge-middle",
        x: 62.6,
        y: 61.3,
    },
    {
        id: "idea_script",
        name: "Idea to Script",
        badge: "Generative",
        badgeClass: "badge-creative",
        x: 97.0,
        y: 10.8,
    },
];

function positionOnboardingCard(card, tool, index, step) {
    if (!card) return;
    const usePhoneLayout = isMobileGraphExperience();
    const mobileX = [17, 50, 83][index];
    const mobileY = [82, 55, 20][index];
    const x = usePhoneLayout ? mobileX : tool.x;
    const y = step === 1 ? (usePhoneLayout ? 42 : 44) : (usePhoneLayout ? mobileY : tool.y);

    card.style.left = `${x}%`;
    card.style.bottom = `${y}%`;
    card.classList.remove("card-left", "card-right");
    if (!usePhoneLayout) {
        if (x < 15) card.classList.add("card-left");
        else if (x > 85) card.classList.add("card-right");
    }
}

let onboardingTimers = [];
let isStepAnimating = false;

function clearOnboardingTimers() {
    onboardingTimers.forEach((t) => clearTimeout(t));
    onboardingTimers = [];
    isStepAnimating = false;
}

function addOnboardingTimer(fn, delay) {
    const timer = setTimeout(fn, delay);
    onboardingTimers.push(timer);
    return timer;
}

function fastForwardCurrentStep() {
    if (!isStepAnimating) return;
    clearOnboardingTimers();

    if (onboardingStep === 1) {
        const xLine = document.getElementById("onboard-x-spectrum-line");
        if (xLine) xLine.classList.add("visible");

        ONBOARD_TOOLS.forEach((tool, index) => {
            const card = document.getElementById(`onboard-card-${index + 1}`);
            if (card) {
                card.className = "onboard-sample-card visible";
                positionOnboardingCard(card, tool, index, 1);
            }
        });

        const sidebar = document.getElementById("onboard-sidebar-panel");
        if (sidebar) sidebar.classList.add("visible");
    } else if (onboardingStep === 2) {
        const yLine = document.getElementById("onboard-y-spectrum-line");
        if (yLine) yLine.classList.add("visible");

        ONBOARD_TOOLS.forEach((tool, index) => {
            const card = document.getElementById(`onboard-card-${index + 1}`);
            if (card) {
                card.className = "onboard-sample-card visible";
                positionOnboardingCard(card, tool, index, 2);
            }
        });

        const sidebar = document.getElementById("onboard-sidebar-panel");
        if (sidebar) sidebar.classList.add("visible");
    }
}

function handleOnboardingAdvance() {
    if (isStepAnimating) {
        fastForwardCurrentStep();
    } else {
        if (onboardingStep === 1) renderOnboardingStep2();
        else if (onboardingStep === 2) completeOnboarding();
    }
}

function setupOnboardingEventListeners() {
    const overlay = document.getElementById("onboarding-overlay");
    const nextBtn = document.getElementById("onboard-next-btn");
    const skipBtn = document.getElementById("onboard-skip-btn");

    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            handleOnboardingAdvance();
        };
    }

    if (skipBtn) {
        skipBtn.onclick = (e) => {
            e.stopPropagation();
            skipOnboarding();
        };
    }

    if (overlay) {
        overlay.onclick = (e) => {
            if (e.target.closest("button") || e.target.closest("#onboard-sidebar-panel")) return;
            handleOnboardingAdvance();
        };
    }
}

function startOnboarding(force = false) {
    clearOnboardingTimers();
    isOnboardingActive = true;
    onboardingStep = 1;

    const overlay = document.getElementById("onboarding-overlay");
    const container = document.getElementById("graph-container");
    const panel = document.getElementById("tool-panel-inner");
    const sidebar = document.getElementById("onboard-sidebar-panel");
    if (!overlay || !container) return;
    document.body.classList.add("onboarding-active");

    overlay.style.display = "block";
    overlay.style.opacity = "1";

    if (sidebar) {
        sidebar.style.display = "flex";
        sidebar.classList.remove("visible");
    }

    // Hide standard tools and panel rows during onboarding
    container.querySelectorAll(".dot").forEach((d) => {
        d.classList.add("onboarding-hidden");
        d.classList.remove("cascade-revealing");
    });
    if (panel) {
        panel.querySelectorAll(".panel-row").forEach((r) => {
            r.classList.add("onboarding-hidden");
            r.classList.remove("cascade-revealing");
        });
    }

    // Hide standard axis labels
    container.querySelectorAll(".axis-label").forEach((l) => (l.style.opacity = "0"));
    const controls = document.getElementById("top-right-controls");
    if (controls) controls.style.opacity = "0.2";

    renderOnboardingStep1();
}

function renderOnboardingStep1() {
    clearOnboardingTimers();
    onboardingStep = 1;
    isStepAnimating = true;

    const overlay = document.getElementById("onboarding-overlay");
    const sidebar = document.getElementById("onboard-sidebar-panel");
    if (!overlay) return;

    // Reset lines
    const xLine = document.getElementById("onboard-x-spectrum-line");
    const yLine = document.getElementById("onboard-y-spectrum-line");
    if (xLine) xLine.classList.remove("visible");
    if (yLine) yLine.classList.remove("visible");

    // Words
    const wordXLeft = document.getElementById("onboard-word-x-left");
    const wordXRight = document.getElementById("onboard-word-x-right");
    const wordYTop = document.getElementById("onboard-word-y-top");
    const wordYBottom = document.getElementById("onboard-word-y-bottom");

    if (wordXLeft) {
        wordXLeft.className = "onboard-hero-word x-left";
        wordXLeft.style.opacity = "1";
    }
    if (wordXRight) {
        wordXRight.className = "onboard-hero-word x-right";
        wordXRight.style.opacity = "1";
    }
    if (wordYTop) wordYTop.style.opacity = "0";
    if (wordYBottom) wordYBottom.style.opacity = "0";

    // Reset cards to hidden state
    ONBOARD_TOOLS.forEach((tool, index) => {
        const card = document.getElementById(`onboard-card-${index + 1}`);
        if (card) {
            card.className = "onboard-sample-card";
            positionOnboardingCard(card, tool, index, 1);
        }
    });

    // Populate Sidebar Content
    const indicator = document.getElementById("onboard-step-indicator");
    const title = document.getElementById("onboard-title");
    const body = document.getElementById("onboard-body");
    const caveat = document.getElementById("onboard-caveat");
    const nextBtn = document.getElementById("onboard-next-btn");

    if (indicator) indicator.innerText = "Step 1 of 2";
    if (title) title.innerText = "The Spectrum of Autonomy";
    if (body) body.innerText = "Tools range from algorithmic utility to open-ended creative generation.";
    if (caveat) caveat.innerText = "This is not designed to be a definitive document that describes all the tools available for filmmaking: there are certainly some that are missing.";
    if (nextBtn) nextBtn.innerText = "Next →";

    if (sidebar) {
        sidebar.style.display = "flex";
        sidebar.classList.remove("visible");
    }

    // Phased Animation:
    // Phase 2 (0.8s): Wipe on horizontal arrow line
    addOnboardingTimer(() => {
        if (xLine) xLine.classList.add("visible");
    }, 800);

    // Phase 3: Pop on tools one by one
    // Tool 1: Denoising Sound (Utility) at 1.8s
    addOnboardingTimer(() => {
        const card1 = document.getElementById("onboard-card-1");
        if (card1) card1.classList.add("visible");
    }, 1800);

    // Tool 2: Character In-Betweening (In-Between) at 2.6s
    addOnboardingTimer(() => {
        const card2 = document.getElementById("onboard-card-2");
        if (card2) card2.classList.add("visible");
    }, 2600);

    // Tool 3: Idea to Script (Generative) at 3.4s
    addOnboardingTimer(() => {
        const card3 = document.getElementById("onboard-card-3");
        if (card3) card3.classList.add("visible");
    }, 3400);

    // Phase 4 (4.2s): Sidebar card fades in
    addOnboardingTimer(() => {
        if (sidebar) sidebar.classList.add("visible");
        isStepAnimating = false;
    }, 4200);
}

function renderOnboardingStep2() {
    clearOnboardingTimers();
    onboardingStep = 2;
    isStepAnimating = true;

    const overlay = document.getElementById("onboarding-overlay");
    const sidebar = document.getElementById("onboard-sidebar-panel");
    if (!overlay) return;

    // Animate X words flying down to axis
    const wordXLeft = document.getElementById("onboard-word-x-left");
    const wordXRight = document.getElementById("onboard-word-x-right");
    const wordYTop = document.getElementById("onboard-word-y-top");
    const wordYBottom = document.getElementById("onboard-word-y-bottom");

    if (wordXLeft) wordXLeft.classList.add("flying-down");
    if (wordXRight) wordXRight.classList.add("flying-down");

    // Fade out X spectrum line
    const xLine = document.getElementById("onboard-x-spectrum-line");
    if (xLine) xLine.classList.remove("visible");

    // Fade in standard bottom axis labels
    const container = document.getElementById("graph-container");
    if (container) {
        const xLeft = container.querySelector(".x-label-left");
        const xRight = container.querySelector(".x-label-right");
        if (xLeft) xLeft.style.opacity = "1";
        if (xRight) xRight.style.opacity = "1";
    }

    // Bring on large Y words
    if (wordYTop) {
        wordYTop.className = "onboard-hero-word y-top";
        wordYTop.style.opacity = "1";
    }
    if (wordYBottom) {
        wordYBottom.className = "onboard-hero-word y-bottom";
        wordYBottom.style.opacity = "1";
    }

    // Hide sidebar temporarily while animation plays
    if (sidebar) sidebar.classList.remove("visible");

    // Update Sidebar text for Step 2
    const indicator = document.getElementById("onboard-step-indicator");
    const title = document.getElementById("onboard-title");
    const body = document.getElementById("onboard-body");
    const caveat = document.getElementById("onboard-caveat");
    const nextBtn = document.getElementById("onboard-next-btn");

    if (indicator) indicator.innerText = "Step 2 of 2";
    if (title) title.innerText = "Production Readiness";
    if (body) body.innerText = "The vertical axis reflects whether a tool is currently reliable for production workflows or still experimental.";
    if (caveat) caveat.innerText = "The precise position of the tools on the graph is just the subjective opinion of those who have voted on the project so far.";
    if (nextBtn) nextBtn.innerText = "Explore Spectrum →";

    // Phase 2 (0.8s): Draw vertical graduated spectrum line with arrows
    const yLine = document.getElementById("onboard-y-spectrum-line");
    addOnboardingTimer(() => {
        if (yLine) yLine.classList.add("visible");
    }, 800);

    // Phase 3: Animate tools into their 2D Y positions
    // Tool 1: Denoising Sound rises to 94.9% at 1.5s
    addOnboardingTimer(() => {
        const card1 = document.getElementById("onboard-card-1");
        positionOnboardingCard(card1, ONBOARD_TOOLS[0], 0, 2);
    }, 1500);

    // Tool 2: Character In-Betweening glides to 61.3% at 2.2s
    addOnboardingTimer(() => {
        const card2 = document.getElementById("onboard-card-2");
        positionOnboardingCard(card2, ONBOARD_TOOLS[1], 1, 2);
    }, 2200);

    // Tool 3: Idea to Script glides to 10.8% at 2.9s
    addOnboardingTimer(() => {
        const card3 = document.getElementById("onboard-card-3");
        positionOnboardingCard(card3, ONBOARD_TOOLS[2], 2, 2);
    }, 2900);

    // Phase 4 (3.8s): Sidebar card fades up
    addOnboardingTimer(() => {
        if (sidebar) sidebar.classList.add("visible");
        isStepAnimating = false;
    }, 3800);
}

function completeOnboarding() {
    if (!isOnboardingActive) return;
    clearOnboardingTimers();
    onboardingStep = 3;

    const overlay = document.getElementById("onboarding-overlay");
    const container = document.getElementById("graph-container");
    const panel = document.getElementById("tool-panel-inner");
    const sidebar = document.getElementById("onboard-sidebar-panel");

    // Animate Y words flying to axis
    const wordYTop = document.getElementById("onboard-word-y-top");
    const wordYBottom = document.getElementById("onboard-word-y-bottom");
    if (wordYTop) wordYTop.classList.add("flying-axis");
    if (wordYBottom) wordYBottom.classList.add("flying-axis");

    // Fade out lines
    const yLine = document.getElementById("onboard-y-spectrum-line");
    if (yLine) yLine.classList.remove("visible");

    // Fade out sample cards & sidebar panel
    if (overlay) {
        overlay.querySelectorAll(".onboard-sample-card").forEach((c) => c.classList.remove("visible"));
    }
    if (sidebar) {
        sidebar.classList.remove("visible");
        setTimeout(() => {
            sidebar.style.display = "none";
        }, 500);
    }

    // Fade in all standard axis labels and top-right controls
    if (container) {
        container.querySelectorAll(".axis-label").forEach((l) => (l.style.opacity = "1"));
        const controls = document.getElementById("top-right-controls");
        if (controls) controls.style.opacity = "1";
    }

    // Fade out overlay
    setTimeout(() => {
        if (overlay) {
            overlay.style.opacity = "0";
            setTimeout(() => {
                overlay.style.display = "none";
                document.body.classList.remove("onboarding-active");
            }, 500);
        }
    }, 400);

    // Staggered Diagonal Tool Reveal (~1.4s total)
    revealToolsInCascade();

    localStorage.setItem("onboarding_seen", "true");
    localStorage.setItem("disclaimer_seen", "true");
    isOnboardingActive = false;
}

function skipOnboarding() {
    clearOnboardingTimers();
    document.body.classList.remove("onboarding-active");
    const overlay = document.getElementById("onboarding-overlay");
    const container = document.getElementById("graph-container");
    const panel = document.getElementById("tool-panel-inner");
    const sidebar = document.getElementById("onboard-sidebar-panel");

    if (overlay) {
        overlay.style.display = "none";
        overlay.style.opacity = "0";
    }
    if (sidebar) {
        sidebar.style.display = "none";
        sidebar.classList.remove("visible");
    }

    if (container) {
        container.querySelectorAll(".dot").forEach((d) => {
            d.classList.remove("onboarding-hidden");
            d.classList.remove("cascade-revealing");
        });
        container.querySelectorAll(".axis-label").forEach((l) => (l.style.opacity = "1"));
        const controls = document.getElementById("top-right-controls");
        if (controls) controls.style.opacity = "1";
    }

    if (panel) {
        panel.querySelectorAll(".panel-row").forEach((r) => {
            r.classList.remove("onboarding-hidden");
            r.classList.remove("cascade-revealing");
        });
    }

    localStorage.setItem("onboarding_seen", "true");
    localStorage.setItem("disclaimer_seen", "true");
    isOnboardingActive = false;
}

function revealToolsInCascade() {
    const container = document.getElementById("graph-container");
    const panel = document.getElementById("tool-panel-inner");
    if (!container) return;

    const dots = Array.from(container.querySelectorAll(".dot"));
    if (dots.length === 0) return;

    // Calculate diagonal ranking: (100 - Y) + X (top-left first, bottom-right last)
    const scoredDots = dots.map((dot) => {
        const x = dot.dataset.realX != null ? parseFloat(dot.dataset.realX) : 50;
        const y = dot.dataset.realY != null ? parseFloat(dot.dataset.realY) : 50;
        const score = (100 - y) + x;
        const itemId = dot.id.replace("dot-", "");
        return { dot, itemId, score };
    });

    scoredDots.sort((a, b) => a.score - b.score);

    const totalDuration = 1400; // ms (~1.4s total)
    const stepDuration = totalDuration / Math.max(1, scoredDots.length - 1);

    scoredDots.forEach((item, index) => {
        const delay = index * stepDuration;
        setTimeout(() => {
            item.dot.classList.remove("onboarding-hidden");
            item.dot.classList.add("cascade-revealing");

            const row = document.getElementById(`panel-row-${item.itemId}`);
            if (row) {
                row.classList.remove("onboarding-hidden");
                row.classList.add("cascade-revealing");
            }
        }, delay);
    });

    // Cleanup and show drag-to-vote tip after cascade ends
    setTimeout(() => {
        dots.forEach((d) => d.classList.remove("cascade-revealing"));
        if (panel) {
            panel.querySelectorAll(".panel-row").forEach((r) => r.classList.remove("cascade-revealing"));
        }
        showDragVoteTip();
    }, totalDuration + 400);
}

function showDragVoteTip() {
    let tip = document.getElementById("drag-vote-tip");
    const container = document.getElementById("graph-container");
    if (!tip && container) {
        tip = document.createElement("div");
        tip.id = "drag-vote-tip";
        tip.innerHTML = "💡 <strong>Tip:</strong> Drag any tool dot or click in the list to cast your vote!";
        container.appendChild(tip);
    }
    if (tip) {
        tip.classList.add("show");
        setTimeout(() => {
            tip.classList.remove("show");
        }, 5000);
    }
}

// Keyboard Navigation for Onboarding
document.addEventListener("keydown", (e) => {
    if (!isOnboardingActive) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        handleOnboardingAdvance();
    } else if (e.key === "Escape") {
        e.preventDefault();
        skipOnboarding();
    }
});

// Replay Intro Button Handler
const replayBtn = document.getElementById("replay-intro-btn");
if (replayBtn) {
    replayBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const header = document.getElementById("header");
        if (header) header.classList.remove("settings-open");
        startOnboarding(true);
    };
}

// --- DISCLAIMER MODAL LOGIC & ONBOARDING ENTRY ---
const disclaimerModal = document.getElementById("disclaimer-modal");
const disclaimerSeen = localStorage.getItem("disclaimer_seen");
const onboardingSeen = localStorage.getItem("onboarding_seen");

if (disclaimerModal && !disclaimerSeen) {
    disclaimerModal.style.display = "flex";
    const dismissDisclaimer = () => {
        disclaimerModal.style.display = "none";
        localStorage.setItem("disclaimer_seen", "true");
        startOnboarding();
    };
    const btn = document.getElementById("disclaimer-btn");
    if (btn) btn.onclick = dismissDisclaimer;
    disclaimerModal.onclick = (e) => {
        if (e.target === disclaimerModal) dismissDisclaimer();
    };
} else if (!onboardingSeen) {
    // If disclaimer was accepted in previous version but onboarding not seen yet
    startOnboarding();
}

// --- SETTINGS POPUP (portrait header: voter/privacy/contact) ---
window.toggleSettingsMenu = function (e) {
    if (e) e.stopPropagation();
    const header = document.getElementById("header");
    if (header) header.classList.toggle("settings-open");
};

document.addEventListener("click", (e) => {
    const header = document.getElementById("header");
    if (!header || !header.classList.contains("settings-open")) return;
    // The toggle button manages its own open/close
    if (e.target.closest("#settings-toggle")) return;
    // Clicks on empty menu chrome keep it open; links / username close it
    const inMenu = e.target.closest("#header-meta");
    const isAction = e.target.closest("a") || e.target.closest("button") || e.target.closest("#user-display");
    if (inMenu && !isAction) return;
    header.classList.remove("settings-open");
});
