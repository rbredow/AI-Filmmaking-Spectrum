import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, set, update, remove, onValue } from "firebase/database";
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBUyM6Ep-hY6wQthp8IBo5wg0qHqMBlwek",
    authDomain: "ai-filmmaking-spectrum.firebaseapp.com",
    databaseURL: "https://ai-filmmaking-spectrum-default-rtdb.firebaseio.com",
    projectId: "ai-filmmaking-spectrum",
    storageBucket: "ai-filmmaking-spectrum.firebasestorage.app",
    messagingSenderId: "384429643425",
    appId: "1:384429643425:web:66f5fd3c2bd52ccd6702e0",
    measurementId: "G-7WXWDMKW8R"
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
let isDragging = null;
let previousData = {};
let svgLayer = null;
let renderedItems = new Set();
let viewMode = '2D';
const ADMIN_EMAIL = "rob.bredow@gmail.com";
let userDisplayName = "";
let hasConfirmedName = false;
const FADE_TIME = 5000; // 5 seconds
const INITIAL_SHOW_TIME = 8000; // 8 seconds on launch

const COLORS = ["Pink", "Blue", "Green", "Yellow", "Purple", "Orange", "Red", "Teal", "Indigo", "Cyan", "Lime", "Amber", "Deep-Purple", "Light-Blue", "Silver", "Gold"];
const ANIMALS = ["Giraffe", "Hippo", "Zebra", "Lion", "Tiger", "Elephant", "Penguin", "Koala", "Panda", "Fox", "Wolf", "Bear", "Eagle", "Owl", "Shark", "Dolphin", "Whale", "Octopus"];

function generateDefaultUsername() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${color}-${animal}-${num}`;
}

// --- INITIAL DATA SEED ---
const initialItems = [
    { id: "d01", name: "Denoising", x: 4, y: 98, desc: "Mathematical pixel cleanup. Standard in every render engine." },
    { id: "d02", name: "Script Breakdown", x: 10, y: 96, desc: "Scans text to tag props, cast, & scenes automatically." },
    { id: "d03", name: "Upscaling", x: 16, y: 94, desc: "Topaz/Nvidia. Essential for remastering archival footage." },
    { id: "d04", name: "Audio Separation", x: 22, y: 92, desc: "Splitting vocals from music (stems). Industry standard." },
    { id: "d05", name: "Rotoscoping", x: 28, y: 90, desc: "Magic Mask. Automating cutouts. 90% perfect, 10% manual fix." },
    { id: "d06", name: "Auto-Captions", x: 34, y: 95, desc: "Speech-to-text. Integrated into Premiere/DaVinci." },
    { id: "d07", name: "Color Match", x: 38, y: 85, desc: "Matching Camera A colors to Camera B automatically." },
    { id: "d08", name: "Text-Based Edit", x: 44, y: 88, desc: "Edit video by deleting words in the transcript." },
    { id: "d09", name: "Markerless Mocap", x: 48, y: 80, desc: "Move.ai/Wonder Studio. Video -> 3D Animation." },
    { id: "d10", name: "Voice Cloning", x: 54, y: 75, desc: "ElevenLabs. Tone is great, acting performance needs human guiding." },
    { id: "d11", name: "NeRF / Splatting", x: 60, y: 70, desc: "Scanning real locations into 3D space for Virtual Production." },
    { id: "d12", name: "Lip-Sync / Dub", x: 62, y: 60, desc: "Altering mouth movement. Can look 'uncanny' on closeups." },
    { id: "d13", name: "In-painting", x: 68, y: 70, desc: "Removing objects. Great for still shots, struggles with motion." },
    { id: "d14", name: "AI Storyboard", x: 74, y: 85, desc: "Midjourney. High readiness for concepts, but Low utility for final pixel." },
    { id: "d15", name: "Gen Fill (Bg)", x: 78, y: 55, desc: "Extending sets. Hard to maintain temporal consistency." },
    { id: "d16", name: "Text-to-SFX", x: 82, y: 60, desc: "Generating foley or background music. Good for filler." },
    { id: "d17", name: "Text-to-3D", x: 88, y: 40, desc: "Generating 3D props. Topology usually needs manual cleanup." },
    { id: "d18", name: "Text-to-Video", x: 94, y: 25, desc: "Sora/Gen-3. Dream-like visuals. Physics/Continuity break." },
    { id: "d19", name: "Text-to-Movie", x: 98, y: 5, desc: "One button to make a film. Pure fantasy right now." }
];

function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        isAdmin = (user.email === ADMIN_EMAIL);
        updateAdminUI();

        // Check if we already have a display name for this session
        if (!userDisplayName) {
            userDisplayName = localStorage.getItem('voter_name') || generateDefaultUsername();
            hasConfirmedName = !!localStorage.getItem('voter_name_confirmed');
        }
        initApp();
    } else {
        signInAnonymously(auth).catch(e => console.error("Anon Auth failed", e));
    }
});

function showUsernamePrompt() {
    const modal = document.getElementById('username-modal');
    const input = document.getElementById('username-input');
    const submitBtn = document.getElementById('username-submit-btn');

    if (modal && input && submitBtn) {
        modal.style.display = 'flex';
        input.value = userDisplayName;
        input.focus();
        input.select();

        submitBtn.onclick = () => {
            const val = input.value.trim();
            if (val) {
                userDisplayName = val;
                hasConfirmedName = true;
                localStorage.setItem('voter_name', userDisplayName);
                localStorage.setItem('voter_name_confirmed', 'true');
                modal.style.display = 'none';
            }
        };

        // Also handle 'Enter' key
        input.onkeydown = (e) => {
            if (e.key === 'Enter') submitBtn.onclick();
        };
    } else {
        // Fallback if elements not found
        initApp();
    }
}

function updateAdminUI() {
    const resetBtn = document.getElementById('global-reset-btn');
    if (resetBtn) resetBtn.style.display = isAdmin ? 'block' : 'none';
}

if (window.location.search.includes('admin=true')) {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    signInWithPopup(auth, googleProvider).catch((error) => {
        console.error(error);
        alert("Login Failed: " + error.message);
    });
}

function initApp() {
    const container = document.getElementById('graph-container');

    // Setup toggle button logic
    const toggleBtn = document.getElementById('view-mode-btn');
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            if (viewMode === '2D') {
                viewMode = '1D';
                toggleBtn.innerText = '1D';
                container.classList.add('mode-1d');
            } else {
                viewMode = '2D';
                toggleBtn.innerText = '2D';
                container.classList.remove('mode-1d');
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
        <div id="add-item-btn" title="Add New Tool">+</div>
        <div id="view-mode-btn" title="Toggle 1D/2D View">2D</div>
    `;
    renderedItems.clear();

    // Re-bind Toggle (since we wiped innerHTML)
    document.getElementById('view-mode-btn').onclick = () => {
        const btn = document.getElementById('view-mode-btn');
        if (viewMode === '2D') {
            viewMode = '1D';
            btn.innerText = '1D';
            container.classList.add('mode-1d');
        } else {
            viewMode = '2D';
            btn.innerText = '2D';
            container.classList.remove('mode-1d');
        }
    };

    if (viewMode === '1D') container.classList.add('mode-1d');

    svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.id = "connections-layer";
    svgLayer.setAttribute("viewBox", "0 0 100 100");
    svgLayer.setAttribute("preserveAspectRatio", "none");
    container.appendChild(svgLayer);

    setupModalLogic();
    setupEditModalLogic();
    setupResetModalLogic();
    setupGlobalResetLogic();

    const itemsRef = ref(db, 'items');
    onValue(itemsRef, (snapshot) => {
        const itemsData = snapshot.val();
        if (!itemsData) {
            const updates = {};
            initialItems.forEach(item => { updates['items/' + item.id] = item; });
            update(ref(db), updates);
        } else {
            Object.values(itemsData).forEach(item => {
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
            renderedItems.forEach(renderedId => {
                if (!itemsData[renderedId]) {
                    removeItemElements(renderedId);
                    renderedItems.delete(renderedId);
                }
            });
        }
    });

    const votesRef = ref(db, 'votes');
    onValue(votesRef, (snapshot) => {
        const data = snapshot.val() || {};
        updateGraphFromData(data, container);
    });
}

function setupModalLogic() {
    const modal = document.getElementById('new-item-modal');
    const addBtn = document.getElementById('add-item-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const submitBtn = document.getElementById('submit-btn');
    const sliderX = document.getElementById('new-item-x');
    const sliderY = document.getElementById('new-item-y');
    const valX = document.getElementById('slider-x-val');
    const valY = document.getElementById('slider-y-val');

    if (addBtn) addBtn.onclick = () => {
        modal.style.display = 'flex';
        document.getElementById('new-item-name').focus();
    };
    if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';

    sliderX.oninput = () => valX.innerText = sliderX.value;
    sliderY.oninput = () => valY.innerText = sliderY.value;

    submitBtn.onclick = () => {
        const name = document.getElementById('new-item-name').value.trim();
        const desc = document.getElementById('new-item-desc').value.trim();
        const x = parseInt(sliderX.value);
        const y = parseInt(sliderY.value);
        if (!name) return alert("Please enter a name.");
        const newId = 'user_item_' + Date.now();
        const newItem = { id: newId, name: name, desc: desc, x: x, y: y, createdBy: currentUser.uid };
        set(ref(db, 'items/' + newId), newItem);
        set(ref(db, 'votes/' + newId + '/' + currentUser.uid), { x, y, username: userDisplayName });
        modal.style.display = 'none';
        document.getElementById('new-item-name').value = '';
        document.getElementById('new-item-desc').value = '';
    };
}

function setupEditModalLogic() {
    const modal = document.getElementById('edit-item-modal');
    const cancelBtn = document.getElementById('edit-cancel-btn');
    const submitBtn = document.getElementById('edit-submit-btn');
    if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';
    submitBtn.onclick = () => {
        const id = document.getElementById('edit-item-id').value;
        const name = document.getElementById('edit-item-name').value.trim();
        const desc = document.getElementById('edit-item-desc').value.trim();
        if (id && name) {
            update(ref(db, 'items/' + id), { name, desc });
            modal.style.display = 'none';
        }
    };
}

function setupResetModalLogic() {
    const modal = document.getElementById('reset-options-modal');
    const btnBake = document.getElementById('btn-bake');
    const btnClear = document.getElementById('btn-clear');
    const btnCancel = document.getElementById('reset-cancel-btn');

    if (btnCancel) btnCancel.onclick = () => modal.style.display = 'none';

    btnBake.onclick = () => {
        const id = document.getElementById('reset-item-id').value;
        const dot = document.getElementById(`dot-${id}`);
        if (id && dot) {
            // Read current visual position (Consensus)
            const currentX = parseFloat(dot.style.left);
            const currentY = parseFloat(dot.style.bottom);

            // Update Item Baseline & Clear Votes
            update(ref(db, 'items/' + id), { x: currentX, y: currentY });
            remove(ref(db, 'votes/' + id));

            modal.style.display = 'none';
        }
    };

    btnClear.onclick = () => {
        const id = document.getElementById('reset-item-id').value;
        if (id) {
            remove(ref(db, 'votes/' + id));
            modal.style.display = 'none';
        }
    };
}

function setupGlobalResetLogic() {
    const modal = document.getElementById('global-reset-modal');
    const btnOpen = document.getElementById('global-reset-btn');
    const btnBake = document.getElementById('btn-global-bake');
    const btnClearVotes = document.getElementById('btn-global-clear-votes');
    const btnNuke = document.getElementById('btn-global-nuke');
    const btnCancel = document.getElementById('global-cancel-btn');

    if (btnOpen) btnOpen.onclick = () => modal.style.display = 'flex';
    if (btnCancel) btnCancel.onclick = () => modal.style.display = 'none';

    // 1. FACTORY RESET (Nuke)
    btnNuke.onclick = () => {
        if (confirm("FINAL WARNING: This will delete ALL user created tools and revert to the original 19 items.")) {
            set(ref(db), {}).then(() => {
                const updates = {};
                initialItems.forEach(item => { updates['items/' + item.id] = item; });
                update(ref(db), updates);
                modal.style.display = 'none';
                window.location.reload();
            });
        }
    };

    // 2. CLEAR VOTES (Keep Items)
    btnClearVotes.onclick = () => {
        if (confirm("Clear all votes? Items will snap back to their default positions.")) {
            remove(ref(db, 'votes'));
            modal.style.display = 'none';
        }
    };

    // 3. BAKE CONSENSUS
    btnBake.onclick = () => {
        if (confirm("Update all item defaults to their current positions and clear votes?")) {
            const updates = {};

            // Loop through all rendered items to capture their current DOM position (Consensus)
            renderedItems.forEach(id => {
                const dot = document.getElementById(`dot-${id}`);
                if (dot) {
                    const currentX = parseFloat(dot.style.left);
                    const currentY = parseFloat(dot.style.bottom);

                    // We only update X/Y, we keep name/desc intact
                    updates[`items/${id}/x`] = currentX;
                    updates[`items/${id}/y`] = currentY;
                }
            });

            // Clear votes in the same atomic update? 
            // No, 'votes' is a sibling of 'items'. We can do root-level update.
            // But we need to construct the update object carefully.
            // firebase update() merges. So we can't just set 'votes': null to delete it via update?
            // Actually yes, setting a path to null deletes it.
            updates['votes'] = null;

            update(ref(db), updates);
            modal.style.display = 'none';
        }
    };
}


function createItemElements(container, item) {
    const avgDot = document.createElement('div');
    avgDot.className = 'dot';
    avgDot.id = `dot-${item.id}`;
    updateElementPosition(avgDot, item.x, item.y);
    updateDotColor(avgDot, item.y);

    const label = document.createElement('div');
    label.className = 'dot-label';
    label.innerText = item.name;
    label.id = `label-${item.id}`;
    updateLabelPosition(label, item.y);
    avgDot.appendChild(label);

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.id = `tooltip-${item.id}`;
    if (isAdmin) tooltip.style.pointerEvents = 'auto';
    else tooltip.style.pointerEvents = 'none';

    // NEW TOOLTIP STRUCTURE
    let html = `
        <div style="margin-bottom:2px;"><strong>${item.name}</strong></div>
        <div id="desc-${item.id}" style="font-size:11px; color:#aaa; line-height:1.2; margin-bottom:4px;">${item.desc}</div>
        <div style="font-size:10px; color:#888;">
            <span style="color:#eee;">Generative: <b id="val-x-${item.id}">${Math.round(item.x)}</b>%</span> 
            <span style="margin:0 4px; color:#444;">|</span> 
            <span style="color:#eee;">Readiness: <b id="val-y-${item.id}">${Math.round(item.y)}</b>%</span>
            <span id="my-vote-${item.id}" style="margin-left:6px; color:#3b82f6; display:none;"></span>
        </div>
    `;

    if (isAdmin) {
        html += `
            <div class="admin-controls">
                <div class="admin-btn" onclick="window.editItem('${item.id}')">Edit</div>
                <div class="admin-btn" onclick="window.resetVotes('${item.id}')">Reset Votes</div>
                <div class="admin-btn delete" onclick="window.deleteItem('${item.id}')">Delete</div>
            </div>
        `;
    }
    tooltip.innerHTML = html;

    if (item.x > 80) { tooltip.style.left = 'auto'; tooltip.style.right = '0'; tooltip.style.transform = 'translateX(20px)'; }
    if (item.x < 15) { tooltip.style.left = '0'; tooltip.style.transform = 'translateX(-20px)'; }

    avgDot.appendChild(tooltip);
    container.appendChild(avgDot);

    const userDot = document.createElement('div');
    userDot.className = 'user-dot';
    userDot.id = `user-dot-${item.id}`;

    // Proxy Hover Events for Tooltip (Class-based)
    userDot.onmouseenter = () => {
        const avgDot = document.getElementById(`dot-${item.id}`);
        if (avgDot) avgDot.classList.add('force-tooltip');
    };
    userDot.onmouseleave = (e) => {
        const avgDot = document.getElementById(`dot-${item.id}`);
        // Only remove if not moving to the avgDot itself
        if (avgDot && e.relatedTarget !== avgDot && !avgDot.contains(e.relatedTarget)) {
            avgDot.classList.remove('force-tooltip');
        }
    };

    // Also handle leaving avgDot to not hide if entering userDot
    avgDot.onmouseleave = (e) => {
        if (e.relatedTarget === userDot) {
            avgDot.classList.add('force-tooltip');
        } else {
            avgDot.classList.remove('force-tooltip');
        }
    };

    container.appendChild(userDot);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.id = `line-${item.id}`;
    line.setAttribute("class", "connection-line");
    line.style.display = 'none';
    svgLayer.appendChild(line);

    setupDrag(avgDot, userDot, item, container);
}

function updateItemMetadata(item) {
    const label = document.getElementById(`label-${item.id}`);
    if (label) label.innerText = item.name;
    const tooltip = document.getElementById(`tooltip-${item.id}`);
    if (tooltip) {
        const titleStrong = tooltip.querySelector('strong');
        if (titleStrong) titleStrong.innerText = item.name;
        const descSpan = document.getElementById(`desc-${item.id}`);
        if (descSpan) descSpan.innerText = item.desc;
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
    const container = document.getElementById('graph-container');
    if (container) {
        const dots = container.querySelectorAll(`.voter-dot[id^="voter-dot-${id}-"]`);
        dots.forEach(d => d.remove());
    }
}

function setupDrag(avgDot, userDot, item, container) {
    const updateFirebase = throttle((x, y) => {
        if (!currentUser) return;

        if (viewMode === '1D') {
            let targetY = 50;
            const itemVotes = previousData[item.id] || {};
            if (itemVotes[currentUser.uid]) {
                targetY = itemVotes[currentUser.uid].y;
            } else {
                const avgDotDom = document.getElementById(`dot-${item.id}`);
                if (avgDotDom) {
                    const currentBottom = avgDotDom.style.bottom;
                    if (currentBottom) targetY = parseFloat(currentBottom);
                    else targetY = item.y;
                }
            }
            set(ref(db, 'votes/' + item.id + '/' + currentUser.uid), {
                x: Math.round(x * 10) / 10,
                y: Math.round(targetY * 10) / 10,
                username: userDisplayName
            });
        } else {
            set(ref(db, 'votes/' + item.id + '/' + currentUser.uid), {
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10,
                username: userDisplayName
            });
        }
    }, 50);

    const startDrag = function (event, targetElement) {
        if (!currentUser) return;

        // Block drag if clicking buttons (Admin) or inputs
        if (event.target.closest('button') || event.target.closest('input') || event.target.closest('.admin-btn')) return;

        // Optional: Block drag if selecting text? 
        // Hard to detect 'intent', but usually text selection happens on mousedown+move.
        // We can't block mousedown based on future selection.
        // However, if the user clicks *text* inside the tooltip, they might want to select.
        // The previous CSS fix (lifting the tooltip) allows them to click the DOT for dragging.
        // So we can say: If clicking INSIDE tooltip visible area, don't drag.
        // But we want to allow dragging if they miss the text and hit the 'bridge'.
        // Detecting 'bridge' vs 'box' is hard.
        // Let's stick to the visual separation we just added in CSS.
        // If the user clicks the tooltip box, let's PREVENT drag so they can select text.

        if (event.target.closest('.tooltip')) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        isDragging = item.id;
        const activeDot = userDot;
        activeDot.style.display = 'block';
        activeDot.style.zIndex = 1000;

        // CSS Class override for instant response
        activeDot.classList.add('dragging');

        let shiftX = 0, shiftY = 0;

        if (targetElement === avgDot) {
            shiftX = activeDot.offsetWidth / 2;
            shiftY = activeDot.offsetHeight / 2;
        } else {
            shiftX = event.clientX - activeDot.getBoundingClientRect().left;
            shiftY = event.clientY - activeDot.getBoundingClientRect().top;
        }

        function moveAt(pageX, pageY) {
            let newX = pageX - shiftX - container.getBoundingClientRect().left;
            let newY = pageY - shiftY - container.getBoundingClientRect().top;
            if (newX < 0) newX = 0;
            if (newX > container.clientWidth) newX = container.clientWidth;
            if (newY < 0) newY = 0;
            if (newY > container.clientHeight) newY = container.clientHeight;
            let percentX = (newX / container.clientWidth) * 100;
            let percentY = 100 - ((newY / container.clientHeight) * 100);

            updateElementPosition(activeDot, percentX, percentY);
            updateFirebase(percentX, percentY);

            const avgDot = document.getElementById(`dot-${item.id}`);
            if (avgDot) {
                const avgX = parseFloat(avgDot.style.left);
                const avgY = parseFloat(avgDot.style.bottom);
                updateConnectionLine(item.id, avgX, avgY, percentX, percentY);
            }
            activeDot.dataset.tempX = percentX;
            activeDot.dataset.tempY = percentY;
        }
        function onMouseMove(event) { moveAt(event.clientX, event.clientY); }
        document.addEventListener('mousemove', onMouseMove);
        document.onmouseup = function () {
            document.removeEventListener('mousemove', onMouseMove);
            document.onmouseup = null;

            isDragging = null;
            activeDot.classList.remove('dragging');
            activeDot.style.transition = '';
            activeDot.style.zIndex = '';

            if (activeDot.dataset.tempX) {
                let x = parseFloat(activeDot.dataset.tempX);
                let y = parseFloat(activeDot.dataset.tempY);
                if (viewMode === '1D') {
                    let targetY = 50;
                    const itemVotes = previousData[item.id] || {};
                    if (itemVotes[currentUser.uid]) {
                        targetY = itemVotes[currentUser.uid].y;
                    } else {
                        const avgDotDom = document.getElementById(`dot-${item.id}`);
                        if (avgDotDom) {
                            const currentBottom = avgDotDom.style.bottom;
                            if (currentBottom) targetY = parseFloat(currentBottom);
                            else targetY = item.y;
                        }
                    }
                    y = targetY;
                }
                set(ref(db, 'votes/' + item.id + '/' + currentUser.uid), {
                    x: Math.round(x * 10) / 10,
                    y: Math.round(y * 10) / 10,
                    username: userDisplayName
                });
            }
        };
        moveAt(event.clientX, event.clientY);
        if (!hasConfirmedName) {
            showUsernamePrompt();
        }
    };
    avgDot.onmousedown = (e) => startDrag(e, avgDot);
    userDot.onmousedown = (e) => startDrag(e, userDot);
}

function updateGraphFromData(allVotes, container) {
    renderedItems.forEach(itemId => {
        const itemVotes = allVotes[itemId] || {};
        const prevItemVotes = (previousData[itemId] || {});

        // Track which voter dots should exist
        const activeVoters = new Set();

        Object.keys(itemVotes).forEach(uid => {
            if (uid === currentUser?.uid && isDragging === itemId) {
                activeVoters.add(uid);
                return;
            }
            const vote = itemVotes[uid];
            const prevVote = prevItemVotes[uid];

            // 1. Splash Logic
            let shouldSplash = false;
            if (!prevVote) shouldSplash = true;
            else if (Math.abs(vote.x - prevVote.x) > 1 || Math.abs(vote.y - prevVote.y) > 1) shouldSplash = true;
            if (shouldSplash) triggerSplash(container, vote.x, vote.y);

            // 2. Voter Dot Logic (Other Users)
            if (uid !== currentUser?.uid) {
                let vDot = document.getElementById(`voter-dot-${itemId}-${uid}`);
                if (!vDot) {
                    vDot = document.createElement('div');
                    vDot.className = 'voter-dot';
                    vDot.id = `voter-dot-${itemId}-${uid}`;
                    vDot.innerHTML = `<div class="voter-username">${vote.username || 'Anon'}</div>`;
                    container.appendChild(vDot);
                }

                if (vDot) {
                    if (shouldSplash || (Date.now() - (window.appLaunchTime || 0) < INITIAL_SHOW_TIME)) {
                        vDot.classList.add('visible');
                        clearTimeout(vDot.fadeTimeout);
                        vDot.fadeTimeout = setTimeout(() => vDot.classList.remove('visible'), FADE_TIME);
                    }
                }

                updateElementPosition(vDot, vote.x, vote.y);
                if (viewMode === '1D') vDot.style.bottom = '50%';
                activeVoters.add(uid);
            } else {
                activeVoters.add(uid);
            }
        });

        // Cleanup old voter dots
        const allVoterDots = container.querySelectorAll(`.voter-dot[id^="voter-dot-${itemId}-"]`);
        allVoterDots.forEach(dot => {
            const uid = dot.id.replace(`voter-dot-${itemId}-`, '');
            if (!activeVoters.has(uid)) dot.remove();
        });

        let totalX = 0, totalY = 0, count = 0;
        let myVote = null;
        if (currentUser && itemVotes[currentUser.uid]) myVote = itemVotes[currentUser.uid];
        Object.values(itemVotes).forEach(vote => {
            totalX += vote.x; totalY += vote.y; count++;
        });
        if (count > 0) {
            let avgX = totalX / count;
            let avgY = totalY / count;

            const avgDot = document.getElementById(`dot-${itemId}`);
            if (avgDot) {
                // If I am dragging THIS item, kill the transition on the Consensus Dot so it follows instantly
                if (isDragging === itemId) {
                    avgDot.style.transition = 'none';
                } else {
                    avgDot.style.transition = ''; // Revert to CSS default (3s)
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

                const myVoteDiv = document.getElementById(`my-vote-${itemId}`);
                if (myVoteDiv) {
                    if (myVote) {
                        myVoteDiv.style.display = 'inline';
                        myVoteDiv.innerHTML = `<span style="color:#444">|</span> Me: <b>${Math.round(myVote.x)}/${Math.round(myVote.y)}</b>`;
                    } else {
                        myVoteDiv.style.display = 'none';
                    }
                }
            }
            const userDot = document.getElementById(`user-dot-${itemId}`);
            if (userDot && myVote) {
                // Ensure name is on user dot
                let nameLabel = userDot.querySelector('.voter-username');
                if (!nameLabel) {
                    nameLabel = document.createElement('div');
                    nameLabel.className = 'voter-username';
                    userDot.appendChild(nameLabel);
                }
                nameLabel.innerText = userDisplayName;

                if (isDragging === itemId || (Date.now() - (window.appLaunchTime || 0) < INITIAL_SHOW_TIME)) {
                    nameLabel.classList.add('visible');
                    clearTimeout(nameLabel.fadeTimeout);
                    if (isDragging !== itemId) {
                        nameLabel.fadeTimeout = setTimeout(() => nameLabel.classList.remove('visible'), FADE_TIME);
                    }
                } else if (!isDragging) {
                    // If we just finished dragging, start the fade
                    if (nameLabel.classList.contains('visible') && !nameLabel.fadeTimeout) {
                        nameLabel.fadeTimeout = setTimeout(() => nameLabel.classList.remove('visible'), FADE_TIME);
                    }
                }

                if (isDragging !== itemId) {
                    updateConnectionLine(itemId, avgX, avgY, myVote.x, myVote.y);
                } else {
                    const currentDomLeft = parseFloat(userDot.style.left);
                    const currentDomBottom = parseFloat(userDot.style.bottom);
                    updateConnectionLine(itemId, avgX, avgY, currentDomLeft, currentDomBottom);
                }
            }
        }
        const userDot = document.getElementById(`user-dot-${itemId}`);
        if (userDot && isDragging !== itemId) {
            if (myVote) {
                userDot.style.display = 'block';
                updateElementPosition(userDot, myVote.x, myVote.y);
            } else {
                userDot.style.display = 'none';
                const line = document.getElementById(`line-${itemId}`);
                if (line) line.style.display = 'none';
            }
        }
    });
    previousData = JSON.parse(JSON.stringify(allVotes));
}

function updateConnectionLine(itemId, x1, y1, x2, y2) {
    const line = document.getElementById(`line-${itemId}`);
    if (line) {
        line.style.display = 'block';
        line.setAttribute('x1', x1); line.setAttribute('y1', 100 - y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', 100 - y2);
    }
}

function triggerSplash(container, x, y) {
    const splash = document.createElement('div');
    splash.className = 'splash'; splash.style.left = x + '%'; splash.style.bottom = y + '%';
    container.appendChild(splash);
    setTimeout(() => splash.remove(), 600);
}

function triggerMegaSplash(container, x, y) {
    const splash = document.createElement('div');
    splash.className = 'mega-splash'; splash.style.left = x + '%'; splash.style.bottom = y + '%';
    container.appendChild(splash);
    setTimeout(() => splash.remove(), 1200);
}

function updateElementPosition(element, x, y) { element.style.left = x + '%'; element.style.bottom = y + '%'; }
function updateDotColor(dot, y) {
    dot.classList.remove('ready-high', 'ready-mid', 'ready-low');
    if (y > 80) dot.classList.add('ready-high'); else if (y > 50) dot.classList.add('ready-mid'); else dot.classList.add('ready-low');
}
function updateLabelPosition(labelElement, y) {
    labelElement.classList.remove('label-below', 'label-above');
    if (y > 65) labelElement.classList.add('label-below'); else labelElement.classList.add('label-above');
}

window.deleteItem = (id) => { if (confirm("Are you sure you want to delete this item?")) { remove(ref(db, 'items/' + id)); remove(ref(db, 'votes/' + id)); } };

window.resetVotes = (id) => {
    const modal = document.getElementById('reset-options-modal');
    document.getElementById('reset-item-id').value = id;
    modal.style.display = 'flex';
};

window.editItem = (id) => {
    const modal = document.getElementById('edit-item-modal');
    const name = document.getElementById(`label-${id}`).innerText;
    const desc = document.getElementById(`desc-${id}`).innerText;
    document.getElementById('edit-item-id').value = id;
    document.getElementById('edit-item-name').value = name;
    document.getElementById('edit-item-desc').value = desc;
    modal.style.display = 'flex';
};
