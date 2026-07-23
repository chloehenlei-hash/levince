import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ClipboardList, Database, FilePlus2, Paperclip } from "lucide-react";
import InvoiceGenerator from "./InvoiceGenerator.jsx";
import { callWorkflowApi } from "./workflowApi.js";

const NAV_ITEMS = [
  { key: "new", label: "New Invoice", icon: FilePlus2 },
  { key: "invoices", label: "Invoices", icon: ClipboardList },
  { key: "sql", label: "SQL Upload", icon: Database },
  { key: "financial", label: "Vincenology SDN BHD", icon: Building2 },
];

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
  const [sqlSyncInfo, setSqlSyncInfo] = useState(null);
  const [selectedSqlInvoiceIds, setSelectedSqlInvoiceIds] = useState([]);
  const [retryingOrId, setRetryingOrId] = useState("");

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
    () => paidQueue.filter((invoice) => !isRmCurrency(invoice.Currency)),
    [paidQueue],
  );
  const uploadablePendingQueue = useMemo(
    () => pendingSqlConfirmQueue.filter((invoice) => isRmCurrency(invoice.Currency)),
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
    if (uploadablePendingQueue.length) warnings.push(`${uploadablePendingQueue.length} paid RM invoice(s) need Chloe confirmation before API upload.`);
    if (blockedCurrencyQueue.length) warnings.push(`${blockedCurrencyQueue.length} paid invoice(s) are not RM currency, so they will stay out of this API upload.`);
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
    const paidDate = new Date().toISOString().slice(0, 10);
    const slipFile = paymentSlipFiles[invoice["Invoice ID"]] || null;
    setMarkingPaidNo(invoiceNo);
    setRecentPaidUndo({ invoiceNo, customerName: invoice["Customer Name"] });
    setInvoices((current) => current.map((row) => (
      row["Invoice ID"] === invoice["Invoice ID"]
        ? { ...row, Status: "Paid", "SQL Status": "Not Uploaded", "Paid At": paidDate }
        : row
    )));
    setMessage(slipFile ? `${invoiceNo} is marked Paid. Uploading payment slip...` : `${invoiceNo} is marked Paid. No payment slip attached.`);
    try {
      const proofFile = await fileToProof(slipFile);
      await callWorkflowApi("markPaid", {
        invoiceId: invoice["Invoice ID"],
        paymentDate: paidDate,
        paymentRef: "",
        proofUrl: "",
        proofFile,
      });
      setPaymentSlipFiles((current) => {
        const next = { ...current };
        delete next[invoice["Invoice ID"]];
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
      setMessage("Choose at least one RM invoice to confirm for SQL upload.");
      return;
    }
    const count = selectedSqlUploadQueue.length;
    const pending = uploadablePendingQueue.length - count;
    const skipped = blockedCurrencyQueue.length ? `\n\n${blockedCurrencyQueue.length} non-RM invoice(s) will be skipped for now.` : "";
    const leftPending = pending > 0 ? `\n\n${pending} RM invoice(s) will stay pending.` : "";
    if (!window.confirm(`Confirm ${count} selected paid RM invoice(s) for scheduled SQL API upload?${leftPending}${skipped}`)) return;
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
      const skipText = blockedCurrencyQueue.length ? ` ${blockedCurrencyQueue.length} non-RM invoice(s) were left untouched.` : "";
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
                Select All RM
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
                    const canSelect = invoice["SQL Status"] !== "Ready for SQL" && isRmCurrency(invoice.Currency);
                    const isSelected = selectedSqlInvoiceIds.includes(id);
                    const hasOr = Boolean(invoice["SQL Payment Doc No"]);
                    const canRetryOr = isRmCurrency(invoice.Currency) && !hasOr && Boolean(invoice["SQL API Error"]);
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
                      <td>{money(invoice.Total, invoice.Currency)}</td>
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

      {view === "financial" ? (
        <main className="app-shell workflow-page financial-page">
          <header className="workflow-page-header">
            <div>
              <p className="brand-label">Second SQL account</p>
              <h1>Vincenology SDN BHD</h1>
            </div>
          </header>
          <section className="financial-hero-panel">
            <div>
              <span className="financial-step">1</span>
              <h2>SQL-format invoice</h2>
              <p>Create the invoice here, save it into this workflow, and export a PDF for the customer.</p>
            </div>
            <div>
              <span className="financial-step">2</span>
              <h2>Payment check</h2>
              <p>After the customer pays, mark it Paid from this page so it stays separate from LeVince invoices.</p>
            </div>
            <div>
              <span className="financial-step">3</span>
              <h2>OR by API</h2>
              <p>The paid invoice can create the Customer Payment / OR through this account's SQL API credentials.</p>
            </div>
          </section>
          <section className="workflow-section financial-next-panel">
            <p className="brand-label">Ready for setup</p>
            <h2>What this page will use</h2>
            <p>
              This second account should use its own Google Sheet tabs and its own SQL API keys, so it will not mix
              with the current LeVince SQL upload queue. The invoice PDF can be made in SQL style once we have one
              sample SQL invoice PDF or confirmed SQL report output from the API.
            </p>
          </section>
        </main>
      ) : null}
    </>
  );
}
