// Suggest HSN/SAC from item description — curated MSME dictionary + gst_rates table.

import { query } from "../lib/db.js";

export interface HsnSuggestion {
  hsn_sac: string;
  description: string;
  gst_rate: number;
  score: number;
  source: "dictionary" | "gst_rates";
}

const DICTIONARY: Array<{
  keywords: string[];
  hsn_sac: string;
  description: string;
  gst_rate: number;
}> = [
  { keywords: ["steel", "iron", "rod", "tmt", "metal sheet"], hsn_sac: "7214", description: "Iron/steel bars & rods", gst_rate: 18 },
  { keywords: ["cement", "concrete"], hsn_sac: "2523", description: "Cement", gst_rate: 28 },
  { keywords: ["paint", "varnish", "primer"], hsn_sac: "3208", description: "Paints & varnishes", gst_rate: 18 },
  { keywords: ["laptop", "notebook computer", "computer"], hsn_sac: "8471", description: "Automatic data processing machines", gst_rate: 18 },
  { keywords: ["mobile", "smartphone", "iphone", "android phone"], hsn_sac: "8517", description: "Mobile phones / telecom", gst_rate: 18 },
  { keywords: ["printer", "toner", "cartridge"], hsn_sac: "8443", description: "Printing machinery / cartridges", gst_rate: 18 },
  { keywords: ["furniture", "chair", "table", "desk"], hsn_sac: "9403", description: "Other furniture", gst_rate: 18 },
  { keywords: ["tea", "chai"], hsn_sac: "0902", description: "Tea", gst_rate: 5 },
  { keywords: ["coffee"], hsn_sac: "0901", description: "Coffee", gst_rate: 5 },
  { keywords: ["rice", "wheat", "atta", "flour"], hsn_sac: "1006", description: "Rice / cereals (check packing)", gst_rate: 5 },
  { keywords: ["milk", "dahi", "curd", "paneer"], hsn_sac: "0401", description: "Milk & cream", gst_rate: 5 },
  { keywords: ["oil", "edible oil", "mustard oil", "sunflower"], hsn_sac: "1512", description: "Edible oils", gst_rate: 5 },
  { keywords: ["soap", "detergent", "shampoo"], hsn_sac: "3401", description: "Soap / washing preparations", gst_rate: 18 },
  { keywords: ["medicine", "pharma", "tablet", "syrup"], hsn_sac: "3004", description: "Medicaments", gst_rate: 12 },
  { keywords: ["advocate", "lawyer", "legal fees", "consultancy", "consulting"], hsn_sac: "9982", description: "Legal / accounting / consulting (SAC)", gst_rate: 18 },
  { keywords: ["transport", "freight", "logistics", "courier"], hsn_sac: "9965", description: "Goods transport services (SAC)", gst_rate: 18 },
  { keywords: ["hotel", "lodging", "room rent"], hsn_sac: "9963", description: "Accommodation services (SAC)", gst_rate: 12 },
  { keywords: ["restaurant", "catering", "food", "lunch", "dinner", "staff meal"], hsn_sac: "9963", description: "Food & beverage / catering (SAC) — ITC often blocked 17(5)", gst_rate: 5 },
  { keywords: ["rent", "office rent", "warehouse rent"], hsn_sac: "9972", description: "Rental of commercial property (SAC)", gst_rate: 18 },
  { keywords: ["electricity", "power"], hsn_sac: "2716", description: "Electrical energy", gst_rate: 0 },
  { keywords: ["petrol", "diesel", "fuel"], hsn_sac: "2710", description: "Petroleum oils — ITC usually blocked", gst_rate: 0 },
  { keywords: ["insurance"], hsn_sac: "9971", description: "Insurance services (SAC)", gst_rate: 18 },
  { keywords: ["advertising", "ads", "marketing", "google ads", "meta ads"], hsn_sac: "9983", description: "Advertising services (SAC)", gst_rate: 18 },
  { keywords: ["software", "saas", "subscription", "cloud"], hsn_sac: "9983", description: "IT / digital services (SAC)", gst_rate: 18 },
  { keywords: ["accounting", "bookkeeping", "ca fees", "audit"], hsn_sac: "9982", description: "Accounting / audit services (SAC)", gst_rate: 18 },
  { keywords: ["stationery", "paper", "pen", "notebook"], hsn_sac: "4820", description: "Registers / stationery", gst_rate: 12 },
  { keywords: ["packing", "carton", "box", "tape"], hsn_sac: "4819", description: "Cartons / packing containers", gst_rate: 18 },
];

function scoreDictionary(description: string): HsnSuggestion[] {
  const text = description.toLowerCase();
  const hits: HsnSuggestion[] = [];
  for (const row of DICTIONARY) {
    let score = 0;
    for (const kw of row.keywords) {
      if (text.includes(kw)) score += kw.length >= 6 ? 3 : 2;
    }
    if (score > 0) {
      hits.push({
        hsn_sac: row.hsn_sac,
        description: row.description,
        gst_rate: row.gst_rate,
        score,
        source: "dictionary",
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}

export async function suggestHsn(description: string, limit = 5): Promise<HsnSuggestion[]> {
  const q = String(description || "").trim();
  if (q.length < 2) return [];

  const fromDict = scoreDictionary(q);
  const suggestions = [...fromDict];

  try {
    const tokens = q
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3)
      .slice(0, 4);

    if (tokens.length > 0) {
      const like = tokens.map((t) => `%${t}%`);
      // Search description for any token
      const clauses = like.map((_, i) => `description ILIKE $${i + 1}`).join(" OR ");
      const res = await query(
        `SELECT hsn_sac, description, gst_rate
           FROM gst_rates
          WHERE is_active = true
            AND description IS NOT NULL
            AND (${clauses})
          ORDER BY gst_rate ASC
          LIMIT 8`,
        like
      );
      for (const row of res.rows) {
        const hsn = String(row.hsn_sac);
        if (suggestions.some((s) => s.hsn_sac === hsn)) continue;
        suggestions.push({
          hsn_sac: hsn,
          description: String(row.description || ""),
          gst_rate: Number(row.gst_rate || 0),
          score: 1,
          source: "gst_rates",
        });
      }
    }
  } catch {
    // Dictionary-only fallback is fine
  }

  return suggestions.slice(0, Math.max(1, Math.min(limit, 10)));
}
