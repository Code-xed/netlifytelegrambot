import { webhookCallback } from "grammy";
import { bot } from "../../src/app.js";

const handler = webhookCallback(bot, "std/http", {
  secretToken: process.env.WEBHOOK_SECRET,
});

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Bot is alive", { status: 200 });
  }

  return handler(req);
};
