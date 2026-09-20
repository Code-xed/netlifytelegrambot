export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Bot is alive", { status: 200 });
  }

  try {
    const update = JSON.parse(req.body);
    const botToken = Netlify.env.get("BOT_TOKEN");

    if (!botToken) {
      return new Response("BOT_TOKEN missing", { status: 500 });
    }

    // Handle normal messages
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      if (text === "/start") {
        const reply = "Welcome! 🚀";

        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: reply,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🚀 Open Mini App",
                      web_app: {
                        url: "https://tournament-api-yk90.onrender.com/"
                      }
                    }
                  ]
                ]
              }
            })
          }
        );
      }
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
};