# Worklog

## Current Goal
Build a lightweight invoice workflow website for Chloe and Desmond.

## Current Task
Create a GitHub-friendly invoice workflow website that:
- Uses the original local `lv-inv` invoice generator for New Invoice and PDF generation.
- Records invoices into a Google Sheet backend.
- Lets Desmond mark invoices as paid.
- Lets Chloe prepare paid invoices for SQL Account import.
- Lets Chloe mark invoices as uploaded to SQL so they leave the active queue.

## Relevant Files
- `index.html` - Vite entry point.
- `src/InvoiceGenerator.jsx` - original local `lv-inv` generator source moved into this project.
- `src/App.jsx` - workflow wrapper for Google Sheet status and SQL queue.
- `src/workflowApi.js` - browser-side Apps Script API helper.
- `src/styles.css` - original generator styling plus workflow shell styling.
- `apps-script/Code.gs` - Google Apps Script backend for the Google Sheet.
- `docs/SETUP.md` - setup and deployment steps.
- `docs/SQL_MAPPING.md` - SQL Account template mapping.
- `tools/build-sheet-template.mjs` - local builder for the Google Sheet database template.

## Latest Status
- Project folder is new and local path is `/Users/chloe/Documents/New project/levince-invoice-workflow`.
- Project folder is a git repository on branch `main`.
- GitHub remote is `https://github.com/chloehenlei-hash/levince.git`.
- Initial version has been pushed and GitHub Pages deploy succeeded.
- Public site: `https://chloehenlei-hash.github.io/levince/`.
- Existing online invoice generator is a bundled static React/Vite site, so this project recreates the workflow in maintainable source files instead of editing the minified bundle.
- User clarified that New Invoice must use the exact local `lv-inv` generator. The project is now React/Vite and imports the original generator source from `/Users/chloe/Documents/levince- codex/lv-inv`.
- Google Sheet backend created: `https://docs.google.com/spreadsheets/d/1gMMS_y1z_2wIMUa5fiZwyCA2l0p3KJB64LXx_CBUE78/edit`.
- UX simplified again: Setup, PIN, Test Connection, user selector, and manual connection fields were removed from the website.
- Apps Script backend was compressed and no longer checks a PIN. It is currently 113 lines.
- Apps Script Web App URL has been added to `src/workflowApi.js` as the hidden `BACKEND_URL`; the website should now connect automatically.
- Apps Script now uses the bound Google Sheet through `getActiveSpreadsheet()`.
- Backend POST/listInvoices test now succeeds and returns `{ ok: true, invoices: [], items: [] }`.
- Local browser smoke test confirmed the website can load invoices from Google Sheet and no Setup/PIN UI is visible.

## Important Decisions
- Use Vite/React because the original invoice generator is React/Vite and should stay visually/functionally the same.
- Deploy to GitHub Pages through GitHub Actions, building the Vite `dist` output.
- Use Google Apps Script as the backend API so the frontend does not directly expose Google Sheet edit access.
- Keep the Google Sheet connection hidden in code instead of asking Chloe or Desmond to set it up in the website.
- Use Google Sheet as the database.
- Use Chloe's internal invoice number for the customer-facing payment request.
- Let SQL Account generate the official SQL invoice number.
- Preserve uploaded/completed invoices in history instead of deleting them.

## Commands Already Run
- Checked current folder contents.
- Confirmed current folder is not a git repository.
- Inspected the existing online generator at `https://dshrui.github.io/lv-inv/`.
- Generated `outputs/SQL Invoice Workflow Database.xlsx`.
- Imported the workbook as a native Google Sheet.
- Ran syntax check for `app.js`.
- Ran syntax check for `apps-script/Code.gs` via Node stdin.
- Ran a headless Chrome visual smoke test against `index.html`; verified total calculation and invoice preview content.
- Initialized git in `levince-invoice-workflow` and renamed the branch to `main`.
- Copied local source from `/Users/chloe/Documents/levince- codex/lv-inv`.
- Ran Vite production build successfully with the migrated React app.
- Started local Vite dev server at `http://127.0.0.1:5173/`.
- Ran headless Chrome smoke test against the migrated app; verified `Invoice Generator`, `Quick Paste`, `Generate PDF`, and `Save to Workflow`.
- Generated a test PDF preview successfully: `Levince Chauffeur 104247.pdf`.
- Checked GitHub CLI availability; `gh` is not installed, so GitHub upload should use manual repo creation plus `git remote add`.
- Verified GitHub Pages site responds with HTTP 200.
- Simplified workflow setup UI and ran Vite build successfully.
- Ran headless Chrome smoke test; confirmed New Invoice top bar has no connection inputs and Setup has friendlier labels without "Apps Script".
- Replaced `apps-script/Code.gs` with a compact 119-line version and ran a syntax check through Node stdin.
- Removed Setup, PIN, Test Connection, user selector, and all manual website connection state.
- Ran Vite production build successfully after removing manual setup.
- Ran syntax check for the compact `apps-script/Code.gs`.
- Added the deployed Apps Script Web App URL to the frontend backend helper.
- Tested Apps Script Web App URL. GET returned `{ ok: true }`; after switching to `getActiveSpreadsheet()`, POST/listInvoices returned `{ ok: true, invoices: [], items: [] }`.
- Ran Vite production build successfully with hidden backend URL.
- Ran local browser smoke test; Invoices -> Refresh showed `Loaded 0 invoice(s).`.

## Exact Next Steps
1. Push `src/workflowApi.js` with the hidden backend URL to GitHub Pages.
2. Create the first test invoice, click `Save to Workflow`, mark it paid, and refresh SQL export.
