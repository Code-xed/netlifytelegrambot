import { getStore } from "@netlify/blobs";
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

      const userKey = `user:${id}`;
      const existing = await getJson(stores.referrals, userKey);
      if (existing?.code && isValidReferralCode(existing.code)) return existing.code;

      // Random 48-bit codes are short enough for Telegram deep links and hard to guess.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = randomBytes(6).toString("hex");
        const occupied = await getJson(stores.referrals, `code:${code}`);
        if (occupied && Number(occupied.userId) !== id) continue;

        const record = { userId: id, code, createdAt: Date.now() };
        await setJson(stores.referrals, `code:${code}`, record);
        await setJson(stores.referrals, userKey, record);
        return code;
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
        const codeRecord = await getJson(stores.referrals, `code:${code}`);
        if (!codeRecord || !Number.isSafeInteger(Number(codeRecord.userId))) {
          return { status: "invalid_code" };
        }
        if (Number(codeRecord.userId) === id) {
          result = { status: "self_referral" };
        } else if (existingAttribution?.status === "finalized") {
          result = {
            status: "already_finalized",
            referrerId: existingAttribution.referrerId,
          };
        } else {
          const attribution = {
            referredUserId: id,
            referrerId: Number(codeRecord.userId),
            code,
            attributedAt: Date.now(),
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
