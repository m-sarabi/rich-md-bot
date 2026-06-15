export async function getUserSettings(db, userId) {
    try {
        const result = await db.prepare(
            "SELECT delete_original, default_rtl, language_code, first_name FROM users WHERE user_id = ?"
        ).bind(userId).first();

        return result || null;
    } catch (error) {
        console.error("Database read error:", error);
        return null;
    }
}

export async function upsertUserSettings(db, userId, userInfo, deleteOriginal = null, defaultRtl = null) {
    const { username, first_name, last_name, language_code, is_premium } = userInfo;
    const isPremiumInt = is_premium ? 1 : 0;

    try {
        await db.prepare(`
            INSERT INTO users (
                user_id, username, first_name, last_name, language_code, is_premium,
                delete_original, default_rtl, updated_at, last_active_at
            )
            VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 0), COALESCE(?, 0), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                                            first_name = excluded.first_name,
                                            last_name = excluded.last_name,
                                            language_code = excluded.language_code,
                                            is_premium = excluded.is_premium,
                                            delete_original = COALESCE(?, users.delete_original),
                                            default_rtl = COALESCE(?, users.default_rtl),
                                            updated_at = CURRENT_TIMESTAMP,
                                            last_active_at = CURRENT_TIMESTAMP
        `).bind(
            userId, username || null, first_name || null, last_name || null, language_code || null, isPremiumInt,
            deleteOriginal, defaultRtl,
            deleteOriginal, defaultRtl
        ).run();
    } catch (error) {
        console.error("Database write error:", error);
    }
}

export async function toggleSetting(db, userId, userInfo, settingName) {
    try {
        const current = await getUserSettings(db, userId);
        let currentVal = 0;

        if (current && current[settingName] !== undefined) {
            currentVal = current[settingName];
        }

        const newVal = currentVal === 1 ? 0 : 1;

        const deleteOriginalArg = settingName === 'delete_original' ? newVal : null;
        const defaultRtlArg = settingName === 'default_rtl' ? newVal : null;

        await upsertUserSettings(db, userId, userInfo, deleteOriginalArg, defaultRtlArg);
        return newVal;
    } catch (error) {
        console.error(`Database toggle error for ${settingName}:`, error);
        return 0;
    }
}