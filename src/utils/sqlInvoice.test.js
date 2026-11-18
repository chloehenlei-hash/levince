import test from "node:test";
import assert from "node:assert/strict";
import { emptySqlInvoice, moneyWords, nextSqlNumber, organiseSqlInvoice, recordSqlNumber, sqlTotals, validateSqlInvoice } from "./sqlInvoice.js";

test("SQL invoice numbering resets per month and preserves each month's sequence", () => {
  assert.equal(nextSqlNumber("2026-11-18"), "IV-2611/018");
  const sequences = recordSqlNumber("2026-11-18", "IV-2611/018");
  assert.equal(nextSqlNumber("2026-11-19", sequences), "IV-2611/019");
  assert.equal(nextSqlNumber("2026-12-01", sequences), "IV-2612/001");
  assert.equal(nextSqlNumber("2027-01-01", sequences), "IV-2701/001");
  assert.throws(() => recordSqlNumber("2026-12-01", "IV-2611/019"));
});
test("organised SQL service uses pre-tax unit price and 8 percent SST", () => {
  const invoice = organiseSqlInvoice("Name: Aina Nizam\nCompany name: Asian Trails Malaysia\nEmail: aina.nizam@asiantrails.com.my\nMobile: 011 5379 5388\n19th Nov\nAirport Transfer\nAlphard - RM250", emptySqlInvoice("2026-11-18"));
  assert.equal(invoice.name, "Aina Nizam");
  assert.equal(invoice.company, "Asian Trails Malaysia");
  assert.equal(invoice.lines[0].unitPrice, 250);
  assert.deepEqual(sqlTotals(invoice.lines), { net: 250, tax: 20, gross: 270 });
  assert.equal(validateSqlInvoice(invoice), "");
});
test("SQL multi-vehicle booking matches the source chat total", () => {
  const invoice = organiseSqlInvoice("Name: Yong Yee\nCompany: Asian Trails Malaysia\n21st Nov\nAirport Transfer (Meet & Greet)\nStaria - RM350 x 2\nAirport Transfer\n18 seater Van - RM400\n26th Nov\nAirport Transfer\nStaria - RM300 x 2\nAirport Transfer\n18 seater Van - RM400", emptySqlInvoice("2026-11-18"));
  assert.equal(sqlTotals(invoice.lines).gross, 2268);
  assert.equal(invoice.lines.find((line) => line.unitPrice === 350).qty, 2);
});
test("fuel is exempt and credit balance includes the chosen tax deduction", () => {
  const invoice = organiseSqlInvoice("Name: Test\nFuel RM100\nDriver Service RM550\nCredit Balance RM350", emptySqlInvoice("2026-11-18"));
  assert.equal(sqlTotals(invoice.lines).gross, 316);
});
test("English amount words include cents", () => {
  assert.equal(moneyWords(270), "TWO HUNDRED SEVENTY ONLY");
  assert.equal(moneyWords(2268.50), "TWO THOUSAND TWO HUNDRED SIXTY EIGHT AND CENTS FIFTY ONLY");
});
