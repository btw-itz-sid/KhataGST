import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureBillItems, getScanAction, resolveBillMimeType } from "../src/services/billScanService.js";
import { generateOTP, hashOtp, otpMatches } from "../src/lib/otp.js";

test("PDFs are sent to Gemini as PDFs", () => {
  assert.equal(resolveBillMimeType("bill.pdf", "application/octet-stream"), "application/pdf");
  assert.equal(resolveBillMimeType("scans/123_abc.PNG"), "image/png");
  assert.equal(resolveBillMimeType("upload", "image/webp"), "image/webp");
  assert.equal(resolveBillMimeType("upload", "text/html"), "image/jpeg");
});

test("confidence routes the scan", () => {
  assert.equal(getScanAction(92).action, "auto");
  assert.equal(getScanAction(85).action, "review");
  assert.equal(getScanAction(65).action, "review");
  assert.equal(getScanAction(64).action, "manual");
});

test("header-only bills become a single line item", () => {
  const items = ensureBillItems({
    invoice_number: "1",
    vendor_name: "Vendor",
    vendor_gstin: "",
    invoice_date: "2026-10-01",
    taxable_amount: 10000,
    gst_rate: 18,
    cgst_amount: 900,
    sgst_amount: 900,
    igst_amount: 0,
    total_amount: 11800,
    hsn_code: "7208",
    item_description: "Steel sheets",
    items: [],
    confidence: 80,
    action: "review",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].description, "Steel sheets");
  assert.equal(items[0].taxable_amount, 10000);
});

test("OTPs are 6 digits and only their keyed hash is comparable", () => {
  const otp = generateOTP();
  assert.match(otp, /^\d{6}$/);

  const stored = hashOtp("9876543210", otp);
  assert.notEqual(stored, otp);
  assert.equal(otpMatches(stored, "9876543210", otp), true);
  assert.equal(otpMatches(stored, "9876543211", otp), false);
  assert.equal(otpMatches(stored, "9876543210", otp === "123456" ? "654321" : "123456"), false);
  assert.equal(otpMatches(otp, "9876543210", otp), false);
  assert.equal(otpMatches(null, "9876543210", otp), false);
});
