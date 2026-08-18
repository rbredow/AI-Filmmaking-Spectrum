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
});
