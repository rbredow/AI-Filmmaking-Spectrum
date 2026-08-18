import { describe, it, expect, beforeEach } from "vitest";
import { triggerMegaSplash, triggerSplash, updateConnectionLine } from "../../src/ui/graph-renderer.js";
import { state, setState } from "../../src/state/app-state.js";

describe("graph-renderer splashes and lines", () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="graph-container" style="width: 500px; height: 500px; position: relative;">
                <svg id="connections-layer">
                    <line id="line-item_01" style="display: none;"></line>
                </svg>
            </div>
        `;
        container = document.getElementById("graph-container");
        Object.defineProperty(container, "clientWidth", { value: 500, configurable: true });
        Object.defineProperty(container, "clientHeight", { value: 500, configurable: true });
        setState({
            appLaunchTime: Date.now() - 5000, // past the 2s launch guard
            viewMode: "2D",
        });
    });

    it("triggerMegaSplash creates .mega-splash DOM element matching CSS animations", () => {
        triggerMegaSplash(container, 50, 50);
        const splash = container.querySelector(".mega-splash");
        expect(splash).not.toBeNull();
        expect(splash.className).toBe("mega-splash");
    });

    it("triggerSplash creates .splash DOM element matching CSS animations", () => {
        triggerSplash(container, 50, 50);
        const splash = container.querySelector(".splash");
        expect(splash).not.toBeNull();
        expect(splash.className).toBe("splash");
    });

    it("updateConnectionLine sets display block and updates coordinate attributes", () => {
        const line = document.getElementById("line-item_01");
        expect(line.style.display).toBe("none");

        updateConnectionLine("item_01", 10, 20, 30, 40);
        expect(line.style.display).toBe("block");
        expect(line.getAttribute("x1")).not.toBeNull();
        expect(line.getAttribute("y1")).not.toBeNull();
    });

    it("hovering another dot (mouseenter) clears tooltip-active from all other dots to ensure only one popup at a time", async () => {
        const { createItemElements } = await import("../../src/ui/graph-renderer.js");
        createItemElements(container, { id: "item_01", name: "Tool A", x: 20, y: 30 });
        createItemElements(container, { id: "item_02", name: "Tool B", x: 60, y: 70 });

        const dotA = document.getElementById("dot-item_01");
        const dotB = document.getElementById("dot-item_02");

        dotA.classList.add("tooltip-active");
        expect(dotA.classList.contains("tooltip-active")).toBe(true);

        // Hover over dot B
        dotB.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

        // Dot A's active tooltip must be dismissed
        expect(dotA.classList.contains("tooltip-active")).toBe(false);
    });

    it("verifies style.css does not apply scale() transforms to parent .dot on hover/active to keep tooltip dimensions unified", async () => {
        const fs = await import("fs");
        const path = await import("path");
        const cssContent = fs.readFileSync(path.resolve(__dirname, "../../style.css"), "utf8");

        // .dot:hover and .dot:active must not scale the parent dot, which causes child tooltip size flashing
        expect(cssContent).not.toMatch(/\.dot:hover[^{]*\{[^}]*scale\(/);
        expect(cssContent).not.toMatch(/\.dot:active[^{]*\{[^}]*scale\(/);
    });

    it("verifies style.css disables detailed .tooltip on mobile to only display compact one-line .dot-label", async () => {
        const fs = await import("fs");
        const path = await import("path");
        const cssContent = fs.readFileSync(path.resolve(__dirname, "../../style.css"), "utf8");

        // Media queries for max-width 600px and hover: none must disable .tooltip
        expect(cssContent).toMatch(/@media[^{]*max-width:\s*600px[^{]*\{[\s\S]*?\.tooltip\s*\{[\s\S]*?display:\s*none\s*!important/);
        expect(cssContent).toMatch(/@media[^{]*hover:\s*none[^{]*\{[\s\S]*?\.tooltip\s*\{[\s\S]*?display:\s*none\s*!important/);
    });
});
