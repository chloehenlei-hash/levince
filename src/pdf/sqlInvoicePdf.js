import { PDFDocument } from "pdf-lib";
import { moneyWords, sqlLineTotal, sqlTotals } from "../utils/sqlInvoice.js";

export async function generateSqlInvoicePdf(invoice) {
  const doc = await PDFDocument.create();
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = 612 * scale;
  canvas.height = 792 * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser cannot render the invoice PDF.");
  const money = (n) => Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function font(size = 10, bold = false, family = "Tahoma") {
    ctx.font = `${bold ? "700" : "400"} ${size}px ${family}, Arial, "PingFang SC", sans-serif`;
  }
  function text(value, x, y, size = 10, bold = false, align = "left", width) {
    font(size, bold);
    ctx.textAlign = align;
    ctx.fillStyle = "#000";
    const args = [String(value || ""), x, y];
    if (width) args.push(width);
    ctx.fillText(...args);
  }
  function rule(x1, y1, x2, y2, thickness = 0.6) {
    ctx.lineWidth = thickness;
    ctx.strokeStyle = "#000";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function wrap(value, width, size = 10) {
    font(size);
    const output = [];
    for (const paragraph of String(value || "").split("\n")) {
      let line = "";
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > width) { output.push(line.trimEnd()); line = ""; }
        line += char;
      }
      if (line) output.push(line.trimEnd());
    }
    return output;
  }
  const rows = [];
  let previousDate = "";
  for (const line of invoice.lines) {
    const heading = line.date && line.date !== previousDate ? line.date.toUpperCase() : "";
    previousDate = line.date;
    const description = wrap(line.description.toUpperCase().replace(/\s+-\s+/g, "\n"), 236);
    rows.push({ line, heading, description, height: (description.length + (heading ? 1 : 0)) * 13 + 8 });
  }
  const pages = [[]];
  let used = 0;
  for (const row of rows) {
    // Split exceptionally long notes across pages rather than clipping the totals.
    const maxLines = 24;
    for (let offset = 0; offset < row.description.length; offset += maxLines) {
      const description = row.description.slice(offset, offset + maxLines);
      const part = { ...row, description, heading: offset === 0 ? row.heading : "", line: offset === 0 ? row.line : { ...row.line, note: true } };
      part.height = (description.length + (part.heading ? 1 : 0)) * 13 + 8;
      if (used + part.height > 337 && pages.at(-1).length) { pages.push([]); used = 0; }
      pages.at(-1).push(part); used += part.height;
    }
  }
  const total = sqlTotals(invoice.lines).gross;
  for (const [pageIndex, pageRows] of pages.entries()) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 612, 792);
    font(16, true, '"Times New Roman"'); ctx.fillStyle = "#000"; ctx.textAlign = "left";
    ctx.fillText("VINCENOLOGY (M) SDN BHD", 99, 25);
    font(8, false, '"Times New Roman"'); ctx.fillText("(202101041653 (1441953K))", 329, 25);
    font(11, false, '"Times New Roman"');
    ctx.fillText("N-11-2, PUSAT PERDAGANGAN BANDAR BUKIT JALIL,", 99, 38);
    ctx.fillText("JALAN PERSIARAN 3, BUKIT JALIL, 57000 KUALA LUMPUR", 99, 51);
    ctx.fillText("(TIN No: C26898543100)", 99, 64);
    rule(22, 90, 594, 90, 1);
    const company = (invoice.company || "CASH SALES").toUpperCase();
    const recipient = [company, ...invoice.address.toUpperCase().split("\n"), invoice.email].filter(Boolean).flatMap((v) => wrap(v, 284));
    if (recipient.length > 5) throw new Error("Customer address is too long. Keep the address to five lines including company and email.");
    recipient.forEach((value, i) => text(value, 39, 120 + i * 12));
    if (invoice.name) text(`Attn : ${invoice.name}`, 39, 183, 10, false, "left", 285);
    if (invoice.phone) text(`TEL : ${invoice.phone}`, 39, 196, 10, false, "left", 285);
    for (const [x, direction] of [[32, 1], [336, -1]]) {
      rule(x, 108, x + direction * 22, 108); rule(x, 108, x, 124);
      rule(x, 200, x + direction * 22, 200); rule(x, 182, x, 200);
    }
    text("INVOICE", 382, 105, 12, true);
    text(`: ${invoice.number}`, 446, 105, 12, true, "left", 145);
    const [year, month, day] = invoice.date.split("-");
    [["Your Ref.", invoice.reference], ["Our D/O No", invoice.deliveryNumber], ["Terms", invoice.terms], ["Date", `${day}/${month}/${year}`], ["Page", `${pageIndex + 1} of ${pages.length}`]].forEach(([label, value], i) => {
      const y = 122 + i * 17.3;
      text(label, 382, y); text(":", 447, y); text(value, 455, y, 10, false, "left", 136);
    });
    rule(22, 210, 594, 210, 1);
    text("Description", 137, 223, 9);
    text("Qty", 389, 223, 9);
    text("Price/Unit", 430, 223, 9);
    text("Discount", 478, 223, 9);
    text("Amount (incl. tax)", 594, 223, 9, false, "right");
    rule(22, 227, 594, 227);
    let y = 239;
    for (const row of pageRows) {
      if (row.heading) { text(row.heading, 135, y, 9); y += 13; }
      row.description.forEach((value, i) => text(value, 135, y + i * 13, 9));
      if (!row.line.note) {
        text(money(row.line.qty), 397, y, 9, false, "right");
        text(money(row.line.unitPrice), 469, y, 9, false, "right");
        if (Number(row.line.discount)) text(money(row.line.discount), 513, y, 9, false, "right");
        text(money(sqlLineTotal(row.line).gross), 566, y, 9, false, "right");
      }
      y += row.description.length * 13 + 8;
    }
    rule(22, 578, 594, 578);
    if (pageIndex === pages.length - 1) {
      text(`RINGGIT MALAYSIA : ${moneyWords(total)}`, 29, 592, 9, false, "left", 377);
      text("Total (MYR)", 415, 592, 9, true);
      ctx.lineWidth = 1; ctx.strokeRect(472, 581, 94, 16);
      text(money(total), 562, 592, 9, true, "right", 86);
    }
    text("Payment can be made to:", 29, 616, 9);
    text("Maybank 5144-8658-0418 (Vincenology (M) Sdn Bhd)", 29, 627, 9);
    text("BANK SWIFT CODE: MBBEMYKL", 29, 638, 9);
    rule(26, 692, 198, 692, 1);
    text("Authorised Signature", 51, 704, 9, true);
    const image = await doc.embedPng(canvas.toDataURL("image/png"));
    doc.addPage([612, 792]).drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  }
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: "application/pdf" }), filename: `${invoice.number.replace(/\D/g, "")}.pdf` };
}
