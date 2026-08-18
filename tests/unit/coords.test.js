import { describe, it, expect } from "vitest";
import {
    plotPct,
    unplotPct,
    PLOT_PAD,
    mobileGraphPlotBounds,
    baseGraphPoint,
    projectedMobileGraphPoint,
    clampMobileGraphView,
} from "../../src/core/coords.js";

describe("coords", () => {
    describe("plotPct and unplotPct", () => {
        it("applies inset margin padding of 3.5%", () => {
            expect(plotPct(0)).toBe(PLOT_PAD); // 3.5%
            expect(plotPct(100)).toBe(100 - PLOT_PAD); // 96.5%
            expect(plotPct(50)).toBe(50); // 50%
        });

        it("unplotPct correctly inverts plotPct round-trip", () => {
            [0, 10, 25, 50, 75, 90, 100].forEach((val) => {
                const plotted = plotPct(val);
                const unplotted = unplotPct(plotted);
                expect(unplotted).toBeCloseTo(val, 5);
            });
        });

        it("clamps out-of-range input in plotPct", () => {
            expect(plotPct(-20)).toBe(PLOT_PAD);
            expect(plotPct(120)).toBe(100 - PLOT_PAD);
        });
    });

    describe("mobileGraphPlotBounds", () => {
        it("computes bounds respecting available height and timeline status", () => {
            const container = { clientHeight: 500 };
            const boundsWithoutTimeline = mobileGraphPlotBounds(container, false);
            expect(boundsWithoutTimeline.top).toBe(60);
            expect(boundsWithoutTimeline.bottom).toBe(32);
            expect(boundsWithoutTimeline.height).toBe(500 - 60 - 32);

            const boundsWithTimeline = mobileGraphPlotBounds(container, true);
            expect(boundsWithTimeline.bottom).toBe(78);
            expect(boundsWithTimeline.height).toBe(500 - 60 - 78);
        });

        it("handles very small heights gracefully without negative heights", () => {
            const smallContainer = { clientHeight: 100 };
            const bounds = mobileGraphPlotBounds(smallContainer, false);
            expect(bounds.top).toBe(25); // 25% of 100
            expect(bounds.bottom).toBe(32);
            expect(bounds.height).toBe(100 - 25 - 32);
            expect(bounds.height).toBeGreaterThan(0);
        });
    });

    describe("baseGraphPoint", () => {
        const container = { clientWidth: 1000, clientHeight: 800 };

        it("computes standard 2D desktop coordinates", () => {
            const pt = baseGraphPoint(50, 50, container, { viewMode: "2D", isMobile: false });
            expect(pt.x).toBe(500);
            expect(pt.y).toBe(400);
        });

        it("flattens Y to center in 1D view mode", () => {
            const pt = baseGraphPoint(75, 10, container, { viewMode: "1D", isMobile: false });
            expect(pt.x).toBeCloseTo((plotPct(75) / 100) * 1000, 3);
            expect(pt.y).toBe(400); // 800 / 2
        });
    });

    describe("clampMobileGraphView", () => {
        it("resets offset to 0 if scale is at 1x minimum zoom", () => {
            const view = { scale: 1, offsetX: 100, offsetY: -50 };
            const container = { clientWidth: 400, clientHeight: 300 };
            clampMobileGraphView(view, container);
            expect(view.scale).toBe(1);
            expect(view.offsetX).toBe(0);
            expect(view.offsetY).toBe(0);
        });

        it("clamps excessive panning within overscroll limits when zoomed", () => {
            const view = { scale: 2, offsetX: 5000, offsetY: -5000 };
            const container = { clientWidth: 400, clientHeight: 300 };
            clampMobileGraphView(view, container);
            const overscrollX = 400 * 0.45;
            const overscrollY = 300 * 0.45;
            expect(view.offsetX).toBeLessThanOrEqual(overscrollX);
            expect(view.offsetY).toBeGreaterThanOrEqual(300 * (1 - 2) - overscrollY);
        });
    });
});
