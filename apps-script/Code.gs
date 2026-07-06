const SPREADSHEET_ID = "1gMMS_y1z_2wIMUa5fiZwyCA2l0p3KJB64LXx_CBUE78";
const T = { inv: "Invoices", item: "Invoice Items", pay: "Payments", sql: "SQL Export", set: "Settings", log: "Logs" };
const IH = ["Invoice ID","Internal Invoice No","Document Type","Status","SQL Status","Customer Name","SQL Customer Code","Customer Email","Customer Phone","Billing Address","Invoice Date","Due Date","Currency","Subtotal","Discount","Tax","Total","Notes","Terms","TIN","ID Type","ID No","PDF File URL","Created By","Created At","Updated At","Sent At","Paid At","Payment Ref","Payment Proof URL","Uploaded To SQL At","Uploaded By","Cancelled At","Cancelled Reason"];
const ITH = ["Item ID","Invoice ID","Internal Invoice No","Sequence","Item Code","Description","Quantity","UOM","Unit Price","Discount","Tax Code","Tax Amount","Amount","Account Code","Created At","Updated At"];
const PH = ["Payment ID","Invoice ID","Internal Invoice No","Amount Paid","Payment Date","Payment Ref","Payment Proof URL","Marked By","Created At"];
const LH = ["Timestamp","User","Action","Invoice ID","Internal Invoice No","Details"];
const SQLH = ["DOCNO(20)","DOCNOEX","DOCDATE","CODE(10)","EIV_UTC","IRBM_UUID","IRBM_LONGID","IRBM_STATUS","COMPANYNAME(100)","ADDRESS1(60)","ADDRESS2(60)","ADDRESS3(60)","ADDRESS4(60)","POSTCODE(10)","CITY(50)","STATE(50)","COUNTRY(2)","PHONE1(200)","AGENT(10)","TERMS(10)","DESCRIPTION(200)","PROJECT(20)","CC(200)","DOCREF1","DOCREF2","DOCREF3","DOCREF4","SALESTAXNO(25)","SERVICETAXNO(25)","TIN(14)","IDTYPE","IDNO(20)","TOURISMNO(17)","SIC(10)","INCOTERMS(3)","SUBMISSIONTYPE","_SEQ","_ACCOUNT(10)","_ITEMCODE(30)","_DESCRIPTION(200)","_DESCRIPTION2","_DESCRIPTION3","_QTY","_UOM(10)","_UNITPRICE","_DISC(20)","_TAX(10)","_TAXAMT","_TAXINCLUSIVE","_AMOUNT","_IRBM_CLASSIFICATION(3)","_TAXEXEMPTIONREASON(300)","_LOCATION(20)","_BATCH(30)","_PROJECT(20)","_REMARK1(200)","_REMARK2(200)","_FROMDOCTYPE","_FROMDOCNO","_FROMSEQNO"];
const DEF = [["DEFAULT_CUSTOMER_CODE","","Fallback SQL customer code."],["DEFAULT_ACCOUNT_CODE","510-000","Fallback GL sales account code."],["DEFAULT_UOM","UNIT","Fallback UOM."],["DEFAULT_TERMS","C.O.D.","Fallback terms."],["DEFAULT_AGENT","----","Fallback agent."],["DEFAULT_PROJECT","----","Fallback project."],["DEFAULT_SUBMISSION_TYPE","17","Confirm with accountant."],["DEFAULT_TAX_INCLUSIVE","F","F=false, T=true."],["DEFAULT_COUNTRY","MY","Country code."],["DEFAULT_DESCRIPTION","Payment request","Header description."]];

function doGet() { return json({ ok: true, app: "Levince Invoice Workflow" }); }
function doPost(e) {
  try {
    const q = JSON.parse((e.postData && e.postData.contents) || "{}");
    setup();
    const map = { setup: () => ({ ok: true }), listInvoices, createInvoice, markPaid, markUploaded, cancelInvoice, refreshSqlExport };
    if (!map[q.action]) throw new Error("Unknown action: " + q.action);
    return json(map[q.action](q));
  } catch (err) { return json({ ok: false, error: err.message || String(err) }); }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function setup() {
  ensure(T.inv, IH); ensure(T.item, ITH); ensure(T.pay, PH); ensure(T.sql, SQLH);
  ensure(T.set, ["Key","Value","Notes"]); ensure(T.log, LH);
  const keys = rows(T.set).map(r => r.Key), add = DEF.filter(r => keys.indexOf(r[0]) < 0);
  if (add.length) ss().getSheetByName(T.set).getRange(last(T.set) + 1, 1, add.length, 3).setValues(add);
}
function ensure(name, heads) {
  const book = ss(), sheet = book.getSheetByName(name) || book.insertSheet(name);
  const row = sheet.getRange(1, 1, 1, heads.length).getValues()[0];
  if (row.join("|") !== heads.join("|")) sheet.getRange(1, 1, 1, heads.length).setValues([heads]);
  sheet.setFrozenRows(1); return sheet;
}
function last(name) { return ss().getSheetByName(name).getLastRow(); }
function rows(name) {
  const vals = ss().getSheetByName(name).getDataRange().getValues();
  if (vals.length < 2) return [];
  const h = vals[0]; return vals.slice(1).filter(r => r.some(v => v !== "")).map(r => obj(h, r));
}
function obj(h, r) { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; }
function append(name, h, o) { ss().getSheetByName(name).appendRow(h.map(k => o[k] === undefined ? "" : o[k])); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function now() { return new Date(); }
function user(q) { return q.user || "User"; }
function log(q, action, id, no, detail) {
  append(T.log, LH, { Timestamp: now(), User: user(q), Action: action, "Invoice ID": id, "Internal Invoice No": no, Details: detail || "" });
}

function listInvoices() { return { ok: true, invoices: rows(T.inv), items: rows(T.item) }; }
function createInvoice(q) {
  const inv = q.invoice || {}, items = q.items || [], no = String(inv.invoiceNo || "").trim();
  if (!no) throw new Error("Document number is required.");
  if (!inv.customerName) throw new Error("Customer name is required.");
  if (rows(T.inv).some(r => r["Internal Invoice No"] === no)) throw new Error("This document number already exists.");
  const id = Utilities.getUuid(), t = now();
  append(T.inv, IH, {"Invoice ID":id,"Internal Invoice No":no,"Document Type":inv.documentType||"INVOICE",Status:"Sent","SQL Status":"Not Uploaded","Customer Name":inv.customerName||"","SQL Customer Code":inv.sqlCustomerCode||"","Customer Email":inv.customerEmail||"","Customer Phone":inv.customerPhone||"","Billing Address":inv.billingAddress||"","Invoice Date":inv.invoiceDate||"","Due Date":inv.dueDate||"",Currency:inv.currency||"RM",Subtotal:num(inv.subtotal),Discount:num(inv.discount),Tax:num(inv.tax),Total:num(inv.total),Notes:inv.notes||"",Terms:inv.terms||"",TIN:inv.tin||"","ID Type":inv.idType||"","ID No":inv.idNo||"","PDF File URL":inv.pdfUrl||"","Created By":user(q),"Created At":t,"Updated At":t,"Sent At":t});
  items.forEach((it, i) => append(T.item, ITH, {"Item ID":Utilities.getUuid(),"Invoice ID":id,"Internal Invoice No":no,Sequence:i+1,"Item Code":it.itemCode||"",Description:it.description||"",Quantity:num(it.quantity),UOM:it.uom||"", "Unit Price":num(it.unitPrice),Discount:num(it.discount),"Tax Code":it.taxCode||"","Tax Amount":num(it.taxAmount),Amount:num(it.amount),"Account Code":it.accountCode||"","Created At":t,"Updated At":t}));
  log(q, "createInvoice", id, no, "Created"); return { ok: true, invoice: { invoiceId: id, invoiceNo: no } };
}

function findInv(id) {
  const sh = ss().getSheetByName(T.inv), vals = sh.getDataRange().getValues(), h = vals[0], ix = h.indexOf("Invoice ID");
  for (let i = 1; i < vals.length; i++) if (vals[i][ix] === id) return { sh, h, row: i + 1, vals: vals[i], inv: obj(h, vals[i]) };
  throw new Error("Invoice not found.");
}
function updateInv(id, patch) {
  const f = findInv(id);
  Object.keys(patch).forEach(k => { const i = f.h.indexOf(k); if (i >= 0) f.vals[i] = patch[k]; });
  f.sh.getRange(f.row, 1, 1, f.h.length).setValues([f.vals]); return obj(f.h, f.vals);
}
function markPaid(q) {
  const d = q.paymentDate || Utilities.formatDate(now(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const inv = updateInv(q.invoiceId, { Status:"Paid","SQL Status":"Not Uploaded","Paid At":d,"Payment Ref":q.paymentRef||"","Payment Proof URL":q.proofUrl||"","Updated At":now() });
  append(T.pay, PH, {"Payment ID":Utilities.getUuid(),"Invoice ID":q.invoiceId,"Internal Invoice No":inv["Internal Invoice No"],"Amount Paid":inv.Total,"Payment Date":d,"Payment Ref":q.paymentRef||"","Payment Proof URL":q.proofUrl||"","Marked By":user(q),"Created At":now()});
  log(q, "markPaid", q.invoiceId, inv["Internal Invoice No"], "Paid"); return { ok: true, invoiceNo: inv["Internal Invoice No"] };
}
function markUploaded(q) {
  const inv = updateInv(q.invoiceId, { Status:"Uploaded to SQL","SQL Status":"Uploaded to SQL","Uploaded To SQL At":now(),"Uploaded By":user(q),"Updated At":now() });
  log(q, "markUploaded", q.invoiceId, inv["Internal Invoice No"], "Uploaded"); return { ok: true, invoiceNo: inv["Internal Invoice No"] };
}
function cancelInvoice(q) {
  const inv = updateInv(q.invoiceId, { Status:"Cancelled","Cancelled At":now(),"Cancelled Reason":q.reason||"","Updated At":now() });
  log(q, "cancelInvoice", q.invoiceId, inv["Internal Invoice No"], q.reason || ""); return { ok: true, invoiceNo: inv["Internal Invoice No"] };
}

function settings() { const o = {}; rows(T.set).forEach(r => o[r.Key] = r.Value); return o; }
function pick(s, k, d) { return s[k] === "" || s[k] == null ? d : s[k]; }
function sqlDate(v) {
  if (!v) return ""; if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy");
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}
function splitAddr(v) { return String(v || "").split(/\n+/).map(x => x.trim().slice(0,60)).filter(Boolean).slice(0,4); }
function sqlRow(inv, item, seq, s) {
  const r = Array(SQLH.length).fill(""), a = splitAddr(inv["Billing Address"]);
  const set = (c, v) => { const i = SQLH.indexOf(c); if (i >= 0) r[i] = v == null ? "" : v; };
  set("DOCNO(20)","<<New>>"); set("DOCDATE",sqlDate(inv["Invoice Date"]||inv["Paid At"])); set("CODE(10)",inv["SQL Customer Code"]||pick(s,"DEFAULT_CUSTOMER_CODE",""));
  set("COMPANYNAME(100)",inv["Customer Name"]); set("ADDRESS1(60)",a[0]||""); set("ADDRESS2(60)",a[1]||""); set("ADDRESS3(60)",a[2]||""); set("ADDRESS4(60)",a[3]||"");
  set("COUNTRY(2)",pick(s,"DEFAULT_COUNTRY","MY")); set("PHONE1(200)",inv["Customer Phone"]); set("AGENT(10)",pick(s,"DEFAULT_AGENT","----")); set("TERMS(10)",inv.Terms||pick(s,"DEFAULT_TERMS","C.O.D."));
  set("DESCRIPTION(200)",inv.Notes||pick(s,"DEFAULT_DESCRIPTION","Payment request")); set("PROJECT(20)",pick(s,"DEFAULT_PROJECT","----")); set("DOCREF1",inv["Internal Invoice No"]);
  set("TIN(14)",inv.TIN); set("IDTYPE",inv["ID Type"]); set("IDNO(20)",inv["ID No"]); set("SUBMISSIONTYPE",pick(s,"DEFAULT_SUBMISSION_TYPE","17"));
  set("_SEQ",seq); set("_ACCOUNT(10)",item["Account Code"]||pick(s,"DEFAULT_ACCOUNT_CODE","510-000")); set("_ITEMCODE(30)",item["Item Code"]); set("_DESCRIPTION(200)",item.Description);
  set("_QTY",num(item.Quantity)); set("_UOM(10)",item.UOM||pick(s,"DEFAULT_UOM","UNIT")); set("_UNITPRICE",num(item["Unit Price"])); set("_DISC(20)",num(item.Discount));
  set("_TAX(10)",item["Tax Code"]); set("_TAXAMT",num(item["Tax Amount"])); set("_TAXINCLUSIVE",pick(s,"DEFAULT_TAX_INCLUSIVE","F")); set("_AMOUNT",num(item.Amount)); set("_PROJECT(20)",pick(s,"DEFAULT_PROJECT","----"));
  return r;
}
function refreshSqlExport(q) {
  const invs = rows(T.inv).filter(i => i.Status === "Paid" && i["SQL Status"] !== "Uploaded to SQL"), items = rows(T.item), s = settings(), out = [];
  invs.forEach(inv => items.filter(it => it["Invoice ID"] === inv["Invoice ID"]).forEach((it, i) => out.push(sqlRow(inv, it, i + 1, s))));
  const sh = ss().getSheetByName(T.sql); sh.clearContents(); sh.getRange(1,1,1,SQLH.length).setValues([SQLH]); if (out.length) sh.getRange(2,1,out.length,SQLH.length).setValues(out); sh.setFrozenRows(1);
  log(q, "refreshSqlExport", "", "", `Prepared ${out.length} row(s)`); return { ok: true, headers: SQLH, rows: out };
}
