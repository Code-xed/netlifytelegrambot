import { InlineKeyboard, InputFile } from "grammy";
import { startKeyboard } from "../ui.js";
import { config } from "../config.js";
import { storage } from "../storage/index.js";

const WELCOME_IMAGE_URL =
  "https://0msarena.netlify.app/welcome.png";

export async function start(ctx) {
  const payload =
    typeof ctx.match === "string"
      ? ctx.match.trim()
      : null;

  if (payload?.startsWith("request_")) {
    const raw = payload.slice("request_".length);
    const chatId = Number(raw);

    if (!Number.isSafeInteger(chatId) || chatId >= 0) {
      return ctx.reply(
        "❌ That access request link is invalid."
      );
    }

    return ctx.reply(
      `🔐 Access request\n\n` +
      `Chat ID: ${chatId}\n\n` +
      `Submit this request to the owner/admins?`,
      {
        reply_markup: new InlineKeyboard()
          .text(
            "📤 Send Request",
            `request:submit:${chatId}`
          )
          .text(
            "❌ Cancel",
            "request:cancel"
          ),
      }
    );
  }

  let referralNotice = "";
  if (payload?.startsWith("ref_")) {
    const code = payload.slice("ref_".length);
    const result = await storage.referrals.attribute(ctx.from, code);
    if (result.status === "attributed") {
      referralNotice = "\n\n🎉 Referral link recognized. Your invitation has been recorded.";
    } else if (result.status === "already_attributed") {
      referralNotice = "\n\nℹ️ Your referral was already recorded earlier.";
    } else if (result.status === "self_referral") {
      referralNotice = "\n\nℹ️ You cannot use your own referral link.";
    } else if (result.status === "invalid_code") {
      referralNotice = "\n\nℹ️ This referral link is invalid.";
    }
  }

  return ctx.replyWithPhoto(
  new InputFile(new URL(WELCOME_IMAGE_URL)),
    {
      caption:
        `🎮 <b>Welcome to 0ms Arena!</b>\n\n` +
        `Compete in high-stakes mobile tournaments, ` +
        `track your wallet ledger, and win real prizes.\n\n` +
        `Tap below to launch the platform:` + referralNotice,
      parse_mode: "HTML",
      reply_markup: startKeyboard(
        config.miniAppUrl
      ),
    }
  );
}