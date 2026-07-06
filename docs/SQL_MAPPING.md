# SQL Account Import Mapping

The SQL Account import file uses the `SLPH_Invoice_Cash_Debit_Credit` template.

## Main Workflow

The website creates customer-facing payment request invoices. These are not the official SQL invoice numbers.

When an invoice is marked `Paid`, it becomes eligible for SQL export.

When Chloe clicks `Refresh SQL Export`, the Apps Script backend first checks `SQL Customers`.

If a paid invoice belongs to a customer that has not been marked uploaded to SQL, the backend writes that customer into the `Customer Export` tab using the Import Customer template column order. The invoice rows are still prepared in the `SQL Export` tab, but Chloe should import customer rows into SQL first, then import invoice rows.

After customer import succeeds in SQL, Chloe clicks `Customers Uploaded`. Those customers stay archived in `SQL Customers`, so they will not appear in future customer imports.

After Chloe copies/imports those rows into SQL Account, she marks the invoice as `Uploaded to SQL`.

## Customer Import Fields

The customer import file uses the `Import Customer` template. Each new customer is exported as two rows: `BILLING` and `DELIVERY`.

| SQL Customer Column | Source |
| --- | --- |
| `CODE(10)` | Auto-created SQL customer code, stored in `SQL Customers` |
| `CONTROLACCOUNT(10)` | `DEFAULT_CUSTOMER_CONTROL_ACCOUNT`, default `300-000` |
| `COMPANYNAME(100)` | Customer name |
| `CREDITTERM(10)` | `DEFAULT_CUSTOMER_CREDIT_TERM`, default `C.O.D.` |
| `TIN(14)` | Customer TIN, if supplied |
| `IDTYPE` | Customer ID type, otherwise `0` |
| `IDNO(20)` | Customer ID number, if supplied |
| `SUBMISSIONTYPE` | `DEFAULT_SUBMISSION_TYPE`, default `17` |
| `_BRANCHNAME(100)` | `BILLING` and `DELIVERY` |
| `_ADDRESS1(60)` to `_ADDRESS4(60)` | Billing address split by line |
| `_COUNTRY(2)` | `DEFAULT_COUNTRY`, default `MY` |
| `_PHONE1(200)` | Customer phone |
| `_EMAIL(200)` | Customer email |

## Important Fields

| SQL Column | Source |
| --- | --- |
| `DOCNO(20)` | `<<New>>` so SQL can generate its own invoice number |
| `DOCDATE` | Website invoice date |
| `CODE(10)` | SQL customer code from `SQL Customers`, otherwise the invoice/default customer code |
| `COMPANYNAME(100)` | Customer name |
| `ADDRESS1(60)` to `ADDRESS4(60)` | Billing address split by line |
| `PHONE1(200)` | Customer phone |
| `TERMS(10)` | Invoice terms |
| `DESCRIPTION(200)` | Invoice notes or `Payment request` |
| `DOCREF1` | Chloe's internal invoice number |
| `TIN(14)` | Customer TIN, if supplied |
| `IDTYPE` | Customer ID type, if supplied |
| `IDNO(20)` | Customer ID number, if supplied |
| `SUBMISSIONTYPE` | `DEFAULT_SUBMISSION_TYPE` from Settings |
| `_SEQ` | Line item sequence |
| `_ACCOUNT(10)` | Item account code, otherwise `DEFAULT_ACCOUNT_CODE` from Settings |
| `_ITEMCODE(30)` | Item code, if supplied |
| `_DESCRIPTION(200)` | Item description |
| `_QTY` | Item quantity |
| `_UOM(10)` | Item UOM, otherwise `DEFAULT_UOM` from Settings |
| `_UNITPRICE` | Item unit price |
| `_DISC(20)` | Item discount |
| `_TAX(10)` | Item tax code |
| `_TAXAMT` | Item tax amount |
| `_TAXINCLUSIVE` | `DEFAULT_TAX_INCLUSIVE` from Settings |
| `_AMOUNT` | Item amount |

## Accountant Review Needed

Ask the account team to confirm:
- Which date should be used as `DOCDATE`: invoice date or payment date.
- Default SQL customer code for walk-in/general customers.
- Default sales account code.
- Whether `SUBMISSIONTYPE` should always be `17`.
- Whether tax code and tax inclusive rules are correct for every service type.
