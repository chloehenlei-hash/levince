# Setup

## 1. Google Sheet Backend

This project uses a Google Sheet as the database. The required tabs are:

- `Invoices`
- `Invoice Items`
- `Payments`
- `SQL Export`
- `Settings`
- `Logs`

The `SQL Export` tab is where paid invoices are prepared in the SQL Account import template column order.

Backend sheet:

[Levince Invoice Workflow Database](https://docs.google.com/spreadsheets/d/1gMMS_y1z_2wIMUa5fiZwyCA2l0p3KJB64LXx_CBUE78/edit)

## 2. Apps Script Backend

This is a one-time hidden connection. After it is added to the code, the live website connects by itself.

1. Open the Google Sheet database.
2. Go to `Extensions` -> `Apps Script`.
3. Paste the contents of `apps-script/Code.gs`.
4. Click `Deploy` -> `New deployment`.
5. Select type `Web app`.
6. Execute as: `Me`.
7. Who has access: use the access option that works for the hosted website.
8. Copy the Web App URL ending with `/exec`.
9. Paste that URL into `BACKEND_URL` inside `src/workflowApi.js`.
10. Push the code. The website will then connect automatically.

## 3. GitHub Pages

If this repository is pushed to GitHub:

1. Open the GitHub repository settings.
2. Go to `Pages`.
3. Set source to `GitHub Actions`.
4. Push to the `main` branch.
5. Open the Pages URL after GitHub finishes deploying.

## 4. Daily SQL Routine

1. Chloe creates invoice and sends PDF to customer.
2. Desmond marks invoice as `Paid` after receiving payment.
3. Chloe opens `SQL Queue`.
4. Chloe clicks `Refresh SQL Export`.
5. Chloe copies rows from the website or from the Google Sheet `SQL Export` tab into the SQL Account import template.
6. After SQL import succeeds, Chloe marks those invoices as `Uploaded to SQL`.

## Notes

- The customer-facing PDF is a payment request/proforma style invoice.
- SQL Account should still be treated as the official accounting invoice source.
- Do not delete uploaded invoices. Keep them in history for audit and checking.
