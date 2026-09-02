import { pool } from '../config/db.js';

let tablesInitialized = false;

/**
 * Initializes Activity_Logs and Settings tables if they don't exist.
 */
export async function initializeAdminTables() {
    if (tablesInitialized) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Activity_Logs (
                id SERIAL PRIMARY KEY,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INTEGER,
                entity_title TEXT,
                details TEXT,
                "UserName" TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON Activity_Logs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON Activity_Logs(entity_type, entity_id);
            CREATE INDEX IF NOT EXISTS idx_activity_logs_username ON Activity_Logs("UserName");

            CREATE TABLE IF NOT EXISTS Settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        tablesInitialized = true;
    } catch (err) {
        console.error('Error initializing admin tables:', err.message);
    }
}

// Auto-run initialization on load
initializeAdminTables();

/**
 * Record an activity / audit event.
 */
export async function logActivity({ action, entityType, entityId = null, entityTitle = null, details = null, username = 'admin' }) {
    try {
        await initializeAdminTables();
        await pool.query(
            `INSERT INTO Activity_Logs (action, entity_type, entity_id, entity_title, details, "UserName") 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [action, entityType, entityId, entityTitle, details, username]
        );
    } catch (err) {
        console.error('Failed to log activity:', err.message);
    }
}
