import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // Neon ke liye zaroori hai
  },
  max: 10,                      // Neon serverless ke liye 10 kaafi hai
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000, // Neon cold start mein 5-10s lag sakta hai
});

pool.on("connect", () => {
  console.log("✅ Neon Database connected!");
});

pool.on("error", (err) => {
  console.error("❌ Database pool error:", err.message);
});

// Query with automatic retry — Neon cold start ke liye
export async function query(text: string, params?: any[]) {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.log(`🔍 Query done | ${duration}ms (slow — Neon cold start?)`);
      }
      return result;
    } catch (err: any) {
      lastError = err;
      // Connection timeout/terminated → retry karo (Neon cold start)
      if (
        attempt < maxRetries &&
        (err.message?.includes("Connection terminated") ||
         err.message?.includes("connection timeout") ||
         err.code === "ECONNRESET")
      ) {
        console.warn(`⚠️ DB connection failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // 1s, 2s backoff
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function getClient() {
  return pool.connect();
}

export default pool;