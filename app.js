document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURATION ---
    const container = document.getElementById('graph-container');
    const isAdmin = window.location.search.includes('admin=true'); // Simple check for future logic
    
    // --- INITIAL DATA ---
    // In Phase 2, this will come from Firebase
    const initialData = [
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

    // --- RENDER FUNCTION ---
    function createDot(item) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.id = `dot-${item.id}`;
        
        // Color Logic
        updateDotStyle(dot, item);

        // Position Logic
        updateDotPosition(dot, item.x, item.y);

        // Label Logic
        const label = document.createElement('div');
        label.className = 'dot-label';
        label.innerText = item.name;
        updateLabelPosition(label, item.y);
        dot.appendChild(label);

        // Tooltip Logic
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.innerHTML = `<strong>${item.name}</strong>${item.desc}<span>Readiness: <span id="val-${item.id}">${item.y}</span>%</span>`;
        
        // Prevent tooltip clipping
        if(item.x > 80) { tooltip.style.left = 'auto'; tooltip.style.right = '0'; tooltip.style.transform = 'translateX(20px) translateY(10px)'; }
        if(item.x < 15) { tooltip.style.left = '0'; tooltip.style.transform = 'translateX(-20px) translateY(10px)'; }
        
        dot.appendChild(tooltip);

        // --- DRAG LOGIC ---
        // (In Phase 2, this will verify User vs Admin)
        dot.onmousedown = function(event) {
            event.preventDefault();
            let shiftX = event.clientX - dot.getBoundingClientRect().left + 7;
            let shiftY = event.clientY - dot.getBoundingClientRect().top + 7;

            function moveAt(pageX, pageY) {
                let newX = pageX - shiftX - container.getBoundingClientRect().left;
                let newY = pageY - shiftY - container.getBoundingClientRect().top;

                // Bounds
                if (newX < 0) newX = 0;
                if (newX > container.clientWidth) newX = container.clientWidth;
                if (newY < 0) newY = 0;
                if (newY > container.clientHeight) newY = container.clientHeight;

                // Convert to %
                let percentX = (newX / container.clientWidth) * 100;
                let percentY = 100 - ((newY / container.clientHeight) * 100);

                // Update UI locally
                updateDotPosition(dot, percentX, percentY);
                
                // Update internal data (or Firebase in Phase 2)
                item.x = percentX;
                item.y = percentY;
                
                // Live update label style if crossing threshold
                updateLabelPosition(label, percentY);
                updateDotStyle(dot, item);
                
                // Update tooltip text
                document.getElementById(`val-${item.id}`).innerText = Math.round(percentY);
            }

            function onMouseMove(event) {
                moveAt(event.clientX, event.clientY);
            }

            document.addEventListener('mousemove', onMouseMove);

            document.onmouseup = function() {
                document.removeEventListener('mousemove', onMouseMove);
                document.onmouseup = null;
                
                // TODO: Firebase Update Here
                // firebase.database().ref('votes/' + item.id + '/' + myUid).set({x: item.x, y: item.y});
            };
        };

        container.appendChild(dot);
    }

    // --- HELPER FUNCTIONS ---
    function updateDotPosition(element, x, y) {
        element.style.left = x + '%';
        element.style.bottom = y + '%';
    }

    function updateLabelPosition(labelElement, y) {
        // Reset classes
        labelElement.classList.remove('label-below', 'label-above');
        
        // Apply rule
        if (y > 65) {
            labelElement.classList.add('label-below');
        } else {
            labelElement.classList.add('label-above');
        }
    }

    function updateDotStyle(dotElement, item) {
        dotElement.classList.remove('ready-high', 'ready-mid', 'ready-low');
        if(item.y > 80) dotElement.classList.add('ready-high');
        else if(item.y > 50) dotElement.classList.add('ready-mid');
        else dotElement.classList.add('ready-low');
    }

    // --- INIT ---
    initialData.forEach(createDot);
});
