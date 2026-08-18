// AI Tool Directory panel rendering, metric bars, and filter synchronization
import { state } from "../state/app-state.js";
import { escapeHtml } from "../core/formatters.js";
import { readinessColor } from "../core/colors.js";
import { highlightItem, clearHighlight, getHighlightedId } from "./highlight.js";
import { ACADEMY_BRANCHES } from "../config/constants.js";

function getDisplayedMetric(item, axis) {
    const dot = document.getElementById(`dot-${item.id}`);
    const datasetKey = axis === "x" ? "realX" : "realY";
    const displayedValue = Number.parseFloat(dot?.dataset?.[datasetKey]);
    if (Number.isFinite(displayedValue)) return displayedValue;

    const fallbackValue = Number.parseFloat(item?.[axis]);
    return Number.isFinite(fallbackValue) ? fallbackValue : 0;
}

function compareByName(a, b) {
    return (a.name || "").localeCompare(b.name || "") || (a.id || "").localeCompare(b.id || "");
}

function sortTools(items, mode = "alphabetical") {
    const sortedItems = [...items];
    const sortConfig = {
        "readiness-desc": { axis: "y", direction: -1 },
        "generative-desc": { axis: "x", direction: -1 },
        "readiness-asc": { axis: "y", direction: 1 },
        "generative-asc": { axis: "x", direction: 1 },
    }[mode];

    if (!sortConfig) {
        return sortedItems.sort(compareByName);
    }

    return sortedItems.sort((a, b) => {
        const metricDifference =
            getDisplayedMetric(a, sortConfig.axis) - getDisplayedMetric(b, sortConfig.axis);
        return metricDifference === 0 ? compareByName(a, b) : metricDifference * sortConfig.direction;
    });
}

export function applyFilters(options = {}) {
    if (options.clearMobileFanFn) options.clearMobileFanFn();

    const searchInput = document.getElementById("search-input");
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const container = document.getElementById("graph-container");
    const branchBtn = document.getElementById("branch-filter-btn");
    const panelInner = document.getElementById("tool-panel-inner");
    const sortMode = document.getElementById("tool-sort-select")?.value || "alphabetical";

    const hasFilter = query !== "" || state.selectedTags.size > 0;

    if (container) {
        container.classList.toggle("searching", hasFilter);
    }
    if (branchBtn) {
        branchBtn.classList.toggle("active", state.selectedTags.size > 0);
    }

    const matchingItems = [];
    const nonMatchingItems = [];
    const allItems = Object.values(state.itemsCache || {});

    allItems.forEach((item) => {
        let isMatch = true;
        if (hasFilter) {
            let matchesSearch = true;
            if (query) {
                const name = (item.name || "").toLowerCase();
                const desc = (item.desc || "").toLowerCase();
                matchesSearch = name.includes(query) || desc.includes(query);
            }

            let matchesTag = true;
            if (state.selectedTags.size > 0) {
                if (!item.tags || item.tags.length === 0) {
                    matchesTag = false;
                } else {
                    matchesTag = item.tags.some((tag) => state.selectedTags.has(tag));
                }
            }

            isMatch = matchesSearch && matchesTag;
        }

        if (!hasFilter || isMatch) {
            matchingItems.push(item);
        } else {
            nonMatchingItems.push(item);
        }

        // Update dot on graph
        const dot = document.getElementById(`dot-${item.id}`);
        if (dot) {
            dot.classList.toggle("search-match", hasFilter && isMatch);
        }
    });

    const sortedMatchingItems = sortTools(matchingItems, sortMode);
    const sortedNonMatchingItems = sortTools(nonMatchingItems, sortMode);

    const orderedItems = [...sortedMatchingItems, ...sortedNonMatchingItems];

    if (panelInner) {
        orderedItems.forEach((item, index) => {
            const number = index + 1;
            const row = document.getElementById(`panel-row-${item.id}`);
            const isDimmed = hasFilter && index >= matchingItems.length;

            if (row) {
                panelInner.appendChild(row);
                row.classList.toggle("dimmed", isDimmed);

                const rowNum = document.getElementById(`rownum-${item.id}`);
                if (rowNum) {
                    rowNum.textContent = number;
                }
            }

            const dotNum = document.getElementById(`dotnum-${item.id}`);
            if (dotNum) {
                dotNum.textContent = number;
            }
        });
    }

    if (options.scrollToTop) {
        const toolPanel = document.getElementById("tool-panel");
        if (toolPanel) {
            toolPanel.scrollTop = 0;
        }
    }
}

export function renderToolPanel({ onSelectItem = null, clearMobileFanFn = null } = {}) {
    const panelInner = document.getElementById("tool-panel-inner");
    if (!panelInner) return;

    panelInner.innerHTML = "";
    const items = Object.values(state.itemsCache || {});

    items.forEach((item) => {
        const dot = document.getElementById(`dot-${item.id}`);
        const xVal = dot && dot.dataset.realX != null ? Math.round(parseFloat(dot.dataset.realX)) : Math.round(item.x || 0);
        const yVal = dot && dot.dataset.realY != null ? Math.round(parseFloat(dot.dataset.realY)) : Math.round(item.y || 0);

        const row = document.createElement("div");
        row.className = "panel-row" + (state.isOnboardingActive ? " onboarding-hidden" : "");
        row.id = `panel-row-${item.id}`;
        row.dataset.itemId = item.id;

        const tagsArr = (item.tags && item.tags.length > 0) ? item.tags : [];
        const tagsHtml = tagsArr.map(t => `<span class="panel-tag">${escapeHtml(t)}</span>`).join("");

        row.innerHTML = `
            <div class="panel-row-head">
                <span class="panel-row-num" id="rownum-${item.id}" style="background-color:${readinessColor(yVal)}; border-color:${readinessColor(yVal)}; color:#0a0a0a;"></span>
                <div class="panel-row-name"></div>
            </div>
            <div class="panel-metrics">
                <div class="panel-metric">
                    <div class="panel-metric-label">Generative</div>
                    <div class="panel-metric-bar-wrap">
                        <div class="panel-metric-bar panel-metric-bar-gen" id="bar-gen-${item.id}" style="width:${xVal}%"></div>
                    </div>
                    <div class="panel-metric-num" id="num-gen-${item.id}">${xVal}%</div>
                </div>
                <div class="panel-metric">
                    <div class="panel-metric-label">Readiness</div>
                    <div class="panel-metric-bar-wrap">
                        <div class="panel-metric-bar panel-metric-bar-ready" id="bar-ready-${item.id}" style="width:${yVal}%; background-color:${readinessColor(yVal)}"></div>
                    </div>
                    <div class="panel-metric-num" id="num-ready-${item.id}">${yVal}%</div>
                </div>
            </div>
            <div class="panel-row-desc"></div>
            <div class="panel-row-tags">${tagsHtml}</div>
        `;

        row.querySelector(".panel-row-name").textContent = item.name || "";
        row.querySelector(".panel-row-desc").textContent = item.desc || "";

        row.addEventListener("mouseenter", () => {
            highlightItem(item.id);
        });
        row.addEventListener("mouseleave", () => {
            if (getHighlightedId() === item.id) clearHighlight();
        });
        row.addEventListener("click", () => {
            if (onSelectItem) {
                onSelectItem(item.id);
            } else {
                if (clearMobileFanFn) clearMobileFanFn();
                highlightItem(item.id);
            }
        });

        panelInner.appendChild(row);
    });

    applyFilters({ clearMobileFanFn });
}

export function setupFilterControls({ clearMobileFanFn = null } = {}) {
    const branchBtn = document.getElementById("branch-filter-btn");
    const branchDropdown = document.getElementById("branch-filter-dropdown");
    if (branchBtn && branchDropdown) {
        branchDropdown.innerHTML = ACADEMY_BRANCHES.map(branch => `
            <label class="branch-checkbox-item">
                <input type="checkbox" value="${branch}">
                ${branch}
            </label>
        `).join('');

        branchBtn.onclick = (e) => {
            e.stopPropagation();
            const isVisible = branchDropdown.style.display === "block";
            branchDropdown.style.display = isVisible ? "none" : "block";
        };

        branchDropdown.onclick = (e) => e.stopPropagation();

        branchDropdown.querySelectorAll("input[type=checkbox]").forEach(cb => {
            cb.onchange = (e) => {
                if (e.target.checked) state.selectedTags.add(e.target.value);
                else state.selectedTags.delete(e.target.value);
                applyFilters({ scrollToTop: true, clearMobileFanFn });
            };
        });

        document.addEventListener("click", () => {
            branchDropdown.style.display = "none";
        });
    }

    const searchInput = document.getElementById("search-input");
    const searchClear = document.getElementById("search-clear");
    const sortSelect = document.getElementById("tool-sort-select");
    const options = { scrollToTop: true, clearMobileFanFn };

    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            applyFilters(options);
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            if (searchClear) {
                searchClear.style.display = searchInput.value ? "block" : "none";
            }
            applyFilters(options);
        });
        searchInput.addEventListener("search", () => applyFilters(options));
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                searchInput.blur();
            } else if (e.key === "Escape") {
                if (searchInput.value) {
                    searchInput.value = "";
                    applyFilters(options);
                }
                searchInput.blur();
            }
        });
    }

    if (searchClear) {
        searchClear.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
                searchClear.style.display = "none";
                searchInput.focus();
            }
            applyFilters(options);
        });
    }
}
