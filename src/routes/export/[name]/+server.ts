import { error } from '@sveltejs/kit';
import * as db from '#lib/server/db.ts';
import { safeText, toCsv } from '#lib/csv.ts';
import { today } from '#lib/dates.ts';
import { centsToInput } from '#lib/money.ts';
import type { RequestHandler } from './$types';

const signed = (cents: number) => (cents < 0 ? '-' : '') + centsToInput(cents);

// Money is written as plain signed decimals ("-45.50"); free text is guarded against spreadsheet formulas.
const exporters: Record<string, () => (string | number)[][]> = {
	transactions: () => [
		['date', 'account', 'category', 'amount', 'note', 'currency'],
		...db
			.listAllTransactions()
			.map((t) => [
				t.date,
				safeText(t.account_name),
				safeText(t.category_name),
				signed(t.amount_cents),
				safeText(t.note),
				t.currency
			])
	],
	subscriptions: () => [
		['name', 'amount', 'cycle', 'next_renewal', 'category', 'account', 'currency', 'active', 'auto_log'],
		...db
			.listSubscriptions()
			.map((s) => [
				safeText(s.name),
				centsToInput(s.amount_cents),
				s.cycle,
				s.next_renewal,
				safeText(s.category_name),
				safeText(s.account_name),
				s.currency,
				s.active ? 'yes' : 'no',
				s.auto_log ? 'yes' : 'no'
			])
	],
	accounts: () => [
		['name', 'currency', 'starting_balance', 'rate_to_sar', 'current_balance'],
		...db
			.listAccountsWithBalance()
			.map((a) => [
				safeText(a.name),
				a.currency,
				signed(a.starting_balance),
				a.rate_to_default,
				signed(a.balance)
			])
	],
	categories: () => [
		['name', 'type', 'monthly_budget'],
		...db
			.listCategories()
			.map((c) => [
				safeText(c.name),
				c.is_income ? 'income' : 'expense',
				c.monthly_budget === null ? '' : centsToInput(c.monthly_budget)
			])
	]
};

export const GET: RequestHandler = ({ params }) => {
	// hasOwn, not a plain lookup: names like "constructor" or "__proto__" must not reach Object.prototype.
	if (!Object.hasOwn(exporters, params.name)) error(404, 'Unknown export');
	return new Response(toCsv(exporters[params.name]()), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="budgeting-${params.name}-${today()}.csv"`
		}
	});
};
