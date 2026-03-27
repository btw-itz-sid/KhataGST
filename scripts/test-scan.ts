/**
 * Standalone scan test script.
 *
 * Usage:
 *   npx tsx scripts/test-scan.ts <path_to_invoice_image>
 *
 * Requires GEMINI_API_KEY in .env (loaded automatically).
 */
import "dotenv/config";
import * as path from "path";
import * as fs from "fs";
import { scanBillWithAI } from "../src/services/billScanService.js";

const imagePath = process.argv[2];

if (!imagePath) {
  console.error("\n  Usage: npx tsx scripts/test-scan.ts <image_path>\n");
  process.exit(1);
}

const resolved = path.resolve(imagePath);
if (!fs.existsSync(resolved)) {
  console.error(`\n  File not found: ${resolved}\n`);
  process.exit(1);
}

console.log("\n🔍 KhataGST — AI Scan Test");
console.log("─".repeat(48));
console.log(`  Image  : ${resolved}`);
console.log(`  Model  : ${process.env.GEMINI_MODEL || "(auto-discover)"}`);
console.log("─".repeat(48));

async function run() {
  const start = Date.now();

  try {
    const result = await scanBillWithAI(resolved);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    console.log(`\n✅ Extraction completed in ${elapsed}s\n`);
    console.log("┌─ Extracted Data ────────────────────────────┐");
    console.log(JSON.stringify(result.extracted_data, null, 2));
    console.log("└─────────────────────────────────────────────┘");

    console.log("\n📊 Summary:");
    console.log(`  Confidence  : ${result.confidence_score}%`);
    console.log(`  Action      : ${result.action}`);
    console.log(`  Vendor      : ${result.extracted_data.vendor_name}`);
    console.log(`  Invoice #   : ${result.extracted_data.invoice_number}`);
    console.log(`  Date        : ${result.extracted_data.invoice_date}`);
    console.log(`  Taxable     : ₹${(result.extracted_data.taxable_amount / 100).toFixed(2)}`);
    console.log(`  CGST        : ₹${(result.extracted_data.cgst_amount / 100).toFixed(2)}`);
    console.log(`  SGST        : ₹${(result.extracted_data.sgst_amount / 100).toFixed(2)}`);
    console.log(`  IGST        : ₹${(result.extracted_data.igst_amount / 100).toFixed(2)}`);
    console.log(`  Total       : ₹${(result.extracted_data.total_amount / 100).toFixed(2)}`);
    console.log(`  HSN         : ${result.extracted_data.hsn_code || "(none)"}`);
    console.log(`  GST Rate    : ${result.extracted_data.gst_rate}%`);

    // Validation checks
    const taxable = result.extracted_data.taxable_amount;
    const gstTotal = result.extracted_data.cgst_amount + result.extracted_data.sgst_amount + result.extracted_data.igst_amount;
    const total = result.extracted_data.total_amount;
    const expectedTotal = taxable + gstTotal;
    const diff = Math.abs(total - expectedTotal);

    console.log("\n🔎 Validation:");
    if (diff <= 100) {
      console.log("  ✅ Total = Taxable + GST (within ₹1 margin)");
    } else {
      console.log(`  ⚠️  Total mismatch: expected ₹${(expectedTotal / 100).toFixed(2)}, got ₹${(total / 100).toFixed(2)} (diff ₹${(diff / 100).toFixed(2)})`);
    }

    if (Number.isInteger(taxable) && Number.isInteger(total)) {
      console.log("  ✅ Amounts are in paise (integers)");
    } else {
      console.log("  ⚠️  Amounts may not be in paise — check normalization");
    }

    if (result.extracted_data.vendor_name) {
      console.log("  ✅ Vendor name extracted");
    } else {
      console.log("  ⚠️  Vendor name is empty");
    }

    if (result.extracted_data.invoice_number) {
      console.log("  ✅ Invoice number extracted");
    } else {
      console.log("  ⚠️  Invoice number is empty");
    }

    if (result.fallback_mode) {
      console.log(`\n⚠️  Fallback mode: ${result.fallback_mode}`);
      console.log(`    Reason: ${result.fallback_reason}`);
    }

    console.log("\n📄 Raw AI response (first 500 chars):");
    console.log(result.raw_response.substring(0, 500));
    console.log("");
  } catch (err: any) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.error(`\n❌ Scan failed after ${elapsed}s`);
    console.error(`   Error: ${err?.message ?? err}`);
    process.exit(1);
  }
}

run();
