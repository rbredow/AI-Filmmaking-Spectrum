import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupVoteConfirmModal, showConfirmVoteModal } from "../../src/ui/modals.js";
import { state, setState } from "../../src/state/app-state.js";

describe("modals vote confirmation & cancellation contracts", () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="confirm-vote-modal" style="display: none;">
                <div id="confirm-vote-title"></div>
                <div id="confirm-vote-stats"></div>
                <div id="confirm-vote-username-section" style="display: none;">
                    <input id="confirm-vote-username-input" type="text" />
                </div>
                <button id="vote-cancel-btn">Cancel</button>
                <button id="vote-submit-btn">Vote</button>
            </div>
            <div id="graph-container">
                <div id="dot-tool_01" class="dot" data-real-x="50" data-real-y="50"></div>
                <div id="user-dot-tool_01" class="user-dot" style="display: none;"></div>
            </div>
        `;
        setState({
            userDisplayName: "TestArtist",
            hasConfirmedName: false,
            isConfirmingVote: false,
            pendingVoteConfirmation: null,
            isStaticMode: false,
            isLocalPreviewMode: false,
            currentUser: { uid: "test_user" },
            previousData: {},
        });
        localStorage.clear();
    });

    it("showConfirmVoteModal populates stats and displays username section for new users", () => {
        showConfirmVoteModal({ id: "tool_01", name: "Sora Video" }, 85, 25);

        const modal = document.getElementById("confirm-vote-modal");
        const title = document.getElementById("confirm-vote-title");
        const nameSection = document.getElementById("confirm-vote-username-section");
        const nameInput = document.getElementById("confirm-vote-username-input");

        expect(modal.style.display).toBe("flex");
        expect(title.textContent).toContain("Sora Video");
        expect(nameSection.style.display).toBe("block");
        expect(nameInput.value).toBe("TestArtist");
    });

    it("cancelling confirmation modal resets isConfirmingVote state and dismisses modal", () => {
        setupVoteConfirmModal();

        setState({
            isConfirmingVote: true,
            pendingVoteConfirmation: {
                itemId: "tool_01",
                vote: { x: 85, y: 25, username: "TestArtist" },
            },
        });
        const modal = document.getElementById("confirm-vote-modal");
        modal.style.display = "flex";
        modal.dataset.itemId = "tool_01";

        const cancelBtn = document.getElementById("vote-cancel-btn");
        cancelBtn.dispatchEvent(new MouseEvent("click"));

        expect(state.isConfirmingVote).toBe(false);
        expect(state.pendingVoteConfirmation).toBeNull();
        expect(modal.style.display).toBe("none");
    });
});
