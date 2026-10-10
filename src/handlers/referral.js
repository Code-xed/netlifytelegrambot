import { InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { storage } from "../storage/index.js";

let cachedBotUsername = config.botUsername || null;

async function getBotUsername(ctx) {
  if (cachedBotUsername) return cachedBotUsername;
  const me = await ctx.api.getMe();
  if (!me.username) throw new Error("Telegram bot has no username");
  cachedBotUsername = me.username;
  return cachedBotUsername;
}

export async function showReferral(ctx) {
  if (!ctx.from) return;
  if (ctx.chat?.type !== "private") {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: "Open the bot in a private chat." });
    else await ctx.reply("Open the bot in a private chat to view your referral link.");
    return;
  }

  if (ctx.callbackQuery) await ctx.answerCallbackQuery();

  const referral = await storage.referrals.getOrCreateCode(ctx.from);
  const username = await getBotUsername(ctx);
  const link = `https://t.me/${username}?start=ref_${referral.code}`;
  const stats = await storage.referrals.stats(ctx.from.id);
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Join me on 0ms Arena!")}`;

  const text =
    `👥 <b>Your 0ms Arena referrals</b>\n\n` +
    `Share your personal link to invite people to the bot:\n` +
    `<code>${link}</code>\n\n` +
    `👤 <b>Recorded Telegram sign-ups:</b> ${stats.total}\n\n` +
    `A person is counted when they open the bot through your link for the first time. ` +
    `The first valid referral attribution is kept.\n\n` +
    `ℹ️ This currently tracks Telegram referrals only. Tournament qualification and reward payments are not connected yet.`;

  const keyboard = new InlineKeyboard()
    .url("📨 Share referral link", shareUrl)
    .row()
    .text("🔄 Refresh", "referral:show")
    .text("🏠 Home", "nav:home");

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageCaption({ caption: text, parse_mode: "HTML", reply_markup: keyboard });
      return;
    } catch (error) {
      // If the source message is not a photo/caption, fall back to a new message.
      if (!String(error?.description || error?.message || "").includes("message is not modified")) {
        await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
        return;
      }
      return;
    }
  }

  await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
}
