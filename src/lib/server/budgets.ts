import { listCategories, spendingByCategory } from './db.ts';
import { budgetStatus, type BudgetStatus } from '#lib/budget.ts';

export type BudgetRow = {
	id: number;
	name: string;
	limit: number | null;
	spent: number;
	/** null when the category has no limit */
	status: BudgetStatus | null;
};

/** Every expense category with its spending for the month and, if it has a limit, its status. */
export function budgetRows(month: string): BudgetRow[] {
	const spending = spendingByCategory(month);
	return listCategories()
		.filter((c) => !c.is_income)
		.map((c) => {
			const spent = spending.get(c.id) ?? 0;
			return {
				id: c.id,
				name: c.name,
				limit: c.monthly_budget,
				spent,
				status: c.monthly_budget === null ? null : budgetStatus(spent, c.monthly_budget)
			};
		});
}
