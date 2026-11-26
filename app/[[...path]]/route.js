import { createClient } from "@libsql/client";
import { NextResponse } from "next/server";

const PASSWORD = "JekkLiqoOqD";

const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
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

function authorized(req: Request) {
    return req.headers.get("authorization") === `Bearer ${PASSWORD}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
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

        return new Response(`
            <html>
            <body style="background:#090909;color:white;font-family:Arial;padding:35px">
                <h1>Blacklist</h1>
                <p>${result.rows.length} pending IDs</p>
                ${result.rows.map(row => `<p style="background:#151515;padding:15px;border-radius:8px">${row.id}</p>`).join("")}
            </body>
            </html>
        `, { headers: { "Content-Type": "text/html" } });
    }

    if (path[0] === "blacklist" && path[1] && path[1] !== "add") {
        const id = path[1];

        if (!/^\d{17,20}$/.test(id) || url.searchParams.get("dec") !== PASSWORD)
            return new Response("Invalid link", { status: 401 });

        return new Response(`
            <html>
            <body style="background:#090909;color:white;font-family:Arial;display:grid;place-items:center;height:100vh">
                <div style="background:#151515;padding:30px;border-radius:12px;text-align:center">
                    <h2>Blacklist submission</h2>
                    <p>${id}</p>
                    <form method="POST" action="/api/submit">
                        <input type="hidden" name="id" value="${id}">
                        <input type="hidden" name="dec" value="${PASSWORD}">
                        <button style="padding:12px 30px;cursor:pointer">Confirm</button>
                    </form>
                </div>
            </body>
            </html>
        `, { headers: { "Content-Type": "text/html" } });
    }

    return new Response("Not found", { status: 404 });
}

export async function POST(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
    await init();

    const { path = [] } = await params;

    if (path[0] === "api" && path[1] === "submit") {
        const form = await req.formData();
        const id = form.get("id");
        const dec = form.get("dec");

        if (typeof id !== "string" || !/^\d{17,20}$/.test(id) || dec !== PASSWORD)
            return new Response("Unauthorized", { status: 401 });

        await db.execute({
            sql: "INSERT OR IGNORE INTO pending (id, created_at) VALUES (?, ?)",
            args: [id, Date.now()],
        });

        return new Response(`
            <html><body style="background:#090909;color:white;text-align:center;font-family:Arial;padding-top:20%">
            <h2>Successfully submitted</h2>
            <script>window.close()</script>
            </body></html>
        `, { headers: { "Content-Type": "text/html" } });
    }

    if (path[0] === "api" && path[1] === "ack") {
        if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { ids } = await req.json();

        if (!Array.isArray(ids) || ids.length > 100 || !ids.every((id: unknown) => typeof id === "string" && /^\d{17,20}$/.test(id)))
            return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });

        for (const id of ids) {
            await db.execute({ sql: "DELETE FROM pending WHERE id = ?", args: [id] });
        }

        return NextResponse.json({ success: true });
    }

    return new Response("Not found", { status: 404 });
}
