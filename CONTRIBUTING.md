# Contributing

Thanks for helping. The one rule that decides most questions: **keep it simple.** This app exists because other finance apps got cluttered. A feature that makes a screen more complicated is probably the wrong feature.

## Setup

```
npm install
npm run dev     # http://localhost:5173
npm run seed    # optional demo data, empty database only
```

Before opening a pull request, run all three and make sure they pass:

```
npm run check
npm test
npm run build
```

## Guidelines

- **Money is integer cents.** Never floats. Expenses are negative, income positive.
- **Validate on the server.** The browser is for convenience; the server decides.
- **All SQL lives in `src/lib/server/db.ts`** and uses bound parameters. Schema changes go in a new numbered file in `migrations/`; never edit one that has shipped.
- Put logic that needs tests (money, dates, budgets, renewals, CSV, the cross-site guard) in pure functions under `src/lib/` and test it in `tests/`. Server modules open the real database on import, so they aren't unit tested.
- Small files and no clever abstractions. Add a dependency only with a clear reason, and say why in the pull request.
- Don't weaken the security headers, the cross-site guard or the input limits without discussing it first.

## Privacy

Never put real financial data in an issue, pull request, test or screenshot. That includes bank statements, CSV exports and `data/budgeting.db`. Use the demo data from `npm run seed`, or make something up.

## Security problems

Don't file them as public issues. See [SECURITY.md](SECURITY.md).
