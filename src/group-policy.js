const GROUP_TYPES = new Set(["group", "supergroup"]);
const GROUP_COMMANDS = new Set(["request", "help", "rules", "prizes", "ping"]);

export function getChatType(ctx) {
  return ctx.chat?.type ?? ctx.callbackQuery?.message?.chat?.type ?? null;
}

export function isGroupChatType(type) {
  return GROUP_TYPES.has(type);
}

export function getCommandName(ctx) {
  const text = ctx.message?.text;
  if (typeof text !== "string") return null;
  const match = text.match(/^\/([a-z0-9_]+)(?:@[a-z0-9_]+)?(?:\s|$)/i);
  return match ? match[1].toLowerCase() : null;
}

export function isGroupCommandAllowed(commandName) {
  return GROUP_COMMANDS.has(String(commandName ?? "").toLowerCase());
}
