// Compatibility endpoint retained for deployments that previously used /bot.
// Both webhook endpoints intentionally share the same grammY app so features,
// referral attribution, access control, and admin behavior cannot drift apart.
import { webhookCallback } from "grammy";
import { bot } from "../../src/app.js";

const handler = webhookCallback(bot, "std/http", {
  secretToken: process.env.WEBHOOK_SECRET,
});

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("0ms Arena bot is alive", { status: 200 });
  }
  return handler(req);
};
