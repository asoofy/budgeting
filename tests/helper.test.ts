import { describe, expect, it } from 'vitest';
import { isUsedThisMonth, overspendSaving, subscriptionSaving } from '#lib/helper.ts';

describe('isUsedThisMonth', () => {
	it('is true only for a tick made in the same month', () => {
		expect(isUsedThisMonth('2026-10-03', '2026-10')).toBe(true);
		expect(isUsedThisMonth('2026-10-31', '2026-10')).toBe(true);
		expect(isUsedThisMonth('2026-09-30', '2026-10')).toBe(false);
		expect(isUsedThisMonth('2025-10-03', '2026-10')).toBe(false);
		expect(isUsedThisMonth(null, '2026-10')).toBe(false);
	});
});

describe('subscriptionSaving', () => {
	it('annualises by billing cycle', () => {
		expect(subscriptionSaving(5600, 'monthly', 1)).toBe(67200);
		expect(subscriptionSaving(4500, 'weekly', 1)).toBe(234000);
		expect(subscriptionSaving(249900, 'yearly', 1)).toBe(249900);
	});

	it('converts foreign currency at the manual rate', () => {
		expect(subscriptionSaving(1000, 'monthly', 3.75)).toBe(45000);
		expect(subscriptionSaving(1399, 'yearly', 3.75)).toBe(5246); // 5246.25 rounds down
	});
});

describe('overspendSaving', () => {
	it('is twelve months of the overspend', () => {
		expect(overspendSaving(5613)).toBe(67356);
		expect(overspendSaving(0)).toBe(0);
	});
});
