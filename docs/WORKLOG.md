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
- Project folder is now a git repository on branch `main`; no commit has been created yet.
- No GitHub remote is configured yet.
- Existing online invoice generator is a bundled static React/Vite site, so this project recreates the workflow in maintainable source files instead of editing the minified bundle.
- User clarified that New Invoice must use the exact local `lv-inv` generator. The project is now React/Vite and imports the original generator source from `/Users/chloe/Documents/levince- codex/lv-inv`.
- Google Sheet backend created: `https://docs.google.com/spreadsheets/d/1gMMS_y1z_2wIMUa5fiZwyCA2l0p3KJB64LXx_CBUE78/edit`.

## Important Decisions
- Use Vite/React because the original invoice generator is React/Vite and should stay visually/functionally the same.
- Deploy to GitHub Pages through GitHub Actions, building the Vite `dist` output.
- Use Google Apps Script as the backend API so the frontend does not directly expose Google Sheet edit access.
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

## Exact Next Steps
1. Deploy Apps Script manually from `apps-script/Code.gs`.
2. Set Apps Script Script Property `APP_PIN`.
3. Paste the deployed Apps Script Web App URL into the website setup strip at `http://127.0.0.1:5173/`.
4. Create the first test invoice, click `Save to Workflow`, mark it paid, and refresh SQL export.
5. Create an empty GitHub repository, add it as `origin`, commit the project, and push `main`.
