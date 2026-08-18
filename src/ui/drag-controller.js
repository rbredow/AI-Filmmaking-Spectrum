// Drag-to-vote controller for desktop mouse and mobile touch interactions
import { state, setState } from "../state/app-state.js";
import { unplotPct, mobileGraphPlotBounds } from "../core/coords.js";
import { updateElementPosition, updateConnectionLine } from "./graph-renderer.js";
import { highlightItem } from "./highlight.js";
import { showToast } from "./toast.js";
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
    const startDrag = function (clientX, clientY, targetElement, originalEvent) {
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

        if (originalEvent && originalEvent.preventDefault) originalEvent.preventDefault();
        if (originalEvent && originalEvent.stopPropagation) originalEvent.stopPropagation();

        if (isMobileGraphExperience() && state.mobileGraphView.scale > 1.01) {
            if (resetMobileGraphViewFn) resetMobileGraphViewFn(container, true);
            highlightItem(item.id);
        }

        setState({ isDragging: item.id });
        const activeDot = userDot;
        activeDot.style.display = "block";
        activeDot.style.zIndex = "1000";
        activeDot.classList.add("dragging");

        closeAllTooltips();

        let shiftX = 0;
        let shiftY = 0;

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

            if (state.isDragging === item.id) {
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

                    setState({
                        isConfirmingVote: true,
                        pendingVoteConfirmation: {
                            itemId: item.id,
                            vote: {
                                x: Math.round(x * 10) / 10,
                                y: Math.round(y * 10) / 10,
                                username: state.userDisplayName,
                                timestamp: Date.now(),
                            },
                        },
                    });

                    if (showConfirmVoteModalFn) {
                        showConfirmVoteModalFn(item, x, y);
                    }
                }
            }
        }

        document.addEventListener("mousemove", onMouseMove);
        document.onmouseup = endDrag;
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.ontouchend = endDrag;
        document.ontouchcancel = endDrag;

        moveAt(clientX, clientY);
    };

    avgDot.onmousedown = (e) => startDrag(e.clientX, e.clientY, avgDot, e);
    userDot.onmousedown = (e) => startDrag(e.clientX, e.clientY, userDot, e);

    avgDot.addEventListener(
        "touchstart",
        (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
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
                const isFannedChoice = state.mobileFanItemIds.includes(item.id);
                const dragThreshold = isFannedChoice ? 8 : (isMobileGraphExperience() ? MOBILE_DRAG_THRESHOLD : 5);

                if (moveX > dragThreshold || moveY > dragThreshold) {
                    if (
                        isMobileGraphExperience() &&
                        state.highlightedId !== item.id &&
                        !state.mobileFanItemIds.includes(item.id)
                    ) {
                        avgDot._touchStartTime = null;
                        return;
                    }
                    if (!state.isDragging) {
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
                const dragThreshold = isMobileGraphExperience() ? MOBILE_DRAG_THRESHOLD : 5;

                if (moveX > dragThreshold || moveY > dragThreshold) {
                    if (!state.isDragging) {
                        startDrag(touch.clientX, touch.clientY, userDot, e);
                    }
                    userDot._touchStartTime = null;
                }
            }
        },
        { passive: false },
    );
}
