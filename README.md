# Budgeting

A small, private budgeting app that runs on your own computer. Track spending, income, subscriptions and budgets on one simple screen. No accounts, no cloud, no tracking.

**Setup** (Node.js 22.17 or newer): `git clone https://github.com/asoofy/budgeting.git`, `cd budgeting`, `npm install`, then `npm run dev` and open http://localhost:5173.
Optional demo data: `npm run seed` (only runs on an empty database).

**Backup**: copy `data/budgeting.db`. That one file is everything.
**Restore**: stop the app, put the file back at `data/budgeting.db`, start the app again.
**Start over**: stop the app and delete `data/budgeting.db`. It is recreated on the next start.
Set `BUDGETING_DB` to keep the file somewhere else.

## What it does

- **Transactions**: add one in seconds (press `n`, type the amount, pick a category, press Enter).
- **Budgets**: a monthly limit per category, with green / yellow / red progress bars.
- **Subscriptions**: monthly and yearly totals, upcoming renewals, and automatic logging when one renews.
- **Dashboard**: what you earned, spent and have left this month, on one screen.
- **Spending helper**: flags categories over budget and subscriptions you didn't use, and shows what cutting them saves per year.
- **Accounts** with live balances, and a manual exchange rate for USD and EGP accounts.
- **CSV**: export everything, or import a bank statement with a column-mapping step.

Money is stored as integer cents. The default currency is SAR; USD and EGP accounts are converted with a rate you type in. There is no exchange-rate fetching.

## Security

Budgeting is a **single-user app for your own machine, and it has no login by design.** Anyone who can reach its port can read and change everything.

- Run it on `localhost` only. Do not use `--host`, do not port-forward it, do not put it on the internet.
- To reach it from a phone, use a private tunnel instead of opening it to your Wi-Fi, for example an SSH port forward or a private VPN such as Tailscale or WireGuard. If the tunnel changes the `Host` header, the dev server answers 403 until you add that name to `server.allowedHosts` in `vite.config.ts`. Only add names you control.
- The database is a plain, unencrypted SQLite file. Use your operating system's disk encryption (BitLocker, FileVault, LUKS).
- It makes no requests to anyone else: no analytics, no telemetry, no fonts or scripts from a CDN.
- Web pages you visit can't change your data through it: every write must come from the app's own origin, and a strict Content-Security-Policy is sent with every page.

Found a vulnerability? Please read [SECURITY.md](SECURITY.md) and report it privately.

## Development

```
npm run check    # type check
npm test         # unit tests (money, dates, budgets, renewals, CSV, cross-site guard)
npm run build    # compile check
```

- `src/lib/server/db.ts` holds every SQL query; schema changes go in a new `migrations/NNN_name.sql` file, which runs on startup.
- Pure logic (money, dates, budgets, renewals, CSV) lives in `src/lib/` and is unit tested without a database.
- See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE)
