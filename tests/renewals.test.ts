import { describe, expect, it } from 'vitest';
import { addDays } from '#lib/dates.ts';
import {
	dueDates,
	monthlyCost,
	nextRenewalAfter,
	recentRenewals,
	renewsSoon,
	rollForward,
	totals,
	yearlyCost
} from '#lib/renewals.ts';

describe('nextRenewalAfter', () => {
	it('steps by cycle', () => {
		expect(nextRenewalAfter('2026-10-03', 'weekly')).toBe('2026-10-10');
		expect(nextRenewalAfter('2026-10-03', 'monthly')).toBe('2026-11-03');
		expect(nextRenewalAfter('2026-10-03', 'yearly')).toBe('2027-10-03');
	});

	it('crosses year ends', () => {
		expect(nextRenewalAfter('2026-12-29', 'weekly')).toBe('2027-01-05');
		expect(nextRenewalAfter('2026-12-15', 'monthly')).toBe('2027-01-15');
	});

	it('clamps to the end of shorter months', () => {
		expect(nextRenewalAfter('2026-01-31', 'monthly')).toBe('2026-02-28');
		expect(nextRenewalAfter('2028-01-31', 'monthly')).toBe('2028-02-29');
		expect(nextRenewalAfter('2028-02-29', 'yearly')).toBe('2029-02-28');
	});
});

describe('dueDates', () => {
	it('is empty when the renewal is in the future', () => {
		expect(dueDates('2026-10-04', 'monthly', '2026-10-03')).toEqual([]);
	});

	it('includes today', () => {
		expect(dueDates('2026-10-03', 'monthly', '2026-10-03')).toEqual(['2026-10-03']);
	});

	it('returns every missed renewal while the app was closed', () => {
		expect(dueDates('2026-08-20', 'monthly', '2026-10-25')).toEqual([
			'2026-08-20',
			'2026-09-20',
			'2026-10-20'
		]);
		expect(dueDates('2026-09-19', 'weekly', '2026-10-03')).toEqual([
			'2026-09-19',
			'2026-09-26',
			'2026-10-03'
		]);
	});
});

describe('rollForward', () => {
	it('keeps a future or current date', () => {
		expect(rollForward('2026-10-03', 'monthly', '2026-10-03')).toBe('2026-10-03');
		expect(rollForward('2026-11-01', 'monthly', '2026-10-03')).toBe('2026-11-01');
	});

	it('skips past renewals to the next upcoming one', () => {
		expect(rollForward('2026-09-05', 'monthly', '2026-10-03')).toBe('2026-10-05');
		expect(rollForward('2026-07-01', 'weekly', '2026-10-03')).toBe('2026-10-07');
	});
});

describe('costs', () => {
	it('computes yearly cost', () => {
		expect(yearlyCost(4500, 'weekly')).toBe(234000);
		expect(yearlyCost(5600, 'monthly')).toBe(67200);
		expect(yearlyCost(249900, 'yearly')).toBe(249900);
	});

	it('computes monthly cost, rounded to the cent', () => {
		expect(monthlyCost(5600, 'monthly')).toBe(5600);
		expect(monthlyCost(249900, 'yearly')).toBe(20825);
		expect(monthlyCost(4500, 'weekly')).toBe(19500);
		expect(monthlyCost(1398, 'yearly')).toBe(117); // 116.5 rounds up
	});

	it('totals in the default currency using each rate', () => {
		const t = totals([
			{ amount_cents: 5600, cycle: 'monthly', rate: 1 },
			{ amount_cents: 1000, cycle: 'monthly', rate: 3.75 }, // 10 USD
			{ amount_cents: 249900, cycle: 'yearly', rate: 1 }
		]);
		expect(t.yearly).toBe(67200 + 45000 + 249900);
		expect(t.monthly).toBe(Math.round(362100 / 12));
	});

	it('totals nothing as zero', () => {
		expect(totals([])).toEqual({ yearly: 0, monthly: 0 });
	});
});

describe('renewsSoon', () => {
	it('covers today through 7 days ahead', () => {
		expect(renewsSoon('2026-10-03', '2026-10-03')).toBe(true);
		expect(renewsSoon('2026-10-10', '2026-10-03')).toBe(true);
		expect(renewsSoon('2026-10-11', '2026-10-03')).toBe(false);
		expect(renewsSoon('2026-10-02', '2026-10-03')).toBe(false);
	});
});

describe('long gaps (dates are limited to 2000-2099)', () => {
	const today = '2026-10-03';

	it('rollForward reaches today even from the earliest allowed date', () => {
		for (const cycle of ['weekly', 'monthly', 'yearly'] as const) {
			const next = rollForward('2000-01-01', cycle, today);
			expect(next >= today).toBe(true);
			expect(next < addDays(today, 367)).toBe(true);
		}
		expect(rollForward('2000-01-01', 'weekly', today) < addDays(today, 7)).toBe(true);
	});

	it('dueDates catches up completely from the earliest allowed date', () => {
		const dates = dueDates('2000-01-01', 'weekly', today);
		expect(dates.length).toBeGreaterThan(1300);
		expect(dates[dates.length - 1] <= today).toBe(true);
		expect(nextRenewalAfter(dates[dates.length - 1], 'weekly') > today).toBe(true);
	});
});

describe('recentRenewals', () => {
	const today = '2026-10-03';

	it('keeps the last 400 days and drops older history', () => {
		const dates = ['2020-01-01', addDays(today, -401), addDays(today, -400), addDays(today, -1), today];
		expect(recentRenewals(dates, today)).toEqual([addDays(today, -400), addDays(today, -1), today]);
	});

	it('keeps everything when the app was only closed for a few weeks', () => {
		const dates = dueDates(addDays(today, -28), 'weekly', today);
		expect(recentRenewals(dates, today)).toEqual(dates);
	});

	it('limits a runaway to about a year of weekly renewals', () => {
		const dates = dueDates('2000-01-01', 'weekly', today);
		expect(recentRenewals(dates, today).length).toBeLessThanOrEqual(58);
	});
});
