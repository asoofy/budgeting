import { fail } from '@sveltejs/kit';
import * as db from '#lib/server/db.ts';
import { parseCsv } from '#lib/csv.ts';
import { mapRow, type DateFormat, type Mapping } from '#lib/importer.ts';
import { parseBalance, toDefault } from '#lib/money.ts';
import type { Category, Currency, TransactionInput } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const accounts = db.listAccountsWithBalance();
	return {
		accounts,
		// Sum of every account's balance in SAR, using each account's manual rate.
		accountsTotal: accounts.reduce((sum, a) => sum + toDefault(a.balance, a.rate_to_default), 0),
		categories: db.listCategoriesWithUsage()
	};
};

const CURRENCIES: Currency[] = ['SAR', 'USD', 'EGP'];

function parseAccount(form: FormData, exceptId?: number) {
	const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ');
	if (!name) return { error: 'Enter a name.' };
	if (name.length > 40) return { error: 'Keep it under 40 characters.' };
	const existing = db.findAccountByName(name);
	if (existing && existing.id !== exceptId) return { error: `"${existing.name}" already exists.` };

	const currency = String(form.get('currency'));
	if (!CURRENCIES.includes(currency as Currency)) return { error: 'Pick SAR, USD or EGP.' };

	const starting = parseBalance(String(form.get('starting_balance') ?? ''));
	if (starting === null) return { error: 'Enter a balance like 1500 or -250.' };

	// SAR is the default currency, so its rate is always 1.
	let rate = 1;
	if (currency !== 'SAR') {
		rate = Number(String(form.get('rate_to_default') ?? '').trim());
		if (!Number.isFinite(rate) || rate <= 0 || rate > 100000) {
			return { error: 'Enter how many SAR one unit is worth, like 3.75.' };
		}
	}
	return {
		account: { name, currency: currency as Currency, starting_balance: starting, rate_to_default: rate }
	};
}

const MAX_NAME = 40;

/** Returns the cleaned name, or an error message. `exceptId` lets a rename keep its own name. */
function validateName(raw: FormDataEntryValue | null, exceptId?: number): { name: string } | { error: string } {
	const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
	if (!name) return { error: 'Enter a name.' };
	if (name.length > MAX_NAME) return { error: `Keep it under ${MAX_NAME} characters.` };
	const existing = db.findCategoryByName(name);
	if (existing && existing.id !== exceptId) return { error: `"${existing.name}" already exists.` };
	return { name };
}

const MAX_CSV_CHARS = 5_000_000;
const MAX_ROWS = 20_000;

/** A column index from the form: '' = not mapped. */
function parseColumn(raw: FormDataEntryValue | null): number | null | 'bad' {
	const s = String(raw ?? '');
	if (s === '') return null;
	const n = Number(s);
	return Number.isInteger(n) && n >= 0 && n < 200 ? n : 'bad';
}

/** The CSV's own category if it names one of ours, else Other (expenses) or Income (money in). */
function pickCategory(name: string, amount: number, categories: Category[]): number {
	const match = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
	if (match) return match.id;
	const wantIncome = amount > 0;
	const fallback =
		categories.find((c) => !!c.is_income === wantIncome && c.name === (wantIncome ? 'Income' : 'Other')) ??
		categories.find((c) => !!c.is_income === wantIncome);
	// Every database has at least one category of each type (deleting the last one is blocked).
	return (fallback ?? categories[0]).id;
}

export const actions: Actions = {
	importCsv: async ({ request }) => {
		const form = await request.formData();
		const bad = (error: string) => fail(400, { action: 'import', error });

		const csv = String(form.get('csv') ?? '');
		if (!csv.trim()) return bad('Choose a CSV file first.');
		if (csv.length > MAX_CSV_CHARS) return bad('That file is too big to import (over 5 MB).');

		const account = db.getAccount(Number(form.get('account_id')));
		if (!account) return bad('Pick an account.');

		const dateFormat = String(form.get('date_format'));
		if (!['ymd', 'dmy', 'mdy'].includes(dateFormat)) return bad('Pick a date format.');

		const cols = {
			date: parseColumn(form.get('col_date')),
			amount: parseColumn(form.get('col_amount')),
			debit: parseColumn(form.get('col_debit')),
			credit: parseColumn(form.get('col_credit')),
			note: parseColumn(form.get('col_note')),
			category: parseColumn(form.get('col_category'))
		};
		if (Object.values(cols).includes('bad')) return bad('Column choice not valid.');
		const mapping = { ...cols, dateFormat: dateFormat as DateFormat } as Mapping;
		if (mapping.date === null) return bad('Choose which column holds the date.');
		if (mapping.amount === null && mapping.debit === null && mapping.credit === null) {
			return bad('Choose an amount column, or debit and credit columns.');
		}

		const firstDataRow = form.get('has_header') === 'on' ? 1 : 0;
		const dataRows = parseCsv(csv).slice(firstDataRow);
		if (dataRows.length === 0) return bad('No rows found in that file.');
		if (dataRows.length > MAX_ROWS) return bad(`Too many rows (limit ${MAX_ROWS}). Split the file.`);

		const categories = db.listCategories();
		const items: TransactionInput[] = [];
		const problems: string[] = [];
		let failed = 0;
		dataRows.forEach((row, i) => {
			const mapped = mapRow(row, mapping);
			if (!mapped.ok) {
				failed++;
				if (problems.length < 5) problems.push(`Row ${i + 1 + firstDataRow}: ${mapped.error}`);
				return;
			}
			items.push({
				account_id: account.id,
				category_id: pickCategory(mapped.categoryName, mapped.amount_cents, categories),
				amount_cents: mapped.amount_cents,
				date: mapped.date,
				note: mapped.note
			});
		});

		const { imported, skipped } = db.importTransactions(account.id, items);
		return { action: 'import', imported, skipped, failed, problems };
	},

	addAccount: async ({ request }) => {
		const parsed = parseAccount(await request.formData());
		if ('error' in parsed) return fail(400, { action: 'addAccount', error: parsed.error });
		db.insertAccount(parsed.account);
		return { action: 'addAccount' };
	},

	saveAccount: async ({ request }) => {
		const form = await request.formData();
		const accountId = Number(form.get('id'));
		if (!db.getAccount(accountId)) return fail(404, { accountId, error: 'That account no longer exists.' });
		const parsed = parseAccount(form, accountId);
		if ('error' in parsed) return fail(400, { accountId, error: parsed.error });
		db.updateAccount(accountId, parsed.account);
		return { accountId };
	},

	deleteAccount: async ({ request }) => {
		const accountId = Number((await request.formData()).get('id'));
		const account = db.listAccountsWithBalance().find((a) => a.id === accountId);
		if (!account) return fail(404, { accountId, error: 'That account no longer exists.' });
		if (db.listAccounts().length === 1) return fail(400, { accountId, error: 'Keep at least one account.' });
		// Deleting would orphan these, and quietly moving them would change two accounts' balances.
		if (account.tx_count > 0 || account.sub_count > 0) {
			return fail(400, {
				accountId,
				error: `It still has ${account.tx_count} transactions and ${account.sub_count} subscriptions. Move or delete them first.`
			});
		}
		db.deleteAccount(accountId);
		return { accountId };
	},

	addCategory: async ({ request }) => {
		const form = await request.formData();
		const result = validateName(form.get('name'));
		if ('error' in result) return fail(400, { action: 'add', error: result.error });
		db.insertCategory(result.name, form.get('is_income') === 'on');
		return { action: 'add' };
	},

	renameCategory: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!db.getCategory(id)) return fail(404, { id, error: 'That category no longer exists.' });
		const result = validateName(form.get('name'), id);
		if ('error' in result) return fail(400, { id, error: result.error });
		db.renameCategory(id, result.name);
		return { id };
	},

	deleteCategory: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		const category = db.getCategory(id);
		if (!category) return fail(404, { id, error: 'That category no longer exists.' });
		const fallback = db.fallbackCategoryFor(category);
		if (!fallback) {
			const kind = category.is_income ? 'income' : 'expense';
			return fail(400, { id, error: `Keep at least one ${kind} category.` });
		}
		db.deleteCategory(id, fallback.id);
		return { id };
	}
};
