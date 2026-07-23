import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  createEmptyInvoiceData,
  createServiceDate,
  createServiceGroup,
  createServiceLine,
  DEFAULT_FOOTER_TEXT,
  DEFAULT_HEADER_LABELS,
  DEFAULT_NOTES_TITLE,
  DEFAULT_PAYMENT_NOTES,
  defaultInvoiceData,
  generateInvoicePdf,
  getCurrentInvoiceDate,
  getInvoiceSubtotal,
  getInvoiceTotal,
  normaliseInvoiceData,
  validateInvoice,
} from "./pdf/invoicePdf";
import { parsePastedInvoiceDetails as parseInvoiceTextDetails } from "./utils/invoiceTextParser";
import { getPdfFileFromPaste, parsePastedPdfInvoice } from "./utils/pdfInvoiceParser";
import { callWorkflowApi } from "./workflowApi.js";

const STORAGE_KEY = "levince-invoice-draft";

function formatAmount(value) {
  return value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function withDefaultPaymentNotes(invoice) {
  return {
    ...invoice,
    notesTitle: DEFAULT_NOTES_TITLE,
    paymentNotes: DEFAULT_PAYMENT_NOTES,
    footerText: DEFAULT_FOOTER_TEXT,
  };
}

function readStoredDraft() {
  const today = getCurrentInvoiceDate();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...defaultInvoiceData(), invoiceDate: today };
    const draft = normaliseInvoiceData(JSON.parse(stored));
    return withDefaultPaymentNotes({ ...draft, invoiceDate: today });
  } catch {
    return { ...defaultInvoiceData(), invoiceDate: today };
  }
}

function Field({ label, value, onChange, placeholder, type = "text", required = false }) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? <b> *</b> : null}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function InvoiceGenerator({ onSaveInvoice, saveStatus = "", existingInvoices = [] }) {
  const [invoice, setInvoice] = useState(readStoredDraft);
  const [previewUrl, setPreviewUrl] = useState("");
  const [generatedBlob, setGeneratedBlob] = useState(null);
  const [filename, setFilename] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const [quickPasteText, setQuickPasteText] = useState("");
  const [quickPasteStatus, setQuickPasteStatus] = useState("");
  const [isAiOrganising, setIsAiOrganising] = useState(false);
  const [isPdfDragOver, setIsPdfDragOver] = useState(false);
  const [tableLayout, setTableLayout] = useState("normal");
  const lastPreviewUrl = useRef("");
  const pdfInputRef = useRef(null);
  const generatedInvoiceRef = useRef(null);
  const lastAutoSavedKey = useRef("");

  const missingFields = useMemo(() => validateInvoice(invoice), [invoice]);
  const subtotal = useMemo(() => getInvoiceSubtotal(invoice), [invoice]);
  const total = useMemo(() => getInvoiceTotal(invoice), [invoice]);
  const duplicateInvoice = useMemo(() => {
    const no = String(invoice.receiptNumber || "").trim();
    if (!no) return null;
    return existingInvoices.find((row) => String(row["Internal Invoice No"] || "").trim() === no) || null;
  }, [existingInvoices, invoice.receiptNumber]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoice));
  }, [invoice]);

  useEffect(
    () => () => {
      if (lastPreviewUrl.current) URL.revokeObjectURL(lastPreviewUrl.current);
    },
    [],
  );

  useEffect(() => {
    async function handlePaste(event) {
      const file = getPdfFileFromPaste(event);
      if (!file) return;
      event.preventDefault();
      await applyPdfFile(file);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [invoice]);

  function updateInvoice(field, value) {
    setInvoice((current) => ({ ...current, [field]: value }));
  }

  async function applyPdfFile(file) {
    if (!file) return;
    setQuickPasteStatus("Reading PDF...");
    try {
      const parsed = await parsePastedPdfInvoice(file, invoice);
      setInvoice(withDefaultPaymentNotes(parsed));
      clearGeneratedOutput();
      setError("");
      setQuickPasteStatus("PDF applied. Review the fields, then generate again.");
    } catch (pasteError) {
      setQuickPasteStatus(pasteError.message || "Unable to read this PDF.");
    }
  }

  function handlePdfDrop(event) {
    event.preventDefault();
    setIsPdfDragOver(false);
    const file = Array.from(event.dataTransfer?.files || []).find(
      (item) => item.type === "application/pdf" || /\.pdf$/i.test(item.name || ""),
    );
    applyPdfFile(file);
  }

  function choosePdfFile() {
    pdfInputRef.current?.click();
  }

  function updateHeaderLabel(field, value) {
    setInvoice((current) => ({
      ...current,
      headerLabels: {
        ...DEFAULT_HEADER_LABELS,
        ...(current.headerLabels || {}),
        [field]: value,
      },
    }));
  }

  function getHeaderLabel(field) {
    return invoice.headerLabels?.[field] || DEFAULT_HEADER_LABELS[field] || "";
  }

  function updateServiceGroup(groupId, field, value) {
    setInvoice((current) => ({
      ...current,
      serviceGroups: current.serviceGroups.map((group) =>
        group.id === groupId ? { ...group, [field]: value } : group,
      ),
    }));
  }

  function updateServiceDate(groupId, dateId, field, value) {
    setInvoice((current) => ({
      ...current,
      serviceGroups: current.serviceGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              dates: group.dates.map((dateGroup) =>
                dateGroup.id === dateId ? { ...dateGroup, [field]: value } : dateGroup,
              ),
            }
          : group,
      ),
    }));
  }

  function updateServiceLine(groupId, dateId, lineId, field, value) {
    setInvoice((current) => ({
      ...current,
      serviceGroups: current.serviceGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              dates: group.dates.map((dateGroup) =>
                dateGroup.id === dateId
                  ? {
                      ...dateGroup,
                      lines: dateGroup.lines.map((line) =>
                        line.id === lineId ? { ...line, [field]: value } : line,
                      ),
                    }
                  : dateGroup,
              ),
            }
          : group,
      ),
    }));
  }

  function clearGeneratedOutput() {
    if (lastPreviewUrl.current) URL.revokeObjectURL(lastPreviewUrl.current);
    lastPreviewUrl.current = "";
    generatedInvoiceRef.current = null;
    lastAutoSavedKey.current = "";
    setPreviewUrl("");
    setGeneratedBlob(null);
    setFilename("");
  }

  function addServiceGroup() {
    setInvoice((current) => ({
      ...current,
      serviceGroups: [...current.serviceGroups, createServiceGroup()],
    }));
  }

  function removeServiceGroup(groupId) {
    setInvoice((current) => ({
      ...current,
      serviceGroups:
        current.serviceGroups.length === 1
          ? [createServiceGroup()]
          : current.serviceGroups.filter((group) => group.id !== groupId),
    }));
  }

  function addServiceDate(groupId) {
    setInvoice((current) => ({
      ...current,
      serviceGroups: current.serviceGroups.map((group) =>
        group.id === groupId ? { ...group, dates: [...group.dates, createServiceDate()] } : group,
      ),
    }));
  }

  function removeServiceDate(groupId, dateId) {
    setInvoice((current) => ({
      ...current,
      serviceGroups: current.serviceGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              dates:
                group.dates.length === 1
                  ? [createServiceDate()]
                  : group.dates.filter((dateGroup) => dateGroup.id !== dateId),
            }
          : group,
      ),
    }));
  }

  function addServiceLine(groupId, dateId, kind = "charge") {
    const newLine =
      kind === "spacer"
        ? createServiceLine({ kind: "spacer", isSpacer: true })
        : createServiceLine({ kind });
    setInvoice((current) => ({
      ...current,
      serviceGroups: current.serviceGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              dates: group.dates.map((dateGroup) =>
                dateGroup.id === dateId
                  ? { ...dateGroup, lines: [...dateGroup.lines, newLine] }
                  : dateGroup,
              ),
            }
          : group,
      ),
    }));
  }

  function removeServiceLine(groupId, dateId, lineId) {
    setInvoice((current) => ({
      ...current,
      serviceGroups: current.serviceGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              dates: group.dates.map((dateGroup) =>
                dateGroup.id === dateId
                  ? {
                      ...dateGroup,
                      lines:
                        dateGroup.lines.length === 1
                          ? [createServiceLine()]
                          : dateGroup.lines.filter((line) => line.id !== lineId),
                    }
                  : dateGroup,
              ),
            }
          : group,
      ),
    }));
  }

  async function handleGenerate() {
    setError("");
    const missing = validateInvoice(invoice);
    if (missing.length) {
      setError(`Please complete: ${missing.join(", ")}.`);
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateInvoicePdf({ ...invoice, tableLayout });
      if (lastPreviewUrl.current) URL.revokeObjectURL(lastPreviewUrl.current);
      const url = URL.createObjectURL(result.blob);
      lastPreviewUrl.current = url;
      setPreviewUrl(url);
      setGeneratedBlob(result.blob);
      setFilename(result.filename);
      generatedInvoiceRef.current = normaliseInvoiceData(invoice);
      lastAutoSavedKey.current = "";
    } catch (generationError) {
      setError(generationError.message || "Unable to generate PDF.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function autoSaveDownloadedInvoice(fileName) {
    if (!onSaveInvoice) return { saved: true, skipped: true };
    const savedInvoice = generatedInvoiceRef.current || invoice;
    const documentType = String(savedInvoice.documentLabel || "INVOICE").trim().toUpperCase();
    if (documentType !== "INVOICE") return { saved: true, skipped: true };
    const saveKey = `${savedInvoice.receiptNumber || ""}|${fileName}|${generatedBlob?.size || 0}`;
    if (lastAutoSavedKey.current === saveKey) return { saved: true, skipped: true };
    const saved = await onSaveInvoice({
      invoice: savedInvoice,
      tableLayout,
      filename: fileName,
      hasGeneratedPdf: true,
    });
    if (saved) lastAutoSavedKey.current = saveKey;
    return { saved: Boolean(saved), skipped: false };
  }

  async function handleDownload() {
    if (!generatedBlob) return;
    if (isDownloading) return;

    const fileName = filename || "Levince Chauffeur.pdf";
    setError("");
    setIsDownloading(true);

    try {
      const saveResult = await autoSaveDownloadedInvoice(fileName);
      if (!saveResult.saved) {
        setError("PDF was not downloaded because the invoice could not be saved. Please check the save message and try again.");
        return;
      }

      if (typeof File !== "undefined" && navigator.share && navigator.canShare) {
        const file = new File([generatedBlob], fileName, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: fileName.replace(/\.pdf$/i, ""),
            });
            return;
          } catch (shareError) {
            if (shareError?.name === "AbortError") return;
          }
        }
      }

      const downloadUrl = URL.createObjectURL(generatedBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);
    } finally {
      setIsDownloading(false);
    }
  }

  function resetToSample() {
    setInvoice({ ...defaultInvoiceData(), invoiceDate: getCurrentInvoiceDate() });
    setTableLayout("normal");
    setError("");
    clearGeneratedOutput();
  }

  function clearForm() {
    setInvoice({ ...createEmptyInvoiceData(), invoiceDate: getCurrentInvoiceDate() });
    setTableLayout("normal");
    setError("");
    setQuickPasteStatus("");
    clearGeneratedOutput();
  }

  function applyNormalPasteText(value) {
    const text = String(value || "").trim();
    if (!text) {
      setQuickPasteStatus("Paste invoice details first.");
      return;
    }

    setInvoice((current) => parseInvoiceTextDetails(text, current));
    setQuickPasteStatus("Normal organise complete. Please review the details.");
    setError("");
  }

  async function applyAiPasteText(value) {
    const text = String(value || "").trim();
    if (!text) {
      setQuickPasteStatus("Paste invoice details first.");
      return;
    }

    setIsAiOrganising(true);
    setQuickPasteStatus("AI is organising the details...");
    try {
      const result = await callWorkflowApi("parseInvoiceWithGemini", { text });
      const organisedText = String(result.normalizedText || "").trim();
      if (!organisedText) throw new Error("No organised text returned.");
      setInvoice((current) => parseInvoiceTextDetails(organisedText, current));
      setQuickPasteStatus("AI organise complete. Please check the details and amounts.");
    } catch (aiError) {
      setQuickPasteStatus(aiError?.message || "AI organise failed. Try Normal Organise instead.");
    } finally {
      setIsAiOrganising(false);
    }
    setError("");
  }

  function applyQuickPaste() {
    applyNormalPasteText(quickPasteText);
  }

  function applyAiQuickPaste() {
    applyAiPasteText(quickPasteText);
  }

  function handleQuickPaste(event) {
    const text = event.clipboardData?.getData("text/plain") || "";
    if (!text.trim()) return;
    setQuickPasteStatus("Details pasted. Choose Normal Organise or AI Organise.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-label">Levince internal tool</p>
          <h1>Invoice Generator</h1>
        </div>
        <div className="topbar-right">
          <div className="document-quick-panel" aria-label="Document type and number">
            <label className="field document-type-field">
              <span>Document type</span>
              <select value={invoice.documentLabel} onChange={(event) => updateInvoice("documentLabel", event.target.value)}>
                <option value="INVOICE">INVOICE</option>
                <option value="QUOTATION">QUOTATION</option>
                <option value="RECEIPT">RECEIPT</option>
              </select>
            </label>
            <Field
              label="Document number"
              value={invoice.receiptNumber}
              required
              placeholder="104247"
              onChange={(value) => updateInvoice("receiptNumber", value)}
            />
            {duplicateInvoice ? (
              <p className="duplicate-warning">Existing record: {duplicateInvoice["Customer Name"] || "Unknown customer"} · {duplicateInvoice.Status || "Saved"}</p>
            ) : null}
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-button" onClick={resetToSample} title="Load sample invoice">
              <RefreshCcw aria-hidden="true" />
              Sample
            </button>
            <button type="button" className="ghost-button" onClick={clearForm} title="Clear all invoice fields">
              <RotateCcw aria-hidden="true" />
              Clear
            </button>
          </div>
        </div>
      </header>

      <div className="workspace">
        <form className="editor" onSubmit={(event) => event.preventDefault()}>
          <Section title="Quick Paste">
            <input
              ref={pdfInputRef}
              className="pdf-file-input"
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                applyPdfFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div
              className={`pdf-paste-zone ${isPdfDragOver ? "is-drag-over" : ""}`}
              role="button"
              tabIndex={0}
              onClick={choosePdfFile}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") choosePdfFile();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsPdfDragOver(true);
              }}
              onDragLeave={() => setIsPdfDragOver(false)}
              onDrop={handlePdfDrop}
            >
              <UploadCloud aria-hidden="true" />
              <div>
                <strong>Paste PDF here</strong>
                <span>Copy a PDF from WhatsApp, click this box, then press Cmd + V.</span>
              </div>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={(event) => {
                  event.stopPropagation();
                  choosePdfFile();
                }}
              >
                Choose PDF
              </button>
              {quickPasteStatus ? <em>{quickPasteStatus}</em> : null}
            </div>
            <label className="field paste-field">
              <span>Invoice details</span>
              <textarea
                value={quickPasteText}
                placeholder={`Name : Melanie Chalil
Company Name : -
Email : melanie.chalil@gmail.com
Mobile : 012-223 6976

10th May
Airport Transfer
RM140

13 May 2026
Taipei Chauffeur Service 10h 13000 TWD
Alphard

**Additional hourly rate @ 1500 TWD / hour
**Inclusive one airport transfer on 13rd and 15th May.

Remark
For airport arrival, 90 minutes waiting time is included.`}
                onChange={(event) => setQuickPasteText(event.target.value)}
                onPaste={handleQuickPaste}
              />
            </label>
            <p className="mini-instruction">Each pasted line stays as its own invoice row. Choose AI only when the text is messy.</p>
            <div className="paste-actions">
              <button type="button" className="secondary-button" onClick={applyQuickPaste}>
                <FileText aria-hidden="true" />
                Normal Organise
              </button>
              <button type="button" className="ai-button" onClick={applyAiQuickPaste} disabled={isAiOrganising}>
                {isAiOrganising ? <Loader2 className="spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                AI Organise
              </button>
              {quickPasteStatus ? <span>{quickPasteStatus}</span> : null}
            </div>
          </Section>

          <Section title="Customer">
            <div className="particulars-grid">
              <div className="particular-row">
                <Field
                  label="PDF label"
                  value={getHeaderLabel("companyName")}
                  placeholder="COMPANY NAME"
                  onChange={(value) => updateHeaderLabel("companyName", value)}
                />
                <Field
                  label="Company value"
                  value={invoice.companyName}
                  placeholder="ABC Logistics Sdn Bhd"
                  onChange={(value) => updateInvoice("companyName", value)}
                />
              </div>
              <div className="particular-row">
                <Field
                  label="PDF label"
                  value={getHeaderLabel("customerName")}
                  placeholder="CUSTOMER NAME"
                  onChange={(value) => updateHeaderLabel("customerName", value)}
                />
                <Field
                  label="Customer value"
                  value={invoice.customerName}
                  required
                  placeholder="Melanie Chalil"
                  onChange={(value) => updateInvoice("customerName", value)}
                />
              </div>
              <div className="particular-row">
                <Field
                  label="PDF label"
                  value={getHeaderLabel("email")}
                  placeholder="EMAIL"
                  onChange={(value) => updateHeaderLabel("email", value)}
                />
                <Field
                  label="Email / address value"
                  value={invoice.email}
                  placeholder="customer@email.com"
                  onChange={(value) => updateInvoice("email", value)}
                />
              </div>
              <div className="particular-row">
                <Field
                  label="PDF label"
                  value={getHeaderLabel("phone")}
                  placeholder="PHONE"
                  onChange={(value) => updateHeaderLabel("phone", value)}
                />
                <Field
                  label="Phone value"
                  value={invoice.phone}
                  placeholder="012-345 6789"
                  onChange={(value) => updateInvoice("phone", value)}
                />
              </div>
            </div>
          </Section>

          <Section title="Invoice">
            <div className="particulars-grid invoice-particulars">
              <div className="particular-row">
                <Field
                  label="PDF label"
                  value={getHeaderLabel("invoiceDate")}
                  placeholder="DATE"
                  onChange={(value) => updateHeaderLabel("invoiceDate", value)}
                />
                <Field
                  label="Date value"
                  value={invoice.invoiceDate}
                  required
                  placeholder={getCurrentInvoiceDate()}
                  onChange={(value) => updateInvoice("invoiceDate", value)}
                />
              </div>
              <div className="particular-row">
                <Field
                  label="PDF label"
                  value={getHeaderLabel("invoiceTitle")}
                  placeholder="INVOICE TITLE"
                  onChange={(value) => updateHeaderLabel("invoiceTitle", value)}
                />
                <Field
                  label="Invoice title value"
                  value={invoice.invoiceTitle}
                  required
                  placeholder="LeVince Chauffeur Service"
                  onChange={(value) => updateInvoice("invoiceTitle", value)}
                />
              </div>
            </div>
            <div className="grid two">
              <Field
                label="Currency"
                value={invoice.currency}
                placeholder="RM"
                onChange={(value) => updateInvoice("currency", value)}
              />
            </div>
          </Section>

          <Section title="Services">
            <p className="mini-instruction">
              Add a charge, a text-only note, or a blank line. Service date is optional.
            </p>
            <details className="service-options">
              <summary>More options</summary>
              <label className="field table-layout-field">
                <span>Description width</span>
                <select value={tableLayout} onChange={(event) => setTableLayout(event.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="wider">Wider</option>
                  <option value="extraWide">Extra wide</option>
                </select>
              </label>
            </details>
            <div className="service-groups">
              {invoice.serviceGroups.map((group, groupIndex) => (
                <article className="service-group" key={group.id}>
                  <div className="service-group-header">
                    <Field
                      label={invoice.serviceGroups.length > 1 ? `Section title ${groupIndex + 1}` : "Section title"}
                      value={group.heading}
                      required
                      placeholder="Private Chauffeur Service"
                      onChange={(value) => updateServiceGroup(group.id, "heading", value)}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeServiceGroup(group.id)}
                      title="Remove service section"
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>

                  <div className="service-dates">
                    {group.dates.map((dateGroup) => (
                      <div className="service-date-card" key={dateGroup.id}>
                        <div className="service-date-header">
                          <Field
                            label="Service date (optional)"
                            value={dateGroup.date}
                            placeholder="Leave blank if there is no service date"
                            onChange={(value) => updateServiceDate(group.id, dateGroup.id, "date", value)}
                          />
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => removeServiceDate(group.id, dateGroup.id)}
                            title="Remove this date group"
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>

                        <div className="line-items">
                          {dateGroup.lines.map((line) => {
                            const lineKind = line.kind || (line.isSpacer ? "spacer" : line.isNote ? "note" : "charge");
                            if (lineKind === "spacer") {
                              return (
                                <div className="service-spacer-row" key={line.id}>
                                  <span>Blank line</span>
                                  <button type="button" className="icon-button" onClick={() => removeServiceLine(group.id, dateGroup.id, line.id)} title="Remove blank line">
                                    <Trash2 aria-hidden="true" />
                                  </button>
                                </div>
                              );
                            }
                            return (
                            <div className={`line-row service-line-row is-${lineKind}`} key={line.id}>
                              <span className={`line-kind-badge is-${lineKind}`}>{lineKind === "note" ? "Note" : "Charge"}</span>
                              <label className="line-input description-input">
                                <span>Description</span>
                                <input
                                  value={line.description}
                                  placeholder="Airport Transfer"
                                  onChange={(event) =>
                                    updateServiceLine(
                                      group.id,
                                      dateGroup.id,
                                      line.id,
                                      "description",
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              {lineKind === "charge" ? <label className="line-input qty-input">
                                <span>Qty</span>
                                <input
                                  value={line.qty}
                                  inputMode="numeric"
                                  placeholder="1"
                                  onChange={(event) =>
                                    updateServiceLine(group.id, dateGroup.id, line.id, "qty", event.target.value)
                                  }
                                />
                              </label> : null}
                              {lineKind === "charge" ? <label className="line-input amount-input">
                                <span>Amount</span>
                                <input
                                  value={line.amount}
                                  inputMode="decimal"
                                  placeholder="140.00"
                                  onChange={(event) =>
                                    updateServiceLine(group.id, dateGroup.id, line.id, "amount", event.target.value)
                                  }
                                />
                              </label> : null}
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => removeServiceLine(group.id, dateGroup.id, line.id)}
                                title="Remove description"
                              >
                                <Trash2 aria-hidden="true" />
                              </button>
                            </div>
                            );
                          })}
                        </div>

                        <div className="service-add-actions">
                          <button type="button" className="secondary-button compact-button" onClick={() => addServiceLine(group.id, dateGroup.id, "charge")}>
                            <Plus aria-hidden="true" /> Add charge
                          </button>
                          <button type="button" className="secondary-button compact-button" onClick={() => addServiceLine(group.id, dateGroup.id, "note")}>
                            <Plus aria-hidden="true" /> Add note
                          </button>
                          <button type="button" className="secondary-button compact-button" onClick={() => addServiceLine(group.id, dateGroup.id, "spacer")}>
                            <Plus aria-hidden="true" /> Blank line
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => addServiceDate(group.id)}
                    title="Add date under this service heading"
                  >
                    <Plus aria-hidden="true" />
                    Add date
                  </button>
                </article>
              ))}
            </div>
            <div className="line-footer">
              <button type="button" className="secondary-button" onClick={addServiceGroup} title="Add service section">
                <Plus aria-hidden="true" />
                Add service section
              </button>
              <strong>
                Subtotal: {invoice.currency || "RM"}{" "}
                {formatAmount(total)}
              </strong>
            </div>
            <div className="total-editor">
              <label className="field total-input">
                <span>Total value</span>
                <input
                  value={invoice.totalOverride ?? ""}
                  inputMode="decimal"
                  placeholder={formatAmount(subtotal)}
                  onChange={(event) => updateInvoice("totalOverride", event.target.value)}
                />
              </label>
              <strong>
                Final total: {invoice.currency || "RM"} {formatAmount(total)}
              </strong>
            </div>
          </Section>

          <Section title="Payment Notes">
            <div className="grid two">
              <Field
                label="Notes heading"
                value={invoice.notesTitle ?? ""}
                placeholder={DEFAULT_NOTES_TITLE}
                onChange={(value) => updateInvoice("notesTitle", value)}
              />
              <Field
                label="Footer line"
                value={invoice.footerText ?? ""}
                placeholder={DEFAULT_FOOTER_TEXT}
                onChange={(value) => updateInvoice("footerText", value)}
              />
            </div>
            <label className="field notes-field">
              <span>Payment note body</span>
              <textarea
                value={invoice.paymentNotes ?? ""}
                placeholder={DEFAULT_PAYMENT_NOTES}
                onChange={(event) => updateInvoice("paymentNotes", event.target.value)}
              />
            </label>
          </Section>

          {error ? <p className="error-message">{error}</p> : null}
          {!error && missingFields.length ? (
            <p className="hint">Required before generating: {missingFields.join(", ")}.</p>
          ) : null}

          <div className="generate-bar">
            <button type="button" className="primary-button" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
              Generate PDF
            </button>
            {previewUrl ? (
              <button type="button" className="download-button" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                {isDownloading ? "Saving..." : "Download"}
              </button>
            ) : null}
            {saveStatus ? <span className="workflow-save-status">{saveStatus}</span> : null}
          </div>
        </form>

        <aside className="preview-panel">
          <div className="preview-header">
            <div>
              <p>Output preview</p>
              <h2>{filename || "No PDF generated yet"}</h2>
            </div>
          </div>
          <div className="pdf-frame">
            {previewUrl ? (
              <iframe title="Generated invoice preview" src={previewUrl} />
            ) : (
              <div className="empty-state">
                <FileText aria-hidden="true" />
                <span>Fill in the invoice fields and generate the PDF.</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
