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

let userSessionTimestampsCache = {};

export function getItemCreationTimestamp(itemId, item) {
    if (item && item.createdAt) return item.createdAt;
    if (item && item.timestamp) return item.timestamp;
    if (itemId && itemId.startsWith("user_item_")) {
        const parsed = parseInt(itemId.replace("user_item_", ""), 10);
        if (!isNaN(parsed) && parsed > 1000000000000) return parsed;
    }
    // Base items seeded at project launch
    return new Date("2026-01-17T00:00:00Z").getTime();
}

export function buildUserSessionTimestamps(items, votes, baselineSnapshot = null) {
    const itemDates = {};
    Object.keys(items || {}).forEach((id) => {
        itemDates[id] = getItemCreationTimestamp(id, items[id]);
    });

    const userTimestamps = {};
    const userMaxToolDate = {};
    const eventGroups = {};

    // 1. Correlate each voter with the latest tool creation date they voted on
    Object.keys(votes || {}).forEach((itemId) => {
        const vMap = votes[itemId] || {};
        Object.keys(vMap).forEach((uid) => {
            const v = vMap[uid];
            if (v && v.timestamp) {
                userTimestamps[uid] = v.timestamp;
                return;
            }
            const t = itemDates[itemId] || getItemCreationTimestamp(itemId, items?.[itemId]);
            if (!userMaxToolDate[uid] || t > userMaxToolDate[uid]) {
                userMaxToolDate[uid] = t;
            }
        });
    });

    // 2. Group voters by their correlated event timestamp
    Object.entries(userMaxToolDate).forEach(([uid, eventTime]) => {
        if (!userTimestamps[uid]) {
            if (!eventGroups[eventTime]) eventGroups[eventTime] = [];
            eventGroups[eventTime].push(uid);
        }
    });

    // 3. For each event cluster, stagger voters across a 20-minute event session window
    const SESSION_WINDOW_MS = 20 * 60 * 1000;
    Object.entries(eventGroups).forEach(([eventTimeStr, uids]) => {
        const baseTime = parseInt(eventTimeStr, 10);
        const step = SESSION_WINDOW_MS / Math.max(1, uids.length);
        uids.forEach((uid, idx) => {
            userTimestamps[uid] = Math.round(baseTime + (idx + 1) * step);
        });
    });

    userSessionTimestampsCache = userTimestamps;
    return userTimestamps;
}

export function getVoteTimestamp(itemId, uid, vote, userSessionCache = null) {
    if (vote && vote.timestamp) return vote.timestamp;
    if (vote && vote.createdAt) return vote.createdAt;
    const cache = userSessionCache || userSessionTimestampsCache;
    if (cache && cache[uid]) return cache[uid];
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
