import { InlineKeyboard } from "grammy";
import { startKeyboard } from "../ui.js";
import { config } from "../config.js";

export async function start(ctx) {
  const payload = typeof ctx.match === "string" ? ctx.match.trim() : null;

  if (payload?.startsWith("request_")) {
    const raw = payload.slice("request_".length);
    const chatId = Number(raw);

    if (!Number.isSafeInteger(chatId) || chatId >= 0) {
      return ctx.reply("❌ That access request link is invalid.");
    }

    return ctx.reply(
      `🔐 Access request\n\nChat ID: ${chatId}\n\nSubmit this request to the owner/admins?`,
      {
        reply_markup: new InlineKeyboard()
          .text("📤 Send Request", `request:submit:${chatId}`)
          .text("❌ Cancel", "request:cancel"),
      }
    );
  }

  return ctx.reply("Welcome! 🚀", {
    reply_markup: startKeyboard(config.miniAppUrl),
  });
}
