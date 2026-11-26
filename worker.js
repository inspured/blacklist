const API = "https://blacklist-flame-one.vercel.app";
const PASSWORD = "JekkLiqoOqD";

async function fetchQueue(endpoint) {
    const res = await fetch(`${API}${endpoint}`, {
        headers: { Authorization: `Bearer ${PASSWORD}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
    const { pending } = await res.json();
    return pending;
}

async function ack(ids) {
    if (!ids.length) return;
    const res = await fetch(`${API}/api/ack`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${PASSWORD}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error("Failed to acknowledge IDs");
}

async function processQueue(queueEndpoint, actionEndpoint, label) {
    const pending = await fetchQueue(queueEndpoint);
    const processed = [];

    for (const id of pending) {
        try {
            const response = await fetch(`${API}/${actionEndpoint}/${id}?dec=${PASSWORD}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            processed.push(id);
            console.log(`[${label}] ${id}`);
        } catch (error) {
            console.error(`[ERROR] ${label} ${id}: ${error.message}`);
        }
    }

    await ack(processed);
}

async function poll() {
    await processQueue("/api/pending", "blacklist", "BLACKLIST");
    await processQueue("/api/pending-unblacklist", "unblacklist", "UNBLACKLIST");
}

async function start() {
    console.log("[WORKER] Started");

    while (true) {
        try {
            await poll();
        } catch (error) {
            console.error(error.message);
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
    }
}

start();
