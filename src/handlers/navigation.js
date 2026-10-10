import { startKeyboard, helpKeyboard, commandsKeyboard } from "../ui.js";

const welcomeCaption =
  `🎮 <b>WELCOME TO 0MS ARENA</b>\n` +
  `━━━━━━━━━━━━━━━━━━\n\n` +
  `Your next match starts here. Explore tournaments, track your wallet ledger, and keep up with the arena from one place.\n\n` +
  `Choose where you want to go below.`;

async function editCurrentMessage(ctx, text, options) {
  const message = ctx.callbackQuery?.message;
  if (message?.caption !== undefined) {
    return ctx.editMessageCaption({ caption: text, ...options });
  }
  return ctx.editMessageText(text, options);
}

export async function handleNavigation(ctx, config, action) {
  switch (action) {
    case "help":
      return editCurrentMessage(ctx,
        `ℹ️ <b>0MS ARENA · HELP</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `Use the buttons to move around the bot.\n\n` +
        `🏆 <b>Launch Arena</b>\nOpen the tournament Mini App.\n\n` +
        `🤝 <b>Invite &amp; Earn</b>\nCreate and share your personal Telegram referral link. Referral tracking is available; tournament reward qualification is not yet connected.\n\n` +
        `📋 <b>Commands</b>\nSee the command list and admin tools.`,
        { parse_mode: "HTML", reply_markup: helpKeyboard() });

    case "commands":
      return editCurrentMessage(ctx,
        `📋 <b>0MS ARENA · COMMANDS</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `/start  · Open the main menu\n` +
        `/help  · Show help and navigation\n` +
        `/referral  · Open your referral dashboard\n` +
        `/referrals  · Alias for the referral dashboard\n` +
        `/rules  · Tournament rules and fair-play notes\n` +
        `/prizes  · Wallet and payout information\n` +
        `/request  · Request group access\n` +
        `/admin  · Open the admin control panel\n` +
        `/addadmin &lt;user_id&gt;  · Owner-only admin management\n` +
        `/ping  · Check bot responsiveness`,
        { parse_mode: "HTML", reply_markup: commandsKeyboard() });

    case "home":
      return editCurrentMessage(ctx, welcomeCaption, {
        parse_mode: "HTML",
        reply_markup: startKeyboard(config.miniAppUrl),
      });

    case "close":
      return ctx.editMessageReplyMarkup({ reply_markup: undefined });

    default:
      return;
  }
}
