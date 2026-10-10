export const REFERRAL_CODE_PATTERN = /^[a-f0-9]{12}$/i;

export function normalizeReferralPayload(payload) {
  if (typeof payload !== "string") return null;
  const match = payload.trim().match(/^ref_([a-f0-9]{12})$/i);
  return match ? match[1].toLowerCase() : null;
}

export function isValidReferralCode(code) {
  return typeof code === "string" && REFERRAL_CODE_PATTERN.test(code);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function referralStartLink(botUsername, code) {
  const username = String(botUsername ?? "").replace(/^@/, "").trim();
  if (!username || !isValidReferralCode(code)) return null;
  return `https://t.me/${username}?start=ref_${code}`;
}
