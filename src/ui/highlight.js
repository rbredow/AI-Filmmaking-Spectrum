// Bidirectional item highlighting (graph dot <-> tool panel row)
import { state, setState } from "../state/app-state.js";

let currentHighlightId = null;

export function getHighlightedId() {
    return currentHighlightId;
}

export function highlightItem(id, { scheduleMobileClampFn } = {}) {
    clearHighlight();
    currentHighlightId = id;
    setState({ highlightedId: id });

    const dot = document.getElementById(`dot-${id}`);
    if (dot) {
        dot.classList.add("highlighted");
    }

    const label = document.getElementById(`label-${id}`);
    if (label) {
        label.classList.add("label-highlighted");
    }

    const row = document.getElementById(`panel-row-${id}`);
    if (row) {
        row.classList.add("row-active");
    }

    if (scheduleMobileClampFn) {
        scheduleMobileClampFn(document.getElementById("graph-container"));
    }
}

export function clearHighlight() {
    if (currentHighlightId) {
        const dot = document.getElementById(`dot-${currentHighlightId}`);
        if (dot) dot.classList.remove("highlighted");

        const label = document.getElementById(`label-${currentHighlightId}`);
        if (label) label.classList.remove("label-highlighted");

        const row = document.getElementById(`panel-row-${currentHighlightId}`);
        if (row) row.classList.remove("row-active");

        currentHighlightId = null;
        setState({ highlightedId: null });
    }
}
