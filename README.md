# Levince Invoice Workflow

A small internal invoice workflow for Chloe and Desmond.

## What It Does

- Chloe creates a customer-facing invoice using the original Levince invoice generator.
- The app generates and downloads the same PDF format as the original `lv-inv` project.
- The invoice is recorded in a Google Sheet backend.
- Desmond marks the invoice as `Paid` after receiving payment.
- Chloe refreshes the SQL queue and copies paid rows into the SQL Account import template.
- Chloe marks imported invoices as `Uploaded to SQL`, removing them from the active queue.

## Main Files

- `index.html` - Vite website entry point.
- `src/InvoiceGenerator.jsx` - original Levince invoice generator moved from `lv-inv`.
- `src/App.jsx` - workflow shell for Google Sheet, invoice status, and SQL queue.
- `src/styles.css` - original generator styling plus workflow shell styling.
- `apps-script/Code.gs` - Google Apps Script backend.
- `docs/SETUP.md` - deployment guide.
- `docs/SQL_MAPPING.md` - SQL Account import mapping notes.

## Google Sheet Backend

[Levince Invoice Workflow Database](https://docs.google.com/spreadsheets/d/1gMMS_y1z_2wIMUa5fiZwyCA2l0p3KJB64LXx_CBUE78/edit)

## Local Preview

Run the Vite dev server:

```bash
npm install
npm run dev
```

For the full workflow, deploy `apps-script/Code.gs` as a Google Apps Script Web App and paste the Web App URL into the website setup strip.

## GitHub Pages

This project includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

After pushing to GitHub, enable GitHub Pages with `GitHub Actions` as the source.
