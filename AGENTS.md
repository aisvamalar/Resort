# Resort Application Architecture

## Development Guidelines

- **Database.** Schema is managed through Supabase migrations
- **Generated files.** Do not edit files marked as automatically generated
- **Security.** Never commit API keys or secrets to the repository
- **Environment variables.** Use `.env` file for configuration (not committed to git)

## Technical Architecture

- Build Excel exports as one owner-facing register with dynamically imported ExcelJS; keep booking sales and actual cash receipt/expense entries separate, calculate balances from all receipts before period filtering, and use cached same-sheet total formulas to prevent double-counting or hidden ledgers.
- Fetch current owner records through the authenticated dataset function inside the shared Excel download helper; display fallbacks and stale caches must never become export input.
- Validate Excel dates, per-date amounts, same-sheet totals and cell alignment against fresh owner records before serialization and again on the serialized workbook; failed checks must block the download.
- Keep theme state in the root ThemeProvider, restoring browser preferences after hydration and styling through semantic CSS tokens; this keeps navigation, dialogs and charts consistent without SSR mismatches.
- Keep feature modules under src/features/resort and pages in TanStack file routes; this preserves the fixed framework and avoids a second router.
- Read private records through authenticated server functions and owner RLS, and paginate complete dataset reads; summaries must not silently omit rows above the Data API limit.
- Create reservations and initial advance receipts through the transactional save_reservation RPC; never duplicate money receipts when editing bookings.
- Keep pure accounting functions separate from display components and test financial invariants.
- Use owner_id ownership, not an editable profile role, for private resort authorization; each account operates its own resort.
- Store uploaded logos in an owner-scoped private bucket and resolve short-lived signed URLs on reads; workspace policy disallows public buckets.
- Share OwnerAnalytics between dashboard and reports and use explicit zero-data chart states; empty accounts must not appear to have broken graphs.
- Allow room creation inside the reservation form and keep room choices locally updated; first bookings must not require leaving the form.
- Render the booking calendar from existing reservations and room links, opening the shared reservation editor; this avoids a separate booking or accounting workflow.
- Reuse MonthCalendar for the full booking page and compact dashboard month/week/day views; both must show the same saved bookings and use the existing editor.
- Derive advisory room overlaps in a pure helper using half-open stay dates, ignoring cancelled/checked-out bookings and the edited record; warn in the shared editor and confirm intentional overrides without changing saving rules.
- Keep expense notes separate from accounted expenses and convert them through the owner-scoped, row-locking convert_expense_note RPC; repeat conversion returns the existing expense to prevent duplicate costs.
- Dedicated booking and expense entry routes reuse the shared editors; existing register URLs remain valid while five primary navigation groups expose all owner screens.
