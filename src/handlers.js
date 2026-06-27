import {TelegramAPI} from './telegram';
import {getUserMention, getUserMentionHtml, parseRtlDirective, getMimeType, getMarkdownUrl} from './utils';
import {getUserSettings, upsertUserSettings, toggleSetting} from './db';

async function handleWebhook(request, env) {
    try {
        if (!env.BOT_TOKEN) {
            console.error('Error: BOT_TOKEN is missing.');
            return new Response('Error', {status: 500});
        }
        const update = await request.json();
        const requestUrl = new URL(request.url);
        const api = new TelegramAPI(env.BOT_TOKEN, requestUrl.origin);

        if (update.message) {
            await handleMessageUpdate(update.message, api, env.DB, request);
        } else if (update.channel_post) {
            await handleMessageUpdate(update.channel_post, api, env.DB, request);
        } else if (update.inline_query) {
            await handleInlineQueryUpdate(update.inline_query, api);
        }
    } catch (error) {
        console.error('Exception in handleWebhook:', error);
    }
    return new Response('OK', {status: 200});
}

async function handleMessageUpdate(message, api, db, request) {
    console.log('Received message:', message);
    if (message.from?.is_bot) return;
    const chat = message.chat;
    const user = message.from || {};
    const userMention = getUserMention(message);

    // Track thread/forum context
    const options = {};
    if (message.message_thread_id) {
        options.message_thread_id = message.message_thread_id;
    }

    if (user.id && db) {
        await upsertUserSettings(db, user.id, user);
    }

    let markdownText;

    if (message.document) {
        const file = message.document;
        const fileName = file.file_name || '';
        const fileSize = file.file_size || 0;
        const fileInfo = await api.getFile(file.file_id);
        if (!fileInfo.ok || !fileInfo.result?.file_path) {
            throw new Error('Telegram getFile returned an invalid or empty path.');
        }
        const downloadUrl = `${api.fileUrl}/${fileInfo.result.file_path}`;

        const requestUrl = new URL(request.url);
        const baseUrl = requestUrl.origin;
        const proxyUrl = `${baseUrl}/file/${file.file_id}${fileName ? `?filename=${encodeURIComponent(fileName)}` : ''}`;

        await api.sendRichMessage(chat.id, `Proxy URL:\n<code>${proxyUrl}</code>`, false, options);

        // If file size is larger than 20MB, send a message that file is too big
        if (fileSize > 20 * 1024 * 1024) {
            await api.sendMessage(chat.id, `Sorry ${userMention}, the file is too large. The maximum size allowed is 20MB.`, options);
            return;
        }
        if (fileName.toLowerCase().endsWith('.md') || fileName.toLowerCase().endsWith('.markdown') || file.mime_type === 'text/markdown') {
            try {
                markdownText = await api.downloadFile(downloadUrl);
            } catch (err) {
                console.error('Error downloading file:', err);
                await api.sendMessage(chat.id, '⚠️ <b>File Download Error</b>\nCould not retrieve the content of your Markdown file.', {
                    parse_mode: 'HTML',
                    ...options,
                });
            }
        }
    } else if (message.text) {
        const text = message.text.trim();
        const commands = ['/start', '/help', '/markdown', '/settings'];
        if (commands.some(command => text.startsWith(command))) {
            await handleCommand(chat, text, user, api, db, message);
            return;
        }

        const mdUrl = getMarkdownUrl(text);
        if (mdUrl) {
            try {
                markdownText = await api.downloadFile(mdUrl);
            } catch (err) {
                console.error('Error downloading markdown from link:', err);
                await api.sendMessage(chat.id, '⚠️ <b>Link Download Error</b>\nCould not retrieve the content of your Markdown file from the provided link.', {
                    parse_mode: 'HTML',
                    ...options,
                });
                return;
            }
        } else if (chat.type === 'private') {
            markdownText = text;
        }
    }

    if (markdownText) {
        let isDefaultRtl = false;
        let isDeleteOriginal = false;
        let isMentionEnabled = true;

        if (chat.type === 'channel') {
            isDeleteOriginal = true;
        } else if (db && user.id) {
            const settings = await getUserSettings(db, user.id);
            if (settings) {
                isDefaultRtl = settings.default_rtl === 1;
                isDeleteOriginal = settings.delete_original === 1;
                isMentionEnabled = settings.mention === 1;
            }
        }

        let {isRtl, cleanedText} = parseRtlDirective(markdownText);
        if (isDefaultRtl) {
            isRtl = true;
        }

        const activeMention = isMentionEnabled ? userMention : '';
        const finalMarkdownText = activeMention ? `${activeMention}\n\n${cleanedText}` : cleanedText;

        try {
            await api.sendRichMessage(chat.id, finalMarkdownText, isRtl, options);
        } catch (error) {
            console.error('Error during rich message rendering:', error);
            const errorDetails = error.description || 'Invalid syntax';
            const htmlMention = getUserMentionHtml(message);
            const mentionPrefix = htmlMention ? `${htmlMention}\n\n` : '';
            const escapedDetails = errorDetails.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const errorMsg = `${mentionPrefix}⚠️ <b>Markdown Parsing Error</b>\n\nTelegram was unable to parse the markdown syntax.\n\n<b>Error details:</b> <code>${escapedDetails}</code>`;
            await api.sendMessage(chat.id, errorMsg, {
                parse_mode: 'HTML',
                ...options,
            });
        }

        if (isDeleteOriginal) {
            await api.deleteMessage(chat.id, message.message_id);
        }
    }
}

async function handleCommand(chat, text, user, api, db, message) {
    const messageId = message.message_id;
    const spaceIndex = text.indexOf(' ');
    let command = (spaceIndex === -1 ? text : text.substring(0, spaceIndex)).toLowerCase();
    if (command.includes('@')) command = command.split('@')[0];
    const args = spaceIndex === -1 ? '' : text.substring(spaceIndex + 1).trim();
    const botName = await api.getMe().then(bot => bot.result.username);
    const userMention = getUserMention({chat, from: user});

    const options = {};
    if (message.message_thread_id) {
        options.message_thread_id = message.message_thread_id;
    }

    if (command === '/start' || command === '/help') {
        const richStartText = `
# 📝 Rich Markdown Bot

Welcome! This bot converts Markdown text or uploaded files into formatted messages.

### 🛠 How to Use
* **Private Chats:** Send raw Markdown text directly, and the bot will reply with the formatted version.
* **Commands:** Use \`/markdown <text>\` to send formatted content.
* **Files:** Upload any \`.md\` or \`.markdown\` file (up to 20MB) to render its content.

### 🖼 Inline Media (Proxy Links)
When you upload a document, photo, or video, the bot replies with a **Proxy URL**. You can use this link to embed inline media inside your Markdown:
* **Example:** \`<img src="PROXY_URL" />\`

### ➡️ RTL (Right-to-Left) Support
To render text in RTL layout:
- Place \`rtl\` on the very first line of your message or file.
- Alternatively, enable it globally via settings.

### ⚡ Inline Mode
Render formatting on the go in any chat by typing:
\`@${botName} <your markdown>\`

### ⚙️ Settings
Configure your preferences with the \`/settings\` command:
- Automatically delete your raw messages after formatting.
  - Always enabled in channels.
- Set RTL alignment as your default option.

<tg-math-block>\\begin{gather}\\text{Developed by}\\\\\\text{\\@MSarabi}\\end{gather}</tg-math-block>
`;
        try {
            await api.sendRichMessage(chat.id, richStartText, false, options);
        } catch (error) {
            console.error('Failed to dispatch start message:', error);
            const fallbackText = `${userMention}\n\nWelcome!\n\nSend me raw markdown text or upload a \`.md\` file in private to generate rich messages.`;
            await api.sendRichMessage(chat.id, fallbackText, false, options);
        }
    } else if (command === '/markdown') {
        let activeMention = userMention;
        if (db && user.id) {
            const settings = await getUserSettings(db, user.id);
            if (settings && settings.mention === 0) {
                activeMention = '';
            }
        }
        await processMarkdown(chat, args, activeMention, message, api);
        if (chat.type === 'channel' && messageId) {
            await api.deleteMessage(chat.id, messageId);
        } else if (db && user.id && messageId) {
            const settings = await getUserSettings(db, user.id);
            if (settings && settings.delete_original === 1) {
                await api.deleteMessage(chat.id, messageId);
            }
        }
    } else if (chat.type === 'private' && command === '/settings') {
        if (!db) {
            await api.sendMessage(chat.id, 'Database configurations are currently unavailable.');
            return;
        }

        if (args === 'delete') {
            const newValue = await toggleSetting(db, user.id, user, 'delete_original');
            const statusText = newValue === 1 ? 'ENABLED' : 'DISABLED';
            await api.sendMessage(chat.id, `Settings updated: <b>Delete original message</b> is now <b>${statusText}</b>.`, {parse_mode: 'HTML'});
        } else if (args === 'rtl') {
            const newValue = await toggleSetting(db, user.id, user, 'default_rtl');
            const statusText = newValue === 1 ? 'ENABLED' : 'DISABLED';
            await api.sendMessage(chat.id, `Settings updated: <b>Default RTL alignment</b> is now <b>${statusText}</b>.`, {parse_mode: 'HTML'});
        } else if (args === 'mention') {
            const newValue = await toggleSetting(db, user.id, user, 'mention');
            const statusText = newValue === 1 ? 'ENABLED' : 'DISABLED';
            await api.sendMessage(chat.id, `Settings updated: <b>Group mentions</b> is now <b>${statusText}</b>.`, {parse_mode: 'HTML'});
        } else {
            const current = await getUserSettings(db, user.id);
            const deleteStatus = current && current.delete_original === 1 ? 'ENABLED' : 'DISABLED';
            const rtlStatus = current && current.default_rtl === 1 ? 'ENABLED' : 'DISABLED';
            const mentionStatus = current && current.mention === 1 ? 'ENABLED' : 'DISABLED';

            const settingsMessage = `
⚙️ **Settings**

1. *Delete original message:* \`${deleteStatus}\`
   - Automatically delete your raw message text after rendering
     - Toggle: \`/settings delete\`

2. *Default RTL:* \`${rtlStatus}\`
   - Assume all messages are Right-to-Left aligned by default
     - Toggle: \`/settings rtl\`

3. *Default mention:* \`${mentionStatus}\`
   - To be mentioned in groups on the first line
     - Toggle: \`/settings mention\`
`;
            await api.sendRichMessage(chat.id, settingsMessage);
        }
    }
}

async function handleInlineQueryUpdate(inlineQuery, api) {
    const queryText = inlineQuery.query.trim();
    const results = [];

    let targetText = queryText;
    const mdUrl = getMarkdownUrl(queryText);
    if (mdUrl) {
        try {
            targetText = await api.downloadFile(mdUrl);
        } catch (err) {
            console.error('Error downloading markdown link in inline query:', err);
            results.push({
                type: 'article',
                id: 'inline_error',
                title: '⚠️ Download Error',
                description: 'Could not fetch Markdown file from link',
                input_message_content: {
                    message_text: '⚠️ <b>Markdown Link Error</b>\nUnable to fetch markdown content from the URL.',
                    parse_mode: 'HTML',
                },
            });
            await api.answerInlineQuery(inlineQuery.id, results);
            return;
        }
    }

    const {isRtl, cleanedText} = parseRtlDirective(targetText);

    if (cleanedText.length === 0) {
        results.push({
            type: 'article',
            id: 'instruction',
            title: 'Send Rich Message',
            description: 'Type any markdown or paste a markdown file link',
            input_message_content: {
                rich_message: {
                    markdown: '*Hello!* Type some markdown or paste a `.md` file link in the query input to preview and send it as a rich message.',
                },
            },
        });
    } else {
        const richMessage = {markdown: cleanedText};
        if (isRtl) {
            richMessage.is_rtl = true;
        }

        results.push({
            type: 'article',
            id: 'markdown_inline_block',
            title: 'Send as Rich Message',
            description: cleanedText.substring(0, 100) + (cleanedText.length > 100 ? '...' : ''),
            input_message_content: {
                rich_message: richMessage,
            },
        });
    }

    try {
        await api.answerInlineQuery(inlineQuery.id, results);
    } catch (error) {
        console.error('Error returning inline query output:', error);
    }
}

async function processMarkdown(chat, markdownText, userMention, message, api) {
    let targetText = markdownText;
    const mdUrl = getMarkdownUrl(markdownText);
    const chatId = chat.id;
    const options = {};
    if (message.message_thread_id) options.message_thread_id = message.message_thread_id;

    if (mdUrl) {
        try {
            targetText = await api.downloadFile(mdUrl);
        } catch (err) {
            console.error('Error downloading markdown from link in processMarkdown:', err);
            options.parse_mode = 'HTML';
            const htmlMention = getUserMentionHtml(message);
            const mentionPrefix = htmlMention ? `${htmlMention}\n\n` : '';
            await api.sendMessage(chatId, `${mentionPrefix}⚠️ <b>Link Download Error</b>\nCould not retrieve the content of your Markdown file from the provided link.`, options);
            return;
        }
    }

    const {isRtl, cleanedText} = parseRtlDirective(targetText);

    if (cleanedText.length === 0) {
        const hint = `${userMention}\n\nPlease provide some Markdown text or upload a \`.md\` file.\n\n*Example to try:* \`> <b>Quadratic Equation Solutions: <tg-math-block>\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}</tg-math-block>\``;
        await api.sendRichMessage(chatId, hint, false, options);
        return;
    }

    const finalMarkdownText = userMention ? `${userMention}\n\n${cleanedText}` : cleanedText;

    try {
        await api.sendRichMessage(chatId, finalMarkdownText, isRtl, options);
    } catch (error) {
        console.error('Error during rich message rendering:', error);

        const errorDetails = error.description || 'Invalid syntax';
        const htmlMention = getUserMentionHtml(message);
        const mentionPrefix = htmlMention ? `${htmlMention}\n\n` : '';
        const escapedDetails = errorDetails.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const errorMsg = `${mentionPrefix}⚠️ <b>Markdown Parsing Error</b>\n\nTelegram was unable to parse the markdown syntax.\n\n<b>Error details:</b> <code>${escapedDetails}</code>`;

        options.parse_mode = 'HTML';
        await api.sendMessage(chatId, errorMsg, options);
    }
}

async function handleFileProxy(request, env) {
    const url = new URL(request.url);
    const fileId = url.pathname.split('/').pop();
    if (!fileId) {
        return new Response('File ID is missing', {status: 400});
    }

    const filename = url.searchParams.get('filename');

    try {
        const api = new TelegramAPI(env.BOT_TOKEN);
        const fileInfo = await api.getFile(fileId);
        if (!fileInfo.ok || !fileInfo.result?.file_path) {
            return new Response('File not found', {status: 404});
        }

        const downloadUrl = `${api.fileUrl}/${fileInfo.result.file_path}`;
        const fileResponse = await fetch(downloadUrl);

        if (!fileResponse.ok) {
            return new Response('Error retrieving file from Telegram', {status: fileResponse.status});
        }

        const responseHeaders = new Headers();
        let contentType = fileResponse.headers.get('Content-Type');

        if (filename) {
            const inferredMime = getMimeType(filename);
            if (!contentType || contentType === 'application/octet-stream' || inferredMime !== 'application/octet-stream') {
                contentType = inferredMime;
            }

            const safeFilename = filename.replace(/"/g, '\\"');
            responseHeaders.set(
                'Content-Disposition',
                `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            );
        }

        if (contentType) {
            responseHeaders.set('Content-Type', contentType);
        }

        responseHeaders.set('Cache-Control', 'public, max-age=3600');

        return new Response(fileResponse.body, {
            status: 200,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error('File proxy error:', error);
        return new Response('Internal Server Error', {status: 500});
    }
}

export {handleWebhook, handleFileProxy};