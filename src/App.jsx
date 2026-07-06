import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Database, FilePlus2, UploadCloud } from "lucide-react";
import InvoiceGenerator from "./InvoiceGenerator.jsx";
import { callWorkflowApi } from "./workflowApi.js";

const NAV_ITEMS = [
  { key: "new", label: "New Invoice", icon: FilePlus2 },
  { key: "invoices", label: "Invoices", icon: ClipboardList },
  { key: "sql", label: "SQL Queue", icon: Database },
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

  const paidQueue = useMemo(
    () => invoices.filter((invoice) => invoice.Status === "Paid" && invoice["SQL Status"] !== "Uploaded to SQL"),
    [invoices],
  );

  async function loadInvoices() {
    try {
      setMessage("Loading invoices...");
      const data = await callWorkflowApi("listInvoices");
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
      await callWorkflowApi("createInvoice", mapped);
      setSaveStatus(`Saved ${mapped.invoice.invoiceNo} to workflow.`);
      await loadInvoices();
    } catch (error) {
      setSaveStatus(error.message);
    }
  }

  async function markPaid(invoiceId) {
    try {
      await callWorkflowApi("markPaid", {
        invoiceId,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentRef: "",
        proofUrl: "",
      });
      await loadInvoices();
      setMessage("Paid recorded. Invoice moved to SQL Queue.");
    } catch (error) {
      setMessage(error.message);
    }
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

  const visibleInvoices = invoices.filter((invoice) => {
    if (filter === "all") return true;
    if (filter === "paid") return invoice.Status === "Paid" && invoice["SQL Status"] !== "Uploaded to SQL";
    if (filter === "uploaded") return invoice["SQL Status"] === "Uploaded to SQL";
    return invoice.Status !== "Paid" && invoice.Status !== "Uploaded to SQL" && invoice.Status !== "Cancelled";
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
            <div><span>Active</span><strong>{invoices.filter((row) => row.Status !== "Paid" && row.Status !== "Uploaded to SQL" && row.Status !== "Cancelled").length}</strong></div>
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
                    <td>
                      <div className="workflow-row-actions">
                        <button
                          type="button"
                          className={`secondary-button paid-check-button ${invoice.Status === "Paid" ? "is-paid" : ""}`}
                          onClick={() => markPaid(invoice["Invoice ID"])}
                          disabled={invoice.Status === "Paid"}
                        >
                          <CheckCircle2 aria-hidden="true" />
                          Paid
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="workflow-empty">No invoices loaded.</td></tr>
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
            </div>
          </header>
          <p className="hint">If new customers appear, import Customer rows into SQL first. Then import Invoice rows.</p>
          <section className="workflow-section">
            <div className="workflow-page-header compact">
              <div>
                <p className="brand-label">Step 1</p>
                <h2>Customer Import</h2>
              </div>
              <div className="workflow-row-actions">
                <button type="button" className="secondary-button" onClick={() => copyRows(customerRows, "Customer")}>
                  Copy Customer Rows
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
                <h2>Invoice Import</h2>
              </div>
              <div className="workflow-row-actions">
                <button type="button" className="secondary-button" onClick={() => copyRows(sqlRows, "Invoice")}>
                  Copy Invoice Rows
                </button>
                <button
                  type="button"
                  className={`secondary-button upload-done-button ${invoiceUploadDone ? "is-done" : ""}`}
                  onClick={markInvoicesUploaded}
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
            <span>Invoice template rows</span>
            <textarea readOnly value={rowsToTsv(sqlRows)} />
          </label>
          </section>
        </main>
      ) : null}
    </>
  );
}
