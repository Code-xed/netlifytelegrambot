function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

export const config = {
  botToken: required("BOT_TOKEN"),
  ownerId: Number(required("OWNER_ID")),
  webhookSecret: required("WEBHOOK_SECRET"),
  miniAppUrl: process.env.MINI_APP_URL || "",
};

if (!Number.isSafeInteger(config.ownerId)) {
  throw new Error("OWNER_ID must be a numeric Telegram user ID");
}
