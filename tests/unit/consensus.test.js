import { describe, it, expect } from "vitest";
import { computeConsensus } from "../../src/core/consensus.js";

describe("consensus", () => {
    const item = { id: "d01", name: "Denoising", x: 20, y: 80 };

    it("returns default item position when there are no votes", () => {
        const result = computeConsensus(item, {});
        expect(result.x).toBe(20);
        expect(result.y).toBe(80);
        expect(result.voteCount).toBe(0);
    });

    it("returns fallback {x:50, y:50} if item is null", () => {
        const result = computeConsensus(null, {});
        expect(result.x).toBe(50);
        expect(result.y).toBe(50);
    });

    it("factors in votes with initial weight of 10 for the seed position", () => {
        // Initial weight: 10 * (20, 80) = (200, 800), count = 10
        // One vote: (80, 20)
        // Total: (280, 820) / 11 = (25.4545..., 74.5454...)
        const votes = {
            user1: { x: 80, y: 20 },
        };
        const result = computeConsensus(item, votes);
        expect(result.x).toBeCloseTo(280 / 11, 4);
        expect(result.y).toBeCloseTo(820 / 11, 4);
        expect(result.voteCount).toBe(1);
    });

    it("handles multiple votes accurately", () => {
        const votes = {
            user1: { x: 50, y: 50 },
            user2: { x: 60, y: 60 },
        };
        // Total X: 20*10 + 50 + 60 = 310 / 12 = 25.833...
        // Total Y: 80*10 + 50 + 60 = 910 / 12 = 75.833...
        const result = computeConsensus(item, votes);
        expect(result.x).toBeCloseTo(310 / 12, 4);
        expect(result.y).toBeCloseTo(910 / 12, 4);
        expect(result.voteCount).toBe(2);
    });
});
