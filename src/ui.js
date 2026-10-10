import { InlineKeyboard } from "grammy";

const MAX_LABEL = 32;

function shorten(text, max = MAX_LABEL) {
  const value = String(text ?? "").trim();

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 1)}…`;
}

/*
 * Main start keyboard
 *
 * ┌──────────────────────────────┐
 * │       🚀 OPEN MINI APP       │
 * ├──────────────┬───────────────┤
 * │   ℹ️ HELP    │  📋 COMMANDS  │
 * ├──────────────┴───────────────┤
 * │           ✖️ CLOSE           │
 * └──────────────────────────────┘
 */
export function startKeyboard(miniAppUrl) {
  const kb = new InlineKeyboard();

  if (miniAppUrl) {
    kb
      .webApp("🚀  OPEN MINI APP", miniAppUrl)
      .primary()
      .row();
  }

  kb
    .text("👥  REFERRALS", "referral:show")
    .row()
    .text("ℹ️  HELP", "nav:help")
    .danger()
    .text("📋  COMMANDS", "nav:commands")
    .danger()
    .row()
    .text("✖️  CLOSE", "nav:close");

  return kb;
}

/*
 * Generic navigation
 *
 * ┌───────────────┬───────────────┐
 * │   ⬅️ BACK     │   🏠 HOME     │
 * ├───────────────┴───────────────┤
 * │           ✖️ CLOSE            │
 * └───────────────────────────────┘
 */
export function navigationKeyboard(back = "nav:home") {
  return new InlineKeyboard()
    .text("⬅️  BACK", back)
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");
}

/*
 * Help screen navigation
 */
export function helpKeyboard() {
  return navigationKeyboard();
}

/*
 * Commands screen navigation
 */
export function commandsKeyboard() {
  return navigationKeyboard();
}

/*
 * Admin control panel
 */
export function mainAdminKeyboard(accessMode) {
  const mode =
    accessMode === "all"
      ? "🌍 ALL"
      : "🔒 RESTRICTED";

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

/*
 * Access mode selector
 */
export function modeKeyboard(currentMode = "restricted") {
  const kb = new InlineKeyboard();

  if (currentMode === "all") {
    kb
      .text("✅  🌍  ALL", "mode:all")
      .danger()
      .row()
      .text("🔒  RESTRICTED", "mode:restricted")
      .danger();
  } else {
    kb
      .text("🌍  ALL", "mode:all")
      .danger()
      .row()
      .text("✅  🔒  RESTRICTED", "mode:restricted")
      .danger();
  }

  kb
    .row()
    .text("⬅️  BACK", "admin:panel")
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");

  return kb;
}

/*
 * Group access request
 */
export function requestKeyboard(chatId) {
  return new InlineKeyboard()
    .text(
      "📤  SEND ACCESS REQUEST",
      `request:submit:${chatId}`
    )
    .danger()
    .row()
    .text("❌  CANCEL REQUEST", "request:cancel");
}

/*
 * Request review
 */
export function requestReviewKeyboard(chatId) {
  return new InlineKeyboard()
    .text(
      "✅  APPROVE REQUEST",
      `request:approve:${chatId}`
    )
    .danger()
    .row()
    .text(
      "❌  REJECT REQUEST",
      `request:reject:${chatId}`
    )
    .danger()
    .row()
    .text("⬅️  BACK", "admin:requests")
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");
}

/*
 * Approved chats
 */
export function chatListKeyboard(chats) {
  const kb = new InlineKeyboard();

  if (!chats.length) {
    return kb
      .text("⬅️  BACK", "admin:panel")
      .text("🏠  HOME", "nav:home")
      .row()
      .text("✖️  CLOSE", "nav:close");
  }

  for (const chat of chats.slice(0, 30)) {
    kb
      .text(
        `🗑️  REMOVE ${shorten(chat.title || chat.chatId)}`,
        `chat:remove:${chat.chatId}`
      )
      .danger()
      .row();
  }

  kb
    .text("⬅️  BACK", "admin:panel")
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");

  return kb;
}

/*
 * Administrator list
 */
export function adminListKeyboard(admins) {
  const kb = new InlineKeyboard()
    .text("➕  ADD ADMINISTRATOR", "admin:add:help")
    .danger()
    .row();

  if (!admins.length) {
    return kb
      .text("⬅️  BACK", "admin:panel")
      .text("🏠  HOME", "nav:home")
      .row()
      .text("✖️  CLOSE", "nav:close");
  }

  for (const admin of admins.slice(0, 30)) {
    kb
      .text(
        `🗑️  REMOVE ADMIN ${admin.userId}`,
        `admin:remove:${admin.userId}`
      )
      .danger()
      .row();
  }

  kb
    .text("⬅️  BACK", "admin:panel")
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");

  return kb;
}

/*
 * Simple back navigation
 */
export function simpleBackKeyboard(
  callback = "nav:home"
) {
  return new InlineKeyboard()
    .text("⬅️  BACK", callback)
    .text("🏠  HOME", "nav:home")
    .row()
    .text("✖️  CLOSE", "nav:close");
}