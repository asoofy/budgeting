# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Report it privately with GitHub's "Report a vulnerability" button on the repository's **Security** tab, or go straight to <https://github.com/asoofy/budgeting/security/advisories/new>.

Include what you found, how to reproduce it, which commit or version you tested, and what an attacker could do with it. This is a one-person project, so replies are best effort: expect an acknowledgement within about a week. Fixes are prioritized by severity, and you will be credited if you want to be.

Only the latest commit on `main` is supported.

## What the app is, and what it trusts

Budgeting is a single-user app that runs on your own computer and has **no login by design**. It trusts the person who can reach its port and the machine it runs on.

### In scope (please report)

- A web page or another origin that can read or change data without the owner's action: CSRF, DNS rebinding, CORS mistakes, clickjacking, anything that gets around the Content-Security-Policy.
- Injection through forms, URLs or imported files: SQL, HTML/script, spreadsheet formulas in exports.
- Path traversal or arbitrary file read or write, including through the dev server's configuration.
- Crashes, data corruption or runaway behavior caused by crafted input (CSV files, dates, amounts).
- Secrets, personal data or credentials committed to the repository.
- A vulnerable dependency that affects how the app is meant to be used.

### Out of scope

- The lack of a login. Exposing the server to a network or the internet is unsupported (see the README).
- Anything that needs access to the machine, the user account or the data folder: reading `data/budgeting.db`, malware, a malicious browser extension.
- The database being unencrypted at rest. Use disk encryption.
- Denial of service against your own machine.

## How the app protects itself

- Every SQL query uses bound parameters. Svelte escapes everything it renders, and there is no `{@html}`.
- **Cross-site request guard** (`src/lib/csrf.ts`, run from `src/hooks.server.ts`): every write must be same-origin. SvelteKit has its own check, but it is switched off while the Vite dev server runs, and this app runs on the dev server.
- **Content-Security-Policy** and other headers on every response (`vite.config.ts`, `src/hooks.server.ts`): everything from this server only, no framing, no referrer, no caching, `nosniff`.
- The Vite dev server only answers requests for `localhost`, so DNS rebinding is refused, and it won't serve files outside the source folders. A warning is printed if the server is bound beyond localhost.
- All input is validated on the server: dates must be in 2000-2099 and amounts at most 100 million, which also stops a mistyped year from flooding the ledger with back-dated renewals.
- CSV exports prefix text that a spreadsheet could run as a formula; imports undo that.
- The database folder is created owner-only (`0700`) and the file `0600` where the filesystem supports it.
- No telemetry and no third-party requests.
- Dependencies are locked, install scripts are allowlisted (`allowScripts` in `package.json`), and CI runs `npm audit`; Dependabot keeps them current.

## Tips for users

- Keep Node.js and the dependencies up to date (`npm audit`, `npm update`).
- Turn on full-disk encryption and lock your screen.
- Never share screenshots, CSV exports or `data/budgeting.db` when asking for help.
