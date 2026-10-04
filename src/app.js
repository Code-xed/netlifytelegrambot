import { Bot } from "grammy";
import { config } from "./config.js";
import { canUse } from "./access.js";
import { start } from "./handlers/start.js";
import { requestFromGroup, submitRequest } from "./handlers/request.js";
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

export const bot = new Bot(config.botToken);

bot.command("start", start);
bot.command("admin", showPanel);
bot.command("addadmin", async ctx => addAdmin(ctx, ctx.match));
bot.command("request", requestFromGroup);
bot.command("help", ctx => ctx.reply("Use /start to open the bot."));

bot.command("ping", async ctx => {
  if (!(await canUse(ctx))) return;
  await ctx.reply("Pong! 🏓");
});

// Admin callback routes.
bot.callbackQuery("admin:panel", panelCallback);
bot.callbackQuery("admin:requests", showRequests);
bot.callbackQuery("admin:chats", showChats);
bot.callbackQuery("admin:admins", showAdmins);
bot.callbackQuery("admin:add:help", adminAddHelp);
bot.callbackQuery("admin:mode", showMode);

bot.callbackQuery(/^request:submit:(-?\d+)$/, async ctx => {
  return submitRequest(ctx, Number(ctx.match[1]));
});

bot.callbackQuery(/^request:(approve|reject):(-?\d+)$/, async ctx => {
  return reviewRequest(ctx, ctx.match[1], Number(ctx.match[2]));
});

bot.callbackQuery(/^chat:remove:(-?\d+)$/, async ctx => {
  return removeChat(ctx, Number(ctx.match[1]));
});

bot.callbackQuery(/^admin:remove:(\d+)$/, async ctx => {
  return removeAdmin(ctx, Number(ctx.match[1]));
});

bot.callbackQuery(/^mode:(all|restricted)$/, async ctx => {
  return setMode(ctx, ctx.match[1]);
});

bot.callbackQuery("help:show", async ctx => {
  await ctx.answerCallbackQuery();
  return ctx.editMessageText(
    "ℹ️ Help\n\n/start - Open the bot\n/request - Request group access\n/admin - Open the admin panel\n/ping - Test the bot"
  );
});

bot.callbackQuery("request:cancel", async ctx => {
  await ctx.answerCallbackQuery();
  return ctx.editMessageText("❌ Request cancelled.");
});

// Central access gate for normal non-admin updates.
// Management commands/callbacks above are registered before this gate.
bot.use(async (ctx, next) => {
  if (await canUse(ctx)) return next();

  if (ctx.chat?.type !== "private" && ctx.message?.text?.startsWith("/")) {
    return ctx.reply(
      "🔒 This chat is not approved to use the bot.\n\nUse /request to request access."
    );
  }
});

bot.on("message:text", async ctx => {
  if (!(await canUse(ctx))) return;
  await ctx.reply(`You said: ${ctx.message.text}`);
});

bot.catch(err => {
  console.error("Unhandled bot error:", err.error);
});
