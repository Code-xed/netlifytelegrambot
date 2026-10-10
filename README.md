# 0ms Arena Telegram Bot

A serverless Telegram bot built with Node.js, grammY, Netlify Functions, and Netlify Blobs. This revamp keeps the existing access-management and admin flows, refreshes the public landing page and bot menus, and adds Telegram referral attribution.

## Preserved features

- `/start` and the existing `request_<chat_id>` access-request deep link
- `/help`, `/ping`, `/rules`, `/prizes`, `/request`, `/admin`, and owner-only `/addadmin <user_id>`
- Main Mini App launch button and navigation callbacks
- Owner and global administrator permissions
- Open (`all`) and restricted access modes
- Group access request creation, admin notifications, approve/reject actions
- Approved-chat listing/removal and administrator listing/removal
- Persistent settings, admins, requests, and approved chats in Netlify Blobs
- Telegram webhook secret validation
- Existing Netlify Functions, including the legacy `bot.js` function
- Public landing page at `public/index.html` and existing visual assets

## Added and improved

- Redesigned, responsive landing page with mobile navigation, accessible motion handling, and copyable command shortcuts
- Refreshed bot welcome, help, command, referral, and navigation screens
- `/referral` and `/referrals` referral dashboard
- Random 12-character referral codes and Telegram deep links (`/start ref_CODE`)
- Persistent first-seen and referral-dashboard mirror records in the `bot-referrals` Netlify Blobs store
- Direct Neon writes for permanent referral-code ownership and pending attribution from the existing bot referral flows
- Self-referral rejection and first-attribution/first-seen protection for users first encountered after the referral feature is deployed
- Referral count dashboard and Telegram share link
- HTML escaping for user-controlled group titles and requester names in admin notifications
- Text fallback if the welcome/help image cannot be delivered
- Fixed private `/request <chat_id>` responses so they reply normally instead of trying to edit a non-callback message
- Safer navigation when a callback originated from either a photo-caption message or a text message
- Strict group-interaction policy: ordinary text is never echoed, unknown commands are silent, personal/referral/admin menus stay private, and group callbacks are acknowledged without posting messages
- Group command allowlist: `/request`, `/help`, `/rules`, `/prizes`, and `/ping`; the latter four still respect the chat access mode
- Compact `/help` response in groups instead of sending the full image/menu
- Group-level cooldown on `/request` status replies to avoid repeated access-link spam
- Duplicate pending access requests no longer notify admins repeatedly
- JavaScript syntax-check script and unit tests for referral helpers and group command policy


## Group interaction policy

The bot is intentionally quiet in groups. It does not echo ordinary messages, respond to unknown commands, or post private welcome/referral/admin menus into group chats. In groups, `/request` is available to request access; `/help`, `/rules`, `/prizes`, and `/ping` respond only when the chat is allowed by the current access mode. Repeated `/request` status replies are rate-limited per group, and a pending access request does not trigger duplicate admin notifications. Inline-menu callbacks clicked in groups receive a small Telegram toast rather than creating another group message. Admin approval/rejection status notifications remain enabled because they communicate an actual access decision.

## Referral storage behavior

The existing bot referral handlers write directly to Neon through `@neondatabase/serverless`. Permanent code ownership is stored in `public.referral_codes`; valid `/start ref_CODE` visits are checked against `public."user"` and recorded in `public.referral_attributions` before Mini App signup. Netlify Blobs remains in use for first-seen protection and the bot's referral dashboard records.

The bot preserves existing Blobs-generated codes when Neon has no conflicting owner. Neon ownership is never reassigned. A Telegram account already registered in the Mini App cannot receive a new referral attribution, and the SQL upsert only replaces rows that remain `pending` with no linked platform user. Finalization and permanent `user.referred_by` assignment remain the Flask backend's responsibility. The bot does not calculate or credit rewards.

## Environment variables

Configure these under Netlify site environment variables with Functions runtime scope:

```env
BOT_TOKEN=your_bot_token
OWNER_ID=your_numeric_telegram_user_id
WEBHOOK_SECRET=a-long-random-secret
MINI_APP_URL=https://your-mini-app.example
BOT_USERNAME=omsArenaBot
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
ADMIN_DASHBOARD_TOKEN=replace-with-a-long-random-secret
```

`BOT_USERNAME` is optional; when omitted, the bot obtains its username from Telegram's `getMe` method when it creates a referral link. Do not include `@` in the value (the app also tolerates it). `DATABASE_URL` must be the Neon connection string for the same database used by Flask. It is required for referral-code creation and for processing referral deep links. Other bot commands and ordinary `/start` onboarding do not query Neon. `ADMIN_DASHBOARD_TOKEN` is a separate long random secret used only to authorize the manual legacy referral sync action on `/admin.html`; it is never returned by the stats endpoint. Enter it in the dashboard's password field when running a sync. The dashboard displays aggregate Blobs/Neon counts, health checks for Netlify Blobs, Neon and Telegram, and recent sync results. The sync only inserts missing legacy referral codes and pending attributions; it does not overwrite any existing Neon attribution, skips referred Telegram accounts already registered in the Mini App, and does not finalize referrals or credit rewards.

Use Node.js 22.12 or newer for the current `@netlify/blobs` dependency. `netlify.toml` pins `NODE_VERSION` to `22.12.0`.

## Deploy

1. Push the project to your Git repository.
2. Ensure Netlify is connected to the correct repository and branch.
3. Set the environment variables above in Netlify.
4. Deploy. No frontend build command is required; the publish directory is `public` and functions live in `netlify/functions`.
5. Set `DATABASE_URL` and `ADMIN_DASHBOARD_TOKEN` in Netlify's Functions environment scope before using Neon referral operations or the protected manual sync button. Redeploy after changing environment variables.
6. Configure the Telegram webhook to `https://YOUR-SITE.netlify.app/.netlify/functions/telegram` with the same `WEBHOOK_SECRET` as `secret_token`. The compatibility endpoint `/.netlify/functions/bot` also uses the same app; configure only one webhook URL at a time.
7. Check `getWebhookInfo` in the Telegram Bot API if updates are not arriving.

## Local checks

```bash
npm install
npm run check
npm test
```

The tests do not require a live Telegram token, Neon database, or Netlify Blobs connection. Direct Neon referral writes still need a live deployment and database to verify the end-to-end path.

## Commands

- `/start` — open the main menu; referral links use `/start ref_CODE`
- `/help` — help menu
- `/referral` or `/referrals` — personal referral dashboard
- `/request` — request access for a group (run inside the group; repeated prompts are rate-limited)
- `/request <negative_chat_id>` — submit a known group request from private chat
- `/admin` — admin panel
- `/addadmin <user_id>` — owner-only admin management
- `/rules` — tournament and fair-play rules
- `/prizes` — wallet and payout information
- `/ping` — simple responsiveness check

## Security notes

- Never commit `.env` or bot tokens.
- If a bot token has ever been exposed, revoke it through BotFather and update Netlify's environment variable.
- Admin callbacks re-check authorization server-side; button visibility is not used as an access-control mechanism.
