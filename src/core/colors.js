// Color generation and spectrum interpolation utilities

/**
 * Solid color for a readiness value, interpolated along the same spectrum as
 * the y-axis gradient: 0% red → 50% yellow → 100% green.
 * (#ff3d00 → #ffea00 → #00e676)
 */
export function readinessColor(y) {
    const v = Math.max(0, Math.min(100, y));
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const red = [255, 61, 0];
    const yellow = [255, 234, 0];
    const green = [0, 230, 118];
    let c;
    if (v <= 50) {
        const t = v / 50;
        c = [lerp(red[0], yellow[0], t), lerp(red[1], yellow[1], t), lerp(red[2], yellow[2], t)];
    } else {
        const t = (v - 50) / 50;
        c = [lerp(yellow[0], green[0], t), lerp(yellow[1], green[1], t), lerp(yellow[2], green[2], t)];
    }
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function updateDotColor(dot, y) {
    if (!dot) return;
    dot.classList.remove("ready-high", "ready-mid", "ready-low");
    if (y > 80) dot.classList.add("ready-high");
    else if (y > 50) dot.classList.add("ready-mid");
    else dot.classList.add("ready-low");
}
