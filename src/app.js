import { Bot } from "grammy";
import { config } from "./config.js";
import { canUse } from "./access.js";
import { start } from "./handlers/start.js";
import { requestFromGroup, submitRequest } from "./handlers/request.js";
import { handleNavigation } from "./handlers/navigation.js";
import { showReferral } from "./handlers/referral.js";

import {
  showPanel,
  panelCallback,
  showRequests,
  reviewRequest,
  showChats,
  removeChat,
  showAdmins,
  showMode,
  setMode,
  removeAdmin,
  addAdmin,
  adminAddHelp,
} from "./handlers/admin.js";

import { helpKeyboard } from "./ui.js";

export const bot = new Bot(config.botToken);

bot.command("start", start);

bot.command("admin", showPanel);
bot.command(["referral", "referrals"], showReferral);

bot.command("addadmin", async ctx => {
  return addAdmin(ctx, ctx.match);
});

bot.command("request", requestFromGroup);

bot.command("help", async ctx => {
  if (!(await canUse(ctx))) return;

  await ctx.replyWithPhoto(
    "https://0msarena.netlify.app/welcome.png",
    {
      caption:
        `ℹ️ <b>Help</b>\n\n` +
        `Welcome to 0ms Arena!\n\n` +
        `Use the buttons below to navigate the bot.\n\n` +
        `🚀 <b>Open Mini App</b>\n` +
        `Launch the 0ms Arena platform.\n\n` +
        `📋 <b>Commands</b>\n` +
        `View all available bot commands.`,
      parse_mode: "HTML",
      reply_markup: helpKeyboard(),
    }
  );
});

bot.command("ping", async ctx => {
  if (!(await canUse(ctx))) return;

  await ctx.reply("Pong! 🏓");
});


/*
 * =========================
 * ADMIN CALLBACK ROUTES
 * =========================
 */

bot.callbackQuery("referral:show", showReferral);
bot.callbackQuery("admin:panel", panelCallback);
bot.callbackQuery("admin:requests", showRequests);
bot.callbackQuery("admin:chats", showChats);
bot.callbackQuery("admin:admins", showAdmins);
bot.callbackQuery("admin:add:help", adminAddHelp);
bot.callbackQuery("admin:mode", showMode);


/*
 * =========================
 * REQUEST CALLBACK ROUTES
 * =========================
 */

bot.callbackQuery(/^request:submit:(-?\d+)$/, async ctx => {
  return submitRequest(
    ctx,
    Number(ctx.match[1])
  );
});

bot.callbackQuery(
  /^request:(approve|reject):(-?\d+)$/,
  async ctx => {
    return reviewRequest(
      ctx,
      ctx.match[1],
      Number(ctx.match[2])
    );
  }
);


/*
 * =========================
 * CHAT CALLBACK ROUTES
 * =========================
 */

bot.callbackQuery(/^chat:remove:(-?\d+)$/, async ctx => {
  return removeChat(
    ctx,
    Number(ctx.match[1])
  );
});


/*
 * =========================
 * ADMIN MANAGEMENT
 * =========================
 */

bot.callbackQuery(/^admin:remove:(\d+)$/, async ctx => {
  return removeAdmin(
    ctx,
    Number(ctx.match[1])
  );
});


/*
 * =========================
 * ACCESS MODE
 * =========================
 */

bot.callbackQuery(
  /^mode:(all|restricted)$/,
  async ctx => {
    return setMode(
      ctx,
      ctx.match[1]
    );
  }
);


/*
 * =========================
 * NAVIGATION
 * =========================
 */

bot.callbackQuery(
  /^nav:(help|commands|home|close)$/,
  async ctx => {
    await ctx.answerCallbackQuery();

    return handleNavigation(
      ctx,
      config,
      ctx.match[1]
    );
  }
);


/*
 * =========================
 * REQUEST CANCEL
 * =========================
 */

bot.callbackQuery("request:cancel", async ctx => {
  await ctx.answerCallbackQuery();

  return ctx.editMessageText(
    "❌ Request cancelled."
  );
});


/*
 * =========================
 * ACCESS GATE
 * =========================
 *
 * Management commands/callbacks above
 * are registered before this gate.
 */

bot.use(async (ctx, next) => {
  if (await canUse(ctx)) {
    return next();
  }

  if (
    ctx.chat?.type !== "private" &&
    ctx.message?.text?.startsWith("/")
  ) {
    return ctx.reply(
      "🔒 This chat is not approved to use the bot.\n\n" +
      "Use /request to request access."
    );
  }
});


/*
 * =========================
 * NORMAL TEXT MESSAGES
 * =========================
 */

bot.on("message:text", async ctx => {
  if (!(await canUse(ctx))) return;

  await ctx.reply(
    `You said: ${ctx.message.text}`
  );
});


/*
 * =========================
 * ERROR HANDLER
 * =========================
 */

bot.catch(err => {
  console.error(
    "Unhandled bot error:",
    err.error
  );
});