CREATE TABLE IF NOT EXISTS users (
                                     user_id INTEGER PRIMARY KEY,
                                     username TEXT,
                                     delete_original INTEGER DEFAULT 0, -- 0 for false, 1 for true
                                     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);