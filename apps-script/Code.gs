const SPREADSHEET_ID = "1gMMS_y1z_2wIMUa5fiZwyCA2l0p3KJB64LXx_CBUE78";
const APP_PIN_PROPERTY = "APP_PIN";

const SHEETS = {
  invoices: "Invoices",
  items: "Invoice Items",
  payments: "Payments",
  sqlExport: "SQL Export",
  settings: "Settings",
  logs: "Logs",
};

const INVOICE_HEADERS = [
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
];

const ITEM_HEADERS = [
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
];

const PAYMENT_HEADERS = [
  "Payment ID",
  "Invoice ID",
  "Internal Invoice No",
  "Amount Paid",
  "Payment Date",
  "Payment Ref",
  "Payment Proof URL",
  "Marked By",
  "Created At",
];

const SETTINGS_HEADERS = ["Key", "Value", "Notes"];
const LOG_HEADERS = ["Timestamp", "User", "Action", "Invoice ID", "Internal Invoice No", "Details"];

const DEFAULT_SETTINGS = [
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
];

const SQL_HEADERS = [
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
];

function doGet() {
  return json_({
    ok: true,
    app: "Levince Invoice Workflow",
    message: "Backend is running. Use POST requests from the website.",
  });
}

function doPost(e) {
  try {
    const request = parseRequest_(e);
    requirePin_(request);
    setupSheets_();

    switch (request.action) {
      case "setup":
        return json_({ ok: true, sheets: Object.values(SHEETS) });
      case "listInvoices":
        return json_(listInvoices_());
      case "createInvoice":
        return json_(createInvoice_(request));
      case "markPaid":
        return json_(markPaid_(request));
      case "markUploaded":
        return json_(markUploaded_(request));
      case "cancelInvoice":
        return json_(cancelInvoice_(request));
      case "refreshSqlExport":
        return json_(refreshSqlExport_(request));
      default:
        throw new Error("Unknown action: " + request.action);
    }
  } catch (error) {
    return json_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  return JSON.parse(e.postData.contents);
}

function requirePin_(request) {
  const expected = PropertiesService.getScriptProperties().getProperty(APP_PIN_PROPERTY);
  if (!expected) {
    throw new Error("APP_PIN is not set in Apps Script Project Settings.");
  }
  if (String(request.pin || "") !== String(expected)) {
    throw new Error("Invalid PIN.");
  }
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.indexOf("PASTE_") !== 0) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("No active spreadsheet found. Set SPREADSHEET_ID in Code.gs.");
  }
  return active;
}

function setupSheets_() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, SHEETS.invoices, INVOICE_HEADERS);
  ensureSheet_(ss, SHEETS.items, ITEM_HEADERS);
  ensureSheet_(ss, SHEETS.payments, PAYMENT_HEADERS);
  ensureSheet_(ss, SHEETS.sqlExport, SQL_HEADERS);
  ensureSheet_(ss, SHEETS.settings, SETTINGS_HEADERS);
  ensureSheet_(ss, SHEETS.logs, LOG_HEADERS);
  ensureDefaultSettings_(ss.getSheetByName(SHEETS.settings));
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const empty = current.every((value) => value === "");
  if (empty || current.join("|") !== headers.join("|")) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureDefaultSettings_(sheet) {
  const existing = rowsToObjects_(sheet).map((row) => row.Key);
  const missing = DEFAULT_SETTINGS.filter((row) => existing.indexOf(row[0]) === -1);
  if (missing.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, SETTINGS_HEADERS.length).setValues(missing);
  }
}

function rowsToObjects_(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(rowHasValue_).map((row) => rowToObject_(headers, row));
}

function rowToObject_(headers, row) {
  const object = {};
  headers.forEach((header, index) => {
    object[header] = row[index];
  });
  return object;
}

function rowHasValue_(row) {
  return row.some((value) => value !== "" && value !== null);
}

function appendObject_(sheet, headers, object) {
  const row = headers.map((header) => object[header] !== undefined ? object[header] : "");
  sheet.appendRow(row);
}

function findInvoiceRow_(invoiceId) {
  const sheet = getSpreadsheet_().getSheetByName(SHEETS.invoices);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf("Invoice ID");
  for (let i = 1; i < values.length; i += 1) {
    if (values[i][idIndex] === invoiceId) {
      return {
        sheet,
        headers,
        rowNumber: i + 1,
        rowValues: values[i],
        invoice: rowToObject_(headers, values[i]),
      };
    }
  }
  throw new Error("Invoice not found.");
}

function updateInvoice_(invoiceId, fields) {
  const found = findInvoiceRow_(invoiceId);
  Object.keys(fields).forEach((key) => {
    const index = found.headers.indexOf(key);
    if (index !== -1) {
      found.rowValues[index] = fields[key];
    }
  });
  found.sheet.getRange(found.rowNumber, 1, 1, found.headers.length).setValues([found.rowValues]);
  return rowToObject_(found.headers, found.rowValues);
}

function listInvoices_() {
  const ss = getSpreadsheet_();
  return {
    ok: true,
    invoices: rowsToObjects_(ss.getSheetByName(SHEETS.invoices)),
    items: rowsToObjects_(ss.getSheetByName(SHEETS.items)),
  };
}

function createInvoice_(request) {
  const ss = getSpreadsheet_();
  const invoicesSheet = ss.getSheetByName(SHEETS.invoices);
  const itemsSheet = ss.getSheetByName(SHEETS.items);
  const invoice = request.invoice || {};
  const items = request.items || [];
  const user = request.user || "User";
  const now = new Date();
  const invoiceNo = String(invoice.invoiceNo || "").trim();

  if (!invoiceNo) throw new Error("Internal invoice number is required.");
  if (!invoice.customerName) throw new Error("Customer name is required.");

  const existing = rowsToObjects_(invoicesSheet).some((row) => row["Internal Invoice No"] === invoiceNo);
  if (existing) {
    throw new Error("This internal invoice number already exists.");
  }

  const invoiceId = Utilities.getUuid();
  const invoiceObject = {
    "Invoice ID": invoiceId,
    "Internal Invoice No": invoiceNo,
    "Document Type": invoice.documentType || "Payment Request",
    Status: "Sent",
    "SQL Status": "Not Uploaded",
    "Customer Name": invoice.customerName || "",
    "SQL Customer Code": invoice.sqlCustomerCode || "",
    "Customer Email": invoice.customerEmail || "",
    "Customer Phone": invoice.customerPhone || "",
    "Billing Address": invoice.billingAddress || "",
    "Invoice Date": invoice.invoiceDate || "",
    "Due Date": invoice.dueDate || "",
    Currency: invoice.currency || "RM",
    Subtotal: number_(invoice.subtotal),
    Discount: number_(invoice.discount),
    Tax: number_(invoice.tax),
    Total: number_(invoice.total),
    Notes: invoice.notes || "",
    Terms: invoice.terms || "",
    TIN: invoice.tin || "",
    "ID Type": invoice.idType || "",
    "ID No": invoice.idNo || "",
    "PDF File URL": invoice.pdfUrl || "",
    "Created By": user,
    "Created At": now,
    "Updated At": now,
    "Sent At": now,
    "Paid At": "",
    "Payment Ref": "",
    "Payment Proof URL": "",
    "Uploaded To SQL At": "",
    "Uploaded By": "",
    "Cancelled At": "",
    "Cancelled Reason": "",
  };

  appendObject_(invoicesSheet, INVOICE_HEADERS, invoiceObject);

  items.forEach((item, index) => {
    appendObject_(itemsSheet, ITEM_HEADERS, {
      "Item ID": Utilities.getUuid(),
      "Invoice ID": invoiceId,
      "Internal Invoice No": invoiceNo,
      Sequence: index + 1,
      "Item Code": item.itemCode || "",
      Description: item.description || "",
      Quantity: number_(item.quantity),
      UOM: item.uom || "",
      "Unit Price": number_(item.unitPrice),
      Discount: number_(item.discount),
      "Tax Code": item.taxCode || "",
      "Tax Amount": number_(item.taxAmount),
      Amount: number_(item.amount),
      "Account Code": item.accountCode || "",
      "Created At": now,
      "Updated At": now,
    });
  });

  log_(user, "createInvoice", invoiceId, invoiceNo, "Invoice created.");
  return {
    ok: true,
    invoice: {
      invoiceId,
      invoiceNo,
    },
  };
}

function markPaid_(request) {
  const user = request.user || "User";
  const paymentDate = request.paymentDate || dateOnly_(new Date());
  const invoice = updateInvoice_(request.invoiceId, {
    Status: "Paid",
    "SQL Status": "Not Uploaded",
    "Paid At": paymentDate,
    "Payment Ref": request.paymentRef || "",
    "Payment Proof URL": request.proofUrl || "",
    "Updated At": new Date(),
  });

  appendObject_(getSpreadsheet_().getSheetByName(SHEETS.payments), PAYMENT_HEADERS, {
    "Payment ID": Utilities.getUuid(),
    "Invoice ID": request.invoiceId,
    "Internal Invoice No": invoice["Internal Invoice No"],
    "Amount Paid": invoice.Total,
    "Payment Date": paymentDate,
    "Payment Ref": request.paymentRef || "",
    "Payment Proof URL": request.proofUrl || "",
    "Marked By": user,
    "Created At": new Date(),
  });

  log_(user, "markPaid", request.invoiceId, invoice["Internal Invoice No"], "Invoice marked paid.");
  return {
    ok: true,
    invoiceNo: invoice["Internal Invoice No"],
  };
}

function markUploaded_(request) {
  const user = request.user || "User";
  const invoice = updateInvoice_(request.invoiceId, {
    Status: "Uploaded to SQL",
    "SQL Status": "Uploaded to SQL",
    "Uploaded To SQL At": new Date(),
    "Uploaded By": user,
    "Updated At": new Date(),
  });
  log_(user, "markUploaded", request.invoiceId, invoice["Internal Invoice No"], "Invoice uploaded to SQL.");
  return {
    ok: true,
    invoiceNo: invoice["Internal Invoice No"],
  };
}

function cancelInvoice_(request) {
  const user = request.user || "User";
  const invoice = updateInvoice_(request.invoiceId, {
    Status: "Cancelled",
    "Cancelled At": new Date(),
    "Cancelled Reason": request.reason || "",
    "Updated At": new Date(),
  });
  log_(user, "cancelInvoice", request.invoiceId, invoice["Internal Invoice No"], request.reason || "");
  return {
    ok: true,
    invoiceNo: invoice["Internal Invoice No"],
  };
}

function refreshSqlExport_(request) {
  const ss = getSpreadsheet_();
  const invoices = rowsToObjects_(ss.getSheetByName(SHEETS.invoices));
  const items = rowsToObjects_(ss.getSheetByName(SHEETS.items));
  const settings = settingsMap_();
  const rows = [];

  invoices
    .filter((invoice) => invoice.Status === "Paid" && invoice["SQL Status"] !== "Uploaded to SQL")
    .forEach((invoice) => {
      const invoiceItems = items.filter((item) => item["Invoice ID"] === invoice["Invoice ID"]);
      invoiceItems.forEach((item, index) => {
        rows.push(buildSqlRow_(invoice, item, index + 1, settings));
      });
    });

  const exportSheet = ss.getSheetByName(SHEETS.sqlExport);
  exportSheet.clearContents();
  exportSheet.getRange(1, 1, 1, SQL_HEADERS.length).setValues([SQL_HEADERS]);
  if (rows.length) {
    exportSheet.getRange(2, 1, rows.length, SQL_HEADERS.length).setValues(rows);
  }
  exportSheet.setFrozenRows(1);

  log_(request.user || "User", "refreshSqlExport", "", "", "Prepared " + rows.length + " SQL row(s).");
  return {
    ok: true,
    headers: SQL_HEADERS,
    rows,
  };
}

function buildSqlRow_(invoice, item, sequence, settings) {
  const row = new Array(SQL_HEADERS.length).fill("");
  const address = splitAddress_(invoice["Billing Address"]);
  const set = (column, value) => {
    const index = SQL_HEADERS.indexOf(column);
    if (index !== -1) row[index] = value === undefined || value === null ? "" : value;
  };

  set("DOCNO(20)", "<<New>>");
  set("DOCDATE", formatForSqlDate_(invoice["Invoice Date"] || invoice["Paid At"]));
  set("CODE(10)", invoice["SQL Customer Code"] || setting_(settings, "DEFAULT_CUSTOMER_CODE", ""));
  set("COMPANYNAME(100)", invoice["Customer Name"]);
  set("ADDRESS1(60)", address[0] || "");
  set("ADDRESS2(60)", address[1] || "");
  set("ADDRESS3(60)", address[2] || "");
  set("ADDRESS4(60)", address[3] || "");
  set("COUNTRY(2)", setting_(settings, "DEFAULT_COUNTRY", "MY"));
  set("PHONE1(200)", invoice["Customer Phone"]);
  set("AGENT(10)", setting_(settings, "DEFAULT_AGENT", "----"));
  set("TERMS(10)", invoice.Terms || setting_(settings, "DEFAULT_TERMS", "C.O.D."));
  set("DESCRIPTION(200)", invoice.Notes || setting_(settings, "DEFAULT_DESCRIPTION", "Payment request"));
  set("PROJECT(20)", setting_(settings, "DEFAULT_PROJECT", "----"));
  set("DOCREF1", invoice["Internal Invoice No"]);
  set("TIN(14)", invoice.TIN);
  set("IDTYPE", invoice["ID Type"]);
  set("IDNO(20)", invoice["ID No"]);
  set("SUBMISSIONTYPE", setting_(settings, "DEFAULT_SUBMISSION_TYPE", "17"));

  set("_SEQ", sequence);
  set("_ACCOUNT(10)", item["Account Code"] || setting_(settings, "DEFAULT_ACCOUNT_CODE", "510-000"));
  set("_ITEMCODE(30)", item["Item Code"]);
  set("_DESCRIPTION(200)", item.Description);
  set("_QTY", number_(item.Quantity));
  set("_UOM(10)", item.UOM || setting_(settings, "DEFAULT_UOM", "UNIT"));
  set("_UNITPRICE", number_(item["Unit Price"]));
  set("_DISC(20)", number_(item.Discount));
  set("_TAX(10)", item["Tax Code"]);
  set("_TAXAMT", number_(item["Tax Amount"]));
  set("_TAXINCLUSIVE", setting_(settings, "DEFAULT_TAX_INCLUSIVE", "F"));
  set("_AMOUNT", number_(item.Amount));
  set("_PROJECT(20)", setting_(settings, "DEFAULT_PROJECT", "----"));

  return row;
}

function settingsMap_() {
  const rows = rowsToObjects_(getSpreadsheet_().getSheetByName(SHEETS.settings));
  const settings = {};
  rows.forEach((row) => {
    settings[row.Key] = row.Value;
  });
  return settings;
}

function setting_(settings, key, fallback) {
  const value = settings[key];
  return value === "" || value === undefined || value === null ? fallback : value;
}

function splitAddress_(address) {
  return String(address || "")
    .split(/\n+/)
    .map((line) => line.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 4);
}

function number_(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function dateOnly_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function formatForSqlDate_(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  const text = String(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return text;
}

function log_(user, action, invoiceId, invoiceNo, details) {
  const sheet = getSpreadsheet_().getSheetByName(SHEETS.logs);
  appendObject_(sheet, LOG_HEADERS, {
    Timestamp: new Date(),
    User: user,
    Action: action,
    "Invoice ID": invoiceId,
    "Internal Invoice No": invoiceNo,
    Details: details,
  });
}
