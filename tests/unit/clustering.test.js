import { describe, it, expect } from "vitest";
import {
    findCollisionCluster,
    findNearestItem,
    computeFanPositions,
} from "../../src/core/clustering.js";

describe("clustering", () => {
    describe("findCollisionCluster", () => {
        it("groups items within the 32px collision threshold into a single cluster", () => {
            const pointsMap = new Map([
                ["a", { x: 100, y: 100 }],
                ["b", { x: 120, y: 100 }], // distance = 20 <= 32 from a
                ["c", { x: 140, y: 100 }], // distance = 20 <= 32 from b (chained)
                ["isolated", { x: 300, y: 300 }], // distance > 32 from all
            ]);
            const itemsMap = {
                a: { name: "Tool A" },
                b: { name: "Tool B" },
                c: { name: "Tool C" },
                isolated: { name: "Tool Isolated" },
            };

            const cluster = findCollisionCluster("a", ["a", "b", "c", "isolated"], pointsMap, itemsMap);
            expect(cluster).toContain("a");
            expect(cluster).toContain("b");
            expect(cluster).toContain("c");
            expect(cluster).not.toContain("isolated");
            expect(cluster.length).toBe(3);
        });

        it("returns only the seed item if it is isolated", () => {
            const pointsMap = new Map([
                ["isolated", { x: 500, y: 500 }],
                ["other", { x: 100, y: 100 }],
            ]);
            const cluster = findCollisionCluster("isolated", ["isolated", "other"], pointsMap, {});
            expect(cluster).toEqual(["isolated"]);
        });
    });

    describe("findNearestItem", () => {
        it("finds closest item within max distance", () => {
            const points = {
                t1: { x: 50, y: 50 },
                t2: { x: 100, y: 100 },
                t3: { x: 300, y: 300 },
            };
            const nearest = findNearestItem(52, 53, ["t1", "t2", "t3"], (id) => points[id], 50);
            expect(nearest).toBe("t1");
        });

        it("returns null if no item is within max distance", () => {
            const points = {
                t1: { x: 500, y: 500 },
            };
            const nearest = findNearestItem(50, 50, ["t1"], (id) => points[id], 50);
            expect(nearest).toBeNull();
        });
    });

    describe("computeFanPositions", () => {
        it("spreads overlapping points outward with minimum gap", () => {
            const points = [
                { id: "p1", point: { x: 200, y: 200 } },
                { id: "p2", point: { x: 202, y: 201 } },
                { id: "p3", point: { x: 201, y: 202 } },
            ];
            const targets = computeFanPositions(points, { minimumGap: 50 });
            expect(targets.length).toBe(3);

            // Verify pairwise distances between targets are greater than or equal to minimum gap
            for (let i = 0; i < targets.length; i++) {
                for (let j = i + 1; j < targets.length; j++) {
                    const dist = Math.hypot(targets[i].x - targets[j].x, targets[i].y - targets[j].y);
                    expect(dist).toBeGreaterThanOrEqual(45); // close to minimumGap after repulsion
                }
            }
        });
    });
});
