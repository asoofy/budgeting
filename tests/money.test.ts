import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, parseAmount, parseBalance, signedAmount, toDefault } from '#lib/money.ts';

describe('parseAmount', () => {
	it('parses whole and decimal amounts into cents', () => {
		expect(parseAmount('45')).toBe(4500);
		expect(parseAmount('12.5')).toBe(1250);
		expect(parseAmount('12.05')).toBe(1205);
		expect(parseAmount('.5')).toBe(50);
		expect(parseAmount(' 1,250.99 ')).toBe(125099);
	});

	it('avoids float errors', () => {
		expect(parseAmount('0.29')).toBe(29);
		expect(parseAmount('1.15')).toBe(115);
		expect(parseAmount('19.99')).toBe(1999);
	});

	it('accepts Arabic-Indic digits', () => {
		expect(parseAmount('١٢٫٥')).toBe(1250);
	});

	it('rejects junk, zero, negatives and extra decimals', () => {
		for (const bad of ['', '.', 'abc', '0', '0.00', '-5', '1.234', '1.2.3', '5e3']) {
			expect(parseAmount(bad)).toBeNull();
		}
	});
});

describe('parseBalance', () => {
	it('allows zero, blank and negatives', () => {
		expect(parseBalance('')).toBe(0);
		expect(parseBalance('0')).toBe(0);
		expect(parseBalance('18,500.50')).toBe(1850050);
		expect(parseBalance('-250')).toBe(-25000);
		expect(parseBalance('−12.5')).toBe(-1250);
	});

	it('rejects junk', () => {
		for (const bad of ['abc', '--5', '1.234', '-', '5-']) expect(parseBalance(bad)).toBeNull();
	});
});

describe('formatting', () => {
	it('formats cents with thousands separators', () => {
		expect(formatCents(125050)).toBe('1,250.50');
		expect(formatCents(-4500)).toBe('-45.00');
		expect(formatCents(0)).toBe('0.00');
	});

	it('round-trips cents through the input format', () => {
		expect(centsToInput(-125005)).toBe('1250.05');
		expect(parseAmount(centsToInput(1999))).toBe(1999);
	});
});

describe('signedAmount', () => {
	it('stores expenses negative and income positive', () => {
		expect(signedAmount(4500, false)).toBe(-4500);
		expect(signedAmount(4500, true)).toBe(4500);
		expect(signedAmount(-4500, true)).toBe(4500);
	});
});

describe('toDefault', () => {
	it('converts with the manual rate and rounds to a cent', () => {
		expect(toDefault(120000, 3.75)).toBe(450000);
		expect(toDefault(1399, 3.75)).toBe(5246);
		expect(toDefault(-250050, 1)).toBe(-250050);
	});
});

describe('amount ceiling', () => {
	it('accepts up to 100 million and rejects anything above', () => {
		expect(parseAmount('100000000')).toBe(10_000_000_000);
		expect(parseAmount('100,000,000.00')).toBe(10_000_000_000);
		expect(parseAmount('99999999.99')).toBe(9_999_999_999);
		expect(parseAmount('100000000.01')).toBeNull();
		expect(parseAmount('9999999999999')).toBeNull();
		expect(parseAmount('999999999999999999999')).toBeNull();
	});

	it('applies the same ceiling to balances, in both directions', () => {
		expect(parseBalance('-100000000')).toBe(-10_000_000_000);
		expect(parseBalance('-100000000.01')).toBeNull();
		expect(parseBalance('100000000.01')).toBeNull();
	});
});
