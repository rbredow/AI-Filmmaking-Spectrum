// Modal controllers: New Tool, Edit Tool, Reset Votes, Admin Controls, Username Prompt, and Vote Confirmation
import { state, setState } from "../state/app-state.js";
import { ACADEMY_BRANCHES, initialItems } from "../config/constants.js";
import { formatAxisPosition } from "../core/formatters.js";
import { showToast } from "./toast.js";
import {
    allowProductionMutation,
    saveVote,
    deleteItem,
    resetItemVotes,
    globalBakeConsensus,
    globalClearVotes,
    globalNuke,
    migrateDefaultTags,
    updateSettings,
} from "../services/data-service.js";
import { setUsername, loginAdmin, updateUsernameUI } from "../services/auth-service.js";
import { updateGraphFromData } from "./graph-renderer.js";

export function showUsernamePrompt() {
    const modal = document.getElementById("username-modal");
    const input = document.getElementById("username-input");
    const submitBtn = document.getElementById("username-submit-btn");

    if (modal && input && submitBtn) {
        modal.style.display = "flex";
        input.value = state.userDisplayName;
        input.focus();
        input.select();

        submitBtn.onclick = async () => {
            const val = input.value.trim();
            if (val) {
                await setUsername(val);
                modal.style.display = "none";
            }
        };

        input.onkeydown = (e) => {
            if (e.key === "Enter") submitBtn.click();
        };

        const adminTrigger = document.getElementById("admin-login-trigger");
        if (adminTrigger) {
            adminTrigger.onclick = async () => {
                try {
                    await loginAdmin();
                    modal.style.display = "none";
                    showToast("Logged in successfully. Reloading...");
                    setTimeout(() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set("live", "1");
                        window.location.href = url.toString();
                    }, 800);
                } catch (error) {
                    console.error("Login Failed:", error);
                    alert("Login Failed: " + error.message);
                }
            };
        }
    }
}

export function setupNewItemModal({ onSaveNewItem = null } = {}) {
    const modal = document.getElementById("new-item-modal");
    const addBtn = document.getElementById("add-item-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const submitBtn = document.getElementById("submit-btn");
    const sliderX = document.getElementById("new-item-x");
    const sliderY = document.getElementById("new-item-y");
    const valX = document.getElementById("slider-x-val");
    const valY = document.getElementById("slider-y-val");

    if (addBtn) {
        addBtn.onclick = () => {
            if (!allowProductionMutation()) return;
            if (!state.addingEnabled && !state.isAdmin) {
                showToast("Adding Closed");
                return;
            }

            const branchList = document.getElementById("new-item-branches");
            if (branchList) {
                branchList.innerHTML = ACADEMY_BRANCHES.map((branch) => `
                    <label class="branch-checkbox-item">
                        <input type="checkbox" value="${branch}">
                        ${branch}
                    </label>
                `).join("");
            }

            modal.style.display = "flex";
            const nameInput = document.getElementById("new-item-name");
            if (nameInput) nameInput.focus();
        };
    }

    if (cancelBtn) cancelBtn.onclick = () => (modal.style.display = "none");
    if (sliderX && valX) sliderX.oninput = () => (valX.innerText = sliderX.value);
    if (sliderY && valY) sliderY.oninput = () => (valY.innerText = sliderY.value);

    if (submitBtn) {
        submitBtn.onclick = async () => {
            if (!allowProductionMutation()) {
                modal.style.display = "none";
                return;
            }
            const nameInput = document.getElementById("new-item-name");
            const descInput = document.getElementById("new-item-desc");
            const name = nameInput ? nameInput.value.trim() : "";
            const desc = descInput ? descInput.value.trim() : "";
            const x = parseInt(sliderX?.value || 50, 10);
            const y = parseInt(sliderY?.value || 50, 10);

            if (!name) return alert("Please enter a name.");
            if (!state.addingEnabled && !state.isAdmin) {
                showToast("Adding Closed");
                modal.style.display = "none";
                return;
            }

            const selectedBranchInputs = document.querySelectorAll("#new-item-branches input:checked");
            const tags = Array.from(selectedBranchInputs).map((cb) => cb.value);
            const newId = "user_item_" + Date.now();
            const newItem = {
                id: newId,
                name,
                desc,
                x,
                y,
                createdBy: state.currentUser?.uid || "anon",
                tags,
            };

            if (onSaveNewItem) {
                await onSaveNewItem(newItem, { x, y, username: state.userDisplayName });
            }

            modal.style.display = "none";
            if (nameInput) nameInput.value = "";
            if (descInput) descInput.value = "";
        };
    }
}

export function openEditItemModal(id) {
    if (!allowProductionMutation()) return;
    const modal = document.getElementById("edit-item-modal");
    const name = document.querySelector(`#label-${id} .dot-label-name`)?.innerText || "";
    const descEl = document.getElementById(`desc-${id}`);
    const desc = descEl ? descEl.innerText : "";
    const item = state.itemsCache[id];

    const idInput = document.getElementById("edit-item-id");
    const nameInput = document.getElementById("edit-item-name");
    const descInput = document.getElementById("edit-item-desc");
    const branchList = document.getElementById("edit-item-branches");

    if (idInput) idInput.value = id;
    if (nameInput) nameInput.value = name;
    if (descInput) descInput.value = desc;

    if (branchList) {
        branchList.innerHTML = ACADEMY_BRANCHES.map((branch) => {
            const isChecked = item && item.tags && item.tags.includes(branch) ? "checked" : "";
            return `<label class="branch-checkbox-item">
                <input type="checkbox" value="${branch}" ${isChecked}>
                ${branch}
            </label>`;
        }).join("");
    }

    if (modal) modal.style.display = "flex";
}

export function setupEditModalLogic({ onSaveEditItem = null } = {}) {
    const modal = document.getElementById("edit-item-modal");
    const cancelBtn = document.getElementById("edit-cancel-btn");
    const submitBtn = document.getElementById("edit-submit-btn");

    if (cancelBtn) cancelBtn.onclick = () => (modal.style.display = "none");
    if (submitBtn) {
        submitBtn.onclick = async () => {
            if (!allowProductionMutation()) {
                modal.style.display = "none";
                return;
            }
            const id = document.getElementById("edit-item-id")?.value;
            const name = document.getElementById("edit-item-name")?.value.trim();
            const desc = document.getElementById("edit-item-desc")?.value.trim();
            const selectedBranchInputs = document.querySelectorAll("#edit-item-branches input:checked");
            const tags = Array.from(selectedBranchInputs).map((cb) => cb.value);

            if (id && name) {
                const payload = { name, desc, tags: tags.length > 0 ? tags : null };
                if (onSaveEditItem) {
                    await onSaveEditItem(id, payload);
                }
                modal.style.display = "none";
            }
        };
    }
}

export function openResetVotesModal(id) {
    if (!allowProductionMutation()) return;
    const modal = document.getElementById("reset-options-modal");
    const input = document.getElementById("reset-item-id");
    if (input) input.value = id;
    if (modal) modal.style.display = "flex";
}

export function setupResetModalLogic() {
    const modal = document.getElementById("reset-options-modal");
    const btnBake = document.getElementById("btn-bake");
    const btnClear = document.getElementById("btn-clear");
    const btnCancel = document.getElementById("reset-cancel-btn");

    if (btnCancel) btnCancel.onclick = () => (modal.style.display = "none");

    if (btnBake) {
        btnBake.onclick = async () => {
            if (!allowProductionMutation()) {
                modal.style.display = "none";
                return;
            }
            const id = document.getElementById("reset-item-id")?.value;
            const dot = document.getElementById(`dot-${id}`);
            if (id && dot) {
                const currentX = parseFloat(dot.dataset.realX);
                const currentY = parseFloat(dot.dataset.realY);
                await resetItemVotes(id, "bake", { x: currentX, y: currentY });
                modal.style.display = "none";
            }
        };
    }

    if (btnClear) {
        btnClear.onclick = async () => {
            if (!allowProductionMutation()) {
                modal.style.display = "none";
                return;
            }
            const id = document.getElementById("reset-item-id")?.value;
            if (id) {
                await resetItemVotes(id, "clear");
                modal.style.display = "none";
            }
        };
    }
}

export function setupGlobalResetLogic({ computeConsensusFn = null } = {}) {
    const modal = document.getElementById("global-reset-modal");
    const btnOpen = document.getElementById("global-reset-btn");
    const btnBake = document.getElementById("btn-global-bake");
    const btnClearVotes = document.getElementById("btn-global-clear-votes");
    const btnNuke = document.getElementById("btn-global-nuke");
    const btnCancel = document.getElementById("global-cancel-btn");
    const btnMigrate = document.getElementById("btn-migrate-tags");

    if (btnOpen) btnOpen.onclick = () => (modal.style.display = "flex");
    if (btnCancel) btnCancel.onclick = () => (modal.style.display = "none");

    if (btnMigrate) {
        btnMigrate.onclick = async () => {
            if (!allowProductionMutation()) return;
            if (confirm("Apply default tags to all existing items?")) {
                await migrateDefaultTags(state.itemsCache);
                modal.style.display = "none";
            }
        };
    }

    const toggleVoting = document.getElementById("toggle-voting");
    const toggleAdding = document.getElementById("toggle-adding");

    if (toggleVoting) {
        toggleVoting.onchange = async () => {
            if (!allowProductionMutation()) {
                toggleVoting.checked = state.votingEnabled;
                return;
            }
            await updateSettings({ votingEnabled: toggleVoting.checked });
        };
    }

    if (toggleAdding) {
        toggleAdding.onchange = async () => {
            if (!allowProductionMutation()) {
                toggleAdding.checked = state.addingEnabled;
                return;
            }
            await updateSettings({ addingEnabled: toggleAdding.checked });
        };
    }

    if (btnNuke) {
        btnNuke.onclick = async () => {
            if (!allowProductionMutation()) return;
            if (confirm("FINAL WARNING: This will delete ALL user created tools and revert to the original items.")) {
                await globalNuke();
                modal.style.display = "none";
                window.location.reload();
            }
        };
    }

    if (btnClearVotes) {
        btnClearVotes.onclick = async () => {
            if (!allowProductionMutation()) return;
            if (confirm("Clear all votes? Items will snap back to their default positions.")) {
                await globalClearVotes();
                modal.style.display = "none";
            }
        };
    }

    if (btnBake) {
        btnBake.onclick = async () => {
            if (!allowProductionMutation()) return;
            if (confirm("Update all item defaults to their current positions and clear votes?")) {
                if (computeConsensusFn) {
                    await globalBakeConsensus(state.itemsCache, computeConsensusFn);
                }
                modal.style.display = "none";
            }
        };
    }
}

export function setupVoteConfirmModal() {
    const modal = document.getElementById("confirm-vote-modal");
    const cancelBtn = document.getElementById("vote-cancel-btn");
    const submitBtn = document.getElementById("vote-submit-btn");
    const nameInput = document.getElementById("confirm-vote-username-input");
    const nameSection = document.getElementById("confirm-vote-username-section");

    if (!modal || !cancelBtn || !submitBtn) return;

    cancelBtn.onclick = () => {
        const pendingItemId = state.pendingVoteConfirmation?.itemId;
        setState({
            isConfirmingVote: false,
            pendingVoteConfirmation: null,
        });
        modal.style.display = "none";
        delete modal.dataset.itemId;

        if (pendingItemId) {
            updateGraphFromData(state.previousData, document.getElementById("graph-container"));
        }
    };

    submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        cancelBtn.disabled = true;
        try {
            const pending = state.pendingVoteConfirmation;
            if (!pending || pending.itemId !== modal.dataset.itemId) {
                throw new Error("No vote is awaiting confirmation.");
            }

            let confirmedName = state.userDisplayName;

            if (nameSection && nameSection.style.display !== "none") {
                const val = nameInput ? nameInput.value.trim() : "";
                if (!val) {
                    alert("Please enter a username.");
                    return;
                }
                confirmedName = val;
            }

            await saveVote(pending.itemId, {
                ...pending.vote,
                username: confirmedName,
            });

            if (nameSection && nameSection.style.display !== "none") {
                await setUsername(confirmedName);
            }

            setState({
                isConfirmingVote: false,
                pendingVoteConfirmation: null,
            });
            modal.style.display = "none";
            delete modal.dataset.itemId;
            updateGraphFromData(state.previousData, document.getElementById("graph-container"));
            showToast(state.isLocalPreviewMode ? "✓ Preview updated — not published" : "✓ Vote recorded");
        } catch (error) {
            console.error("Could not confirm vote", error);
            showToast("Couldn’t confirm vote — try again");
        } finally {
            submitBtn.disabled = false;
            cancelBtn.disabled = false;
        }
    };
}

export function showConfirmVoteModal(item, x, y) {
    const modal = document.getElementById("confirm-vote-modal");
    const title = document.getElementById("confirm-vote-title");
    const stats = document.getElementById("confirm-vote-stats");
    const nameSection = document.getElementById("confirm-vote-username-section");
    const nameInput = document.getElementById("confirm-vote-username-input");

    if (!modal || !title || !stats) return;

    modal.dataset.itemId = item.id;
    title.innerText = `Vote for ${item.name}`;
    stats.innerHTML = `
        <div style="margin-top:10px;">
            <strong>${formatAxisPosition(x, "Utility", "Generative")}</strong><br>
            <strong>${formatAxisPosition(y, "Not Ready", "Ready")}</strong>
        </div>
    `;

    if (!state.hasConfirmedName && nameSection) {
        nameSection.style.display = "block";
        if (nameInput) nameInput.value = state.userDisplayName;
    } else if (nameSection) {
        nameSection.style.display = "none";
    }

    modal.style.display = "flex";
    if (!state.hasConfirmedName && nameSection?.style.display !== "none" && nameInput) {
        setTimeout(() => nameInput.focus(), 100);
    }
}

export function setupDisclaimerModal({ onComplete = null } = {}) {
    const modal = document.getElementById("disclaimer-modal");
    const btn = document.getElementById("disclaimer-btn");
    if (!modal || !btn) return;

    btn.onclick = () => {
        modal.style.display = "none";
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("disclaimer_accepted", "true");
        }
        if (onComplete) onComplete();
    };

    if (typeof localStorage !== "undefined" && !localStorage.getItem("disclaimer_accepted")) {
        modal.style.display = "flex";
    }
}
