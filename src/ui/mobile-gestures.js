// Mobile touch gestures: pinch zoom, pan clamping, cluster tap-to-fan, and bounded labels
import { state, setState } from "../state/app-state.js";
import {
    clampMobileGraphView,
    baseGraphPoint,
    projectedMobileGraphPoint,
} from "../core/coords.js";
import { highlightItem, clearHighlight, getHighlightedId } from "./highlight.js";
import { positionElementForCurrentView, updateConnectionLine } from "./graph-renderer.js";
import { showToast } from "./toast.js";
import {
    MOBILE_MIN_ZOOM,
    MOBILE_MAX_ZOOM,
    MOBILE_FAN_THRESHOLD,
    MOBILE_DRAG_THRESHOLD,
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

export function nearestMobileItem(clientX, clientY, container, ids, maxDistance = 52) {
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

export function mobileCollisionCluster(seedId, container) {
    const ids = [...state.renderedItems];
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
                Math.hypot(current.x - candidate.x, current.y - candidate.y) <= MOBILE_FAN_THRESHOLD
            ) {
                cluster.add(candidateId);
                queue.push(candidateId);
            }
        });
    }

    return [...cluster].sort((a, b) =>
        (state.itemsCache[a]?.name || "").localeCompare(state.itemsCache[b]?.name || ""),
    );
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
    if (!state.mobileFanItemIds.length) return;
    const collapsingIds = [...state.mobileFanItemIds];
    state.mobileFanItemIds = [];
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
            if (state.mobileFanItemIds.includes(id)) return;
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
        }, 360);
    });
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

    const center = {
        x: points.reduce((sum, entry) => sum + entry.point.x, 0) / points.length,
        y: points.reduce((sum, entry) => sum + entry.point.y, 0) / points.length,
    };
    const targets = points.map(({ id, point }, index) => {
        const angle = -Math.PI / 2 + (index / points.length) * Math.PI * 2;
        return {
            id,
            origin: point,
            x: point.x + Math.cos(angle) * 2,
            y: point.y + Math.sin(angle) * 2,
        };
    });
    const minimumGap = 58;
    for (let pass = 0; pass < 14; pass++) {
        for (let i = 0; i < targets.length; i++) {
            for (let j = i + 1; j < targets.length; j++) {
                const a = targets[i];
                const b = targets[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let distance = Math.hypot(dx, dy);
                if (distance < 0.01) {
                    const angle = ((i + j + 1) / targets.length) * Math.PI * 2;
                    dx = Math.cos(angle);
                    dy = Math.sin(angle);
                    distance = 1;
                }
                if (distance >= minimumGap) continue;
                const push = (minimumGap - distance) * 0.36;
                const nx = dx / distance;
                const ny = dy / distance;
                a.x -= nx * push;
                a.y -= ny * push;
                b.x += nx * push;
                b.y += ny * push;
            }
        }
        targets.forEach((target) => {
            target.x += (target.origin.x - target.x) * 0.08;
            target.y += (target.origin.y - target.y) * 0.08;
        });
    }
    targets.forEach((target) => {
        const dx = target.x - target.origin.x;
        const dy = target.y - target.origin.y;
        const distance = Math.hypot(dx, dy);
        const maxShift = 38;
        if (distance > maxShift) {
            target.x = target.origin.x + (dx / distance) * maxShift;
            target.y = target.origin.y + (dy / distance) * maxShift;
        }
        target.x = Math.max(34, Math.min(container.clientWidth - 34, target.x));
        target.y = Math.max(76, Math.min(container.clientHeight - 58, target.y));
    });

    const svgLayer = document.getElementById("connections-layer");

    targets.forEach(({ id, origin: point, x: targetX, y: targetY }) => {
        const dot = document.getElementById(`dot-${id}`);
        if (!dot) return;
        const wasFanned = dot.classList.contains("mobile-fanned");
        dot.classList.remove(
            "mobile-fan-collapsing",
            "mobile-label-left",
            "mobile-label-right",
            "mobile-label-below",
        );
        dot.classList.add("mobile-fanned");
        const outwardX = targetX - center.x;
        const outwardY = targetY - center.y;
        if (Math.abs(outwardX) > Math.abs(outwardY) * 0.55) {
            dot.classList.add(outwardX < 0 ? "mobile-label-left" : "mobile-label-right");
        } else if (outwardY > 0) {
            dot.classList.add("mobile-label-below");
        }
        const fanX = `${targetX - point.x}px`;
        const fanY = `${targetY - point.y}px`;
        if (wasFanned) {
            dot.style.setProperty("--mobile-fan-x", fanX);
            dot.style.setProperty("--mobile-fan-y", fanY);
        } else {
            dot.style.setProperty("--mobile-fan-x", "0px");
            dot.style.setProperty("--mobile-fan-y", "0px");
            requestAnimationFrame(() => {
                if (!state.mobileFanItemIds.includes(id)) return;
                dot.style.setProperty("--mobile-fan-x", fanX);
                dot.style.setProperty("--mobile-fan-y", fanY);
            });
        }

        if (svgLayer) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "mobile-fan-connector");
            line.setAttribute("x1", `${(point.x / container.clientWidth) * 100}`);
            line.setAttribute("y1", `${(point.y / container.clientHeight) * 100}`);
            line.setAttribute("x2", `${(targetX / container.clientWidth) * 100}`);
            line.setAttribute("y2", `${(targetY / container.clientHeight) * 100}`);
            svgLayer.appendChild(line);

            const origin = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
            origin.setAttribute("class", "mobile-fan-origin");
            origin.setAttribute("cx", `${(point.x / container.clientWidth) * 100}`);
            origin.setAttribute("cy", `${(point.y / container.clientHeight) * 100}`);
            origin.setAttribute("rx", `${(7 / container.clientWidth) * 100}`);
            origin.setAttribute("ry", `${(7 / container.clientHeight) * 100}`);
            svgLayer.appendChild(origin);
        }
    });

    scheduleMobileLabelClamp(container);
}

export function expandMobileFan(ids, container) {
    rememberMobileGraphView();
    clearMobileFan();
    clearHighlight();
    focusMobileGraphOnCluster(ids, container);
    state.mobileFocusedClusterIds = [...ids];
    state.mobileFanItemIds = ids;
    layoutMobileFan(container);
    showToast(`${ids.length} tools here — choose one`);
}

export function selectMobileItem(id) {
    clearMobileFan();
    const container = document.getElementById("graph-container");
    if (container && isMobileGraphExperience()) {
        rememberMobileGraphView();
        focusMobileGraphOnCluster([id], container, 1.65);
    }
    highlightItem(id);
    const row = document.getElementById(`panel-row-${id}`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function scheduleMobileLabelClamp(container) {
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
        labels.forEach((label) => {
            const rect = label.getBoundingClientRect();
            const padding = 8;
            const topPadding = state.mobileGraphView.scale > 1.01 ? 48 : padding;
            let x = 0;
            let y = 0;
            if (rect.left < containerRect.left + padding) {
                x += containerRect.left + padding - rect.left;
            }
            if (rect.right > containerRect.right - padding) {
                x -= rect.right - (containerRect.right - padding);
            }
            if (rect.top < containerRect.top + topPadding) {
                y += containerRect.top + topPadding - rect.top;
            }
            if (rect.bottom > containerRect.bottom - padding) {
                y -= rect.bottom - (containerRect.bottom - padding);
            }
            label.style.setProperty("--mobile-label-x", `${x}px`);
            label.style.setProperty("--mobile-label-y", `${y}px`);
        });
    });
}

export function setupMobileGraphInteractions(container) {
    if (!container) return;

    let zoomControls = container.querySelector(".mobile-zoom-controls");
    if (!zoomControls) {
        zoomControls = document.createElement("div");
        zoomControls.className = "mobile-zoom-controls";
        zoomControls.setAttribute("aria-label", "Graph zoom controls");
        const zoomOut = document.createElement("button");
        zoomOut.type = "button";
        zoomOut.className = "mobile-zoom-out";
        zoomOut.setAttribute("aria-label", "Zoom out");
        zoomOut.textContent = "−";
        const zoomReadout = document.createElement("button");
        zoomReadout.type = "button";
        zoomReadout.className = "mobile-zoom-readout";
        zoomReadout.setAttribute("aria-label", "Reset graph zoom");
        zoomReadout.textContent = "1×";
        const zoomIn = document.createElement("button");
        zoomIn.type = "button";
        zoomIn.className = "mobile-zoom-in";
        zoomIn.setAttribute("aria-label", "Zoom in");
        zoomIn.textContent = "+";
        zoomControls.append(zoomOut, zoomReadout, zoomIn);
        container.appendChild(zoomControls);

        zoomOut.onclick = (event) => {
            event.stopPropagation();
            clearMobileFan();
            setMobileGraphZoom(
                container,
                state.mobileGraphView.scale / 1.4,
                container.clientWidth / 2,
                container.clientHeight / 2,
                true,
            );
        };
        zoomIn.onclick = (event) => {
            event.stopPropagation();
            clearMobileFan();
            setMobileGraphZoom(
                container,
                state.mobileGraphView.scale * 1.4,
                container.clientWidth / 2,
                container.clientHeight / 2,
                true,
            );
        };
        zoomReadout.onclick = (event) => {
            event.stopPropagation();
            resetMobileGraphView(container, true);
        };
    }

    const isInteractiveChrome = (target) =>
        target instanceof Element &&
        target.closest(
            "#top-right-controls, .mobile-zoom-controls, .tooltip, .onboarding-overlay, button, input, a",
        );

    const localTouch = (touch) => {
        const rect = container.getBoundingClientRect();
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };

    const beginPinch = (event) => {
        clearMobileFan();
        const a = localTouch(event.touches[0]);
        const b = localTouch(event.touches[1]);
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        mobileViewportGesture = {
            type: "pinch",
            startDistance: Math.hypot(b.x - a.x, b.y - a.y),
            startScale: state.mobileGraphView.scale,
            contentX: (midpoint.x - state.mobileGraphView.offsetX) / state.mobileGraphView.scale,
            contentY: (midpoint.y - state.mobileGraphView.offsetY) / state.mobileGraphView.scale,
        };
        mobileGraphTapStart = null;
        container.classList.add("mobile-view-manipulating");
    };

    container.addEventListener(
        "touchstart",
        (event) => {
            if (!isMobileGraphExperience() || isInteractiveChrome(event.target)) {
                mobileGraphTapStart = null;
                return;
            }
            if (event.touches.length === 2) {
                beginPinch(event);
                return;
            }
            if (event.touches.length !== 1) {
                mobileGraphTapStart = null;
                return;
            }
            const touch = event.touches[0];
            mobileGraphTapStart = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now(),
                canPan:
                    state.mobileGraphView.scale > 1.01 &&
                    !(event.target instanceof Element &&
                        event.target.closest(".dot, .user-dot")),
            };
        },
        { passive: true },
    );

    container.addEventListener(
        "touchmove",
        (event) => {
            if (!isMobileGraphExperience()) return;
            if (event.touches.length === 2) {
                if (mobileViewportGesture?.type !== "pinch") beginPinch(event);
                const a = localTouch(event.touches[0]);
                const b = localTouch(event.touches[1]);
                const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const distance = Math.hypot(b.x - a.x, b.y - a.y);
                state.mobileGraphView.scale = Math.max(
                    MOBILE_MIN_ZOOM,
                    Math.min(
                        MOBILE_MAX_ZOOM,
                        mobileViewportGesture.startScale *
                            (distance / Math.max(1, mobileViewportGesture.startDistance)),
                    ),
                );
                state.mobileGraphView.offsetX = midpoint.x - mobileViewportGesture.contentX * state.mobileGraphView.scale;
                state.mobileGraphView.offsetY = midpoint.y - mobileViewportGesture.contentY * state.mobileGraphView.scale;
                applyMobileGraphView(container);
                event.preventDefault();
                return;
            }
            if (event.touches.length === 1 && mobileGraphTapStart) {
                const touch = event.touches[0];
                const dx = touch.clientX - mobileGraphTapStart.x;
                const dy = touch.clientY - mobileGraphTapStart.y;
                const movement = Math.hypot(dx, dy);
                if (
                    !mobileViewportGesture &&
                    mobileGraphTapStart.canPan &&
                    movement > MOBILE_DRAG_THRESHOLD
                ) {
                    clearMobileFan();
                    mobileViewportGesture = {
                        type: "pan",
                        lastX: touch.clientX,
                        lastY: touch.clientY,
                    };
                    container.classList.add("mobile-view-manipulating");
                }
                if (mobileViewportGesture?.type === "pan") {
                    state.mobileGraphView.offsetX += touch.clientX - mobileViewportGesture.lastX;
                    state.mobileGraphView.offsetY += touch.clientY - mobileViewportGesture.lastY;
                    mobileViewportGesture.lastX = touch.clientX;
                    mobileViewportGesture.lastY = touch.clientY;
                    applyMobileGraphView(container);
                    event.preventDefault();
                }
            }
        },
        { passive: false },
    );

    container.addEventListener(
        "touchend",
        (event) => {
            if (mobileViewportGesture) {
                mobileGraphTapStart = null;
                if (event.touches.length === 0) {
                    mobileViewportGesture = null;
                    container.classList.remove("mobile-view-manipulating");
                    scheduleMobileLabelClamp(container);
                } else {
                    mobileViewportGesture.type = "waiting";
                }
                event.preventDefault();
                return;
            }
            const start = mobileGraphTapStart;
            mobileGraphTapStart = null;
            if (!start || !isMobileGraphExperience() || state.isDragging) return;
            const touch = event.changedTouches[0];
            if (!touch) return;
            const movement = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
            if (movement > MOBILE_DRAG_THRESHOLD || Date.now() - start.time > 450) return;

            event.preventDefault();
            if (state.mobileFanItemIds.length) {
                const selectedId = nearestMobileItem(
                    touch.clientX,
                    touch.clientY,
                    container,
                    state.mobileFanItemIds,
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
                [...state.renderedItems],
            );
            if (!nearestId) {
                const hadHighlight = Boolean(getHighlightedId());
                clearHighlight();
                if (!hadHighlight) restoreMobileGraphView(container, true);
                return;
            }
            const cluster = mobileCollisionCluster(nearestId, container);
            if (
                getHighlightedId() === nearestId &&
                state.mobileFocusedClusterIds.length > 1 &&
                state.mobileFocusedClusterIds.includes(nearestId)
            ) {
                expandMobileFan(state.mobileFocusedClusterIds, container);
            } else if (cluster.length > 1) {
                expandMobileFan(cluster, container);
            } else {
                state.mobileFocusedClusterIds = [nearestId];
                selectMobileItem(nearestId);
            }
        },
        { passive: false },
    );
}
