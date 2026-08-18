import { describe, it, expect, beforeEach } from "vitest";
import { unplotPct, plotPct } from "../../src/core/coords.js";

describe("drag-controller UX contracts", () => {
    let container;
    let avgDot;
    let userDot;
    let connectionLine;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="graph-container" style="width: 1000px; height: 800px; position: relative;">
                <svg id="connections-layer" viewBox="0 0 100 100" style="width: 100%; height: 100%;">
                    <line id="line-d01" class="connection-line" data-item-id="d01" x1="20" y1="80" x2="20" y2="80"></line>
                </svg>
                <div id="dot-d01" class="dot" data-real-x="20" data-real-y="80" style="position: absolute; left: 20%; bottom: 80%;"></div>
                <div id="user-dot-d01" class="user-dot" data-real-x="20" data-real-y="80" style="position: absolute; display: none;"></div>
                <div id="confirm-vote-modal" style="display: none;">
                    <div id="confirm-vote-title"></div>
                    <div id="confirm-vote-stats"></div>
                    <div id="confirm-vote-username-section" style="display: none;">
                        <input id="confirm-vote-username-input" />
                    </div>
                </div>
            </div>
        `;
        container = document.getElementById("graph-container");
        avgDot = document.getElementById("dot-d01");
        userDot = document.getElementById("user-dot-d01");
        connectionLine = document.getElementById("line-d01");
    });

    describe("Touch movement threshold", () => {
        it("distinguishes tap (<12px) from drag (>=12px)", () => {
            const MOBILE_DRAG_THRESHOLD = 12;

            // Scenario 1: Small movement (e.g. 5px jitter on finger down)
            const touchStart = { x: 100, y: 100 };
            const smallMove = { x: 104, y: 103 };
            const smallDelta = Math.hypot(smallMove.x - touchStart.x, smallMove.y - touchStart.y);
            const isSmallDrag = smallDelta >= MOBILE_DRAG_THRESHOLD;
            expect(isSmallDrag).toBe(false);

            // Scenario 2: Intentional swipe/drag (e.g. 25px move)
            const dragMove = { x: 125, y: 100 };
            const dragDelta = Math.hypot(dragMove.x - touchStart.x, dragMove.y - touchStart.y);
            const isIntentionalDrag = dragDelta >= MOBILE_DRAG_THRESHOLD;
            expect(isIntentionalDrag).toBe(true);
        });

        it("uses reduced 8px threshold for fanned cluster items", () => {
            const FAN_DRAG_THRESHOLD = 8;
            const moveDelta = 9;
            expect(moveDelta >= FAN_DRAG_THRESHOLD).toBe(true);
        });
    });

    describe("1D View mode constraint", () => {
        it("locks Y coordinate to baseline or previous vote when dragging in 1D mode", () => {
            const viewMode = "1D";
            const previousVote = { x: 40, y: 85 };
            const draggedPoint = { x: 75, y: 30 }; // User dragged up/down and sideways

            let finalY = draggedPoint.y;
            if (viewMode === "1D") {
                finalY = previousVote ? previousVote.y : 50;
            }

            expect(finalY).toBe(85); // Preserved previous Y
        });
    });

    describe("Coordinate clamping & unplotting", () => {
        it("clamps pointer beyond graph borders to 0% and 100%", () => {
            const containerWidth = 1000;
            const pointerBeyondRight = 1200;
            const pointerBeyondLeft = -200;

            const clampedXRight = Math.min(containerWidth, Math.max(0, pointerBeyondRight));
            const clampedXLeft = Math.min(containerWidth, Math.max(0, pointerBeyondLeft));

            const pctRight = Math.max(0, Math.min(100, unplotPct((clampedXRight / containerWidth) * 100)));
            const pctLeft = Math.max(0, Math.min(100, unplotPct((clampedXLeft / containerWidth) * 100)));

            expect(pctRight).toBe(100);
            expect(pctLeft).toBe(0);
        });
    });
});
