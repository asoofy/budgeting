import * as db from '#lib/server/db.ts';
import { budgetRows } from '#lib/server/budgets.ts';
import { currentMonth, today } from '#lib/dates.ts';
import { renewsSoon } from '#lib/renewals.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const month = currentMonth();
	const now = today();
	const { income, spent } = db.monthTotals(month);

	return {
		month,
		today: now,
		income,
		spent,
		// Income minus spending this month. Early in the month, before a payment lands, this can be negative.
		left: income - spent,
		budgets: budgetRows(month)
			.filter((b) => b.status !== null)
			.sort((a, b) => b.status!.percent - a.status!.percent),
		renewals: db
			.listSubscriptions()
			.filter((s) => s.active && renewsSoon(s.next_renewal, now)),
		recent: db.listRecentTransactions(5)
	};
};
