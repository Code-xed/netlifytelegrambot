import { InlineKeyboard } from "grammy";
import { safeEditMessage } from "../telegram-utils.js";
import { storage } from "../storage/index.js";
import { config } from "../config.js";
import { isAdmin, modeLabel } from "../access.js";
import { escapeHtml } from "../referral-utils.js";

import {
  mainAdminKeyboard,
  modeKeyboard,
  requestReviewKeyboard,
  chatListKeyboard,
  adminListKeyboard,
} from "../ui.js";

function chatTitle(request) {
  return escapeHtml(request.title || request.chatId);
}

function panelText(settings) {
  const mode =
    settings.accessMode === "all"
      ? "🌍 ALL"
      : "🔒 RESTRICTED";

  return (
    `⚙️ <b>0MS ARENA CONTROL CENTER</b>\n\n` +
    `🛡 <b>ACCESS CONTROL</b>\n` +
    `Current mode: ${mode}\n\n` +
    `Choose a section below.`
  );
}

export async function showPanel(ctx) {
  if (ctx.chat?.type !== "private") return;
  if (!ctx.from || !await isAdmin(ctx.from.id)) {
    return ctx.reply("⛔ Admins only.");
  }

  const settings = await storage.settings.get();

  return ctx.reply(
    panelText(settings),
    {
      parse_mode: "HTML",
      reply_markup: mainAdminKeyboard(
        settings.accessMode
      ),
    }
  );
}

export async function panelCallback(ctx) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({
      text: "Not authorized.",
      show_alert: true,
    });
  }

  const settings = await storage.settings.get();

  await safeEditMessage(ctx, "editMessageText", 
    panelText(settings),
    {
      parse_mode: "HTML",
      reply_markup: mainAdminKeyboard(
        settings.accessMode
      ),
    }
  );

  return ctx.answerCallbackQuery();
}

export async function showRequests(ctx) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({
      text: "Not authorized.",
      show_alert: true,
    });
  }

  const requests = await storage.requests.list("pending");

  if (!requests.length) {
    await safeEditMessage(ctx, "editMessageText", 
      `📥 <b>PENDING REQUESTS</b>\n\n` +
      `✅ No pending access requests.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text(
            "⬅️  BACK",
            "admin:panel"
          )
          .text(
            "🏠  HOME",
            "nav:home"
          )
          .row()
          .text(
            "✖️  CLOSE",
            "nav:close"
          ),
      }
    );

    return ctx.answerCallbackQuery();
  }

  const first = requests[0];

  await safeEditMessage(ctx, "editMessageText", 
    `📥 <b>PENDING REQUESTS</b>\n\n` +
    `📊 ${requests.length} pending\n\n` +
    `💬 ${chatTitle(first)}\n` +
    `🆔 ${first.chatId}\n` +
    `👤 ${
      escapeHtml(first.requestedBy.name ||
      first.requestedBy.username ||
      first.requestedBy.id)
    }`,
    {
      parse_mode: "HTML",
      reply_markup: requestReviewKeyboard(
        first.chatId
      ),
    }
  );

  return ctx.answerCallbackQuery();
}

export async function reviewRequest(
  ctx,
  action,
  chatId
) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({
      text: "Not authorized.",
      show_alert: true,
    });
  }

  const request =
    await storage.requests.get(chatId);

  if (!request) {
    return ctx.answerCallbackQuery({
      text: "Request not found.",
      show_alert: true,
    });
  }

  if (request.status !== "pending") {
    return ctx.answerCallbackQuery({
      text: `Already ${request.status}.`,
      show_alert: true,
    });
  }

  if (action === "approve") {
    await storage.chats.approve(
      {
        id: request.chatId,
        title: request.title,
        type: request.type,
      },
      ctx.from.id
    );

    await storage.requests.setStatus(
      request.chatId,
      "approved",
      ctx.from.id
    );

    try {
      await ctx.api.sendMessage(
        request.chatId,
        "🎉 Bot access approved!\n\n" +
        "You can now use the bot in this chat."
      );
    } catch (error) {
      console.error(
        "Could not notify approved chat:",
        error
      );
    }

    await safeEditMessage(ctx, "editMessageText", 
      `✅ <b>REQUEST APPROVED</b>\n\n` +
      `💬 ${chatTitle(request)}\n` +
      `🆔 ${request.chatId}`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text(
            "⬅️  PENDING REQUESTS",
            "admin:requests"
          )
          .row()
          .text(
            "🏠  HOME",
            "admin:panel"
          )
          .text(
            "✖️  CLOSE",
            "nav:close"
          ),
      }
    );
  } else {
    await storage.requests.setStatus(
      request.chatId,
      "rejected",
      ctx.from.id
    );

    try {
      await ctx.api.sendMessage(
        request.chatId,
        "❌ The bot access request for this chat was rejected."
      );
    } catch (error) {
      console.error(
        "Could not notify rejected chat:",
        error
      );
    }

    await safeEditMessage(ctx, "editMessageText", 
      `❌ <b>REQUEST REJECTED</b>\n\n` +
      `💬 ${chatTitle(request)}\n` +
      `🆔 ${request.chatId}`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text(
            "⬅️  PENDING REQUESTS",
            "admin:requests"
          )
          .row()
          .text(
            "🏠  HOME",
            "admin:panel"
          )
          .text(
            "✖️  CLOSE",
            "nav:close"
          ),
      }
    );
  }

  return ctx.answerCallbackQuery();
}

export async function showChats(ctx, callbackNotice = "") {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({
      text: "Not authorized.",
      show_alert: true,
    });
  }

  const chats = await storage.chats.list();

  const chatText = chats.length
    ? chats
        .map(
          (chat, index) =>
            `${index + 1}. 💬 ${
              escapeHtml(chat.title || "Unnamed chat")
            }\n` +
            `   🆔 ${chat.chatId}`
        )
        .join("\n\n")
    : "No approved chats.";

  await safeEditMessage(ctx, "editMessageText", 
    `💬 <b>APPROVED CHATS</b>\n\n${chatText}`,
    {
      parse_mode: "HTML",
      reply_markup: chatListKeyboard(chats),
    }
  );

  return ctx.answerCallbackQuery(callbackNotice ? { text: callbackNotice } : {});
}

export async function removeChat(ctx, chatId) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({
      text: "Not authorized.",
      show_alert: true,
    });
  }

  await storage.chats.remove(chatId);

  return showChats(ctx, "Chat removed.");
}

export async function showAdmins(ctx) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({
      text: "Not authorized.",
      show_alert: true,
    });
  }

  const admins = await storage.admins.list();

  const adminText = admins.length
    ? admins
        .map(
          (admin, index) =>
            `${index + 1}. 👤 <code>${admin.userId}</code>`
        )
        .join("\n")
    : "No additional administrators.";

  await safeEditMessage(ctx, "editMessageText", 
    `👥 <b>ADMINISTRATORS</b>\n\n` +
    `👑 Owner: ${config.ownerId}\n\n` +
    adminText,
    {
      parse_mode: "HTML",
      reply_markup: adminListKeyboard(admins),
    }
  );

  return ctx.answerCallbackQuery();
}

export async function showMode(ctx) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({
      text: "Not authorized.",
      show_alert: true,
    });
  }

  const settings =
    await storage.settings.get();

  await safeEditMessage(ctx, "editMessageText", 
    `🔐 <b>ACCESS CONTROL</b>\n\n` +
    `Current mode: ${modeLabel(
      settings.accessMode
    )}\n\n` +
    `🌍 <b>ALL</b>\n` +
    `Anyone can use the bot in any chat.\n\n` +
    `🔒 <b>RESTRICTED</b>\n` +
    `Only approved chats can use the bot.\n\n` +
    `Select a mode:`,
    {
      parse_mode: "HTML",
      reply_markup: modeKeyboard(
        settings.accessMode
      ),
    }
  );

  return ctx.answerCallbackQuery();
}

export async function setMode(ctx, mode) {
  if (!await isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery({
      text: "Not authorized.",
      show_alert: true,
    });
  }

  if (!["all", "restricted"].includes(mode)) {
    return ctx.answerCallbackQuery({
      text: "Invalid mode.",
      show_alert: true,
    });
  }

  await storage.settings.set({
    accessMode: mode,
  });

  await safeEditMessage(ctx, "editMessageText", 
    panelText({
      accessMode: mode,
    }),
    {
      parse_mode: "HTML",
      reply_markup: mainAdminKeyboard(mode),
    }
  );

  return ctx.answerCallbackQuery({
    text:
      mode === "all"
        ? "🌍 Access set to ALL."
        : "🔒 Access set to RESTRICTED.",
  });
}

export async function addAdmin(
  ctx,
  userId
) {
  if (ctx.chat?.type !== "private") return;
  if (!ctx.from || Number(ctx.from.id) !== config.ownerId) {
    return ctx.reply(
      "⛔ Only the owner can add administrators."
    );
  }

  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return ctx.reply(
      "Usage:\n/addadmin <numeric Telegram user ID>"
    );
  }

  if (id === config.ownerId) {
    return ctx.reply(
      "👑 That user is already the owner."
    );
  }

  await storage.admins.add(
    id,
    ctx.from.id
  );

  return ctx.reply(
    `✅ Administrator added.\n\n` +
    `👤 User ID: ${id}`
  );
}

export async function removeAdmin(
  ctx,
  userId
) {
  if (Number(ctx.from.id) !== config.ownerId) {
    return ctx.answerCallbackQuery({
      text:
        "Only the owner can manage administrators.",
      show_alert: true,
    });
  }

  if (Number(userId) === config.ownerId) {
    return ctx.answerCallbackQuery({
      text:
        "The owner cannot be removed.",
      show_alert: true,
    });
  }

  await storage.admins.remove(userId);

  return showAdmins(ctx);
}

export async function adminAddHelp(ctx) {
  if (Number(ctx.from.id) !== config.ownerId) {
    return ctx.answerCallbackQuery({
      text:
        "Only the owner can add administrators.",
      show_alert: true,
    });
  }

  await ctx.answerCallbackQuery();

  return ctx.reply(
    `➕ <b>ADD ADMINISTRATOR</b>\n\n` +
    `Send the command:\n\n` +
    `/addadmin &lt;Telegram user ID&gt;\n\n` +
    `Example:\n` +
    `/addadmin 123456789\n\n` +
    `The ID must be numeric.`,
    {
      parse_mode: "HTML",
    }
  );
}