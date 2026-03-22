// src/services/exportService.ts
// Excel, CSV export service
// GSTR-1 format mein Excel download kar sakte hain

import ExcelJS from "exceljs";
import { query } from "../lib/db.js";

// ── Excel export — GSTR-1 format ─────────────────────────────
export async function exportGSTR1Excel(
  businessId: string,
  taxPeriod: string  // "2026-03"
): Promise<Buffer> {

  const [year, month] = taxPeriod.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  // Business info nikalo
  const bizResult = await query(
    "SELECT * FROM businesses WHERE id = $1",
    [businessId]
  );
  const business = bizResult.rows[0];

  // Invoices nikalo
  const invoicesResult = await query(
    `SELECT 
      i.*,
      p.gstin as buyer_gstin,
      p.name as buyer_name
     FROM invoices i
     LEFT JOIN parties p ON i.party_id = p.id
     WHERE i.business_id = $1
       AND i.invoice_type = 'sale'
       AND i.invoice_date >= $2
       AND i.invoice_date <= $3
       AND i.is_cancelled = false
     ORDER BY i.invoice_date ASC`,
    [businessId, startDate, endDate]
  );

  const invoices = invoicesResult.rows;

  // Excel workbook banao
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KhataGST";
  workbook.created = new Date();

  // ── Sheet 1: Summary ────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Summary");

  // Header styling
  summarySheet.mergeCells("A1:F1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = `GSTR-1 Summary — ${business?.legal_name ?? "Business"} — ${taxPeriod}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A7A4A" } };
  titleCell.alignment = { horizontal: "center" };
  summarySheet.getRow(1).height = 30;

  // Business info
  summarySheet.addRow([]);
  summarySheet.addRow(["GSTIN:", business?.gstin ?? "N/A", "", "Tax Period:", taxPeriod]);
  summarySheet.addRow(["Business:", business?.legal_name ?? "N/A", "", "Due Date:", `11/${String(month === 12 ? 1 : month + 1).padStart(2, "0")}/${month === 12 ? year + 1 : year}`]);
  summarySheet.addRow([]);

  // Totals
  const totalTaxable = invoices.reduce((sum, inv) => sum + Number(inv.taxable_value), 0);
  const totalCGST = invoices.reduce((sum, inv) => sum + Number(inv.cgst_amount), 0);
  const totalSGST = invoices.reduce((sum, inv) => sum + Number(inv.sgst_amount), 0);
  const totalIGST = invoices.reduce((sum, inv) => sum + Number(inv.igst_amount), 0);
  const grandTotal = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const totalsRow = summarySheet.addRow([
    "Total Invoices", invoices.length, "",
    "Total Tax", `₹${((totalCGST + totalSGST + totalIGST) / 100).toFixed(2)}`
  ]);
  totalsRow.font = { bold: true };

  summarySheet.addRow(["Taxable Value", `₹${(totalTaxable / 100).toFixed(2)}`]);
  summarySheet.addRow(["CGST", `₹${(totalCGST / 100).toFixed(2)}`]);
  summarySheet.addRow(["SGST", `₹${(totalSGST / 100).toFixed(2)}`]);
  summarySheet.addRow(["IGST", `₹${(totalIGST / 100).toFixed(2)}`]);

  const grandRow = summarySheet.addRow(["Grand Total", `₹${(grandTotal / 100).toFixed(2)}`]);
  grandRow.font = { bold: true, size: 12 };
  grandRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5EE" } };

  // Column widths
  summarySheet.getColumn(1).width = 20;
  summarySheet.getColumn(2).width = 25;
  summarySheet.getColumn(4).width = 20;
  summarySheet.getColumn(5).width = 25;

  // ── Sheet 2: B2B Invoices ───────────────────────────────────
  const b2bSheet = workbook.addWorksheet("B2B Invoices");

  // Headers
  const b2bHeaders = [
    "Invoice No.", "Date", "Buyer Name", "Buyer GSTIN",
    "Place of Supply", "Taxable Value", "CGST", "SGST", "IGST", "Total"
  ];
  const b2bHeaderRow = b2bSheet.addRow(b2bHeaders);
  b2bHeaderRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A7A4A" } };
    cell.alignment = { horizontal: "center" };
  });
  b2bSheet.getRow(1).height = 25;

  // B2B invoices add karo
  const b2bInvoices = invoices.filter(inv => inv.buyer_gstin);
  b2bInvoices.forEach((inv, idx) => {
    const row = b2bSheet.addRow([
      inv.invoice_number,
      new Date(inv.invoice_date).toLocaleDateString("en-IN"),
      inv.buyer_name ?? "N/A",
      inv.buyer_gstin ?? "",
      inv.place_of_supply ?? "",
      Number(inv.taxable_value) / 100,
      Number(inv.cgst_amount) / 100,
      Number(inv.sgst_amount) / 100,
      Number(inv.igst_amount) / 100,
      Number(inv.total_amount) / 100,
    ]);

    // Alternate row colors
    if (idx % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      });
    }

    // Currency format for amount columns
    [6, 7, 8, 9, 10].forEach(col => {
      row.getCell(col).numFmt = '₹#,##0.00';
    });
  });

  // Column widths
  [15, 12, 25, 18, 15, 15, 12, 12, 12, 15].forEach((w, i) => {
    b2bSheet.getColumn(i + 1).width = w;
  });

  // ── Sheet 3: B2C Invoices ───────────────────────────────────
  const b2cSheet = workbook.addWorksheet("B2C Invoices");

  const b2cHeaders = [
    "Invoice No.", "Date", "Customer Name",
    "Place of Supply", "Taxable Value", "CGST", "SGST", "IGST", "Total"
  ];
  const b2cHeaderRow = b2cSheet.addRow(b2cHeaders);
  b2cHeaderRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
    cell.alignment = { horizontal: "center" };
  });

  const b2cInvoices = invoices.filter(inv => !inv.buyer_gstin);
  b2cInvoices.forEach((inv, idx) => {
    const row = b2cSheet.addRow([
      inv.invoice_number,
      new Date(inv.invoice_date).toLocaleDateString("en-IN"),
      inv.buyer_name ?? "Unregistered",
      inv.place_of_supply ?? "",
      Number(inv.taxable_value) / 100,
      Number(inv.cgst_amount) / 100,
      Number(inv.sgst_amount) / 100,
      Number(inv.igst_amount) / 100,
      Number(inv.total_amount) / 100,
    ]);

    if (idx % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      });
    }

    [5, 6, 7, 8, 9].forEach(col => {
      row.getCell(col).numFmt = '₹#,##0.00';
    });
  });

  [15, 12, 25, 15, 15, 12, 12, 12, 15].forEach((w, i) => {
    b2cSheet.getColumn(i + 1).width = w;
  });

  // Buffer return karo
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── CSV export — simple, sab kaam aata hai ───────────────────
export async function exportInvoicesCSV(
  businessId: string,
  taxPeriod: string
): Promise<string> {

  const [year, month] = taxPeriod.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const result = await query(
    `SELECT 
      i.invoice_number,
      i.invoice_date,
      i.invoice_type,
      p.name as party_name,
      p.gstin as party_gstin,
      i.taxable_value,
      i.cgst_amount,
      i.sgst_amount,
      i.igst_amount,
      i.total_amount
     FROM invoices i
     LEFT JOIN parties p ON i.party_id = p.id
     WHERE i.business_id = $1
       AND i.invoice_date >= $2
       AND i.invoice_date <= $3
       AND i.is_cancelled = false
     ORDER BY i.invoice_date ASC`,
    [businessId, startDate, endDate]
  );

  // CSV banao
  const headers = [
    "Invoice No", "Date", "Type", "Party Name", "Party GSTIN",
    "Taxable Value", "CGST", "SGST", "IGST", "Total"
  ];

  const rows = result.rows.map(inv => [
    inv.invoice_number,
    new Date(inv.invoice_date).toLocaleDateString("en-IN"),
    inv.invoice_type,
    inv.party_name ?? "Unregistered",
    inv.party_gstin ?? "",
    (Number(inv.taxable_value) / 100).toFixed(2),
    (Number(inv.cgst_amount) / 100).toFixed(2),
    (Number(inv.sgst_amount) / 100).toFixed(2),
    (Number(inv.igst_amount) / 100).toFixed(2),
    (Number(inv.total_amount) / 100).toFixed(2),
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");

  return csv;
}