// GSTR-2B parse + ITC reconciliation matcher (no GSTN API yet).

export type ReconBucket =
  | "matched"
  | "mismatch"
  | "in_books_not_2b"
  | "in_2b_not_books";

export interface PortalInvoice {
  supplier_gstin: string;
  supplier_name?: string;
  invoice_number: string;
  invoice_date?: string | null; // YYYY-MM-DD
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  cess_paise: number;
  total_paise: number;
}

export interface BooksInvoice {
  id: string;
  supplier_gstin: string;
  invoice_number: string;
  invoice_date: string; // YYYY-MM-DD
  taxable_paise: number;
  tax_paise: number;
  total_paise: number;
  itc_eligibility?: string;
}

export interface ReconMatchRow {
  bucket: ReconBucket;
  our_invoice_id?: string;
  portal_index?: number;
  supplier_gstin: string;
  invoice_number: string;
  books_taxable_paise: number;
  portal_taxable_paise: number;
  books_tax_paise: number;
  portal_tax_paise: number;
  difference_paise: number;
  risk_paise: number;
  match_score: number;
  notes: string;
}

export function normalizeInvoiceNumber(value: string): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function rupeesToPaise(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // Portal JSON is usually in rupees; treat integers > 100000 as already paise only if flagged.
  return Math.round(n * 100);
}

export function parsePortalDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  // DD-MM-YYYY (GST portal)
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function taxPaise(row: {
  cgst_paise?: number;
  sgst_paise?: number;
  igst_paise?: number;
  cess_paise?: number;
}): number {
  return (
    Number(row.cgst_paise || 0) +
    Number(row.sgst_paise || 0) +
    Number(row.igst_paise || 0) +
    Number(row.cess_paise || 0)
  );
}

function daysApart(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

function withinPct(a: number, b: number, pct: number): boolean {
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base <= pct;
}

/**
 * Accepts official-ish GSTR-2B JSON or a simplified demo shape:
 * { tax_period, invoices: [...] } or { b2b: [{ ctin, inv: [...] }] }
 */
export function parseGstr2bJson(payload: unknown): {
  tax_period?: string;
  invoices: PortalInvoice[];
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid GSTR-2B JSON");
  }
  const root = payload as Record<string, any>;
  const invoices: PortalInvoice[] = [];

  let taxPeriod: string | undefined;
  if (typeof root.tax_period === "string") taxPeriod = root.tax_period;
  else if (typeof root.fp === "string" && /^\d{6}$/.test(root.fp)) {
    taxPeriod = `${root.fp.slice(2, 6)}-${root.fp.slice(0, 2)}`;
  }

  // Simplified: { invoices: [...] }
  if (Array.isArray(root.invoices)) {
    for (const inv of root.invoices) {
      const taxable = rupeesToPaise(inv.taxable_value ?? inv.txval ?? inv.taxable_paise ?? 0);
      const cgst = rupeesToPaise(inv.cgst ?? inv.camt ?? 0);
      const sgst = rupeesToPaise(inv.sgst ?? inv.samt ?? 0);
      const igst = rupeesToPaise(inv.igst ?? inv.iamt ?? 0);
      const cess = rupeesToPaise(inv.cess ?? inv.csamt ?? 0);
      const total =
        inv.total_paise != null
          ? Number(inv.total_paise)
          : rupeesToPaise(inv.val ?? inv.total ?? (taxable + cgst + sgst + igst + cess) / 100);
      invoices.push({
        supplier_gstin: String(inv.supplier_gstin ?? inv.ctin ?? inv.gstin ?? "")
          .toUpperCase()
          .trim(),
        supplier_name: inv.supplier_name ?? inv.trade_name ?? undefined,
        invoice_number: String(inv.invoice_number ?? inv.inum ?? "").trim(),
        invoice_date: parsePortalDate(inv.invoice_date ?? inv.idt),
        taxable_paise: taxable,
        cgst_paise: cgst,
        sgst_paise: sgst,
        igst_paise: igst,
        cess_paise: cess,
        total_paise: total,
      });
    }
  }

  // Official-ish: b2b / b2ba
  for (const section of ["b2b", "b2ba"] as const) {
    if (!Array.isArray(root[section])) continue;
    for (const party of root[section]) {
      const ctin = String(party?.ctin ?? "").toUpperCase().trim();
      const invList = Array.isArray(party?.inv) ? party.inv : [];
      for (const inv of invList) {
        const taxable = rupeesToPaise(inv.txval ?? 0);
        const cgst = rupeesToPaise(inv.camt ?? 0);
        const sgst = rupeesToPaise(inv.samt ?? 0);
        const igst = rupeesToPaise(inv.iamt ?? 0);
        const cess = rupeesToPaise(inv.csamt ?? 0);
        const total = rupeesToPaise(inv.val ?? (taxable + cgst + sgst + igst + cess) / 100);
        invoices.push({
          supplier_gstin: ctin,
          supplier_name: party?.trdnm ?? undefined,
          invoice_number: String(inv.inum ?? "").trim(),
          invoice_date: parsePortalDate(inv.idt),
          taxable_paise: taxable,
          cgst_paise: cgst,
          sgst_paise: sgst,
          igst_paise: igst,
          cess_paise: cess,
          total_paise: total,
        });
      }
    }
  }

  const cleaned = invoices.filter((i) => i.invoice_number && i.supplier_gstin);
  if (cleaned.length === 0) {
    throw new Error("GSTR-2B JSON mein koi invoice nahi mili (b2b / invoices).");
  }

  return { tax_period: taxPeriod, invoices: cleaned };
}

export function scoreMatch(book: BooksInvoice, portal: PortalInvoice): number {
  if (
    normalizeInvoiceNumber(book.supplier_gstin) !==
    normalizeInvoiceNumber(portal.supplier_gstin)
  ) {
    // GSTIN must match for candidate
    if (
      book.supplier_gstin &&
      portal.supplier_gstin &&
      book.supplier_gstin.toUpperCase() !== portal.supplier_gstin.toUpperCase()
    ) {
      return 0;
    }
  }

  let score = 0;
  if (
    book.supplier_gstin &&
    portal.supplier_gstin &&
    book.supplier_gstin.toUpperCase() === portal.supplier_gstin.toUpperCase()
  ) {
    score += 25;
  }

  const bn = normalizeInvoiceNumber(book.invoice_number);
  const pn = normalizeInvoiceNumber(portal.invoice_number);
  if (bn && pn && bn === pn) score += 40;
  else if (bn && pn && (bn.includes(pn) || pn.includes(bn))) score += 20;

  const gap = daysApart(book.invoice_date, portal.invoice_date);
  if (gap === 0) score += 20;
  else if (gap != null && gap <= 3) score += 10;

  if (Math.abs(book.taxable_paise - portal.taxable_paise) <= 1) score += 10;
  else if (withinPct(book.taxable_paise, portal.taxable_paise, 0.01)) score += 5;

  const portalTax = taxPaise(portal);
  if (Math.abs(book.tax_paise - portalTax) <= 1) score += 5;
  else if (withinPct(book.tax_paise, portalTax, 0.01)) score += 2;

  return score;
}

export function reconcileBooksVs2b(
  books: BooksInvoice[],
  portal: PortalInvoice[]
): ReconMatchRow[] {
  const usedBooks = new Set<number>();
  const usedPortal = new Set<number>();
  const rows: ReconMatchRow[] = [];

  // Greedy best pairs by score
  type Pair = { bi: number; pi: number; score: number };
  const pairs: Pair[] = [];
  for (let bi = 0; bi < books.length; bi++) {
    for (let pi = 0; pi < portal.length; pi++) {
      const score = scoreMatch(books[bi], portal[pi]);
      if (score >= 45) pairs.push({ bi, pi, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  for (const pair of pairs) {
    if (usedBooks.has(pair.bi) || usedPortal.has(pair.pi)) continue;
    usedBooks.add(pair.bi);
    usedPortal.add(pair.pi);

    const book = books[pair.bi];
    const port = portal[pair.pi];
    const portalTax = taxPaise(port);
    const taxableDiff = book.taxable_paise - port.taxable_paise;
    const taxDiff = book.tax_paise - portalTax;
    const amountOk =
      Math.abs(taxableDiff) <= 100 && Math.abs(taxDiff) <= 100; // ₹1 tolerance
    const blocked = book.itc_eligibility === "blocked";

    if (pair.score >= 70 && amountOk) {
      rows.push({
        bucket: "matched",
        our_invoice_id: book.id,
        portal_index: pair.pi,
        supplier_gstin: port.supplier_gstin || book.supplier_gstin,
        invoice_number: port.invoice_number || book.invoice_number,
        books_taxable_paise: book.taxable_paise,
        portal_taxable_paise: port.taxable_paise,
        books_tax_paise: book.tax_paise,
        portal_tax_paise: portalTax,
        difference_paise: 0,
        risk_paise: blocked ? book.tax_paise : 0,
        match_score: pair.score,
        notes: blocked
          ? "Matched in 2B, but Section 17(5) blocked — claim mat karo"
          : "Books aur GSTR-2B match",
      });
    } else {
      rows.push({
        bucket: "mismatch",
        our_invoice_id: book.id,
        portal_index: pair.pi,
        supplier_gstin: port.supplier_gstin || book.supplier_gstin,
        invoice_number: port.invoice_number || book.invoice_number,
        books_taxable_paise: book.taxable_paise,
        portal_taxable_paise: port.taxable_paise,
        books_tax_paise: book.tax_paise,
        portal_tax_paise: portalTax,
        difference_paise: taxableDiff + taxDiff,
        risk_paise: Math.max(book.tax_paise, portalTax),
        match_score: pair.score,
        notes: "Invoice mila but value/tax mismatch — DRC-01C risk",
      });
    }
  }

  for (let bi = 0; bi < books.length; bi++) {
    if (usedBooks.has(bi)) continue;
    const book = books[bi];
    rows.push({
      bucket: "in_books_not_2b",
      our_invoice_id: book.id,
      supplier_gstin: book.supplier_gstin,
      invoice_number: book.invoice_number,
      books_taxable_paise: book.taxable_paise,
      portal_taxable_paise: 0,
      books_tax_paise: book.tax_paise,
      portal_tax_paise: 0,
      difference_paise: book.tax_paise,
      risk_paise: book.tax_paise,
      match_score: 0,
      notes: "Books mein hai, 2B mein nahi — abhi ITC claim mat karo",
    });
  }

  for (let pi = 0; pi < portal.length; pi++) {
    if (usedPortal.has(pi)) continue;
    const port = portal[pi];
    const portalTax = taxPaise(port);
    rows.push({
      bucket: "in_2b_not_books",
      portal_index: pi,
      supplier_gstin: port.supplier_gstin,
      invoice_number: port.invoice_number,
      books_taxable_paise: 0,
      portal_taxable_paise: port.taxable_paise,
      books_tax_paise: 0,
      portal_tax_paise: portalTax,
      difference_paise: portalTax,
      risk_paise: 0,
      match_score: 0,
      notes: "2B mein hai, books mein nahi — purchase entry missing",
    });
  }

  return rows;
}

export function summarizeRecon(rows: ReconMatchRow[]) {
  const summary = {
    matched: 0,
    mismatch: 0,
    in_books_not_2b: 0,
    in_2b_not_books: 0,
    risk_paise: 0,
    claimable_matched_paise: 0,
  };
  for (const row of rows) {
    summary[row.bucket] += 1;
    summary.risk_paise += Number(row.risk_paise || 0);
    if (row.bucket === "matched") {
      summary.claimable_matched_paise += Number(row.portal_tax_paise || 0);
    }
  }
  return summary;
}
