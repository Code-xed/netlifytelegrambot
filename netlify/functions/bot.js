export default async (req, context) => {
  // Telegram webhooks only send POST requests
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const update = await req.json();
    
    // Validate that the message payload exists
    if (!update.message || !update.message.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    
    // Securely read from environment variables (Never hardcode these!)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL;

    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN is missing in environment variables.");
      return new Response("Configuration Error", { status: 500 });
    }

    let replyText = "";
    let replyMarkup = null;

    // Handle basic bot commands
    switch (text) {
      case "/start":
        replyText = "👋 **Welcome!** I am your Netlify-hosted Telegram bot.\n\nTap the button below to launch our Mini App:";
        if (miniAppUrl) {
          replyMarkup = {
            inline_keyboard: [
              [
                {
                  text: "🚀 Open Mini App",
                  web_app: { url: miniAppUrl }
                }
              ]
            ]
          };
        }
        break;
      case "/stop":
        replyText = "🛑 Bot session paused. You can restart anytime by typing /start.";
        break;
      case "/help":
        replyText = "🤖 **Available Commands:**\n\n/start - Initialize the bot & open Mini App\n/stop - Pause interaction\n/help - View command list\n/rules - Check group guidelines";
        break;
      case "/rules":
        replyText = "📜 **Community Rules:**\n1. Be respectful and kind.\n2. No spam, scams, or unsolicited ads.\n3. Keep conversations relevant.";
        break;
      default:
        replyText = "❓ I didn't recognize that command. Type /help to see available options.";
        break;
    }

    // Build the request body for Telegram
    const telegramBody = {
      chat_id: chatId,
      text: replyText,
      parse_mode: "Markdown"
    };

    if (replyMarkup) {
      telegramBody.reply_markup = replyMarkup;
    }

    // Send the response back to Telegram via Telegram Bot API
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
