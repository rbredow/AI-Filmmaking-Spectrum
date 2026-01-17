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
let currentUser = null;
let isAdmin = false;
let isDragging = null; 
let previousData = {}; 
let svgLayer = null;   
let renderedItems = new Set();
let viewMode = '2D'; 
const ADMIN_EMAIL = "rob.bredow@gmail.com";

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
    return function() {
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
        initApp();
    } else {
        signInAnonymously(auth).catch(e => console.error("Anon Auth failed", e));
    }
});

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

document.getElementById('global-reset-btn').onclick = () => {
    if (confirm("DANGER: This will delete ALL custom tools and ALL votes. It restores the original items.")) {
        if(confirm("FINAL WARNING: This cannot be undone. Are you sure you want to WIPE THE DATABASE?")) {
             resetWorld();
        }
    }
};

function resetWorld() {
    set(ref(db), {}).then(() => {
        const updates = {};
        initialItems.forEach(item => { updates['items/' + item.id] = item; });
        update(ref(db), updates);
        alert("World Reset Complete.");
        window.location.reload();
    });
}


function initApp() {
    const container = document.getElementById('graph-container');
    
    // Setup toggle button logic
    const toggleBtn = document.getElementById('view-mode-btn');
    if(toggleBtn) {
        toggleBtn.onclick = () => {
            if(viewMode === '2D') {
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
        if(viewMode === '2D') {
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

    if(addBtn) addBtn.onclick = () => {
        modal.style.display = 'flex';
        document.getElementById('new-item-name').focus();
    };
    if(cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';

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
        set(ref(db, 'votes/' + newId + '/' + currentUser.uid), { x, y });
        modal.style.display = 'none';
        document.getElementById('new-item-name').value = '';
        document.getElementById('new-item-desc').value = '';
    };
}

function setupEditModalLogic() {
    const modal = document.getElementById('edit-item-modal');
    const cancelBtn = document.getElementById('edit-cancel-btn');
    const submitBtn = document.getElementById('edit-submit-btn');
    if(cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';
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

    if(item.x > 80) { tooltip.style.left = 'auto'; tooltip.style.right = '0'; tooltip.style.transform = 'translateX(20px)'; }
    if(item.x < 15) { tooltip.style.left = '0'; tooltip.style.transform = 'translateX(-20px)'; }
    avgDot.appendChild(tooltip);
    container.appendChild(avgDot);

    const userDot = document.createElement('div');
    userDot.className = 'user-dot';
    userDot.id = `user-dot-${item.id}`;
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
    if(label) label.innerText = item.name;
    const tooltip = document.getElementById(`tooltip-${item.id}`);
    if(tooltip) {
        const titleStrong = tooltip.querySelector('strong');
        if(titleStrong) titleStrong.innerText = item.name;
        const descSpan = document.getElementById(`desc-${item.id}`);
        if(descSpan) descSpan.innerText = item.desc;
    }
}

function removeItemElements(id) {
    const dot = document.getElementById(`dot-${id}`);
    const uDot = document.getElementById(`user-dot-${id}`);
    const line = document.getElementById(`line-${id}`);
    if(dot) dot.remove();
    if(uDot) uDot.remove();
    if(line) line.remove();
}

function setupDrag(avgDot, userDot, item, container) {
    const updateFirebase = throttle((x, y) => {
        if(!currentUser) return;
        
        if (viewMode === '1D') {
            let targetY = 50; 
            const itemVotes = previousData[item.id] || {};
            if (itemVotes[currentUser.uid]) {
                targetY = itemVotes[currentUser.uid].y;
            } else {
                const avgDotDom = document.getElementById(`dot-${item.id}`);
                if (avgDotDom) {
                    const currentBottom = avgDotDom.style.bottom; 
                    if(currentBottom) targetY = parseFloat(currentBottom);
                    else targetY = item.y;
                }
            }
            set(ref(db, 'votes/' + item.id + '/' + currentUser.uid), {
                x: Math.round(x * 10) / 10,
                y: Math.round(targetY * 10) / 10
            });
        } else {
            set(ref(db, 'votes/' + item.id + '/' + currentUser.uid), {
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10
            });
        }
    }, 50);

    const startDrag = function(event, targetElement) {
        if(!currentUser) return;
        if (event.target.classList.contains('admin-btn')) return;
        event.preventDefault();
        event.stopPropagation();
        isDragging = item.id;
        const activeDot = userDot; 
        activeDot.style.display = 'block';
        activeDot.style.zIndex = 1000;
        activeDot.style.transition = 'none';
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
            if(avgDot) {
                const avgX = parseFloat(avgDot.style.left);
                const avgY = parseFloat(avgDot.style.bottom);
                updateConnectionLine(item.id, avgX, avgY, percentX, percentY);
            }
            activeDot.dataset.tempX = percentX;
            activeDot.dataset.tempY = percentY;
        }
        function onMouseMove(event) { moveAt(event.clientX, event.clientY); }
        document.addEventListener('mousemove', onMouseMove);
        document.onmouseup = function() {
            document.removeEventListener('mousemove', onMouseMove);
            document.onmouseup = null;
            isDragging = null;
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
                            if(currentBottom) targetY = parseFloat(currentBottom);
                            else targetY = item.y;
                        }
                     }
                     y = targetY;
                }
                set(ref(db, 'votes/' + item.id + '/' + currentUser.uid), {
                    x: Math.round(x * 10) / 10,
                    y: Math.round(y * 10) / 10
                });
            }
        };
        moveAt(event.clientX, event.clientY);
    };
    avgDot.onmousedown = (e) => startDrag(e, avgDot);
    userDot.onmousedown = (e) => startDrag(e, userDot);
}

function updateGraphFromData(allVotes, container) {
    renderedItems.forEach(itemId => {
        const itemVotes = allVotes[itemId] || {};
        const prevItemVotes = (previousData[itemId] || {});
        Object.keys(itemVotes).forEach(uid => {
            if (uid === currentUser?.uid && isDragging === itemId) return;
            const vote = itemVotes[uid];
            const prevVote = prevItemVotes[uid];
            let shouldSplash = false;
            if (!prevVote) shouldSplash = true;
            else if (Math.abs(vote.x - prevVote.x) > 1 || Math.abs(vote.y - prevVote.y) > 1) shouldSplash = true;
            if (shouldSplash) triggerSplash(container, vote.x, vote.y);
        });
        let totalX = 0, totalY = 0, count = 0;
        let myVote = null;
        if (currentUser && itemVotes[currentUser.uid]) myVote = itemVotes[currentUser.uid];
        Object.values(itemVotes).forEach(vote => {
            totalX += vote.x; totalY += vote.y; count++;
        });
        if (count > 0) {
            let avgX = totalX / count, avgY = totalY / count;
            const avgDot = document.getElementById(`dot-${itemId}`);
            if (avgDot) {
                updateElementPosition(avgDot, avgX, avgY);
                updateDotColor(avgDot, avgY);
                const label = document.getElementById(`label-${itemId}`);
                if(label) updateLabelPosition(label, avgY);
                
                // UPDATE TOOLTIP VALUES
                const valX = document.getElementById(`val-x-${itemId}`);
                const valY = document.getElementById(`val-y-${itemId}`);
                if(valX) valX.innerText = Math.round(avgX);
                if(valY) valY.innerText = Math.round(avgY);
                
                const myVoteDiv = document.getElementById(`my-vote-${itemId}`);
                if(myVoteDiv) {
                    if(myVote) {
                        myVoteDiv.style.display = 'inline';
                        myVoteDiv.innerHTML = `<span style="color:#444">|</span> Me: <b>${Math.round(myVote.x)}/${Math.round(myVote.y)}</b>`;
                    } else {
                        myVoteDiv.style.display = 'none';
                    }
                }
            }
            const userDot = document.getElementById(`user-dot-${itemId}`);
            if (userDot && myVote && isDragging !== itemId) updateConnectionLine(itemId, avgX, avgY, myVote.x, myVote.y);
            else if (userDot && myVote && isDragging === itemId) {
                 const currentDomLeft = parseFloat(userDot.style.left);
                 const currentDomBottom = parseFloat(userDot.style.bottom);
                 updateConnectionLine(itemId, avgX, avgY, currentDomLeft, currentDomBottom);
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
                if(line) line.style.display = 'none';
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
    if(y > 80) dot.classList.add('ready-high'); else if(y > 50) dot.classList.add('ready-mid'); else dot.classList.add('ready-low');
}
function updateLabelPosition(labelElement, y) {
    labelElement.classList.remove('label-below', 'label-above');
    if (y > 65) labelElement.classList.add('label-below'); else labelElement.classList.add('label-above');
}

window.deleteItem = (id) => { if(confirm("Are you sure you want to delete this item?")) { remove(ref(db, 'items/' + id)); remove(ref(db, 'votes/' + id)); } };
window.resetVotes = (id) => { if(confirm("Reset all votes for this item?")) { remove(ref(db, 'votes/' + id)); } };
window.editItem = (id) => {
    const modal = document.getElementById('edit-item-modal');
    const name = document.getElementById(`label-${id}`).innerText;
    const desc = document.getElementById(`desc-${id}`).innerText;
    document.getElementById('edit-item-id').value = id;
    document.getElementById('edit-item-name').value = name;
    document.getElementById('edit-item-desc').value = desc;
    modal.style.display = 'flex';
};
