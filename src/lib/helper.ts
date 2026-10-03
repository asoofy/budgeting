// Rules for the spending helper. No AI, just arithmetic. Amounts are cents.
import { yearlyCost, type Cycle } from './renewals.ts';

/** A subscription counts as "used" once it was ticked in the current month ('YYYY-MM'). */
export function isUsedThisMonth(lastReviewed: string | null, month: string): boolean {
	return lastReviewed !== null && lastReviewed.startsWith(month);
}

/** Yearly saving in the default currency from cancelling a subscription. */
export function subscriptionSaving(amountCents: number, cycle: Cycle, rate: number): number {
	return Math.round(yearlyCost(amountCents, cycle) * rate);
}

/** Yearly saving if this month's overspend on a category stopped happening every month. */
export function overspendSaving(overCents: number): number {
	return overCents * 12;
}
