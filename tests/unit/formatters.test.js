import { describe, it, expect } from "vitest";
import {
    escapeHtml,
    formatAxisPosition,
    formatSpectrumPosition,
    generateDefaultUsername,
} from "../../src/core/formatters.js";

describe("formatters", () => {
    describe("escapeHtml", () => {
        it("escapes dangerous HTML characters to prevent XSS", () => {
            expect(escapeHtml("<script>alert('xss')</script>")).toBe(
                "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
            );
            expect(escapeHtml('Hello "World" & <Friends>')).toBe(
                "Hello &quot;World&quot; &amp; &lt;Friends&gt;",
            );
        });

        it("handles null, undefined, and empty string safely", () => {
            expect(escapeHtml(null)).toBe("");
            expect(escapeHtml(undefined)).toBe("");
            expect(escapeHtml("")).toBe("");
        });

        it("leaves safe strings untouched", () => {
            expect(escapeHtml("Runway Gen-4")).toBe("Runway Gen-4");
            expect(escapeHtml("Denoising")).toBe("Denoising");
        });
    });

    describe("formatAxisPosition", () => {
        it("labels leaning toward low side correctly", () => {
            expect(formatAxisPosition(28, "Utility", "Generative")).toBe("72% Utility");
            expect(formatAxisPosition(0, "Utility", "Generative")).toBe("100% Utility");
            expect(formatAxisPosition(49, "Utility", "Generative")).toBe("51% Utility");
        });

        it("labels leaning toward high side correctly", () => {
            expect(formatAxisPosition(50, "Utility", "Generative")).toBe("50% Generative");
            expect(formatAxisPosition(75, "Utility", "Generative")).toBe("75% Generative");
            expect(formatAxisPosition(100, "Utility", "Generative")).toBe("100% Generative");
        });

        it("clamps out-of-bounds percentages between 0 and 100", () => {
            expect(formatAxisPosition(-10, "Not Ready", "Ready")).toBe("100% Not Ready");
            expect(formatAxisPosition(150, "Not Ready", "Ready")).toBe("100% Ready");
        });
    });

    describe("formatSpectrumPosition", () => {
        it("formats both X and Y axes into human readable summary", () => {
            expect(formatSpectrumPosition(28, 90)).toBe("72% Utility · 90% Ready");
            expect(formatSpectrumPosition(85, 20)).toBe("85% Generative · 80% Not Ready");
        });
    });

    describe("generateDefaultUsername", () => {
        it("generates a username matching Color-Animal-Number pattern", () => {
            const username = generateDefaultUsername();
            expect(username).toMatch(/^[A-Za-z-]+-[A-Za-z-]+-\d{3}$/);
        });
    });
});
