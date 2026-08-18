import { describe, it, expect, beforeEach } from "vitest";
import { state, setState } from "../../src/state/app-state.js";
import { allowProductionMutation, setPreviewVote, LOCAL_PREVIEW_UID } from "../../src/services/data-service.js";

describe("data-service", () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="toast-container"></div>`;
        setState({
            isStaticMode: false,
            isLocalPreviewMode: false,
            previousData: {},
        });
    });

    describe("allowProductionMutation", () => {
        it("returns true in live mode", () => {
            setState({ isStaticMode: false });
            expect(allowProductionMutation()).toBe(true);
        });

        it("returns false and shows toast in static mode", () => {
            setState({ isStaticMode: true, isLocalPreviewMode: false });
            expect(allowProductionMutation()).toBe(false);
            const toast = document.querySelector(".toast");
            expect(toast).not.toBeNull();
            expect(toast.textContent).toContain("static mode");
        });

        it("returns false and shows preview toast in local preview mode", () => {
            setState({ isStaticMode: true, isLocalPreviewMode: true });
            expect(allowProductionMutation()).toBe(false);
            const toast = document.querySelector(".toast");
            expect(toast).not.toBeNull();
            expect(toast.textContent).toContain("Local preview");
        });
    });

    describe("setPreviewVote", () => {
        it("intercepts vote locally without network mutation", () => {
            let updatedGraphVotes = null;
            const vote = { x: 75, y: 25, username: "Tester" };

            setPreviewVote("d01", vote, (nextVotes) => {
                updatedGraphVotes = nextVotes;
            });

            expect(state.previousData["d01"][LOCAL_PREVIEW_UID]).toEqual(vote);
            expect(updatedGraphVotes["d01"][LOCAL_PREVIEW_UID]).toEqual(vote);
        });
    });
});
