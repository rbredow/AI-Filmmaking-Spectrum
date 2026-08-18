import { describe, it, expect, beforeEach } from "vitest";
import {
    getItemCreationTimestamp,
    buildUserSessionTimestamps,
    getVoteTimestamp,
    formatTimelineDate,
} from "../../src/core/timeline-engine.js";
import { applyTimelineTimestamp, buildTimelineData, jumpToLive } from "../../src/ui/timeline-ui.js";
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
        it("staggers event voters around the creation timestamp of the latest tool they voted on", () => {
            const event1Time = new Date("2026-01-31T17:36:00Z").getTime();
            const event2Time = new Date("2026-06-06T17:21:00Z").getTime();
            const items = {
                d01: { id: "d01", x: 50, y: 50 },
                user_item_1: { id: "user_item_1", createdAt: event1Time, x: 20, y: 30 },
                user_item_2: { id: "user_item_2", createdAt: event2Time, x: 80, y: 90 },
            };
            const votes = {
                d01: {
                    voterJan17: { x: 50, y: 50 },
                },
                user_item_1: {
                    voterJan31_A: { x: 25, y: 35 },
                    voterJan31_B: { x: 30, y: 40 },
                },
                user_item_2: {
                    voterJun06: { x: 85, y: 95 },
                },
            };
            const sessions = buildUserSessionTimestamps(items, votes);
            const JAN17 = new Date("2026-01-17T00:00:00Z").getTime();

            // voterJan17 voted only on d01 -> clustered around Jan 17
            expect(sessions.voterJan17).toBeGreaterThanOrEqual(JAN17);
            expect(sessions.voterJan17).toBeLessThan(event1Time);

            // voterJan31_A and B voted on user_item_1 -> clustered around Jan 31
            expect(sessions.voterJan31_A).toBeGreaterThanOrEqual(event1Time);
            expect(sessions.voterJan31_B).toBeGreaterThan(sessions.voterJan31_A);
            expect(sessions.voterJan31_B).toBeLessThan(event2Time);

            // voterJun06 voted on user_item_2 -> clustered around Jun 6
            expect(sessions.voterJun06).toBeGreaterThanOrEqual(event2Time);
        });

        it("getVoteTimestamp automatically uses cached session timestamps from buildUserSessionTimestamps", () => {
            const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
            const items = { user_item_1786819603744: { createdAt: AUG15_START, x: 50, y: 50 } };
            const votes = {
                user_item_1786819603744: {
                    voterAlpha: { x: 80, y: 90 },
                },
            };
            buildUserSessionTimestamps(items, votes);

            const ts = getVoteTimestamp("user_item_1786819603744", "voterAlpha", votes.user_item_1786819603744.voterAlpha);

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

        it("preserves decaying voter dots when timeline reaches 100% / jumpToLive", () => {
            const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
            const AUG15_END = new Date("2026-08-15T20:30:00Z").getTime();

            // Set last scrub position
            applyTimelineTimestamp(AUG15_START, { skipSplashes: true, immediate: true });

            // Scrub forward so voterLate arrives
            applyTimelineTimestamp(AUG15_END, { direction: 1, skipSplashes: false });
            const voterDot = document.getElementById("voter-dot-tool_01-voterLate");
            expect(voterDot.classList.contains("visible")).toBe(true);

            // Jump to live / 100% position: actively decaying dot must remain visible to finish its decay
            jumpToLive();
            expect(voterDot.classList.contains("visible")).toBe(true);
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
