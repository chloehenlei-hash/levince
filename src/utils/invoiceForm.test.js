import test from "node:test";
import assert from "node:assert/strict";
import { hasFourPercentCharge, nextDocumentNumber, withoutPaymentDetails } from "./invoiceForm.js";
import { parsePastedInvoiceDetails } from "./invoiceTextParser.js";
import { createEmptyInvoiceData, PAYMENT_PROFILES } from "../pdf/invoicePdf.js";

test("CIMB payment profile uses the confirmed SWIFT code", () => {
  assert.match(PAYMENT_PROFILES.cimb.paymentNotes, /Swift Code : CIBBMYKL/);
});

test("document number increments the last numeric part", () => {
  assert.equal(nextDocumentNumber("1"), "2");
  assert.equal(nextDocumentNumber("INV-009"), "INV-010");
  assert.equal(nextDocumentNumber("2026-01A"), "2026-02A");
  assert.equal(nextDocumentNumber(""), "1");
});

test("4% charge clears every payment field without changing invoice lines", () => {
  const invoice = parsePastedInvoiceDetails("company: Example\nname: Test\nRM 100\n+4%", createEmptyInvoiceData());
  assert.equal(hasFourPercentCharge(invoice), true);
  const cleared = withoutPaymentDetails(invoice);
  assert.equal(cleared.paymentProfile, "");
  assert.equal(cleared.notesTitle, "");
  assert.equal(cleared.paymentNotes, "");
  assert.equal(cleared.footerText, "");
  assert.equal(cleared.serviceGroups, invoice.serviceGroups);
});

test("other percentages and note text do not clear payment", () => {
  const other = parsePastedInvoiceDetails("company: Example\nname: Test\nRM 100\n+3%", createEmptyInvoiceData());
  assert.equal(hasFourPercentCharge(other), false);
  other.serviceGroups[0].dates[0].lines[0].description = "0.4%";
  assert.equal(hasFourPercentCharge(other), false);
  const note = createEmptyInvoiceData();
  note.serviceGroups[0].dates[0].lines[0] = { kind: "note", description: "4%", isNote: true };
  assert.equal(hasFourPercentCharge(note), false);
});
