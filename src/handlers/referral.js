import { storage } from "../storage/index.js";
import { safeEditMessage } from "../telegram-utils.js";
import { canUse } from "../access.js";
import { referralKeyboard } from "../ui.js";
import { escapeHtml, referralStartLink } from "../referral-utils.js";
import { config } from "../config.js";

async function getReferralLink(ctx) {
  const code = await storage.referrals.getOrCreateCode(ctx.from.id);
  const username = config.botUsername || (await ctx.api.getMe()).username;
  return { code, url: referralStartLink(username, code) };
}

async function editOrReply(ctx, text, options) {
  if (ctx.callbackQuery) {
    const message = ctx.callbackQuery.message;
    if (message?.caption !== undefined) {
      return safeEditMessage(ctx, "editMessageCaption", { caption: text, ...options });
    }
    return safeEditMessage(ctx, "editMessageText", text, options);
  }
  return ctx.reply(text, options);
}

export async function showReferral(ctx) {
  if (!ctx.from || ctx.from.is_bot) {
    if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text: "This menu is for user accounts.", show_alert: true });
    return;
  }
  if (!(await canUse(ctx))) {
    if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text: "Not authorized.", show_alert: true });
    return;
  }
  // Referral data is personal. Group commands are intentionally silent;
  // the same dashboard remains available from the private bot chat.
  if (ctx.chat?.type !== "private") {
    if (ctx.callbackQuery) {
      return ctx.answerCallbackQuery({ text: "Open the bot privately to manage referrals." });
    }
    return;
  }

  try {
    const [{ code, url }, stats] = await Promise.all([
      getReferralLink(ctx),
      storage.referrals.stats(ctx.from.id),
    ]);

    const text =
      `🤝 <b>0MS ARENA · REFERRAL HUB</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `Invite friends to discover 0ms Arena. Your personal link is below:\n\n` +
      `🔗 <code>${escapeHtml(url)}</code>\n\n` +
      `👥 <b>Invites tracked:</b> ${stats.total}\n` +
      `🪪 <b>Your code:</b> <code>${escapeHtml(code)}</code>\n\n` +
      `<i>Tracking note: this dashboard records Telegram referral attribution. Tournament qualification and reward payouts are not connected yet, so no reward is promised or credited here.</i>`;

    await editOrReply(ctx, text, {
      parse_mode: "HTML",
      reply_markup: referralKeyboard(url),
      link_preview_options: { is_disabled: true },
    });
    if (ctx.callbackQuery) await ctx.answerCallbackQuery();
  } catch (error) {
    console.error("Could not load referral dashboard:", error);
    if (ctx.callbackQuery) {
      return ctx.answerCallbackQuery({ text: "Referral dashboard unavailable. Try again shortly.", show_alert: true });
    }
    return ctx.reply("The referral dashboard is temporarily unavailable. Please try again shortly.");
  }
}
