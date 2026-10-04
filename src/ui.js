import { InlineKeyboard } from "grammy";

export function mainAdminKeyboard(accessMode) {
  return new InlineKeyboard()
    .text("📥 Requests", "admin:requests")
    .text("✅ Approved Chats", "admin:chats")
    .row()
    .text("👥 Administrators", "admin:admins")
    .text("🌍 Access Mode", "admin:mode")
    .row()
    .text(`Current: ${accessMode === "all" ? "🌍 All" : "🔒 Restricted"}`, "admin:mode");
}

export function modeKeyboard() {
  return new InlineKeyboard()
    .text("🌍 Allow All", "mode:all")
    .text("🔒 Restricted", "mode:restricted")
    .row()
    .text("⬅️ Back", "admin:panel");
}

export function requestKeyboard(chatId) {
  return new InlineKeyboard()
    .text("📤 Request Access", `request:submit:${chatId}`)
    .row()
    .text("❌ Cancel", "request:cancel");
}

export function requestReviewKeyboard(chatId) {
  return new InlineKeyboard()
    .text("✅ Approve", `request:approve:${chatId}`)
    .text("❌ Reject", `request:reject:${chatId}`)
    .row()
    .text("⬅️ Requests", "admin:requests");
}

export function chatListKeyboard(chats) {
  const kb = new InlineKeyboard();
  for (const chat of chats.slice(0, 30)) {
    kb.text(`❌ ${chat.title}`, `chat:remove:${chat.chatId}`).row();
  }
  kb.text("⬅️ Back", "admin:panel");
  return kb;
}

export function adminListKeyboard(admins) {
  const kb = new InlineKeyboard();
  kb.text("➕ Add Admin", "admin:add:help").row();
  for (const admin of admins.slice(0, 30)) {
    kb.text(`❌ ${admin.userId}`, `admin:remove:${admin.userId}`).row();
  }
  kb.text("⬅️ Back", "admin:panel");
  return kb;
}

export function startKeyboard(miniAppUrl) {
  const kb = new InlineKeyboard();
  if (miniAppUrl) kb.webApp("🚀 Open Mini App", miniAppUrl).row();
  kb.text("ℹ️ Help", "help:show");
  return kb;
}
