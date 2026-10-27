import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTax, isInterState, validateGSTIN } from "../src/services/gstEngine.js";

test("intra-state tax splits into CGST + SGST that add back to the total", () => {
  // ₹1,000.05 at 5% = 5000.25 paise → rounds to 5000; split must not create or lose a paisa
  for (const taxable of [100005, 100003, 999, 1, 12345678]) {
    for (const rate of [5, 12, 18, 28]) {
      const tax = calculateTax(taxable, rate, false);
      const expectedTax = Math.round((taxable * rate) / 100);
      assert.equal(tax.cgst + tax.sgst, expectedTax);
      assert.ok(Math.abs(tax.cgst - tax.sgst) <= 1);
      assert.equal(tax.igst, 0);
      assert.equal(tax.total, taxable + expectedTax);
    }
  }
});

test("an odd paisa goes to CGST and SGST takes the remainder", () => {
  // 18% of 1,050 paise = 189 paise
  assert.deepEqual(calculateTax(1050, 18, false), { cgst: 95, sgst: 94, igst: 0, total: 1239 });
});

test("inter-state tax is all IGST", () => {
  assert.deepEqual(calculateTax(10000, 18, true), { cgst: 0, sgst: 0, igst: 1800, total: 11800 });
});

test("results are always whole paise", () => {
  const tax = calculateTax(333, 12, false);
  for (const value of Object.values(tax)) assert.ok(Number.isInteger(value));
});

test("GSTIN validation and inter-state detection", () => {
  assert.equal(validateGSTIN("27AAPFU0939F1ZV"), true);
  assert.equal(validateGSTIN("27AAPFU0939F1Z"), false);
  assert.equal(isInterState("27AAPFU0939F1ZV", "29AAPFU0939F1ZV"), true);
  assert.equal(isInterState("09AAPFU0939F1ZV", "09ABCDE1234F1Z5"), false);
});
