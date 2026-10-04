import { InlineKeyboard } from "grammy";
import { storage } from "../storage/index.js";
import { config } from "../config.js";
import { isAdmin, modeLabel } from "../access.js";
import {
  mainAdminKeyboard,
  modeKeyboard,
  requestReviewKeyboard,
  chatListKeyboard,
  adminListKeyboard,
} from "../ui.js";

function chatTitle(request) {
  return request.title || request.chatId;
}

export async function showPanel(ctx) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.reply("⛔ Admins only.");
  }

  const settings = await storage.settings.get();

  return ctx.reply(
    `⚙️ BOT CONTROL PANEL\n\nAccess mode: ${modeLabel(settings.accessMode)}`,
    { reply_markup: mainAdminKeyboard(settings.accessMode) }
  );
}

export async function panelCallback(ctx) {
  if (!await isAdmin(ctx.from.id)) return ctx.answerCallbackQuery({ text: "Not authorized.", show_alert: true });

  const settings = await storage.settings.get();

  await ctx.editMessageText(
    `⚙️ BOT CONTROL PANEL\n\nAccess mode: ${modeLabel(settings.accessMode)}`,
    { reply_markup: mainAdminKeyboard(settings.accessMode) }
  );
  return ctx.answerCallbackQuery();
}

export async function showRequests(ctx) {
  if (!await isAdmin(ctx.from.id)) return ctx.answerCallbackQuery({ text: "Not authorized.", show_alert: true });

  const requests = await storage.requests.list("pending");

  if (!requests.length) {
    await ctx.editMessageText("📥 Pending Requests\n\nNo pending requests.", {
      reply_markup: new InlineKeyboard().text("⬅️ Back", "admin:panel"),
    });
    return ctx.answerCallbackQuery();
  }

  const first = requests[0];

  await ctx.editMessageText(
    `📥 Pending Requests: ${requests.length}\n\n` +
    `💬 ${chatTitle(first)}\n` +
    `🆔 ${first.chatId}\n` +
    `👤 ${first.requestedBy.name || first.requestedBy.username || first.requestedBy.id}`,
    { reply_markup: requestReviewKeyboard(first.chatId) }
  );

  return ctx.answerCallbackQuery();
}

export async function reviewRequest(ctx, action, chatId) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({ text: "Not authorized.", show_alert: true });
  }

  const request = await storage.requests.get(chatId);
  if (!request) {
    return ctx.answerCallbackQuery({ text: "Request not found.", show_alert: true });
  }

  if (request.status !== "pending") {
    return ctx.answerCallbackQuery({ text: `Already ${request.status}.`, show_alert: true });
  }

  if (action === "approve") {
    await storage.chats.approve(
      { id: request.chatId, title: request.title, type: request.type },
      ctx.from.id
    );
    await storage.requests.setStatus(request.chatId, "approved", ctx.from.id);

    try {
      await ctx.api.sendMessage(
        request.chatId,
        "🎉 Bot access approved! You can now use the bot in this chat."
      );
    } catch (error) {
      console.error("Could not notify approved chat:", error);
    }

    await ctx.editMessageText(`✅ Approved\n\n${chatTitle(request)}\n${request.chatId}`, {
      reply_markup: new InlineKeyboard().text("⬅️ Requests", "admin:requests"),
    });
  } else {
    await storage.requests.setStatus(request.chatId, "rejected", ctx.from.id);

    try {
      await ctx.api.sendMessage(
        request.chatId,
        "❌ The bot access request for this chat was rejected."
      );
    } catch (error) {
      console.error("Could not notify rejected chat:", error);
    }

    await ctx.editMessageText(`❌ Rejected\n\n${chatTitle(request)}\n${request.chatId}`, {
      reply_markup: new InlineKeyboard().text("⬅️ Requests", "admin:requests"),
    });
  }

  return ctx.answerCallbackQuery();
}

export async function showChats(ctx) {
  if (!await isAdmin(ctx.from.id)) return ctx.answerCallbackQuery({ text: "Not authorized.", show_alert: true });

  const chats = await storage.chats.list();

  await ctx.editMessageText(
    `✅ Approved Chats\n\n${chats.length ? chats.map(c => `• ${c.title} (${c.chatId})`).join("\n") : "No approved chats."}`,
    { reply_markup: chatListKeyboard(chats) }
  );

  return ctx.answerCallbackQuery();
}

export async function removeChat(ctx, chatId) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({ text: "Not authorized.", show_alert: true });
  }

  await storage.chats.remove(chatId);

  await ctx.answerCallbackQuery({ text: "Chat removed." });
  return showChats(ctx);
}

export async function showAdmins(ctx) {
  if (!await isAdmin(ctx.from.id)) return ctx.answerCallbackQuery({ text: "Not authorized.", show_alert: true });

  const admins = await storage.admins.list();

  await ctx.editMessageText(
    `👥 Administrators\n\n${admins.length ? admins.map(a => `• ${a.userId}`).join("\n") : "No additional admins."}`,
    { reply_markup: adminListKeyboard(admins) }
  );

  return ctx.answerCallbackQuery();
}

export async function showMode(ctx) {
  if (!await isAdmin(ctx.from.id)) return ctx.answerCallbackQuery({ text: "Not authorized.", show_alert: true });

  const settings = await storage.settings.get();

  await ctx.editMessageText(
    `🌍 Access Mode\n\nCurrent: ${modeLabel(settings.accessMode)}\n\nChoose a new mode:`,
    { reply_markup: modeKeyboard() }
  );

  return ctx.answerCallbackQuery();
}

export async function setMode(ctx, mode) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({ text: "Not authorized.", show_alert: true });
  }

  if (!["all", "restricted"].includes(mode)) {
    return ctx.answerCallbackQuery({ text: "Invalid mode.", show_alert: true });
  }

  await storage.settings.set({ accessMode: mode });

  await ctx.editMessageText(
    `⚙️ BOT CONTROL PANEL\n\nAccess mode: ${modeLabel(mode)}`,
    { reply_markup: mainAdminKeyboard(mode) }
  );

  return ctx.answerCallbackQuery({ text: `Mode changed to ${mode}.` });
}

export async function addAdmin(ctx, userId) {
  if (Number(ctx.from.id) !== config.ownerId) {
    return ctx.reply("⛔ Only the owner can add administrators.");
  }

  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return ctx.reply("Usage: /addadmin <numeric Telegram user ID>");
  }

  if (id === config.ownerId) {
    return ctx.reply("That user is already the owner.");
  }

  await storage.admins.add(id, ctx.from.id);
  return ctx.reply(`✅ Administrator added: ${id}`);
}

export async function removeAdmin(ctx, userId) {
  if (Number(ctx.from.id) !== config.ownerId) {
    return ctx.answerCallbackQuery({ text: "Only the owner can manage administrators.", show_alert: true });
  }

  if (Number(userId) === config.ownerId) {
    return ctx.answerCallbackQuery({ text: "The owner cannot be removed.", show_alert: true });
  }

  await storage.admins.remove(userId);
  return showAdmins(ctx);
}

export async function adminAddHelp(ctx) {
  if (Number(ctx.from.id) !== config.ownerId) {
    return ctx.answerCallbackQuery({ text: "Only the owner can add administrators.", show_alert: true });
  }

  await ctx.answerCallbackQuery();
  return ctx.reply("➕ Add administrator\n\nUse:\n/addadmin <Telegram user ID>\n\nThe user ID must be numeric.");
}
