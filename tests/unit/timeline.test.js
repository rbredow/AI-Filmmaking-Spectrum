import { describe, it, expect, beforeEach } from "vitest";
import {
    getItemCreationTimestamp,
    buildUserSessionTimestamps,
    getVoteTimestamp,
    formatTimelineDate,
} from "../../src/core/timeline-engine.js";
import { applyTimelineTimestamp, buildTimelineData } from "../../src/ui/timeline-ui.js";
import { state, setState } from "../../src/state/app-state.js";

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

    describe("buildUserSessionTimestamps and getVoteTimestamp cache", () => {
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

        it("getVoteTimestamp automatically uses cached session timestamps from buildUserSessionTimestamps", () => {
            const items = { d01: { x: 50, y: 50 } };
            const votes = {
                d01: {
                    voterAlpha: { x: 80, y: 90 },
                },
            };
            buildUserSessionTimestamps(items, votes);

            const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
            const ts = getVoteTimestamp("d01", "voterAlpha", votes.d01.voterAlpha);

            // Must NOT default to Jan 17 2026
            const jan17 = new Date("2026-01-17T00:00:00Z").getTime();
            expect(ts).not.toBe(jan17);
            expect(ts).toBeGreaterThanOrEqual(AUG15_START);
        });
    });

    describe("applyTimelineTimestamp dynamic dot position progression", () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="graph-container" style="width: 500px; height: 500px; position: relative;">
                    <div id="dot-tool_01" class="dot" data-real-x="50" data-real-y="50"></div>
                </div>
            `;
            const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
            const AUG15_END = new Date("2026-08-15T20:30:00Z").getTime();

            setState({
                itemsCache: {
                    tool_01: { id: "tool_01", name: "Tool 1", x: 50, y: 50, createdAt: new Date("2026-01-17T00:00:00Z").getTime() },
                },
                latestLiveVotes: {
                    tool_01: {
                        voterLate: { x: 100, y: 100, timestamp: AUG15_END },
                    },
                },
                renderedItems: new Set(["tool_01"]),
                timelineMinTime: new Date("2026-01-17T00:00:00Z").getTime(),
                timelineMaxTime: AUG15_END + 10000,
                visibleItemIdsAtCurrentTime: new Set(["tool_01"]),
                viewMode: "2D",
            });
        });

        it("updates consensus position dynamically as timeline time advances past vote timestamps", () => {
            const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
            const AUG15_END = new Date("2026-08-15T20:30:00Z").getTime();
            const dot = document.getElementById("dot-tool_01");

            // At Aug 15 start (before vote): position should remain baseline (50, 50)
            applyTimelineTimestamp(AUG15_START, { immediate: true });
            expect(parseFloat(dot.dataset.realX)).toBe(50);
            expect(parseFloat(dot.dataset.realY)).toBe(50);

            // At Aug 15 end (after vote at 100, 100): position moves towards vote
            applyTimelineTimestamp(AUG15_END, { immediate: true });
            expect(parseFloat(dot.dataset.realX)).toBeGreaterThan(50);
            expect(parseFloat(dot.dataset.realY)).toBeGreaterThan(50);
        });

        it("displays and fades voter dots as votes land during timeline forward scrubbing/playback", () => {
            const container = document.getElementById("graph-container");
            const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
            const AUG15_END = new Date("2026-08-15T20:30:00Z").getTime();

            // Set last scrub position to AUG15_START
            applyTimelineTimestamp(AUG15_START, { skipSplashes: true, immediate: true });

            // Now scrub forward to AUG15_END where voterLate (100, 100) lands
            applyTimelineTimestamp(AUG15_END, { direction: 1, skipSplashes: false });

            const voterDot = document.getElementById("voter-dot-tool_01-voterLate");
            expect(voterDot).not.toBeNull();
            expect(voterDot.classList.contains("visible")).toBe(true);
        });

        it("clears visible class when scrubbing backward past a vote arrival timestamp", () => {
            const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
            const AUG15_END = new Date("2026-08-15T20:30:00Z").getTime();

            // Scrub forward to make it visible
            applyTimelineTimestamp(AUG15_END, { direction: 1, skipSplashes: false });
            const voterDot = document.getElementById("voter-dot-tool_01-voterLate");
            expect(voterDot.classList.contains("visible")).toBe(true);

            // Scrub backward before the vote
            applyTimelineTimestamp(AUG15_START, { direction: -1 });
            expect(voterDot.classList.contains("visible")).toBe(false);
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
