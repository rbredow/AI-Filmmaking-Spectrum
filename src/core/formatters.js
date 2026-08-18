// String formatters, coordinate labelers, and sanitization utilities
import { COLORS, ANIMALS } from "../config/constants.js";

/**
 * Escape user-supplied text before interpolating into innerHTML.
 * Tool names, descriptions, tags, and voter usernames are untrusted input
 * that gets broadcast to every other client, so they must never be treated
 * as markup (prevents stored XSS).
 */
export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[ch]));
}

/**
 * Express each coordinate using the side of the spectrum it actually leans
 * toward. A raw "G 28" reads like "28% Generative", while the same position is
 * more naturally understood as "72% Utility".
 */
export function formatAxisPosition(value, lowLabel, highLabel) {
    const rounded = Math.round(Math.max(0, Math.min(100, value)));
    return rounded < 50
        ? `${100 - rounded}% ${lowLabel}`
        : `${rounded}% ${highLabel}`;
}

export function formatSpectrumPosition(x, y) {
    return `${formatAxisPosition(x, "Utility", "Generative")} · ${formatAxisPosition(y, "Not Ready", "Ready")}`;
}

export function generateDefaultUsername() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${color}-${animal}-${num}`;
}
