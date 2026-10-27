// src/scripts/seedKnowledge.ts
// Statutory sections ko embed karke gst_knowledge_base mein upsert karta hai
// Run: npm run seed:knowledge  (migrations 005 aur 006 pehle chalni chahiye)

import "dotenv/config";
import pool, { query } from "../lib/db.js";
import { STATUTORY_TAX_KNOWLEDGE } from "../services/knowledgeService.js";
import { embedText, toPgVector } from "../services/embeddingService.js";

async function main() {
  for (const item of STATUTORY_TAX_KNOWLEDGE) {
    const embedding = await embedText(
      `${item.section_title}\n${item.content}`,
      "RETRIEVAL_DOCUMENT",
      item.section_title
    );

    await query(
      `INSERT INTO gst_knowledge_base
         (section_title, source_act, section_number, category, content, legal_rule_metadata, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
       ON CONFLICT (source_act, section_number) DO UPDATE SET
         section_title = EXCLUDED.section_title,
         category = EXCLUDED.category,
         content = EXCLUDED.content,
         legal_rule_metadata = EXCLUDED.legal_rule_metadata,
         embedding = EXCLUDED.embedding,
         updated_at = NOW()`,
      [
        item.section_title,
        item.source_act,
        item.section_number,
        item.category,
        item.content,
        JSON.stringify(item.legal_rule_metadata),
        toPgVector(embedding),
      ]
    );

    console.log(`✅ ${item.source_act} ${item.section_number} — ${item.section_title}`);
  }

  console.log(`\n${STATUTORY_TAX_KNOWLEDGE.length} sections embedded aur saved.`);
}

main()
  .catch((err) => {
    console.error("❌ Knowledge seed failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
