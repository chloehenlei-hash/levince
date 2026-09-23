import React from "react";
import ReactDOM from "react-dom/client";
import InvoiceGenerator from "./InvoiceGenerator.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InvoiceGenerator />
  </React.StrictMode>,
);
