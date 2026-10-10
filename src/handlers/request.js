import { InlineKeyboard } from "grammy";
import { storage } from "../storage/index.js";
import { config } from "../config.js";
import { requestReviewKeyboard } from "../ui.js";
import { escapeHtml } from "../referral-utils.js";

async function replyOrEdit(ctx, text, options = {}) {
  if (ctx.callbackQuery) return ctx.editMessageText(text, options);
  return ctx.reply(text, options);
}

async function replyGroupStatus(ctx, text, options = {}) {
  if (!(await storage.requestPrompts.canRespond(ctx.chat.id))) return;
  const sent = await ctx.reply(text, options);
  await storage.requestPrompts.markResponded(ctx.chat.id);
  return sent;
}

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
    return replyGroupStatus(
      ctx,
      "🌍 Access is open. No approval is needed for this group.",
    );
  }

  if (await storage.chats.get(ctx.chat.id)) {
    return replyGroupStatus(ctx, "✅ This chat is already approved.");
  }

  const pendingRequest = await storage.requests.get(ctx.chat.id);
  if (pendingRequest?.status === "pending") {
    return replyGroupStatus(ctx, "📨 An access request is already pending. No need to submit it again.");
  }

  const me = await ctx.api.getMe();

  const deepLink =
    `https://t.me/${me.username}?start=request_${ctx.chat.id}`;

  return replyGroupStatus(
    ctx,
    "🔐 This chat needs approval. Use the button to request access privately.",
    {
      reply_markup: new InlineKeyboard().url("📩 REQUEST ACCESS", deepLink),
    },
  );
}

export async function submitRequest(ctx, chatId) {
  const settings = await storage.settings.get();

  if (settings.accessMode === "all") {
    return replyOrEdit(
      ctx,
      "🌍 Access mode is All. No approval is required."
    );
  }

  let chat;
  try {
    chat = await ctx.api.getChat(chatId);
  } catch (error) {
    console.error(`Could not access group ${chatId} for an access request:`, error);
    return replyOrEdit(
      ctx,
      "❌ I couldn't access that group. Make sure the bot is still in the group and that the chat ID is correct, then try again."
    );
  }

  if (!["group", "supergroup"].includes(chat.type)) {
    return replyOrEdit(
      ctx,
      "❌ That chat is not a group."
    );
  }

  const creation = await storage.requests.create(chat, ctx.from);
  const request = creation.request;

  if (!creation.created) {
    return replyOrEdit(
      ctx,
      "📨 An access request for this group is already pending. No duplicate notification was sent.",
    );
  }

  if (request.status !== "pending") {
    return replyOrEdit(ctx, `This request is already ${request.status}.`);
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
    `💬 ${escapeHtml(chat.title || "Untitled group")}\n` +
    `🆔 <code>${chat.id}</code>\n` +
    `👤 Requested by: ${escapeHtml(requester)}`;

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

  return replyOrEdit(
    ctx,
    "📨 Request submitted.\n\n" +
    "The owner/admins will review it."
  );
}