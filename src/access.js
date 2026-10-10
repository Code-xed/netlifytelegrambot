import { config } from "./config.js";
import { storage } from "./storage/index.js";

export async function isOwner(userId) {
  return Number(userId) === config.ownerId;
}

export async function isAdmin(userId) {
  if (await isOwner(userId)) return true;
  return storage.admins.has(userId);
}

export async function canUse(ctx) {
  const userId = ctx.from?.id;
  if (userId && await isOwner(userId)) return true;
  if (userId && await storage.admins.has(userId)) return true;

  // Private chats remain usable for the access/request workflow.
  if (ctx.chat?.type === "private") return true;

  const settings = await storage.settings.get();

  if (settings.accessMode === "all") return true;

  return Boolean(await storage.chats.get(ctx.chat.id));
}

export async function requireAdmin(ctx) {
  return Boolean(ctx.from && await isAdmin(ctx.from.id));
}

export function modeLabel(mode) {
  return mode === "all" ? "🌍 All" : "🔒 Restricted";
}
