// Timeline scrubber overlay, slider synchronization, and animated historical playback
import { state, setState } from "../state/app-state.js";
import {
    getItemCreationTimestamp,
    buildUserSessionTimestamps,
    getVoteTimestamp,
    formatTimelineDate,
} from "../core/timeline-engine.js";
import { escapeHtml } from "../core/formatters.js";
import { computeConsensus } from "../core/consensus.js";
import { readinessColor, updateDotColor } from "../core/colors.js";
import {
    updateElementPosition,
    updateLabelPosition,
    triggerSplash,
    triggerMegaSplash,
    updateGraphFromData,
} from "./graph-renderer.js";
import { closeAllTooltips } from "./drag-controller.js";
import { FADE_TIME } from "../config/constants.js";

let lastScrubTimestamp = 0;

export function isAtLiveTimestamp() {
    return !state.isTimelineOpen || (state.currentTimelineTimestamp >= state.timelineMaxTime - 5000);
}

export function buildTimelineData() {
    const items = state.itemsCache || {};
    const votes = state.latestLiveVotes || state.previousData || {};

    buildUserSessionTimestamps(items, votes, state.baselineSnapshot);

    let minT = Infinity;
    let maxT = -Infinity;
    const events = [];

    Object.keys(items).forEach((itemId) => {
        const item = items[itemId];
        const t = getItemCreationTimestamp(itemId, item);
        minT = Math.min(minT, t);
        maxT = Math.max(maxT, t);
        events.push({ type: "item", id: itemId, name: item.name, time: t });
    });

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

    state.timelineMinTime = minT;
    state.timelineMaxTime = maxT;

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

export function renderTimelineMarkers(groups) {
    const markersContainer = document.getElementById("timeline-activity-markers");
    if (!markersContainer) return;
    markersContainer.innerHTML = "";

    const span = Math.max(1, state.timelineMaxTime - state.timelineMinTime);

    groups.forEach((g) => {
        const pct = Math.max(0, Math.min(100, ((g.time - state.timelineMinTime) / span) * 100));
        const marker = document.createElement("div");
        marker.className = "timeline-marker";
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

export function applyTimelinePosition(sliderPercent, options = {}) {
    const span = state.timelineMaxTime - state.timelineMinTime;
    const targetTime = state.timelineMinTime + (sliderPercent / 100) * span;
    applyTimelineTimestamp(targetTime, options);
}

export function applyTimelineTimestamp(targetTime, options = {}) {
    const container = document.getElementById("graph-container");
    if (!container) return;

    const span = Math.max(1, state.timelineMaxTime - state.timelineMinTime);
    const sliderPercent = Math.max(0, Math.min(100, ((targetTime - state.timelineMinTime) / span) * 100));

    const slider = document.getElementById("timeline-slider");
    if (slider && !options.fromSliderInput) {
        slider.value = sliderPercent.toFixed(1);
    }

    const progressFill = document.getElementById("timeline-progress-fill");
    if (progressFill) {
        progressFill.style.width = sliderPercent.toFixed(1) + "%";
    }

    const prevScrubTimestamp = lastScrubTimestamp || targetTime;
    const direction = options.direction !== undefined ? options.direction : (targetTime >= lastScrubTimestamp ? 1 : -1);
    lastScrubTimestamp = targetTime;
    state.currentTimelineTimestamp = targetTime;

    const isLive = sliderPercent >= 99.8 || targetTime >= state.timelineMaxTime - 10000;

    const dateLabel = document.getElementById("timeline-date-label");
    const timeLabel = document.getElementById("timeline-time-label") || document.getElementById("timeline-sub-label");
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
        livePill.classList.toggle("active", isLive);
    }

    container.classList.toggle("mode-timeline", !isLive);

    const items = state.itemsCache || {};
    const allVotes = state.latestLiveVotes || state.previousData || {};

    state.renderedItems.forEach((itemId) => {
        const item = items[itemId];
        const dot = document.getElementById(`dot-${itemId}`);
        const panelRow = document.getElementById(`panel-row-${itemId}`);
        if (!item || !dot) return;

        const itemCreated = getItemCreationTimestamp(itemId, item);
        const isActive = itemCreated <= targetTime;

        if (!isActive) {
            state.visibleItemIdsAtCurrentTime.delete(itemId);
            dot.style.transition = "opacity 0.25s ease";
            dot.style.opacity = "0";
            dot.style.pointerEvents = "none";
            if (panelRow) panelRow.style.display = "none";

            // Hide any voter dots for future item
            const voterDots = container.querySelectorAll(`.voter-dot[id^="voter-dot-${itemId}-"]`);
            voterDots.forEach((vDot) => {
                vDot.classList.remove("visible");
                clearTimeout(vDot.fadeTimeout);
            });
        } else {
            const isNewlyRevealed = !state.visibleItemIdsAtCurrentTime.has(itemId);
            state.visibleItemIdsAtCurrentTime.add(itemId);

            dot.style.opacity = "1";
            dot.style.pointerEvents = isLive ? "" : "none";
            if (panelRow) panelRow.style.display = "";

            const itemVotes = allVotes[itemId] || {};
            const activeVotes = {};
            Object.keys(itemVotes).forEach((uid) => {
                const v = itemVotes[uid];
                const voteTime = getVoteTimestamp(itemId, uid, v);
                if (voteTime <= targetTime) {
                    activeVotes[uid] = v;

                    // Show voter dot when scrubbing forward as the vote arrives
                    const isVoteArriving = direction > 0 && voteTime >= prevScrubTimestamp && !options.skipSplashes;
                    const isRecentToPlayback = direction > 0 && Math.abs(targetTime - voteTime) <= 6000 && !options.skipSplashes;

                    if ((isVoteArriving || isRecentToPlayback) && uid !== state.currentUser?.uid) {
                        let vDot = document.getElementById(`voter-dot-${itemId}-${uid}`);
                        if (!vDot) {
                            vDot = document.createElement("div");
                            vDot.className = "voter-dot";
                            vDot.id = `voter-dot-${itemId}-${uid}`;
                            vDot.innerHTML = `<div class="voter-username">${escapeHtml(v.username || "Anon")}</div>`;
                            container.appendChild(vDot);
                        }

                        updateElementPosition(vDot, v.x, v.y, container);
                        if (state.viewMode === "1D") vDot.style.bottom = "50%";

                        vDot.classList.add("visible");
                        clearTimeout(vDot.fadeTimeout);
                        vDot.fadeTimeout = setTimeout(() => {
                            vDot.classList.remove("visible");
                        }, FADE_TIME);

                        triggerSplash(container, v.x, v.y);
                    }
                } else if (direction < 0 || voteTime > targetTime) {
                    // Scrubbing backwards past this vote -> hide voter dot
                    const vDot = document.getElementById(`voter-dot-${itemId}-${uid}`);
                    if (vDot) {
                        vDot.classList.remove("visible");
                        clearTimeout(vDot.fadeTimeout);
                    }
                }
            });

            const cons = computeConsensus(item, activeVotes);
            let targetX = cons.x;
            let targetY = state.viewMode === "1D" ? 50 : cons.y;

            if (options.immediate) {
                dot.style.transition = "none";
            } else if (state.isTimelinePlaying) {
                dot.style.transition = "left 0.1s linear, bottom 0.1s linear, background-color 0.2s";
            } else {
                dot.style.transition = "left 0.3s ease-out, bottom 0.3s ease-out, background-color 0.3s";
            }

            updateElementPosition(dot, targetX, targetY, container);
            updateDotColor(dot, targetY);
            const label = document.getElementById(`label-${itemId}`);
            if (label) updateLabelPosition(label, targetY);

            const valX = document.getElementById(`val-x-${itemId}`);
            const valY = document.getElementById(`val-y-${itemId}`);
            if (valX) valX.innerText = Math.round(targetX);
            if (valY) valY.innerText = Math.round(targetY);

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

            if (isNewlyRevealed && direction > 0 && !options.skipSplashes) {
                if (itemId.startsWith("user_item_")) {
                    triggerMegaSplash(container, targetX, targetY);
                }
            }
        }
    });
}

export async function openTimeline() {
    state.isTimelineOpen = true;
    const bar = document.getElementById("timeline-bar");
    const btn = document.getElementById("timeline-btn");
    const container = document.getElementById("graph-container");
    if (btn) btn.classList.add("active");
    if (bar) bar.style.display = "flex";
    if (container) container.classList.add("timeline-open");

    closeAllTooltips();

    if (!state.baselineSnapshot) {
        try {
            const res = await fetch("./data/snapshot.json", { cache: "no-cache" });
            if (res.ok) state.baselineSnapshot = await res.json();
        } catch (e) {
            console.warn("Could not load snapshot for timeline baseline", e);
        }
    }

    buildTimelineData();
    applyTimelinePosition(100, { skipSplashes: true, isLive: true });
}

export function closeTimeline() {
    state.isTimelineOpen = false;
    pauseTimeline();
    const bar = document.getElementById("timeline-bar");
    const btn = document.getElementById("timeline-btn");
    const container = document.getElementById("graph-container");
    if (btn) btn.classList.remove("active");
    if (bar) bar.style.display = "none";
    if (container) {
        container.classList.remove("mode-timeline", "timeline-open");
        container.querySelectorAll(".voter-dot.visible").forEach((vDot) => {
            vDot.classList.remove("visible");
            clearTimeout(vDot.fadeTimeout);
        });
    }

    jumpToLive();
}

export function playTimeline() {
    if (state.isTimelinePlaying) return;
    const slider = document.getElementById("timeline-slider");
    if (!slider) return;

    if (parseFloat(slider.value) >= 99.5) {
        slider.value = "0";
        applyTimelinePosition(0, { skipSplashes: true, immediate: true });
    }

    state.isTimelinePlaying = true;
    updatePlayPauseIcons(true);

    let lastTime = performance.now();
    const PLAY_SPEED = 10;

    function step(now) {
        if (!state.isTimelinePlaying) return;
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
        state.timelineAnimationId = requestAnimationFrame(step);
    }

    state.timelineAnimationId = requestAnimationFrame(step);
}

export function pauseTimeline() {
    state.isTimelinePlaying = false;
    if (state.timelineAnimationId) {
        cancelAnimationFrame(state.timelineAnimationId);
        state.timelineAnimationId = null;
    }
    updatePlayPauseIcons(false);
}

export function updatePlayPauseIcons(isPlaying) {
    const playIcon = document.querySelector(".timeline-play-icon");
    const pauseIcon = document.querySelector(".timeline-pause-icon");
    if (playIcon) playIcon.style.display = isPlaying ? "none" : "block";
    if (pauseIcon) pauseIcon.style.display = isPlaying ? "block" : "none";
}

export function jumpToLive() {
    pauseTimeline();
    const slider = document.getElementById("timeline-slider");
    if (slider) slider.value = "100";

    const container = document.getElementById("graph-container");
    if (container) {
        container.classList.remove("mode-timeline");
        container.querySelectorAll(".voter-dot.visible").forEach((vDot) => {
            vDot.classList.remove("visible");
            clearTimeout(vDot.fadeTimeout);
        });
    }

    applyTimelinePosition(100, { skipSplashes: true, isLive: true });

    state.renderedItems.forEach((itemId) => {
        const dot = document.getElementById(`dot-${itemId}`);
        if (dot) {
            dot.style.transition = "";
            dot.style.opacity = "1";
            dot.style.pointerEvents = "";
        }
    });

    const votesData = state.latestLiveVotes || state.previousData;
    if (container) updateGraphFromData(votesData, container);
}

export function setupTimelineControls() {
    const timelineBtn = document.getElementById("timeline-btn");
    if (timelineBtn) {
        timelineBtn.onclick = () => {
            if (state.isTimelineOpen) closeTimeline();
            else openTimeline();
        };
    }

    const playBtn = document.getElementById("timeline-play-btn");
    if (playBtn) {
        playBtn.onclick = () => {
            if (state.isTimelinePlaying) pauseTimeline();
            else playTimeline();
        };
    }

    const slider = document.getElementById("timeline-slider");
    if (slider) {
        slider.addEventListener("input", (e) => {
            pauseTimeline();
            applyTimelinePosition(parseFloat(e.target.value), { fromSliderInput: true, skipSplashes: false });
        });
    }

    const liveBtn = document.getElementById("timeline-live-btn");
    if (liveBtn) liveBtn.onclick = () => jumpToLive();

    const closeBtn = document.getElementById("timeline-close-btn");
    if (closeBtn) closeBtn.onclick = () => closeTimeline();
}
