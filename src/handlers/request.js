import { InlineKeyboard } from "grammy";
import { storage } from "../storage/index.js";
import { config } from "../config.js";
import {
  requestKeyboard,
  requestReviewKeyboard,
} from "../ui.js";

export async function requestFromGroup(ctx) {
  if (!ctx.chat || ctx.chat.type === "private") {
    const arg =
      typeof ctx.match === "string"
        ? ctx.match.trim()
        : "";

    const chatId = Number(arg);

    if (Number.isSafeInteger(chatId) && chatId < 0) {
      return submitRequest(ctx, chatId);
    }

    return ctx.reply(
      "Add me to the group first, then send /request there."
    );
  }

  const settings = await storage.settings.get();

  if (settings.accessMode === "all") {
    return ctx.reply(
      "🌍 Access mode is All. This chat does not need approval."
    );
  }

  if (await storage.chats.get(ctx.chat.id)) {
    return ctx.reply(
      "✅ This chat is already approved."
    );
  }

  const me = await ctx.api.getMe();

  const deepLink =
    `https://t.me/${me.username}?start=request_${ctx.chat.id}`;

  return ctx.reply(
    "🔐 This chat is not approved yet.\n\n" +
    "Open my private chat and submit an access request for this group.",
    {
      reply_markup: new InlineKeyboard()
        .url("📩  REQUEST ACCESS", deepLink),
    }
  );
}

export async function submitRequest(ctx, chatId) {
  const settings = await storage.settings.get();

  if (settings.accessMode === "all") {
    return ctx.editMessageText(
      "🌍 Access mode is All. No approval is required."
    );
  }

  const chat = await ctx.api.getChat(chatId);

  if (!["group", "supergroup"].includes(chat.type)) {
    return ctx.editMessageText(
      "❌ That chat is not a group."
    );
  }

  const request =
    await storage.requests.create(
      chat,
      ctx.from
    );

  if (request.status !== "pending") {
    return ctx.editMessageText(
      `This request is already ${request.status}.`
    );
  }

  const admins =
    await storage.admins.list();

  const recipients = new Set([
    config.ownerId,
    ...admins.map(admin => admin.userId),
  ]);

  const requester = ctx.from.username
    ? `@${ctx.from.username}`
    : ctx.from.first_name ||
      String(ctx.from.id);

  const text =
    `🔔 <b>New bot access request</b>\n\n` +
    `💬 ${chat.title || "Untitled group"}\n` +
    `🆔 ${chat.id}\n` +
    `👤 Requested by: ${requester}`;

  for (const userId of recipients) {
    try {
      await ctx.api.sendMessage(
        userId,
        text,
        {
          parse_mode: "HTML",
          reply_markup:
            requestReviewKeyboard(chat.id),
        }
      );
    } catch (error) {
      console.error(
        `Could not notify admin ${userId}`,
        error
      );
    }
  }

  return ctx.editMessageText(
    "📨 Request submitted.\n\n" +
    "The owner/admins will review it."
  );
}