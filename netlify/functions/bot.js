export default async (req, context) => {
  // Telegram webhooks only send POST requests
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const update = await req.json();
    
    // Validate message payload
    if (!update.message || !update.message.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const chatType = update.message.chat.type; // "private", "group", "supergroup", etc.
    const text = update.message.text.trim();
    
    // Environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL;
    const allowedGroupId = process.env.TELEGRAM_ALLOWED_GROUP_ID;

    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN is missing.");
      return new Response("Configuration Error", { status: 500 });
    }

    // Access Control Logic:
    // Allow if it's a private DM OR if it matches your designated allowed group ID
    const isPrivate = chatType === "private";
    const isAllowedGroup = allowedGroupId && chatId.toString() === allowedGroupId.toString();

    if (!isPrivate && !isAllowedGroup) {
      // Ignore messages from any other unapproved group/channel
      return new Response("OK", { status: 200 });
    }

    let replyText = "";
    let replyMarkup = null;

    // Handle tournament platform commands
    switch (text) {
      case "/start":
        replyText = "🎮 **Welcome to 0ms Arena!**\n\nCompete in high-stakes mobile tournaments, track your wallet ledger, and win real prizes.\n\nTap below to launch the platform:";
        if (miniAppUrl) {
          replyMarkup = {
            inline_keyboard: [
              [
                {
                  text: "🏆 Open Tournament App",
                  web_app: { url: miniAppUrl }
                }
              ]
            ]
          };
        }
        break;

      case "/help":
        replyText = "🤖 **0ms Arena Commands:**\n\n/start - Launch the tournament platform\n/rules - View competitive rules & fair play\n/prizes - Learn about wallet credits & payouts";
        break;

      case "/rules":
        replyText = "📜 **Tournament Rules:**\n1. **Game UID:** Correct UID submission is mandatory for match placement.\n2. **Match Rooms:** Credentials are secure and visible only to authorized joined players.\n3. **Fair Play:** Zero tolerance for cheating or emulation abuse.\n4. **KYC:** Required for processing cash withdrawals.";
        break;

      case "/prizes":
        replyText = "🪙 **Wallets & Payouts:**\n- Entry fees are deducted safely via your internal ledger.\n- Prizes are credited automatically upon match completion.\n- Withdrawals are processed following KYC verification.";
        break;

      default:
        // In DMs, you can guide them. In groups, keep it quiet unless it's a valid command.
        if (isPrivate) {
          replyText = "❓ Unknown command. Type /help to see available platform options.";
        } else {
          return new Response("OK", { status: 200 });
        }
        break;
    }

    const telegramBody = {
      chat_id: chatId,
      text: replyText,
      parse_mode: "Markdown"
    };

    if (replyMarkup) {
      telegramBody.reply_markup = replyMarkup;
    }

    // Send response back to Telegram
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telegramBody)
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing Telegram update:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
