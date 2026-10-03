import { describe, expect, it } from 'vitest';
import { budgetStatus } from '#lib/budget.ts';

describe('budgetStatus', () => {
	it('is ok below 80%', () => {
		expect(budgetStatus(0, 10000)).toEqual({ state: 'ok', left: 10000, percent: 0 });
		expect(budgetStatus(7999, 10000)).toMatchObject({ state: 'ok', left: 2001 });
	});

	it('warns from exactly 80%', () => {
		expect(budgetStatus(8000, 10000).state).toBe('warn');
		expect(budgetStatus(9999, 10000).state).toBe('warn');
	});

	it('is over at exactly 100%', () => {
		expect(budgetStatus(10000, 10000)).toEqual({ state: 'over', left: 0, percent: 100 });
	});

	it('reports how far over, and caps the bar at 100%', () => {
		expect(budgetStatus(12500, 10000)).toEqual({ state: 'over', left: -2500, percent: 100 });
	});

	it('treats net refunds as an empty bar, not a negative one', () => {
		expect(budgetStatus(-500, 10000)).toEqual({ state: 'ok', left: 10500, percent: 0 });
	});

	it('handles a zero limit', () => {
		expect(budgetStatus(0, 0).state).toBe('ok');
		expect(budgetStatus(100, 0).state).toBe('over');
	});
});
