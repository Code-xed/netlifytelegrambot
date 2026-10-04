# Telegram Netlify Alpha

Lightweight Telegram bot using:

- Node.js
- grammY 1.46.0
- Netlify Functions
- Telegram Webhooks
- Netlify Blobs

## Features

- `/start`, `/help`, `/ping`
- Inline keyboards
- Callback queries
- Mini App button
- Owner with unrestricted access
- Dynamic global admins (`/addadmin <user_id>` is owner-only)
- `🌍 All` / `🔒 Restricted` access mode
- Group access requests
- Inline approval/rejection panel
- Persistent settings, admins, requests and approved chats
- Telegram webhook secret validation
- grammY Bot API escape hatch

## Environment variables

Set these in Netlify with Functions runtime scope:

```env
BOT_TOKEN=your_bot_token
OWNER_ID=your_numeric_telegram_user_id
WEBHOOK_SECRET=a-long-random-secret
MINI_APP_URL=https://your-mini-app.example
```

Netlify runtime functions read environment variables through `process.env`. The current `@netlify/blobs` release requires Node.js 22.12+; set the Netlify Functions runtime to `nodejs22.x` (Environment variable `AWS_LAMBDA_JS_RUNTIME`) in the Netlify UI.

## Deploy

Push this repository to GitHub and import it into Netlify.

No build command is required.

The function is:

```text
/.netlify/functions/telegram
```

The Netlify site should have a public URL such as:

```text
https://your-site.netlify.app/.netlify/functions/telegram
```

## Set webhook

After deployment:

```text
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-SITE.netlify.app/.netlify/functions/telegram&secret_token=YOUR_WEBHOOK_SECRET
```

Check it:

```text
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

## Access workflow

### Restricted mode

1. Add the bot to a group.
2. Run `/request` in the group.
3. Open the bot's private chat through the generated button.
4. Submit the request.
5. Owner/admin receives an inline approval panel.
6. Approve or reject.
7. Approved group can use the bot.

### All mode

Any chat can use normal bot functionality without approval.

Owner/admin functions always remain available to the owner/admin.

## Important

Do not commit `.env` or bot tokens.

If a bot token is ever exposed, revoke it through BotFather and replace the Netlify environment variable.

## Current Alpha limitations

This is intentionally not a complete Telegram framework. grammY already provides the underlying Telegram Bot API abstraction.

Deferred features include payments/Stars, games, business bots, advanced inline mode, reactions, forum management, jobs/queues, analytics, plugins, and advanced rate limiting.
