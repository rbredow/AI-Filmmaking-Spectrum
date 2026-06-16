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
// If the live check can't be reached we fall back to the snapshot's own flag,
// so a network hiccup never strands us. ?live=1 always forces the live path.
let isStaticMode = false;
let staticSnapshot = null;

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
    const forceLive = new URLSearchParams(window.location.search).has("live");

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

    // Prefer the live voting flag. If it couldn't be read, fall back to the
    // snapshot's own flag so a hiccup never strands us in the wrong mode.
    const votingOpen =
        liveSettings != null
            ? liveSettings.votingEnabled === true
            : !!(snapshot && snapshot.settings && snapshot.settings.votingEnabled);

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

function startStatic(snapshot) {
    // No Firebase auth: currentUser stays null, which gates off every drag/
    // vote/write path. isAdmin is false too — admins use ?live=1 to manage.
    isStaticMode = true;
    staticSnapshot = snapshot;
    isAdmin = false;
    votingEnabled = !!(snapshot.settings && snapshot.settings.votingEnabled);
    addingEnabled = !!(snapshot.settings && snapshot.settings.addingEnabled);
    updateAdminUI();
    ensureDisplayName();
    initApp();
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
            <div id="search-container">
                <span id="search-icon">🔍</span>
                <input type="text" id="search-input" placeholder="Search...">
            </div>
            <div id="branch-filter-container">
                <div id="branch-filter-btn" title="Filter by Branch">Branch ▾</div>
                <div id="branch-filter-dropdown" style="display: none;"></div>
            </div>
            <div id="view-mode-btn" title="Toggle 1D/2D View">2D</div>
            <div id="add-item-btn" title="Add New Tool">+ New Tool</div>
        </div>
    `;
    renderedItems.clear();

    // Re-bind Toggle (since we wiped innerHTML)
    document.getElementById("view-mode-btn").onclick = () => {
        const btn = document.getElementById("view-mode-btn");
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
                applyFilters();
            };
        });
        
        document.addEventListener("click", () => {
            branchDropdown.style.display = "none";
        });
    }

    // Setup Search Logic
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.oninput = () => applyFilters();
    }

    function applyFilters() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
        const container = document.getElementById("graph-container");
        
        let hasFilter = query !== "" || selectedTags.size > 0;

        if (hasFilter) {
            container.classList.add("searching");
            renderedItems.forEach((id) => {
                const dot = document.getElementById(`dot-${id}`);
                const label = document.getElementById(`label-${id}`);
                const item = itemsCache[id];
                
                let matchesSearch = true;
                if (query) {
                    matchesSearch = label && label.innerText.toLowerCase().includes(query);
                }

                let matchesTag = true;
                if (selectedTags.size > 0) {
                    if (!item || !item.tags || item.tags.length === 0) {
                        matchesTag = false;
                    } else {
                        matchesTag = item.tags.some(tag => selectedTags.has(tag));
                    }
                }

                if (dot) {
                    if (matchesSearch && matchesTag) dot.classList.add("search-match");
                    else dot.classList.remove("search-match");
                }
            });
        } else {
            container.classList.remove("searching");
            renderedItems.forEach((id) => {
                const dot = document.getElementById(`dot-${id}`);
                if (dot) dot.classList.remove("search-match");
            });
        }
    }

    svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.id = "connections-layer";
    svgLayer.setAttribute("viewBox", "0 0 100 100");
    svgLayer.setAttribute("preserveAspectRatio", "none");
    container.appendChild(svgLayer);

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
    }

    function applyVotes(data) {
        updateGraphFromData(data || {}, container);
    }

    function applySettings(settings) {
        const s = settings || { votingEnabled: true, addingEnabled: true };
        votingEnabled = s.votingEnabled;
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
        setTimeout(() => {
            closeAllTooltips();
        }, 100);
    });

    // Handle resize
    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            closeAllTooltips();
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
            remove(ref(db, "votes/" + modal.dataset.itemId + "/" + currentUser.uid));
        }
    };

    submitBtn.onclick = async () => {
        // If name input is visible, validate and save it
        if (nameSection.style.display !== "none") {
            const val = nameInput.value.trim();
            if (!val) return alert("Please enter a username.");

            userDisplayName = val;
            hasConfirmedName = true;
            localStorage.setItem("voter_name", userDisplayName);
            localStorage.setItem("voter_name_confirmed", "true");
            updateUsernameUI();

            // Update the vote we just cast with the new name
            if (modal.dataset.itemId && currentUser) {
                update(
                    ref(db, "votes/" + modal.dataset.itemId + "/" + currentUser.uid),
                    {
                        username: userDisplayName,
                    },
                );
            }
        }

        isConfirmingVote = false;
        modal.style.display = "none";
    };
}

function createItemElements(container, item) {
    const avgDot = document.createElement("div");
    avgDot.className = "dot";
    avgDot.id = `dot-${item.id}`;
    updateElementPosition(avgDot, item.x, item.y);
    updateDotColor(avgDot, item.y);

    const numBadge = document.createElement("span");
    numBadge.className = "dot-number";
    numBadge.id = `dotnum-${item.id}`;
    avgDot.appendChild(numBadge);

    const label = document.createElement("div");
    label.className = "dot-label";
    label.innerText = item.name;
    label.id = `label-${item.id}`;
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

// --- TOOL PANEL RENDER ---
function renderToolPanel() {
    const panelInner = document.getElementById("tool-panel-inner");
    if (!panelInner) return;

    // Sort items by name for a readable list
    const items = Object.values(itemsCache).sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
    );

    // Build rows once. We'll update metric bars/numbers via updateGraphFromData.
    // Clear existing rows first (handles item additions/removals in live mode).
    panelInner.innerHTML = "";

    items.forEach((item, index) => {
        const number = index + 1;
        // Read consensus position from DOM if available (works in both modes)
        const dot = document.getElementById(`dot-${item.id}`);
        const xVal = dot && dot.dataset.realX != null ? Math.round(parseFloat(dot.dataset.realX)) : Math.round(item.x || 0);
        const yVal = dot && dot.dataset.realY != null ? Math.round(parseFloat(dot.dataset.realY)) : Math.round(item.y || 0);

        const row = document.createElement("div");
        row.className = "panel-row";
        row.id = `panel-row-${item.id}`;
        row.dataset.itemId = item.id;

        // Tags as chips - built safely via textContent after creation
        const tagsArr = (item.tags && item.tags.length > 0) ? item.tags : [];
        const tagsHtml = tagsArr.map(t => `<span class="panel-tag">${escapeHtml(t)}</span>`).join("");

        // Row HTML — all user fields escaped
        row.innerHTML = `
            <div class="panel-row-head">
                <span class="panel-row-num" id="rownum-${item.id}" style="background-color:${readinessColor(yVal)}; border-color:${readinessColor(yVal)}; color:#0a0a0a;">${number}</span>
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
            highlightItem(item.id);
        });

        panelInner.appendChild(row);

        // Keep the on-graph dot number in sync with this row's number
        const dotNum = document.getElementById(`dotnum-${item.id}`);
        if (dotNum) dotNum.textContent = number;
    });
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
            tapStartTime = Date.now();
            tapStartX = e.touches[0].clientX;
            tapStartY = e.touches[0].clientY;
        },
        { passive: true },
    );

    avgDot.addEventListener("touchend", (e) => {
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
    if (label) label.innerText = item.name;
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
            set(ref(db, "votes/" + item.id + "/" + currentUser.uid), {
                x: Math.round(x * 10) / 10,
                y: Math.round(targetY * 10) / 10,
                username: userDisplayName,
            });
        } else {
            set(ref(db, "votes/" + item.id + "/" + currentUser.uid), {
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10,
                username: userDisplayName,
            });
        }
    }, 50);

    const startDrag = function (clientX, clientY, targetElement, originalEvent) {
        if (!currentUser || isConfirmingVote) return;

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
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                moveAt(touch.clientX, touch.clientY);
            }
        }

        function endDrag() {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("touchmove", onTouchMove);
            document.onmouseup = null;
            document.ontouchend = null;

            const wasDragging = isDragging;
            isDragging = null;
            activeDot.classList.remove("dragging");
            activeDot.style.transition = "";
            activeDot.style.zIndex = "";

            if (activeDot.dataset.tempX) {
                let x = parseFloat(activeDot.dataset.tempX);
                let y = parseFloat(activeDot.dataset.tempY);
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

                set(ref(db, "votes/" + item.id + "/" + currentUser.uid), {
                    x: Math.round(x * 10) / 10,
                    y: Math.round(y * 10) / 10,
                    username: userDisplayName,
                });

                // --- SHOW CONFIRMATION MODAL ---
                isConfirmingVote = true;
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

                // If moved enough, start dragging
                if (moveX > 5 || moveY > 5) {
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

                // If moved enough, start dragging
                if (moveX > 5 || moveY > 5) {
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

            // 1. Splash Logic
            let shouldSplash = false;
            if (!prevVote) shouldSplash = true;
            else if (
                Math.abs(vote.x - prevVote.x) > 1 ||
                Math.abs(vote.y - prevVote.y) > 1
            )
                shouldSplash = true;
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
                    if (
                        shouldSplash ||
                        Date.now() - (window.appLaunchTime || 0) < INITIAL_SHOW_TIME
                    ) {
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
    previousData = JSON.parse(JSON.stringify(allVotes));

    // After all dots have moved, schedule label de-overlap pass
    scheduleResolveLabels();
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
    const name = document.getElementById(`label-${id}`).innerText;
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

// --- DISCLAIMER MODAL LOGIC ---
const disclaimerModal = document.getElementById("disclaimer-modal");
if (disclaimerModal && !localStorage.getItem("disclaimer_seen")) {
    disclaimerModal.style.display = "flex";
    const dismissDisclaimer = () => {
        disclaimerModal.style.display = "none";
        localStorage.setItem("disclaimer_seen", "true");
    };
    const btn = document.getElementById("disclaimer-btn");
    if (btn) btn.onclick = dismissDisclaimer;
    disclaimerModal.onclick = (e) => {
        if (e.target === disclaimerModal) dismissDisclaimer();
    };
} else {
    // Already seen
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
    const isAction = e.target.closest("a") || e.target.closest("#user-display");
    if (inMenu && !isAction) return;
    header.classList.remove("settings-open");
});
