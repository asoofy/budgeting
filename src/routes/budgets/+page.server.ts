import { fail } from '@sveltejs/kit';
import * as db from '#lib/server/db.ts';
import { budgetRows } from '#lib/server/budgets.ts';
import { currentMonth, isValidMonth, today } from '#lib/dates.ts';
import { isUsedThisMonth, overspendSaving, subscriptionSaving } from '#lib/helper.ts';
import { parseAmount } from '#lib/money.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const monthParam = url.searchParams.get('month') ?? '';
	const month = isValidMonth(monthParam) ? monthParam : currentMonth();
	const rows = budgetRows(month);

	// Budgeted categories first, then the ones without a limit.
	rows.sort((a, b) => Number(b.limit !== null) - Number(a.limit !== null));

	const budgeted = rows.filter((r) => r.limit !== null);
	const thisMonth = currentMonth();

	return {
		month,
		rows,
		// Spending helper. Overspend is for the month being viewed; the "used" review is always this month.
		overspent: rows
			.filter((r) => r.status?.state === 'over' && r.status.left < 0)
			.map((r) => ({ id: r.id, name: r.name, over: -r.status!.left, saving: overspendSaving(-r.status!.left) }))
			.sort((a, b) => b.saving - a.saving),
		reviews: db
			.listSubscriptions()
			.filter((s) => s.active)
			.map((s) => ({
				id: s.id,
				name: s.name,
				cycle: s.cycle,
				amount_cents: s.amount_cents,
				currency: s.currency,
				used: isUsedThisMonth(s.last_reviewed, thisMonth),
				saving: subscriptionSaving(s.amount_cents, s.cycle, s.rate_to_default)
			}))
			// Unused first, biggest saving on top
			.sort((a, b) => Number(a.used) - Number(b.used) || b.saving - a.saving),
		totalLimit: budgeted.reduce((sum, r) => sum + (r.limit ?? 0), 0),
		totalSpent: budgeted.reduce((sum, r) => sum + r.spent, 0)
	};
};

export const actions: Actions = {
	review: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!db.getSubscription(id)) return fail(404, { error: 'That subscription no longer exists.' });
		db.setLastReviewed(id, form.get('used') === 'on' ? today() : null);
		return { reviewed: id };
	},

	setBudget: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const category = db.getCategory(id);
		if (!category || category.is_income) return fail(404, { id, error: 'That category no longer exists.' });

		const raw = String(form.get('limit') ?? '').trim();
		if (raw === '') {
			db.setBudget(id, null);
			return { id };
		}
		const cents = parseAmount(raw);
		if (cents === null) return fail(400, { id, error: 'Enter an amount like 500, or clear it for no limit.' });
		db.setBudget(id, cents);
		return { id };
	}
};
