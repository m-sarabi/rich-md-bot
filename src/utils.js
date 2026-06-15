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
    if (chat.type === 'private') {
        return '';
    }
    const fromUser = message.from || {};
    const userId = fromUser.id;
    const userName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || 'User';
    return userId
        ? `*[${userName}](tg://user?id=${userId}) :*`
        : `*${userName} :*`;
}
