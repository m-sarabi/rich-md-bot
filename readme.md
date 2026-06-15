# RichMdBot

A Telegram bot hosted on Cloudflare Workers that converts Markdown text and files into native Telegram rich messages.

## Features

- **Markdown Parsing:** Formats plain text and `.md` file uploads.
- **RTL Support:** Start your message with `rtl *` for right-to-left layout.
- **Inline Mode:** Type `@botname <text>` in any chat to render Markdown on the fly.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your Telegram Bot Token:**
   ```bash
   npx wrangler secret put BOT_TOKEN
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

4. **Set Webhook:**
   Configure your bot webhook to point to your deployed Worker URL:
   ```text
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
   ```