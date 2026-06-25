export function parseRtlDirective(text) {
    let cleanedText = text || '';

    if (cleanedText.startsWith('\uFEFF')) {
        cleanedText = cleanedText.slice(1);
    }

    const regex = /^rtl[ \t]*/i;
    const isRtl = regex.test(text);

    cleanedText = isRtl ? cleanedText.replace(regex, '').trim() : cleanedText.trim();

    return {isRtl, cleanedText};
}

export function getUserMention(message) {
    const chat = message.chat;
    if (chat.type === 'private' || chat.type === 'channel') {
        return '';
    }
    const fromUser = message.from || {};
    const userId = fromUser.id;
    const userName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || 'User';
    return userId
        ? `*[${userName}](tg://user?id=${userId}) :*`
        : `*${userName} :*`;
}

export function getUserMentionHtml(message) {
    const chat = message.chat;
    if (chat.type === 'private' || chat.type === 'channel') {
        return '';
    }
    const fromUser = message.from || {};
    const userId = fromUser.id;
    const userName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || 'User';
    const escapedName = userName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return userId
        ? `<a href="tg://user?id=${userId}"><b>${escapedName}</b></a>`
        : `<b>${escapedName}</b>`;
}

export function getMimeType(filename, defaultType = 'application/octet-stream') {
    if (!filename) return defaultType;
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'md': 'text/markdown',
        'markdown': 'text/markdown'
    };
    return mimeTypes[ext] || defaultType;
}