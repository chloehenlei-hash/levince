import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createEmptyInvoiceData, generateInvoicePdf } from "./invoicePdf.js";

test("Chinese invoice fields generate a PDF without losing payment details", async () => {
  const logo = await readFile(new URL("../../public/assets/levince-logo.png", import.meta.url));
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const drawnText = [];
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => logo });
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        measureText: (value) => ({ width: value.length * 12, actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 5 }),
        fillText: (value) => drawnText.push(value),
      }),
      toDataURL: () => `data:image/png;base64,${logo.toString("base64")}`,
    }),
  };

  try {
    const invoice = createEmptyInvoiceData();
    invoice.customerName = "王小明";
    invoice.companyName = "测试公司";
    invoice.receiptNumber = "INV-001";
    invoice.serviceGroups[0].heading = "机场接送";
    invoice.serviceGroups[0].dates[0].lines[0].description = "中文服务 +4%";
    invoice.serviceGroups[0].dates[0].lines[0].amount = "104";
    invoice.paymentNotes = "请汇款到指定账户";
    const { blob } = await generateInvoicePdf(invoice);
    const bytes = await blob.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    assert.ok(bytes.byteLength > 1000);
    assert.ok(drawnText.includes("王小明"));
    assert.ok(drawnText.includes("请汇款到指定账户"));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
  }
});
