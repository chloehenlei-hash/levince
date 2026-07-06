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

Created backend sheet:

[Levince Invoice Workflow Database](https://docs.google.com/spreadsheets/d/1gMMS_y1z_2wIMUa5fiZwyCA2l0p3KJB64LXx_CBUE78/edit)

## 2. Apps Script Backend

1. Open the Google Sheet database.
2. Go to `Extensions` -> `Apps Script`.
3. Paste the contents of `apps-script/Code.gs`.
4. In Apps Script, open `Project Settings`.
5. Add a Script Property:
   - Property: `APP_PIN`
   - Value: choose a private PIN shared only by Chloe and Desmond.
6. Click `Deploy` -> `New deployment`.
7. Select type `Web app`.
8. Execute as: `Me`.
9. Who has access: only the users you trust, or anyone with the link if Google login blocks the website.
10. Copy the Web App URL ending with `/exec`.

## 3. Website Setup

1. Run the local dev server with `npm run dev`, or host the project through GitHub Pages.
2. In the website Setup panel, paste the Apps Script Web App URL.
3. Select user: `Chloe` or `Desmond`.
4. Enter the shared PIN.
5. Click `Save Connection`, then `Load Invoices`.

## 4. GitHub Pages

If this repository is pushed to GitHub:

1. Open the GitHub repository settings.
2. Go to `Pages`.
3. Set source to `GitHub Actions`.
4. Push to the `main` branch.
5. Open the Pages URL after GitHub finishes deploying.

## 5. Daily SQL Routine

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
