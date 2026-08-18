// Interactive 2-step onboarding guide, axis animations, sample preview cards, and cascade reveal
import { state, setState } from "../state/app-state.js";
import { isMobileGraphExperience } from "./mobile-gestures.js";

export const ONBOARD_TOOLS = [
    {
        id: "d_sound",
        name: "Denoising Sound",
        badge: "Utility",
        badgeClass: "badge-algorithmic",
        x: 6.6,
        y: 94.9,
    },
    {
        id: "char_inbetween",
        name: "Character In-Betweening",
        badge: "In-Between",
        badgeClass: "badge-middle",
        x: 62.6,
        y: 61.3,
    },
    {
        id: "idea_script",
        name: "Idea to Script",
        badge: "Generative",
        badgeClass: "badge-creative",
        x: 97.0,
        y: 10.8,
    },
];

let onboardingTimers = [];
let isStepAnimating = false;

export function positionOnboardingCard(card, tool, index, step) {
    if (!card) return;
    const usePhoneLayout = isMobileGraphExperience();
    const mobileX = [17, 50, 83][index];
    const mobileY = [82, 55, 20][index];
    const x = usePhoneLayout ? mobileX : tool.x;
    const y = step === 1 ? (usePhoneLayout ? 42 : 44) : (usePhoneLayout ? mobileY : tool.y);

    card.style.left = `${x}%`;
    card.style.bottom = `${y}%`;
    card.classList.remove("card-left", "card-right");
    if (!usePhoneLayout) {
        if (x < 15) card.classList.add("card-left");
        else if (x > 85) card.classList.add("card-right");
    }
}

export function clearOnboardingTimers() {
    onboardingTimers.forEach((t) => clearTimeout(t));
    onboardingTimers = [];
    isStepAnimating = false;
}

export function addOnboardingTimer(fn, delay) {
    const timer = setTimeout(fn, delay);
    onboardingTimers.push(timer);
    return timer;
}

export function fastForwardCurrentStep() {
    if (!isStepAnimating) return;
    clearOnboardingTimers();

    if (state.onboardingStep === 1) {
        const xLine = document.getElementById("onboard-x-spectrum-line");
        if (xLine) xLine.classList.add("visible");

        ONBOARD_TOOLS.forEach((tool, index) => {
            const card = document.getElementById(`onboard-card-${index + 1}`);
            if (card) {
                card.className = "onboard-sample-card visible";
                positionOnboardingCard(card, tool, index, 1);
            }
        });

        const sidebar = document.getElementById("onboard-sidebar-panel");
        if (sidebar) sidebar.classList.add("visible");
    } else if (state.onboardingStep === 2) {
        const yLine = document.getElementById("onboard-y-spectrum-line");
        if (yLine) yLine.classList.add("visible");

        ONBOARD_TOOLS.forEach((tool, index) => {
            const card = document.getElementById(`onboard-card-${index + 1}`);
            if (card) {
                card.className = "onboard-sample-card visible";
                positionOnboardingCard(card, tool, index, 2);
            }
        });

        const sidebar = document.getElementById("onboard-sidebar-panel");
        if (sidebar) sidebar.classList.add("visible");
    }
}

export function handleOnboardingAdvance() {
    if (isStepAnimating) {
        fastForwardCurrentStep();
    } else {
        if (state.onboardingStep === 1) renderOnboardingStep2();
        else if (state.onboardingStep === 2) completeOnboarding();
    }
}

export function startOnboarding(force = false) {
    clearOnboardingTimers();
    state.isOnboardingActive = true;
    state.onboardingStep = 1;

    const overlay = document.getElementById("onboarding-overlay");
    const container = document.getElementById("graph-container");
    const panel = document.getElementById("tool-panel-inner");
    const sidebar = document.getElementById("onboard-sidebar-panel");
    if (!overlay || !container) return;
    document.body.classList.add("onboarding-active");

    overlay.style.display = "block";
    overlay.style.opacity = "1";

    if (sidebar) {
        sidebar.style.display = "flex";
        sidebar.classList.remove("visible");
    }

    container.querySelectorAll(".dot").forEach((d) => {
        d.classList.add("onboarding-hidden");
        d.classList.remove("cascade-revealing");
    });
    if (panel) {
        panel.querySelectorAll(".panel-row").forEach((r) => {
            r.classList.add("onboarding-hidden");
            r.classList.remove("cascade-revealing");
        });
    }

    container.querySelectorAll(".axis-label").forEach((l) => (l.style.opacity = "0"));
    const controls = document.getElementById("top-right-controls");
    if (controls) controls.style.opacity = "0.2";

    renderOnboardingStep1();
}

export function renderOnboardingStep1() {
    clearOnboardingTimers();
    state.onboardingStep = 1;
    isStepAnimating = true;

    const overlay = document.getElementById("onboarding-overlay");
    const sidebar = document.getElementById("onboard-sidebar-panel");
    if (!overlay) return;

    const xLine = document.getElementById("onboard-x-spectrum-line");
    const yLine = document.getElementById("onboard-y-spectrum-line");
    if (xLine) xLine.classList.remove("visible");
    if (yLine) yLine.classList.remove("visible");

    const wordXLeft = document.getElementById("onboard-word-x-left");
    const wordXRight = document.getElementById("onboard-word-x-right");
    const wordYTop = document.getElementById("onboard-word-y-top");
    const wordYBottom = document.getElementById("onboard-word-y-bottom");

    if (wordXLeft) {
        wordXLeft.className = "onboard-hero-word x-left";
        wordXLeft.style.opacity = "1";
    }
    if (wordXRight) {
        wordXRight.className = "onboard-hero-word x-right";
        wordXRight.style.opacity = "1";
    }
    if (wordYTop) wordYTop.style.opacity = "0";
    if (wordYBottom) wordYBottom.style.opacity = "0";

    ONBOARD_TOOLS.forEach((tool, index) => {
        const card = document.getElementById(`onboard-card-${index + 1}`);
        if (card) {
            card.className = "onboard-sample-card";
            positionOnboardingCard(card, tool, index, 1);
        }
    });

    const indicator = document.getElementById("onboard-step-indicator");
    const title = document.getElementById("onboard-title");
    const body = document.getElementById("onboard-body");
    const caveat = document.getElementById("onboard-caveat");
    const nextBtn = document.getElementById("onboard-next-btn");

    if (indicator) indicator.innerText = "Step 1 of 2";
    if (title) title.innerText = "The Spectrum of Autonomy";
    if (body) body.innerText = "Tools range from algorithmic utility to open-ended creative generation.";
    if (caveat) caveat.innerText = "This is not designed to be a definitive document that describes all the tools available for filmmaking: there are certainly some that are missing.";
    if (nextBtn) nextBtn.innerText = "Next →";

    if (sidebar) {
        sidebar.style.display = "flex";
        sidebar.classList.remove("visible");
    }

    addOnboardingTimer(() => {
        if (xLine) xLine.classList.add("visible");
    }, 800);

    addOnboardingTimer(() => {
        const card1 = document.getElementById("onboard-card-1");
        if (card1) card1.classList.add("visible");
    }, 1800);

    addOnboardingTimer(() => {
        const card2 = document.getElementById("onboard-card-2");
        if (card2) card2.classList.add("visible");
    }, 2600);

    addOnboardingTimer(() => {
        const card3 = document.getElementById("onboard-card-3");
        if (card3) card3.classList.add("visible");
    }, 3400);

    addOnboardingTimer(() => {
        if (sidebar) sidebar.classList.add("visible");
        isStepAnimating = false;
    }, 4200);
}

export function renderOnboardingStep2() {
    clearOnboardingTimers();
    state.onboardingStep = 2;
    isStepAnimating = true;

    const overlay = document.getElementById("onboarding-overlay");
    const sidebar = document.getElementById("onboard-sidebar-panel");
    if (!overlay) return;

    const wordXLeft = document.getElementById("onboard-word-x-left");
    const wordXRight = document.getElementById("onboard-word-x-right");
    const wordYTop = document.getElementById("onboard-word-y-top");
    const wordYBottom = document.getElementById("onboard-word-y-bottom");

    if (wordXLeft) wordXLeft.classList.add("flying-down");
    if (wordXRight) wordXRight.classList.add("flying-down");

    const xLine = document.getElementById("onboard-x-spectrum-line");
    if (xLine) xLine.classList.remove("visible");

    const container = document.getElementById("graph-container");
    if (container) {
        const xLeft = container.querySelector(".x-label-left");
        const xRight = container.querySelector(".x-label-right");
        if (xLeft) xLeft.style.opacity = "1";
        if (xRight) xRight.style.opacity = "1";
    }

    if (wordYTop) {
        wordYTop.className = "onboard-hero-word y-top";
        wordYTop.style.opacity = "1";
    }
    if (wordYBottom) {
        wordYBottom.className = "onboard-hero-word y-bottom";
        wordYBottom.style.opacity = "1";
    }

    if (sidebar) sidebar.classList.remove("visible");

    const indicator = document.getElementById("onboard-step-indicator");
    const title = document.getElementById("onboard-title");
    const body = document.getElementById("onboard-body");
    const caveat = document.getElementById("onboard-caveat");
    const nextBtn = document.getElementById("onboard-next-btn");

    if (indicator) indicator.innerText = "Step 2 of 2";
    if (title) title.innerText = "Production Readiness";
    if (body) body.innerText = "The vertical axis reflects whether a tool is currently reliable for production workflows or still experimental.";
    if (caveat) caveat.innerText = "The precise position of the tools on the graph is just the subjective opinion of those who have voted on the project so far.";
    if (nextBtn) nextBtn.innerText = "Explore Spectrum →";

    const yLine = document.getElementById("onboard-y-spectrum-line");
    addOnboardingTimer(() => {
        if (yLine) yLine.classList.add("visible");
    }, 800);

    addOnboardingTimer(() => {
        const card1 = document.getElementById("onboard-card-1");
        positionOnboardingCard(card1, ONBOARD_TOOLS[0], 0, 2);
    }, 1500);

    addOnboardingTimer(() => {
        const card2 = document.getElementById("onboard-card-2");
        positionOnboardingCard(card2, ONBOARD_TOOLS[1], 1, 2);
    }, 2200);

    addOnboardingTimer(() => {
        const card3 = document.getElementById("onboard-card-3");
        positionOnboardingCard(card3, ONBOARD_TOOLS[2], 2, 2);
    }, 2900);

    addOnboardingTimer(() => {
        if (sidebar) sidebar.classList.add("visible");
        isStepAnimating = false;
    }, 3800);
}

export function completeOnboarding() {
    if (!state.isOnboardingActive) return;
    clearOnboardingTimers();
    state.onboardingStep = 3;

    const overlay = document.getElementById("onboarding-overlay");
    const container = document.getElementById("graph-container");
    const sidebar = document.getElementById("onboard-sidebar-panel");

    const wordYTop = document.getElementById("onboard-word-y-top");
    const wordYBottom = document.getElementById("onboard-word-y-bottom");
    if (wordYTop) wordYTop.classList.add("flying-axis");
    if (wordYBottom) wordYBottom.classList.add("flying-axis");

    const yLine = document.getElementById("onboard-y-spectrum-line");
    if (yLine) yLine.classList.remove("visible");

    if (overlay) {
        overlay.querySelectorAll(".onboard-sample-card").forEach((c) => c.classList.remove("visible"));
    }
    if (sidebar) {
        sidebar.classList.remove("visible");
        setTimeout(() => {
            sidebar.style.display = "none";
        }, 500);
    }

    if (container) {
        container.querySelectorAll(".axis-label").forEach((l) => (l.style.opacity = "1"));
        const controls = document.getElementById("top-right-controls");
        if (controls) controls.style.opacity = "1";
    }

    setTimeout(() => {
        if (overlay) {
            overlay.style.opacity = "0";
            setTimeout(() => {
                overlay.style.display = "none";
                document.body.classList.remove("onboarding-active");
            }, 500);
        }
    }, 400);

    revealToolsInCascade();

    if (typeof localStorage !== "undefined") {
        localStorage.setItem("onboarding_seen", "true");
        localStorage.setItem("disclaimer_seen", "true");
    }
    state.isOnboardingActive = false;
}

export function skipOnboarding() {
    clearOnboardingTimers();
    document.body.classList.remove("onboarding-active");
    const overlay = document.getElementById("onboarding-overlay");
    const container = document.getElementById("graph-container");
    const panel = document.getElementById("tool-panel-inner");
    const sidebar = document.getElementById("onboard-sidebar-panel");

    if (overlay) {
        overlay.style.display = "none";
        overlay.style.opacity = "0";
    }
    if (sidebar) {
        sidebar.style.display = "none";
        sidebar.classList.remove("visible");
    }

    if (container) {
        container.querySelectorAll(".dot").forEach((d) => {
            d.classList.remove("onboarding-hidden");
            d.classList.remove("cascade-revealing");
        });
        container.querySelectorAll(".axis-label").forEach((l) => (l.style.opacity = "1"));
        const controls = document.getElementById("top-right-controls");
        if (controls) controls.style.opacity = "1";
    }

    if (panel) {
        panel.querySelectorAll(".panel-row").forEach((r) => {
            r.classList.remove("onboarding-hidden");
            r.classList.remove("cascade-revealing");
        });
    }

    if (typeof localStorage !== "undefined") {
        localStorage.setItem("onboarding_seen", "true");
        localStorage.setItem("disclaimer_seen", "true");
    }
    state.isOnboardingActive = false;
}

export function revealToolsInCascade() {
    const container = document.getElementById("graph-container");
    const panel = document.getElementById("tool-panel-inner");
    if (!container) return;

    const dots = Array.from(container.querySelectorAll(".dot"));
    if (dots.length === 0) return;

    const scoredDots = dots.map((dot) => {
        const x = dot.dataset.realX != null ? parseFloat(dot.dataset.realX) : 50;
        const y = dot.dataset.realY != null ? parseFloat(dot.dataset.realY) : 50;
        const score = (100 - y) + x;
        const itemId = dot.id.replace("dot-", "");
        return { dot, itemId, score };
    });

    scoredDots.sort((a, b) => a.score - b.score);

    const totalDuration = 1400;
    const stepDuration = totalDuration / Math.max(1, scoredDots.length - 1);

    scoredDots.forEach((item, index) => {
        const delay = index * stepDuration;
        setTimeout(() => {
            item.dot.classList.remove("onboarding-hidden");
            item.dot.classList.add("cascade-revealing");

            const row = document.getElementById(`panel-row-${item.itemId}`);
            if (row) {
                row.classList.remove("onboarding-hidden");
                row.classList.add("cascade-revealing");
            }
        }, delay);
    });

    setTimeout(() => {
        dots.forEach((d) => d.classList.remove("cascade-revealing"));
        if (panel) {
            panel.querySelectorAll(".panel-row").forEach((r) => r.classList.remove("cascade-revealing"));
        }
        showDragVoteTip();
    }, totalDuration + 400);
}

export function showDragVoteTip() {
    let tip = document.getElementById("drag-vote-tip");
    const container = document.getElementById("graph-container");
    if (!tip && container) {
        tip = document.createElement("div");
        tip.id = "drag-vote-tip";
        tip.innerHTML = "💡 <strong>Tip:</strong> Drag any tool dot or click in the list to cast your vote!";
        container.appendChild(tip);
    }
    if (tip) {
        tip.classList.add("show");
        setTimeout(() => {
            tip.classList.remove("show");
        }, 5000);
    }
}

export function setupOnboardingEventListeners() {
    const overlay = document.getElementById("onboarding-overlay");
    const nextBtn = document.getElementById("onboard-next-btn");
    const skipBtn = document.getElementById("onboard-skip-btn");

    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            handleOnboardingAdvance();
        };
    }

    if (skipBtn) {
        skipBtn.onclick = (e) => {
            e.stopPropagation();
            skipOnboarding();
        };
    }

    if (overlay) {
        overlay.onclick = (e) => {
            if (e.target.closest("button") || e.target.closest("#onboard-sidebar-panel")) return;
            handleOnboardingAdvance();
        };
    }

    document.addEventListener("keydown", (e) => {
        if (!state.isOnboardingActive) return;
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
            e.preventDefault();
            handleOnboardingAdvance();
        } else if (e.key === "Escape") {
            e.preventDefault();
            skipOnboarding();
        }
    });

    const replayBtn = document.getElementById("replay-intro-btn");
    if (replayBtn) {
        replayBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const header = document.getElementById("header");
            if (header) header.classList.remove("settings-open");
            startOnboarding(true);
        };
    }
}
