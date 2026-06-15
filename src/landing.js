export const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>RichMdBot - Telegram Formatting Assistant</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background-color: #f4f7f9;
        }

        .container {
            background: #fff;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        h1 {
            color: #0088cc;
            border-bottom: 2px solid #eee;
            padding-bottom: 0.5rem;
        }

        h2 {
            margin-top: 1.5rem;
            color: #444;
        }

        code {
            background: #f0f0f0;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-size: 0.9em;
        }

        .footer {
            margin-top: 2rem;
            font-size: 0.8rem;
            color: #777;
            text-align: center;
        }

        h1 > a {
            color: #0088cc;
            text-decoration: none;
        }
    </style>
</head>
<body>
<div class="container">
    <h1><a href="https://t.me/RichMdBot">RichMdBot</a></h1>
    <p>RichMdBot is a Telegram bot assistant that converts raw Markdown syntax into native rich messages.</p>

    <h2>Features</h2>
    <ul>
        <li><strong>Native Formatting:</strong> Support for Telegram's rich message syntax.</li>
        <li><strong>RTL Support:</strong> Use the <code>rtl</code> directive on the first line for right-to-left text.
        </li>
        <li><strong>File Support:</strong> Upload <code>.md</code> files directly to the bot.</li>
        <li><strong>Inline Mode:</strong> Render Markdown in any chat using <code>@RichMdBot
            &lt;markdown&gt;</code>. <em>(256 characters limit)</em>
        </li>
    </ul>

    <h2>Integration</h2>
    <p>The Webhook endpoint is active and listening for POST requests from the Telegram API.</p>
</div>
<div class="footer">
    RichMdBot Worker is running.
</div>
</body>
</html>
`