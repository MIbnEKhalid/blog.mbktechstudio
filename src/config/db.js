import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const idleTimeoutMillisV = 60000; // 60 seconds
const connectionTimeoutMillisV = 50000; // 50 seconds

// PostgreSQL connection pool configuration
export const poolConfig = {
  connectionString: process.env.NEON_POSTGRES,
  ssl: {
    rejectUnauthorized: true,
  },
  max: 20, // Maximum number of connections
  idleTimeoutMillis: idleTimeoutMillisV,
  connectionTimeoutMillis: connectionTimeoutMillisV,
};

export const pool = new Pool(poolConfig);

// Test database connection on startup (skip during tests to avoid open handles)
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const client = await pool.connect();
      console.log("Connected to neon PostgreSQL database (pool)!");
      client.release();
    } catch (err) {
      console.error("Database connection error (pool):", err.message || err);
    }
  })();
}

export default pool;
