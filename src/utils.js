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
        'markdown': 'text/markdown',
    };
    return mimeTypes[ext] || defaultType;
}

export function getMarkdownUrl(text) {
    try {
        const trimmed = (text || '').trim();
        if (!trimmed) return null;
        if (/\s/.test(trimmed)) return null;

        const url = new URL(trimmed);
        const pathname = url.pathname.toLowerCase();
        const filename = url.searchParams.get('filename')?.toLowerCase() || '';

        if (
            pathname.endsWith('.md') ||
            pathname.endsWith('.markdown') ||
            filename.endsWith('.md') ||
            filename.endsWith('.markdown')
        ) {
            return url.href;
        }
    } catch (e) {
        // Not a valid URL
    }
    return null;
}

export function getLocalFileId(urlStr, localOrigin) {
    if (!localOrigin) return null;
    try {
        const url = new URL(urlStr);
        if (url.origin === localOrigin && url.pathname.startsWith('/file/')) {
            return url.pathname.split('/').pop() || null;
        }
    } catch (e) {
        // Ignored
    }
    return null;
}