import {
  startKeyboard,
  helpKeyboard,
  commandsKeyboard,
} from "../ui.js";

export async function handleNavigation(ctx, config, action) {
  switch (action) {
    case "help":
      return ctx.editMessageCaption({
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
      });

    case "commands":
      return ctx.editMessageCaption({
        caption:
          `📋 <b>Commands</b>\n\n` +
          `/start - Open the main menu\n` +
          `/help - Show help\n` +
          `/referral - Get your referral link and stats\n` +
          `/request - Request group access\n` +
          `/admin - Open the admin panel\n` +
          `/ping - Check bot status`,
        parse_mode: "HTML",
        reply_markup: commandsKeyboard(),
      });

    case "home":
      return ctx.editMessageCaption({
        caption:
          `🎮 <b>Welcome to 0ms Arena!</b>\n\n` +
          `Compete in high-stakes mobile tournaments, track your wallet ledger, and win real prizes.\n\n` +
          `Tap below to launch the platform:`,
        parse_mode: "HTML",
        reply_markup: startKeyboard(config.miniAppUrl),
      });

    case "close":
      return ctx.editMessageReplyMarkup({
        reply_markup: undefined,
      });

    default:
      return;
  }
}