// Graph DOM rendering, dot positioning, voter dots, tooltips, and SVG lines
import { state } from "../state/app-state.js";
import { plotPct, unplotPct, projectedMobileGraphPoint } from "../core/coords.js";
import { escapeHtml, formatAxisPosition, formatSpectrumPosition } from "../core/formatters.js";
import { readinessColor, updateDotColor } from "../core/colors.js";
import { FADE_TIME } from "../config/constants.js";

const isTouchDevice = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

const isMobileGraphExperience = () =>
    isTouchDevice() &&
    (window.innerWidth <= 600 || (window.innerHeight <= 500 && window.innerWidth <= 1000));

export function positionElementForCurrentView(element, x, y, container) {
    if (!container || !element) return;
    const isMobileExp = isMobileGraphExperience();

    if (isMobileExp && container.clientWidth && container.clientHeight) {
        const point = projectedMobileGraphPoint(x, y, container, state.mobileGraphView, {
            viewMode: state.viewMode,
            isMobile: isMobileExp,
            isTimelineOpen: state.isTimelineOpen,
        });
        element.style.left = `${point.x}px`;
        element.style.bottom = `${container.clientHeight - point.y}px`;
    } else {
        element.style.left = plotPct(x) + "%";
        if (state.viewMode === "1D") {
            element.style.bottom = "50%";
        } else {
            element.style.bottom = plotPct(y) + "%";
        }
    }
}

export function updateElementPosition(element, x, y, container = null) {
    if (!element) return;
    element.dataset.realX = x;
    element.dataset.realY = y;
    const cont = container || document.getElementById("graph-container");
    positionElementForCurrentView(element, x, y, cont);
}

export function updateLabelPosition(labelElement, y) {
    if (!labelElement) return;
    labelElement.classList.remove("label-below", "label-above");
    labelElement.classList.add("label-below");
}

export function triggerSplash(container, x, y) {
    if (!container) return;
    if (Date.now() - state.appLaunchTime < 2000) return;

    const splash = document.createElement("div");
    splash.className = "splash";
    if (isMobileGraphExperience() && container.clientWidth && container.clientHeight) {
        const point = projectedMobileGraphPoint(x, y, container, state.mobileGraphView, {
            viewMode: state.viewMode,
            isMobile: true,
            isTimelineOpen: state.isTimelineOpen,
        });
        splash.style.left = `${point.x}px`;
        splash.style.bottom = `${container.clientHeight - point.y}px`;
    } else {
        splash.style.left = plotPct(x) + "%";
        splash.style.bottom = plotPct(y) + "%";
    }
    container.appendChild(splash);
    setTimeout(() => splash.remove(), 1200);
}

export function triggerMegaSplash(container, x, y) {
    if (!container) return;
    if (Date.now() - state.appLaunchTime < 2000) return;

    const splash = document.createElement("div");
    splash.className = "mega-splash";
    if (isMobileGraphExperience() && container.clientWidth && container.clientHeight) {
        const point = projectedMobileGraphPoint(x, y, container, state.mobileGraphView, {
            viewMode: state.viewMode,
            isMobile: true,
            isTimelineOpen: state.isTimelineOpen,
        });
        splash.style.left = `${point.x}px`;
        splash.style.bottom = `${container.clientHeight - point.y}px`;
    } else {
        splash.style.left = plotPct(x) + "%";
        splash.style.bottom = plotPct(y) + "%";
    }
    container.appendChild(splash);
    setTimeout(() => splash.remove(), 1200);
}

export function updateConnectionLine(itemId, x1, y1, x2, y2) {
    const line = document.getElementById(`line-${itemId}`);
    if (!line) return;

    line.dataset.itemId = itemId;
    line.dataset.realX1 = x1;
    line.dataset.realY1 = y1;
    line.dataset.realX2 = x2;
    line.dataset.realY2 = y2;
    line.style.display = "block";

    const isMobileExp = isMobileGraphExperience();
    const container = document.getElementById("graph-container");

    if (isMobileExp && container && container.clientWidth && container.clientHeight) {
        const p1 = projectedMobileGraphPoint(x1, y1, container, state.mobileGraphView, {
            viewMode: state.viewMode,
            isMobile: isMobileExp,
            isTimelineOpen: state.isTimelineOpen,
        });
        const p2 = projectedMobileGraphPoint(x2, y2, container, state.mobileGraphView, {
            viewMode: state.viewMode,
            isMobile: isMobileExp,
            isTimelineOpen: state.isTimelineOpen,
        });

        line.setAttribute("x1", `${(p1.x / container.clientWidth) * 100}`);
        line.setAttribute("y1", `${(p1.y / container.clientHeight) * 100}`);
        line.setAttribute("x2", `${(p2.x / container.clientWidth) * 100}`);
        line.setAttribute("y2", `${(p2.y / container.clientHeight) * 100}`);
    } else {
        const px1 = plotPct(x1);
        const py1 = state.viewMode === "1D" ? 50 : 100 - plotPct(y1);
        const px2 = plotPct(x2);
        const py2 = state.viewMode === "1D" ? 50 : 100 - plotPct(y2);

        line.setAttribute("x1", `${px1}`);
        line.setAttribute("y1", `${py1}`);
        line.setAttribute("x2", `${px2}`);
        line.setAttribute("y2", `${py2}`);
    }
}

export function createItemElements(container, item, { onEditItem = null, onResetVotes = null, onDeleteItem = null } = {}) {
    const avgDot = document.createElement("div");
    avgDot.className = "dot" + (state.isOnboardingActive ? " onboarding-hidden" : "");
    avgDot.id = `dot-${item.id}`;
    updateElementPosition(avgDot, item.x, item.y, container);
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
    labelValues.textContent = formatSpectrumPosition(item.x, item.y);
    label.append(labelName, labelValues);
    updateLabelPosition(label, item.y);
    avgDot.appendChild(label);

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.id = `tooltip-${item.id}`;

    let html = `
        <div style="margin-bottom:2px;"><strong>${escapeHtml(item.name)}</strong></div>
        <div id="tags-${item.id}" style="font-size:var(--fs-xs); color:#3b82f6; margin-bottom:4px; font-weight:600;">
            ${item.tags && item.tags.length > 0 ? escapeHtml(item.tags.join(', ')) : ''}
        </div>
        <div id="desc-${item.id}" style="font-size:var(--fs-xs); color:#aaa; line-height:1.2; margin-bottom:4px;">${escapeHtml(item.desc)}</div>
        <div style="font-size:var(--fs-xs); color:#888;">
            <span id="val-x-${item.id}" style="color:#eee;">${formatAxisPosition(item.x, "Utility", "Generative")}</span>
            <span style="margin:0 4px; color:#444;">|</span>
            <span id="val-y-${item.id}" style="color:#eee;">${formatAxisPosition(item.y, "Not Ready", "Ready")}</span>
            <span id="my-vote-${item.id}" style="margin-left:6px; color:#3b82f6; display:none;"></span>
        </div>
    `;

    html += `<div class="admin-controls">`;
    const canEdit = state.addingEnabled || state.isAdmin;
    html += `<div id="edit-btn-${item.id}" class="admin-btn" style="display: ${canEdit ? 'block' : 'none'}">Edit</div>`;
    if (state.isAdmin) {
        html += `<div id="reset-btn-${item.id}" class="admin-btn">Reset Votes</div>
                 <div id="delete-btn-${item.id}" class="admin-btn delete">Delete</div>`;
    }
    html += `</div>`;

    tooltip.innerHTML = html;

    const editBtn = tooltip.querySelector(`#edit-btn-${item.id}`);
    if (editBtn && onEditItem) editBtn.onclick = (e) => { e.stopPropagation(); onEditItem(item.id); };

    const resetBtn = tooltip.querySelector(`#reset-btn-${item.id}`);
    if (resetBtn && onResetVotes) resetBtn.onclick = (e) => { e.stopPropagation(); onResetVotes(item.id); };

    const deleteBtn = tooltip.querySelector(`#delete-btn-${item.id}`);
    if (deleteBtn && onDeleteItem) deleteBtn.onclick = (e) => { e.stopPropagation(); onDeleteItem(item.id); };

    if (item.x > 80) {
        tooltip.style.left = "auto";
        tooltip.style.right = "0";
        tooltip.style.transform = "translateX(20px)";
    }
    if (item.x < 15) {
        tooltip.style.left = "0";
        tooltip.style.transform = "translateX(-20px)";
    }
    if (item.y > 62) {
        tooltip.style.bottom = "auto";
        tooltip.style.top = "26px";
    }

    avgDot.appendChild(tooltip);
    container.appendChild(avgDot);

    const userDot = document.createElement("div");
    userDot.className = "user-dot" + (state.isOnboardingActive ? " onboarding-hidden" : "");
    userDot.id = `user-dot-${item.id}`;
    userDot.style.display = "none";
    updateElementPosition(userDot, item.x, item.y, container);
    container.appendChild(userDot);

    const svgLayer = document.getElementById("connections-layer");
    if (svgLayer) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.id = `line-${item.id}`;
        line.setAttribute("class", "connection-line");
        line.setAttribute("data-item-id", item.id);
        line.style.display = "none";
        svgLayer.appendChild(line);
    }
}

export function updateItemMetadata(item) {
    const desc = document.getElementById(`desc-${item.id}`);
    if (desc) desc.innerText = item.desc || "";

    const tagsDiv = document.getElementById(`tags-${item.id}`);
    if (tagsDiv) {
        tagsDiv.innerText = item.tags && item.tags.length > 0 ? item.tags.join(", ") : "";
    }

    const labelName = document.querySelector(`#label-${item.id} .dot-label-name`);
    if (labelName) labelName.innerText = item.name || "";
}

export function removeItemElements(id) {
    const avgDot = document.getElementById(`dot-${id}`);
    if (avgDot) avgDot.remove();
    const userDot = document.getElementById(`user-dot-${id}`);
    if (userDot) userDot.remove();
    const line = document.getElementById(`line-${id}`);
    if (line) line.remove();
    const panelRow = document.getElementById(`panel-row-${id}`);
    if (panelRow) panelRow.remove();
    const voterDots = document.querySelectorAll(`.voter-dot[id^="voter-dot-${id}-"]`);
    voterDots.forEach((d) => d.remove());
}

export function updateGraphFromData(allVotes, container, hasLoadedInitialVotes = true) {
    if (!container) return;

    state.renderedItems.forEach((itemId) => {
        const itemVotes = allVotes[itemId] || {};
        const baseItem = state.itemsCache[itemId];
        const prevItemVotes = (state.previousData && state.previousData[itemId]) || {};

        if (!baseItem) return;

        const activeVoters = new Set();
        let totalX = baseItem.x * 10;
        let totalY = baseItem.y * 10;
        let count = 10;

        Object.keys(itemVotes).forEach((uid) => {
            if (uid === state.currentUser?.uid && state.isDragging === itemId) {
                activeVoters.add(uid);
                return;
            }
            const vote = itemVotes[uid];
            const prevVote = prevItemVotes[uid];

            let shouldSplash = false;
            if (hasLoadedInitialVotes) {
                if (!prevVote) shouldSplash = true;
                else if (Math.abs(vote.x - prevVote.x) > 1 || Math.abs(vote.y - prevVote.y) > 1) {
                    shouldSplash = true;
                }
            }
            if (shouldSplash) triggerSplash(container, vote.x, vote.y);

            if (uid !== state.currentUser?.uid) {
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
                        vDot.fadeTimeout = setTimeout(() => vDot.classList.remove("visible"), FADE_TIME);
                    }
                }

                updateElementPosition(vDot, vote.x, vote.y, container);
                if (state.viewMode === "1D") vDot.style.bottom = "50%";
                activeVoters.add(uid);
            } else {
                activeVoters.add(uid);
            }

            totalX += vote.x;
            totalY += vote.y;
            count++;
        });

        const allVoterDots = container.querySelectorAll(`.voter-dot[id^="voter-dot-${itemId}-"]`);
        allVoterDots.forEach((dot) => {
            const uid = dot.id.replace(`voter-dot-${itemId}-`, "");
            if (!activeVoters.has(uid)) dot.remove();
        });

        const myVote = state.currentUser ? itemVotes[state.currentUser.uid] || null : null;
        const userDot = document.getElementById(`user-dot-${itemId}`);
        let dragPreviewVote = null;
        if (state.isDragging === itemId && userDot?.dataset.tempX != null && userDot?.dataset.tempY != null) {
            dragPreviewVote = {
                x: parseFloat(userDot.dataset.tempX),
                y: parseFloat(userDot.dataset.tempY),
            };
        }

        const effectiveVote = dragPreviewVote || myVote;
        const line = document.getElementById(`line-${itemId}`);

        const avgX = totalX / count;
        const avgY = totalY / count;

        const avgDot = document.getElementById(`dot-${itemId}`);
        if (avgDot) {
            updateElementPosition(avgDot, avgX, avgY, container);
            updateDotColor(avgDot, avgY);

            const labelVal = avgDot.querySelector(".dot-label-values");
            if (labelVal) {
                labelVal.textContent = formatSpectrumPosition(avgX, avgY);
            }
        }

        const barGen = document.getElementById(`bar-gen-${itemId}`);
        const barReady = document.getElementById(`bar-ready-${itemId}`);
        const numGen = document.getElementById(`num-gen-${itemId}`);
        const numReady = document.getElementById(`num-ready-${itemId}`);
        const rowNum = document.getElementById(`rownum-${itemId}`);

        const roundedX = Math.round(avgX);
        const roundedY = Math.round(avgY);

        if (barGen) barGen.style.width = `${roundedX}%`;
        if (barReady) {
            barReady.style.width = `${roundedY}%`;
            barReady.style.backgroundColor = readinessColor(roundedY);
        }
        if (numGen) numGen.textContent = `${roundedX}%`;
        if (numReady) numReady.textContent = `${roundedY}%`;
        if (rowNum) {
            rowNum.style.backgroundColor = readinessColor(roundedY);
            rowNum.style.borderColor = readinessColor(roundedY);
        }

        if (effectiveVote) {
            if (userDot) {
                userDot.style.display = "block";
                updateElementPosition(userDot, effectiveVote.x, effectiveVote.y, container);
            }
            if (line) {
                line.style.display = "block";
                updateConnectionLine(itemId, avgX, avgY, effectiveVote.x, effectiveVote.y);
            }
        } else {
            if (userDot && state.isDragging !== itemId) userDot.style.display = "none";
            if (line) line.style.display = "none";
        }

        const valX = document.getElementById(`val-x-${itemId}`);
        const valY = document.getElementById(`val-y-${itemId}`);
        if (valX) valX.innerText = formatAxisPosition(avgX, "Utility", "Generative");
        if (valY) valY.innerText = formatAxisPosition(avgY, "Not Ready", "Ready");

        const myVoteSpan = document.getElementById(`my-vote-${itemId}`);
        if (myVoteSpan) {
            if (effectiveVote) {
                myVoteSpan.style.display = "inline";
                myVoteSpan.innerText = `(You: ${Math.round(effectiveVote.x)}%, ${Math.round(effectiveVote.y)}%)`;
            } else {
                myVoteSpan.style.display = "none";
            }
        }
    });

    state.previousData = JSON.parse(JSON.stringify(allVotes));
}
