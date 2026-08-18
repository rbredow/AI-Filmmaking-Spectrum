// Centralized application state store

export const state = {
    // Launch & session info
    appLaunchTime: typeof window !== "undefined" ? Date.now() : 0,
    currentUser: null,
    isAdmin: false,
    isStaticMode: false,
    isLocalPreviewMode: false,
    staticSnapshot: null,
    baselineSnapshot: null,

    // Feature toggles
    votingEnabled: true,
    addingEnabled: true,

    // Graph & View Mode
    viewMode: "2D", // "2D" or "1D"
    itemsCache: {},
    previousData: {},
    latestLiveVotes: null,
    renderedItems: new Set(),
    selectedTags: new Set(),
    searchQuery: "",
    highlightedId: null,

    // Interactions
    isDragging: null,
    isConfirmingVote: false,
    pendingVoteConfirmation: null,

    // Mobile View & Zoom
    mobileGraphView: { scale: 1, offsetX: 0, offsetY: 0 },
    mobileFanItemIds: [],
    mobileFocusedClusterIds: [],
    mobileGraphReturnView: null,

    // Timeline Scrubber & Playback
    isTimelineOpen: false,
    isTimelinePlaying: false,
    timelineAnimationId: null,
    timelineMinTime: 0,
    timelineMaxTime: 0,
    currentTimelineTimestamp: 0,
    visibleItemIdsAtCurrentTime: new Set(),

    // Onboarding
    isOnboardingActive: false,
    onboardingStep: 0,

    // User metadata
    userDisplayName: "",
    hasConfirmedName: false,
};

const listeners = new Set();

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function notify(changeKey, value) {
    listeners.forEach((fn) => {
        try {
            fn(changeKey, value, state);
        } catch (e) {
            console.error("State listener error:", e);
        }
    });
}

export function setState(updates) {
    Object.assign(state, updates);
    Object.keys(updates).forEach((k) => notify(k, updates[k]));
}
