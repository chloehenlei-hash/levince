import {
  createServiceDate,
  createServiceGroup,
  createServiceLine,
  DEFAULT_FOOTER_TEXT,
  DEFAULT_HEADER_LABELS,
  DEFAULT_NOTES_TITLE,
  DEFAULT_PAYMENT_NOTES,
  normaliseInvoiceData,
} from "../pdf/invoicePdf.js";

const PDF_EXT_RE = /\.pdf$/i;
const CURRENCY_RE = /^(RM|MYR|TWD|NTD|USD|SGD|HKD|AUD|GBP|EUR|JPY|CNY|RMB|THB|IDR|PHP|KRW)$/i;
const DATE_RE =
  /^(?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+\d{4})?|\d{1,2}\s*[-–—]\s*\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?)$/i;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function textAmount(value) {
  const text = clean(value);
  const negative = /^\(.+\)$/.test(text) || /^-/.test(text);
  const number = text.replace(/[(),]/g, "").replace(/[^\d.-]/g, "");
  const parsed = Number(number);
  if (!Number.isFinite(parsed)) return "";
  return String(negative && parsed > 0 ? -parsed : parsed);
}

function fileLooksLikePdf(file) {
  return file && (file.type === "application/pdf" || PDF_EXT_RE.test(file.name || ""));
}

function rowText(items) {
  return clean(items.map((item) => item.str).join(" "));
}

function rowsFromItems(items) {
  const rows = [];
  items
    .filter((item) => clean(item.str))
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .forEach((item) => {
      let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
      if (!row) {
        row = { y: item.y, items: [] };
        rows.push(row);
      }
      row.items.push(item);
    });
  rows.forEach((row) => row.items.sort((a, b) => a.x - b.x));
  return rows.sort((a, b) => b.y - a.y);
}

async function loadPdfJs() {
  return import("pdfjs-dist/legacy/build/pdf.js");
}

async function extractRows(file) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const all = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    content.items.forEach((item) => {
      const [, , , , x, y] = item.transform || [];
      all.push({ str: item.str, x, y, page: pageNo });
    });
  }
  return rowsFromItems(all);
}

function parseHeader(rows) {
  const data = {};
  const headerRows = rows.filter((row) => row.y > 615 && row.y < 735);
  const fields = ["companyName", "customerName", "email", "phone", "invoiceDate", "invoiceTitle"];
  headerRows.slice(0, fields.length).forEach((row, index) => {
    data[fields[index]] = clean(row.items.filter((item) => item.x > 195).map((item) => item.str).join(" ")).replace(
      /^:\s*/,
      "",
    );
  });
  return data;
}

function parseDocumentInfo(rows) {
  const leftRows = rows.filter((row) => row.items.some((item) => item.x < 185) && row.y > 570 && row.y < 630);
  const texts = leftRows.map((row) => rowText(row.items.filter((item) => item.x < 185))).filter(Boolean);
  return {
    documentLabel: texts.find((text) => /^(INVOICE|QUOTATION|RECEIPT)$/i.test(text)) || "INVOICE",
    receiptNumber: texts.find((text) => /\d{3,}/.test(text)) || "",
  };
}

function parseTable(rows) {
  const tableRows = rows.filter((row) => row.y > 220 && row.y < 590);
  let heading = "Private Chauffeur Service";
  let currentDate = "";
  const dates = [];
  const currencies = [];

  function getDate(date) {
    let found = dates.find((row) => row.date === date);
    if (!found) {
      found = { date, lines: [] };
      dates.push(found);
    }
    return found;
  }

  tableRows.forEach((row) => {
    const description = clean(row.items.filter((item) => item.x >= 190 && item.x < 395).map((item) => item.str).join(" "));
    const qty = clean(row.items.filter((item) => item.x >= 395 && item.x < 465).map((item) => item.str).join(" "));
    const amountTokens = row.items.filter((item) => item.x >= 465).map((item) => clean(item.str)).filter(Boolean);
    const amount = textAmount(amountTokens.join(" "));
    amountTokens.forEach((token) => {
      if (CURRENCY_RE.test(token)) currencies.push(token.toUpperCase() === "MYR" ? "RM" : token.toUpperCase());
    });

    if (!description || /^description$/i.test(description) || /^(subtotal|total)$/i.test(description)) return;
    if (amount) {
      getDate(currentDate || "Service").lines.push(createServiceLine({ description, qty: qty || "1", amount }));
      return;
    }
    if (DATE_RE.test(description)) {
      currentDate = description;
      getDate(currentDate);
      return;
    }
    if (!currentDate && /service/i.test(description)) {
      heading = description;
      return;
    }
    if (!currentDate) {
      currentDate = description;
      getDate(currentDate);
      return;
    }
    getDate(currentDate || "Service").lines.push(createServiceLine({ description, isRemark: true, isNote: true }));
  });

  return {
    currency: currencies[0] || "RM",
    serviceGroups: [createServiceGroup({ heading, dates: dates.length ? dates.map(createServiceDate) : undefined })],
  };
}

export async function parsePastedPdfInvoice(file, currentInvoice = {}) {
  if (!fileLooksLikePdf(file)) throw new Error("Please paste a PDF file.");
  const rows = await extractRows(file);
  if (!rows.length) throw new Error("Cannot read text from this PDF.");
  const next = {
    ...normaliseInvoiceData(currentInvoice),
    ...parseHeader(rows),
    ...parseDocumentInfo(rows),
    ...parseTable(rows),
    notesTitle: currentInvoice.notesTitle || DEFAULT_NOTES_TITLE,
    paymentNotes: currentInvoice.paymentNotes || DEFAULT_PAYMENT_NOTES,
    footerText: currentInvoice.footerText || DEFAULT_FOOTER_TEXT,
    headerLabels: { ...DEFAULT_HEADER_LABELS },
  };
  return normaliseInvoiceData(next);
}

export function getPdfFileFromPaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const files = [
    ...Array.from(event.clipboardData?.files || []),
    ...items.map((item) => item.getAsFile()).filter(Boolean),
  ];
  return files.find(fileLooksLikePdf) || null;
}
