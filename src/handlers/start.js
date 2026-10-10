import { InlineKeyboard, InputFile } from "grammy";
import { startKeyboard } from "../ui.js";
import { config } from "../config.js";
import { storage } from "../storage/index.js";
import { normalizeReferralPayload } from "../referral-utils.js";

const WELCOME_IMAGE_URL = "https://0msarena.netlify.app/welcome.png";

function welcomeCaption(referralStatus = null) {
  const referralNote = referralStatus === "attributed"
    ? "\n\n🎉 <b>Referral recorded!</b> Welcome to the arena."
    : referralStatus === "self_referral"
      ? "\n\nℹ️ You cannot use your own referral link."
      : referralStatus === "invalid_code"
        ? "\n\nℹ️ That referral link could not be verified. You can still use the platform normally."
        : referralStatus === "already_registered"
          ? "\n\nℹ️ Your Mini App account is already registered, so this link cannot add a referral retroactively."
          : referralStatus === "unavailable"
            ? "\n\n⚠️ The referral could not be saved right now. Please retry using the same link shortly."
            : "";

  return (
    `🎮 <b>WELCOME TO 0MS ARENA</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `Your next match starts here. Explore tournaments, track your wallet ledger, and keep up with the arena from one place.\n\n` +
    `Choose where you want to go below.` +
    referralNote
  );
}

async function showWelcome(ctx, referralStatus = null) {
  const options = {
    caption: welcomeCaption(referralStatus),
    parse_mode: "HTML",
    reply_markup: startKeyboard(config.miniAppUrl),
  };

  try {
    return await ctx.replyWithPhoto(new InputFile(new URL(WELCOME_IMAGE_URL)), options);
  } catch (error) {
    console.error("Welcome image could not be sent; falling back to text:", error);
    return ctx.reply(welcomeCaption(referralStatus), {
      parse_mode: "HTML",
      reply_markup: startKeyboard(config.miniAppUrl),
    });
  }
}

export async function start(ctx) {
  // /start is a private onboarding flow. Never post welcome cards into groups.
  if (ctx.chat?.type !== "private") return;

  const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";

  if (payload.startsWith("request_")) {
    // This flow is not a referral signup, but opening it marks the user as seen
    // so a later referral link cannot retroactively claim an existing bot user.
    if (ctx.from && !ctx.from.is_bot) {
      try { await storage.referrals.recordStart(ctx.from.id); }
      catch (error) { console.error("Could not mark user start:", error); }
    }

    const raw = payload.slice("request_".length);
    const chatId = Number(raw);
    if (!Number.isSafeInteger(chatId) || chatId >= 0) {
      return ctx.reply("❌ That access request link is invalid.");
    }

    return ctx.reply(
      `🔐 <b>GROUP ACCESS REQUEST</b>\n\n` +
      `Chat ID: <code>${chatId}</code>\n\n` +
      `Submit this request to the owner/admins?`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("📤  SEND REQUEST", `request:submit:${chatId}`)
          .row()
          .text("❌  CANCEL", "request:cancel"),
      },
    );
  }

  let referralStatus = null;
  if (ctx.from && !ctx.from.is_bot) {
    let rawReferral = null;
    try {
      const code = normalizeReferralPayload(payload);
      rawReferral = payload.startsWith("ref_") ? (code || payload) : null;
      const result = await storage.referrals.recordStart(ctx.from.id, rawReferral);
      referralStatus = result.status;
    } catch (error) {
      console.error("Referral attribution could not be recorded:", error);
      if (rawReferral) referralStatus = "unavailable";
    }
  }

  return showWelcome(ctx, referralStatus);
}
