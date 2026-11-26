import { createClient } from "@libsql/client";
import { NextResponse } from "next/server";

const PASSWORD = "JekkLiqoOqD";

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

let initialized = false;

async function init() {
    if (initialized) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS pending (
            id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL
        )
    `);
    initialized = true;
}

function authorized(req) {
    return req.headers.get("authorization") === `Bearer ${PASSWORD}`;
}

export async function GET(req, { params }) {
    await init();

    const { path = [] } = await params;
    const url = new URL(req.url);

    if (path[0] === "api" && path[1] === "pending") {
        if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const result = await db.execute("SELECT id FROM pending ORDER BY created_at ASC");
        return NextResponse.json({ pending: result.rows.map(row => row.id) });
    }

    if (path[0] === "api" && path[1] === "dashboard") {
        if (url.searchParams.get("dec") !== PASSWORD)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const result = await db.execute("SELECT id, created_at FROM pending ORDER BY created_at DESC");
        return NextResponse.json({ pending: result.rows });
    }

    if (path[0] === "blacklist" && path[1] === "add") {
        if (url.searchParams.get("dec") !== PASSWORD)
            return new Response("Unauthorized", { status: 401 });

        const result = await db.execute("SELECT id, created_at FROM pending ORDER BY created_at DESC");
        return new Response(result.rows.map(row => row.id).join("\n"), {
            headers: { "Content-Type": "text/plain" }
        });
    }

    if (path[0] === "blacklist" && path[1] && path[1] !== "add") {
        const id = path[1];

        if (!/^\d{17,20}$/.test(id) || url.searchParams.get("dec") !== PASSWORD)
            return new Response("Invalid link", { status: 401 });

        await db.execute({
            sql: "INSERT OR IGNORE INTO pending (id, created_at) VALUES (?, ?)",
            args: [id, Date.now()]
        });

        return new Response("you can close this now", {
            headers: { "Content-Type": "text/plain" }
        });
    }

    if (path[0] === "unblacklist" && path[1]) {
        const id = path[1];

        if (!/^\d{17,20}$/.test(id) || url.searchParams.get("dec") !== PASSWORD)
            return new Response("Invalid link", { status: 401 });

        await db.execute({ sql: "DELETE FROM pending WHERE id = ?", args: [id] });

        return new Response("you can close this now", {
            headers: { "Content-Type": "text/plain" }
        });
    }

    return new Response("Not found", { status: 404 });
}

export async function POST(req, { params }) {
    await init();

    const { path = [] } = await params;

    if (path[0] === "api" && path[1] === "ack") {
        if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { ids } = await req.json();

        if (!Array.isArray(ids) || ids.length > 100 || !ids.every(id => typeof id === "string" && /^\d{17,20}$/.test(id)))
            return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });

        for (const id of ids) {
            await db.execute({ sql: "DELETE FROM pending WHERE id = ?", args: [id] });
        }

        return NextResponse.json({ success: true });
    }

    return new Response("Not found", { status: 404 });
}
