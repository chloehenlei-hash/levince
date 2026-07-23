import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ClipboardList, CreditCard, Database, Download, FilePlus2, FileText, Loader2, Paperclip, ReceiptText, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import InvoiceGenerator from "./InvoiceGenerator.jsx";
import { createEmptyInvoiceData, getInvoiceTotal, normaliseInvoiceData } from "./pdf/invoicePdf.js";
import { parsePastedInvoiceDetails as parseInvoiceTextDetails } from "./utils/invoiceTextParser.js";
import { callWorkflowApi } from "./workflowApi.js";

const NAV_ITEMS = [
  { key: "new", label: "New Invoice", icon: FilePlus2 },
  { key: "invoices", label: "Invoices", icon: ClipboardList },
  { key: "sql", label: "SQL Upload", icon: Database },
  { key: "sql-direct", label: "SQL Direct", icon: ReceiptText },
  { key: "financial", label: "Vincenology SDN BHD", icon: Building2 },
];

const DIRECT_SQL_ACCOUNTS = {
  levince: {
    title: "SQL Direct",
    eyebrow: "LeVince SQL account",
    description: "Create a Sales Invoice and Customer Payment / OR directly through the first SQL API account.",
    accent: "Direct API",
    apiAction: "sqlConnectionStatus",
  },
  vincenology: {
    title: "Vincenology SDN BHD",
    eyebrow: "Vincenology SQL account",
    description: "Create a Sales Invoice and Customer Payment / OR through the Vincenology SQL API credentials.",
    accent: "Vincenology API",
    apiAction: "vincenologySqlConnectionStatus",
  },
};
const DIRECT_SQL_HISTORY_KEY = "levince-direct-sql-documents-v1";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function padMonth(value) {
  return String(value).padStart(2, "0");
}

function currentMonthKey() {
  const today = new Date();
  return `${today.getFullYear()}-${padMonth(today.getMonth() + 1)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function directReference() {
  const now = new Date();
  return `WEB-${now.getFullYear()}${padMonth(now.getMonth() + 1)}${padMonth(now.getDate())}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
}

function money(value, currency = "RM") {
  const amount = Number(String(value || "0").replace(/,/g, ""));
  return `${currency || "RM"} ${Number.isFinite(amount) ? amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) : "0.00"}`;
}

function parseAmount(value) {
  const amount = Number(String(value || "0").replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function textValue(value) {
  const text = String(value || "").trim();
  return text === "-" ? "" : text;
}

function loadDirectSqlHistory() {
  try {
    return JSON.parse(window.localStorage.getItem(DIRECT_SQL_HISTORY_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function saveDirectSqlHistory(history) {
  try {
    window.localStorage.setItem(DIRECT_SQL_HISTORY_KEY, JSON.stringify(history));
  } catch (_) {
    // Local history is a convenience only; SQL remains the source of truth.
  }
}

function directDocumentKey(doc) {
  return [doc.account, doc.sqlDocKey, doc.sqlDocNo, doc.docRef].filter(Boolean).join("|");
}

function normaliseSearchName(value) {
  return textValue(value).replace(/\s+/g, " ").toUpperCase();
}

function toDateInputValue(value) {
  const text = textValue(value);
  if (!text) return todayKey();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${padMonth(iso[2])}-${padMonth(iso[3])}`;
  const parsed = Date.parse(text.replace(/(\d+)(st|nd|rd|th)/gi, "$1"));
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    return `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}-${padMonth(date.getDate())}`;
  }
  return todayKey();
}

function parsedContactField(invoice, kind) {
  const fields = [
    { label: invoice.headerLabels?.email || "EMAIL", value: invoice.email },
    { label: invoice.headerLabels?.phone || "PHONE", value: invoice.phone },
  ];
  const found = fields.find((field) => new RegExp(kind, "i").test(field.label || ""));
  return textValue(found?.value);
}

function directDescriptionFromInvoice(parsed) {
  const invoice = normaliseInvoiceData(parsed);
  const lines = [];
  invoice.serviceGroups.forEach((group) => {
    const heading = textValue(group.heading);
    group.dates.forEach((dateGroup) => {
      const date = textValue(dateGroup.date);
      dateGroup.lines.forEach((line) => {
        const description = textValue(line.description);
        if (!description || line.kind === "spacer" || line.isSpacer) return;
        const parts = [date, heading, description].filter(Boolean);
        lines.push(parts.join(" - "));
      });
    });
  });
  return lines.slice(0, 6).join("\n") || textValue(invoice.invoiceTitle) || "LeVince Chauffeur Service";
}

function directFormFromParsedInvoice(parsed, currentForm) {
  const invoice = normaliseInvoiceData(parsed);
  const customerName = textValue(invoice.companyName) || textValue(invoice.customerName);
  const billingAddress = parsedContactField(invoice, "address");
  const tin = parsedContactField(invoice, "tax|tin");
  const amount = getInvoiceTotal(invoice);
  return {
    ...currentForm,
    docRef: textValue(invoice.receiptNumber) || currentForm.docRef || directReference(),
    customerName: customerName || currentForm.customerName,
    customerEmail: /@/.test(invoice.email || "") ? invoice.email : currentForm.customerEmail,
    customerPhone: textValue(invoice.phone) && invoice.phone !== "-" ? invoice.phone : currentForm.customerPhone,
    billingAddress: billingAddress || currentForm.billingAddress,
    tin: tin || currentForm.tin,
    invoiceDate: toDateInputValue(invoice.invoiceDate),
    paymentDate: toDateInputValue(invoice.invoiceDate),
    description: directDescriptionFromInvoice(invoice),
    quantity: "1",
    uom: currentForm.uom || "UNIT",
    amount: amount > 0 ? String(amount) : currentForm.amount,
  };
}

function isRmCurrency(value) {
  const currency = textValue(value || "RM").toUpperCase();
  return !currency || currency === "RM" || currency === "MYR";
}

function displayDate(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return text.slice(0, 12);
}

function displayDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return displayDate(value);
  return date.toLocaleString("en-MY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextSqlRunLabel() {
  const now = new Date();
  const windows = [[10, 30], [11, 0], [22, 30], [23, 0]];
  for (const [hour, minute] of windows) {
    const run = new Date(now);
    run.setHours(hour, minute, 0, 0);
    if (run > now) return `Today ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  return "Tomorrow 10:30";
}

function sqlStatusText(info, pendingCount, readyCount) {
  if (info) {
    const uploaded = info.uploaded || [];
    const failed = info.failed || [];
    if (failed.length) return `Last run ${displayDateTime(info.ranAt)} needs checking.`;
    if (uploaded.length) return `Last run ${displayDateTime(info.ranAt)} uploaded successfully.`;
    return `Last run ${displayDateTime(info.ranAt)} found nothing waiting.`;
  }
  if (readyCount) return `Waiting for ${nextSqlRunLabel()} upload.`;
  if (pendingCount) return "Review and confirm these paid invoices.";
  return "Nothing waiting for SQL.";
}

function invoiceMonthKey(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const monthName = MONTH_NAMES.join("|");
  const dmy = text.match(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(${monthName})\\s+(\\d{4})\\b`, "i"));
  if (dmy) return `${dmy[2]}-${padMonth(MONTH_NAMES.findIndex((month) => month.toLowerCase() === dmy[1].toLowerCase()) + 1)}`;
  const mdy = text.match(new RegExp(`\\b(${monthName})\\s+\\d{1,2},?\\s+(\\d{4})\\b`, "i"));
  if (mdy) return `${mdy[2]}-${padMonth(MONTH_NAMES.findIndex((month) => month.toLowerCase() === mdy[1].toLowerCase()) + 1)}`;
  return "";
}

function monthLabel(key) {
  if (key === "all") return "All Months";
  const [year, month] = String(key || "").split("-");
  const index = Number(month) - 1;
  if (!year || index < 0 || index > 11) return "Unknown Month";
  return `${MONTH_NAMES[index]} ${year}`;
}

function getWorkflowCustomerName(invoice) {
  return textValue(invoice.companyName) || textValue(invoice.customerName);
}

function flattenItems(invoice) {
  const rows = [];
  (invoice.serviceGroups || []).forEach((group) => {
    (group.dates || []).forEach((dateGroup) => {
      (dateGroup.lines || []).forEach((line) => {
        const amount = parseAmount(line.amount);
        if (!String(line.amount || "").trim()) return;
        const parts = [group.heading, dateGroup.date, line.description].map(textValue).filter(Boolean);
        rows.push({
          itemCode: "",
          accountCode: "",
          description: parts.join(" - "),
          quantity: textValue(line.qty),
          uom: "UNIT",
          unitPrice: amount,
          discount: 0,
          taxCode: "",
          taxAmount: 0,
          amount,
        });
      });
    });
  });
  return rows.length ? rows : [{
    description: invoice.invoiceTitle || "Service",
    quantity: 1,
    uom: "UNIT",
    unitPrice: parseAmount(invoice.totalOverride),
    discount: 0,
    taxCode: "",
    taxAmount: 0,
    amount: parseAmount(invoice.totalOverride),
  }];
}

function invoiceToWorkflowPayload({ invoice, filename }) {
  const items = flattenItems(invoice);
  const subtotal = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
  const totalOverride = parseAmount(invoice.totalOverride);
  const total = totalOverride > 0 ? totalOverride : subtotal;
  const customerName = getWorkflowCustomerName(invoice);
  const emailLabel = String(invoice.headerLabels?.email || "").toLowerCase();
  const phoneLabel = String(invoice.headerLabels?.phone || "").toLowerCase();
  const emailValue = textValue(invoice.email);
  const phoneValue = textValue(invoice.phone);
  const labelledValues = [
    { label: emailLabel, value: emailValue },
    { label: phoneLabel, value: phoneValue },
  ];
  const valueFor = (pattern) => labelledValues.find((entry) => pattern.test(entry.label))?.value || "";

  return {
    invoice: {
      documentType: invoice.documentLabel || "INVOICE",
      invoiceNo: textValue(invoice.receiptNumber),
      invoiceDate: textValue(invoice.invoiceDate),
      dueDate: "",
      customerName,
      sqlCustomerCode: "",
      customerEmail: valueFor(/email/),
      customerPhone: valueFor(/phone|mobile|tel|contact/),
      billingAddress: valueFor(/address/),
      tin: valueFor(/tax|tin|trn|vat/),
      idType: "",
      idNo: "",
      terms: "",
      pdfUrl: filename || "",
      notes: invoice.notesTitle || invoice.invoiceTitle || "Payment request",
      currency: invoice.currency || "RM",
      subtotal,
      discount: 0,
      tax: 0,
      total,
      items,
    },
    items,
  };
}

function statusClass(status) {
  return String(status || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function confirmOverwrite(existing, nextInvoice) {
  const oldCustomer = existing?.customerName || "Unknown customer";
  const oldTotal = money(existing?.total, nextInvoice.currency);
  const nextCustomer = nextInvoice.customerName || "Unknown customer";
  const nextTotal = money(nextInvoice.total, nextInvoice.currency);
  return window.confirm(
    `Invoice ${nextInvoice.invoiceNo} already exists.\n\nOld: ${oldCustomer} - ${oldTotal}\nNew: ${nextCustomer} - ${nextTotal}\n\nOverwrite the old record?`,
  );
}

function fileToProof(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Payment slip is too large. Please use a file below 8MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || "application/octet-stream",
      data: String(reader.result || ""),
    });
    reader.onerror = () => reject(new Error("Unable to read payment slip."));
    reader.readAsDataURL(file);
  });
}

function createDirectForm() {
  return {
    docRef: directReference(),
    customerName: "",
    sqlCustomerCode: "",
    customerPhone: "",
    customerEmail: "",
    billingAddress: "",
    tin: "",
    idType: "0",
    idNo: "",
    invoiceDate: todayKey(),
    terms: "C.O.D.",
    description: "LeVince Chauffeur Service",
    quantity: "1",
    uom: "UNIT",
    amount: "",
    paymentDate: todayKey(),
    paymentRef: "",
  };
}

export default function App() {
  const [view, setView] = useState("new");
  const [message, setMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("active");
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [recentPaidUndo, setRecentPaidUndo] = useState(null);
  const [markingPaidNo, setMarkingPaidNo] = useState("");
  const [reopeningNo, setReopeningNo] = useState("");
  const [paymentSlipFiles, setPaymentSlipFiles] = useState({});
  const [paymentInputs, setPaymentInputs] = useState({});
  const [sqlSyncInfo, setSqlSyncInfo] = useState(null);
  const [selectedSqlInvoiceIds, setSelectedSqlInvoiceIds] = useState([]);
  const [retryingOrId, setRetryingOrId] = useState("");
  const [directForms, setDirectForms] = useState({
    levince: createDirectForm(),
    vincenology: createDirectForm(),
  });
  const [directBusy, setDirectBusy] = useState("");
  const [directResults, setDirectResults] = useState({});
  const [directCustomerSearches, setDirectCustomerSearches] = useState({});
  const [directDocuments, setDirectDocuments] = useState(loadDirectSqlHistory);
  const [directPasteInputs, setDirectPasteInputs] = useState({});
  const [directPasteStatus, setDirectPasteStatus] = useState({});

  const paidQueue = useMemo(
    () => invoices.filter((invoice) => invoice.Status === "Paid" && invoice["SQL Status"] !== "Uploaded to SQL"),
    [invoices],
  );
  const readySqlQueue = useMemo(
    () => paidQueue.filter((invoice) => invoice["SQL Status"] === "Ready for SQL"),
    [paidQueue],
  );
  const pendingSqlConfirmQueue = useMemo(
    () => paidQueue.filter((invoice) => invoice["SQL Status"] !== "Ready for SQL"),
    [paidQueue],
  );
  const blockedCurrencyQueue = useMemo(
    () => paidQueue.filter((invoice) => !isRmCurrency(invoice.Currency) && parseAmount(invoice["Paid Amount RM"]) <= 0),
    [paidQueue],
  );
  const uploadablePendingQueue = useMemo(
    () => pendingSqlConfirmQueue.filter((invoice) => isRmCurrency(invoice.Currency) || parseAmount(invoice["Paid Amount RM"]) > 0),
    [pendingSqlConfirmQueue],
  );
  const selectedSqlUploadQueue = useMemo(
    () => uploadablePendingQueue.filter((invoice) => selectedSqlInvoiceIds.includes(String(invoice["Invoice ID"]))),
    [selectedSqlInvoiceIds, uploadablePendingQueue],
  );
  const monthOptions = useMemo(() => {
    const keys = new Set([currentMonthKey()]);
    invoices.forEach((invoice) => {
      const key = invoiceMonthKey(invoice["Invoice Date"]);
      if (key) keys.add(key);
    });
    return [...keys].sort().reverse();
  }, [invoices]);
  const invoicesInSelectedMonth = useMemo(() => {
    if (monthFilter === "all") return invoices;
    return invoices.filter((invoice) => invoiceMonthKey(invoice["Invoice Date"]) === monthFilter);
  }, [invoices, monthFilter]);
  const invoicePagePaidQueue = useMemo(
    () => invoicesInSelectedMonth.filter((invoice) => invoice.Status === "Paid" && invoice["SQL Status"] !== "Uploaded to SQL"),
    [invoicesInSelectedMonth],
  );
  const sqlWarnings = useMemo(() => {
    const warnings = [];
    if (uploadablePendingQueue.length) warnings.push(`${uploadablePendingQueue.length} paid invoice(s) need Chloe confirmation before API upload.`);
    if (blockedCurrencyQueue.length) warnings.push(`${blockedCurrencyQueue.length} foreign-currency paid invoice(s) need actual received RM before SQL upload.`);
    return warnings;
  }, [blockedCurrencyQueue, uploadablePendingQueue]);

  useEffect(() => {
    if (!recentPaidUndo) return undefined;
    const timer = window.setTimeout(() => setRecentPaidUndo(null), 10000);
    return () => window.clearTimeout(timer);
  }, [recentPaidUndo]);

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    saveDirectSqlHistory(directDocuments);
  }, [directDocuments]);

  useEffect(() => {
    const validIds = uploadablePendingQueue.map((invoice) => String(invoice["Invoice ID"]));
    setSelectedSqlInvoiceIds((current) => {
      if (!validIds.length) return [];
      const stillValid = current.filter((id) => validIds.includes(id));
      return stillValid.length ? stillValid : validIds;
    });
  }, [uploadablePendingQueue]);

  async function loadInvoices() {
    try {
      setMessage("Loading invoices...");
      const data = await callWorkflowApi("listInvoices");
      setInvoices(data.invoices || []);
      setItems(data.items || []);
      setMessage(`Loaded ${(data.invoices || []).length} invoice(s).`);
      loadSqlSyncStatus();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadSqlSyncStatus() {
    try {
      const data = await callWorkflowApi("sqlSyncStatus");
      setSqlSyncInfo(data.status || null);
    } catch (_) {
      setSqlSyncInfo(null);
    }
  }

  function sortInvoicesByLatest(a, b) {
    const dateA = Date.parse(a["Updated At"] || a["Created At"] || a["Sent At"] || a["Invoice Date"] || "");
    const dateB = Date.parse(b["Updated At"] || b["Created At"] || b["Sent At"] || b["Invoice Date"] || "");
    if (Number.isFinite(dateA) || Number.isFinite(dateB)) return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    return Number(String(b["Internal Invoice No"] || "").replace(/\D/g, "")) - Number(String(a["Internal Invoice No"] || "").replace(/\D/g, ""));
  }

  async function saveGeneratedInvoice(payload) {
    try {
      const mapped = invoiceToWorkflowPayload(payload);
      if (!mapped.invoice.invoiceNo) {
        setSaveStatus("Document number is required before saving.");
        return false;
      }
      if (!mapped.invoice.customerName) {
        setSaveStatus("Customer name is required before saving.");
        return false;
      }
      setSaveStatus("Saving...");
      try {
        await callWorkflowApi("createInvoice", mapped);
        setSaveStatus(`Saved ${mapped.invoice.invoiceNo} to workflow.`);
      } catch (error) {
        if (error.data?.code !== "DUPLICATE_INVOICE" || !confirmOverwrite(error.data.existing, mapped.invoice)) {
          throw error;
        }
        await callWorkflowApi("createInvoice", { ...mapped, overwrite: true });
        setSaveStatus(`Overwrote ${mapped.invoice.invoiceNo} in workflow.`);
      }
      await loadInvoices();
      return true;
    } catch (error) {
      setSaveStatus(error.message);
      return false;
    }
  }

  async function markPaid(invoice) {
    const invoiceNo = String(invoice["Internal Invoice No"] || "");
    const id = String(invoice["Invoice ID"] || "");
    const input = paymentInputs[id] || {};
    const paidDate = input.paymentDate || new Date().toISOString().slice(0, 10);
    const paidAmountRm = parseAmount(input.paidAmountRm);
    if (!isRmCurrency(invoice.Currency) && paidAmountRm <= 0) {
      setMessage(`${invoiceNo} is ${invoice.Currency}. Please fill actual received RM before marking paid.`);
      return;
    }
    const slipFile = paymentSlipFiles[invoice["Invoice ID"]] || null;
    setMarkingPaidNo(invoiceNo);
    setRecentPaidUndo({ invoiceNo, customerName: invoice["Customer Name"] });
    setInvoices((current) => current.map((row) => (
      row["Invoice ID"] === invoice["Invoice ID"]
        ? { ...row, Status: "Paid", "SQL Status": "Not Uploaded", "Paid At": paidDate, "Paid Amount RM": paidAmountRm || "" }
        : row
    )));
    setMessage(slipFile ? `${invoiceNo} is marked Paid. Uploading payment slip...` : `${invoiceNo} is marked Paid. No payment slip attached.`);
    try {
      const proofFile = await fileToProof(slipFile);
      await callWorkflowApi("markPaid", {
        invoiceId: invoice["Invoice ID"],
        paymentDate: paidDate,
        paidAmountRm: paidAmountRm || "",
        paymentRef: "",
        proofUrl: "",
        proofFile,
      });
      setPaymentSlipFiles((current) => {
        const next = { ...current };
        delete next[invoice["Invoice ID"]];
        return next;
      });
      setPaymentInputs((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      await loadInvoices();
      setRecentPaidUndo({ invoiceNo, customerName: invoice["Customer Name"] });
      setMessage(`${invoiceNo} is now Paid${slipFile ? " and the slip is saved to Google Drive" : ""}. You can undo if this was a mistake.`);
    } catch (error) {
      await loadInvoices();
      setMessage(error.message);
    } finally {
      setMarkingPaidNo("");
    }
  }

  async function reopenInvoice(invoice, label = "Payment mark undone") {
    const invoiceNo = String(invoice["Internal Invoice No"] || invoice.invoiceNo || "");
    if (!invoiceNo) return;
    setReopeningNo(invoiceNo);
    setInvoices((current) => current.map((row) => (
      String(row["Internal Invoice No"] || "") === invoiceNo
        ? { ...row, Status: "Sent", "SQL Status": "Not Uploaded", "Paid At": "" }
        : row
    )));
    if (String(recentPaidUndo?.invoiceNo || "") === invoiceNo) setRecentPaidUndo(null);
    try {
      await callWorkflowApi("reopenInvoices", { invoiceNos: [invoiceNo] });
      await loadInvoices();
      setMessage(`${label} for ${invoiceNo}.`);
    } catch (error) {
      await loadInvoices();
      setMessage(error.message);
    } finally {
      setReopeningNo("");
    }
  }

  async function undoRecentPaid() {
    if (!recentPaidUndo) return;
    await reopenInvoice({ "Internal Invoice No": recentPaidUndo.invoiceNo }, "Payment mark undone");
  }

  async function confirmScheduledUpload() {
    if (!paidQueue.length) {
      setMessage("No paid invoices waiting for SQL.");
      return;
    }
    if (!uploadablePendingQueue.length) {
      setMessage(`${readySqlQueue.length} invoice(s) already confirmed for scheduled SQL upload.`);
      return;
    }
    if (!selectedSqlUploadQueue.length) {
      setMessage("Choose at least one invoice to confirm for SQL upload.");
      return;
    }
    const count = selectedSqlUploadQueue.length;
    const pending = uploadablePendingQueue.length - count;
    const skipped = blockedCurrencyQueue.length ? `\n\n${blockedCurrencyQueue.length} foreign-currency invoice(s) have no received RM yet and will stay pending.` : "";
    const leftPending = pending > 0 ? `\n\n${pending} invoice(s) will stay pending.` : "";
    if (!window.confirm(`Confirm ${count} selected paid invoice(s) for scheduled SQL API upload?${leftPending}${skipped}`)) return;
    try {
      setInvoices((current) => current.map((invoice) => (
        selectedSqlUploadQueue.some((row) => row["Invoice ID"] === invoice["Invoice ID"])
          ? { ...invoice, "SQL Status": "Ready for SQL", "SQL API Error": "" }
          : invoice
      )));
      const data = await callWorkflowApi("confirmSqlUpload", {
        invoiceIds: selectedSqlUploadQueue.map((invoice) => invoice["Invoice ID"]),
      });
      await loadInvoices();
      const skipText = blockedCurrencyQueue.length ? ` ${blockedCurrencyQueue.length} foreign-currency invoice(s) were left pending for received RM.` : "";
      const pendingText = pending > 0 ? ` ${pending} invoice(s) stayed pending.` : "";
      setMessage(`${data.count || 0} selected invoice(s) confirmed. Waiting for ${nextSqlRunLabel()} SQL API upload.${pendingText}${skipText}`);
    } catch (error) {
      await loadInvoices();
      setMessage(error.message);
    }
  }

  async function clearSqlUploadView() {
    if (!window.confirm("Clear the SQL upload status view? Uploaded invoices stay in Google Sheet history.")) return;
    try {
      await callWorkflowApi("clearSqlSyncStatus");
      setSqlSyncInfo(null);
      await loadInvoices();
      setMessage("SQL upload status view cleared. History is still kept in Google Sheet.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function retryOr(invoice) {
    const id = String(invoice["Invoice ID"] || "");
    const invoiceNo = String(invoice["Internal Invoice No"] || "");
    setRetryingOrId(id);
    setMessage(`Retrying OR for ${invoiceNo}...`);
    try {
      const data = await callWorkflowApi("retrySqlPayment", { invoiceId: id });
      await loadInvoices();
      await loadSqlSyncStatus();
      setMessage(`OR created for ${invoiceNo}${data.sqlPaymentDocNo ? `: ${data.sqlPaymentDocNo}` : ""}.`);
    } catch (error) {
      await loadInvoices();
      setMessage(`OR retry failed for ${invoiceNo}: ${error.message}`);
    } finally {
      setRetryingOrId("");
    }
  }

  function updatePaymentInput(invoiceId, patch) {
    setPaymentInputs((current) => ({ ...current, [invoiceId]: { ...(current[invoiceId] || {}), ...patch } }));
  }

  function updateDirectForm(accountKey, patch) {
    setDirectForms((current) => ({
      ...current,
      [accountKey]: { ...(current[accountKey] || createDirectForm()), ...patch },
    }));
  }

  function updateDirectCustomerSearch(accountKey, patch) {
    setDirectCustomerSearches((current) => ({
      ...current,
      [accountKey]: { ...(current[accountKey] || { query: "", results: [], message: "" }), ...patch },
    }));
  }

  function updateDirectPasteInput(accountKey, value) {
    setDirectPasteInputs((current) => ({ ...current, [accountKey]: value }));
  }

  function updateDirectPasteStatus(accountKey, value) {
    setDirectPasteStatus((current) => ({ ...current, [accountKey]: value }));
  }

  function applyDirectParsedInvoice(accountKey, text, mode) {
    const value = textValue(text);
    if (!value) {
      updateDirectPasteStatus(accountKey, "Paste booking or invoice details first.");
      return false;
    }
    const parsed = parseInvoiceTextDetails(value, createEmptyInvoiceData());
    const parsedForm = directFormFromParsedInvoice(parsed, directForms[accountKey] || createDirectForm());
    setDirectForms((current) => ({ ...current, [accountKey]: parsedForm }));
    updateDirectCustomerSearch(accountKey, {
      query: parsedForm.customerName || "",
      results: [],
      message: parsedForm.customerName ? `Checking SQL customer database for ${parsedForm.customerName}...` : "",
    });
    if (parsedForm.customerName) autoResolveSqlCustomer(accountKey, parsedForm.customerName);
    updateDirectPasteStatus(accountKey, `${mode} organise complete. Customer lookup is running. Please review before creating SQL.`);
    setMessage(`${mode} organise complete for ${DIRECT_SQL_ACCOUNTS[accountKey].title}.`);
    return true;
  }

  function applyDirectNormalPaste(accountKey) {
    applyDirectParsedInvoice(accountKey, directPasteInputs[accountKey] || "", "Normal");
  }

  async function applyDirectAiPaste(accountKey) {
    const value = textValue(directPasteInputs[accountKey] || "");
    if (!value) {
      updateDirectPasteStatus(accountKey, "Paste booking or invoice details first.");
      return;
    }
    setDirectBusy(`${accountKey}:ai-paste`);
    updateDirectPasteStatus(accountKey, "AI is organising the details...");
    try {
      const result = await callWorkflowApi("parseInvoiceWithGemini", { text: value });
      const organisedText = textValue(result.normalizedText || "");
      if (!organisedText) throw new Error("No organised text returned.");
      applyDirectParsedInvoice(accountKey, organisedText, "AI");
    } catch (error) {
      updateDirectPasteStatus(accountKey, error.message || "AI organise failed. Try Normal Organise instead.");
      setMessage(error.message || "AI organise failed. Try Normal Organise instead.");
    } finally {
      setDirectBusy("");
    }
  }

  async function searchSqlCustomers(accountKey) {
    const current = directCustomerSearches[accountKey] || {};
    const query = textValue(current.query);
    if (query.length < 2) {
      updateDirectCustomerSearch(accountKey, { message: "Type at least 2 characters.", results: [] });
      return;
    }
    setDirectBusy(`${accountKey}:customer-search`);
    updateDirectCustomerSearch(accountKey, { message: "Searching SQL customers...", results: [] });
    try {
      const data = await callWorkflowApi("sqlSearchCustomers", { account: accountKey, query });
      const results = data.customers || [];
      updateDirectCustomerSearch(accountKey, {
        results,
        message: results.length ? `${results.length} SQL customer(s) found.` : "No SQL customer found.",
      });
    } catch (error) {
      updateDirectCustomerSearch(accountKey, { message: error.message, results: [] });
    } finally {
      setDirectBusy("");
    }
  }

  async function autoResolveSqlCustomer(accountKey, query) {
    const searchText = textValue(query);
    if (searchText.length < 2) return;
    try {
      const data = await callWorkflowApi("sqlSearchCustomers", { account: accountKey, query: searchText });
      const results = data.customers || [];
      const target = normaliseSearchName(searchText);
      const exact = results.find((customer) => normaliseSearchName(customer.customerName) === target);
      const picked = exact || (results.length === 1 ? results[0] : null);
      if (picked) {
        selectSqlCustomer(accountKey, picked, {
          message: `Existing SQL customer selected: ${picked.customerName || picked.sqlCustomerCode}.`,
        });
        return;
      }
      updateDirectCustomerSearch(accountKey, {
        query: searchText,
        results,
        message: results.length
          ? `${results.length} possible SQL customer(s) found. Choose the correct one before creating.`
          : "No existing SQL customer found. Create SQL Invoice / OR will create this customer first, then create the invoice.",
      });
    } catch (error) {
      updateDirectCustomerSearch(accountKey, {
        query: searchText,
        results: [],
        message: `${error.message}. Create will still try to resolve/create the SQL customer first.`,
      });
    }
  }

  function selectSqlCustomer(accountKey, customer, options = {}) {
    updateDirectForm(accountKey, {
      customerName: customer.customerName || "",
      sqlCustomerCode: customer.sqlCustomerCode || "",
      customerPhone: customer.customerPhone || "",
      customerEmail: customer.customerEmail || "",
      billingAddress: customer.billingAddress || "",
      tin: customer.tin || "",
      idType: customer.idType || "0",
      idNo: customer.idNo || "",
    });
    updateDirectCustomerSearch(accountKey, {
      query: customer.customerName || customer.sqlCustomerCode || "",
      message: options.message || `Selected ${customer.customerName || customer.sqlCustomerCode}.`,
      results: [],
    });
  }

  function directPayload(accountKey) {
    const form = directForms[accountKey] || createDirectForm();
    const amount = parseAmount(form.amount);
    if (!textValue(form.customerName)) {
      setMessage("Customer name is required before creating a SQL invoice.");
      return null;
    }
    if (amount <= 0) {
      setMessage("Amount must be more than RM 0.00 before creating a SQL invoice.");
      return null;
    }
    return {
      account: accountKey,
      docRef: textValue(form.docRef) || directReference(),
      customer: {
        customerName: textValue(form.customerName),
        sqlCustomerCode: textValue(form.sqlCustomerCode),
        customerPhone: textValue(form.customerPhone),
        customerEmail: textValue(form.customerEmail),
        billingAddress: textValue(form.billingAddress),
        tin: textValue(form.tin),
        idType: textValue(form.idType) || "0",
        idNo: textValue(form.idNo),
      },
      invoice: {
        invoiceDate: form.invoiceDate || todayKey(),
        terms: textValue(form.terms) || "C.O.D.",
        description: textValue(form.description) || "LeVince Chauffeur Service",
        quantity: parseAmount(form.quantity) || 1,
        uom: textValue(form.uom) || "UNIT",
        amount,
      },
      payment: {
        paymentDate: form.paymentDate || form.invoiceDate || todayKey(),
        paymentRef: textValue(form.paymentRef),
      },
    };
  }

  async function testDirectApi(accountKey) {
    const config = DIRECT_SQL_ACCOUNTS[accountKey];
    setDirectBusy(`${accountKey}:test`);
    setDirectResults((current) => ({
      ...current,
      [accountKey]: { ok: null, message: `Testing ${config.accent}...` },
    }));
    try {
      const data = await callWorkflowApi(config.apiAction);
      const versionText = data.backendVersion ? ` Backend ${data.backendVersion}.` : "";
      setDirectResults((current) => ({
        ...current,
        [accountKey]: { ok: true, message: `Connected. SQL API status ${data.status || "OK"}.${versionText}` },
      }));
    } catch (error) {
      setDirectResults((current) => ({
        ...current,
        [accountKey]: { ok: false, message: error.message },
      }));
    } finally {
      setDirectBusy("");
    }
  }

  async function createDirectSqlInvoice(accountKey) {
    const payload = directPayload(accountKey);
    if (!payload) return;
    setDirectBusy(`${accountKey}:invoice`);
    setMessage(`Creating SQL invoice for ${payload.customer.customerName}...`);
    try {
      const data = await callWorkflowApi("sqlDirectCreateInvoice", payload);
      setDirectResults((current) => ({
        ...current,
        [accountKey]: {
          ok: true,
          message: `SQL invoice ready${data.sqlDocNo ? `: ${data.sqlDocNo}` : ""}.`,
          data,
        },
      }));
      updateDirectForm(accountKey, { docRef: data.docRef || payload.docRef });
      addDirectDocument(accountKey, data, payload, "invoice");
      setMessage(`SQL invoice created${data.sqlDocNo ? `: ${data.sqlDocNo}` : ""}.`);
    } catch (error) {
      setDirectResults((current) => ({
        ...current,
        [accountKey]: { ok: false, message: error.message },
      }));
      setMessage(error.message);
    } finally {
      setDirectBusy("");
    }
  }

  async function createDirectSqlPayment(accountKey) {
    const payload = directPayload(accountKey);
    if (!payload) return;
    setDirectBusy(`${accountKey}:payment`);
    setMessage(`Creating Customer Payment / OR for ${payload.docRef}...`);
    try {
      const data = await callWorkflowApi("sqlDirectCreatePayment", payload);
      setDirectResults((current) => ({
        ...current,
        [accountKey]: {
          ok: true,
          message: `OR ready${data.sqlPaymentDocNo ? `: ${data.sqlPaymentDocNo}` : ""}.`,
          data,
        },
      }));
      addDirectDocument(accountKey, data, payload, "payment");
      setMessage(`Customer Payment / OR created${data.sqlPaymentDocNo ? `: ${data.sqlPaymentDocNo}` : ""}.`);
    } catch (error) {
      setDirectResults((current) => ({
        ...current,
        [accountKey]: { ok: false, message: error.message },
      }));
      setMessage(error.message);
    } finally {
      setDirectBusy("");
    }
  }

  function resetDirectForm(accountKey) {
    setDirectForms((current) => ({ ...current, [accountKey]: createDirectForm() }));
    setDirectResults((current) => ({ ...current, [accountKey]: null }));
  }

  function addDirectDocument(accountKey, data, payload, source) {
    const doc = {
      account: accountKey,
      source,
      docRef: data.docRef || payload.docRef,
      customerName: payload.customer.customerName,
      amount: payload.invoice.amount,
      invoiceDate: payload.invoice.invoiceDate,
      sqlCustomerCode: data.sqlCustomerCode || payload.customer.sqlCustomerCode || "",
      sqlDocNo: data.sqlDocNo || "",
      sqlDocKey: data.sqlDocKey || "",
      sqlPaymentDocNo: data.sqlPaymentDocNo || "",
      sqlPaymentDocKey: data.sqlPaymentDocKey || "",
      createdAt: new Date().toISOString(),
    };
    setDirectDocuments((current) => {
      const list = current[accountKey] || [];
      const key = directDocumentKey(doc);
      const next = [doc, ...list.filter((item) => directDocumentKey(item) !== key)].slice(0, 30);
      return { ...current, [accountKey]: next };
    });
  }

  async function refreshDirectDocument(accountKey, doc) {
    setDirectBusy(`${accountKey}:refresh:${directDocumentKey(doc)}`);
    setMessage(`Checking SQL invoice ${doc.sqlDocNo || doc.docRef}...`);
    try {
      const data = await callWorkflowApi("sqlDirectListDocuments", {
        account: accountKey,
        docRef: doc.docRef,
        sqlDocNo: doc.sqlDocNo,
        sqlDocKey: doc.sqlDocKey,
      });
      const found = (data.documents || [])[0];
      if (!found) {
        setMessage(`No SQL invoice found for ${doc.sqlDocNo || doc.docRef}.`);
        return;
      }
      addDirectDocument(accountKey, {
        docRef: found.docRef || doc.docRef,
        sqlCustomerCode: found.sqlCustomerCode || doc.sqlCustomerCode,
        sqlDocNo: found.sqlDocNo || doc.sqlDocNo,
        sqlDocKey: found.sqlDocKey || doc.sqlDocKey,
        sqlPaymentDocNo: doc.sqlPaymentDocNo,
        sqlPaymentDocKey: doc.sqlPaymentDocKey,
      }, {
        docRef: found.docRef || doc.docRef,
        customer: { customerName: found.customerName || doc.customerName, sqlCustomerCode: found.sqlCustomerCode || doc.sqlCustomerCode },
        invoice: { amount: found.amount || doc.amount, invoiceDate: found.invoiceDate || doc.invoiceDate },
      }, doc.source || "refresh");
      setMessage(`SQL invoice found: ${found.sqlDocNo || doc.sqlDocNo}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDirectBusy("");
    }
  }

  async function downloadDirectPdf(accountKey, doc) {
    setDirectBusy(`${accountKey}:pdf:${directDocumentKey(doc)}`);
    setMessage(`Preparing PDF for ${doc.sqlDocNo || doc.docRef}...`);
    try {
      const data = await callWorkflowApi("sqlDirectGetInvoicePdf", {
        account: accountKey,
        docRef: doc.docRef,
        sqlDocNo: doc.sqlDocNo,
        sqlDocKey: doc.sqlDocKey,
      });
      const binary = atob(data.base64 || "");
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.mimeType || "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename || `SQL Invoice ${doc.sqlDocNo || doc.docRef}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage(`PDF downloaded for ${doc.sqlDocNo || doc.docRef}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDirectBusy("");
    }
  }

  async function deleteDirectDocument(accountKey, doc) {
    const label = doc.sqlDocNo || doc.docRef;
    if (!window.confirm(`Delete SQL invoice ${label} from SQL? This cannot be undone from the website.`)) return;
    setDirectBusy(`${accountKey}:delete:${directDocumentKey(doc)}`);
    setMessage(`Deleting SQL invoice ${label}...`);
    try {
      await callWorkflowApi("sqlDirectDeleteInvoice", {
        account: accountKey,
        docRef: doc.docRef,
        sqlDocNo: doc.sqlDocNo,
        sqlDocKey: doc.sqlDocKey,
        sqlPaymentDocNo: doc.sqlPaymentDocNo,
        sqlPaymentDocKey: doc.sqlPaymentDocKey,
      });
      setDirectDocuments((current) => ({
        ...current,
        [accountKey]: (current[accountKey] || []).filter((item) => directDocumentKey(item) !== directDocumentKey(doc)),
      }));
      setMessage(`Deleted SQL invoice ${label}.`);
    } catch (error) {
      setMessage(`Delete failed for ${label}: ${error.message}`);
    } finally {
      setDirectBusy("");
    }
  }

  function renderDirectSqlPage(accountKey) {
    const config = DIRECT_SQL_ACCOUNTS[accountKey];
    const form = directForms[accountKey] || createDirectForm();
    const result = directResults[accountKey];
    const customerSearch = directCustomerSearches[accountKey] || { query: "", results: [], message: "" };
    const testBusy = directBusy === `${accountKey}:test`;
    const searchBusy = directBusy === `${accountKey}:customer-search`;
    const invoiceBusy = directBusy === `${accountKey}:invoice`;
    const paymentBusy = directBusy === `${accountKey}:payment`;
    const aiPasteBusy = directBusy === `${accountKey}:ai-paste`;
    const documents = directDocuments[accountKey] || [];
    const pasteText = directPasteInputs[accountKey] || "";
    const pasteStatus = directPasteStatus[accountKey] || "";
    return (
      <main className="app-shell workflow-page direct-sql-page">
        <header className="workflow-page-header">
          <div>
            <p className="brand-label">{config.eyebrow}</p>
            <h1>{config.title}</h1>
          </div>
          <div className="workflow-row-actions">
            <button type="button" className="secondary-button" onClick={() => testDirectApi(accountKey)} disabled={Boolean(directBusy)}>
              {testBusy ? "Testing..." : `Test ${config.accent}`}
            </button>
            <button type="button" className="secondary-button" onClick={() => resetDirectForm(accountKey)} disabled={Boolean(directBusy)}>
              New Entry
            </button>
          </div>
        </header>
        <p className="hint">{config.description} SQL API keys stay inside Apps Script Script Properties.</p>
        <section className="workflow-section direct-paste-panel">
          <div className="workflow-page-header compact">
            <div>
              <p className="brand-label">Quick paste</p>
              <h2>Paste booking details</h2>
            </div>
          </div>
          <label className="field paste-field">
            <span>Booking / invoice details</span>
            <textarea
              value={pasteText}
              rows="7"
              placeholder={`Company Name : Asian Trails Malaysia
Name : Aina Nizam
Email : aina.nizam@asiantrails.com.my
Phone : 011 5379 5388

23 July 2026
Airport Transfer - Camry
RM190`}
              onChange={(event) => updateDirectPasteInput(accountKey, event.target.value)}
              onPaste={() => updateDirectPasteStatus(accountKey, "Details pasted. Choose Normal Organise or AI Organise.")}
            />
          </label>
          <p className="mini-instruction">The organiser fills customer, contact, date, description, and RM amount. Review the fields before creating SQL.</p>
          <div className="paste-actions">
            <button type="button" className="secondary-button" onClick={() => applyDirectNormalPaste(accountKey)} disabled={Boolean(directBusy)}>
              <FileText aria-hidden="true" />
              Normal Organise
            </button>
            <button type="button" className="ai-button" onClick={() => applyDirectAiPaste(accountKey)} disabled={Boolean(directBusy)}>
              {aiPasteBusy ? <Loader2 className="spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              AI Organise
            </button>
            {pasteStatus ? <span>{pasteStatus}</span> : null}
          </div>
        </section>
        <section className="direct-sql-layout">
          <div className="workflow-section direct-sql-form">
            <div className="workflow-page-header compact">
              <div>
                <p className="brand-label">Customer</p>
                <h2>Customer profile</h2>
              </div>
            </div>
            <div className="sql-customer-search">
              <label className="field">
                <span>Search SQL customer</span>
                <input
                  value={customerSearch.query || ""}
                  placeholder="Company name, customer code, phone"
                  onChange={(event) => updateDirectCustomerSearch(accountKey, { query: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      searchSqlCustomers(accountKey);
                    }
                  }}
                />
              </label>
              <button type="button" className="secondary-button" onClick={() => searchSqlCustomers(accountKey)} disabled={Boolean(directBusy)}>
                <Search aria-hidden="true" />
                {searchBusy ? "Searching..." : "Search"}
              </button>
            </div>
            {customerSearch.message ? <p className="sql-search-message">{customerSearch.message}</p> : null}
            {customerSearch.results?.length ? (
              <div className="sql-customer-results">
                {customerSearch.results.map((customer) => (
                  <button
                    type="button"
                    key={`${customer.sqlCustomerCode}-${customer.customerName}`}
                    className="sql-customer-result"
                    onClick={() => selectSqlCustomer(accountKey, customer)}
                  >
                    <strong>{customer.customerName || "Unnamed customer"}</strong>
                    <span>{customer.sqlCustomerCode || "No code"}{customer.customerPhone ? ` · ${customer.customerPhone}` : ""}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="direct-form-grid two">
              <label className="field">
                <span>Customer / Company <b>*</b></span>
                <input
                  value={form.customerName}
                  onChange={(event) => updateDirectForm(accountKey, { customerName: event.target.value, sqlCustomerCode: "" })}
                  onBlur={() => autoResolveSqlCustomer(accountKey, form.customerName)}
                />
              </label>
              <label className="field">
                <span>SQL Customer Code</span>
                <input value={form.sqlCustomerCode} placeholder="Optional" onChange={(event) => updateDirectForm(accountKey, { sqlCustomerCode: event.target.value })} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input value={form.customerPhone} onChange={(event) => updateDirectForm(accountKey, { customerPhone: event.target.value })} />
              </label>
              <label className="field">
                <span>Email</span>
                <input value={form.customerEmail} type="email" onChange={(event) => updateDirectForm(accountKey, { customerEmail: event.target.value })} />
              </label>
              <label className="field">
                <span>TIN</span>
                <input value={form.tin} onChange={(event) => updateDirectForm(accountKey, { tin: event.target.value })} />
              </label>
              <label className="field">
                <span>ID Type</span>
                <input value={form.idType} onChange={(event) => updateDirectForm(accountKey, { idType: event.target.value })} />
              </label>
              <label className="field">
                <span>ID No</span>
                <input value={form.idNo} onChange={(event) => updateDirectForm(accountKey, { idNo: event.target.value })} />
              </label>
              <label className="field direct-wide-field">
                <span>Billing Address</span>
                <textarea value={form.billingAddress} rows="3" onChange={(event) => updateDirectForm(accountKey, { billingAddress: event.target.value })} />
              </label>
            </div>
          </div>
          <div className="workflow-section direct-sql-form">
            <div className="workflow-page-header compact">
              <div>
                <p className="brand-label">Sales invoice</p>
                <h2>Invoice and OR details</h2>
              </div>
            </div>
            <div className="direct-form-grid two">
              <label className="field">
                <span>Reference <b>*</b></span>
                <input value={form.docRef} onChange={(event) => updateDirectForm(accountKey, { docRef: event.target.value })} />
              </label>
              <label className="field">
                <span>Invoice Date</span>
                <input type="date" value={form.invoiceDate} onChange={(event) => updateDirectForm(accountKey, { invoiceDate: event.target.value })} />
              </label>
              <label className="field direct-wide-field">
                <span>Description</span>
                <input value={form.description} onChange={(event) => updateDirectForm(accountKey, { description: event.target.value })} />
              </label>
              <label className="field">
                <span>Qty</span>
                <input type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => updateDirectForm(accountKey, { quantity: event.target.value })} />
              </label>
              <label className="field">
                <span>UOM</span>
                <input value={form.uom} onChange={(event) => updateDirectForm(accountKey, { uom: event.target.value })} />
              </label>
              <label className="field">
                <span>Amount RM <b>*</b></span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => updateDirectForm(accountKey, { amount: event.target.value })} />
              </label>
              <label className="field">
                <span>Terms</span>
                <input value={form.terms} onChange={(event) => updateDirectForm(accountKey, { terms: event.target.value })} />
              </label>
              <label className="field">
                <span>Payment Date</span>
                <input type="date" value={form.paymentDate} onChange={(event) => updateDirectForm(accountKey, { paymentDate: event.target.value })} />
              </label>
              <label className="field">
                <span>Payment Ref</span>
                <input value={form.paymentRef} onChange={(event) => updateDirectForm(accountKey, { paymentRef: event.target.value })} />
              </label>
            </div>
            <div className="direct-total-strip">
              <span>SQL amount</span>
              <strong>{money(form.amount || 0, "RM")}</strong>
            </div>
            <div className="workflow-row-actions direct-main-actions">
              <button type="button" className="primary-button" onClick={() => createDirectSqlInvoice(accountKey)} disabled={Boolean(directBusy)}>
                <ReceiptText aria-hidden="true" />
                {invoiceBusy ? "Creating..." : "Create SQL Invoice"}
              </button>
              <button type="button" className="secondary-button" onClick={() => createDirectSqlPayment(accountKey)} disabled={Boolean(directBusy)}>
                <CreditCard aria-hidden="true" />
                {paymentBusy ? "Creating OR..." : "Create Customer Payment / OR"}
              </button>
            </div>
          </div>
          <aside className="direct-sql-result">
            <p className="brand-label">Result</p>
            {result ? (
              <div className={`sql-sync-card ${result.ok === false ? "is-error" : "is-ok"}`}>
                <div>
                  <span>{result.ok === false ? "Needs checking" : "Latest action"}</span>
                  <strong>{result.message}</strong>
                </div>
                {result.data ? (
                  <dl className="direct-result-list">
                    <div><dt>Reference</dt><dd>{result.data.docRef || form.docRef}</dd></div>
                    <div><dt>Customer Code</dt><dd>{result.data.sqlCustomerCode || "-"}</dd></div>
                    <div><dt>SQL Invoice</dt><dd>{result.data.sqlDocNo || "-"}</dd></div>
                    <div><dt>OR</dt><dd>{result.data.sqlPaymentDocNo || "-"}</dd></div>
                  </dl>
                ) : null}
              </div>
            ) : (
              <div className="sql-sync-card">
                <div>
                  <span>Ready</span>
                  <strong>Fill the form, then create the invoice first. Create OR after payment is confirmed.</strong>
                </div>
              </div>
            )}
          </aside>
        </section>
        <section className="workflow-section direct-document-panel">
          <div className="workflow-page-header compact">
            <div>
              <p className="brand-label">Created SQL documents</p>
              <h2>Invoices created from this page</h2>
            </div>
          </div>
          {documents.length ? (
            <div className="direct-document-list">
              {documents.map((doc) => {
                const key = directDocumentKey(doc);
                const refreshBusy = directBusy === `${accountKey}:refresh:${key}`;
                const pdfBusy = directBusy === `${accountKey}:pdf:${key}`;
                const deleteBusy = directBusy === `${accountKey}:delete:${key}`;
                return (
                  <article className="direct-document-row" key={key}>
                    <div>
                      <span>Reference</span>
                      <strong>{doc.docRef || "-"}</strong>
                    </div>
                    <div>
                      <span>Customer</span>
                      <strong>{doc.customerName || "-"}</strong>
                    </div>
                    <div>
                      <span>SQL Invoice</span>
                      <strong>{doc.sqlDocNo || "-"}</strong>
                    </div>
                    <div>
                      <span>OR</span>
                      <strong>{doc.sqlPaymentDocNo || "-"}</strong>
                    </div>
                    <div>
                      <span>Amount</span>
                      <strong>{money(doc.amount || 0, "RM")}</strong>
                    </div>
                    <div>
                      <span>Created</span>
                      <strong>{displayDateTime(doc.createdAt)}</strong>
                    </div>
                    <div className="direct-document-actions">
                      <button type="button" className="icon-button" title="Refresh from SQL" onClick={() => refreshDirectDocument(accountKey, doc)} disabled={Boolean(directBusy)}>
                        <RefreshCw aria-hidden="true" />
                        <span className="sr-only">{refreshBusy ? "Refreshing" : "Refresh"}</span>
                      </button>
                      <button type="button" className="secondary-button" onClick={() => downloadDirectPdf(accountKey, doc)} disabled={Boolean(directBusy)}>
                        <Download aria-hidden="true" />
                        {pdfBusy ? "Preparing..." : "PDF"}
                      </button>
                      <button type="button" className="secondary-button danger-button" onClick={() => deleteDirectDocument(accountKey, doc)} disabled={Boolean(directBusy)}>
                        <Trash2 aria-hidden="true" />
                        {deleteBusy ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No SQL document here yet.</strong>
              <span>Create a SQL Invoice or Customer Payment / OR and it will appear here automatically.</span>
            </div>
          )}
        </section>
      </main>
    );
  }

  const recentPaidNo = String(recentPaidUndo?.invoiceNo || "");
  const invoiceSearchText = invoiceSearch.trim().toLowerCase();
  const invoicePageSource = invoiceSearchText ? invoices : invoicesInSelectedMonth;
  const filteredInvoices = invoicePageSource.filter((invoice) => {
    const invoiceNo = String(invoice["Internal Invoice No"] || "");
    const isRecentPaid = recentPaidNo && invoiceNo === recentPaidNo && invoice.Status === "Paid";
    if (filter === "all") return true;
    if (filter === "paid") return invoice.Status === "Paid" && invoice["SQL Status"] !== "Uploaded to SQL";
    if (filter === "uploaded") return invoice["SQL Status"] === "Uploaded to SQL";
    return isRecentPaid || (invoice.Status !== "Paid" && invoice.Status !== "Uploaded to SQL" && invoice.Status !== "Cancelled");
  }).filter((invoice) => {
    if (!invoiceSearchText) return true;
    return String(invoice["Internal Invoice No"] || "").toLowerCase().includes(invoiceSearchText)
      || String(invoice["Customer Name"] || "").toLowerCase().includes(invoiceSearchText);
  }).sort(sortInvoicesByLatest);
  const limitInvoices = !invoiceSearch.trim() && !showAllInvoices;
  const visibleInvoices = limitInvoices ? filteredInvoices.slice(0, 5) : filteredInvoices;

  return (
    <>
      <div className="workflow-bar">
        <div className="workflow-nav" aria-label="Workflow navigation">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`ghost-button ${view === key ? "active" : ""}`}
              onClick={() => setView(key)}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {message || recentPaidUndo ? (
          <div className="workflow-message-row">
            {message ? <p className="workflow-message">{message}</p> : null}
            {recentPaidUndo ? (
              <button type="button" className="secondary-button undo-button" onClick={undoRecentPaid}>
                Undo Paid
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {view === "new" ? (
        <InvoiceGenerator onSaveInvoice={saveGeneratedInvoice} saveStatus={saveStatus} existingInvoices={invoices} />
      ) : null}

      {view === "invoices" ? (
        <main className="app-shell workflow-page">
          <header className="workflow-page-header">
            <div>
              <p className="brand-label">Workflow</p>
              <h1>Invoices</h1>
            </div>
            <div className="workflow-row-actions">
              <select value={monthFilter} onChange={(event) => {
                setMonthFilter(event.target.value);
                setShowAllInvoices(false);
              }}>
                <option value="all">All Months</option>
                {monthOptions.map((key) => (
                  <option key={key} value={key}>{monthLabel(key)}</option>
                ))}
              </select>
              <select value={filter} onChange={(event) => {
                setFilter(event.target.value);
                setShowAllInvoices(false);
              }}>
                <option value="active">Active</option>
                <option value="paid">Paid Queue</option>
                <option value="uploaded">Uploaded</option>
                <option value="all">All</option>
              </select>
              <input
                className="invoice-search-input"
                value={invoiceSearch}
                placeholder="Search no. or customer"
                onChange={(event) => {
                  setInvoiceSearch(event.target.value);
                  setShowAllInvoices(false);
                }}
              />
              <button type="button" className="secondary-button" onClick={loadInvoices}>Refresh</button>
            </div>
          </header>
          <div className="workflow-stats">
            <div><span>Active</span><strong>{invoicesInSelectedMonth.filter((row) => row.Status !== "Paid" && row.Status !== "Uploaded to SQL" && row.Status !== "Cancelled").length}</strong></div>
            <div><span>Paid Queue</span><strong>{invoicePagePaidQueue.length}</strong></div>
            <div><span>Paid Value</span><strong>{money(invoicePagePaidQueue.reduce((sum, row) => sum + parseAmount(row.Total), 0))}</strong></div>
          </div>
          <div className="workflow-table-wrap">
            <table className="workflow-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Paid At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.length ? visibleInvoices.map((invoice) => {
                  const invoiceNo = String(invoice["Internal Invoice No"] || "");
                  const isPaid = invoice.Status === "Paid";
                  const isMarking = markingPaidNo === invoiceNo;
                  const isReopening = reopeningNo === invoiceNo;
                  const slipFile = paymentSlipFiles[invoice["Invoice ID"]];
                  const invoiceId = String(invoice["Invoice ID"] || "");
                  const payInput = paymentInputs[invoiceId] || {};
                  const needsRmAmount = !isPaid && !isRmCurrency(invoice.Currency);
                  return (
                  <tr key={invoice["Invoice ID"]} className={isPaid ? "workflow-row-paid" : ""}>
                    <td><strong>{invoice["Internal Invoice No"]}</strong></td>
                    <td>{invoice["Customer Name"]}</td>
                    <td>{displayDate(invoice["Invoice Date"])}</td>
                    <td>{money(invoice.Total, invoice.Currency)}</td>
                    <td><span className={`workflow-status ${statusClass(invoice.Status)}`}>{invoice.Status}</span></td>
                    <td>{displayDate(invoice["Paid At"])}</td>
                    <td>
                      <div className="workflow-row-actions">
                        {!isPaid ? (
                          <div className="payment-mini-fields">
                            <label>
                              <span>Paid date</span>
                              <input
                                type="date"
                                value={payInput.paymentDate || new Date().toISOString().slice(0, 10)}
                                onChange={(event) => updatePaymentInput(invoiceId, { paymentDate: event.target.value })}
                              />
                            </label>
                            {needsRmAmount ? (
                              <label>
                                <span>Received RM</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={payInput.paidAmountRm || ""}
                                  placeholder="RM amount"
                                  onChange={(event) => updatePaymentInput(invoiceId, { paidAmountRm: event.target.value })}
                                />
                              </label>
                            ) : null}
                          </div>
                        ) : null}
                        {!isPaid ? (
                          <label className={`slip-upload-button ${slipFile ? "has-file" : ""}`}>
                            <Paperclip aria-hidden="true" />
                            <span>{slipFile ? "Slip added" : "Slip"}</span>
                            <input
                              type="file"
                              accept="image/*,.pdf,application/pdf"
                              onChange={(event) => {
                                const file = event.target.files?.[0] || null;
                                setPaymentSlipFiles((current) => ({ ...current, [invoice["Invoice ID"]]: file }));
                              }}
                            />
                          </label>
                        ) : invoice["Payment Proof URL"] ? (
                          <a className="secondary-button slip-link-button" href={invoice["Payment Proof URL"]} target="_blank" rel="noreferrer">
                            <Paperclip aria-hidden="true" />
                            Slip
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className={`secondary-button paid-check-button ${isPaid ? "is-paid" : ""}`}
                          onClick={() => markPaid(invoice)}
                          disabled={isPaid || isMarking || isReopening}
                        >
                          <CheckCircle2 aria-hidden="true" />
                          {isPaid ? "Paid" : isMarking ? "Marking..." : "Mark Paid"}
                        </button>
                        {isPaid ? (
                          <button
                            type="button"
                            className="secondary-button not-paid-button"
                            onClick={() => reopenInvoice(invoice, "Moved back to Not Paid")}
                            disabled={isReopening}
                          >
                            {isReopening ? "Moving..." : "Not Paid"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                }) : (
                  <tr><td colSpan="7" className="workflow-empty">No invoices found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!invoiceSearch.trim() && filteredInvoices.length > 5 ? (
            <div className="workflow-load-more">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowAllInvoices((current) => !current)}
              >
                {showAllInvoices ? "Show latest 5" : `Load more (${filteredInvoices.length - 5})`}
              </button>
            </div>
          ) : null}
        </main>
      ) : null}

      {view === "sql" ? (
        <main className="app-shell workflow-page">
          <header className="workflow-page-header">
            <div>
              <p className="brand-label">SQL Account</p>
              <h1>SQL Upload</h1>
            </div>
            <div className="workflow-row-actions">
              <button type="button" className="secondary-button" onClick={loadInvoices}>Refresh</button>
              <button type="button" className="secondary-button danger-button" onClick={clearSqlUploadView}>Clear Completed View</button>
            </div>
          </header>
          <p className="hint">Paid invoices only upload to SQL after Chloe confirms them. The API creates the customer, Sales Invoice, and Customer Payment / OR in SQL.</p>
          <section className="sql-command-panel">
            <div className="workflow-stats sql-status-grid">
              <div>
                <span>Selected</span>
                <strong>{selectedSqlUploadQueue.length}/{uploadablePendingQueue.length}</strong>
              </div>
              <div>
                <span>Waiting upload</span>
                <strong>{readySqlQueue.length}</strong>
              </div>
              <div>
                <span>Next API window</span>
                <strong>{readySqlQueue.length ? nextSqlRunLabel() : "-"}</strong>
              </div>
            </div>
            <div className={`sql-sync-card ${sqlSyncInfo?.failed?.length ? "is-error" : "is-ok"}`}>
              <div>
                <span>Current status</span>
                <strong>{sqlStatusText(sqlSyncInfo, selectedSqlUploadQueue.length || uploadablePendingQueue.length, readySqlQueue.length)}</strong>
              </div>
              {readySqlQueue.length ? <p>Confirmed invoices will upload automatically during the next quiet SQL window.</p> : null}
              {sqlSyncInfo?.uploaded?.length ? (
                <p>Uploaded: {sqlSyncInfo.uploaded.map((row) => `${row.invoiceNo}${row.sqlPaymentDocNo ? ` / OR ${row.sqlPaymentDocNo}` : ""}`).join(", ")}</p>
              ) : null}
              {sqlSyncInfo?.failed?.length ? (
                <p>Failed: {sqlSyncInfo.failed.map((row) => `${row.invoiceNo}: ${row.error}`).join(" | ")}</p>
              ) : null}
            </div>
            <div className="workflow-row-actions sql-main-actions">
              <button
                type="button"
                className={`primary-button ${!uploadablePendingQueue.length && readySqlQueue.length ? "is-copied" : ""}`}
                onClick={confirmScheduledUpload}
                disabled={!selectedSqlUploadQueue.length}
              >
                <CheckCircle2 aria-hidden="true" />
                {!uploadablePendingQueue.length && readySqlQueue.length ? "Waiting for API" : "Confirm Selected"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedSqlInvoiceIds(uploadablePendingQueue.map((invoice) => String(invoice["Invoice ID"])))}
                disabled={!uploadablePendingQueue.length}
              >
                Select All Ready
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedSqlInvoiceIds([])}
                disabled={!selectedSqlUploadQueue.length}
              >
                Leave All Pending
              </button>
              <button type="button" className="secondary-button" onClick={loadSqlSyncStatus}>Refresh Status</button>
            </div>
          </section>
          {sqlWarnings.length ? (
            <div className="workflow-warning-panel">
              {sqlWarnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}
          <section className="workflow-section">
            <div className="workflow-page-header compact">
              <div>
                <p className="brand-label">Today's upload</p>
                <h2>Invoices to SQL</h2>
              </div>
            </div>
            <div className="workflow-table-wrap">
              <table className="workflow-table">
                <thead>
                  <tr>
                    <th>Upload</th>
                    <th>No.</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>OR</th>
                    <th>Action</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {paidQueue.length ? [...paidQueue].sort(sortInvoicesByLatest).map((invoice) => {
                    const id = String(invoice["Invoice ID"] || "");
                    const isReady = invoice["SQL Status"] === "Ready for SQL";
                    const sqlRmAmount = parseAmount(invoice["Paid Amount RM"]);
                    const canSelect = invoice["SQL Status"] !== "Ready for SQL" && (isRmCurrency(invoice.Currency) || sqlRmAmount > 0);
                    const isSelected = selectedSqlInvoiceIds.includes(id);
                    const hasOr = Boolean(invoice["SQL Payment Doc No"]);
                    const canRetryOr = (isRmCurrency(invoice.Currency) || sqlRmAmount > 0) && !hasOr && Boolean(invoice["SQL API Error"]);
                    return (
                    <tr key={invoice["Invoice ID"]} className={!canSelect && !isReady ? "workflow-row-muted" : ""}>
                      <td>
                        {isReady ? (
                          <span className="sql-upload-note">Waiting</span>
                        ) : (
                          <label className={`sql-select-control ${isSelected ? "is-selected" : ""} ${!canSelect ? "is-disabled" : ""}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canSelect}
                              onChange={(event) => {
                                setSelectedSqlInvoiceIds((current) => {
                                  if (event.target.checked) return [...new Set([...current, id])];
                                  return current.filter((value) => value !== id);
                                });
                              }}
                            />
                            <span>{canSelect ? (isSelected ? "Yes" : "Pending") : "Hold"}</span>
                          </label>
                        )}
                      </td>
                      <td><strong>{invoice["Internal Invoice No"]}</strong></td>
                      <td>{invoice["Customer Name"]}</td>
                      <td>{displayDate(invoice["Invoice Date"])}</td>
                      <td>
                        {money(invoice.Total, invoice.Currency)}
                        {!isRmCurrency(invoice.Currency) && sqlRmAmount > 0 ? (
                          <span className="sql-rm-amount">SQL {money(sqlRmAmount, "RM")}</span>
                        ) : null}
                      </td>
                      <td><span className={`workflow-status ${statusClass(invoice["SQL Status"])}`}>{invoice["SQL Status"] || "Not Uploaded"}</span></td>
                      <td>{hasOr ? <span className="workflow-status paid">OR {invoice["SQL Payment Doc No"]}</span> : ""}</td>
                      <td>
                        {canRetryOr ? (
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => retryOr(invoice)}
                            disabled={retryingOrId === id}
                          >
                            {retryingOrId === id ? "Retrying..." : "Retry OR"}
                          </button>
                        ) : ""}
                      </td>
                      <td>{invoice["SQL API Error"] || ""}</td>
                    </tr>
                    );
                  }) : (
                    <tr><td colSpan="9" className="workflow-empty">No paid invoices waiting for SQL.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      ) : null}

      {view === "sql-direct" ? renderDirectSqlPage("levince") : null}

      {view === "financial" ? (
        renderDirectSqlPage("vincenology")
      ) : null}
    </>
  );
}
