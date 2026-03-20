// src/lib/db.ts
// PostgreSQL se connect karne ka code
// Ye file har jagah se import hogi jahan DB query chahiye

import { Pool } from "pg";

// Connection pool banao
// Pool matlab: ek baar connect karo, baar baar reuse karo
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                // max 20 connections ek saath
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test karo ki connection sahi hai
pool.on("connect", () => {
  console.log("✅ Database connected!");
});

pool.on("error", (err) => {
  console.error("❌ Database error:", err.message);
});

// Simple query function — poore app mein yahi use hoga
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`🔍 Query: ${text.slice(0, 50)}... | ${duration}ms`);
  return result;
}

// Transaction ke liye (multiple queries ek saath)
export async function getClient() {
  return pool.connect();
}

export default pool;