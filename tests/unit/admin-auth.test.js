import { describe, it, expect, beforeEach } from "vitest";
import { state, setState } from "../../src/state/app-state.js";
import { ADMIN_EMAIL } from "../../src/config/constants.js";
import { createItemElements } from "../../src/ui/graph-renderer.js";
import { setupNewItemModal } from "../../src/ui/modals.js";
import { setupDrag } from "../../src/ui/drag-controller.js";

describe("admin authentication & authorization permissions", () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="header">
                <div id="global-reset-btn" style="display: none;">Reset Database</div>
                <div id="add-item-btn">+ New Tool</div>
            </div>
            <div id="graph-container" style="width: 500px; height: 500px;">
                <svg id="connections-layer"></svg>
            </div>
            <div id="toast-container"></div>
            <div id="new-item-modal" style="display: none;">
                <input id="new-item-name" type="text" />
                <input id="new-item-desc" type="text" />
                <input id="new-item-x" type="range" value="50" />
                <input id="new-item-y" type="range" value="50" />
                <div id="new-item-branches"></div>
                <button id="submit-btn">Add Tool</button>
                <button id="cancel-btn">Cancel</button>
            </div>
        `;
        container = document.getElementById("graph-container");
        Object.defineProperty(container, "clientWidth", { value: 500, configurable: true });
        Object.defineProperty(container, "clientHeight", { value: 500, configurable: true });

        setState({
            currentUser: { uid: "anon_123", email: null },
            isAdmin: false,
            votingEnabled: true,
            addingEnabled: true,
            isDragging: null,
            isConfirmingVote: false,
            pendingVoteConfirmation: null,
            isStaticMode: false,
            isLocalPreviewMode: false,
            renderedItems: new Set(),
            itemsCache: {},
        });
    });

    describe("Admin identity verification", () => {
        it("identifies matching ADMIN_EMAIL as admin", () => {
            const adminUser = { uid: "admin_uid", email: ADMIN_EMAIL };
            const isAdmin = adminUser.email === ADMIN_EMAIL;
            expect(isAdmin).toBe(true);
            expect(ADMIN_EMAIL).toBe("rob.bredow@gmail.com");
        });

        it("denies admin privileges to anonymous or different email users", () => {
            const voterUser = { uid: "anon_uid", email: null };
            const otherUser = { uid: "other_uid", email: "visitor@example.com" };

            expect(voterUser.email === ADMIN_EMAIL).toBe(false);
            expect(otherUser.email === ADMIN_EMAIL).toBe(false);
        });
    });

    describe("Admin UI elements rendering", () => {
        it("renders Reset Votes and Delete buttons in tooltip for admin users", () => {
            setState({ isAdmin: true, addingEnabled: true });
            createItemElements(container, { id: "item_01", name: "Gen-3", desc: "Video", x: 50, y: 50 });

            const tooltip = document.getElementById("tooltip-item_01");
            expect(tooltip.querySelector("#reset-btn-item_01")).not.toBeNull();
            expect(tooltip.querySelector("#delete-btn-item_01")).not.toBeNull();
            expect(tooltip.querySelector("#edit-btn-item_01")).not.toBeNull();
        });

        it("omits Reset Votes and Delete buttons from tooltip for non-admin voters", () => {
            setState({ isAdmin: false, addingEnabled: true });
            createItemElements(container, { id: "item_01", name: "Gen-3", desc: "Video", x: 50, y: 50 });

            const tooltip = document.getElementById("tooltip-item_01");
            expect(tooltip.querySelector("#reset-btn-item_01")).toBeNull();
            expect(tooltip.querySelector("#delete-btn-item_01")).toBeNull();
            expect(tooltip.querySelector("#edit-btn-item_01")).not.toBeNull();
        });
    });

    describe("Admin session overrides when voting/adding are closed", () => {
        it("allows admin to drag-to-vote even when votingEnabled is false", () => {
            setState({ isAdmin: true, votingEnabled: false, currentUser: { uid: "admin_uid" } });
            createItemElements(container, { id: "item_01", name: "Gen-3", desc: "Video", x: 50, y: 50 });

            const avgDot = document.getElementById("dot-item_01");
            const userDot = document.getElementById("user-dot-item_01");

            setupDrag(avgDot, userDot, { id: "item_01", x: 50, y: 50 }, container);

            avgDot.dispatchEvent(new MouseEvent("mousedown", { clientX: 250, clientY: 250, bubbles: true }));
            document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 300, bubbles: true }));
            expect(state.isDragging).toBe("item_01");
            document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        });

        it("blocks non-admin voter from dragging when votingEnabled is false", () => {
            setState({ isAdmin: false, votingEnabled: false, currentUser: { uid: "voter_uid" } });
            createItemElements(container, { id: "item_02", name: "Gen-3", desc: "Video", x: 50, y: 50 });

            const avgDot = document.getElementById("dot-item_02");
            const userDot = document.getElementById("user-dot-item_02");

            setupDrag(avgDot, userDot, { id: "item_02", x: 50, y: 50 }, container);

            avgDot.dispatchEvent(new MouseEvent("mousedown", { clientX: 250, clientY: 250, bubbles: true }));
            expect(state.isDragging).toBeNull();

            const toast = document.querySelector(".toast");
            expect(toast).not.toBeNull();
            expect(toast.textContent).toContain("Voting Closed");
        });

        it("allows admin to open New Tool modal when addingEnabled is false", () => {
            setState({ isAdmin: true, addingEnabled: false });
            setupNewItemModal();

            const addBtn = document.getElementById("add-item-btn");
            const modal = document.getElementById("new-item-modal");

            addBtn.dispatchEvent(new MouseEvent("click"));
            expect(modal.style.display).toBe("flex");
        });

        it("blocks non-admin voter from opening New Tool modal when addingEnabled is false", () => {
            setState({ isAdmin: false, addingEnabled: false });
            setupNewItemModal();

            const addBtn = document.getElementById("add-item-btn");
            const modal = document.getElementById("new-item-modal");

            addBtn.dispatchEvent(new MouseEvent("click"));
            expect(modal.style.display).toBe("none");

            const toast = document.querySelector(".toast");
            expect(toast).not.toBeNull();
            expect(toast.textContent).toContain("Adding Closed");
        });
    });
});
