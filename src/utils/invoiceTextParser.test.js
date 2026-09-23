import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyInvoiceData } from "../pdf/invoicePdf.js";
import { parsePastedInvoiceDetails } from "./invoiceTextParser.js";

function parse(text) {
  return parsePastedInvoiceDetails(`${text}\n\n1 September\nAirport Transfer\nRM100`, createEmptyInvoiceData());
}

function lines(invoice) {
  return invoice.serviceGroups.flatMap((group) => group.dates.flatMap((date) => date.lines));
}

test("address and website fill blank display rows without replacing the customer's name", () => {
  const invoice = parse("Name: Jane Doe\nAddress: 12 Main Road\nWebsite: https://example.com");
  assert.equal(invoice.customerName, "Jane Doe");
  assert.equal(invoice.companyName, "12 Main Road");
  assert.equal(invoice.headerLabels.companyName, "ADDRESS");
  assert.equal(invoice.email, "https://example.com");
  assert.equal(invoice.headerLabels.email, "WEBSITE");
  assert.equal(lines(invoice).some((line) => line.description.includes("example.com")), false);
});

test("website alone can use an explicitly empty company row", () => {
  const invoice = parse("Company: -\nName: Jane Doe\nWebsite: example.com");
  assert.equal(invoice.customerName, "Jane Doe");
  assert.equal(invoice.companyName, "example.com");
  assert.equal(invoice.headerLabels.companyName, "WEBSITE");
});

test("website becomes a remark when all eligible rows are occupied", () => {
  const invoice = parse("Company: Acme\nName: Jane Doe\nEmail: jane@acme.com\nPhone: 0123456789\nWebsite: https://acme.com");
  assert.equal(invoice.customerName, "Jane Doe");
  assert.equal(invoice.companyName, "Acme");
  assert.equal(invoice.email, "jane@acme.com");
  assert.equal(invoice.phone, "0123456789");
  const remark = lines(invoice).find((line) => line.description === "WEBSITE: https://acme.com");
  assert.equal(remark?.isRemark, true);
  assert.equal(remark?.amount, "");
});

test("an address takes the only blank row and the website remains visible as a remark", () => {
  const invoice = parse("Name: Jane Doe\nEmail: jane@example.com\nPhone: 0123456789\nAddress: 12 Main Road\nWebsite: example.com");
  assert.equal(invoice.companyName, "12 Main Road");
  assert.equal(invoice.headerLabels.companyName, "ADDRESS");
  assert.equal(lines(invoice).find((line) => line.description === "WEBSITE: example.com")?.isRemark, true);
});
