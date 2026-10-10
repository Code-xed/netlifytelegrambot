/**
 * Safely edit a Telegram message from a callback handler.
 * Telegram returns HTTP 400 when the requested text/caption/markup is identical
 * to the current message. That is an expected no-op, not an application error.
 */
export async function safeEditMessage(ctx, method, ...args) {
  try {
    return await ctx[method](...args);
  } catch (error) {
    const description = String(
      error?.description ?? error?.message ?? error?.error?.description ?? "",
    );
    if (/message is not modified/i.test(description)) return false;
    throw error;
  }
}

/** Answer callback queries without allowing an already-answered/stale query to
 * turn an otherwise successful interaction into a failed Netlify invocation. */
export async function safeAnswerCallbackQuery(ctx, options = {}) {
  if (!ctx?.callbackQuery) return false;
  try {
    await ctx.answerCallbackQuery(options);
    return true;
  } catch (error) {
    const description = String(
      error?.description ?? error?.message ?? error?.error?.description ?? "",
    );
    if (/query is too old|query id is invalid|query is already answered/i.test(description)) return false;
    throw error;
  }
}
