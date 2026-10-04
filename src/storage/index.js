import { getStore } from "@netlify/blobs";

const stores = {
  settings: "bot-settings",
  admins: "bot-admins",
  chats: "bot-chats",
  requests: "bot-requests",
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

  requests: {
    async get(chatId) {
      return getJson(stores.requests, String(chatId));
    },
    async create(chat, requestedBy) {
      const existing = await this.get(chat.id);
      if (existing?.status === "pending") return existing;

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
      return request;
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
};
