const SPREADSHEET_ID = "1gMMS_y1z_2wIMUa5fiZwyCA2l0p3KJB64LXx_CBUE78";
const T = { inv: "Invoices", item: "Invoice Items", pay: "Payments", sql: "SQL Export", cust: "SQL Customers", custExp: "Customer Export", set: "Settings", log: "Logs" };
const IH = ["Invoice ID","Internal Invoice No","Document Type","Status","SQL Status","Customer Name","SQL Customer Code","Customer Email","Customer Phone","Billing Address","Invoice Date","Due Date","Currency","Subtotal","Discount","Tax","Total","Notes","Terms","TIN","ID Type","ID No","PDF File URL","Created By","Created At","Updated At","Sent At","Paid At","Payment Ref","Payment Proof URL","Uploaded To SQL At","Uploaded By","Cancelled At","Cancelled Reason"];
const ITH = ["Item ID","Invoice ID","Internal Invoice No","Sequence","Item Code","Description","Quantity","UOM","Unit Price","Discount","Tax Code","Tax Amount","Amount","Account Code","Created At","Updated At"];
const PH = ["Payment ID","Invoice ID","Internal Invoice No","Amount Paid","Payment Date","Payment Ref","Payment Proof URL","Marked By","Created At"];
const LH = ["Timestamp","User","Action","Invoice ID","Internal Invoice No","Details"];
const CSH = ["Customer Key","SQL Customer Code","Customer Name","Status","Customer Email","Customer Phone","Billing Address","TIN","ID Type","ID No","Source Invoice No","Created At","Updated At","Uploaded At","Uploaded By"];
const CUSTH = ["CODE(10)","CONTROLACCOUNT(10)","COMPANYNAME(100)","COMPANYNAME2(100)","COMPANYCATEGORY(10)","AREA(10)","AGENT(10)","CREDITTERM(10)","CREDITLIMIT","OVERDUELIMIT","STATEMENTTYPE","CURRENCYCODE(6)","ALLOWEXCEEDCREDITLIMIT","ADDPDCTOCRLIMIT","AGINGON","STATUS","PRICETAG(10)","CREATIONDATE","TAX(10)","TAXEXEMPTNO(50)","TAXEXPDATE","BRN(30)","BRN2(30)","GSTNO(25)","SALESTAXNO(25)","SERVICETAXNO(25)","TIN(14)","IDTYPE","IDNO(20)","TOURISMNO(17)","SUBMISSIONTYPE","REMARK(80)","_BRANCHNAME(100)","_ADDRESS1(60)","_ADDRESS2(60)","_ADDRESS3(60)","_ADDRESS4(60)","_ATTENTION(70)","_POSTCODE(10)","_CITY(50)","_STATE(50)","_COUNTRY(2)","_PHONE1(200)","_PHONE2(200)","_MOBILE(200)","_FAX1(200)","_FAX2(200)","_EMAIL(200)"];
const SQLH = ["DOCNO(20)","DOCNOEX","DOCDATE","CODE(10)","EIV_UTC","IRBM_UUID","IRBM_LONGID","IRBM_STATUS","COMPANYNAME(100)","ADDRESS1(60)","ADDRESS2(60)","ADDRESS3(60)","ADDRESS4(60)","POSTCODE(10)","CITY(50)","STATE(50)","COUNTRY(2)","PHONE1(200)","AGENT(10)","TERMS(10)","DESCRIPTION(200)","PROJECT(20)","CC(200)","DOCREF1","DOCREF2","DOCREF3","DOCREF4","SALESTAXNO(25)","SERVICETAXNO(25)","TIN(14)","IDTYPE","IDNO(20)","TOURISMNO(17)","SIC(10)","INCOTERMS(3)","SUBMISSIONTYPE","_SEQ","_ACCOUNT(10)","_ITEMCODE(30)","_DESCRIPTION(200)","_DESCRIPTION2","_DESCRIPTION3","_QTY","_UOM(10)","_UNITPRICE","_DISC(20)","_TAX(10)","_TAXAMT","_TAXINCLUSIVE","_AMOUNT","_IRBM_CLASSIFICATION(3)","_TAXEXEMPTIONREASON(300)","_LOCATION(20)","_BATCH(30)","_PROJECT(20)","_REMARK1(200)","_REMARK2(200)","_FROMDOCTYPE","_FROMDOCNO","_FROMSEQNO"];
const DEF = [["DEFAULT_CUSTOMER_CODE","","Fallback SQL customer code."],["DEFAULT_CUSTOMER_CODE_PREFIX","300-C","Auto customer code prefix."],["DEFAULT_CUSTOMER_CONTROL_ACCOUNT","300-000","Customer control account."],["DEFAULT_CUSTOMER_CREDIT_TERM","C.O.D.","Customer credit term."],["DEFAULT_ACCOUNT_CODE","510-000","Fallback GL sales account code."],["DEFAULT_UOM","UNIT","Fallback UOM."],["DEFAULT_TERMS","C.O.D.","Fallback terms."],["DEFAULT_AGENT","----","Fallback agent."],["DEFAULT_PROJECT","----","Fallback project."],["DEFAULT_SUBMISSION_TYPE","17","Confirm with accountant."],["DEFAULT_TAX_INCLUSIVE","F","F=false, T=true."],["DEFAULT_COUNTRY","MY","Country code."],["DEFAULT_DESCRIPTION","Payment request","Header description."]];

function doGet() { return json({ ok: true, app: "Levince Invoice Workflow" }); }
function doPost(e) {
  let q = {};
  try {
    q = req(e);
    setup();
    const map = { setup: () => ({ ok: true }), listInvoices, createInvoice, markPaid, reopenInvoices, markUploaded, markCustomersUploaded, cancelInvoice, refreshSqlExport };
    if (!map[q.action]) throw new Error("Unknown action: " + q.action);
    const out = map[q.action](q);
    return q.transport === "iframe" ? html(out, q.requestId) : json(out);
  } catch (err) {
    const out = { ok: false, error: err.message || String(err) };
    return q.transport === "iframe" ? html(out, q.requestId) : json(out);
  }
}

function req(e) {
  const raw = (e.parameter && e.parameter.payload) || (e.postData && e.postData.contents) || "{}";
  return JSON.parse(raw);
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function html(o, id) {
  const msg = JSON.stringify({ source: "levince-workflow", requestId: id || "", data: o }).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput(`<script>window.top.postMessage(${msg},"*");</script>`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function setup() {
  ensure(T.inv, IH); ensure(T.item, ITH); ensure(T.pay, PH); ensure(T.sql, SQLH); ensure(T.cust, CSH); ensure(T.custExp, CUSTH);
  ensure(T.set, ["Key","Value","Notes"]); ensure(T.log, LH);
  const keys = rows(T.set).map(r => r.Key), add = DEF.filter(r => keys.indexOf(r[0]) < 0);
  if (add.length) ss().getSheetByName(T.set).getRange(last(T.set) + 1, 1, add.length, 3).setValues(add);
}
function ensure(name, heads) {
  const book = ss(), sheet = book.getSheetByName(name) || book.insertSheet(name);
  const row = sheet.getRange(1, 1, 1, heads.length).getValues()[0];
  if (row.join("|") !== heads.join("|")) sheet.getRange(1, 1, 1, heads.length).setValues([heads]);
  heads.forEach((h, i) => { if (/PHONE|MOBILE|FAX/.test(h)) sheet.getRange(2, i + 1, sheet.getMaxRows() - 1, 1).setNumberFormat("@"); });
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
function txt(v) { return v == null || String(v) === "#ERROR!" ? "" : String(v).trim(); }
function phone(v) {
  const s = txt(v); if (!s) return "";
  const d = s.replace(/[^\d]/g, ""), c = ["43","60","61","65","66","82","86","852","853","886","88","971"];
  if (s[0] === "+") return "+" + d;
  return c.some(x => d.indexOf(x) === 0 && d.length > x.length + 5 && d[0] !== "0") ? "+" + d : s;
}
function now() { return new Date(); }
function user(q) { return q.user || "User"; }
function log(q, action, id, no, detail) {
  append(T.log, LH, { Timestamp: now(), User: user(q), Action: action, "Invoice ID": id, "Internal Invoice No": no, Details: detail || "" });
}

function listInvoices() { return { ok: true, invoices: rows(T.inv), items: rows(T.item), customers: rows(T.cust) }; }
function createInvoice(q) {
  const inv = q.invoice || {}, items = q.items || [], no = String(inv.invoiceNo || "").trim();
  if (!no) throw new Error("Document number is required.");
  if (!inv.customerName) throw new Error("Customer name is required.");
  const existing = rows(T.inv).find(r => String(r["Internal Invoice No"]) === no);
  if (existing && !q.overwrite) return { ok: false, code: "DUPLICATE_INVOICE", error: "This document number already exists.", existing: dupInfo(existing) };
  const t = now(), id = existing ? existing["Invoice ID"] : Utilities.getUuid();
  const row = {"Invoice ID":id,"Internal Invoice No":no,"Document Type":inv.documentType||"INVOICE",Status:existing ? existing.Status || "Sent" : "Sent","SQL Status":existing ? existing["SQL Status"] || "Not Uploaded" : "Not Uploaded","Customer Name":inv.customerName||"","SQL Customer Code":inv.sqlCustomerCode||"","Customer Email":inv.customerEmail||"","Customer Phone":phone(inv.customerPhone),"Billing Address":inv.billingAddress||"","Invoice Date":inv.invoiceDate||"","Due Date":inv.dueDate||"",Currency:inv.currency||"RM",Subtotal:num(inv.subtotal),Discount:num(inv.discount),Tax:num(inv.tax),Total:num(inv.total),Notes:inv.notes||"",Terms:inv.terms||"",TIN:inv.tin||"","ID Type":inv.idType||"","ID No":inv.idNo||"","PDF File URL":inv.pdfUrl||"","Created By":existing ? existing["Created By"] : user(q),"Created At":existing ? existing["Created At"] : t,"Updated At":t,"Sent At":existing ? existing["Sent At"] : t,"Paid At":existing ? existing["Paid At"] : "","Payment Ref":existing ? existing["Payment Ref"] : "","Payment Proof URL":existing ? existing["Payment Proof URL"] : "","Uploaded To SQL At":existing ? existing["Uploaded To SQL At"] : "","Uploaded By":existing ? existing["Uploaded By"] : ""};
  if (existing) { updateInv(id, row); deleteItems(id); } else append(T.inv, IH, row);
  items.forEach((it, i) => append(T.item, ITH, {"Item ID":Utilities.getUuid(),"Invoice ID":id,"Internal Invoice No":no,Sequence:i+1,"Item Code":it.itemCode||"",Description:it.description||"",Quantity:num(it.quantity),UOM:it.uom||"", "Unit Price":num(it.unitPrice),Discount:num(it.discount),"Tax Code":it.taxCode||"","Tax Amount":num(it.taxAmount),Amount:num(it.amount),"Account Code":it.accountCode||"","Created At":t,"Updated At":t}));
  log(q, existing ? "overwriteInvoice" : "createInvoice", id, no, existing ? "Overwritten" : "Created"); return { ok: true, overwritten: Boolean(existing), invoice: { invoiceId: id, invoiceNo: no } };
}
function dupInfo(inv) { return { invoiceId: inv["Invoice ID"], invoiceNo: inv["Internal Invoice No"], customerName: inv["Customer Name"], total: inv.Total, status: inv.Status, sqlStatus: inv["SQL Status"] }; }
function deleteItems(id) {
  const sh = ss().getSheetByName(T.item), vals = sh.getDataRange().getValues(), ix = vals[0].indexOf("Invoice ID");
  for (let r = vals.length - 1; r > 0; r--) if (vals[r][ix] === id) sh.deleteRow(r + 1);
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
function reopenInvoices(q) {
  const nos = (q.invoiceNos || []).map(String), invs = rows(T.inv), ids = {}, phones = q.phones || {};
  invs.forEach(inv => { if (nos.indexOf(String(inv["Internal Invoice No"])) >= 0) ids[inv["Invoice ID"]] = inv["Internal Invoice No"]; });
  Object.keys(ids).forEach(id => {
    const no = ids[id], p = { Status:"Sent","SQL Status":"Not Uploaded","Paid At":"","Payment Ref":"","Payment Proof URL":"","Uploaded To SQL At":"","Uploaded By":"","Updated At":now() };
    if (phones[no] !== undefined) p["Customer Phone"] = phone(phones[no]);
    updateInv(id, p);
  });
  const sh = ss().getSheetByName(T.pay), vals = sh.getDataRange().getValues(), h = vals[0], noIx = h.indexOf("Internal Invoice No");
  for (let r = vals.length - 1; r > 0; r--) if (nos.indexOf(String(vals[r][noIx])) >= 0) sh.deleteRow(r + 1);
  log(q, "reopenInvoices", "", "", `Reopened ${Object.keys(ids).length} invoice(s)`); refreshSqlExport(q);
  return { ok: true, count: Object.keys(ids).length, invoiceNos: Object.keys(ids).map(id => ids[id]) };
}
function markUploaded(q) {
  const inv = updateInv(q.invoiceId, { Status:"Uploaded to SQL","SQL Status":"Uploaded to SQL","Uploaded To SQL At":now(),"Uploaded By":user(q),"Updated At":now() });
  log(q, "markUploaded", q.invoiceId, inv["Internal Invoice No"], "Uploaded"); return { ok: true, invoiceNo: inv["Internal Invoice No"] };
}
function markCustomersUploaded(q) {
  const keys = (q.customerKeys || []).map(String), sh = ss().getSheetByName(T.cust), vals = sh.getDataRange().getValues(), h = vals[0], ix = h.indexOf("Customer Key");
  let n = 0; for (let r = 1; r < vals.length; r++) if (keys.indexOf(String(vals[r][ix])) >= 0) {
    ["Status","Uploaded At","Uploaded By","Updated At"].forEach(k => { const i = h.indexOf(k); if (i >= 0) vals[r][i] = k === "Status" ? "Uploaded" : k === "Uploaded By" ? user(q) : now(); }); n++;
  }
  if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, h.length).setValues(vals.slice(1));
  log(q, "markCustomersUploaded", "", "", `Uploaded ${n} customer(s)`); return { ok: true, count: n };
}
function cancelInvoice(q) {
  const inv = updateInv(q.invoiceId, { Status:"Cancelled","Cancelled At":now(),"Cancelled Reason":q.reason||"","Updated At":now() });
  log(q, "cancelInvoice", q.invoiceId, inv["Internal Invoice No"], q.reason || ""); return { ok: true, invoiceNo: inv["Internal Invoice No"] };
}

function settings() { const o = {}; rows(T.set).forEach(r => o[r.Key] = r.Value); return o; }
function pick(s, k, d) { return s[k] === "" || s[k] == null ? d : s[k]; }
function ckey(v) { return String(v || "").trim().replace(/\s+/g, " ").toUpperCase(); }
function nextCode(n, s) { const p = pick(s, "DEFAULT_CUSTOMER_CODE_PREFIX", "300-C"); return (p + String(n).padStart(Math.max(1, 10 - p.length), "0")).slice(0, 10); }
function syncCustomers(invs, s) {
  const cur = rows(T.cust), seen = {}; cur.forEach(c => seen[c["Customer Key"]] = c);
  let next = cur.length + 1;
  invs.forEach(inv => { const k = ckey(inv["Customer Name"]); if (!k || seen[k]) return;
    const c = {"Customer Key":k,"SQL Customer Code":inv["SQL Customer Code"] || nextCode(next++, s),"Customer Name":inv["Customer Name"],Status:"Pending","Customer Email":inv["Customer Email"],"Customer Phone":phone(inv["Customer Phone"]),"Billing Address":inv["Billing Address"],TIN:inv.TIN,"ID Type":inv["ID Type"],"ID No":inv["ID No"],"Source Invoice No":inv["Internal Invoice No"],"Created At":now(),"Updated At":now()};
    append(T.cust, CSH, c); seen[k] = c;
  });
  return rows(T.cust);
}
function custMap(customers) { const m = {}; customers.forEach(c => m[c["Customer Key"]] = c); return m; }
function sqlDate(v) {
  if (!v) return ""; if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy");
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}
function splitAddr(v) { return String(v || "").split(/\n+/).map(x => x.trim().slice(0,60)).filter(Boolean).slice(0,4); }
function custRow(c, branch, s) {
  const r = Array(CUSTH.length).fill(""), a = splitAddr(c["Billing Address"]), set = (col, v) => { const i = CUSTH.indexOf(col); if (i >= 0) r[i] = v == null ? "" : v; };
  set("CODE(10)",c["SQL Customer Code"]); set("CONTROLACCOUNT(10)",pick(s,"DEFAULT_CUSTOMER_CONTROL_ACCOUNT","300-000")); set("COMPANYNAME(100)",c["Customer Name"]); set("COMPANYCATEGORY(10)","----"); set("AREA(10)","----"); set("AGENT(10)",pick(s,"DEFAULT_AGENT","----")); set("CREDITTERM(10)",pick(s,"DEFAULT_CUSTOMER_CREDIT_TERM","C.O.D.")); set("CREDITLIMIT",0); set("OVERDUELIMIT",0); set("STATEMENTTYPE","O"); set("CURRENCYCODE(6)","----"); set("ALLOWEXCEEDCREDITLIMIT","T"); set("ADDPDCTOCRLIMIT","T"); set("AGINGON","I"); set("STATUS","A"); set("TIN(14)",c.TIN); set("IDTYPE",c["ID Type"] || 0); set("IDNO(20)",c["ID No"]); set("SUBMISSIONTYPE",pick(s,"DEFAULT_SUBMISSION_TYPE","17")); set("_BRANCHNAME(100)",branch); set("_ADDRESS1(60)",a[0]||""); set("_ADDRESS2(60)",a[1]||""); set("_ADDRESS3(60)",a[2]||""); set("_ADDRESS4(60)",a[3]||""); set("_COUNTRY(2)",pick(s,"DEFAULT_COUNTRY","MY")); set("_PHONE1(200)",phone(c["Customer Phone"])); set("_EMAIL(200)",c["Customer Email"]); return r;
}
function sqlRow(inv, item, seq, s, cm) {
  const r = Array(SQLH.length).fill(""), a = splitAddr(inv["Billing Address"]);
  const set = (c, v) => { const i = SQLH.indexOf(c); if (i >= 0) r[i] = v == null ? "" : v; };
  const c = cm[ckey(inv["Customer Name"])] || {};
  set("DOCNO(20)","<<New>>"); set("DOCDATE",sqlDate(inv["Invoice Date"]||inv["Paid At"])); set("CODE(10)",c["SQL Customer Code"]||inv["SQL Customer Code"]||pick(s,"DEFAULT_CUSTOMER_CODE",""));
  set("COMPANYNAME(100)",inv["Customer Name"]); set("ADDRESS1(60)",a[0]||""); set("ADDRESS2(60)",a[1]||""); set("ADDRESS3(60)",a[2]||""); set("ADDRESS4(60)",a[3]||"");
  set("COUNTRY(2)",pick(s,"DEFAULT_COUNTRY","MY")); set("PHONE1(200)",phone(inv["Customer Phone"])); set("AGENT(10)",pick(s,"DEFAULT_AGENT","----")); set("TERMS(10)",inv.Terms||pick(s,"DEFAULT_TERMS","C.O.D."));
  set("DESCRIPTION(200)",inv.Notes||pick(s,"DEFAULT_DESCRIPTION","Payment request")); set("PROJECT(20)",pick(s,"DEFAULT_PROJECT","----")); set("DOCREF1",inv["Internal Invoice No"]);
  set("TIN(14)",inv.TIN); set("IDTYPE",inv["ID Type"]); set("IDNO(20)",inv["ID No"]); set("SUBMISSIONTYPE",pick(s,"DEFAULT_SUBMISSION_TYPE","17"));
  set("_SEQ",seq); set("_ACCOUNT(10)",item["Account Code"]||pick(s,"DEFAULT_ACCOUNT_CODE","510-000")); set("_ITEMCODE(30)",item["Item Code"]); set("_DESCRIPTION(200)",item.Description);
  set("_QTY",num(item.Quantity)); set("_UOM(10)",item.UOM||pick(s,"DEFAULT_UOM","UNIT")); set("_UNITPRICE",num(item["Unit Price"])); set("_DISC(20)",num(item.Discount));
  set("_TAX(10)",item["Tax Code"]); set("_TAXAMT",num(item["Tax Amount"])); set("_TAXINCLUSIVE",pick(s,"DEFAULT_TAX_INCLUSIVE","F")); set("_AMOUNT",num(item.Amount)); set("_PROJECT(20)",pick(s,"DEFAULT_PROJECT","----"));
  return r;
}
function refreshSqlExport(q) {
  const invs = rows(T.inv).filter(i => i.Status === "Paid" && i["SQL Status"] !== "Uploaded to SQL"), items = rows(T.item), s = settings(), customers = syncCustomers(invs, s), cm = custMap(customers), out = [], custOut = [], pending = [];
  const seen = {}; invs.forEach(inv => { const c = cm[ckey(inv["Customer Name"])]; if (c && c.Status !== "Uploaded" && !seen[c["Customer Key"]]) { pending.push(c); seen[c["Customer Key"]] = true; ["BILLING","DELIVERY"].forEach(b => custOut.push(custRow(c, b, s))); } });
  invs.forEach(inv => items.filter(it => it["Invoice ID"] === inv["Invoice ID"]).forEach((it, i) => out.push(sqlRow(inv, it, i + 1, s, cm))));
  const sh = ss().getSheetByName(T.sql), ch = ss().getSheetByName(T.custExp); sh.clearContents(); ch.clearContents();
  sh.getRange(1,1,1,SQLH.length).setValues([SQLH]); if (out.length) sh.getRange(2,1,out.length,SQLH.length).setValues(out); sh.setFrozenRows(1);
  ch.getRange(1,1,1,CUSTH.length).setValues([CUSTH]); if (custOut.length) ch.getRange(2,1,custOut.length,CUSTH.length).setValues(custOut); ch.setFrozenRows(1);
  log(q, "refreshSqlExport", "", "", `Prepared ${pending.length} customer(s), ${out.length} invoice row(s)`); return { ok: true, headers: SQLH, rows: out, customerHeaders: CUSTH, customerRows: custOut, customers: pending };
}
