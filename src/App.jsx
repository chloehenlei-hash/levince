import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Database, FilePlus2, Settings, UploadCloud } from "lucide-react";
import InvoiceGenerator from "./InvoiceGenerator.jsx";
import { callWorkflowApi, readConnection, saveConnection } from "./workflowApi.js";

const NAV_ITEMS = [
  { key: "new", label: "New Invoice", icon: FilePlus2 },
  { key: "invoices", label: "Invoices", icon: ClipboardList },
  { key: "sql", label: "SQL Queue", icon: Database },
  { key: "setup", label: "Setup", icon: Settings },
];

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
          quantity: textValue(line.qty) || 1,
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
  const emailValue = textValue(invoice.email);

  return {
    invoice: {
      documentType: invoice.documentLabel || "INVOICE",
      invoiceNo: textValue(invoice.receiptNumber),
      invoiceDate: textValue(invoice.invoiceDate),
      dueDate: "",
      customerName,
      sqlCustomerCode: "",
      customerEmail: emailLabel.includes("email") ? emailValue : "",
      customerPhone: textValue(invoice.phone),
      billingAddress: emailLabel.includes("address") ? emailValue : "",
      tin: "",
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

export default function App() {
  const [view, setView] = useState("new");
  const [connection, setConnection] = useState(readConnection);
  const [message, setMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [items, setItems] = useState([]);
  const [sqlRows, setSqlRows] = useState([]);
  const [filter, setFilter] = useState("active");

  const paidQueue = useMemo(
    () => invoices.filter((invoice) => invoice.Status === "Paid" && invoice["SQL Status"] !== "Uploaded to SQL"),
    [invoices],
  );

  function updateConnection(field, value) {
    setConnection((current) => ({ ...current, [field]: value }));
  }

  function persistConnection() {
    saveConnection(connection);
    setMessage("Connection saved in this browser.");
  }

  async function loadInvoices() {
    try {
      saveConnection(connection);
      setMessage("Loading invoices...");
      const data = await callWorkflowApi(connection, "listInvoices");
      setInvoices(data.invoices || []);
      setItems(data.items || []);
      setMessage(`Loaded ${(data.invoices || []).length} invoice(s).`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveGeneratedInvoice(payload) {
    try {
      const mapped = invoiceToWorkflowPayload(payload);
      if (!mapped.invoice.invoiceNo) {
        setSaveStatus("Document number is required before saving.");
        return;
      }
      if (!mapped.invoice.customerName) {
        setSaveStatus("Customer name is required before saving.");
        return;
      }
      setSaveStatus("Saving...");
      await callWorkflowApi(connection, "createInvoice", mapped);
      setSaveStatus(`Saved ${mapped.invoice.invoiceNo} to workflow.`);
      await loadInvoices();
    } catch (error) {
      setSaveStatus(error.message);
    }
  }

  async function markPaid(invoiceId) {
    const paymentRef = window.prompt("Payment reference / note:");
    if (paymentRef === null) return;
    try {
      await callWorkflowApi(connection, "markPaid", {
        invoiceId,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentRef,
        proofUrl: "",
      });
      await loadInvoices();
      setMessage("Invoice marked as paid.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function markUploaded(invoiceId) {
    if (!window.confirm("Mark this invoice as uploaded to SQL?")) return;
    try {
      await callWorkflowApi(connection, "markUploaded", { invoiceId });
      await loadInvoices();
      setMessage("Invoice marked as uploaded to SQL.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshSqlExport() {
    try {
      const data = await callWorkflowApi(connection, "refreshSqlExport");
      setSqlRows(data.rows || []);
      setMessage(`Prepared ${(data.rows || []).length} SQL row(s).`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function copySqlRows() {
    const text = rowsToTsv(sqlRows);
    if (!text) {
      setMessage("No SQL rows yet. Refresh SQL Export first.");
      return;
    }
    await navigator.clipboard.writeText(text);
    setMessage("SQL rows copied.");
  }

  const visibleInvoices = invoices.filter((invoice) => {
    if (filter === "all") return true;
    if (filter === "paid") return invoice.Status === "Paid" && invoice["SQL Status"] !== "Uploaded to SQL";
    if (filter === "uploaded") return invoice["SQL Status"] === "Uploaded to SQL";
    return invoice.Status !== "Uploaded to SQL" && invoice.Status !== "Cancelled";
  });

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
        {message ? <p className="workflow-message">{message}</p> : null}
      </div>

      {view === "new" ? (
        <InvoiceGenerator onSaveInvoice={saveGeneratedInvoice} saveStatus={saveStatus} />
      ) : null}

      {view === "invoices" ? (
        <main className="app-shell workflow-page">
          <header className="workflow-page-header">
            <div>
              <p className="brand-label">Workflow</p>
              <h1>Invoices</h1>
            </div>
            <div className="workflow-row-actions">
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="active">Active</option>
                <option value="paid">Paid Queue</option>
                <option value="uploaded">Uploaded</option>
                <option value="all">All</option>
              </select>
              <button type="button" className="secondary-button" onClick={loadInvoices}>Refresh</button>
            </div>
          </header>
          <div className="workflow-stats">
            <div><span>Active</span><strong>{invoices.filter((row) => row.Status !== "Uploaded to SQL").length}</strong></div>
            <div><span>Paid Queue</span><strong>{paidQueue.length}</strong></div>
            <div><span>Paid Value</span><strong>{money(paidQueue.reduce((sum, row) => sum + parseAmount(row.Total), 0))}</strong></div>
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
                  <th>SQL</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.length ? visibleInvoices.map((invoice) => (
                  <tr key={invoice["Invoice ID"]}>
                    <td><strong>{invoice["Internal Invoice No"]}</strong></td>
                    <td>{invoice["Customer Name"]}</td>
                    <td>{String(invoice["Invoice Date"] || "").slice(0, 12)}</td>
                    <td>{money(invoice.Total, invoice.Currency)}</td>
                    <td><span className={`workflow-status ${statusClass(invoice.Status)}`}>{invoice.Status}</span></td>
                    <td><span className={`workflow-status ${statusClass(invoice["SQL Status"])}`}>{invoice["SQL Status"]}</span></td>
                    <td>
                      <div className="workflow-row-actions">
                        <button type="button" className="secondary-button" onClick={() => markPaid(invoice["Invoice ID"])}>
                          <CheckCircle2 aria-hidden="true" />
                          Paid
                        </button>
                        <button type="button" className="secondary-button" onClick={() => markUploaded(invoice["Invoice ID"])}>
                          <UploadCloud aria-hidden="true" />
                          SQL
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="workflow-empty">No invoices loaded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
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
              <button type="button" className="secondary-button" onClick={copySqlRows}>Copy Rows</button>
            </div>
          </header>
          <p className="hint">Only Paid invoices that have not been marked Uploaded to SQL will appear here.</p>
          <div className="workflow-table-wrap">
            <table className="workflow-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Customer</th>
                  <th>Item</th>
                  <th>Amount</th>
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
                    </tr>
                  ));
                })}
                {!paidQueue.length ? <tr><td colSpan="4" className="workflow-empty">No paid invoices waiting for SQL.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <label className="field workflow-export">
            <span>SQL template rows</span>
            <textarea readOnly value={rowsToTsv(sqlRows)} />
          </label>
        </main>
      ) : null}

      {view === "setup" ? (
        <main className="app-shell workflow-page readable">
          <p className="brand-label">Setup</p>
          <h1>Setup</h1>
          <p>
            This page is only for the one-time connection. Chloe can set it once in each browser; daily invoice work
            happens in New Invoice, Invoices, and SQL Queue.
          </p>
          <div className="workflow-connection setup-connection">
            <label className="field">
              <span>Private connection link</span>
              <input
                aria-label="Private connection link"
                value={connection.apiUrl}
                placeholder="Paste the private connection link here"
                onChange={(event) => updateConnection("apiUrl", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Current user</span>
              <select
                aria-label="Current user"
                value={connection.user}
                onChange={(event) => updateConnection("user", event.target.value)}
              >
                <option value="Chloe">Chloe</option>
                <option value="Desmond">Desmond</option>
              </select>
            </label>
            <label className="field">
              <span>Private PIN</span>
              <input
                aria-label="Private PIN"
                value={connection.pin}
                type="password"
                placeholder="PIN"
                onChange={(event) => updateConnection("pin", event.target.value)}
              />
            </label>
            <button type="button" className="secondary-button" onClick={persistConnection}>
              Save Setup
            </button>
            <button type="button" className="primary-button" onClick={loadInvoices}>
              Test Connection
            </button>
          </div>
          <p>
            Current user is only for the record, so the system knows whether Chloe created the invoice or Desmond marked
            it paid. The PIN is a small lock so random visitors cannot update your records.
          </p>
        </main>
      ) : null}
    </>
  );
}
