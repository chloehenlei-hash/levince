# Worklog

## Direct SQL Sales Invoice Insert Payload Fix - 2026-07-23

- Fixed the SQL Direct and Vincenology Sales Invoice create payload after SQL Account returned `MainDataSet: Dataset not in edit or insert mode`.
- Sales Invoice POST requests now pass through `sqlInsertDocPayload_`, which removes empty master `docno/dockey` values before insert.
- Sales Invoice detail rows now use `dtlkey = -1` and `dockey = -1` for insert mode, matching SQL Account API guidance that insert detail rows should omit `dtlkey` or use `-1`.
- Applied the same Sales Invoice insert wrapper to direct create, scheduled SQL upload, and OR retry invoice creation paths.
- Follow-up hardening: direct Sales Invoice creation now tries clean insert detail rows first by omitting detail `dockey/dtlkey`, then falls back to `dtlkey = -1`, then a master `dockey = -1` variant if SQL Account still rejects the insert.
- Each retry checks the same `docref1` before and after POST so a successful-but-erroring SQL response does not create duplicate invoices.
- Apps Script paste fix: renamed repeated local `api` constants to distinct names because the Apps Script editor reported `Identifier 'api' has already been declared`.
- Ran Apps Script syntax checks for `apps-script/Code.gs`, `apps-script/SqlApi.gs`, and `apps-script/Scheduler.gs`.

## Direct SQL Auto Customer Lookup - 2026-07-23

- Direct SQL quick paste now automatically searches the relevant SQL customer database after organising pasted details.
- If the lookup finds an exact customer name match or only one result, the page fills the SQL Customer Code and customer profile fields automatically.
- If multiple possible customers are found, the page shows them for Chloe to choose before creating the SQL invoice.
- If no SQL customer is found, the page explains that `Create SQL Invoice / OR` will create the customer first, then create the invoice.
- Manual edits to `Customer / Company` clear the old SQL Customer Code; leaving the field triggers the same automatic SQL customer lookup.
- This is frontend-only; the existing Apps Script direct-create flow already resolves or creates the SQL customer before creating Sales Invoice / OR.
- Ran production build successfully. Current generated assets include `dist/assets/index-COlMBIk8.js`, `dist/assets/index-BFvdgZDr.css`, and `dist/assets/pdf-C7cWuXzN.js`.
- Ran Apps Script syntax checks for `apps-script/Code.gs`, `apps-script/SqlApi.gs`, and `apps-script/Scheduler.gs`.
- Ran local Playwright smoke checks against `http://localhost:5173/`; paste filled Vincenology direct SQL fields and started customer lookup with no desktop or mobile horizontal overflow.

## Direct SQL Quick Paste - 2026-07-23

- Added a `Quick paste` panel to both direct SQL pages (`SQL Direct` and `Vincenology SDN BHD`).
- The panel supports `Normal Organise` using the same local parser as `New Invoice`.
- The panel supports `AI Organise` using the existing Apps Script `parseInvoiceWithGemini` action, then maps the organised text through the same local parser.
- Parsed direct SQL fields include customer/company, email, phone, billing address when detected, TIN/tax number when detected, invoice/payment date, description, and RM amount.
- Multi-line service details are flattened into one direct SQL description while the amount is taken from the parsed invoice total.
- Ran production build successfully. Current generated assets include `dist/assets/index-CEDryOPV.js`, `dist/assets/index-BFvdgZDr.css`, and `dist/assets/pdf-CvQQXHBS.js`.
- Ran Apps Script syntax checks for `apps-script/Code.gs`, `apps-script/SqlApi.gs`, and `apps-script/Scheduler.gs`.
- Ran local Playwright smoke checks against `http://localhost:5173/`; sample paste filled customer, email, phone, date, description, and amount on the Vincenology page with no desktop or mobile horizontal overflow.

## Direct SQL Created Document Controls - 2026-07-23

- Added a `Created SQL documents` panel under both `SQL Direct` and `Vincenology SDN BHD`.
- Successful direct SQL invoice/payment actions now add a row immediately with reference, customer, SQL invoice no, OR no, amount, and created time.
- The created-document list is saved in browser local storage so Chloe can still see recent direct entries after refreshing the page.
- Added frontend actions to refresh one direct SQL invoice from SQL, download its SQL invoice PDF, and delete it from SQL.
- Added Apps Script actions `sqlDirectListDocuments`, `sqlDirectGetInvoicePdf`, and `sqlDirectDeleteInvoice`.
- Delete attempts to remove the linked Customer Payment / OR first when an OR key/no is available, then deletes the Sales Invoice.
- PDF download uses Apps Script as the secure bridge so SQL API credentials stay in Script Properties; Apps Script returns the PDF as base64 for the browser download.
- Important live status: Chloe still needs to redeploy the existing Apps Script Web App after copying the latest `Code.gs` and `SqlApi.gs`; otherwise the live site will keep showing `Unknown action`.
- Ran production build successfully. Current generated assets include `dist/assets/index-DxhO1pqr.js`, `dist/assets/index-BjtzwDs3.css`, and `dist/assets/pdf-mF6yITrE.js`.
- Ran Apps Script syntax checks for `apps-script/Code.gs`, `apps-script/SqlApi.gs`, and `apps-script/Scheduler.gs`; the paste-safe GitHub version has `Code.gs` at 116 lines and `SqlApi.gs` at 147 lines.
- Ran local Playwright smoke checks against `http://localhost:5173/`; the Vincenology page shows the created-document list and PDF/Delete controls with no desktop or mobile horizontal overflow.

## Direct SQL Invoice Pages - 2026-07-23

- Added a new website navigation page `SQL Direct` for the first LeVince SQL API account.
- Replaced the placeholder `Vincenology SDN BHD` page with the same direct SQL workbench using the `VINCENOLOGY_` Apps Script credential prefix.
- The direct workbench supports customer/profile fields, one Sales Invoice line, invoice reference/date, payment date/ref, `Create SQL Invoice`, and `Create Customer Payment / OR`.
- Added `Search SQL customer` to both direct pages. Chloe can search SQL customer/company records by name, code, or phone, then click a result to fill customer code, company name, phone, email, billing address, TIN, ID type, and ID no.
- Added Apps Script action `sqlSearchCustomers`; it searches the relevant SQL account using the default LeVince credentials or `VINCENOLOGY_` credentials, then returns up to 10 deduplicated customer results.
- Added Apps Script actions `sqlDirectCreateInvoice` and `sqlDirectCreatePayment`; SQL API keys remain in Script Properties and are never exposed in the GitHub Pages frontend.
- Updated SQL API helpers so direct actions can use either the default LeVince credentials or the separate Vincenology credentials without changing the scheduled LeVince SQL upload flow.
- Direct customer creation now auto-generates a short SQL customer code when Chloe leaves the optional customer-code field blank, then displays the actual SQL customer code returned by the API.
- Ran production build successfully. Current generated assets include `dist/assets/index-ePEx4TCX.js`, `dist/assets/index-BNpNVX8b.css`, and `dist/assets/pdf-UA4vDWJ_.js`.
- Ran Apps Script syntax checks for `apps-script/Code.gs`, `apps-script/SqlApi.gs`, and `apps-script/Scheduler.gs`.
- Ran local Playwright smoke checks against `http://localhost:5173/` for `SQL Direct` and `Vincenology SDN BHD`; both pages show invoice, OR, and SQL customer search controls. Mobile check reported no horizontal overflow.

## July SQL Upload Single Sheet - 2026-07-23

- Simplified the standalone Google Sheet `July 2026 MBB Bank Reconciliation - Final` into one tab only: `SQL Upload List`.
- Removed the previous multi-tab layout after flattening values: `Summary`, `Bank Statement`, `Matched Ready`, `Possible Matches`, `Need Desmond Claim`, and `Known Invoice Reference`.
- `SQL Upload List` now has 77 bank receipt rows with paid status, claim status, invoice no, customer/company, contact person, phone, email, currency, details/order, unit, amount, paid amount RM, payment reference, notes, and Desmond follow-up fields.
- Known invoice rows were enriched with available customer/contact/order data; unresolved rows use the bank payer/reference as temporary customer/details and remain marked `Possible` or `Need Desmond`.
- Final Google Sheet URL: `https://docs.google.com/spreadsheets/d/1BhNpIGue8flmVE5_czMloLY2NBhrcIP-WChmZVxAsqk/edit`.

## July Bank Statement Standalone Google Sheet - 2026-07-23

- Pivoted away from auto-creating backlog invoices in the live invoice workflow for July.
- Created a standalone reconciliation workbook from `VS MBB Rcd 26-07a.pdf` so Chloe can manually open official SQL invoices for July.
- Built and imported `July 2026 MBB Bank Reconciliation - Final` as a native Google Sheet.
- Tabs included: `Summary`, `Bank Statement`, `Matched Ready`, `Possible Matches`, `Need Desmond Claim`, and `Known Invoice Reference`.
- Final summary: 77 visible bank receipt rows, RM 100,148.66 total; 4 matched/ready rows totaling RM 2,210.00; 10 possible matches totaling RM 10,480.00; 63 rows needing Desmond claim totaling RM 87,458.66.
- Dates were stored as text in `dd/mm/yyyy` format to avoid Google Sheets timezone shifting imported dates.
- Final Google Sheet URL: `https://docs.google.com/spreadsheets/d/1BhNpIGue8flmVE5_czMloLY2NBhrcIP-WChmZVxAsqk/edit`.
- Local workbook artifact: `outputs/july-reconciliation/July 2026 MBB Bank Reconciliation.xlsx`.

## MBB July Bank Statement Reconciliation - 2026-07-23

- Extracted the attached July MBB receipt PDF and converted visible receipt rows into structured date/payee/amount entries.
- Added one-time Apps Script helper `reconcileMbbJuly2026()` to `apps-script/Code.gs`.
- The helper matches bank rows against invoice records by invoice number when available, otherwise by customer/payee name plus exact amount.
- Safe matches are marked `Paid`, `Paid At` is updated to the bank statement date, and a `Payments` row is appended only if that invoice has no existing payment record.
- Updated matching rule for the fastest month-end cleanup: if customer/name matching fails but the bank amount matches exactly one non-cancelled, non-uploaded invoice, that invoice is marked paid by `unique amount`.
- The helper now writes a `Bank Reconciliation Review` sheet with `Updated` and `Review` rows, so Chloe can see what was changed and what still needs manual checking without digging through execution logs.
- Upgraded the reconciliation helper into a month-end cleanup tool: if a bank receipt has no matching invoice, it creates a paid `General Public` backlog invoice using the bank date and bank amount, with `TIN = EI00000000010`, `Billing Address = NA`, and one money row.
- Existing paid invoices/payment records are also updated to the bank statement date and bank amount, so Desmond's earlier paid marks can be corrected from the bank statement.
- Newly created backlog invoices stay `Paid / Not Uploaded`, not `Ready for SQL`, so Chloe still confirms the SQL upload before anything is sent to SQL Account.
- The review sheet now has `Updated`, `Created Backlog`, and `Review` sections.
- Unmatched or ambiguous receipt rows are returned in a `review` list instead of being guessed.
- Syntax check passed for the updated `Code.gs`; file is currently 133 lines.
- This has not been applied to the live Google Sheet yet because the live sheet is accessed through the bound Apps Script, not the old visible Sheet ID. Chloe needs to paste/deploy the updated `Code.gs` and run `reconcileMbbJuly2026()` once in Apps Script.

## Foreign Currency Paid RM Flow - 2026-07-23

- Added a paid-date input before marking invoices paid, so Desmond can choose the actual bank-in/payment date.
- Added `Received RM` input for foreign-currency invoices before marking paid; foreign invoices cannot be marked paid without the actual RM amount.
- Added Google Sheet invoice columns `Paid Amount RM` and `Payment Currency`, plus payment history `Payment Currency`, appended to avoid shifting old data.
- Updated SQL Upload so RM invoices and foreign invoices with `Paid Amount RM` are selectable; foreign invoices without received RM stay pending.
- Updated SQL API upload so foreign invoices upload to SQL as RM using `Paid Amount RM`, with one RM detail row and matching Customer Payment / OR amount.
- `Not Paid` now clears paid date, paid RM amount, payment currency, payment reference, and proof URL.
- Production build passed and Apps Script syntax checks passed. Current generated assets include `dist/assets/index-ChOs87dq.js`, `dist/assets/index-DfbJS4bg.css`, and `dist/assets/pdf-ite5TXO2.js`.
- One-time backlog bank-statement reconciliation is still pending until Chloe provides the bank statement file.

## SQL Customer Name Resolution - 2026-07-23

- Fixed SQL API upload customer handling after live upload failed with `Customer ... not found`.
- The SQL upload flow now resolves customer by SQL code first, then tries name-based SQL customer lookups before creating a new customer profile.
- SQL API `400 ... not found` responses are now treated as not-found during lookup, instead of stopping the upload immediately.
- When an existing or newly created SQL customer is resolved, the actual SQL customer code is written back to both the customer archive and the invoice row.
- The same customer resolution now runs for both scheduled invoice upload and `Retry OR`.
- Compressed `apps-script/Code.gs` to 114 lines and `apps-script/SqlApi.gs` to 97 lines so Chloe can paste both into Apps Script while keeping the 200-line limit.
- Apps Script syntax check passed for `Code.gs`, `SqlApi.gs`, and `Scheduler.gs`.

## Vincenology API Setup Start - 2026-07-23

- Added a separate Apps Script API connection check for the `Vincenology SDN BHD` SQL account.
- The second account uses its own Script Properties with `VINCENOLOGY_` prefixes, so it will not reuse or overwrite LeVince's SQL API keys.
- Added a `Test Vincenology API` button on the `Vincenology SDN BHD` page.
- Ran Apps Script syntax checks for `Code.gs`, `SqlApi.gs`, and `Scheduler.gs`.
- Ran production build successfully; current generated assets include `dist/assets/index-D23YHiNv.js` and `dist/assets/pdf-BGnqX8DU.js`.

## Second SQL Account Rename - 2026-07-23

- Renamed the second SQL account page/navigation label from `Financial Jasonurian Berhad` to `Vincenology SDN BHD`.

## SQL OR Retry Flow - 2026-07-23

- Added a dedicated `retrySqlPayment` Apps Script action for retrying Customer Payment / OR creation on one invoice.
- Changed scheduled SQL sync to save the SQL Sales Invoice DocNo/DocKey immediately after invoice creation/fetch, before attempting OR creation.
- If OR creation fails, the invoice stays visible in SQL Upload with `SQL API Error`; Chloe can retry OR without reconfirming the invoice.
- Added a `Retry OR` button to the SQL Upload table for RM invoices that have an SQL API error and no OR number yet.
- Ran Apps Script syntax checks for `Code.gs`, `SqlApi.gs`, and `Scheduler.gs`.
- Ran production build successfully; current generated assets include `dist/assets/index-BR34zF2J.js` and `dist/assets/pdf-h160keQ-.js`.

## Financial Jasonurian Entry + Download Save Guard - 2026-07-23

- Added a new website navigation entry and page shell named `Financial Jasonurian Berhad` for the second SQL account workflow.
- Kept the second-account page separate from LeVince's existing Invoices and SQL Upload queues to avoid mixing records before separate API credentials/tabs are wired.
- Changed `src/InvoiceGenerator.jsx` download flow so an `INVOICE` must save to the workflow successfully before the PDF download/share starts.
- If saving fails, the PDF download is stopped and a visible error is shown; `QUOTATION` continues to download without saving.
- Ran production build successfully; current generated assets include `dist/assets/index-CGiNULc7.js`, `dist/assets/index-BxvzvEq2.css`, and `dist/assets/pdf-4Q7curbx.js`.

## SQL Upload RM-Only Confirmation Rule - 2026-07-23

- Simplified SQL Upload warnings so missing customer phone and negative invoice rows no longer block or distract Chloe.
- `Confirm Upload` now only confirms paid invoices with RM/MYR currency. Non-RM paid invoices stay out of the scheduled SQL API upload for now.
- Added the same RM/MYR guard in `apps-script/Code.gs` `confirmSqlUpload`, so live backend will skip foreign-currency invoices even if they are accidentally passed from the website.
- Ran Apps Script syntax checks for `Code.gs`, `SqlApi.gs`, and `Scheduler.gs`.
- Ran production build successfully; current generated assets include `dist/assets/index-DY2TjKIC.js` and `dist/assets/pdf-DD-NTFMn.js`.
- Added per-invoice SQL upload selection on the SQL Upload page. RM/MYR paid invoices are selectable, unselected rows stay pending, already-confirmed rows show `Waiting`, and non-RM rows show `Hold`.
- Added `Select All RM` and `Leave All Pending` controls so Chloe can decide exactly which invoices to confirm for scheduled API upload.

## Payment Slip Upload + SQL Payment Check - 2026-07-17

- Added payment slip attachment to the Invoices page. Desmond can choose a PDF/image slip next to an unpaid invoice before clicking `Mark Paid`.
- Updated `markPaid` in Apps Script so payment slips are uploaded to a Google Drive folder named `LeVince Payment Slips`; Google Sheet stores only the Drive URL in `Payment Proof URL`.
- Kept payment slip upload optional for now so a missing slip does not block marking paid.
- Connected SQL API Customer Payment creation after Sales Invoice creation. `sqlSyncPaidInvoices` now creates/fetches the SQL Sales Invoice, then creates/fetches `/customerpayment` with `sdsknockoff` against that invoice before marking the invoice uploaded.
- Added Google Sheet result columns `SQL Payment Doc No` and `SQL Payment Doc Key`, appended after existing SQL columns to avoid shifting old sheet data.
- Added default Settings rows for SQL Customer Payment method, journal, bank account dockey, and bank charge account.
- Updated SQL Upload UI copy/status so it shows that the API creates Customer, Sales Invoice, and Customer Payment / OR, and the last-run status can display the OR number.
- Verified Apps Script syntax for `Code.gs`, `SqlApi.gs`, and `Scheduler.gs`.
- Ran production build successfully; current build assets include `dist/assets/index-DWdv1lyF.js`, `dist/assets/index-BeH2PIkz.css`, and `dist/assets/pdf-A2kGVCzg.js`.
- Confirmed from SQL Account's Postman collection that Customer Payment is supported at `/customerpayment`; the create sample uses `sdsknockoff` rows to knock off the Sales Invoice and generate the OR/customer payment record.

## SQL Upload Page Simplified - 2026-07-15

- Replaced the old SQL Queue two-step Customer Import / Invoice Import UI with one simpler `SQL Upload` page.
- Removed the visible `Copy Customer Rows` and `Copy Invoice Rows` fallback controls from the main website flow because SQL API upload now creates customers before invoices.
- Added a compact SQL command panel showing invoices needing confirmation, invoices waiting for scheduled API upload, and the next API window.
- Kept the safe gate: Chloe still has to press `Confirm Upload` before paid invoices become `Ready for SQL`.
- Added `Clear Completed View`, which clears only the last SQL sync status display; uploaded invoice history stays in Google Sheet.
- Added Apps Script action `clearSqlSyncStatus` for that non-destructive clear action.
- Production build passed and Apps Script syntax checks passed.

## Services UX and Explicit Paste Modes - 2026-07-15

- Split Quick Paste into two explicit actions: `Normal Organise` uses only the local parser; `AI Organise` calls Gemini only when Chloe chooses it. Pasting text no longer automatically organises or calls AI.
- Made service date optional in both the editor and PDF validation.
- Added explicit service row types: charge, note, and blank line. Notes hide Qty/Amount; blank lines render as dedicated spacer controls.
- Updated the local parser so separate non-empty source lines remain separate invoice rows instead of being merged with the preceding description.
- Moved Description width into `More options` and tightened mobile service controls, including top-right delete buttons and stacked charge fields.
- Verified a no-date paste with a charge, blank line, and two separate notes; validation passed and all rows stayed separate.
- Production build passed. Current assets include `dist/assets/index-B4cTp8Zt.js` and `dist/assets/index-YyVEOx4W.css`.

## SQL Scheduled Upload Confirmation - 2026-07-15

- Added a safer SQL upload gate: paid invoices now need Chloe to press `Confirm Scheduled Upload` before the API scheduler is allowed to upload them.
- Added backend action `confirmSqlUpload`, which changes selected paid invoices from `Not Uploaded` to `Ready for SQL` and clears old SQL API errors.
- Changed `sqlSyncPaidInvoices` so scheduled API runs only process invoices with `SQL Status = Ready for SQL`; ordinary paid invoices remain visible but are not auto-uploaded.
- Scheduler now stores the last SQL API run result in Script Properties as `SQL_SYNC_LAST_RESULT`, including run time, uploaded invoices, and failures.
- SQL Queue now shows a last-run card, invoice SQL status, and SQL API error messages so Chloe can tell whether the scheduled upload happened.
- Removed `dist/` from `.gitignore` because GitHub Pages currently publishes the committed `dist` output and new build assets must be visible to `git add`.
- Production build passed and Apps Script syntax checks passed. Current build assets include `dist/assets/index-gwch3tOz.js`, `dist/assets/index-Cr7aF_zZ.css`, and `dist/assets/pdf-D7tHI2u8.js`.
- Committed and pushed to GitHub main as `aa7657d` (`Add scheduled SQL upload confirmation`).

## Gemini Smart Paste Connected - 2026-07-15

- Added `Gemini.gs` to the live Google Apps Script project.
- Stored the Gemini API key in Script Properties as `GEMINI_API_KEY`; the key is not exposed in GitHub Pages.
- Added `parseInvoiceWithGemini` to the live `Code.gs` action map and updated the existing Web App deployment.
- Verified `gemini-3.5-flash` from the Apps Script editor and the live website.
- Live test correctly extracted company, customer, email, international phone, invoice date, service date, description, quantity, currency, and amount.
- Tightened the prompt so service dates such as `20 July` are emitted separately from the chargeable description row.
- Test data was not downloaded or saved as an invoice.

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
- Current UI polish completed: the website now uses a softer warm/mint visual style and tactile pressed-button feedback without changing invoice, payment, SQL, or Google Sheet workflow logic.
- SQL Account API integration direction confirmed: the existing website + Google Sheet + Apps Script backend will be treated as LeVince's lightweight internal ERP. The Apps Script Web App is LeVince's own endpoint/middleware; it will securely call SQL Account's REST API after SQL API Service access is provided.
- Downloaded and inspected SQL Account's official Postman collection dated 2026-05-28. It confirms `https://api.sql.my`, AWSv4 defaults `ap-southeast-5` / `sqlaccount`, `POST /customer`, and `POST /salesinvoice` payload structures.
- Added `apps-script/SqlApi.gs` as a separate 149-line connector. It reads API credentials from Script Properties, signs AWSv4 requests, checks/creates customers, creates paid MYR Sales Invoices, skips non-money rows, prevents duplicates through `docref1`, and writes SQL DocNo/DocKey/errors back to the invoice sheet.
- Direct SQL upload is intentionally not exposed in the public website yet. The controlled first test must be run from the Apps Script editor after API Service and keys are ready.
- SQL API `/version` reached the hosted service but returned `401 Invalid signature`. The generated SQL curl confirms the hosted credential scope is `ap-southeast-5/sqlaccount` and signs only `host;x-amz-date`; `SqlApi.gs` was updated to match that signed-header set and compact Authorization formatting.
- After replacing both hosted API credentials with a matching newly generated pair, authentication succeeded. `sqlConnectionStatus` now reaches SQL Account and returns a database-license error instead: maximum 1 concurrent connection while 2 users are logged on. The remaining blocker is concurrent SQL sessions, not API signing.
- Added `apps-script/Scheduler.gs` for unattended SQL synchronization. It installs Malaysia-time triggers around 10:30/22:30 daily, with 11:00/23:00 fallback runs; repeated installation replaces old SQL sync triggers and existing uploaded-status checks prevent duplicate invoice uploads.
- Quick Paste percentage charges now use the chargeable subtotal after invoice discounts. Deposits and previous percentage adjustments are excluded from the 4% calculation base.
- Smart Paste scaffolding now calls Gemini through Apps Script, keeps the API key in Script Properties, rate-limits requests, and falls back to the local parser. Customer contact rows automatically pack Email, Phone, Address, and Tax Number into the two available PDF rows without mis-saving Address/TIN as a phone number.

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
- Do not expose SQL Account Access Key or Secret Key in the GitHub Pages frontend. Store SQL API configuration in Apps Script properties and send only paid, not-yet-uploaded invoices through the backend. Keep the current Excel copy/import path as a fallback during rollout.

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
- Ran Vite production build successfully after the CSS-only UI polish. New committed build assets are `dist/assets/index-ChE-lwu4.js`, `dist/assets/index-Dppyg_px.css`, and `dist/assets/pdf-BP0nbkRs.js`.
- Tested `RM1,000 - RM100 + 4%` in both pasted-line orders; both produce a `RM36` gateway charge. Vite production build completed successfully.
- Tested contact-row fallback for Address replacing Email, Address + Tax Number replacing both missing contact fields, and Address filling a missing Phone row. Apps Script syntax and Vite production build passed; live Gemini still requires an API key and Apps Script redeployment.
- Scraped the live GitHub Pages Invoices page after switching to July 2026 and Paid view; confirmed `Loaded 101 invoice(s)` and captured 79 Desmond-marked paid invoice rows into `tmp/live-july-paid-rows.json`.
- Regenerated July MBB reconciliation from the live Paid Queue instead of the old empty/template Google Sheet source. Output workbook: `outputs/july-reconciliation/July 2026 MBB Reconciliation - Live Paid Queue.xlsx`.
- New live-paid reconciliation result: 77 visible MBB receipt rows, 49 matched to live paid invoices, 28 need Desmond claim/review, 23 live paid RM invoices not matched to the visible MBB extract.
- Patched `apps-script/SqlApi.gs` so SQL upload resolves customer by real SQL code/name first, creates missing customers, and no longer uploads invoices using unconfirmed local `300-C000xx` customer codes.
- Patched `apps-script/SqlApi.gs` so invoices with deposits/discounts/negative rows upload to SQL as one final-total service line instead of separate negative rows.
- Ran Apps Script syntax checks for `apps-script/SqlApi.gs`, `apps-script/Code.gs`, and `apps-script/Scheduler.gs` through the bundled Node runtime.
- Rebuilt the live July bank reconciliation directly in the native Google Sheet `July 2026 MBB Bank Reconciliation - Final`, using the deployed Apps Script `listInvoices` data as the invoice source.
- Applied strict reconciliation rules: only the 40 invoices genuinely marked `Paid` in the live workflow, excluded every `General Public` record, and removed all `Possible`/amount-only matches.
- Confirmed 11 paid invoices against 12 July bank rows; one Creador invoice is backed by two receipts. Added complete customer/contact, invoice, item, quantity, amount, and payment details for SQL entry.
- Kept the result in one sheet only (`SQL Upload List`): 11 `MATCHED - Ready for SQL`, 65 unmatched bank rows for Desmond, and 29 genuine paid invoices whose bank receipt is still unidentified.

## Exact Next Steps
1. Use the single `SQL Upload List` sheet: upload only green `MATCHED - Ready for SQL` rows and let Desmond identify the two `NEED DESMOND` groups.
2. Paste the latest `apps-script/SqlApi.gs` into Apps Script before the next SQL API upload attempt so missing customers are created/resolved correctly.
3. Re-run SQL upload during the quiet SQL window after the Apps Script update.
4. Keep foreign-currency paid invoices out of direct SQL upload unless their MYR received amount and payment date are filled.
