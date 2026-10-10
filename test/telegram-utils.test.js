import test from "node:test";
import assert from "node:assert/strict";
import { safeEditMessage } from "../src/telegram-utils.js";

test("safeEditMessage treats Telegram's unchanged-message response as a no-op", async () => {
  const ctx = {
    async editMessageText() {
      const error = new Error("GrammyError: 400 Bad Request: message is not modified");
      error.description = "Bad Request: message is not modified: specified new message content and reply markup are exactly the same";
      throw error;
    },
  };
  assert.equal(await safeEditMessage(ctx, "editMessageText", "same text"), false);
});

test("safeEditMessage still propagates unrelated Telegram errors", async () => {
  const expected = new Error("Forbidden: bot was blocked by the user");
  const ctx = { async editMessageText() { throw expected; } };
  await assert.rejects(
    safeEditMessage(ctx, "editMessageText", "text"),
    error => error === expected,
  );
});

test("safeEditMessage calls the requested edit method with its arguments", async () => {
  const ctx = {
    async editMessageReplyMarkup(options) {
      assert.deepEqual(options, { reply_markup: { inline_keyboard: [] } });
      return "edited";
    },
  };
  assert.equal(await safeEditMessage(ctx, "editMessageReplyMarkup", { reply_markup: { inline_keyboard: [] } }), "edited");
});
