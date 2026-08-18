import { describe, it, expect, beforeEach } from "vitest";
import { state, setState } from "../../src/state/app-state.js";
import { renderToolPanel, setupFilterControls, applyFilters } from "../../src/ui/tool-panel.js";

describe("tool-panel filtering & search corner cases", () => {
    let panelInner, searchInput, searchClear, branchBtn, branchDropdown;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="graph-container">
                <div id="dot-tool_1" class="dot" data-real-x="10" data-real-y="90"></div>
                <div id="dot-tool_2" class="dot" data-real-x="80" data-real-y="20"></div>
                <div id="dot-tool_3" class="dot" data-real-x="50" data-real-y="50"></div>
            </div>
            <div id="tool-panel-inner"></div>
            <input id="search-input" type="text" />
            <div id="search-clear" style="display: none;"></div>
            <div id="branch-filter-btn">Branch ▾</div>
            <div id="branch-filter-dropdown" style="display: none;"></div>
        `;
        panelInner = document.getElementById("tool-panel-inner");
        searchInput = document.getElementById("search-input");
        searchClear = document.getElementById("search-clear");
        branchBtn = document.getElementById("branch-filter-btn");
        branchDropdown = document.getElementById("branch-filter-dropdown");

        setState({
            itemsCache: {
                tool_1: { id: "tool_1", name: "Denoising Sound", desc: "Audio cleanup", tags: ["Sound", "Production"], x: 10, y: 90 },
                tool_2: { id: "tool_2", name: "Idea to Script", desc: "Writing assistant", tags: ["Writers"], x: 80, y: 20 },
                tool_3: { id: "tool_3", name: "Script Breakdown", desc: "Production scheduling", tags: ["Directing", "Production"], x: 50, y: 50 },
            },
            renderedItems: new Set(["tool_1", "tool_2", "tool_3"]),
            selectedTags: new Set(),
            searchQuery: "",
            highlightedId: null,
            viewMode: "2D",
            isStaticMode: true,
        });

        // Initialize panel rows
        renderToolPanel();
    });

    it("renders all rows with corresponding metric bars and tags", () => {
        expect(panelInner.children.length).toBe(3);
        const row1 = document.getElementById("panel-row-tool_1");
        expect(row1).not.toBeNull();
        expect(row1.textContent).toContain("Denoising Sound");
        expect(row1.textContent).toContain("Sound");
    });

    it("filters tools case-insensitively by search substring", () => {
        setupFilterControls();
        searchInput.value = "script";
        searchInput.dispatchEvent(new Event("input"));

        const row1 = document.getElementById("panel-row-tool_1");
        const row2 = document.getElementById("panel-row-tool_2");
        const row3 = document.getElementById("panel-row-tool_3");
        const dot1 = document.getElementById("dot-tool_1");
        const dot2 = document.getElementById("dot-tool_2");
        const dot3 = document.getElementById("dot-tool_3");

        // Non-matching row1 has dimmed class; matching row2 & row3 do not
        expect(row1.classList.contains("dimmed")).toBe(true);
        expect(row2.classList.contains("dimmed")).toBe(false);
        expect(row3.classList.contains("dimmed")).toBe(false);

        // Matching dots receive search-match class
        expect(dot1.classList.contains("search-match")).toBe(false);
        expect(dot2.classList.contains("search-match")).toBe(true);
        expect(dot3.classList.contains("search-match")).toBe(true);
    });

    it("filters tools by multi-branch selection (OR logic)", () => {
        setupFilterControls();

        // Select "Writers" and "Sound"
        state.selectedTags.add("Writers");
        state.selectedTags.add("Sound");

        applyFilters();

        const row1 = document.getElementById("panel-row-tool_1"); // has "Sound" -> not dimmed
        const row2 = document.getElementById("panel-row-tool_2"); // has "Writers" -> not dimmed
        const row3 = document.getElementById("panel-row-tool_3"); // has "Directing", "Production" -> dimmed

        expect(row1.classList.contains("dimmed")).toBe(false);
        expect(row2.classList.contains("dimmed")).toBe(false);
        expect(row3.classList.contains("dimmed")).toBe(true);
    });

    it("combines search query AND branch tags together", () => {
        setupFilterControls();

        // Branch filter: "Production" (matches tool_1 and tool_3)
        state.selectedTags.add("Production");

        // Search query: "script" (matches tool_2 and tool_3)
        searchInput.value = "script";
        searchInput.dispatchEvent(new Event("input"));

        const row1 = document.getElementById("panel-row-tool_1");
        const row2 = document.getElementById("panel-row-tool_2");
        const row3 = document.getElementById("panel-row-tool_3");

        // Only tool_3 has tag "Production" AND matches "script"
        expect(row1.classList.contains("dimmed")).toBe(true);
        expect(row2.classList.contains("dimmed")).toBe(true);
        expect(row3.classList.contains("dimmed")).toBe(false);
    });

    it("clearing search restores visibility to all rows and clears search-match on dots", () => {
        setupFilterControls();
        searchInput.value = "denoising";
        searchInput.dispatchEvent(new Event("input"));

        searchClear.dispatchEvent(new MouseEvent("click"));

        expect(searchInput.value).toBe("");
        const row1 = document.getElementById("panel-row-tool_1");
        const row2 = document.getElementById("panel-row-tool_2");
        const row3 = document.getElementById("panel-row-tool_3");
        const dot1 = document.getElementById("dot-tool_1");
        const dot2 = document.getElementById("dot-tool_2");

        expect(row1.classList.contains("dimmed")).toBe(false);
        expect(row2.classList.contains("dimmed")).toBe(false);
        expect(row3.classList.contains("dimmed")).toBe(false);
        expect(dot1.classList.contains("search-match")).toBe(false);
        expect(dot2.classList.contains("search-match")).toBe(false);
    });

    it("does not force hidden voter dots to become visible when filtering by branch", () => {
        setupFilterControls();

        // Create a hidden voter dot (no .visible class)
        const container = document.getElementById("graph-container");
        const vDot = document.createElement("div");
        vDot.className = "voter-dot";
        vDot.id = "voter-dot-tool_1-userA";
        container.appendChild(vDot);

        // Filter by branch "Sound"
        state.selectedTags.add("Sound");
        applyFilters();

        // Voter dot must remain non-visible
        expect(vDot.classList.contains("visible")).toBe(false);
        expect(vDot.classList.contains("search-match")).toBe(false);
    });
});
