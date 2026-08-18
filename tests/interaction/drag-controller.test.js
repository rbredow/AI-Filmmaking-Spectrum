import { describe, it, expect, beforeEach } from "vitest";
import { setupDrag } from "../../src/ui/drag-controller.js";
import { state, setState } from "../../src/state/app-state.js";

describe("drag-controller UX contracts", () => {
    let container, avgDot, userDot, line;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="graph-container" style="width: 500px; height: 500px; position: relative;">
                <svg id="connections-layer" viewBox="0 0 100 100">
                    <line id="line-tool_01" class="connection-line" style="display: none;"></line>
                </svg>
                <div id="dot-tool_01" class="dot" data-real-x="50" data-real-y="50"></div>
                <div id="user-dot-tool_01" class="user-dot" style="display: none;"></div>
            </div>
            <div id="confirm-vote-modal" style="display: none;"></div>
        `;
        container = document.getElementById("graph-container");
        avgDot = document.getElementById("dot-tool_01");
        userDot = document.getElementById("user-dot-tool_01");
        line = document.getElementById("line-tool_01");

        Object.defineProperty(container, "clientWidth", { value: 500, configurable: true });
        Object.defineProperty(container, "clientHeight", { value: 500, configurable: true });
        container.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 500,
            height: 500,
            right: 500,
            bottom: 500,
        });

        setState({
            currentUser: { uid: "test_user" },
            userDisplayName: "Tester",
            votingEnabled: true,
            isAdmin: false,
            isDragging: null,
            viewMode: "2D",
        });
    });

    it("makes connection line visible with display block during drag movement", () => {
        setupDrag(avgDot, userDot, { id: "tool_01", x: 50, y: 50 }, container);

        // Start mouse drag
        const mousedown = new MouseEvent("mousedown", { clientX: 250, clientY: 250, bubbles: true });
        avgDot.dispatchEvent(mousedown);

        // Move pointer to a new position
        const mousemove = new MouseEvent("mousemove", { clientX: 350, clientY: 150, bubbles: true });
        document.dispatchEvent(mousemove);

        expect(userDot.style.display).toBe("block");
        expect(line.style.display).toBe("block");
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    it("prevents drag when voting is disabled and user is not admin", () => {
        setState({ votingEnabled: false, isAdmin: false });
        setupDrag(avgDot, userDot, { id: "tool_01", x: 50, y: 50 }, container);

        avgDot.dispatchEvent(new MouseEvent("mousedown", { clientX: 250, clientY: 250, bubbles: true }));
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 300, bubbles: true }));
        expect(state.isDragging).toBeNull();
        expect(userDot.style.display).toBe("none");
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    it("allows drag when user is admin even if general voting is disabled", () => {
        setState({ votingEnabled: false, isAdmin: true });
        setupDrag(avgDot, userDot, { id: "tool_01", x: 50, y: 50 }, container);

        avgDot.dispatchEvent(new MouseEvent("mousedown", { clientX: 250, clientY: 250, bubbles: true }));
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 300, bubbles: true }));
        expect(state.isDragging).toBe("tool_01");
        expect(userDot.style.display).toBe("block");
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    it("locks Y coordinate to current/baseline in 1D view mode upon drop", () => {
        setState({ viewMode: "1D", isConfirmingVote: false });
        let confirmedItem = null;
        let confirmedX = null;
        let confirmedY = null;

        avgDot.dataset.realY = "70";
        setupDrag(avgDot, userDot, { id: "tool_01", x: 50, y: 70 }, container, {
            showConfirmVoteModalFn: (item, x, y) => {
                confirmedItem = item;
                confirmedX = x;
                confirmedY = y;
            },
        });

        // Drag in 1D mode
        avgDot.dispatchEvent(new MouseEvent("mousedown", { clientX: 250, clientY: 250, bubbles: true }));
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 100, bubbles: true }));
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

        expect(confirmedItem).not.toBeNull();
        expect(confirmedY).toBe(70); // Locked to baseline Y=70 despite mouse Y=100
    });

    it("tapping or clicking dot with minimal movement selects/highlights item and toggles tooltip without voting", () => {
        let confirmedItem = null;
        setupDrag(avgDot, userDot, { id: "tool_01", name: "Denoising", x: 50, y: 50 }, container, {
            showConfirmVoteModalFn: (item) => {
                confirmedItem = item;
            },
        });

        // Click / tap without significant movement (2px movement)
        avgDot.dispatchEvent(new MouseEvent("mousedown", { clientX: 250, clientY: 250, bubbles: true }));
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 252, clientY: 251, bubbles: true }));
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

        // Must NOT trigger vote confirmation
        expect(confirmedItem).toBeNull();
        expect(state.isDragging).toBeNull();

        // Must select/highlight the item and activate tooltip
        expect(state.highlightedId).toBe("tool_01");
        expect(avgDot.classList.contains("tooltip-active")).toBe(true);
    });

    it("in mobile graph experience, tapping dot highlights item and scrolls panel without activating detailed .tooltip", () => {
        // Mock mobile touch environment
        window.matchMedia = (query) => ({
            matches: query.includes("hover: none") || query.includes("pointer: coarse"),
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        });
        window.innerWidth = 390;
        window.innerHeight = 844;

        setupDrag(avgDot, userDot, { id: "tool_01", name: "Denoising", x: 50, y: 50 }, container);

        // Tap on mobile
        avgDot.dispatchEvent(new MouseEvent("mousedown", { clientX: 200, clientY: 200, bubbles: true }));
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

        // Must highlight item (showing small mobile label)
        expect(state.highlightedId).toBe("tool_01");
        // Must NOT activate detailed tooltip on mobile
        expect(avgDot.classList.contains("tooltip-active")).toBe(false);
    });
});
