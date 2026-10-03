import { fail } from '@sveltejs/kit';
import * as db from '#lib/server/db.ts';
import { currentMonth, isValidDate, isValidMonth, today } from '#lib/dates.ts';
import { parseAmount, signedAmount } from '#lib/money.ts';
import type { TransactionInput } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const monthParam = url.searchParams.get('month') ?? '';
	const month = isValidMonth(monthParam) ? monthParam : currentMonth();
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const accounts = db.listAccounts();

	return {
		month,
		q,
		transactions: db.listTransactions(month, q),
		categories: db.listCategories(),
		accounts,
		today: today(),
		defaultAccountId: db.lastUsedAccountId() ?? accounts[0]?.id
	};
};

function parseForm(form: FormData): { tx: TransactionInput } | { error: string } {
	const amount = parseAmount(String(form.get('amount') ?? ''));
	if (amount === null) return { error: 'Enter an amount like 45 or 12.50.' };

	const category = db.getCategory(Number(form.get('category_id')));
	if (!category) return { error: 'Pick a category.' };

	const account = db.getAccount(Number(form.get('account_id')));
	if (!account) return { error: 'Pick an account.' };

	const date = String(form.get('date') ?? '');
	if (!isValidDate(date)) return { error: 'Enter a valid date.' };

	const note = String(form.get('note') ?? '').trim().slice(0, 200);

	return {
		tx: {
			account_id: account.id,
			category_id: category.id,
			amount_cents: signedAmount(amount, category.is_income === 1),
			date,
			note
		}
	};
}

/** The hidden `id` field: empty means a new transaction. */
function parseId(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const parsed = parseForm(form);
		if ('error' in parsed) return fail(400, { error: parsed.error });

		const id = parseId(form);
		if (id === null) {
			db.insertTransaction(parsed.tx);
		} else {
			if (!db.getTransaction(id)) return fail(404, { error: 'That transaction no longer exists.' });
			db.updateTransaction(id, parsed.tx);
		}
		return { saved: true };
	},

	delete: async ({ request }) => {
		const id = parseId(await request.formData());
		if (id === null || !db.getTransaction(id)) {
			return fail(404, { error: 'That transaction no longer exists.' });
		}
		db.deleteTransaction(id);
		return { deleted: true };
	}
};
