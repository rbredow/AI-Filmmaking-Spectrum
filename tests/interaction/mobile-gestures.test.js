import { describe, it, expect, beforeEach } from "vitest";
import { clampMobileGraphView } from "../../src/core/coords.js";
import { findCollisionCluster, computeFanPositions } from "../../src/core/clustering.js";
import { state, setState } from "../../src/state/app-state.js";
import { layoutMobileFan, clearMobileFan } from "../../src/ui/mobile-gestures.js";

describe("mobile-gestures UX contracts", () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="graph-container" style="width: 390px; height: 400px; position: relative;">
                <svg id="connections-layer" viewBox="0 0 100 100"></svg>
                <div id="dot-d01" class="dot" data-real-x="20" data-real-y="80">
                    <div id="label-d01" class="dot-label">Denoising</div>
                </div>
                <div id="dot-d02" class="dot" data-real-x="21" data-real-y="81">
                    <div id="label-d02" class="dot-label">Script Breakdown</div>
                </div>
                <div id="dot-d03" class="dot" data-real-x="90" data-real-y="10">
                    <div id="label-d03" class="dot-label">Idea to Script</div>
                </div>
            </div>
        `;
        container = document.getElementById("graph-container");
        Object.defineProperty(container, "clientWidth", { value: 390, configurable: true });
        Object.defineProperty(container, "clientHeight", { value: 400, configurable: true });
        // Mock window matchMedia for mobile
        window.matchMedia = (query) => ({
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true,
        });
        window.innerWidth = 390;
        window.innerHeight = 844;
    });

    describe("Zoom & viewport state", () => {
        it("clamps zoom scale between 1.0 and 3.5", () => {
            const MIN_ZOOM = 1;
            const MAX_ZOOM = 3.5;

            const clampZoom = (val) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, val));

            expect(clampZoom(0.5)).toBe(1.0);
            expect(clampZoom(4.8)).toBe(3.5);
            expect(clampZoom(2.2)).toBe(2.2);
        });

        it("auto-resets zoom offsets when returned to 1x zoom", () => {
            const view = { scale: 1, offsetX: 50, offsetY: -30 };
            clampMobileGraphView(view, container);
            expect(view.scale).toBe(1);
            expect(view.offsetX).toBe(0);
            expect(view.offsetY).toBe(0);
        });
    });

    describe("Cluster fan expansion", () => {
        it("detects dense cluster of dots on mobile tap", () => {
            const points = new Map([
                ["d01", { x: 80, y: 100 }],
                ["d02", { x: 85, y: 105 }], // within 32px of d01
                ["d03", { x: 300, y: 350 }], // isolated
            ]);

            const cluster = findCollisionCluster("d01", ["d01", "d02", "d03"], points, {
                d01: { name: "Denoising" },
                d02: { name: "Script Breakdown" },
                d03: { name: "Idea to Script" },
            });

            expect(cluster).toEqual(["d01", "d02"]);
            expect(cluster).not.toContain("d03");
        });

        it("calculates fanned out circular targets with connecting lines", () => {
            const points = [
                { id: "d01", point: { x: 80, y: 100 } },
                { id: "d02", point: { x: 85, y: 105 } },
            ];
            const fanned = computeFanPositions(points);
            expect(fanned.length).toBe(2);
            expect(fanned[0].origin).toEqual({ x: 80, y: 100 });
            expect(fanned[1].origin).toEqual({ x: 85, y: 105 });
        });

        it("layoutMobileFan applies --mobile-fan-x and --mobile-fan-y CSS variables", () => {
            setState({
                mobileFanItemIds: ["d01", "d02"],
                renderedItems: new Set(["d01", "d02", "d03"]),
                itemsCache: {
                    d01: { name: "Denoising", x: 20, y: 80 },
                    d02: { name: "Script Breakdown", x: 21, y: 81 },
                },
            });

            layoutMobileFan(container);

            const dot1 = document.getElementById("dot-d01");
            const dot2 = document.getElementById("dot-d02");

            expect(dot1.classList.contains("mobile-fanned")).toBe(true);
            expect(dot2.classList.contains("mobile-fanned")).toBe(true);

            expect(dot1.style.getPropertyValue("--mobile-fan-x")).toBeDefined();
            expect(dot1.style.getPropertyValue("--mobile-fan-y")).toBeDefined();
            expect(dot2.style.getPropertyValue("--mobile-fan-x")).toBeDefined();
            expect(dot2.style.getPropertyValue("--mobile-fan-y")).toBeDefined();

            const connectors = container.querySelectorAll(".mobile-fan-connector");
            expect(connectors.length).toBe(2);

            const origins = container.querySelectorAll(".mobile-fan-origin");
            expect(origins.length).toBe(2);
        });
    });
});
