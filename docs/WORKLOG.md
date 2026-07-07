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
- GitHub Pages browser test exposed Google Apps Script CORS blocking direct `fetch`, so the frontend is being switched to hidden iframe form submit with `postMessage`.
- User added SQL customer import requirement: before importing invoices, new customers must be exported/imported into SQL using the `Import Customer.xlsx` template. Previously uploaded SQL customers should be archived and skipped in future customer exports.
- `Import Customer.xlsx` was inspected. Customer template sheet is `Customer`, header row is row 5, 48 columns from `CODE(10)` through `_EMAIL(200)`. Country code reference is on `Country`.
- Backend now has `SQL Customers` archive and `Customer Export` output tabs. Customer rows are generated before invoice rows; customers can be marked uploaded to SQL.
- Invoices page was simplified: it only has a Paid check action. Once marked paid, the invoice leaves the Active list but remains recorded in Google Sheet and appears in SQL Queue.
- SQL Queue upload completion is clearer: after marking customers/invoices uploaded, the button changes to a green `All Uploaded` state.
- SQL Queue copy buttons now live inside their own sections: `Copy Customer Rows` under Customer Import and `Copy Invoice Rows` under Invoice Import.
- Duplicate invoice numbers now have an overwrite path in local code: the website asks for confirmation with old/new customer and amount, then the Apps Script backend replaces the existing invoice row and item rows instead of creating a duplicate.
- New Invoice no longer has a separate Save to Workflow button. Downloading a generated PDF now automatically saves the matching invoice data into the workflow.
- New Invoice now supports pasting a text-based PDF from the clipboard. When a pasted PDF file is detected, the site reads its text and fills the invoice form for review/editing.
- The frontend dependency manager was switched from npm lockfile to pnpm lockfile because the PDF reader dependency was added with pnpm and GitHub Pages needs to install from `pnpm-lock.yaml`.
- The PDF paste feature now has a visible `Paste PDF here` box in Quick Paste, with click-to-choose and drag/drop fallback for Safari/WhatsApp clipboard limitations.
- GitHub Pages stayed on an older asset after paste-PDF work because workflow runs #11 and #12 failed in the `Setup Node` step when using pnpm cache.
- Workflow run #13 passed setup but failed in dependency install, so the deploy flow is being changed to publish committed `dist` directly.
- Live PDF import showed `undefined is not a function` in Safari when choosing/uploading a PDF. The PDF reader was downgraded to `pdfjs-dist@3.11.174` and switched to legacy no-worker parsing for Safari compatibility.
- Local build after the Safari PDF fix succeeded and produced `dist/assets/index-DZD8X1AU.js` plus `dist/assets/pdf-Dt0fHlmb.js`.
- Live PDF import then showed `No "GlobalWorkerOptions.workerSrc" specified.`. The parser now sets the legacy PDF worker URL explicitly, and the rebuilt site includes `dist/assets/pdf.worker-CzcBcYLo.js`.
- PDF import was filling blank Qty/Amount cells as `1` and `0`. The parser now only fills Qty or Amount when the original PDF cell contains a value, recognizes date ranges like `23rd - 24th June`, and allows amount rows with blank Qty.
- Manual screenshot import completed for 18 visible document numbers from July backlog. User later clarified these documents should all remain unpaid/pending for Desmond to confirm, not marked Paid.
- `apps-script/Code.gs` now has a live `reopenInvoices` backend action. It formats phone columns as text and normalizes common foreign phone prefixes with `+` so Google Sheets does not turn `+82`, `+971`, etc. into `#ERROR!`.
- After Chloe redeployed Apps Script, `reopenInvoices` was run for `104300`, `104345`, `104382`, `104383`, `104384`, `104385`, `104386`, `104387`, `104388`, `104389`, `104394`, `104395`, `104396`, `104397`, `104398`, `104399`, `104400`, `104401`, `104402`. All 19 are now `Sent` / `Not Uploaded`.
- Phone corrections were applied for known imported numbers, including `104382` `0123159121`, `104384` `+66632064651`, and `104387` `01679345561`.
- One Sarah / Corpway screenshot is still blocked because the invoice number is cropped out of the image.
- New Invoice download auto-save now only applies to documents marked `INVOICE`. `QUOTATION` PDFs can still be downloaded, but they will not be saved into the workflow automatically.
- Invoices page now defaults to the latest 5 invoices for the selected status, with `Load more` to show the full list and an invoice-number search next to the status filter/Refresh button.
- Workflow UX polish added: Paid actions now show a short-lived `Undo Paid`; Invoices table shows `Paid At`; search supports invoice number or customer name; New Invoice warns when the current document number already exists; SQL Queue shows clearer Step 1/Step 2 readiness, copy buttons turn green after copying, and SQL warnings highlight pending customers, missing phones, foreign currency, or negative rows.
- Invoices page Pay feedback was made explicit: clicking `Mark Paid` now immediately turns the row green before Google Sheet finishes syncing, keeps that invoice briefly visible in Active, and paid rows now have a `Not Paid` button to move them back to unpaid.
- Invoices page now has a month selector, defaulting to the current month. Month filtering affects the Invoices page list and stats only; SQL Queue continues to use all paid/not-uploaded invoices.

## Important Decisions
- Use Vite/React because the original invoice generator is React/Vite and should stay visually/functionally the same.
- Deploy to GitHub Pages through GitHub Actions, building the Vite `dist` output.
- Use Google Apps Script as the backend API so the frontend does not directly expose Google Sheet edit access.
- Keep the Google Sheet connection hidden in code instead of asking Chloe or Desmond to set it up in the website.
- Use Google Sheet as the database.
- Use Chloe's internal invoice number for the customer-facing payment request.
- Let SQL Account generate the official SQL invoice number.
- Preserve uploaded/completed invoices in history instead of deleting them.
- Frontend changes must include a fresh local `dist` build because GitHub Pages now publishes the committed `dist` artifact directly.
- Quotation documents should stay outside the invoice workflow unless Chloe manually changes them into invoices.
- Desmond's Invoices page should stay compact by default: show latest 5, search invoice number for direct lookup, then mark paid from the found row.
- Avoid silent mistakes in the workflow: paid marks should be reversible briefly, copy actions should show visual confirmation, and SQL export should clearly block/flag invoice upload when customer import is still pending.

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
- Online browser smoke test reached GitHub Pages but direct fetch failed with Google CORS; changed transport approach in `src/workflowApi.js` and `apps-script/Code.gs`.
- Inspected `Import Customer.xlsx` with the spreadsheet tool and captured SQL customer import headers.
- Added customer archive/export logic to `apps-script/Code.gs`; script is 157 lines.
- Updated SQL Queue UI with Customer Import and Invoice Import sections.
- Ran Apps Script syntax check and Vite production build successfully.
- Local iframe smoke test timed out because Apps Script wraps HtmlService output in an inner iframe. Updated Apps Script response to call `window.top.postMessage(...)`.
- After redeploy, backend `refreshSqlExport` returned both customer and invoice headers successfully.
- Local browser smoke test passed: SQL Queue -> Refresh SQL Export showed `Prepared 0 customer(s), 0 invoice row(s).`
- Simplified Invoices page actions: removed SQL upload action from the invoice row, removed payment-ref prompt, made Active exclude Paid invoices, and added an Invoices Uploaded action to SQL Queue.
- Ran Vite production build successfully and browser smoke test confirmed Active hides paid invoice `104300` while Paid Queue still shows it.
- Added green `All Uploaded` state for SQL Queue customer and invoice upload buttons.
- Ran Vite production build successfully and checked SQL Queue buttons render without clicking real upload actions.
- Moved copy buttons out of the SQL Queue header into their respective Customer Import and Invoice Import sections.
- Ran Vite production build successfully and browser smoke test confirmed header only has refresh buttons while section buttons have copy/upload actions.
- Added duplicate-invoice overwrite handling in `src/App.jsx`, error metadata support in `src/workflowApi.js`, and overwrite/delete-item behavior in `apps-script/Code.gs`.
- Ran Vite production build successfully with the overwrite changes.
- Ran Apps Script syntax check through Node stdin; `apps-script/Code.gs` is 164 lines.
- Updated `src/InvoiceGenerator.jsx` so Download auto-saves to Google Sheet via the existing workflow save path and removed the standalone Save to Workflow button.
- Ran Vite production build successfully after auto-save-on-download.
- Added `pdfjs-dist` and `src/utils/pdfInvoiceParser.js` for clipboard PDF text extraction.
- Updated `src/InvoiceGenerator.jsx` to listen for pasted PDF files and apply parsed fields to the invoice form.
- Updated GitHub Pages workflow to use pnpm, added `pnpm-lock.yaml`, and removed stale `package-lock.json`.
- Ran Vite production build successfully after adding paste-PDF support.
- Added visible PDF paste/drop/choose UI in `src/InvoiceGenerator.jsx` and styling in `src/styles.css`.
- Ran Vite production build successfully after adding the visible PDF entry point.
- Removed pnpm cache from `.github/workflows/deploy.yml` to avoid the failed `Setup Node` cache step.
- Changed GitHub Pages workflow to upload committed `dist` directly instead of installing dependencies/building on GitHub.
- Downgraded the PDF reader to `pdfjs-dist@3.11.174`, disabled the PDF worker, and ran a successful Vite production build for the Safari PDF import fix.
- Added an explicit legacy PDF worker URL for PDF import and ran a successful Vite production build.
- Updated PDF import parsing so blank PDF Qty/Amount cells stay blank, then ran a successful Vite production build.
- Updated workflow saving so blank Qty values stay blank instead of being saved as 1 for future PDF imports.
- Ran Vite production build successfully after improving Pay / Not Paid feedback.
- Ran Vite production build successfully after adding the Invoices month selector.

## Exact Next Steps
1. Ask Chloe for the cropped Sarah / Corpway invoice number before importing that one.
2. Continue testing the live site workflow: Invoice download auto-saves; Quotation download does not save; Invoices page month selector/latest-5/search/load-more/customer-search behavior works; `Mark Paid` instantly turns the row green, `Not Paid` reopens it, and SQL Queue only shows paid/not uploaded documents with Step 1 blocking Step 2 when needed.
