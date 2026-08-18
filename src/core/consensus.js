// Consensus arithmetic and vote aggregation

export function computeConsensus(item, votesMap) {
    if (!item) return { x: 50, y: 50, count: 0 };
    let totalX = item.x * 10;
    let totalY = item.y * 10;
    let count = 10;
    if (votesMap) {
        Object.values(votesMap).forEach((vote) => {
            if (vote && typeof vote.x === "number" && typeof vote.y === "number") {
                totalX += vote.x;
                totalY += vote.y;
                count++;
            }
        });
    }
    return {
        x: totalX / count,
        y: totalY / count,
        voteCount: count - 10,
    };
}
