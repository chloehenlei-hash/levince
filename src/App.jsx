import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Database, FilePlus2, UploadCloud } from "lucide-react";
import InvoiceGenerator from "./InvoiceGenerator.jsx";
import { callWorkflowApi } from "./workflowApi.js";

const NAV_ITEMS = [
  { key: "new", label: "New Invoice", icon: FilePlus2 },
  { key: "invoices", label: "Invoices", icon: ClipboardList },
  { key: "sql", label: "SQL Queue", icon: Database },
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

function rowsToTsv(rows) {
  return (rows || [])
    .map((row) => row.map((cell) => String(cell ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t"))
    .join("\n");
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

export default function App() {
  const [view, setView] = useState("new");
  const [message, setMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [items, setItems] = useState([]);
  const [sqlRows, setSqlRows] = useState([]);
  const [customerRows, setCustomerRows] = useState([]);
  const [customerQueue, setCustomerQueue] = useState([]);
  const [customerUploadDone, setCustomerUploadDone] = useState(false);
  const [invoiceUploadDone, setInvoiceUploadDone] = useState(false);
  const [filter, setFilter] = useState("active");
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [recentPaidUndo, setRecentPaidUndo] = useState(null);
  const [markingPaidNo, setMarkingPaidNo] = useState("");
  const [reopeningNo, setReopeningNo] = useState("");
  const [copiedRowsLabel, setCopiedRowsLabel] = useState("");
  const [sqlSyncInfo, setSqlSyncInfo] = useState(null);

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
  const customerStepPending = customerQueue.length > 0 && !customerUploadDone;
  const sqlWarnings = useMemo(() => {
    const warnings = [];
    if (pendingSqlConfirmQueue.length) warnings.push(`${pendingSqlConfirmQueue.length} paid invoice(s) need Chloe confirmation before API upload.`);
    if (customerStepPending) warnings.push("New customers detected. Upload Customer rows before Invoice rows.");
    const missingPhone = paidQueue.filter((invoice) => !textValue(invoice["Customer Phone"]));
    if (missingPhone.length) warnings.push(`${missingPhone.length} paid invoice(s) have no customer phone.`);
    const foreignCurrency = paidQueue.filter((invoice) => textValue(invoice.Currency) && textValue(invoice.Currency) !== "RM");
    if (foreignCurrency.length) warnings.push(`${foreignCurrency.length} paid invoice(s) are not RM currency.`);
    const negativeRows = items.filter((item) => paidQueue.some((invoice) => invoice["Invoice ID"] === item["Invoice ID"]) && parseAmount(item.Amount) < 0);
    if (negativeRows.length) warnings.push(`${negativeRows.length} SQL item row(s) are negative amount rows.`);
    return warnings;
  }, [customerStepPending, items, paidQueue, pendingSqlConfirmQueue]);

  useEffect(() => {
    if (!recentPaidUndo) return undefined;
    const timer = window.setTimeout(() => setRecentPaidUndo(null), 10000);
    return () => window.clearTimeout(timer);
  }, [recentPaidUndo]);

  useEffect(() => {
    loadInvoices();
  }, []);

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
    setMarkingPaidNo(invoiceNo);
    setRecentPaidUndo({ invoiceNo, customerName: invoice["Customer Name"] });
    setInvoices((current) => current.map((row) => (
      row["Invoice ID"] === invoice["Invoice ID"]
        ? { ...row, Status: "Paid", "SQL Status": "Not Uploaded", "Paid At": paidDate }
        : row
    )));
    setMessage(`${invoiceNo} is marked Paid. It will turn green here first, then move to SQL Queue.`);
    try {
      await callWorkflowApi("markPaid", {
        invoiceId: invoice["Invoice ID"],
        paymentDate: paidDate,
        paymentRef: "",
        proofUrl: "",
      });
      await loadInvoices();
      setRecentPaidUndo({ invoiceNo, customerName: invoice["Customer Name"] });
      setMessage(`${invoiceNo} is now Paid. You can undo if this was a mistake.`);
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

  async function markInvoicesUploaded() {
    if (!paidQueue.length) {
      setMessage("No paid invoices waiting for SQL.");
      return;
    }
    if (!window.confirm("Mark paid invoices as uploaded to SQL?")) return;
    const count = paidQueue.length;
    try {
      for (const invoice of paidQueue) {
        await callWorkflowApi("markUploaded", { invoiceId: invoice["Invoice ID"] });
      }
      setSqlRows([]);
      await loadInvoices();
      setInvoiceUploadDone(true);
      setMessage(`All ${count} invoice(s) uploaded and archived.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function confirmScheduledUpload() {
    if (!paidQueue.length) {
      setMessage("No paid invoices waiting for SQL.");
      return;
    }
    if (!pendingSqlConfirmQueue.length) {
      setMessage(`${readySqlQueue.length} invoice(s) already confirmed for scheduled SQL upload.`);
      return;
    }
    const count = pendingSqlConfirmQueue.length;
    if (!window.confirm(`Confirm ${count} paid invoice(s) for scheduled SQL API upload?`)) return;
    try {
      setInvoices((current) => current.map((invoice) => (
        pendingSqlConfirmQueue.some((row) => row["Invoice ID"] === invoice["Invoice ID"])
          ? { ...invoice, "SQL Status": "Ready for SQL", "SQL API Error": "" }
          : invoice
      )));
      const data = await callWorkflowApi("confirmSqlUpload", {
        invoiceIds: pendingSqlConfirmQueue.map((invoice) => invoice["Invoice ID"]),
      });
      await loadInvoices();
      await refreshSqlExport();
      setMessage(`${data.count || 0} invoice(s) confirmed. They will upload during the next SQL API window.`);
    } catch (error) {
      await loadInvoices();
      setMessage(error.message);
    }
  }

  async function refreshSqlExport() {
    try {
      setCustomerUploadDone(false);
      setInvoiceUploadDone(false);
      const data = await callWorkflowApi("refreshSqlExport");
      setSqlRows(data.rows || []);
      setCustomerRows(data.customerRows || []);
      setCustomerQueue(data.customers || []);
      setMessage(`Prepared ${(data.customers || []).length} customer(s), ${(data.rows || []).length} invoice row(s).`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function copyRows(rows, label) {
    const text = rowsToTsv(rows);
    if (!text) {
      setMessage(`No ${label} rows yet. Refresh SQL Export first.`);
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopiedRowsLabel(label);
    window.setTimeout(() => setCopiedRowsLabel((current) => (current === label ? "" : current)), 2500);
    setMessage(`${label} rows copied.`);
  }

  async function markCustomersUploaded() {
    if (!customerQueue.length) {
      setMessage("No new customers waiting for SQL.");
      return;
    }
    if (!window.confirm("Mark these customers as uploaded to SQL?")) return;
    try {
      const data = await callWorkflowApi("markCustomersUploaded", {
        customerKeys: customerQueue.map((customer) => customer["Customer Key"]),
      });
      setCustomerRows([]);
      setCustomerQueue([]);
      await refreshSqlExport();
      setCustomerUploadDone(true);
      setMessage(`All ${data.count || 0} customer(s) uploaded and archived.`);
    } catch (error) {
      setMessage(error.message);
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
              <h1>SQL Queue</h1>
            </div>
            <div className="workflow-row-actions">
              <button type="button" className="secondary-button" onClick={loadInvoices}>Refresh Invoices</button>
              <button type="button" className="primary-button" onClick={refreshSqlExport}>Refresh SQL Export</button>
            </div>
          </header>
          <p className="hint">Paid invoices stay here until Chloe confirms them for the scheduled SQL API upload.</p>
          {sqlSyncInfo ? (
            <div className={`sql-sync-card ${sqlSyncInfo.ok ? "is-ok" : "is-error"}`}>
              <div>
                <span>Last SQL API run</span>
                <strong>{displayDateTime(sqlSyncInfo.ranAt)} · Uploaded {(sqlSyncInfo.uploaded || []).length} · Failed {(sqlSyncInfo.failed || []).length}</strong>
              </div>
              {(sqlSyncInfo.uploaded || []).length ? (
                <p>Uploaded: {(sqlSyncInfo.uploaded || []).map((row) => row.invoiceNo).join(", ")}</p>
              ) : null}
              {(sqlSyncInfo.failed || []).length ? (
                <p>Failed: {(sqlSyncInfo.failed || []).map((row) => `${row.invoiceNo}: ${row.error}`).join(" | ")}</p>
              ) : null}
            </div>
          ) : null}
          {sqlWarnings.length ? (
            <div className="workflow-warning-panel">
              {sqlWarnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}
          <section className="workflow-section">
            <div className="workflow-page-header compact">
              <div>
                <p className="brand-label">Step 1</p>
                <h2>Customer Import <span className={`step-state ${customerUploadDone ? "is-done" : customerQueue.length ? "is-ready" : ""}`}>{customerUploadDone ? "Done" : customerQueue.length ? "Ready" : "No new customers"}</span></h2>
              </div>
              <div className="workflow-row-actions">
                <button
                  type="button"
                  className={`secondary-button ${copiedRowsLabel === "Customer" ? "is-copied" : ""}`}
                  onClick={() => copyRows(customerRows, "Customer")}
                >
                  {copiedRowsLabel === "Customer" ? "Copied" : "Copy Customer Rows"}
                </button>
                <button
                  type="button"
                  className={`secondary-button upload-done-button ${customerUploadDone ? "is-done" : ""}`}
                  onClick={markCustomersUploaded}
                >
                  {customerUploadDone ? <CheckCircle2 aria-hidden="true" /> : <UploadCloud aria-hidden="true" />}
                  {customerUploadDone ? "All Uploaded" : "Customers Uploaded"}
                </button>
              </div>
            </div>
            <div className="workflow-table-wrap">
              <table className="workflow-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customerQueue.length ? customerQueue.map((customer) => (
                    <tr key={customer["Customer Key"]}>
                      <td><strong>{customer["SQL Customer Code"]}</strong></td>
                      <td>{customer["Customer Name"]}</td>
                      <td>{customer["Customer Phone"]}</td>
                      <td><span className={`workflow-status ${statusClass(customer.Status)}`}>{customer.Status}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" className="workflow-empty">No new customers waiting for SQL.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <label className="field workflow-export">
              <span>Customer template rows</span>
              <textarea readOnly value={rowsToTsv(customerRows)} />
            </label>
          </section>
          <section className="workflow-section">
            <div className="workflow-page-header compact">
              <div>
                <p className="brand-label">Step 2</p>
                <h2>Invoice Import <span className={`step-state ${invoiceUploadDone ? "is-done" : customerStepPending ? "is-blocked" : readySqlQueue.length ? "is-done" : paidQueue.length ? "is-ready" : ""}`}>{invoiceUploadDone ? "Done" : customerStepPending ? "Finish Step 1 first" : readySqlQueue.length ? "Confirmed" : paidQueue.length ? "Needs confirm" : "No paid invoices"}</span></h2>
              </div>
              <div className="workflow-row-actions">
                <button
                  type="button"
                  className={`primary-button ${!pendingSqlConfirmQueue.length && readySqlQueue.length ? "is-copied" : ""}`}
                  onClick={confirmScheduledUpload}
                  disabled={customerStepPending || !pendingSqlConfirmQueue.length}
                >
                  <CheckCircle2 aria-hidden="true" />
                  {!pendingSqlConfirmQueue.length && readySqlQueue.length ? "Confirmed for API" : "Confirm Scheduled Upload"}
                </button>
                <button
                  type="button"
                  className={`secondary-button ${copiedRowsLabel === "Invoice" ? "is-copied" : ""}`}
                  onClick={() => copyRows(sqlRows, "Invoice")}
                  disabled={customerStepPending}
                >
                  {copiedRowsLabel === "Invoice" ? "Copied" : "Copy Invoice Rows"}
                </button>
                <button
                  type="button"
                  className={`secondary-button upload-done-button ${invoiceUploadDone ? "is-done" : ""}`}
                  onClick={markInvoicesUploaded}
                  disabled={customerStepPending}
                >
                  {invoiceUploadDone ? <CheckCircle2 aria-hidden="true" /> : <UploadCloud aria-hidden="true" />}
                  {invoiceUploadDone ? "All Uploaded" : "Invoices Uploaded"}
                </button>
              </div>
            </div>
          <div className="workflow-table-wrap">
            <table className="workflow-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Customer</th>
                  <th>Item</th>
                  <th>Amount</th>
                  <th>SQL Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {paidQueue.flatMap((invoice) => {
                  const invoiceItems = items.filter((item) => item["Invoice ID"] === invoice["Invoice ID"]);
                  return invoiceItems.map((item) => (
                    <tr key={`${invoice["Invoice ID"]}-${item["Item ID"]}`}>
                      <td><strong>{invoice["Internal Invoice No"]}</strong></td>
                      <td>{invoice["Customer Name"]}</td>
                      <td>{item.Description}</td>
                      <td>{money(item.Amount, invoice.Currency)}</td>
                      <td><span className={`workflow-status ${statusClass(invoice["SQL Status"])}`}>{invoice["SQL Status"] || "Not Uploaded"}</span></td>
                      <td>{invoice["SQL API Error"] || ""}</td>
                    </tr>
                  ));
                })}
                {!paidQueue.length ? <tr><td colSpan="6" className="workflow-empty">No paid invoices waiting for SQL.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <label className="field workflow-export">
            <span>Invoice template rows</span>
            <textarea readOnly value={rowsToTsv(sqlRows)} />
          </label>
          </section>
        </main>
      ) : null}
    </>
  );
}
