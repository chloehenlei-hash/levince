import { useEffect, useRef, useState } from "react";
import { Download, FilePlus2, FileText, Loader2, Plus, Share2, Trash2 } from "./icons.js";
import { emptySqlInvoice, localDate, monthPrefix, newSqlLine, nextSqlNumber, organiseSqlInvoice, recordSqlNumber, SQL_DRAFT_KEY, SQL_SEQUENCE_KEY, sqlLineTotal, sqlTotals, validateSqlInvoice } from "./utils/sqlInvoice.js";
import { generateSqlInvoicePdf } from "./pdf/sqlInvoicePdf.js";

function savedSequences() {
  try { return JSON.parse(localStorage.getItem(SQL_SEQUENCE_KEY) || "{}"); } catch { return {}; }
}
function restoreDraft() {
  const date = localDate();
  try {
    const stored = JSON.parse(localStorage.getItem(SQL_DRAFT_KEY));
    if (stored?.lines?.length) return { ...stored, date, number: monthPrefix(stored.date) === monthPrefix(date) ? stored.number : nextSqlNumber(date, savedSequences()) };
  } catch { /* Start a new draft when stored data is invalid. */ }
  return emptySqlInvoice(date, savedSequences());
}
function Field({ label, value, onChange, type = "text" }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
const money = (n) => Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SqlInvoiceGenerator() {
  const [invoice, setInvoice] = useState(restoreDraft);
  const [paste, setPaste] = useState("");
  const [output, setOutput] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const urlRef = useRef("");
  const totals = sqlTotals(invoice.lines);
  useEffect(() => { localStorage.setItem(SQL_DRAFT_KEY, JSON.stringify(invoice)); }, [invoice]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  function clearOutput() { if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = ""; setOutput(null); }
  function update(key, value) {
    clearOutput(); setError("");
    setInvoice((current) => ({ ...current, [key]: value, ...(key === "date" && value && monthPrefix(value) !== monthPrefix(current.date) ? { number: nextSqlNumber(value, savedSequences()) } : {}) }));
  }
  function updateLine(id, key, value) { update("lines", invoice.lines.map((line) => line.id === id ? { ...line, [key]: value } : line)); }
  function organise() {
    if (!paste.trim()) { setError("Paste customer and service details first."); return; }
    try { setInvoice(organiseSqlInvoice(paste, invoice)); clearOutput(); setError(""); } catch (cause) { setError(cause.message); }
  }
  function newInvoice() {
    setInvoice(emptySqlInvoice(localDate(), savedSequences())); setPaste(""); setError(""); clearOutput();
  }
  function incrementNumber() {
    try { update("number", nextSqlNumber(invoice.date, recordSqlNumber(invoice.date, invoice.number, savedSequences()))); }
    catch (cause) { setError(cause.message); }
  }
  async function generate() {
    const invalid = validateSqlInvoice(invoice);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      const result = await generateSqlInvoicePdf(invoice);
      localStorage.setItem(SQL_SEQUENCE_KEY, JSON.stringify(recordSqlNumber(invoice.date, invoice.number, savedSequences())));
      clearOutput(); urlRef.current = URL.createObjectURL(result.blob); setOutput({ ...result, url: urlRef.current });
    } catch (cause) { setError(cause.message || "Unable to generate PDF."); } finally { setBusy(false); }
  }
  async function share() {
    setError(""); setSharing(true);
    try {
      const file = new File([output.blob], output.filename, { type: "application/pdf" });
      if (!navigator.canShare?.({ files: [file] }) || !navigator.share) throw new Error("File sharing is unavailable in this browser. Use Download PDF.");
      await navigator.share({ files: [file] });
    } catch (cause) { if (cause.name !== "AbortError") setError(cause.message); } finally { setSharing(false); }
  }
  return <main className="app-shell sql-generator">
    <header className="topbar">
      <div className="brand-heading"><img src={`${import.meta.env.BASE_URL}assets/levince-logo.png`} alt="LeVince" /><div><p className="brand-label">Vincenology (M) Sdn Bhd</p><h1>SQL Invoice</h1></div></div>
      <div className="topbar-right"><div className="sql-number-fields">
        <Field label="Invoice date" type="date" value={invoice.date} onChange={(value) => update("date", value)} />
        <div className="number-field"><Field label="Invoice number" value={invoice.number} onChange={(value) => update("number", value)} /><button type="button" className="number-increment" title="Next invoice number" aria-label="Next SQL invoice number" onClick={incrementNumber}><Plus /></button></div>
      </div><button type="button" className="ghost-button" onClick={newInvoice}><FilePlus2 />New Invoice</button></div>
    </header>
    <div className="workspace">
      <form className="editor" onSubmit={(event) => event.preventDefault()}>
        <section className="section"><h2>Quick Paste</h2><label className="field"><span>Customer and service details</span><textarea rows={9} value={paste} onChange={(event) => setPaste(event.target.value)} /></label><div className="paste-actions"><button type="button" className="primary-button" onClick={organise}><FileText />Organise</button></div></section>
        <section className="section"><h2>Customer</h2><div className="field-grid">
          <Field label="Company" value={invoice.company} onChange={(v) => update("company", v)} />
          <Field label="Customer / attention" value={invoice.name} onChange={(v) => update("name", v)} />
          <Field label="Email" value={invoice.email} onChange={(v) => update("email", v)} />
          <Field label="Phone" value={invoice.phone} onChange={(v) => update("phone", v)} />
        </div><label className="field"><span>Billing address</span><textarea rows={3} value={invoice.address} onChange={(e) => update("address", e.target.value)} /></label></section>
        <section className="section"><h2>Invoice Details</h2><div className="field-grid"><Field label="Your reference" value={invoice.reference} onChange={(v) => update("reference", v)} /><Field label="Our D/O number" value={invoice.deliveryNumber} onChange={(v) => update("deliveryNumber", v)} /><Field label="Terms" value={invoice.terms} onChange={(v) => update("terms", v)} /></div></section>
        <section className="section"><h2>Services</h2><div className="sql-lines">
          {invoice.lines.map((line, index) => <div className="sql-line" key={line.id}>
            <div className="sql-line-heading"><span>{index + 1}. {line.note ? "Note" : "Charge"}</span><button type="button" className="ghost-button" aria-label={`Remove SQL line ${index + 1}`} title="Remove line" onClick={() => update("lines", invoice.lines.filter((row) => row.id !== line.id))}><Trash2 /></button></div>
            <Field label="Service date" value={line.date} onChange={(v) => updateLine(line.id, "date", v)} />
            <label className="field"><span>Description</span><textarea rows={2} value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} /></label>
            {!line.note && <><div className="sql-price-fields"><Field label="Qty" type="number" value={line.qty} onChange={(v) => updateLine(line.id, "qty", v)} /><Field label="Price / unit (RM)" type="number" value={line.unitPrice} onChange={(v) => updateLine(line.id, "unitPrice", v)} /><Field label="Discount (RM)" type="number" value={line.discount} onChange={(v) => updateLine(line.id, "discount", v)} /></div>
              <div className="sql-tax-row"><div className="choice-buttons" role="group" aria-label={`SST for line ${index + 1}`}>{[8, 0].map((rate) => <button key={rate} type="button" className="choice-button" aria-pressed={Number(line.taxRate) === rate} onClick={() => updateLine(line.id, "taxRate", rate)}>{rate ? "8% SST" : "No SST"}</button>)}</div><strong>RM {money(sqlLineTotal(line).gross)}</strong></div></>}
          </div>)}
        </div><div className="service-add-actions"><button type="button" className="ghost-button" onClick={() => update("lines", [...invoice.lines, newSqlLine()])}><Plus />Add charge</button><button type="button" className="ghost-button" onClick={() => update("lines", [...invoice.lines, newSqlLine({ note: true })])}><Plus />Add note</button></div>
        <dl className="sql-totals"><div><dt>Before SST</dt><dd>RM {money(totals.net)}</dd></div><div><dt>SST</dt><dd>RM {money(totals.tax)}</dd></div><div><dt>Total</dt><dd>RM {money(totals.gross)}</dd></div></dl></section>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="generate-bar"><button type="button" className="primary-button" disabled={busy} onClick={generate}>{busy ? <Loader2 className="spin" /> : <FileText />}{busy ? "Generating..." : "Generate PDF"}</button>{output && <><a className="ghost-button" href={output.url} download={output.filename}><Download />Download PDF</a><button type="button" className="ghost-button" disabled={sharing} onClick={share}><Share2 />Share PDF</button></>}</div>
      </form>
      <aside className="preview-panel">{output ? <iframe title="SQL invoice PDF preview" src={output.url} className="sql-pdf-preview" /> : <div className="empty-preview"><FileText size={32} /><h2>No PDF generated yet</h2></div>}</aside>
    </div>
  </main>;
}
