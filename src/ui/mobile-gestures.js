// Mobile touch gestures: pinch zoom, pan clamping, cluster tap-to-fan, and bounded labels
import { state, setState } from "../state/app-state.js";
import {
    clampMobileGraphView,
    baseGraphPoint,
    projectedMobileGraphPoint,
} from "../core/coords.js";
import {
    findCollisionCluster,
    findNearestItem,
    computeFanPositions,
} from "../core/clustering.js";
import { highlightItem, clearHighlight } from "./highlight.js";
import { positionElementForCurrentView, updateConnectionLine } from "./graph-renderer.js";
import {
    MOBILE_MIN_ZOOM,
    MOBILE_MAX_ZOOM,
    MOBILE_FAN_THRESHOLD,
} from "../config/constants.js";

let mobileViewAnimationTimer = null;
let mobileLabelClampFrame = null;
let mobileViewportGesture = null;
let mobileGraphTapStart = null;

export function isTouchDevice() {
    return typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function isMobileGraphExperience() {
    return isTouchDevice() &&
        (window.innerWidth <= 600 || (window.innerHeight <= 500 && window.innerWidth <= 1000));
}

export function mobileTruePoint(id, container) {
    const dot = document.getElementById(`dot-${id}`);
    if (!dot || !container) return null;
    const realX = parseFloat(dot.dataset.realX);
    const realY = parseFloat(dot.dataset.realY);
    if (!Number.isFinite(realX) || !Number.isFinite(realY)) return null;
    return projectedMobileGraphPoint(realX, realY, container, state.mobileGraphView, {
        viewMode: state.viewMode,
        isMobile: isMobileGraphExperience(),
        isTimelineOpen: state.isTimelineOpen,
    });
}

export function mobileDisplayedPoint(id, container) {
    const dot = document.getElementById(`dot-${id}`);
    if (!dot || !container) return null;
    const rect = dot.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
    };
}

export function applyMobileGraphView(container, { animate = false } = {}) {
    if (!container) return;
    clampMobileGraphView(state.mobileGraphView, container);
    container.classList.toggle("mobile-graph-zoomed", state.mobileGraphView.scale > MOBILE_MIN_ZOOM + 0.01);

    if (animate) {
        container.classList.add("mobile-view-animating");
        clearTimeout(mobileViewAnimationTimer);
        mobileViewAnimationTimer = setTimeout(() => {
            container.classList.remove("mobile-view-animating");
            scheduleMobileLabelClamp(container);
        }, 360);
    }

    container.querySelectorAll(".dot, .user-dot, .voter-dot").forEach((element) => {
        const x = parseFloat(element.dataset.realX);
        const y = parseFloat(element.dataset.realY);
        if (Number.isFinite(x) && Number.isFinite(y)) {
            positionElementForCurrentView(element, x, y, container);
        }
    });

    container.querySelectorAll(".connection-line").forEach((line) => {
        const x1 = parseFloat(line.dataset.realX1);
        const y1 = parseFloat(line.dataset.realY1);
        const x2 = parseFloat(line.dataset.realX2);
        const y2 = parseFloat(line.dataset.realY2);
        if ([x1, y1, x2, y2].every(Number.isFinite)) {
            updateConnectionLine(line.dataset.itemId, x1, y1, x2, y2);
        }
    });

    const readout = container.querySelector(".mobile-zoom-readout");
    if (readout) {
        readout.textContent = state.mobileGraphView.scale === 1
            ? "1×"
            : `${state.mobileGraphView.scale.toFixed(1).replace(".0", "")}×`;
    }

    if (state.mobileFanItemIds.length) layoutMobileFan(container);
    else scheduleMobileLabelClamp(container);
}

export function setMobileGraphZoom(container, nextScale, focalX, focalY, animate = false) {
    const scale = Math.max(MOBILE_MIN_ZOOM, Math.min(MOBILE_MAX_ZOOM, nextScale));
    const focusX = Number.isFinite(focalX) ? focalX : container.clientWidth / 2;
    const focusY = Number.isFinite(focalY) ? focalY : container.clientHeight / 2;
    const contentX = (focusX - state.mobileGraphView.offsetX) / state.mobileGraphView.scale;
    const contentY = (focusY - state.mobileGraphView.offsetY) / state.mobileGraphView.scale;
    state.mobileGraphView.scale = scale;
    state.mobileGraphView.offsetX = focusX - contentX * scale;
    state.mobileGraphView.offsetY = focusY - contentY * scale;
    applyMobileGraphView(container, { animate });
}

export function resetMobileGraphView(container, animate = true) {
    clearMobileFan();
    state.mobileFocusedClusterIds = [];
    state.mobileGraphReturnView = null;
    state.mobileGraphView.scale = 1;
    state.mobileGraphView.offsetX = 0;
    state.mobileGraphView.offsetY = 0;
    applyMobileGraphView(container, { animate });
}

export function rememberMobileGraphView() {
    if (state.mobileGraphReturnView) return;
    state.mobileGraphReturnView = { ...state.mobileGraphView };
}

export function restoreMobileGraphView(container, animate = true) {
    if (!state.mobileGraphReturnView) return false;
    const returnView = state.mobileGraphReturnView;
    state.mobileGraphReturnView = null;
    clearMobileFan();
    state.mobileFocusedClusterIds = [];
    state.mobileGraphView.scale = returnView.scale;
    state.mobileGraphView.offsetX = returnView.offsetX;
    state.mobileGraphView.offsetY = returnView.offsetY;
    applyMobileGraphView(container, { animate });
    return true;
}

export function focusMobileGraphOnCluster(ids, container, minimumScale = 2.2) {
    const points = ids
        .map((id) => {
            const dot = document.getElementById(`dot-${id}`);
            if (!dot) return null;
            return baseGraphPoint(parseFloat(dot.dataset.realX), parseFloat(dot.dataset.realY), container, {
                viewMode: state.viewMode,
                isMobile: isMobileGraphExperience(),
                isTimelineOpen: state.isTimelineOpen,
            });
        })
        .filter(Boolean);

    if (!points.length) return;
    const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    state.mobileGraphView.scale = Math.max(state.mobileGraphView.scale, minimumScale);
    state.mobileGraphView.offsetX = container.clientWidth / 2 - centerX * state.mobileGraphView.scale;
    state.mobileGraphView.offsetY = container.clientHeight / 2 - centerY * state.mobileGraphView.scale;
    applyMobileGraphView(container, { animate: true });
}

export function removeMobileFanGraphics() {
    const svgLayer = document.getElementById("connections-layer");
    if (!svgLayer) return;
    svgLayer.querySelectorAll(".mobile-fan-connector, .mobile-fan-origin").forEach((el) => el.remove());
}

export function clearMobileFan() {
    const container = document.getElementById("graph-container");
    if (container) {
        container.classList.remove("mobile-cluster-focus");
        container.querySelectorAll(".mobile-cluster-focus-label").forEach((el) => el.remove());
    }
    removeMobileFanGraphics();
    state.mobileFanItemIds.forEach((id) => {
        const dot = document.getElementById(`dot-${id}`);
        if (!dot) return;
        dot.classList.remove("mobile-fanned", "mobile-fan-primary");
        dot.style.setProperty("--fan-tx", "0px");
        dot.style.setProperty("--fan-ty", "0px");
    });
    state.mobileFanItemIds = [];
}

export function layoutMobileFan(container) {
    if (!container || !state.mobileFanItemIds.length || !isMobileGraphExperience()) return;

    removeMobileFanGraphics();
    const points = state.mobileFanItemIds
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
    focusLabel.textContent = `Zoomed cluster · ${points.length} tools`;

    const targets = computeFanPositions(points, { minimumGap: 58, passes: 14 });
    const svgLayer = document.getElementById("connections-layer");

    targets.forEach((target, index) => {
        const dot = document.getElementById(`dot-${target.id}`);
        if (!dot) return;
        dot.classList.add("mobile-fanned");
        dot.classList.toggle("mobile-fan-primary", index === 0);

        const currentPoint = mobileTruePoint(target.id, container);
        if (!currentPoint) return;
        const tx = target.x - currentPoint.x;
        const ty = target.y - currentPoint.y;
        dot.style.setProperty("--fan-tx", `${Math.round(tx)}px`);
        dot.style.setProperty("--fan-ty", `${Math.round(ty)}px`);

        if (svgLayer) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "mobile-fan-connector");
            line.setAttribute("x1", `${(target.origin.x / container.clientWidth) * 100}`);
            line.setAttribute("y1", `${(target.origin.y / container.clientHeight) * 100}`);
            line.setAttribute("x2", `${(target.x / container.clientWidth) * 100}`);
            line.setAttribute("y2", `${(target.y / container.clientHeight) * 100}`);
            svgLayer.appendChild(line);
        }
    });

    scheduleMobileLabelClamp(container);
}

export function expandMobileFan(ids, container) {
    if (!container || !ids.length || !isMobileGraphExperience()) return;
    clearMobileFan();
    state.mobileFanItemIds = [...ids];
    layoutMobileFan(container);
}

export function selectMobileItem(id) {
    const container = document.getElementById("graph-container");
    const wasFanned = state.mobileFanItemIds.includes(id);
    const returnView = state.mobileGraphReturnView;
    clearMobileFan();
    state.mobileFocusedClusterIds = [];
    state.mobileGraphReturnView = returnView;
    highlightItem(id);

    const row = document.getElementById(`panel-row-${id}`);
    if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (wasFanned && container) {
        scheduleMobileLabelClamp(container);
    }
}

export function scheduleMobileLabelClamp(container) {
    if (!container || !isMobileGraphExperience()) return;
    if (mobileLabelClampFrame) cancelAnimationFrame(mobileLabelClampFrame);
    mobileLabelClampFrame = requestAnimationFrame(() => {
        mobileLabelClampFrame = null;
        const containerRect = container.getBoundingClientRect();
        const activeIds = state.mobileFanItemIds.length
            ? state.mobileFanItemIds
            : state.highlightedId
              ? [state.highlightedId]
              : [];

        activeIds.forEach((id) => {
            const label = document.getElementById(`label-${id}`);
            const dot = document.getElementById(`dot-${id}`);
            if (!label || !dot) return;
            label.style.transform = "";
            const rect = label.getBoundingClientRect();
            let shiftX = 0;
            const margin = 10;
            if (rect.left < containerRect.left + margin) {
                shiftX = containerRect.left + margin - rect.left;
            } else if (rect.right > containerRect.right - margin) {
                shiftX = containerRect.right - margin - rect.right;
            }
            if (Math.abs(shiftX) > 1) {
                label.style.transform = `translateX(calc(-50% + ${Math.round(shiftX)}px))`;
            }
        });
    });
}

export function setupMobileGraphInteractions(container) {
    if (!container) return;

    let controls = container.querySelector(".mobile-graph-controls");
    if (!controls) {
        controls = document.createElement("div");
        controls.className = "mobile-graph-controls";
        controls.innerHTML = `
            <button type="button" class="mobile-zoom-btn zoom-in" aria-label="Zoom in">+</button>
            <span class="mobile-zoom-readout">1×</span>
            <button type="button" class="mobile-zoom-btn zoom-out" aria-label="Zoom out">−</button>
            <button type="button" class="mobile-zoom-btn zoom-reset" aria-label="Reset zoom">Reset</button>
        `;
        container.appendChild(controls);

        controls.querySelector(".zoom-in").onclick = (e) => {
            e.stopPropagation();
            setMobileGraphZoom(container, state.mobileGraphView.scale + 0.5, container.clientWidth / 2, container.clientHeight / 2, true);
        };
        controls.querySelector(".zoom-out").onclick = (e) => {
            e.stopPropagation();
            setMobileGraphZoom(container, state.mobileGraphView.scale - 0.5, container.clientWidth / 2, container.clientHeight / 2, true);
        };
        controls.querySelector(".zoom-reset").onclick = (e) => {
            e.stopPropagation();
            resetMobileGraphView(container, true);
        };
    }

    container.addEventListener("touchstart", (e) => {
        if (state.isDragging || !isMobileGraphExperience()) return;
        if (e.target.closest(".mobile-graph-controls, button, input, .tooltip")) return;

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            mobileGraphTapStart = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now(),
                target: e.target,
            };
            mobileViewportGesture = {
                mode: "pan",
                startX: touch.clientX,
                startY: touch.clientY,
                initialOffsetX: state.mobileGraphView.offsetX,
                initialOffsetY: state.mobileGraphView.offsetY,
            };
        } else if (e.touches.length === 2) {
            mobileGraphTapStart = null;
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const containerRect = container.getBoundingClientRect();
            mobileViewportGesture = {
                mode: "pinch",
                initialDistance: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
                initialScale: state.mobileGraphView.scale,
                focalX: (t1.clientX + t2.clientX) / 2 - containerRect.left,
                focalY: (t1.clientY + t2.clientY) / 2 - containerRect.top,
            };
        }
    }, { passive: true });

    container.addEventListener("touchmove", (e) => {
        if (!mobileViewportGesture || state.isDragging || !isMobileGraphExperience()) return;
        if (mobileViewportGesture.mode === "pan" && e.touches.length === 1) {
            const touch = e.touches[0];
            const dx = touch.clientX - mobileViewportGesture.startX;
            const dy = touch.clientY - mobileViewportGesture.startY;
            if (state.mobileGraphView.scale > 1.01 || Math.hypot(dx, dy) > 12) {
                if (state.mobileGraphView.scale > 1.01) {
                    e.preventDefault();
                    state.mobileGraphView.offsetX = mobileViewportGesture.initialOffsetX + dx;
                    state.mobileGraphView.offsetY = mobileViewportGesture.initialOffsetY + dy;
                    applyMobileGraphView(container);
                }
            }
        } else if (mobileViewportGesture.mode === "pinch" && e.touches.length === 2) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const scale = (distance / Math.max(1, mobileViewportGesture.initialDistance)) * mobileViewportGesture.initialScale;
            setMobileGraphZoom(container, scale, mobileViewportGesture.focalX, mobileViewportGesture.focalY, false);
        }
    }, { passive: false });

    const finishGesture = (e) => {
        if (!mobileViewportGesture) return;
        const gesture = mobileViewportGesture;
        mobileViewportGesture = null;

        if (mobileGraphTapStart && e.changedTouches && e.changedTouches.length) {
            const touch = e.changedTouches[0];
            const dx = Math.abs(touch.clientX - mobileGraphTapStart.x);
            const dy = Math.abs(touch.clientY - mobileGraphTapStart.y);
            const dt = Date.now() - mobileGraphTapStart.time;

            if (dx < 10 && dy < 10 && dt < 350) {
                handleMobileGraphTap(touch.clientX, touch.clientY, container);
            }
        }
        mobileGraphTapStart = null;
        if (state.mobileGraphView.scale > 1.01) clampMobileGraphView(state.mobileGraphView, container);
    };

    container.addEventListener("touchend", finishGesture);
    container.addEventListener("touchcancel", finishGesture);
}

function handleMobileGraphTap(clientX, clientY, container) {
    const ids = [...state.renderedItems];
    const pointsMap = new Map(ids.map((id) => [id, mobileTruePoint(id, container)]));

    const clickedId = findNearestItem(clientX, clientY, ids, (id) => mobileDisplayedPoint(id, container), 44);

    if (!clickedId) {
        if (!restoreMobileGraphView(container, true)) {
            clearMobileFan();
            clearHighlight();
        }
        return;
    }

    if (state.mobileFanItemIds.length && state.mobileFanItemIds.includes(clickedId)) {
        selectMobileItem(clickedId);
        return;
    }

    const cluster = findCollisionCluster(clickedId, ids, pointsMap, state.itemsCache, MOBILE_FAN_THRESHOLD);

    if (cluster.length > 1) {
        rememberMobileGraphView();
        state.mobileFocusedClusterIds = [...cluster];
        focusMobileGraphOnCluster(cluster, container, 2.2);
        expandMobileFan(cluster, container);
        highlightItem(cluster[0]);
    } else {
        selectMobileItem(clickedId);
    }
}
