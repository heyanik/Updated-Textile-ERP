# Final Feature Additions

## 1. Delete Buttons on All Tables

Add a trash-icon delete action column to every data table (Employees, Attendance, Inventory/Fabric, Ink Purchases, Ink Usage, Invoices, Clients, Payroll). Each row gets a confirm dialog → calls a new `delete{Entity}` Apps Script action → optimistically removes from cache.

**Backend (`Code.gs`):** add generic `deleteRow(sheetName, idColumn, id)` helper and expose:
`deleteEmployee`, `deleteAttendance`, `deleteFabric`, `deleteInkPurchase`, `deleteInkUsage`, `deleteInvoice`, `deleteClient`, `deletePayroll`.

## 2. Ink Color Tracking

- **Schema:** add `color` column to `InkPurchases` and `InkUsage` sheets (migration handled by `init` action — safe to add columns to existing sheets).
- **Add Ink form:** new "Color" dropdown — preset list (Cyan, Magenta, Yellow, Black, Light Cyan, Light Magenta, Orange, Green) + free-text "Other".
- **Usage form:** Color dropdown shows only colors that have been purchased (derived from purchases).
- **Tables:** show color column with a small colored dot.
- **Stat cards:** become per-color (Purchased / Used / Remaining ml per color) shown as a grid.
- **Chart:** bottom of page — bar chart (recharts, already a shadcn dep) comparing Purchased vs Used per color.

## 3. Login System

Stored in a new `Users` sheet (`username`, `password_hash`, `created_at`). Passwords hashed with SHA-256 in Apps Script (`Utilities.computeDigest`).

**Backend actions:** `registerUser`, `loginUser`, `listUsers` (admin-only — first user becomes admin), `deleteUser`.

**Frontend:**
- New `/login` route (public). Form: username + password. On success store `{username, token}` in `localStorage`.
- Auth guard: `_app` layout checks for token; if missing → redirect to `/login`. Setup page remains public.
- Setup page gains a **"User Accounts"** card below the Connect card — list users + add-user form + delete button. Visible once connected.
- Logout button in `AppLayout` sidebar.

Note: this is lightweight client-side auth backed by a sheet (no JWT, no RLS). Adequate for the single-shop ERP use case but not enterprise-grade. The check on each request is done client-side; data access still requires the GAS URL.

## Technical Notes

- All mutations use existing optimistic helpers in `src/lib/optimistic.ts`.
- Reuse shadcn `AlertDialog` for delete confirmations.
- Chart uses `recharts` directly via shadcn `chart.tsx` wrapper.
- After deploying, user must paste updated `Code.gs` to Apps Script and **Deploy → Manage deployments → New version**.

## Files to Touch

- `Code.gs` — add delete actions, color columns, user auth
- `src/lib/gas.ts` — new types & action signatures
- `src/routes/_app.tsx` — auth guard
- `src/routes/login.tsx` — new
- `src/routes/setup.tsx` — add user management card
- `src/routes/_app.ink.tsx` — colors + chart
- `src/routes/_app.employees.tsx`, `_app.attendance.tsx`, `_app.inventory.tsx`, `_app.invoices.tsx`, `_app.clients.tsx`, `_app.payroll.tsx` — delete buttons
- `src/components/AppLayout.tsx` — logout button
- `src/lib/auth.ts` — new (token helpers)

Approve and I'll build it.