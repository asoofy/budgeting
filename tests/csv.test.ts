import { describe, expect, it } from 'vitest';
import { parseCsv, safeText, toCsv, unsafeText } from '#lib/csv.ts';
import {
	guessDateFormat,
	guessMapping,
	mapRow,
	parseBankAmount,
	parseBankDate,
	type Mapping
} from '#lib/importer.ts';

describe('parseCsv', () => {
	it('parses plain rows, CRLF and a BOM', () => {
		expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
	});

	it('handles quotes, embedded commas, quotes and newlines', () => {
		expect(parseCsv('a,"b, c","say ""hi""","line1\nline2"\n')).toEqual([
			['a', 'b, c', 'say "hi"', 'line1\nline2']
		]);
	});

	it('detects semicolon and tab delimiters', () => {
		expect(parseCsv('a;b;c\n1,5;2;3')).toEqual([['a', 'b', 'c'], ['1,5', '2', '3']]);
		expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
	});

	it('keeps empty cells and drops blank lines', () => {
		expect(parseCsv('a,,c\n\n,,\n1,2,3')).toEqual([['a', '', 'c'], ['1', '2', '3']]);
	});

	it('round-trips through toCsv', () => {
		const rows = [['date', 'note'], ['2026-10-03', 'Coffee, "large"\nsecond line'], ['x', 'عربي']];
		expect(parseCsv(toCsv(rows))).toEqual(rows);
	});
});

describe('spreadsheet formula guard', () => {
	it('prefixes text that would run as a formula, and undoes it on import', () => {
		for (const t of ['=SUM(A1)', '+1', '-2', '@cmd']) {
			expect(safeText(t)).toBe("'" + t);
			expect(unsafeText(safeText(t))).toBe(t);
		}
		expect(safeText('Coffee')).toBe('Coffee');
		expect(unsafeText("it's fine")).toBe("it's fine");
	});
});

describe('parseBankDate', () => {
	it('reads year-first dates regardless of format', () => {
		expect(parseBankDate('2026-10-03', 'dmy')).toBe('2026-10-03');
		expect(parseBankDate('2026/1/5', 'mdy')).toBe('2026-01-05');
	});

	it('uses the chosen day/month order', () => {
		expect(parseBankDate('03/10/2026', 'dmy')).toBe('2026-10-03');
		expect(parseBankDate('03/10/2026', 'mdy')).toBe('2026-03-10');
		expect(parseBankDate('3.10.26', 'dmy')).toBe('2026-10-03');
	});

	it('ignores a time part and rejects impossible dates', () => {
		expect(parseBankDate('2026-10-03 14:22:01', 'ymd')).toBe('2026-10-03');
		expect(parseBankDate('31/02/2026', 'dmy')).toBeNull();
		expect(parseBankDate('13/13/2026', 'dmy')).toBeNull();
		expect(parseBankDate('October 3', 'dmy')).toBeNull();
	});
});

describe('guessDateFormat', () => {
	it('spots day-first and month-first from a part above 12', () => {
		expect(guessDateFormat(['03/10/2026', '25/10/2026'])).toBe('dmy');
		expect(guessDateFormat(['03/10/2026', '10/25/2026'])).toBe('mdy');
		expect(guessDateFormat(['03/10/2026'])).toBe('dmy');
	});
});

describe('parseBankAmount', () => {
	it('reads signs the way banks write them', () => {
		expect(parseBankAmount('-45.50')).toBe(-4550);
		expect(parseBankAmount('(45.50)')).toBe(-4550);
		expect(parseBankAmount('45.50-')).toBe(-4550);
		expect(parseBankAmount('+45.50')).toBe(4550);
		expect(parseBankAmount('1,250.50')).toBe(125050);
	});

	it('strips currency labels and reads a decimal comma', () => {
		expect(parseBankAmount('SAR 1,250.50')).toBe(125050);
		expect(parseBankAmount('-ر.س 12')).toBe(-1200);
		expect(parseBankAmount('45,50')).toBe(4550);
	});

	it('returns null for blank, zero and junk', () => {
		for (const bad of ['', '  ', '0', '0.00', 'n/a', '-']) expect(parseBankAmount(bad)).toBeNull();
	});
});

describe('mapRow', () => {
	const base: Mapping = {
		date: 0,
		amount: 1,
		debit: null,
		credit: null,
		note: 2,
		category: null,
		dateFormat: 'dmy'
	};

	it('maps a signed-amount row', () => {
		expect(mapRow(['03/10/2026', '-45.50', 'Coffee shop'], base)).toEqual({
			ok: true,
			date: '2026-10-03',
			amount_cents: -4550,
			note: 'Coffee shop',
			categoryName: ''
		});
	});

	it('maps separate debit and credit columns whatever their sign', () => {
		const m: Mapping = { ...base, amount: null, debit: 1, credit: 2, note: 3 };
		expect(mapRow(['03/10/2026', '45.50', '', 'Ride share'], m)).toMatchObject({ amount_cents: -4550 });
		expect(mapRow(['03/10/2026', '', '6,000.00', 'Salary'], m)).toMatchObject({ amount_cents: 600000 });
		expect(mapRow(['03/10/2026', '-45.50', '', 'Ride share'], m)).toMatchObject({ amount_cents: -4550 });
		expect(mapRow(['03/10/2026', '', '', 'Nothing'], m)).toEqual({ ok: false, error: 'No amount' });
	});

	it('reports unreadable dates and amounts', () => {
		expect(mapRow(['soon', '-5', 'x'], base)).toMatchObject({ ok: false });
		expect(mapRow(['03/10/2026', 'abc', 'x'], base)).toEqual({ ok: false, error: 'No amount' });
	});

	it('trims, caps and unescapes notes', () => {
		const r = mapRow(['03/10/2026', '-5', "'=HYPERLINK()"], base);
		expect(r).toMatchObject({ ok: true, note: '=HYPERLINK()' });
	});
});

describe('guessMapping', () => {
	it('finds English headers', () => {
		expect(guessMapping(['Date', 'Description', 'Debit', 'Credit', 'Balance'], ['03/10/2026'])).toMatchObject({
			date: 0,
			note: 1,
			debit: 2,
			credit: 3,
			amount: null,
			category: null
		});
	});

	it('finds an amount column and a category column', () => {
		expect(guessMapping(['Transaction Date', 'Amount', 'Memo', 'Category'], [])).toMatchObject({
			date: 0,
			amount: 1,
			note: 2,
			category: 3
		});
	});
});

describe('import limits', () => {
	it('rejects amounts above 100 million', () => {
		expect(parseBankAmount('100,000,000.00')).toBe(10_000_000_000);
		expect(parseBankAmount('100,000,000.01')).toBeNull();
		expect(parseBankAmount('-9999999999999')).toBeNull();
	});

	it('rejects dates outside 2000-2099, such as the 1970 or 1900 placeholders some banks export', () => {
		expect(parseBankDate('01/01/1970', 'dmy')).toBeNull();
		expect(parseBankDate('1900-01-01', 'ymd')).toBeNull();
		expect(parseBankDate('2100-01-01', 'ymd')).toBeNull();
		expect(parseBankDate('31/12/2099', 'dmy')).toBe('2099-12-31');
		expect(parseBankDate('01/01/2000', 'dmy')).toBe('2000-01-01');
	});

	it('reports a row with a placeholder date as unreadable', () => {
		const m: Mapping = { date: 0, amount: 1, debit: null, credit: null, note: 2, category: null, dateFormat: 'dmy' };
		expect(mapRow(['01/01/1970', '-5', 'x'], m)).toMatchObject({ ok: false });
	});
});
