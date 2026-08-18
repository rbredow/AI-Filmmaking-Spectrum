import { describe, it, expect, beforeEach } from "vitest";
import { highlightItem, clearHighlight, getHighlightedId } from "../../src/ui/highlight.js";
import { state, setState } from "../../src/state/app-state.js";

describe("highlight manager & bidirectional sync", () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="graph-container">
                <div id="dot-tool_A" class="dot">
                    <div id="label-tool_A" class="dot-label">Tool A</div>
                </div>
                <div id="dot-tool_B" class="dot">
                    <div id="label-tool_B" class="dot-label">Tool B</div>
                </div>
            </div>
            <div id="tool-panel-inner">
                <div id="panel-row-tool_A" class="panel-row"></div>
                <div id="panel-row-tool_B" class="panel-row"></div>
            </div>
        `;
        setState({
            highlightedId: null,
            renderedItems: new Set(["tool_A", "tool_B"]),
        });
    });

    it("highlights targeted dot, label, and row", () => {
        highlightItem("tool_A");

        expect(getHighlightedId()).toBe("tool_A");

        const dotA = document.getElementById("dot-tool_A");
        const labelA = document.getElementById("label-tool_A");
        const rowA = document.getElementById("panel-row-tool_A");

        const dotB = document.getElementById("dot-tool_B");
        const rowB = document.getElementById("panel-row-tool_B");

        expect(dotA.classList.contains("highlighted")).toBe(true);
        expect(labelA.classList.contains("label-highlighted")).toBe(true);
        expect(rowA.classList.contains("row-active")).toBe(true);

        expect(dotB.classList.contains("highlighted")).toBe(false);
        expect(rowB.classList.contains("row-active")).toBe(false);
    });

    it("clearing highlight removes active classes across all elements", () => {
        highlightItem("tool_A");
        clearHighlight();

        expect(getHighlightedId()).toBeNull();

        const dotA = document.getElementById("dot-tool_A");
        const labelA = document.getElementById("label-tool_A");
        const rowA = document.getElementById("panel-row-tool_A");

        expect(dotA.classList.contains("highlighted")).toBe(false);
        expect(labelA.classList.contains("label-highlighted")).toBe(false);
        expect(rowA.classList.contains("row-active")).toBe(false);
    });
});
