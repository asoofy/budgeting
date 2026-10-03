// Pure subscription math. Amounts are cents; dates are 'YYYY-MM-DD'.
import { addDays, addMonths } from './dates.ts';

export type Cycle = 'weekly' | 'monthly' | 'yearly';

export const CYCLES: Cycle[] = ['weekly', 'monthly', 'yearly'];

/** The renewal after `date`. Monthly/yearly clamp to month end (Jan 31 -> Feb 28), and stay clamped after. */
export function nextRenewalAfter(date: string, cycle: Cycle): string {
	if (cycle === 'weekly') return addDays(date, 7);
	return addMonths(date, cycle === 'monthly' ? 1 : 12);
}

// Dates are limited to 2000-2099 (see isValidDate), so the longest gap is a weekly subscription
// from 2000 to 2099: about 5,200 steps. This cap is above that and only guards against a loop bug.
const MAX_STEPS = 10_000;

/** Renewal dates from `next` up to and including `today` (the ones that are due). */
export function dueDates(next: string, cycle: Cycle, today: string): string[] {
	const due: string[] = [];
	for (let d = next; d <= today && due.length < MAX_STEPS; d = nextRenewalAfter(d, cycle)) due.push(d);
	return due;
}

/** The first renewal on or after `today`, skipping (not logging) any missed ones. */
export function rollForward(next: string, cycle: Cycle, today: string): string {
	let d = next;
	for (let i = 0; d < today && i < MAX_STEPS; i++) d = nextRenewalAfter(d, cycle);
	return d;
}

/** Missed renewals older than this are skipped instead of logged. */
export const BACKFILL_DAYS = 400;

/**
 * Of the due renewals, the ones recent enough to log. Covers a long stretch with the app closed,
 * but never floods the ledger with years of history from an old or mistyped date.
 */
export function recentRenewals(dates: string[], today: string): string[] {
	const cutoff = addDays(today, -BACKFILL_DAYS);
	return dates.filter((d) => d >= cutoff);
}

const PER_YEAR: Record<Cycle, number> = { weekly: 52, monthly: 12, yearly: 1 };

/** Cost per year in cents, in the amount's own currency. */
export function yearlyCost(amountCents: number, cycle: Cycle): number {
	return amountCents * PER_YEAR[cycle];
}

/** Cost per month in cents, rounded to the nearest cent. */
export function monthlyCost(amountCents: number, cycle: Cycle): number {
	return Math.round(yearlyCost(amountCents, cycle) / 12);
}

/**
 * Totals across subscriptions in the default currency. `rate` converts each one's currency
 * (1 for SAR). Yearly is summed exactly; monthly is yearly / 12 so the two always agree.
 */
export function totals(subs: { amount_cents: number; cycle: Cycle; rate: number }[]) {
	const yearly = subs.reduce((sum, s) => sum + Math.round(yearlyCost(s.amount_cents, s.cycle) * s.rate), 0);
	return { yearly, monthly: Math.round(yearly / 12) };
}

/** True if `next` falls within the coming `days` days, today included. */
export function renewsSoon(next: string, today: string, days = 7): boolean {
	return next >= today && next <= addDays(today, days);
}
