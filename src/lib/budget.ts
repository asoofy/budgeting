// Pure budget math. Amounts are cents in the default currency.

export type BudgetState = 'ok' | 'warn' | 'over';

export const WARN_AT = 0.8;

export type BudgetStatus = {
	state: BudgetState;
	/** Cents left; negative when over budget. */
	left: number;
	/** Bar fill, 0 to 100. */
	percent: number;
};

/**
 * Green under 80%, yellow from 80%, red at 100% (spending exactly the limit counts as over).
 * `spent` is net of refunds, so it can be negative; that shows as an empty bar.
 */
export function budgetStatus(spent: number, limit: number): BudgetStatus {
	const left = limit - spent;
	if (limit <= 0) return { state: spent > 0 ? 'over' : 'ok', left, percent: spent > 0 ? 100 : 0 };

	const ratio = spent / limit;
	const state: BudgetState = ratio >= 1 ? 'over' : ratio >= WARN_AT ? 'warn' : 'ok';
	return { state, left, percent: Math.min(100, Math.max(0, ratio * 100)) };
}
