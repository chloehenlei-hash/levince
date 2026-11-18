import { createEmptyInvoiceData } from "../pdf/invoicePdf.js";
import { parsePastedInvoiceDetails } from "./invoiceTextParser.js";

export const SQL_DRAFT_KEY = "levince-sql-pdf-draft";
export const SQL_SEQUENCE_KEY = "levince-sql-pdf-sequences";
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
export function localDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function monthPrefix(date) {
  return `IV-${date.slice(2, 4)}${date.slice(5, 7)}/`;
}
export function nextSqlNumber(date, sequences = {}) {
  const prefix = monthPrefix(date);
  const last = Number(sequences[prefix] ?? (prefix === "IV-2611/" ? 17 : 0));
  return `${prefix}${String(last + 1).padStart(3, "0")}`;
}
export function recordSqlNumber(date, number, sequences = {}) {
  const prefix = monthPrefix(date);
  if (!new RegExp(`^${prefix}\\d{3,}$`).test(number)) throw new Error(`Use ${prefix}001 format for this invoice date.`);
  return { ...sequences, [prefix]: Math.max(Number(sequences[prefix] || 0), Number(number.slice(prefix.length))) };
}
export function emptySqlInvoice(date = localDate(), sequences = {}) {
  return { date, number: nextSqlNumber(date, sequences), company: "", name: "", address: "", email: "", phone: "", reference: "", deliveryNumber: "", terms: "", lines: [newSqlLine()] };
}
export function newSqlLine(values = {}) {
  return { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, date: "", description: "", qty: 1, unitPrice: 0, discount: 0, taxRate: 8, note: false, ...values };
}
export function sqlLineTotal(line) {
  if (line.note) return { net: 0, tax: 0, gross: 0 };
  const net = round(Number(line.qty || 0) * Number(line.unitPrice || 0) - Number(line.discount || 0));
  const tax = round(net * Number(line.taxRate || 0) / 100);
  return { net, tax, gross: round(net + tax) };
}
export function sqlTotals(lines) {
  return lines.reduce((total, line) => {
    const value = sqlLineTotal(line);
    return { net: round(total.net + value.net), tax: round(total.tax + value.tax), gross: round(total.gross + value.gross) };
  }, { net: 0, tax: 0, gross: 0 });
}

export function organiseSqlInvoice(text, current) {
  const parsed = parsePastedInvoiceDetails(text, createEmptyInvoiceData());
  const inputLines = text.split(/\r?\n/).map((line) => line.trim());
  const address = inputLines.find((line) => /^(?:address|billing address)\s*[:：]/i.test(line))?.replace(/^[^:：]+[:：]\s*/, "") || "";
  const lines = parsed.serviceGroups.flatMap((group) => group.dates.flatMap((day) => day.lines
    .filter((line) => !line.isSpacer && line.description.trim())
    .map((line) => {
      const qty = Number(line.qty) || 1;
      const parsedAmount = Number(line.amount || 0);
      const amount = /\bcredit\s*balance\b|余额扣减|餘額扣減/i.test(line.description) ? -Math.abs(parsedAmount) : parsedAmount;
      return newSqlLine({ date: day.date, description: line.description, qty, unitPrice: round(amount / qty), note: !amount, taxRate: /\b(petrol|fuel)\b|油费/i.test(line.description) ? 0 : 8 });
    })));
  const supplementaryAddress = ["companyName", "email", "phone"].filter((field) => /ADDRESS/i.test(parsed.headerLabels[field])).map((field) => parsed[field]).join("\n");
  return { ...current, company: /COMPANY/i.test(parsed.headerLabels.companyName) ? parsed.companyName : "", name: parsed.customerName, email: /EMAIL/i.test(parsed.headerLabels.email) ? parsed.email : "", phone: /PHONE/i.test(parsed.headerLabels.phone) ? parsed.phone : "", address: address || supplementaryAddress, lines: lines.length ? lines : [newSqlLine()] };
}

export function validateSqlInvoice(invoice) {
  if (!invoice.company.trim() && !invoice.name.trim()) return "Enter a customer or company name.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.date)) return "Choose an invoice date.";
  try { recordSqlNumber(invoice.date, invoice.number); } catch (error) { return error.message; }
  if (!invoice.lines.length || invoice.lines.some((line) => !line.description.trim())) return "Complete each description.";
  if (invoice.lines.some((line) => !line.note && (![line.qty, line.unitPrice, line.discount, line.taxRate].every((v) => Number.isFinite(Number(v))) || Number(line.qty) <= 0 || Number(line.taxRate) < 0 || Number(line.discount) < 0))) return "Check quantities, prices, discounts and tax rates.";
  if (sqlTotals(invoice.lines).gross < 0) return "The invoice total cannot be negative.";
  return "";
}

export function moneyWords(value) {
  const small = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  function words(n) {
    if (n < 20) return small[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${small[n % 10]}` : ""}`;
    for (const [size, label] of [[1e9, "BILLION"], [1e6, "MILLION"], [1000, "THOUSAND"], [100, "HUNDRED"]]) {
      if (n >= size) return `${words(Math.floor(n / size))} ${label}${n % size ? ` ${words(n % size)}` : ""}`;
    }
  }
  const cents = Math.round(value * 100);
  return `${words(Math.floor(cents / 100))}${cents % 100 ? ` AND CENTS ${words(cents % 100)}` : ""} ONLY`;
}
