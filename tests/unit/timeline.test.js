import { describe, it, expect } from "vitest";
import {
    getItemCreationTimestamp,
    buildUserSessionTimestamps,
    getVoteTimestamp,
    formatTimelineDate,
} from "../../src/core/timeline-engine.js";

describe("timeline-engine", () => {
    describe("getItemCreationTimestamp", () => {
        it("extracts timestamp from user_item_ format", () => {
            const ts = 1715000000000;
            expect(getItemCreationTimestamp(`user_item_${ts}`, {})).toBe(ts);
        });

        it("uses item.createdAt or item.timestamp if present", () => {
            expect(getItemCreationTimestamp("d01", { createdAt: 1716000000000 })).toBe(1716000000000);
            expect(getItemCreationTimestamp("d02", { timestamp: 1717000000000 })).toBe(1717000000000);
        });

        it("defaults base seed items to project launch timestamp (Jan 17 2026)", () => {
            const launchDate = new Date("2026-01-17T00:00:00Z").getTime();
            expect(getItemCreationTimestamp("d01", {})).toBe(launchDate);
        });
    });

    describe("buildUserSessionTimestamps", () => {
        it("staggers unknown Aug 15 session voters across the Aug 15 session window", () => {
            const items = {
                d01: { x: 50, y: 50 },
            };
            const votes = {
                d01: {
                    newVoter1: { x: 10, y: 20 },
                    newVoter2: { x: 30, y: 40 },
                },
            };
            const sessions = buildUserSessionTimestamps(items, votes);
            const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
            const AUG15_END = new Date("2026-08-15T20:30:00Z").getTime();

            expect(sessions.newVoter1).toBeGreaterThanOrEqual(AUG15_START);
            expect(sessions.newVoter1).toBeLessThanOrEqual(AUG15_END);
            expect(sessions.newVoter2).toBeGreaterThanOrEqual(AUG15_START);
            expect(sessions.newVoter2).toBeLessThanOrEqual(AUG15_END);
            expect(sessions.newVoter2).toBeGreaterThan(sessions.newVoter1);
        });
    });

    describe("formatTimelineDate", () => {
        it("formats timestamp into human-readable date and time strings", () => {
            const testDate = new Date("2026-08-15T19:30:00Z").getTime();
            const result = formatTimelineDate(testDate);
            expect(result.dateStr).toContain("Aug");
            expect(result.dateStr).toContain("2026");
            expect(result.timeStr).toMatch(/\d{1,2}:\d{2}\s+(AM|PM)/);
        });
    });
});
