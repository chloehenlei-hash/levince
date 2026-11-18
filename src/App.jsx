import { useState } from "react";
import { FileText, Files } from "./icons.js";
import InvoiceGenerator from "./InvoiceGenerator.jsx";
import SqlInvoiceGenerator from "./SqlInvoiceGenerator.jsx";

export default function App() {
  const [tab, setTab] = useState("invoice");
  return <><nav className="generator-tabs" aria-label="Invoice generator pages">
    <button type="button" className="choice-button" aria-pressed={tab === "invoice"} onClick={() => setTab("invoice")}><FileText />Invoice Generator</button>
    <button type="button" className="choice-button" aria-pressed={tab === "sql"} onClick={() => setTab("sql")}><Files />SQL Invoice</button>
  </nav>{tab === "invoice" ? <InvoiceGenerator /> : <SqlInvoiceGenerator />}</>;
}
