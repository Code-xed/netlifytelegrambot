import { Bot, InputFile } from "grammy";
import { config } from "./config.js";
import { canUse } from "./access.js";
import { getChatType, getCommandName, isGroupChatType, isGroupCommandAllowed } from "./group-policy.js";
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
import { safeEditMessage } from "./telegram-utils.js";

export const bot = new Bot(config.botToken);

/*
 * Group interaction policy:
 * - Ordinary group messages are never answered.
 * - Only explicit commands can trigger group replies.
 * - /request remains available in unapproved groups.
 * - Personal/admin menus stay in private chats.
 * - Inline keyboards posted in a group cannot trigger menu workflows.
 * - Restricted groups receive no public denial spam.
 */
bot.use(async (ctx, next) => {
  const chatType = getChatType(ctx);
  if (!isGroupChatType(chatType)) return next();

  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery({
        text: "Open the bot in a private chat to use menus.",
      });
    } catch (error) {
      console.error("Could not acknowledge group callback:", error);
    }
    return;
  }

  const commandName = getCommandName(ctx);
  if (!commandName) return next();

  // This is the single intentional command available to request access.
  if (commandName === "request") return next();

  // Only this small, intentional allowlist can ever produce a group reply.
  // Unknown commands, private dashboards, and admin controls are silent.
  // Each permitted command applies its own access check where required.
  if (!isGroupCommandAllowed(commandName)) return;

  return next();
});

bot.command("start", start);
bot.command(["referral", "referrals"], showReferral);

bot.command("admin", showPanel);

bot.command("addadmin", async ctx => {
  return addAdmin(ctx, ctx.match);
});

bot.command("request", requestFromGroup);

bot.command("help", async ctx => {
  if (!(await canUse(ctx))) return;

  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    return ctx.reply(
      "Group commands: /rules, /prizes, /ping. Use /request only if this group needs bot access. Open the bot privately for menus.",
    );
  }

  const helpCaption =
    `ℹ️ <b>0MS ARENA · HELP</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `Use the buttons below to navigate the bot.\n\n` +
    `🏆 <b>Launch Arena</b>\n` +
    `Open the tournament Mini App.\n\n` +
    `🤝 <b>Invite &amp; Earn</b>\n` +
    `Create and share your personal Telegram referral link.\n\n` +
    `📋 <b>Commands</b>\n` +
    `View available commands and admin tools.`;
  const helpOptions = { caption: helpCaption, parse_mode: "HTML", reply_markup: helpKeyboard() };
  try {
    await ctx.replyWithPhoto(new InputFile(new URL("https://0msarena.netlify.app/welcome.png")), helpOptions);
  } catch (error) {
    console.error("Help image could not be sent; falling back to text:", error);
    await ctx.reply(helpCaption, { parse_mode: "HTML", reply_markup: helpKeyboard() });
  }
});

bot.command("rules", async ctx => {
  if (!(await canUse(ctx))) return;
  return ctx.reply(
    `📜 <b>TOURNAMENT RULES</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🆔 <b>Game UID:</b> Submit the correct UID so match placement can be handled properly.\n\n` +
    `🔐 <b>Match rooms:</b> Room credentials should only be shared with the players assigned to that match.\n\n` +
    `⚖️ <b>Fair play:</b> Cheating, exploit abuse, and unauthorized tools are not acceptable.\n\n` +
    `🪪 <b>Withdrawals:</b> KYC may be required before a cash withdrawal is processed.`,
    { parse_mode: "HTML" },
  );
});

bot.command("prizes", async ctx => {
  if (!(await canUse(ctx))) return;
  return ctx.reply(
    `🪙 <b>WALLETS &amp; PAYOUTS</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `• Tournament entry fees are handled through the platform's wallet ledger.\n` +
    `• Prizes are credited according to the tournament's completion and result rules.\n` +
    `• Withdrawals may require identity verification.\n\n` +
    `<i>For your current balance and transaction details, open the 0ms Arena Mini App.</i>`,
    { parse_mode: "HTML" },
  );
});

bot.command("ping", async ctx => {
  if (!(await canUse(ctx))) return;
  return ctx.reply("🏓 Pong! 0ms Arena is responding.");
});


/*
 * =========================
 * ADMIN CALLBACK ROUTES
 * =========================
 */

bot.callbackQuery("referral:open", showReferral);
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

  return safeEditMessage(ctx, "editMessageText",
    "❌ Request cancelled."
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