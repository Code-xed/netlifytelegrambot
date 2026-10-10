import test from "node:test";
import assert from "node:assert/strict";
import {
  getChatType,
  getCommandName,
  isGroupChatType,
  isGroupCommandAllowed,
} from "../src/group-policy.js";

test("detects group and supergroup chat types", () => {
  assert.equal(isGroupChatType("group"), true);
  assert.equal(isGroupChatType("supergroup"), true);
  assert.equal(isGroupChatType("private"), false);
  assert.equal(isGroupChatType(null), false);
});

test("resolves chat type from callback messages when needed", () => {
  assert.equal(getChatType({ chat: { type: "private" } }), "private");
  assert.equal(getChatType({ callbackQuery: { message: { chat: { type: "supergroup" } } } }), "supergroup");
  assert.equal(getChatType({}), null);
});

test("parses commands with optional bot usernames", () => {
  assert.equal(getCommandName({ message: { text: "/rules" } }), "rules");
  assert.equal(getCommandName({ message: { text: "/Rules@omsArenaBot extra" } }), "rules");
  assert.equal(getCommandName({ message: { text: "hello /rules" } }), null);
  assert.equal(getCommandName({ message: { text: "ordinary text" } }), null);
  assert.equal(getCommandName({ message: { caption: "/rules" } }), null);
});

test("allows only intentional group commands", () => {
  for (const command of ["request", "help", "rules", "prizes", "ping"]) {
    assert.equal(isGroupCommandAllowed(command), true);
  }
  for (const command of ["start", "referral", "admin", "addadmin", "unknown"]) {
    assert.equal(isGroupCommandAllowed(command), false);
  }
});
