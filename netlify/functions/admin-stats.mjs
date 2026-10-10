import { getStore } from "@netlify/blobs";
import { neon } from "@neondatabase/serverless";

const STORE_NAMES = {
  chats: "bot-chats",
  requests: "bot-requests",
  referrals: "bot-referrals",
  admins: "bot-admins",
  settings: "bot-settings",
};

async function readStoreRecords(storeName, prefix = "") {
  const store = getStore({ name: storeName, consistency: "strong" });
  const { blobs } = await store.list({ prefix });
  const records = [];
  for (const blob of blobs) {
    try {
      const value = await store.get(blob.key, { type: "json", consistency: "strong" });
      if (value !== null && value !== undefined) records.push({ key: blob.key, value });
    } catch {
      // A malformed individual record must not hide all other records.
    }
  }
  return records;
}

async function metric(task) {
  try {
    return { value: await task(), available: true };
  } catch {
    return { value: null, available: false };
  }
}

async function countKeys(storeName, prefix = "") {
  const store = getStore({ name: storeName, consistency: "strong" });
  const { blobs } = await store.list({ prefix });
  return blobs.length;
}

async function checkNeon() {
  if (!process.env.DATABASE_URL) {
    return {
      status: "not_configured",
      configured: false,
      available: false,
      metrics: {
        platformUsers: { value: null, available: false },
        referralCodes: { value: null, available: false },
        attributions: { value: null, available: false },
        pendingAttributions: { value: null, available: false },
        finalizedAttributions: { value: null, available: false },
        linkedAttributions: { value: null, available: false },
        rewardClaims: { value: null, available: false },
      },
    };
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`SELECT 1 AS connected`;
  } catch {
    return {
      status: "disconnected",
      configured: true,
      available: false,
      metrics: {
        platformUsers: { value: null, available: false },
        referralCodes: { value: null, available: false },
        attributions: { value: null, available: false },
        pendingAttributions: { value: null, available: false },
        finalizedAttributions: { value: null, available: false },
        linkedAttributions: { value: null, available: false },
        rewardClaims: { value: null, available: false },
      },
    };
  }

  const count = async query => {
    const rows = await query;
    const value = Number(rows?.[0]?.count);
    if (!Number.isFinite(value)) throw new Error("Invalid count result");
    return value;
  };
  const [platformUsers, referralCodes, attributions, pendingAttributions, finalizedAttributions, linkedAttributions, rewardClaims] = await Promise.all([
    metric(() => count(sql`SELECT COUNT(*)::bigint AS count FROM public."user"`)),
    metric(() => count(sql`SELECT COUNT(*)::bigint AS count FROM public.referral_codes`)),
    metric(() => count(sql`SELECT COUNT(*)::bigint AS count FROM public.referral_attributions`)),
    metric(() => count(sql`SELECT COUNT(*)::bigint AS count FROM public.referral_attributions WHERE source_status = 'pending' AND referred_user_id IS NULL`)),
    metric(() => count(sql`SELECT COUNT(*)::bigint AS count FROM public.referral_attributions WHERE source_status <> 'pending' OR referred_user_id IS NOT NULL`)),
    metric(() => count(sql`SELECT COUNT(*)::bigint AS count FROM public.referral_attributions WHERE referred_user_id IS NOT NULL`)),
    metric(() => count(sql`SELECT COUNT(*)::bigint AS count FROM public.referral_reward_claims`)),
  ]);
  const metrics = { platformUsers, referralCodes, attributions, pendingAttributions, finalizedAttributions, linkedAttributions, rewardClaims };
  const allMetricsAvailable = Object.values(metrics).every(item => item.available);
  return {
    status: allMetricsAvailable ? "connected" : "degraded",
    configured: true,
    available: true,
    metrics,
  };
}

async function checkTelegram() {
  if (!process.env.BOT_TOKEN) return { status: "not_configured", available: false };
  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/getMe`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    const payload = await response.json();
    return response.ok && payload?.ok
      ? { status: "connected", available: true, botUsername: payload.result?.username ?? null }
      : { status: "disconnected", available: false };
  } catch {
    return { status: "disconnected", available: false };
  }
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return Response.json(
      { ok: false, error: "Method not allowed" },
      { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } },
    );
  }

  const [usersSeen, blobsReferralCodes, blobsAttributions, approvedChats, accessRequests, admins, requestRecords, syncHistory, neonHealth, telegramHealth] = await Promise.all([
    metric(() => countKeys(STORE_NAMES.referrals, "seen:")),
    metric(() => countKeys(STORE_NAMES.referrals, "code:")),
    metric(() => countKeys(STORE_NAMES.referrals, "attribution:")),
    metric(() => countKeys(STORE_NAMES.chats)),
    metric(() => countKeys(STORE_NAMES.requests)),
    metric(() => countKeys(STORE_NAMES.admins)),
    metric(() => readStoreRecords(STORE_NAMES.requests)),
    metric(async () => {
      const store = getStore({ name: STORE_NAMES.settings, consistency: "strong" });
      const value = await store.get("admin-sync-history", { type: "json", consistency: "strong" });
      return Array.isArray(value) ? value.slice(0, 8) : [];
    }),
    checkNeon(),
    checkTelegram(),
  ]);

  const requestStatuses = { pending: 0, approved: 0, rejected: 0, other: 0 };
  if (requestRecords.available) {
    for (const { value } of requestRecords.value) {
      const status = String(value?.status ?? "other").toLowerCase();
      if (Object.hasOwn(requestStatuses, status)) requestStatuses[status] += 1;
      else requestStatuses.other += 1;
    }
  }

  const metrics = {
    usersSeen,
    blobsReferralCodes,
    blobsAttributions,
    approvedChats,
    accessRequests,
    admins,
    pendingAccessRequests: requestRecords.available
      ? { value: requestStatuses.pending, available: true }
      : { value: null, available: false },
  };
  const blobMetricCount = Object.values(metrics).filter(item => item.available).length;
  const overallStatus = blobMetricCount === Object.keys(metrics).length && neonHealth.status === "connected" && telegramHealth.status === "connected"
    ? "ready"
    : blobMetricCount === 0 && !neonHealth.available && !telegramHealth.available
      ? "unavailable"
      : "degraded";

  return Response.json(
    {
      ok: overallStatus !== "unavailable",
      status: overallStatus,
      generatedAt: new Date().toISOString(),
      metrics,
      requestStatuses: requestStatuses,
      neon: neonHealth,
      telegram: telegramHealth,
      syncHistory: syncHistory.available ? syncHistory.value : [],
      syncHistoryAvailable: syncHistory.available,
      syncConfigured: Boolean(process.env.ADMIN_DASHBOARD_TOKEN),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    },
  );
}
