import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs");
const outputPath = path.join(outputDir, "SQL Invoice Workflow Database.xlsx");

const sheets = {
  invoices: {
    name: "Invoices",
    headers: [
      "Invoice ID",
      "Internal Invoice No",
      "Document Type",
      "Status",
      "SQL Status",
      "Customer Name",
      "SQL Customer Code",
      "Customer Email",
      "Customer Phone",
      "Billing Address",
      "Invoice Date",
      "Due Date",
      "Currency",
      "Subtotal",
      "Discount",
      "Tax",
      "Total",
      "Notes",
      "Terms",
      "TIN",
      "ID Type",
      "ID No",
      "PDF File URL",
      "Created By",
      "Created At",
      "Updated At",
      "Sent At",
      "Paid At",
      "Payment Ref",
      "Payment Proof URL",
      "Uploaded To SQL At",
      "Uploaded By",
      "Cancelled At",
      "Cancelled Reason",
    ],
  },
  items: {
    name: "Invoice Items",
    headers: [
      "Item ID",
      "Invoice ID",
      "Internal Invoice No",
      "Sequence",
      "Item Code",
      "Description",
      "Quantity",
      "UOM",
      "Unit Price",
      "Discount",
      "Tax Code",
      "Tax Amount",
      "Amount",
      "Account Code",
      "Created At",
      "Updated At",
    ],
  },
  payments: {
    name: "Payments",
    headers: [
      "Payment ID",
      "Invoice ID",
      "Internal Invoice No",
      "Amount Paid",
      "Payment Date",
      "Payment Ref",
      "Payment Proof URL",
      "Marked By",
      "Created At",
    ],
  },
  sqlExport: {
    name: "SQL Export",
    headers: [
      "DOCNO(20)",
      "DOCNOEX",
      "DOCDATE",
      "CODE(10)",
      "EIV_UTC",
      "IRBM_UUID",
      "IRBM_LONGID",
      "IRBM_STATUS",
      "COMPANYNAME(100)",
      "ADDRESS1(60)",
      "ADDRESS2(60)",
      "ADDRESS3(60)",
      "ADDRESS4(60)",
      "POSTCODE(10)",
      "CITY(50)",
      "STATE(50)",
      "COUNTRY(2)",
      "PHONE1(200)",
      "AGENT(10)",
      "TERMS(10)",
      "DESCRIPTION(200)",
      "PROJECT(20)",
      "CC(200)",
      "DOCREF1",
      "DOCREF2",
      "DOCREF3",
      "DOCREF4",
      "SALESTAXNO(25)",
      "SERVICETAXNO(25)",
      "TIN(14)",
      "IDTYPE",
      "IDNO(20)",
      "TOURISMNO(17)",
      "SIC(10)",
      "INCOTERMS(3)",
      "SUBMISSIONTYPE",
      "_SEQ",
      "_ACCOUNT(10)",
      "_ITEMCODE(30)",
      "_DESCRIPTION(200)",
      "_DESCRIPTION2",
      "_DESCRIPTION3",
      "_QTY",
      "_UOM(10)",
      "_UNITPRICE",
      "_DISC(20)",
      "_TAX(10)",
      "_TAXAMT",
      "_TAXINCLUSIVE",
      "_AMOUNT",
      "_IRBM_CLASSIFICATION(3)",
      "_TAXEXEMPTIONREASON(300)",
      "_LOCATION(20)",
      "_BATCH(30)",
      "_PROJECT(20)",
      "_REMARK1(200)",
      "_REMARK2(200)",
      "_FROMDOCTYPE",
      "_FROMDOCNO",
      "_FROMSEQNO",
    ],
  },
  settings: {
    name: "Settings",
    headers: ["Key", "Value", "Notes"],
    rows: [
      ["DEFAULT_CUSTOMER_CODE", "", "Fallback SQL customer code if invoice customer code is blank."],
      ["DEFAULT_ACCOUNT_CODE", "510-000", "Fallback GL sales account code for SQL export."],
      ["DEFAULT_UOM", "UNIT", "Fallback UOM for SQL export."],
      ["DEFAULT_TERMS", "C.O.D.", "Fallback payment terms."],
      ["DEFAULT_AGENT", "----", "Fallback SQL agent code."],
      ["DEFAULT_PROJECT", "----", "Fallback SQL project code."],
      ["DEFAULT_SUBMISSION_TYPE", "17", "SQL template submission type. Confirm with accountant."],
      ["DEFAULT_TAX_INCLUSIVE", "F", "F = false, T = true."],
      ["DEFAULT_COUNTRY", "MY", "Customer country code."],
      ["DEFAULT_DESCRIPTION", "Payment request", "Header description for SQL export."],
    ],
  },
  logs: {
    name: "Logs",
    headers: ["Timestamp", "User", "Action", "Invoice ID", "Internal Invoice No", "Details"],
  },
};

const workbook = Workbook.create();

for (const sheetPlan of Object.values(sheets)) {
  const sheet = workbook.worksheets.add(sheetPlan.name);
  const rows = [sheetPlan.headers, ...(sheetPlan.rows || [])];
  sheet.getRangeByIndexes(0, 0, rows.length, sheetPlan.headers.length).values = rows;
  sheet.freezePanes.freezeRows(1);
  sheet.getRangeByIndexes(0, 0, 1, sheetPlan.headers.length).format.font = { bold: true };
  sheet.getRangeByIndexes(0, 0, 1, sheetPlan.headers.length).format.fill = { color: "#F1F4F8" };
  sheet.getRangeByIndexes(0, 0, Math.max(rows.length, 2), sheetPlan.headers.length).format.borders = {
    preset: "all",
    style: "thin",
    color: "#D9DEE7",
  };
  sheet.getRangeByIndexes(0, 0, Math.max(rows.length, 2), sheetPlan.headers.length).format.autofitColumns();
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
