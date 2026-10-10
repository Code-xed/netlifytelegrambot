export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const update = await req.json();
    console.log("Incoming update from Telegram:", JSON.stringify(update));
    
    if (!update.message || !update.message.text) {
      console.log("Skipping: Update does not contain a text message.");
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const chatType = update.message.chat.type; 
    const text = update.message.text.trim();
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : "";
    const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL ? process.env.TELEGRAM_MINI_APP_URL.trim() : "";
    const allowedGroupId = process.env.TELEGRAM_ALLOWED_GROUP_ID ? process.env.TELEGRAM_ALLOWED_GROUP_ID.trim() : "";

    console.log(`Parsed Chat ID: ${chatId} | Chat Type: ${chatType} | Allowed Group ID: ${allowedGroupId} | Text: ${text}`);

    if (!botToken) {
      console.error("CRITICAL: TELEGRAM_BOT_TOKEN is missing.");
      return new Response("Configuration Error", { status: 500 });
    }

    const isPrivate = chatType === "private";
    const isAllowedGroup = allowedGroupId && chatId.toString() === allowedGroupId;

    console.log(`Access Check -> isPrivate: ${isPrivate}, isAllowedGroup: ${isAllowedGroup}`);

    if (!isPrivate && !isAllowedGroup) {
      console.log("BLOCKED: Message came from an unauthorized chat/group.");
      return new Response("OK", { status: 200 });
    }

    let replyText = "";
    let replyMarkup = null;

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

    console.log("Sending reply to Telegram API...");
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telegramBody)
    });

    const responseData = await telegramResponse.json();
    console.log("Telegram API Response:", JSON.stringify(responseData));

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Function error encountered:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
