// Coordinate transformations, padding conversions, and mobile projection math
import {
    MOBILE_MIN_ZOOM,
    MOBILE_PLOT_TOP_INSET,
    MOBILE_PLOT_BOTTOM_INSET,
    MOBILE_TIMELINE_PLOT_BOTTOM_INSET,
} from "../config/constants.js";

// Inset the plotting area so dots near the 0%/100% edges keep a margin and
// don't spill off the chart (notably the lower-right corner in portrait).
export const PLOT_PAD = 3.5;
export const PLOT_SPAN = 100 - 2 * PLOT_PAD;

export function plotPct(v) {
    const c = Math.max(0, Math.min(100, v));
    return PLOT_PAD + (c / 100) * PLOT_SPAN;
}

export function unplotPct(p) {
    return ((p - PLOT_PAD) / PLOT_SPAN) * 100;
}

export function mobileGraphPlotBounds(container, isTimelineOpen = false) {
    const availableHeight = Math.max(1, container?.clientHeight || 0);
    const top = Math.min(MOBILE_PLOT_TOP_INSET, availableHeight * 0.25);
    const requestedBottom = isTimelineOpen
        ? MOBILE_TIMELINE_PLOT_BOTTOM_INSET
        : MOBILE_PLOT_BOTTOM_INSET;
    const bottom = Math.min(requestedBottom, availableHeight * 0.35);
    return {
        top,
        bottom,
        height: Math.max(1, availableHeight - top - bottom),
    };
}

export function baseGraphPoint(x, y, container, { viewMode = "2D", isMobile = false, isTimelineOpen = false } = {}) {
    const clientWidth = container?.clientWidth || 0;
    const clientHeight = container?.clientHeight || 0;

    let graphY;
    if (viewMode === "1D") {
        graphY = clientHeight / 2;
    } else if (isMobile) {
        const bounds = mobileGraphPlotBounds(container, isTimelineOpen);
        graphY =
            bounds.top +
            (1 - plotPct(y) / 100) * bounds.height;
    } else {
        graphY = (1 - plotPct(y) / 100) * clientHeight;
    }
    return {
        x: (plotPct(x) / 100) * clientWidth,
        y: graphY,
    };
}

export function projectedMobileGraphPoint(x, y, container, mobileGraphView, options = {}) {
    const base = baseGraphPoint(x, y, container, options);
    if (!options.isMobile) return base;
    return {
        x: base.x * mobileGraphView.scale + mobileGraphView.offsetX,
        y: base.y * mobileGraphView.scale + mobileGraphView.offsetY,
    };
}

export function clampMobileGraphView(mobileGraphView, container) {
    const clientWidth = container?.clientWidth || 0;
    const clientHeight = container?.clientHeight || 0;
    const overscrollX = clientWidth * 0.45;
    const overscrollY = clientHeight * 0.45;
    const minX = clientWidth * (1 - mobileGraphView.scale) - overscrollX;
    const minY = clientHeight * (1 - mobileGraphView.scale) - overscrollY;

    mobileGraphView.offsetX = Math.min(
        overscrollX,
        Math.max(minX, mobileGraphView.offsetX),
    );
    mobileGraphView.offsetY = Math.min(
        overscrollY,
        Math.max(minY, mobileGraphView.offsetY),
    );
    if (mobileGraphView.scale <= MOBILE_MIN_ZOOM + 0.001) {
        mobileGraphView.scale = MOBILE_MIN_ZOOM;
        mobileGraphView.offsetX = 0;
        mobileGraphView.offsetY = 0;
    }
}
