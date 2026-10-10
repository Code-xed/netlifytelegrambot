import { timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { storage } from "../../src/storage/index.js";

function tokenMatches(provided, expected) {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function saveHistory(entry) {
  const store = getStore({ name: "bot-settings", consistency: "strong" });
  const previous = await store.get("admin-sync-history", { type: "json", consistency: "strong" });
  const history = Array.isArray(previous) ? previous : [];
  await store.setJSON("admin-sync-history", [entry, ...history].slice(0, 8));
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, {
      status: 405,
      headers: { Allow: "POST", "Cache-Control": "no-store" },
    });
  }

  const expectedToken = process.env.ADMIN_DASHBOARD_TOKEN;
  if (!expectedToken) {
    return Response.json({ ok: false, error: "Manual sync is not configured. Set ADMIN_DASHBOARD_TOKEN in Netlify environment variables." }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  const providedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!tokenMatches(providedToken, expectedToken)) {
    return Response.json({ ok: false, error: "Admin token is missing or invalid." }, {
      status: 401,
      headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer", "X-Content-Type-Options": "nosniff" },
    });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, error: "Neon is not configured. Set DATABASE_URL before syncing." }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await storage.referrals.syncLegacyToNeon();
    const completedAt = new Date().toISOString();
    const entry = {
      startedAt,
      completedAt,
      status: result.errors || result.codeConflicts ? "completed_with_warnings" : "completed",
      ...result,
    };
    try { await saveHistory(entry); } catch { /* Keep the successful sync result even if history persistence fails. */ }
    return Response.json({ ok: true, result: entry }, {
      status: 200,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    const entry = {
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      message: "The sync failed. Check the Neon connection and Netlify function logs.",
    };
    try { await saveHistory(entry); } catch { /* Do not expose storage errors. */ }
    return Response.json({ ok: false, error: entry.message }, {
      status: 502,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}
