import {TelegramAPI} from './telegram';
import {getUserMention, parseRtlDirective} from './utils';
import {getUserSettings, upsertUserSettings, toggleDeleteSetting} from './db';

async function handleWebhook(request, env) {
    try {
        if (!env.BOT_TOKEN) {
            console.error('Error: BOT_TOKEN is missing.');
            return new Response('Error', {status: 500});
        }
        const update = await request.json();
        const api = new TelegramAPI(env.BOT_TOKEN);

        if (update.message) {
            await handleMessageUpdate(update.message, api, env.DB);
        } else if (update.inline_query) {
            await handleInlineQueryUpdate(update.inline_query, api);
        }
    } catch (error) {
        console.error('Exception in handleWebhook:', error);
    }
    return new Response('OK', {status: 200});
}

async function handleMessageUpdate(message, api, db) {
    if (message.from?.is_bot) return;
    const chat = message.chat;
    const user = message.from || {};
    const userMention = getUserMention(message);

    // Ensure we register the user's initial state if they do not exist
    if (user.id && db) {
        await upsertUserSettings(db, user.id, user.username || '');
    }

    let markdownText;

    if (message.document) {
        const file = message.document;
        const fileName = file.file_name || '';
        const fileSize = file.file_size;

        // If file size is larger than 20MB, send a message that file is too big
        if (fileSize > 20 * 1024 * 1024) {
            await api.sendMessage(chat.id, `Sorry ${userMention}, the file is too large. The maximum size allowed is 20MB.`);
            return;
        }
        if (fileName.toLowerCase().endsWith('.md') || fileName.toLowerCase().endsWith('.markdown') || file.mime_type === 'text/markdown') {
            try {
                markdownText = await api.downloadFile(file.file_id);
            } catch (err) {
                console.error('Error downloading file:', err);
                await api.sendMessage(chat.id, '`⚠️ *File Download Error*\nCould not retrieve the content of your Markdown file.`', {parse_mode: 'MarkdownV2'});
            }
        }
    } else if (message.text) {
        const text = message.text.trim();

        const commands = ['/start', '/help', '/markdown', '/settings'];
        if (commands.some(command => text.startsWith(command))) {
            await handleCommand(chat, text, user, api, db);
            return;
        } else if (chat.type === 'private') {
            markdownText = text;
        }
    }

    if (markdownText) {
        await processMarkdown(chat.id, markdownText.trim(), userMention, api);

        // Delete original message if enabled
        if (db && user.id) {
            const settings = await getUserSettings(db, user.id);
            if (settings && settings.delete_original === 1) {
                await api.deleteMessage(chat.id, message.message_id);
            }
        }
    }
}

async function handleCommand(chat, text, user, api, db) {
    const spaceIndex = text.indexOf(' ');
    let command = (spaceIndex === -1 ? text : text.substring(0, spaceIndex)).toLowerCase();
    if (command.includes('@')) command = command.split('@')[0];
    const args = spaceIndex === -1 ? '' : text.substring(spaceIndex + 1).trim();
    const botName = await api.getMe().then(bot => bot.result.username);
    const userMention = getUserMention({ chat, from: user });

    if (command === '/start' || command === '/help') {
        const richStartText = `
# 📝 Telegram Rich Markdown Bot

Welcome! I am a formatting assistant.

I convert your raw Markdown syntax or uploaded \`.md\` files into native rich messages.

### 🎨 Native Formatting Supported
The bot fully supports the telegram rich messages syntax. For more info on what is supported visit [Rich messages](https://core.telegram.org/bots/api#rich-messages).

### ➡️ Right-to-Left (RTL) Support
To format your text in right-to-left orientation, place \`rtl\` on the very first line of your input or uploaded file. The bot will automatically configure RTL alignment and remove that directive line.

### ⚙️ Settings
Control bot behaviors such as deleting your input messages by typing \`/settings\`.

### ⚡️ Inline Previewing
You can use this bot's **Inline Mode** globally.

Type \`@${botName} <markdown>\` in any chat to instantly send the rendered card. (limited to 256 characters)

### 📂 File Support
You can upload a \`.md\` document directly to this chat, and I will parse and display its content.

<tg-math-block>\\begin{gather}\\text{Developed by}\\\\\\text{\\@MSarabi}\\end{gather}</tg-math-block>
`;

        try {
            await api.sendRichMessage(chat.id, richStartText);
        } catch (error) {
            console.error('Failed to dispatch start message:', error);
            const fallbackText = `${userMention}\n\nWelcome!\n\nSend me raw markdown text or upload a \`.md\` file in private to generate rich messages.`;
            await api.sendRichMessage(chat.id, fallbackText);
        }
    } else if (command === '/markdown') {
        await processMarkdown(chat.id, args, userMention, api);
    } else if (command === '/settings') {
        if (!db) {
            await api.sendMessage(chat.id, 'Database configurations are currently unavailable.');
            return;
        }

        if (args.toLowerCase() === 'toggle') {
            const newValue = await toggleDeleteSetting(db, user.id, user.username || '');
            const statusText = newValue === 1 ? 'ENABLED' : 'DISABLED';
            await api.sendMessage(chat.id, `**Updated**. Delete original message: *${statusText}*.`, {parse_mode: 'MarkdownV2'});
        } else {
            const current = await getUserSettings(db, user.id);
            const statusText = current && current.delete_original === 1 ? 'ENABLED' : 'DISABLED';
            const settingsMessage = `
Delete original message: \`${statusText}\`
_(When enabled, If bot has permission, it will delete the original message.)_

To toggle this setting, send:
\`/settings toggle\`
`;
            await api.sendMessage(chat.id, settingsMessage, {parse_mode: 'MarkdownV2'});
        }
    }
}

async function handleInlineQueryUpdate(inlineQuery, api) {
    const queryText = inlineQuery.query.trim();
    const results = [];

    const {isRtl, cleanedText} = parseRtlDirective(queryText);

    if (cleanedText.length === 0) {
        results.push({
            type: 'article',
            id: 'instruction',
            title: 'Send Rich Message',
            description: 'Type any markdown',
            input_message_content: {
                rich_message: {
                    markdown: '*Hello!* Type some markdown in the query input to preview and send it as a rich message.',
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
            description: cleanedText,
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

async function processMarkdown(chatId, markdownText, userMention, api) {
    const {isRtl, cleanedText} = parseRtlDirective(markdownText);

    if (cleanedText.length === 0) {
        const hint = `${userMention}\n\nPlease provide some Markdown text or upload a \`.md\` file.\n\n*Example to try:* \`> <b>Quadratic Equation Solutions: <tg-math-block>\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}</tg-math-block>\``;
        await api.sendRichMessage(chatId, hint);
        return;
    }

    const finalMarkdownText = userMention ? `${userMention}\n\n${cleanedText}` : cleanedText;

    try {
        await api.sendRichMessage(chatId, finalMarkdownText, isRtl);
    } catch (error) {
        console.error('Error during rich message rendering:', error);

        const errorDetails = error.description || 'Invalid syntax';
        const errorMsg = `${userMention}\n\n⚠️ *Markdown Parsing Error*\n\nTelegram was unable to parse the markdown syntax.\n\n*Error details:* \`${errorDetails}\``;

        await api.sendMessage(chatId, errorMsg, {parse_mode: 'MarkdownV2'});
    }
}

export {handleWebhook};