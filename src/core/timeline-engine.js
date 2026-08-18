// Timeline scrubber timestamp parsing, historical session building, and date formatting

export const BASELINE_SNAPSHOT_UIDS = new Set([
    "0tn0mDj4HOgf5UhinlCi7CvDOk13", "1NNDJHWh5DOXYrmhP1QfwahR1n62",
    "76jSsm0UI5f7m0BKNF9VJMsdDc83", "7T8SclBHHpgLCR1F92pa3F9dZrp2",
    "94is7USmiGNgQgLqy7vGwUXOHBJ3", "9uAhHIP2QXd9nkFIRQt75C35g5r2",
    "AKWGfKJEtHP1WXz2zEKuQ82ZIY73", "JxpPLh8qKlgzVsiEEbOciln4z1x1",
    "L8HYrfj2qyMReIPWI4nJz6CgDYJ3", "UB6TZ5YEnMPMtzM1wwdpBU9qMzG2",
    "YKL5jdKqDba525cosjG5ao5w0Wl2", "gAOpJXK3TTPYlISiKTwi02MuOl52",
    "iIRD8oTraXfQnJc36OeKXcvJjVt2", "kwhj81G4pfWPTDHge13wOIwA5hb2",
    "mA7Bgc3BSdgrMGRz6r48qLGJ1yB3", "oi14FQpMG8U1QAmvc6ZCfnlZlpq1",
    "sQmcrde3fla7B0kj1CedL9EtJzv2", "uVWG6wAXviYp4azo9uqOM2tQRIT2",
    "vpodBq4BKrUYEPh0EUNmxjnoiW73", "wuELvwgy1nTSewKE3ldKDxJOaCC3",
    "xnSXjsXluCT5QM285duZasGsWMR2", "xvxz2VUxN6QLJQcoDCpSNVacwWu1",
    "zOxtZK2qvfbIYyfayL1DSEPQ69I3",
]);

export function getItemCreationTimestamp(itemId, item) {
    if (itemId && itemId.startsWith("user_item_")) {
        const parsed = parseInt(itemId.replace("user_item_", ""), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (item && item.createdAt) return item.createdAt;
    if (item && item.timestamp) return item.timestamp;
    // Base items seeded at project launch
    return new Date("2026-01-17T00:00:00Z").getTime();
}

export function buildUserSessionTimestamps(items, votes, baselineSnapshot = null) {
    const itemDates = {};
    Object.keys(items || {}).forEach((id) => {
        itemDates[id] = getItemCreationTimestamp(id, items[id]);
    });

    const userTimestamps = {};
    const aug15Users = [];

    // 1. Scan historical snapshot votes to map each user to the latest tool session they voted on
    Object.keys(votes || {}).forEach((itemId) => {
        const vMap = votes[itemId] || {};
        Object.keys(vMap).forEach((uid) => {
            const v = vMap[uid];
            if (v && v.timestamp) {
                userTimestamps[uid] = v.timestamp;
                return;
            }
            if (BASELINE_SNAPSHOT_UIDS.has(uid)) {
                // Historical voter from Jan - Jun 2026 milestones
                const t = itemDates[itemId] || new Date("2026-01-17T00:00:00Z").getTime();
                if (!userTimestamps[uid] || t > userTimestamps[uid]) {
                    userTimestamps[uid] = t;
                }
            } else {
                // Voter who joined during August 15 session
                if (!aug15Users.includes(uid)) aug15Users.push(uid);
            }
        });
    });

    // 2. For Aug 15 session voters, stagger their timestamps across the Aug 15 voting session window
    const AUG15_START = new Date("2026-08-15T18:30:00Z").getTime();
    const AUG15_END = new Date("2026-08-15T20:30:00Z").getTime();
    aug15Users.forEach((uid, idx) => {
        if (!userTimestamps[uid]) {
            const step = (AUG15_END - AUG15_START) / Math.max(1, aug15Users.length);
            userTimestamps[uid] = Math.round(AUG15_START + idx * step);
        }
    });

    return userTimestamps;
}

export function getVoteTimestamp(itemId, uid, vote, userSessionCache = {}) {
    if (vote && vote.timestamp) return vote.timestamp;
    if (vote && vote.createdAt) return vote.createdAt;
    if (userSessionCache[uid]) return userSessionCache[uid];
    return new Date("2026-01-17T00:00:00Z").getTime();
}

export function formatTimelineDate(timestamp) {
    const d = new Date(timestamp);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return {
        dateStr: `${month} ${day}, ${year}`,
        timeStr: `${hours}:${minutes} ${ampm}`,
        fullStr: `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`,
    };
}
