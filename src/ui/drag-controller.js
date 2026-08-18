// Drag-to-vote controller for desktop mouse and mobile touch interactions
import { state, setState } from "../state/app-state.js";
import { unplotPct, mobileGraphPlotBounds } from "../core/coords.js";
import { updateElementPosition, updateConnectionLine } from "./graph-renderer.js";
import { highlightItem } from "./highlight.js";
import { showToast } from "./toast.js";
import { showConfirmVoteModal } from "./modals.js";
import { MOBILE_DRAG_THRESHOLD } from "../config/constants.js";

const isTouchDevice = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

const isMobileGraphExperience = () =>
    isTouchDevice() &&
    (window.innerWidth <= 600 || (window.innerHeight <= 500 && window.innerWidth <= 1000));

export function closeAllTooltips() {
    document.querySelectorAll(".dot.tooltip-active").forEach((d) => {
        d.classList.remove("tooltip-active");
    });
}

export function setupDrag(avgDot, userDot, item, container, { resetMobileGraphViewFn = null, showConfirmVoteModalFn = null } = {}) {
    function handleDotSelection() {
        highlightItem(item.id);
        const row = document.getElementById(`panel-row-${item.id}`);
        if (row && typeof row.scrollIntoView === "function") {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (!isMobileGraphExperience()) {
            const isTooltipActive = avgDot.classList.contains("tooltip-active");
            closeAllTooltips();
            if (!isTooltipActive) {
                avgDot.classList.add("tooltip-active");
            }
        }
    }

    const startDragInteraction = function (startX, startY, targetElement, originalEvent) {
        if (!state.currentUser || state.isConfirmingVote) return;

        if (state.isTimelineOpen && (state.currentTimelineTimestamp < state.timelineMaxTime - 5000)) {
            showToast("Scrub to Live to vote");
            return;
        }

        if (originalEvent && originalEvent.target) {
            if (
                originalEvent.target.closest(".admin-btn") ||
                originalEvent.target.closest("button") ||
                originalEvent.target.closest("input")
            ) {
                return;
            }
        }

        if (!state.votingEnabled && !state.isAdmin) {
            showToast("Voting Closed");
            return;
        }

        let isDragCommitted = false;
        const activeDot = userDot;

        let shiftX = 0;
        let shiftY = 0;

        function commitDrag(clientX, clientY) {
            isDragCommitted = true;
            setState({ isDragging: item.id });
            activeDot.style.display = "block";
            activeDot.style.zIndex = "1000";
            activeDot.classList.add("dragging");

            closeAllTooltips();

            if (isMobileGraphExperience() && state.mobileGraphView.scale > 1.01) {
                if (resetMobileGraphViewFn) resetMobileGraphViewFn(container, true);
                highlightItem(item.id);
            }

            if (isMobileGraphExperience()) {
                if (targetElement !== avgDot) {
                    const rect = activeDot.getBoundingClientRect();
                    shiftX = clientX - (rect.left + rect.width / 2);
                    shiftY = clientY - (rect.top + rect.height / 2);
                }
            } else if (targetElement === avgDot) {
                shiftX = activeDot.offsetWidth / 2;
                shiftY = activeDot.offsetHeight / 2;
            } else {
                const rect = activeDot.getBoundingClientRect();
                shiftX = clientX - rect.left;
                shiftY = clientY - rect.top;
            }

            moveAt(clientX, clientY);
        }

        function moveAt(pageX, pageY) {
            const containerRect = container.getBoundingClientRect();
            let newX = pageX - shiftX - containerRect.left;
            let newY = pageY - shiftY - containerRect.top;

            if (isMobileGraphExperience()) {
                newX = (newX - state.mobileGraphView.offsetX) / state.mobileGraphView.scale;
                newY = (newY - state.mobileGraphView.offsetY) / state.mobileGraphView.scale;
            }

            if (newX < 0) newX = 0;
            if (newX > container.clientWidth) newX = container.clientWidth;
            if (newY < 0) newY = 0;
            if (newY > container.clientHeight) newY = container.clientHeight;

            let pointerX = (newX / container.clientWidth) * 100;
            let pointerY;

            if (isMobileGraphExperience() && state.viewMode !== "1D") {
                const bounds = mobileGraphPlotBounds(container, state.isTimelineOpen);
                const boundedY = Math.max(
                    bounds.top,
                    Math.min(bounds.top + bounds.height, newY),
                );
                pointerY = 100 - ((boundedY - bounds.top) / bounds.height) * 100;
            } else {
                pointerY = 100 - (newY / container.clientHeight) * 100;
            }

            let percentX = Math.max(0, Math.min(100, unplotPct(pointerX)));
            let percentY = Math.max(0, Math.min(100, unplotPct(pointerY)));

            updateElementPosition(activeDot, percentX, percentY, container);

            const consensusDot = document.getElementById(`dot-${item.id}`);
            if (consensusDot) {
                const avgX = parseFloat(consensusDot.dataset.realX);
                const avgY = parseFloat(consensusDot.dataset.realY);
                updateConnectionLine(item.id, avgX, avgY, percentX, percentY);
            }
            activeDot.dataset.tempX = percentX;
            activeDot.dataset.tempY = percentY;
        }

        function onMouseMove(event) {
            const dist = Math.hypot(event.clientX - startX, event.clientY - startY);
            const threshold = 5;

            if (!isDragCommitted && dist >= threshold) {
                commitDrag(event.clientX, event.clientY);
            } else if (isDragCommitted) {
                moveAt(event.clientX, event.clientY);
            }
        }

        function onTouchMove(event) {
            if (event.touches.length > 0) {
                const touch = event.touches[0];
                const dist = Math.hypot(touch.clientX - startX, touch.clientY - startY);
                const isFannedChoice = state.mobileFanItemIds.includes(item.id);
                const threshold = isFannedChoice ? 8 : (isMobileGraphExperience() ? MOBILE_DRAG_THRESHOLD : 5);

                if (!isDragCommitted && dist >= threshold) {
                    commitDrag(touch.clientX, touch.clientY);
                } else if (isDragCommitted) {
                    moveAt(touch.clientX, touch.clientY);
                }
            }
        }

        async function endDrag() {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);
            document.removeEventListener("touchcancel", onTouchEnd);

            if (isDragCommitted && state.isDragging === item.id) {
                setState({ isDragging: null });
                activeDot.classList.remove("dragging");
                activeDot.style.transition = "";
                activeDot.style.zIndex = "";

                if (activeDot.dataset.tempX) {
                    let x = parseFloat(activeDot.dataset.tempX);
                    let y = parseFloat(activeDot.dataset.tempY);
                    delete activeDot.dataset.tempX;
                    delete activeDot.dataset.tempY;

                    if (state.viewMode === "1D") {
                        let targetY = 50;
                        const itemVotes = (state.previousData && state.previousData[item.id]) || {};
                        if (itemVotes[state.currentUser.uid]) {
                            targetY = itemVotes[state.currentUser.uid].y;
                        } else {
                            const avgDotDom = document.getElementById(`dot-${item.id}`);
                            if (avgDotDom && avgDotDom.dataset.realY != null) {
                                targetY = parseFloat(avgDotDom.dataset.realY);
                            } else {
                                targetY = item.y;
                            }
                        }
                        y = targetY;
                    }

                    if (showConfirmVoteModalFn) {
                        showConfirmVoteModalFn(item, x, y);
                    } else {
                        showConfirmVoteModal(item, x, y);
                    }
                }
            } else {
                // Was a click or quick tap without dragging
                if (state.isDragging === item.id) {
                    setState({ isDragging: null });
                }
                activeDot.classList.remove("dragging");
                delete activeDot.dataset.tempX;
                delete activeDot.dataset.tempY;

                // Hide connection line if it was temporarily shown
                const line = document.getElementById(`line-${item.id}`);
                if (line) line.style.display = "none";

                // Trigger selection & tooltip popup
                handleDotSelection();
            }
        }

        function onMouseUp() {
            endDrag();
        }

        function onTouchEnd() {
            endDrag();
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.addEventListener("touchend", onTouchEnd);
        document.addEventListener("touchcancel", onTouchEnd);
    };

    avgDot.onmousedown = (e) => startDragInteraction(e.clientX, e.clientY, avgDot, e);
    userDot.onmousedown = (e) => startDragInteraction(e.clientX, e.clientY, userDot, e);

    avgDot.addEventListener(
        "touchstart",
        (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                startDragInteraction(touch.clientX, touch.clientY, avgDot, e);
            }
        },
        { passive: true },
    );

    userDot.addEventListener(
        "touchstart",
        (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                startDragInteraction(touch.clientX, touch.clientY, userDot, e);
            }
        },
        { passive: true },
    );
}
