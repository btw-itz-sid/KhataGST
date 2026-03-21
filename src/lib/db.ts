import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // Neon ke liye zaroori hai
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("connect", () => {
  console.log("✅ Neon Database connected!");
});

pool.on("error", (err) => {
  console.error("❌ Database error:", err.message);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`🔍 Query done | ${duration}ms`);
  return result;
}

export async function getClient() {
  return pool.connect();
}

export default pool;