import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeReferralPayload,
  isValidReferralCode,
  escapeHtml,
  referralStartLink,
} from "../src/referral-utils.js";

test("normalizes valid Telegram referral payloads", () => {
  assert.equal(normalizeReferralPayload("ref_abcdef012345"), "abcdef012345");
  assert.equal(normalizeReferralPayload("  ref_ABCDEF012345  "), "abcdef012345");
});

test("rejects malformed referral payloads", () => {
  assert.equal(normalizeReferralPayload(""), null);
  assert.equal(normalizeReferralPayload("request_-100123"), null);
  assert.equal(normalizeReferralPayload("ref_abc"), null);
  assert.equal(normalizeReferralPayload("ref_abcdef012345extra"), null);
  assert.equal(isValidReferralCode("not-a-code"), false);
});

test("escapes untrusted text for Telegram HTML", () => {
  assert.equal(escapeHtml(`<a href="x">Tom & Jerry's</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
});

test("builds a valid deep link and rejects missing usernames", () => {
  assert.equal(referralStartLink("@omsArenaBot", "abcdef012345"), "https://t.me/omsArenaBot?start=ref_abcdef012345");
  assert.equal(referralStartLink("", "abcdef012345"), null);
  assert.equal(referralStartLink("omsArenaBot", "bad"), null);
});
