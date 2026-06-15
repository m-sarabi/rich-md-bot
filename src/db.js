export async function getUserSettings(db, userId) {
    try {
        const result = await db.prepare(
            "SELECT delete_original FROM users WHERE user_id = ?"
        ).bind(userId).first();

        return result || null;
    } catch (error) {
        console.error("Database read error:", error);
        return null;
    }
}

export async function upsertUserSettings(db, userId, username, deleteOriginal = 0) {
    try {
        await db.prepare(`
            INSERT INTO users (user_id, username, delete_original, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                delete_original = COALESCE(?, users.delete_original),
                updated_at = CURRENT_TIMESTAMP
        `).bind(userId, username, deleteOriginal, deleteOriginal).run();
    } catch (error) {
        console.error("Database write error:", error);
    }
}

export async function toggleDeleteSetting(db, userId, username) {
    try {
        const current = await getUserSettings(db, userId);
        const newValue = current && current.delete_original === 1 ? 0 : 1;
        await upsertUserSettings(db, userId, username, newValue);
        return newValue;
    } catch (error) {
        console.error("Database toggle error:", error);
        return 0;
    }
}