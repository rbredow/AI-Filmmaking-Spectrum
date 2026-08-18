import { describe, it, expect } from "vitest";
import { readinessColor, updateDotColor } from "../../src/core/colors.js";

describe("colors", () => {
    describe("readinessColor", () => {
        it("interpolates red (#ff3d00 = 255, 61, 0) at 0%", () => {
            expect(readinessColor(0)).toBe("rgb(255, 61, 0)");
        });

        it("interpolates yellow (#ffea00 = 255, 234, 0) at 50%", () => {
            expect(readinessColor(50)).toBe("rgb(255, 234, 0)");
        });

        it("interpolates green (#00e676 = 0, 230, 118) at 100%", () => {
            expect(readinessColor(100)).toBe("rgb(0, 230, 118)");
        });

        it("clamps out-of-bounds readiness values", () => {
            expect(readinessColor(-10)).toBe("rgb(255, 61, 0)");
            expect(readinessColor(150)).toBe("rgb(0, 230, 118)");
        });
    });

    describe("updateDotColor", () => {
        it("assigns ready-high class for y > 80", () => {
            const dot = document.createElement("div");
            updateDotColor(dot, 85);
            expect(dot.classList.contains("ready-high")).toBe(true);
            expect(dot.classList.contains("ready-mid")).toBe(false);
            expect(dot.classList.contains("ready-low")).toBe(false);
        });

        it("assigns ready-mid class for 50 < y <= 80", () => {
            const dot = document.createElement("div");
            updateDotColor(dot, 65);
            expect(dot.classList.contains("ready-mid")).toBe(true);
            expect(dot.classList.contains("ready-high")).toBe(false);
            expect(dot.classList.contains("ready-low")).toBe(false);
        });

        it("assigns ready-low class for y <= 50", () => {
            const dot = document.createElement("div");
            updateDotColor(dot, 30);
            expect(dot.classList.contains("ready-low")).toBe(true);
            expect(dot.classList.contains("ready-mid")).toBe(false);
            expect(dot.classList.contains("ready-high")).toBe(false);
        });
    });
});
