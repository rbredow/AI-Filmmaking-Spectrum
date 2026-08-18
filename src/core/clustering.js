// Collision clustering, nearest item lookup, and radial fan layout calculations
import { MOBILE_FAN_THRESHOLD } from "../config/constants.js";

/**
 * Given a seed item ID and a map of { [id]: { x, y } } coordinates,
 * returns all item IDs in the connected collision cluster within threshold distance.
 */
export function findCollisionCluster(seedId, itemIds, pointsMap, itemsMap = {}, threshold = MOBILE_FAN_THRESHOLD) {
    const cluster = new Set([seedId]);
    const queue = [seedId];

    while (queue.length) {
        const currentId = queue.shift();
        const current = pointsMap.get(currentId);
        if (!current) continue;

        itemIds.forEach((candidateId) => {
            if (cluster.has(candidateId)) return;
            const candidate = pointsMap.get(candidateId);
            if (
                candidate &&
                Math.hypot(current.x - candidate.x, current.y - candidate.y) <= threshold
            ) {
                cluster.add(candidateId);
                queue.push(candidateId);
            }
        });
    }

    return [...cluster].sort((a, b) =>
        (itemsMap[a]?.name || "").localeCompare(itemsMap[b]?.name || ""),
    );
}

/**
 * Finds the nearest item to (clientX, clientY) within maxDistance
 */
export function findNearestItem(x, y, itemIds, getPointFn, maxDistance = 52) {
    let nearest = null;
    let nearestDistance = maxDistance;

    itemIds.forEach((id) => {
        const point = getPointFn(id);
        if (!point) return;
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < nearestDistance) {
            nearest = id;
            nearestDistance = distance;
        }
    });
    return nearest;
}

/**
 * Calculates fanned target positions with bounded repulsive force
 */
export function computeFanPositions(points, { minimumGap = 58, passes = 14 } = {}) {
    if (!points.length) return [];

    const targets = points.map(({ id, point }, index) => {
        const angle = -Math.PI / 2 + (index / points.length) * Math.PI * 2;
        return {
            id,
            origin: point,
            x: point.x + Math.cos(angle) * 2,
            y: point.y + Math.sin(angle) * 2,
        };
    });

    for (let pass = 0; pass < passes; pass++) {
        for (let i = 0; i < targets.length; i++) {
            for (let j = i + 1; j < targets.length; j++) {
                const a = targets[i];
                const b = targets[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let distance = Math.hypot(dx, dy);
                if (distance < 0.01) {
                    const angle = ((i + j + 1) / targets.length) * Math.PI * 2;
                    dx = Math.cos(angle);
                    dy = Math.sin(angle);
                    distance = 1;
                }
                if (distance >= minimumGap) continue;
                const push = (minimumGap - distance) * 0.36;
                const nx = dx / distance;
                const ny = dy / distance;
                a.x -= nx * push;
                a.y -= ny * push;
                b.x += nx * push;
                b.y += ny * push;
            }
        }
    }

    return targets;
}
