import {getLocalFileId} from './utils';

class TelegramError extends Error {
    constructor(method, status, responseBody) {
        const parsed = JSON.parse(responseBody);
        let description = parsed.description || 'Unknown Error';
        super(`Telegram API Error. Method: ${method}, Status: ${status}, Description: ${description}`);
        this.method = method;
        this.status = status;
        this.description = description;
    }
}

class TelegramAPI {
    constructor(token, localOrigin = null) {
        this.baseUrl = `https://api.telegram.org/bot${token}`;
        this.fileUrl = `https://api.telegram.org/file/bot${token}`;
        this.localOrigin = localOrigin;
    }

    async request(method, payload = {}) {
        const response = await fetch(`${this.baseUrl}/${method}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new TelegramError(method, response.status, errorText);
        }
        return await response.json();
    }

    async getFile(fileId) {
        return this.request('getFile', {file_id: fileId});
    }

    async sendMessage(chatId, text, options = {}) {
        return this.request('sendMessage', {
            chat_id: chatId,
            text: text,
            ...options,
        });
    }

    async sendRichMessage(chatId, rich_text, isRtl = false, options = {}) {
        const rich_message = {
            markdown: rich_text,
        };
        if (isRtl) rich_message.is_rtl = true;

        return this.request('sendRichMessage', {
            chat_id: chatId,
            rich_message,
            ...options,
        });
    }

    async answerInlineQuery(inlineQueryId, results, options = {}) {
        return this.request('answerInlineQuery', {
            inline_query_id: inlineQueryId,
            results: results,
            cache_time: 60,
            ...options,
        });
    }

    async downloadFile(downloadUrl) {
        const localFileId = getLocalFileId(downloadUrl, this.localOrigin);

        if (localFileId) {
            try {
                const fileInfo = await this.getFile(localFileId);
                if (fileInfo.ok && fileInfo.result?.file_path) {
                    const directUrl = `${this.fileUrl}/${fileInfo.result.file_path}`;
                    const response = await fetch(directUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to retrieve file content: ${response.statusText}`);
                    }
                    return await response.text();
                }
            } catch (error) {
                console.error('Failed to resolve local proxy URL internally:', error);
            }
        }

        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Failed to retrieve file content: ${response.statusText}`);
        }

        return await response.text();
    }

    async getMe() {
        return this.request('getMe');
    }

    async deleteMessage(chatId, messageId) {
        try {
            return await this.request('deleteMessage', {
                chat_id: chatId,
                message_id: messageId,
            });
        } catch (error) {
            console.error(`Failed to delete message ${messageId} in chat ${chatId}:`, error);
            return null;
        }
    }
}

export {TelegramAPI, TelegramError};