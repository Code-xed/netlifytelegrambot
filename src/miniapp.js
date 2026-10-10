import crypto from "node:crypto";

export function validateInitData(initData, botToken, maxAgeSeconds = 86400) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(calculatedHash, "hex");
  const b = Buffer.from(receivedHash, "hex");

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) return null;

  if (Math.floor(Date.now() / 1000) - authDate > maxAgeSeconds) {
    return null;
  }

  return {
    user: params.get("user") ? JSON.parse(params.get("user")) : null,
    queryId: params.get("query_id") || null,
    authDate,
  };
}
