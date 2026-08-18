// Main application bootstrap and coordination
import { state, setState } from "./state/app-state.js";
import { initialItems, ADMIN_EMAIL } from "./config/constants.js";
import { computeConsensus } from "./core/consensus.js";
import {
    fetchBootConfig,
    subscribeData,
    saveItem,
    deleteItem,
    LOCAL_PREVIEW_UID,
} from "./services/data-service.js";
import { initAuth, ensureDisplayName } from "./services/auth-service.js";
import { showToast } from "./ui/toast.js";
import { highlightItem, clearHighlight } from "./ui/highlight.js";
import {
    createItemElements,
    updateItemMetadata,
    removeItemElements,
    updateGraphFromData,
    triggerMegaSplash,
    positionElementForCurrentView,
} from "./ui/graph-renderer.js";
import { renderToolPanel, setupFilterControls } from "./ui/tool-panel.js";
import { setupDrag, closeAllTooltips } from "./ui/drag-controller.js";
import {
    isMobileGraphExperience,
    setupMobileGraphInteractions,
    resetMobileGraphView,
    clearMobileFan,
    selectMobileItem,
    scheduleMobileLabelClamp,
} from "./ui/mobile-gestures.js";
import {
    showUsernamePrompt,
    setupNewItemModal,
    setupEditModalLogic,
    openEditItemModal,
    setupResetModalLogic,
    openResetVotesModal,
    setupGlobalResetLogic,
    setupVoteConfirmModal,
    showConfirmVoteModal,
    setupDisclaimerModal,
} from "./ui/modals.js";
import {
    buildTimelineData,
    setupTimelineControls,
    isAtLiveTimestamp,
} from "./ui/timeline-ui.js";
import {
    startOnboarding,
    setupOnboardingEventListeners,
} from "./ui/onboarding.js";

let hasLoadedInitialVotes = false;

function updateAdminUI() {
    const resetBtn = document.getElementById("global-reset-btn");
    if (resetBtn) resetBtn.style.display = state.isAdmin ? "block" : "none";
}

function initApp() {
    const container = document.getElementById("graph-container");
    if (!container) return;

    let svgLayer = document.getElementById("connections-layer");
    if (!svgLayer) {
        svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgLayer.id = "connections-layer";
        svgLayer.setAttribute("viewBox", "0 0 100 100");
        svgLayer.setAttribute("preserveAspectRatio", "none");
        container.appendChild(svgLayer);
    }

    setupMobileGraphInteractions(container);
    setupFilterControls({ clearMobileFanFn: clearMobileFan });
    setupTimelineControls();
    setupOnboardingEventListeners();

    // 1D vs 2D View Mode Toggle Button
    const viewModeBtn = document.getElementById("view-mode-btn");
    if (viewModeBtn) {
        viewModeBtn.onclick = () => {
            const nextMode = state.viewMode === "2D" ? "1D" : "2D";
            setState({ viewMode: nextMode });
            viewModeBtn.innerText = nextMode;
            container.classList.toggle("mode-1d", nextMode === "1D");

            // Transition dots and user dots
            container.querySelectorAll(".dot, .user-dot, .voter-dot").forEach((el) => {
                const x = parseFloat(el.dataset.realX);
                const y = parseFloat(el.dataset.realY);
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    positionElementForCurrentView(el, x, y, container);
                }
            });

            // Re-render graph lines
            updateGraphFromData(state.latestLiveVotes || state.previousData || {}, container);
        };
    }

    // Modal setups
    setupNewItemModal({
        onSaveNewItem: async (newItem, initialVote) => {
            await saveItem(newItem);
        },
    });

    setupEditModalLogic();
    setupResetModalLogic();
    setupGlobalResetLogic({ computeConsensusFn: computeConsensus });
    setupVoteConfirmModal();

    // Username display click
    const userDisplay = document.getElementById("user-display");
    if (userDisplay) userDisplay.onclick = () => showUsernamePrompt();

    // Disclaimer & Onboarding entry
    setupDisclaimerModal({
        onComplete: () => {
            if (typeof localStorage !== "undefined" && !localStorage.getItem("onboarding_seen")) {
                startOnboarding();
            }
        },
    });

    // Global touch/click listeners
    setupGlobalEventHandlers();

    // Data binders
    function applyItems(itemsData) {
        state.itemsCache = itemsData || {};
        if (!itemsData) {
            if (state.isStaticMode) return;
            // Live empty DB seed if needed
        } else {
            Object.values(itemsData).forEach((item) => {
                if (!state.renderedItems.has(item.id)) {
                    createItemElements(container, item, {
                        onEditItem: openEditItemModal,
                        onResetVotes: openResetVotesModal,
                        onDeleteItem: deleteItem,
                    });
                    state.renderedItems.add(item.id);

                    const avgDot = document.getElementById(`dot-${item.id}`);
                    const userDot = document.getElementById(`user-dot-${item.id}`);
                    if (avgDot && userDot) {
                        setupDrag(avgDot, userDot, item, container, {
                            resetMobileGraphViewFn: resetMobileGraphView,
                            showConfirmVoteModalFn: showConfirmVoteModal,
                        });
                    }

                    if (state.renderedItems.size > initialItems.length + 1) {
                        triggerMegaSplash(container, item.x, item.y);
                    }
                } else {
                    updateItemMetadata(item);
                }
            });

            state.renderedItems.forEach((renderedId) => {
                if (!itemsData[renderedId]) {
                    removeItemElements(renderedId);
                    state.renderedItems.delete(renderedId);
                }
            });
        }

        renderToolPanel({
            onSelectItem: (id) => {
                if (isMobileGraphExperience()) {
                    selectMobileItem(id);
                } else {
                    clearMobileFan();
                    highlightItem(id);
                }
            },
            clearMobileFanFn: clearMobileFan,
        });

        if (state.isTimelineOpen) {
            buildTimelineData();
        }
    }

    function applyVotes(data) {
        state.latestLiveVotes = data;
        if (state.isTimelineOpen) {
            buildTimelineData();
            if (isAtLiveTimestamp()) {
                updateGraphFromData(data || {}, container, hasLoadedInitialVotes);
            }
            hasLoadedInitialVotes = true;
            return;
        }
        updateGraphFromData(data || {}, container, hasLoadedInitialVotes);
        hasLoadedInitialVotes = true;
    }

    function applySettings(settings) {
        const s = settings || { votingEnabled: true, addingEnabled: true };
        setState({
            votingEnabled: state.isLocalPreviewMode || s.votingEnabled,
            addingEnabled: state.isStaticMode ? false : !!s.addingEnabled,
        });

        const toggleVoting = document.getElementById("toggle-voting");
        const toggleAdding = document.getElementById("toggle-adding");
        if (toggleVoting) toggleVoting.checked = state.votingEnabled;
        if (toggleAdding) toggleAdding.checked = state.addingEnabled;

        const addBtn = document.getElementById("add-item-btn");
        if (addBtn) {
            addBtn.style.opacity = state.addingEnabled ? "1" : "0.3";
            addBtn.style.cursor = state.addingEnabled ? "pointer" : "not-allowed";
        }

        state.renderedItems.forEach((id) => {
            const editBtn = document.getElementById(`edit-btn-${id}`);
            if (editBtn) {
                editBtn.style.display = (state.addingEnabled || state.isAdmin) ? "block" : "none";
            }
        });
    }

    subscribeData({ applyItems, applyVotes, applySettings });
}

function setupGlobalEventHandlers() {
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".dot") && !e.target.closest(".tooltip")) {
            closeAllTooltips();
        }
        if (!e.target.closest(".dot") && !e.target.closest(".tooltip") && !e.target.closest(".panel-row")) {
            clearHighlight();
        }
    });

    document.addEventListener(
        "touchmove",
        (e) => {
            if (state.isDragging) {
                e.preventDefault();
            }
        },
        { passive: false },
    );

    window.addEventListener("orientationchange", () => {
        clearMobileFan();
        setTimeout(() => {
            resetMobileGraphView(document.getElementById("graph-container"), false);
            closeAllTooltips();
        }, 100);
    });

    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            clearMobileFan();
            resetMobileGraphView(document.getElementById("graph-container"), false);
            closeAllTooltips();
        }, 250);
    });

    // Mobile settings menu popup
    const settingsToggle = document.getElementById("settings-toggle");
    if (settingsToggle) {
        settingsToggle.onclick = (e) => {
            e.stopPropagation();
            const header = document.getElementById("header");
            if (header) header.classList.toggle("settings-open");
        };
    }

    document.addEventListener("click", (e) => {
        const header = document.getElementById("header");
        if (!header || !header.classList.contains("settings-open")) return;
        if (e.target.closest("#settings-toggle")) return;
        const inMenu = e.target.closest("#header-meta");
        const isAction = e.target.closest("a") || e.target.closest("button") || e.target.closest("#user-display");
        if (inMenu && !isAction) return;
        header.classList.remove("settings-open");
    });
}

function startLive() {
    initAuth({
        onUserReady: (user, isAdmin) => {
            updateAdminUI();
            initApp();
            setTimeout(() => {
                document.body.classList.remove("initial-load");
            }, 2000);
        },
    });
}

function startStatic(snapshot, enablePreview = false) {
    setState({
        isStaticMode: true,
        isLocalPreviewMode: enablePreview,
        staticSnapshot: snapshot,
        baselineSnapshot: snapshot,
        isAdmin: false,
        currentUser: enablePreview ? { uid: LOCAL_PREVIEW_UID } : null,
        votingEnabled: enablePreview || !!(snapshot?.settings && snapshot.settings.votingEnabled),
        addingEnabled: false,
    });
    updateAdminUI();
    ensureDisplayName();
    initApp();
    if (enablePreview) {
        setTimeout(() => showToast("Local preview — nothing is published"), 250);
    }
    setTimeout(() => {
        document.body.classList.remove("initial-load");
    }, 2000);
}

export async function boot() {
    const params = new URLSearchParams(window.location.search);
    const forceLive = params.has("live");
    const forcePreview = params.has("preview");

    const { snapshot, liveSettings } = await fetchBootConfig();
    state.baselineSnapshot = snapshot;

    const votingOpen =
        liveSettings != null
            ? liveSettings.votingEnabled === true
            : !!(snapshot && snapshot.settings && snapshot.settings.votingEnabled);

    if (forcePreview) {
        if (!snapshot) {
            console.error("Local preview requires data/snapshot.json.");
            showToast("Preview unavailable — snapshot missing");
            return;
        }
        startStatic(snapshot, true);
        return;
    }

    if (forceLive || votingOpen || !snapshot) {
        startLive();
    } else {
        startStatic(snapshot);
    }
}

if (typeof window !== "undefined") {
    boot();
}
