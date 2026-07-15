const SQL_API_DEFAULTS = { host: "https://api.sql.my", region: "ap-southeast-5", service: "sqlaccount" };

function sqlApiConfig_() {
  const p = PropertiesService.getScriptProperties();
  return {
    host: (p.getProperty("SQL_API_HOST") || SQL_API_DEFAULTS.host).replace(/\/+$/, ""),
    region: p.getProperty("SQL_API_REGION") || SQL_API_DEFAULTS.region,
    service: p.getProperty("SQL_API_SERVICE") || SQL_API_DEFAULTS.service,
    accessKey: (p.getProperty("SQL_API_ACCESS_KEY") || "").trim(),
    secretKey: (p.getProperty("SQL_API_SECRET_KEY") || "").trim()
  };
}

function sqlConnectionStatus() {
  const c = sqlApiConfig_();
  if (!c.accessKey || !c.secretKey) return { ok: false, configured: false, error: "SQL API keys are not configured." };
  const r = sqlApiRequest_("GET", "/version");
  return { ok: true, configured: true, status: r.status, data: r.data };
}

function sqlSyncPaidInvoices() {
  setup();
  const q = { user: "SQL API" }, allItems = rows(T.item), s = settings();
  const invs = rows(T.inv).filter(x => x.Status === "Paid" && x["SQL Status"] === "Ready for SQL");
  const customers = syncCustomers(invs, s), cm = custMap(customers), result = { ok: true, uploaded: [], failed: [] };
  invs.forEach(inv => {
    try {
      const currency = String(inv.Currency || "RM").toUpperCase();
      if (currency !== "RM" && currency !== "MYR") throw new Error("Foreign currency needs an exchange rate before SQL upload.");
      const c = cm[ckey(inv["Customer Name"])];
      if (!c) throw new Error("Customer record is missing.");
      sqlEnsureCustomer_(c, s);
      if (c.Status !== "Uploaded") markCustomersUploaded({ user: "SQL API", customerKeys: [c["Customer Key"]] });
      const lookup = "/salesinvoice?docref1=" + encodeURIComponent(inv["Internal Invoice No"]);
      const existing = sqlFindDoc_(lookup);
      const api = existing || sqlApiRequest_("POST", "/salesinvoice", sqlInvoicePayload_(inv, allItems, c, s)).data;
      const doc = sqlFindObject_(api) || sqlFindDoc_(lookup) || {};
      updateInv(inv["Invoice ID"], { Status: "Uploaded to SQL", "SQL Status": "Uploaded to SQL", "Uploaded To SQL At": now(), "Uploaded By": "SQL API", "SQL Doc No": doc.docno || "", "SQL Doc Key": doc.dockey || "", "SQL API Error": "", "Updated At": now() });
      log(q, "sqlApiUpload", inv["Invoice ID"], inv["Internal Invoice No"], "SQL DocNo: " + (doc.docno || "created"));
      result.uploaded.push({ invoiceNo: inv["Internal Invoice No"], sqlDocNo: doc.docno || "", sqlDocKey: doc.dockey || "" });
    } catch (err) {
      updateInv(inv["Invoice ID"], { "SQL API Error": err.message || String(err), "Updated At": now() });
      log(q, "sqlApiError", inv["Invoice ID"], inv["Internal Invoice No"], err.message || String(err));
      result.failed.push({ invoiceNo: inv["Internal Invoice No"], error: err.message || String(err) });
    }
  });
  result.ok = result.failed.length === 0;
  return result;
}

function sqlEnsureCustomer_(c, s) {
  const path = "/customer/" + encodeURIComponent(c["SQL Customer Code"]);
  const found = sqlApiRequest_("GET", path, null, true);
  if (found.status !== 404) return found.data;
  return sqlApiRequest_("POST", "/customer", sqlCustomerPayload_(c, s)).data;
}

function sqlCustomerPayload_(c, s) {
  const a = splitAddr(c["Billing Address"]), date = sqlIsoDate_(new Date());
  return {
    code: c["SQL Customer Code"], controlaccount: pick(s, "DEFAULT_CUSTOMER_CONTROL_ACCOUNT", "300-000"),
    companyname: c["Customer Name"], creditterm: pick(s, "DEFAULT_CUSTOMER_CREDIT_TERM", "C.O.D."),
    creditlimit: "0.00", overduelimit: "0.00", statementtype: "O", currencycode: "",
    allowexceedcreditlimit: true, addpdctocrlimit: true, agingon: "I", creationdate: date,
    tin: c.TIN || "", idtype: Number(c["ID Type"] || 0), idno: c["ID No"] || "",
    submissiontype: Number(pick(s, "DEFAULT_SUBMISSION_TYPE", 17)), status: "A", dirty: true,
    sdsbranch: [{ dtlkey: 0, code: c["SQL Customer Code"], branchtype: "", branchname: "BILLING",
      address1: a[0] || "", address2: a[1] || "", address3: a[2] || "", address4: a[3] || "",
      postcode: "", city: "", state: "", country: pick(s, "DEFAULT_COUNTRY", "MY"), attention: "",
      phone1: phone(c["Customer Phone"]), phone2: "", mobile: "", fax1: "", fax2: "", email: c["Customer Email"] || "" }]
  };
}

function sqlInvoicePayload_(inv, allItems, c, s) {
  const date = sqlIsoDate_(inv["Invoice Date"] || inv["Paid At"] || new Date()), a = splitAddr(inv["Billing Address"]);
  const items = allItems.filter(x => x["Invoice ID"] === inv["Invoice ID"] && Number(x.Amount) !== 0);
  if (!items.length) throw new Error("No money rows are available for SQL upload.");
  return {
    dockey: 0, docno: "", docdate: date, postdate: date, taxdate: date,
    code: c["SQL Customer Code"], companyname: inv["Customer Name"], address1: a[0] || "", address2: a[1] || "",
    address3: a[2] || "", address4: a[3] || "", country: pick(s, "DEFAULT_COUNTRY", "MY"),
    phone1: phone(inv["Customer Phone"]), agent: pick(s, "DEFAULT_AGENT", "----"),
    project: pick(s, "DEFAULT_PROJECT", "----"), terms: inv.Terms || pick(s, "DEFAULT_TERMS", "C.O.D."),
    currencycode: "", currencyrate: "1.00", description: "LeVince Chauffeur Service", cancelled: false,
    docamt: sqlMoney_(inv.Total), localdocamt: sqlMoney_(inv.Total), docref1: String(inv["Internal Invoice No"]),
    tin: inv.TIN || "", idtype: Number(inv["ID Type"] || 0), idno: inv["ID No"] || "",
    submissiontype: Number(pick(s, "DEFAULT_SUBMISSION_TYPE", 17)), changed: true,
    sdsdocdetail: items.map((x, i) => sqlDetail_(x, i + 1, s))
  };
}

function sqlDetail_(x, seq, s) {
  const amount = Number(x.Amount), qty = Number(x.Quantity) || 1;
  const price = Number(x["Unit Price"]); 
  return { dtlkey: 0, dockey: 0, seq: seq, itemcode: x["Item Code"] || "", location: "", batch: "",
    project: pick(s, "DEFAULT_PROJECT", "----"), description: x.Description || "Service", qty: sqlMoney_(qty),
    uom: x.UOM || pick(s, "DEFAULT_UOM", "UNIT"), unitprice: sqlMoney_(price || amount / qty),
    disc: x.Discount ? String(x.Discount) : "", tax: x["Tax Code"] || "", taxamt: sqlMoney_(x["Tax Amount"]),
    taxinclusive: false, amount: sqlMoney_(amount), localamount: sqlMoney_(amount),
    account: x["Account Code"] || pick(s, "DEFAULT_ACCOUNT_CODE", "510-000"), printable: true, changed: true };
}

function sqlFindDoc_(path) {
  const r = sqlApiRequest_("GET", path, null, true);
  if (r.status === 404) return null;
  return sqlFindObject_(r.data);
}

function sqlFindObject_(v) {
  if (!v || typeof v !== "object") return null;
  if (!Array.isArray(v) && (v.dockey != null || v.docno)) return v;
  const values = Array.isArray(v) ? v : Object.keys(v).map(k => v[k]);
  for (let i = 0; i < values.length; i++) { const x = sqlFindObject_(values[i]); if (x) return x; }
  return null;
}

function sqlApiRequest_(method, path, body, allow404) {
  const c = sqlApiConfig_();
  if (!c.accessKey || !c.secretKey) throw new Error("SQL API keys are not configured in Script Properties.");
  const url = c.host + path, payload = body == null ? "" : JSON.stringify(body);
  const headers = sqlSign_(method, url, payload, c);
  const options = { method: method.toLowerCase(), headers: headers, muteHttpExceptions: true };
  if (body != null) { options.contentType = "application/json"; options.payload = payload; }
  const res = UrlFetchApp.fetch(url, options), status = res.getResponseCode(), text = res.getContentText();
  let data = text; try { data = text ? JSON.parse(text) : {}; } catch (_) {}
  if (status < 200 || status >= 300) { if (allow404 && status === 404) return { status: status, data: data }; throw new Error("SQL API " + status + ": " + (typeof data === "string" ? data : JSON.stringify(data))); }
  return { status: status, data: data };
}

function sqlSign_(method, url, payload, c) {
  const m = url.match(/^https?:\/\/([^/?#]+)([^?#]*)(?:\?(.*))?$/), host = m[1], path = m[2] || "/", query = sqlQuery_(m[3] || "");
  const amz = Utilities.formatDate(new Date(), "GMT", "yyyyMMdd'T'HHmmss'Z'"), stamp = amz.slice(0, 8);
  const canonicalHeaders = "host:" + host + "\nx-amz-date:" + amz + "\n";
  const signed = "host;x-amz-date", hash = sqlHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload, Utilities.Charset.UTF_8));
  const request = [method, path, query, canonicalHeaders, signed, hash].join("\n"), scope = [stamp, c.region, c.service, "aws4_request"].join("/");
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, sqlHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, request, Utilities.Charset.UTF_8))].join("\n");
  const kDate = Utilities.computeHmacSha256Signature(stamp, "AWS4" + c.secretKey, Utilities.Charset.UTF_8);
  const kRegion = Utilities.computeHmacSha256Signature(Utilities.newBlob(c.region).getBytes(), kDate);
  const kService = Utilities.computeHmacSha256Signature(Utilities.newBlob(c.service).getBytes(), kRegion);
  const kSigning = Utilities.computeHmacSha256Signature(Utilities.newBlob("aws4_request").getBytes(), kService);
  const signature = sqlHex_(Utilities.computeHmacSha256Signature(Utilities.newBlob(toSign).getBytes(), kSigning));
  return { "x-amz-date": amz,
    Authorization: "AWS4-HMAC-SHA256 Credential=" + c.accessKey + "/" + scope + ",SignedHeaders=" + signed + ",Signature=" + signature };
}

function sqlQuery_(q) { return q ? q.split("&").map(x => x.split("=").map(encodeURIComponent).join("=")).sort().join("&") : ""; }
function sqlHex_(bytes) { return bytes.map(x => ("0" + (x & 255).toString(16)).slice(-2)).join(""); }
function sqlMoney_(v) { return (Number(v) || 0).toFixed(2); }
function sqlIsoDate_(v) { const d = v instanceof Date ? v : new Date(v); return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd"); }
