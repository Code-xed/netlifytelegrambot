import { getStore } from "@netlify/blobs";
import { neon } from "@neondatabase/serverless";
import { validateInitData } from "../../src/miniapp.js";
import { isValidReferralCode } from "../../src/referral-utils.js";

const STORE_NAME = "bot-referrals";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: HEADERS });
}

function sqlTimestamp(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return null;
  return new Date(milliseconds).toISOString().slice(0, 19).replace("T", " ");
}

async function readReferralRecord(store, key) {
  return store.get(key, { type: "json", consistency: "strong" });
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "A valid JSON body is required" }, 400);
  }

  const initData = body?.init_data;
  if (typeof initData !== "string" || initData.length === 0 || initData.length > 16_384) {
    return json({ ok: false, error: "Valid Telegram Mini App init_data is required" }, 400);
  }

  if (!process.env.BOT_TOKEN) {
    return json({ ok: false, error: "Telegram validation is not configured" }, 503);
  }

  let verified;
  try {
    verified = validateInitData(initData, process.env.BOT_TOKEN);
  } catch {
    verified = null;
  }

  const telegramUserId = Number(verified?.user?.id);
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
    return json({ ok: false, error: "Telegram authentication could not be verified" }, 401);
  }

  const referredTelegramId = String(telegramUserId);
  const referralStore = getStore({ name: STORE_NAME, consistency: "strong" });

  let attribution;
  try {
    attribution = await readReferralRecord(referralStore, `attribution:${referredTelegramId}`);
  } catch (error) {
    console.error("Could not read pending referral attribution:", error);
    return json({ ok: false, error: "Referral data is temporarily unavailable" }, 503);
  }

  if (!attribution) {
    return json({ ok: true, status: "no_attribution" });
  }

  if (attribution.status !== "pending") {
    return json({
      ok: true,
      status: attribution.status === "finalized" ? "already_finalized" : "no_pending_attribution",
    });
  }

  const referrerTelegramId = Number(attribution.referrerId);
  const code = typeof attribution.code === "string" ? attribution.code.toLowerCase() : "";
  const attributedAt = sqlTimestamp(attribution.attributedAt);

  if (
    Number(attribution.referredUserId) !== telegramUserId ||
    !Number.isSafeInteger(referrerTelegramId) ||
    referrerTelegramId <= 0 ||
    referrerTelegramId === telegramUserId ||
    !isValidReferralCode(code) ||
    !attributedAt
  ) {
    return json({ ok: false, error: "The pending referral record is invalid" }, 409);
  }

  let codeRecord;
  try {
    codeRecord = await readReferralRecord(referralStore, `code:${code}`);
  } catch (error) {
    console.error("Could not read referral-code ownership:", error);
    return json({ ok: false, error: "Referral data is temporarily unavailable" }, 503);
  }

  if (!codeRecord || Number(codeRecord.userId) !== referrerTelegramId || codeRecord.code !== code) {
    return json({ ok: false, error: "Referral-code ownership could not be verified" }, 409);
  }

  if (!process.env.DATABASE_URL) {
    return json({ ok: false, error: "Neon database connection is not configured" }, 503);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Existing Mini App accounts must never receive retroactive referral attribution.
    const registered = await sql`
      SELECT id
      FROM public."user"
      WHERE telegram_id = ${referredTelegramId}
      LIMIT 1
    `;
    if (registered.length > 0) {
      return json({ ok: true, status: "already_registered" });
    }

    const currentAttribution = await sql`
      SELECT source_status, referred_user_id
      FROM public.referral_attributions
      WHERE referred_telegram_id = ${referredTelegramId}
      LIMIT 1
    `;
    if (
      currentAttribution.length > 0 &&
      (currentAttribution[0].source_status !== "pending" || currentAttribution[0].referred_user_id != null)
    ) {
      return json({ ok: true, status: "already_finalized" });
    }

    // Register the existing Blobs code without ever reassigning code ownership.
    const existingCodes = await sql`
      SELECT telegram_user_id, referral_code
      FROM public.referral_codes
      WHERE telegram_user_id = ${String(referrerTelegramId)}
         OR referral_code = ${code}
      LIMIT 2
    `;

    const ownershipMatches = existingCodes.some(
      row => String(row.telegram_user_id) === String(referrerTelegramId) && row.referral_code === code,
    );
    const ownershipConflicts = existingCodes.some(
      row => String(row.telegram_user_id) !== String(referrerTelegramId) || row.referral_code !== code,
    );

    if (ownershipConflicts) {
      return json({ ok: false, error: "This referral code conflicts with permanent Neon ownership" }, 409);
    }

    if (!ownershipMatches) {
      const codeCreatedAt = sqlTimestamp(codeRecord.createdAt);
      if (codeCreatedAt) {
        await sql`
          INSERT INTO public.referral_codes (telegram_user_id, referral_code, created_at)
          VALUES (${String(referrerTelegramId)}, ${code}, ${codeCreatedAt}::timestamp)
          ON CONFLICT DO NOTHING
        `;
      } else {
        await sql`
          INSERT INTO public.referral_codes (telegram_user_id, referral_code)
          VALUES (${String(referrerTelegramId)}, ${code})
          ON CONFLICT DO NOTHING
        `;
      }

      const verifiedCodes = await sql`
        SELECT telegram_user_id, referral_code
        FROM public.referral_codes
        WHERE telegram_user_id = ${String(referrerTelegramId)}
           OR referral_code = ${code}
        LIMIT 2
      `;
      const verifiedOwnership = verifiedCodes.some(
        row => String(row.telegram_user_id) === String(referrerTelegramId) && row.referral_code === code,
      );
      const verifiedConflict = verifiedCodes.some(
        row => String(row.telegram_user_id) !== String(referrerTelegramId) || row.referral_code !== code,
      );
      if (!verifiedOwnership || verifiedConflict) {
        return json({ ok: false, error: "Referral-code ownership could not be saved safely" }, 409);
      }
    }

    // Only pending, unfinalized attributions can be replaced by the latest Blobs record.
    const synced = await sql`
      INSERT INTO public.referral_attributions (
        referred_telegram_id,
        referrer_telegram_id,
        referral_code,
        source_status,
        attributed_at,
        synced_at
      ) VALUES (
        ${referredTelegramId},
        ${String(referrerTelegramId)},
        ${code},
        'pending',
        ${attributedAt}::timestamp,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (referred_telegram_id) DO UPDATE SET
        referrer_telegram_id = EXCLUDED.referrer_telegram_id,
        referral_code = EXCLUDED.referral_code,
        attributed_at = EXCLUDED.attributed_at,
        synced_at = CURRENT_TIMESTAMP
      WHERE public.referral_attributions.source_status = 'pending'
        AND public.referral_attributions.referred_user_id IS NULL
      RETURNING id
    `;

    if (synced.length === 0) {
      return json({ ok: true, status: "already_finalized" });
    }

    return json({ ok: true, status: "synced" });
  } catch (error) {
    console.error("Pending referral sync failed:", error);
    return json({ ok: false, error: "Referral sync failed. Please retry registration." }, 503);
  }
}
