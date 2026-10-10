import { InlineKeyboard } from "grammy";

const MAX_LABEL = 32;

function shorten(value, max = MAX_LABEL) {
  const text = String(value ?? "").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

// Keep the established Telegram button colours: primary launch action and red
// danger buttons for the existing navigation/admin actions.
export function startKeyboard(miniAppUrl) {
  const kb = new InlineKeyboard();
  if (miniAppUrl) kb.webApp("🚀  OPEN MINI APP", miniAppUrl).primary().row();
  kb
    .text("🤝  INVITE & EARN", "referral:open")
    .row()
    .text("ℹ️  HELP", "nav:help")
    .danger()
    .text("📋  COMMANDS", "nav:commands")
    .danger()
    .row()
    .text("✖️  CLOSE", "nav:close");
  return kb;
}

export function navigationKeyboard(back = "nav:home") {
  return new InlineKeyboard()
    .text("⬅️  BACK", back)
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");
}

export function helpKeyboard() {
  return navigationKeyboard();
}

export function commandsKeyboard() {
  return navigationKeyboard();
}

export function referralKeyboard(referralUrl) {
  const kb = new InlineKeyboard();
  if (referralUrl) {
    kb.url(
      "📤  SHARE YOUR LINK",
      `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent("Join me on 0ms Arena!")}`,
    ).primary().row();
  }
  return kb
    .text("🔄  REFRESH STATS", "referral:open")
    .danger()
    .row()
    .text("🏠  HOME", "nav:home")
    .text("✖️  CLOSE", "nav:close");
}

export function mainAdminKeyboard(accessMode) {
  const mode = accessMode === "all" ? "🌍 ALL" : "🔒 RESTRICTED";
  return new InlineKeyboard()
    .text("📥  PENDING REQUESTS", "admin:requests")
    .danger()
    .row()
    .text("💬  APPROVED CHATS", "admin:chats")
    .danger()
    .row()
    .text("👥  ADMINISTRATORS", "admin:admins")
    .danger()
    .row()
    .text(`🔐  ACCESS MODE: ${mode}`, "admin:mode")
    .danger()
    .row()
    .text("🔄  REFRESH CONTROL PANEL", "admin:panel")
    .danger()
    .row()
    .text("🏠  HOME", "nav:home")
    .text("✖️  CLOSE", "nav:close");
}

export function modeKeyboard(currentMode = "restricted") {
  const kb = new InlineKeyboard();
  if (currentMode === "all") {
    kb.text("✅  🌍  ALL", "mode:all").danger().row()
      .text("🔒  RESTRICTED", "mode:restricted").danger();
  } else {
    kb.text("🌍  ALL", "mode:all").danger().row()
      .text("✅  🔒  RESTRICTED", "mode:restricted").danger();
  }
  return kb
    .row()
    .text("⬅️  BACK", "admin:panel")
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");
}

export function requestKeyboard(chatId) {
  return new InlineKeyboard()
    .text("📤  SEND ACCESS REQUEST", `request:submit:${chatId}`)
    .danger()
    .row()
    .text("❌  CANCEL REQUEST", "request:cancel");
}

export function requestReviewKeyboard(chatId) {
  return new InlineKeyboard()
    .text("✅  APPROVE REQUEST", `request:approve:${chatId}`)
    .danger()
    .row()
    .text("❌  REJECT REQUEST", `request:reject:${chatId}`)
    .danger()
    .row()
    .text("⬅️  BACK", "admin:requests")
    .text("🏠  HOME", "admin:panel")
    .row()
    .text("✖️  CLOSE", "nav:close");
}

export function chatListKeyboard(chats) {
  const kb = new InlineKeyboard();
  if (!chats.length) {
    return kb.text("⬅️  BACK", "admin:panel")
      .text("🏠  HOME", "nav:home")
      .row()
      .text("✖️  CLOSE", "nav:close");
  }
  for (const chat of chats.slice(0, 30)) {
    kb.text(`🗑️  REMOVE ${shorten(chat.title || chat.chatId)}`, `chat:remove:${chat.chatId}`)
      .danger().row();
  }
  return kb
    .text("⬅️  BACK", "admin:panel")
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");
}

export function adminListKeyboard(admins) {
  const kb = new InlineKeyboard()
    .text("➕  ADD ADMINISTRATOR", "admin:add:help")
    .danger()
    .row();
  if (!admins.length) {
    return kb.text("⬅️  BACK", "admin:panel")
      .text("🏠  HOME", "nav:home")
      .row()
      .text("✖️  CLOSE", "nav:close");
  }
  for (const admin of admins.slice(0, 30)) {
    kb.text(`🗑️  REMOVE ADMIN ${admin.userId}`, `admin:remove:${admin.userId}`)
      .danger().row();
  }
  return kb
    .text("⬅️  BACK", "admin:panel")
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");
}

export function simpleBackKeyboard(callback = "nav:home") {
  return new InlineKeyboard()
    .text("⬅️  BACK", callback)
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");
}
