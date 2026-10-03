import { describe, expect, it } from 'vitest';
import { addDays, addMonths, isValidDate, isValidMonth, shiftMonth } from '#lib/dates.ts';

describe('isValidDate', () => {
	it('accepts real dates from 2000 to 2099, including leap days', () => {
		for (const ok of ['2000-01-01', '2026-10-03', '2028-02-29', '2099-12-31']) {
			expect(isValidDate(ok)).toBe(true);
		}
	});

	it('rejects years outside 2000-2099 (typos like 1926 or 2206)', () => {
		for (const bad of ['1999-12-31', '1926-10-03', '1026-10-03', '0202-10-03', '0026-10-03', '2100-01-01', '9999-12-31']) {
			expect(isValidDate(bad)).toBe(false);
		}
	});

	it('rejects impossible dates and bad formats', () => {
		for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-1-5', '26-10-03', '2026/10/03', '', 'today']) {
			expect(isValidDate(bad)).toBe(false);
		}
	});
});

describe('isValidMonth', () => {
	it('uses the same year range', () => {
		expect(isValidMonth('2026-10')).toBe(true);
		expect(isValidMonth('2000-01')).toBe(true);
		expect(isValidMonth('2099-12')).toBe(true);
		expect(isValidMonth('1999-12')).toBe(false);
		expect(isValidMonth('2100-01')).toBe(false);
		expect(isValidMonth('2026-13')).toBe(false);
		expect(isValidMonth('2026-1')).toBe(false);
	});
});

describe('date arithmetic', () => {
	it('adds days across month and year ends', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
		expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
	});

	it('adds months, clamping to the end of shorter months', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2026-10-15', -10)).toBe('2025-12-15');
		expect(addMonths('2026-10-15', 3)).toBe('2027-01-15');
	});

	it('shifts a month label', () => {
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
	});
});
