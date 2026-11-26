
const API = process.env.API_URL;
const SECRET = process.env.WORKER_SECRET;

async function poll() {
    const res = await fetch(`${API}/api/pending`, {
        headers: { Authorization: `Bearer ${SECRET}` }
    });

    if (!res.ok) throw new Error("Failed to fetch pending IDs");

    const { pending } = await res.json();
    const processed = [];

    for (const id of pending) {
        try {
            const response = await fetch(process.env.BLACKLIST_TARGET_URL, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.BLACKLIST_TARGET_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ id })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            processed.push(id);
            console.log(`[BLACKLIST] ${id}`);
        } catch (error) {
            console.error(`[ERROR] ${id}: ${error.message}`);
        }
    }

    if (processed.length) {
        const ack = await fetch(`${API}/api/ack`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${SECRET}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ ids: processed })
        });

        if (!ack.ok) throw new Error("Failed to acknowledge IDs");
    }
}

async function start() {
    console.log("[WORKER] Started");

    while (true) {
        try {
            await poll();
        } catch (error) {
            console.error(error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

start();
