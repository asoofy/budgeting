// The only file that talks to SQLite. Also imported by scripts/seed.ts, so no SvelteKit-only imports here.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type {
	Account,
	AccountWithBalance,
	Category,
	CategoryWithUsage,
	Subscription,
	SubscriptionInput,
	SubscriptionRow,
	Transaction,
	TransactionInput,
	TransactionRow
} from '#lib/types.ts';

// BUDGETING_DB lets tests and CI point at a throwaway file; by default it's the one file to back up.
export const DB_FILE = path.resolve(process.env.BUDGETING_DB ?? 'data/budgeting.db');
const MIGRATIONS_DIR = path.resolve('migrations');

function open(): Database.Database {
	// Financial data: owner-only on systems with Unix permissions (Windows ignores the modes).
	fs.mkdirSync(path.dirname(DB_FILE), { recursive: true, mode: 0o700 });
	const conn = new Database(DB_FILE);
	try {
		fs.chmodSync(DB_FILE, 0o600);
	} catch {
		// Some filesystems (FAT, network drives) have no permissions; nothing to do.
	}
	// Default rollback journal (not WAL) so data/budgeting.db is always the one file to back up.
	conn.pragma('foreign_keys = ON');
	migrate(conn);
	return conn;
}

/** Runs migrations/NNN_*.sql files newer than PRAGMA user_version, each in its own transaction. */
function migrate(conn: Database.Database) {
	const current = conn.pragma('user_version', { simple: true }) as number;
	const files = fs
		.readdirSync(MIGRATIONS_DIR)
		.filter((f) => /^\d+_.+\.sql$/.test(f))
		.map((f) => ({ file: f, version: parseInt(f, 10) }))
		.sort((a, b) => a.version - b.version);

	for (const { file, version } of files) {
		if (version <= current) continue;
		const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
		conn.transaction(() => {
			conn.exec(sql);
			conn.pragma(`user_version = ${version}`);
		})();
	}
}

// Reuse one connection across Vite hot reloads in dev instead of opening a new one per reload.
const g = globalThis as typeof globalThis & { __budgetingDb?: Database.Database };
export const db = (g.__budgetingDb ??= open());

// --- Accounts ---

export function listAccounts(): Account[] {
	return db.prepare('SELECT * FROM accounts ORDER BY id').all() as Account[];
}

export function getAccount(id: number): Account | undefined {
	return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined;
}

/** Balance = starting balance + every transaction (expenses are negative, so they subtract). */
export function listAccountsWithBalance(): AccountWithBalance[] {
	return db
		.prepare(
			`SELECT a.*,
				a.starting_balance + COALESCE((SELECT SUM(amount_cents) FROM transactions WHERE account_id = a.id), 0) AS balance,
				(SELECT COUNT(*) FROM transactions WHERE account_id = a.id) AS tx_count,
				(SELECT COUNT(*) FROM subscriptions WHERE account_id = a.id) AS sub_count
			FROM accounts a ORDER BY a.id`
		)
		.all() as AccountWithBalance[];
}

export function findAccountByName(name: string): Account | undefined {
	return db.prepare('SELECT * FROM accounts WHERE name = ? COLLATE NOCASE').get(name) as
		| Account
		| undefined;
}

export function insertAccount(a: Omit<Account, 'id'>): number {
	const result = db
		.prepare('INSERT INTO accounts (name, currency, starting_balance, rate_to_default) VALUES (?, ?, ?, ?)')
		.run(a.name, a.currency, a.starting_balance, a.rate_to_default);
	return Number(result.lastInsertRowid);
}

export function updateAccount(id: number, a: Omit<Account, 'id'>) {
	db.prepare('UPDATE accounts SET name = ?, currency = ?, starting_balance = ?, rate_to_default = ? WHERE id = ?').run(
		a.name,
		a.currency,
		a.starting_balance,
		a.rate_to_default,
		id
	);
}

export function deleteAccount(id: number) {
	db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}

// --- Categories ---

export function listCategories(): Category[] {
	return db.prepare('SELECT * FROM categories ORDER BY is_income, id').all() as Category[];
}

export function getCategory(id: number): Category | undefined {
	return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
}

/** Categories plus how many transactions/subscriptions use each, and where they'd move on delete. */
export function listCategoriesWithUsage(): CategoryWithUsage[] {
	const rows = db
		.prepare(
			`SELECT c.*,
				(SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS tx_count,
				(SELECT COUNT(*) FROM subscriptions s WHERE s.category_id = c.id) AS sub_count
			FROM categories c ORDER BY c.is_income, c.id`
		)
		.all() as Omit<CategoryWithUsage, 'fallback_name'>[];
	return rows.map((c) => ({ ...c, fallback_name: fallbackCategoryFor(c)?.name ?? null }));
}

export function findCategoryByName(name: string): Category | undefined {
	return db.prepare('SELECT * FROM categories WHERE name = ? COLLATE NOCASE').get(name) as
		| Category
		| undefined;
}

export function insertCategory(name: string, isIncome: boolean): number {
	const result = db
		.prepare('INSERT INTO categories (name, is_income) VALUES (?, ?)')
		.run(name, isIncome ? 1 : 0);
	return Number(result.lastInsertRowid);
}

export function renameCategory(id: number, name: string) {
	db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
}

/**
 * Where a deleted category's transactions go: "Other" (or "Income" for income categories)
 * if it still exists, else the oldest category of the same type. Same type keeps signs correct.
 */
export function fallbackCategoryFor(c: Category): Category | undefined {
	return db
		.prepare(
			`SELECT * FROM categories WHERE is_income = ? AND id != ?
			ORDER BY (name = ? COLLATE NOCASE) DESC, id LIMIT 1`
		)
		.get(c.is_income, c.id, c.is_income ? 'Income' : 'Other') as Category | undefined;
}

/** Moves the category's transactions and subscriptions to `moveToId`, then deletes it. */
export function deleteCategory(id: number, moveToId: number) {
	db.transaction(() => {
		db.prepare('UPDATE transactions SET category_id = ? WHERE category_id = ?').run(moveToId, id);
		db.prepare('UPDATE subscriptions SET category_id = ? WHERE category_id = ?').run(moveToId, id);
		db.prepare('DELETE FROM categories WHERE id = ?').run(id);
	})();
}

// --- Transactions ---

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

/** Transactions in a month ('YYYY-MM'), optionally filtered by note/category/account text. */
export function listTransactions(month: string, search = ''): TransactionRow[] {
	const like = `%${escapeLike(search)}%`;
	return db
		.prepare(
			`SELECT t.*, c.name AS category_name, c.is_income, a.name AS account_name, a.currency
			FROM transactions t
			JOIN categories c ON c.id = t.category_id
			JOIN accounts a ON a.id = t.account_id
			WHERE t.date LIKE ? || '-%'
				AND (? = '' OR t.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\')
			ORDER BY t.date DESC, t.id DESC`
		)
		.all(month, search, like, like, like) as TransactionRow[];
}

export function getTransaction(id: number): Transaction | undefined {
	return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined;
}

export function insertTransaction(t: TransactionInput, subscriptionId: number | null = null): number {
	const result = db
		.prepare(
			`INSERT INTO transactions (account_id, category_id, amount_cents, date, note, subscription_id)
			VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(t.account_id, t.category_id, t.amount_cents, t.date, t.note, subscriptionId);
	return Number(result.lastInsertRowid);
}

export function updateTransaction(id: number, t: TransactionInput) {
	db.prepare(
		`UPDATE transactions SET account_id = ?, category_id = ?, amount_cents = ?, date = ?, note = ?
		WHERE id = ?`
	).run(t.account_id, t.category_id, t.amount_cents, t.date, t.note, id);
}

export function deleteTransaction(id: number) {
	db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
}

/** The account used most recently, so the add form defaults to it. */
export function lastUsedAccountId(): number | undefined {
	const row = db.prepare('SELECT account_id FROM transactions ORDER BY id DESC LIMIT 1').get() as
		| { account_id: number }
		| undefined;
	return row?.account_id;
}

// --- Subscriptions ---

/** Active subscriptions first (soonest renewal on top), then paused ones. */
export function listSubscriptions(search = ''): SubscriptionRow[] {
	const like = `%${escapeLike(search)}%`;
	return db
		.prepare(
			`SELECT s.*, c.name AS category_name, a.name AS account_name, a.currency, a.rate_to_default
			FROM subscriptions s
			JOIN categories c ON c.id = s.category_id
			JOIN accounts a ON a.id = s.account_id
			WHERE ? = '' OR s.name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\'
			ORDER BY s.active DESC, s.next_renewal, s.name`
		)
		.all(search, like, like) as SubscriptionRow[];
}

export function getSubscription(id: number): Subscription | undefined {
	return db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as Subscription | undefined;
}

export function insertSubscription(s: SubscriptionInput): number {
	const result = db
		.prepare(
			`INSERT INTO subscriptions (name, amount_cents, cycle, next_renewal, category_id, account_id, active, auto_log)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(s.name, s.amount_cents, s.cycle, s.next_renewal, s.category_id, s.account_id, s.active, s.auto_log);
	return Number(result.lastInsertRowid);
}

export function updateSubscription(id: number, s: SubscriptionInput) {
	db.prepare(
		`UPDATE subscriptions SET name = ?, amount_cents = ?, cycle = ?, next_renewal = ?,
			category_id = ?, account_id = ?, active = ?, auto_log = ?
		WHERE id = ?`
	).run(s.name, s.amount_cents, s.cycle, s.next_renewal, s.category_id, s.account_id, s.active, s.auto_log, id);
}

/** Past transactions stay; they just stop pointing at the deleted subscription (ON DELETE SET NULL). */
export function deleteSubscription(id: number) {
	db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
}

export function dueSubscriptions(today: string): Subscription[] {
	return db
		.prepare('SELECT * FROM subscriptions WHERE active = 1 AND next_renewal <= ?')
		.all(today) as Subscription[];
}

export function setNextRenewal(id: number, next: string) {
	db.prepare('UPDATE subscriptions SET next_renewal = ? WHERE id = ?').run(next, id);
}

// --- Budgets ---

/**
 * Net spending per expense category in a month, in the default currency (positive = money spent).
 * Foreign-currency accounts are converted with their manual rate.
 */
export function spendingByCategory(month: string): Map<number, number> {
	const rows = db
		.prepare(
			`SELECT t.category_id, ROUND(SUM(-t.amount_cents * a.rate_to_default)) AS spent
			FROM transactions t
			JOIN accounts a ON a.id = t.account_id
			JOIN categories c ON c.id = t.category_id
			WHERE c.is_income = 0 AND t.date LIKE ? || '-%'
			GROUP BY t.category_id`
		)
		.all(month) as { category_id: number; spent: number }[];
	return new Map(rows.map((r) => [r.category_id, r.spent]));
}

/** `cents` null removes the limit. */
export function setBudget(categoryId: number, cents: number | null) {
	db.prepare('UPDATE categories SET monthly_budget = ? WHERE id = ?').run(cents, categoryId);
}

// --- Dashboard ---

/** Income and net spending for a month ('YYYY-MM') in the default currency, positive numbers. */
export function monthTotals(month: string): { income: number; spent: number } {
	const row = db
		.prepare(
			`SELECT
				ROUND(COALESCE(SUM(CASE WHEN c.is_income = 1 THEN t.amount_cents * a.rate_to_default END), 0)) AS income,
				ROUND(COALESCE(SUM(CASE WHEN c.is_income = 0 THEN -t.amount_cents * a.rate_to_default END), 0)) AS spent
			FROM transactions t
			JOIN accounts a ON a.id = t.account_id
			JOIN categories c ON c.id = t.category_id
			WHERE t.date LIKE ? || '-%'`
		)
		.get(month) as { income: number; spent: number };
	return row;
}

export function listRecentTransactions(limit: number): TransactionRow[] {
	return db
		.prepare(
			`SELECT t.*, c.name AS category_name, c.is_income, a.name AS account_name, a.currency
			FROM transactions t
			JOIN categories c ON c.id = t.category_id
			JOIN accounts a ON a.id = t.account_id
			ORDER BY t.date DESC, t.id DESC LIMIT ?`
		)
		.all(limit) as TransactionRow[];
}

/** Marks a subscription as used (date) or not used (null) for the monthly review. */
export function setLastReviewed(id: number, date: string | null) {
	db.prepare('UPDATE subscriptions SET last_reviewed = ? WHERE id = ?').run(date, id);
}

// --- CSV ---

/** Every transaction, oldest first, for export. */
export function listAllTransactions(): TransactionRow[] {
	return db
		.prepare(
			`SELECT t.*, c.name AS category_name, c.is_income, a.name AS account_name, a.currency
			FROM transactions t
			JOIN categories c ON c.id = t.category_id
			JOIN accounts a ON a.id = t.account_id
			ORDER BY t.date, t.id`
		)
		.all() as TransactionRow[];
}

/**
 * Inserts imported transactions, skipping ones already in the database (same account, date,
 * amount and note) so importing the same file twice does nothing. Duplicates are counted:
 * if the file has two identical rows and the database has one, only the second is added.
 */
export function importTransactions(
	accountId: number,
	items: TransactionInput[]
): { imported: number; skipped: number } {
	const countExisting = db.prepare(
		'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? AND date = ? AND amount_cents = ? AND note = ?'
	);
	const alreadyThere = new Map<string, number>();
	let imported = 0;
	let skipped = 0;

	db.transaction(() => {
		for (const item of items) {
			const key = `${item.date}|${item.amount_cents}|${item.note}`;
			if (!alreadyThere.has(key)) {
				const { n } = countExisting.get(accountId, item.date, item.amount_cents, item.note) as { n: number };
				alreadyThere.set(key, n);
			}
			const left = alreadyThere.get(key)!;
			if (left > 0) {
				alreadyThere.set(key, left - 1);
				skipped++;
			} else {
				insertTransaction({ ...item, account_id: accountId });
				imported++;
			}
		}
	})();
	return { imported, skipped };
}
