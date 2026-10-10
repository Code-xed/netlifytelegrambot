import { getStore } from "@netlify/blobs";

const STORE_NAMES = {
  chats: "bot-chats",
  requests: "bot-requests",
  referrals: "bot-referrals",
};

async function countKeys(storeName, prefix = "") {
  const store = getStore({ name: storeName, consistency: "strong" });
  const { blobs } = await store.list({ prefix });
  return blobs.length;
}

async function metric(task) {
  try {
    return { value: await task(), available: true };
  } catch {
    return { value: null, available: false };
  }
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return Response.json(
      { ok: false, error: "Method not allowed" },
      { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } },
    );
  }

  const [usersSeen, referralCodes, attributions, approvedChats, accessRequests] = await Promise.all([
    metric(() => countKeys(STORE_NAMES.referrals, "seen:")),
    metric(() => countKeys(STORE_NAMES.referrals, "code:")),
    metric(() => countKeys(STORE_NAMES.referrals, "attribution:")),
    metric(() => countKeys(STORE_NAMES.chats)),
    metric(() => countKeys(STORE_NAMES.requests)),
  ]);

  const metrics = { usersSeen, referralCodes, attributions, approvedChats, accessRequests };
  const available = Object.values(metrics).filter(item => item.available).length;

  return Response.json(
    {
      ok: available > 0,
      status: available === Object.keys(metrics).length ? "ready" : available === 0 ? "unavailable" : "degraded",
      generatedAt: new Date().toISOString(),
      metrics,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    },
  );
}
