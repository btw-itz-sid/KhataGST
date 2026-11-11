import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInvoiceNumber,
  parseGstr2bJson,
  parsePortalDate,
  reconcileBooksVs2b,
  scoreMatch,
  summarizeRecon,
} from "../src/services/gstr2bReconcileService.js";

describe("gstr2b reconcile", () => {
  it("normalizes invoice numbers", () => {
    assert.equal(normalizeInvoiceNumber("inv-001/A"), "INV001A");
  });

  it("parses portal DD-MM-YYYY dates", () => {
    assert.equal(parsePortalDate("15-03-2026"), "2026-03-15");
  });

  it("parses simplified and b2b portal JSON", () => {
    const simple = parseGstr2bJson({
      tax_period: "2026-03",
      invoices: [
        {
          supplier_gstin: "27AABCU9603R1ZM",
          invoice_number: "S-100",
          invoice_date: "2026-03-10",
          taxable_value: 1000,
          cgst: 90,
          sgst: 90,
        },
      ],
    });
    assert.equal(simple.invoices.length, 1);
    assert.equal(simple.invoices[0].taxable_paise, 100000);

    const portal = parseGstr2bJson({
      fp: "032026",
      b2b: [
        {
          ctin: "27AABCU9603R1ZM",
          inv: [
            {
              inum: "S-100",
              idt: "10-03-2026",
              txval: 1000,
              camt: 90,
              samt: 90,
              val: 1180,
            },
          ],
        },
      ],
    });
    assert.equal(portal.tax_period, "2026-03");
    assert.equal(portal.invoices[0].invoice_date, "2026-03-10");
  });

  it("matches books vs 2b into notice buckets", () => {
    const books = [
      {
        id: "b1",
        supplier_gstin: "27AABCU9603R1ZM",
        invoice_number: "S-100",
        invoice_date: "2026-03-10",
        taxable_paise: 100000,
        tax_paise: 18000,
        total_paise: 118000,
      },
      {
        id: "b2",
        supplier_gstin: "27AABCU9603R1ZM",
        invoice_number: "ONLY-BOOKS",
        invoice_date: "2026-03-12",
        taxable_paise: 50000,
        tax_paise: 9000,
        total_paise: 59000,
      },
      {
        id: "b3",
        supplier_gstin: "27AABCU9603R1ZM",
        invoice_number: "MIS-1",
        invoice_date: "2026-03-11",
        taxable_paise: 200000,
        tax_paise: 36000,
        total_paise: 236000,
      },
    ];

    const portal = [
      {
        supplier_gstin: "27AABCU9603R1ZM",
        invoice_number: "S-100",
        invoice_date: "2026-03-10",
        taxable_paise: 100000,
        cgst_paise: 9000,
        sgst_paise: 9000,
        igst_paise: 0,
        cess_paise: 0,
        total_paise: 118000,
      },
      {
        supplier_gstin: "27AABCU9603R1ZM",
        invoice_number: "MIS-1",
        invoice_date: "2026-03-11",
        taxable_paise: 180000,
        cgst_paise: 9000,
        sgst_paise: 9000,
        igst_paise: 0,
        cess_paise: 0,
        total_paise: 198000,
      },
      {
        supplier_gstin: "29AAAAA0000A1Z5",
        invoice_number: "ONLY-2B",
        invoice_date: "2026-03-14",
        taxable_paise: 25000,
        cgst_paise: 0,
        sgst_paise: 0,
        igst_paise: 4500,
        cess_paise: 0,
        total_paise: 29500,
      },
    ];

    const rows = reconcileBooksVs2b(books, portal);
    const summary = summarizeRecon(rows);
    assert.equal(summary.matched, 1);
    assert.equal(summary.mismatch, 1);
    assert.equal(summary.in_books_not_2b, 1);
    assert.equal(summary.in_2b_not_books, 1);
    assert.ok(summary.risk_paise > 0);

    const exact = scoreMatch(books[0], portal[0]);
    assert.ok(exact >= 70);
  });
});
