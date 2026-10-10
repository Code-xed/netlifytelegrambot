import { getStore } from "@netlify/blobs";
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
import { isValidReferralCode } from "../referral-utils.js";

const stores = {
  settings: "bot-settings",
  admins: "bot-admins",
  chats: "bot-chats",
  requests: "bot-requests",
  requestPrompts: "bot-request-prompts",
  referrals: "bot-referrals",
};

function store(name) {
  return getStore({
    name,
    consistency: "strong",
  });
}

let neonClient;

function getNeonClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for referral operations.");
  }
  if (!neonClient) neonClient = neon(connectionString);
  return neonClient;
}

function sqlTimestamp(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function timestampMillis(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : Date.now();
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

async function findNeonCodeRecords(sql, telegramId, code) {
  return sql`
    SELECT telegram_user_id, referral_code, created_at
    FROM public.referral_codes
    WHERE telegram_user_id = ${String(telegramId)}
       OR referral_code = ${code}
    LIMIT 2
  `;
}

async function ensureNeonCodeOwnership(sql, telegramId, code, createdAt = null) {
  const id = String(telegramId);
  const normalizedCode = String(code).toLowerCase();
  const existing = await findNeonCodeRecords(sql, id, normalizedCode);
  const ownerRecord = existing.find(row => String(row.telegram_user_id) === id);
  const codeRecord = existing.find(row => row.referral_code === normalizedCode);

  if (ownerRecord) {
    if (ownerRecord.referral_code !== normalizedCode) {
      throw new Error("This Telegram account already has a different permanent referral code in Neon.");
    }
    if (codeRecord && String(codeRecord.telegram_user_id) !== id) {
      throw new Error("Referral-code ownership conflicts with Neon.");
    }
    return ownerRecord;
  }

  if (codeRecord && String(codeRecord.telegram_user_id) !== id) {
    throw new Error("This referral code is already owned by another Telegram user in Neon.");
  }

  const createdTimestamp = sqlTimestamp(createdAt);
  if (createdTimestamp) {
    await sql`
      INSERT INTO public.referral_codes (telegram_user_id, referral_code, created_at)
      VALUES (${id}, ${normalizedCode}, ${createdTimestamp}::timestamp)
      ON CONFLICT DO NOTHING
    `;
  } else {
    await sql`
      INSERT INTO public.referral_codes (telegram_user_id, referral_code)
      VALUES (${id}, ${normalizedCode})
      ON CONFLICT DO NOTHING
    `;
  }

  const verified = await findNeonCodeRecords(sql, id, normalizedCode);
  const verifiedOwner = verified.find(row => String(row.telegram_user_id) === id);
  const verifiedCode = verified.find(row => row.referral_code === normalizedCode);
  if (
    !verifiedOwner ||
    verifiedOwner.referral_code !== normalizedCode ||
    (verifiedCode && String(verifiedCode.telegram_user_id) !== id)
  ) {
    throw new Error("Referral-code ownership could not be saved safely in Neon.");
  }
  return verifiedOwner;
}

async function findNeonCodeByOwner(sql, telegramId) {
  const rows = await sql`
    SELECT telegram_user_id, referral_code, created_at
    FROM public.referral_codes
    WHERE telegram_user_id = ${String(telegramId)}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function saveBlobCodeRecords(id, code, createdAt = Date.now()) {
  const occupied = await getJson(stores.referrals, `code:${code}`);
  if (occupied && Number(occupied.userId) !== Number(id)) {
    throw new Error("Referral-code ownership conflicts with existing Netlify Blobs data.");
  }
  const record = { userId: Number(id), code, createdAt: timestampMillis(createdAt) };
  await setJson(stores.referrals, `code:${code}`, record);
  await setJson(stores.referrals, `user:${id}`, record);
}

async function getJson(name, key) {
  return store(name).get(key, { type: "json", consistency: "strong" });
}

async function setJson(name, key, value) {
  return store(name).setJSON(key, value);
}

export const storage = {
  settings: {
    async get() {
      const value = await getJson(stores.settings, "global");
      return value ?? { accessMode: "restricted" };
    },
    async set(value) {
      return setJson(stores.settings, "global", value);
    },
  },

  admins: {
    async has(userId) {
      return Boolean(await getJson(stores.admins, String(userId)));
    },
    async add(userId, addedBy) {
      return setJson(stores.admins, String(userId), {
        userId: Number(userId),
        addedBy: Number(addedBy),
        addedAt: Date.now(),
      });
    },
    async remove(userId) {
      return store(stores.admins).delete(String(userId));
    },
    async list() {
      const { blobs } = await store(stores.admins).list({ prefix: "" });
      const result = [];
      for (const blob of blobs) {
        const item = await getJson(stores.admins, blob.key);
        if (item) result.push(item);
      }
      return result;
    },
  },

  chats: {
    async get(chatId) {
      return getJson(stores.chats, String(chatId));
    },
    async approve(chat, approvedBy) {
      return setJson(stores.chats, String(chat.id), {
        chatId: Number(chat.id),
        title: chat.title || chat.username || String(chat.id),
        type: chat.type,
        approvedBy: Number(approvedBy),
        approvedAt: Date.now(),
      });
    },
    async remove(chatId) {
      return store(stores.chats).delete(String(chatId));
    },
    async list() {
      const { blobs } = await store(stores.chats).list({ prefix: "" });
      const result = [];
      for (const blob of blobs) {
        const item = await getJson(stores.chats, blob.key);
        if (item) result.push(item);
      }
      return result;
    },
  },

  requestPrompts: {
    async canRespond(chatId, cooldownMs = 60_000) {
      const record = await getJson(stores.requestPrompts, String(chatId));
      return !record?.respondedAt || Date.now() - record.respondedAt >= cooldownMs;
    },
    async markResponded(chatId) {
      return setJson(stores.requestPrompts, String(chatId), {
        chatId: Number(chatId),
        respondedAt: Date.now(),
      });
    },
  },

  requests: {
    async get(chatId) {
      return getJson(stores.requests, String(chatId));
    },
    async create(chat, requestedBy) {
      const existing = await this.get(chat.id);
      if (existing?.status === "pending") {
        return { request: existing, created: false };
      }

      const request = {
        chatId: Number(chat.id),
        title: chat.title || chat.username || String(chat.id),
        type: chat.type,
        requestedBy: {
          id: Number(requestedBy.id),
          username: requestedBy.username || null,
          name: [requestedBy.first_name, requestedBy.last_name].filter(Boolean).join(" "),
        },
        requestedAt: Date.now(),
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
      };

      await setJson(stores.requests, String(chat.id), request);
      return { request, created: true };
    },
    async setStatus(chatId, status, reviewedBy) {
      const request = await this.get(chatId);
      if (!request) return null;

      const updated = {
        ...request,
        status,
        reviewedBy: Number(reviewedBy),
        reviewedAt: Date.now(),
      };

      await setJson(stores.requests, String(chatId), updated);
      return updated;
    },
    async list(status = null) {
      const { blobs } = await store(stores.requests).list({ prefix: "" });
      const result = [];
      for (const blob of blobs) {
        const item = await getJson(stores.requests, blob.key);
        if (item && (!status || item.status === status)) result.push(item);
      }
      return result.sort((a, b) => b.requestedAt - a.requestedAt);
    },
  },

  referrals: {
    async getOrCreateCode(userId) {
      const id = Number(userId);
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error("A valid Telegram user ID is required to create a referral code.");
      }

      const sql = getNeonClient();
      const dbOwner = await findNeonCodeByOwner(sql, id);
      if (dbOwner) {
        const canonicalCode = String(dbOwner.referral_code).toLowerCase();
        if (!isValidReferralCode(canonicalCode)) {
          throw new Error("The permanent referral code in Neon is invalid.");
        }
        const localRecord = await getJson(stores.referrals, `user:${id}`);
        await saveBlobCodeRecords(
          id,
          canonicalCode,
          localRecord?.code === canonicalCode ? localRecord.createdAt : timestampMillis(dbOwner.created_at),
        );
        return canonicalCode;
      }

      const localRecord = await getJson(stores.referrals, `user:${id}`);
      const preferredCode = localRecord?.code && isValidReferralCode(localRecord.code)
        ? localRecord.code.toLowerCase()
        : null;

      // Preserve existing Blobs-generated codes whenever Neon has no conflicting owner.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = attempt === 0 && preferredCode
          ? preferredCode
          : randomBytes(6).toString("hex");
        const codeRows = await sql`
          SELECT telegram_user_id, referral_code
          FROM public.referral_codes
          WHERE referral_code = ${code}
          LIMIT 1
        `;
        if (codeRows.length && String(codeRows[0].telegram_user_id) !== String(id)) {
          continue;
        }

        try {
          const record = await ensureNeonCodeOwnership(
            sql,
            id,
            code,
            attempt === 0 && preferredCode ? localRecord.createdAt : Date.now(),
          );
          await saveBlobCodeRecords(id, code, record.created_at ?? localRecord?.createdAt ?? Date.now());
          return code;
        } catch (error) {
          // A conflicting code can be replaced with a fresh code, but its owner is never reassigned.
          if (attempt === 0 && preferredCode && /different permanent referral code|already owned by another|ownership conflicts/i.test(error.message)) {
            continue;
          }
          throw error;
        }
      }

      throw new Error("Could not allocate a unique referral code. Please retry.");
    },

    async recordStart(userId, rawCode = null) {
      const id = Number(userId);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return { status: "invalid_user" };
      }

      // Invalid links must not consume the user's first touch or replace a
      // previously valid pending referral.
      if (rawCode && !isValidReferralCode(rawCode)) {
        return { status: "invalid_code" };
      }

      const seenKey = `seen:${id}`;
      const seen = await getJson(stores.referrals, seenKey);
      const attributionKey = `attribution:${id}`;
      const existingAttribution = await getJson(stores.referrals, attributionKey);

      // A user who was already seen organically cannot be claimed retroactively.
      // Once a pending referral exists, however, a later valid referral replaces it.
      if (seen && (!rawCode || !existingAttribution)) {
        return { status: "already_seen" };
      }

      let result = { status: "organic" };
      if (rawCode) {
        const code = rawCode.toLowerCase();
        const blobCodeRecord = await getJson(stores.referrals, `code:${code}`);
        const sql = getNeonClient();
        const neonCodeRows = await sql`
          SELECT telegram_user_id, referral_code, created_at
          FROM public.referral_codes
          WHERE referral_code = ${code}
          LIMIT 1
        `;
        const neonCodeRecord = neonCodeRows[0] ?? null;

        // Neon is authoritative. Blobs provides a migration fallback for codes created before this integration.
        const referrerId = neonCodeRecord
          ? Number(neonCodeRecord.telegram_user_id)
          : Number(blobCodeRecord?.userId);
        if (
          !Number.isSafeInteger(referrerId) ||
          referrerId <= 0 ||
          (blobCodeRecord && Number(blobCodeRecord.userId) !== referrerId && neonCodeRecord)
        ) {
          return { status: "invalid_code" };
        }
        if (!neonCodeRecord && !blobCodeRecord) {
          return { status: "invalid_code" };
        }
        if (neonCodeRecord && !blobCodeRecord) {
          await saveBlobCodeRecords(referrerId, code, neonCodeRecord.created_at);
        }

        if (referrerId === id) {
          result = { status: "self_referral" };
        } else if (existingAttribution?.status === "finalized") {
          result = {
            status: "already_finalized",
            referrerId: existingAttribution.referrerId,
          };
        } else {
          // A Telegram account that already registered in the Mini App cannot be attributed retroactively.
          const registeredUsers = await sql`
            SELECT id
            FROM public."user"
            WHERE telegram_id = ${String(id)}
            LIMIT 1
          `;
          if (registeredUsers.length > 0) {
            if (!seen) {
              await setJson(stores.referrals, seenKey, { userId: id, firstSeenAt: Date.now() });
            }
            return { status: "already_registered" };
          }

          // The incoming code must be permanently owned by this referrer in Neon.
          if (!neonCodeRecord) {
            try {
              await ensureNeonCodeOwnership(
                sql,
                referrerId,
                code,
                blobCodeRecord.createdAt,
              );
            } catch (error) {
              if (/different permanent referral code|already owned by another|ownership conflicts/i.test(error.message)) {
                return { status: "invalid_code" };
              }
              throw error;
            }
          }

          const attributedAt = Date.now();
          const timestamp = sqlTimestamp(attributedAt);
          const synced = await sql`
            INSERT INTO public.referral_attributions (
              referred_telegram_id,
              referrer_telegram_id,
              referral_code,
              source_status,
              attributed_at,
              synced_at
            ) VALUES (
              ${String(id)},
              ${String(referrerId)},
              ${code},
              'pending',
              ${timestamp}::timestamp,
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
            const current = await sql`
              SELECT source_status, referred_user_id
              FROM public.referral_attributions
              WHERE referred_telegram_id = ${String(id)}
              LIMIT 1
            `;
            if (current.length && (
              current[0].source_status !== "pending" || current[0].referred_user_id != null
            )) {
              return { status: "already_finalized" };
            }
            throw new Error("Referral attribution could not be saved in Neon.");
          }

          const attribution = {
            referredUserId: id,
            referrerId,
            code,
            attributedAt,
            status: "pending",
          };

          if (existingAttribution && Number(existingAttribution.referrerId) !== attribution.referrerId) {
            await store(stores.referrals).delete(
              `by-referrer:${existingAttribution.referrerId}:${id}`,
            );
          }
          await setJson(stores.referrals, attributionKey, attribution);
          await setJson(
            stores.referrals,
            `by-referrer:${attribution.referrerId}:${id}`,
            attribution,
          );
          result = {
            status: "attributed",
            referrerId: attribution.referrerId,
            replaced: Boolean(existingAttribution),
          };
        }
      }

      // Preserve the original first-seen timestamp on later referral visits.
      if (!seen) {
        await setJson(stores.referrals, seenKey, { userId: id, firstSeenAt: Date.now() });
      }
      return result;
    },

    async stats(userId) {
      const id = Number(userId);
      const { blobs } = await store(stores.referrals).list({ prefix: `by-referrer:${id}:` });
      const referrals = [];
      for (const blob of blobs) {
        const item = await getJson(stores.referrals, blob.key);
        if (item && Number(item.referrerId) === id) referrals.push(item);
      }
      referrals.sort((a, b) => a.attributedAt - b.attributedAt);
      return { total: referrals.length, referrals };
    },
  },
};
