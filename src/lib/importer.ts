// Turns rows from a bank CSV into transactions, given a column mapping. Pure: used for the live
// preview in the browser and again, as the real check, on the server.
import { unsafeText } from './csv.ts';
import { isValidDate } from './dates.ts';
import { parseCents } from './money.ts';

export type DateFormat = 'ymd' | 'dmy' | 'mdy';

/** Column indexes into a row; null = not mapped. */
export type Mapping = {
	date: number | null;
	amount: number | null;
	debit: number | null;
	credit: number | null;
	note: number | null;
	category: number | null;
	dateFormat: DateFormat;
};

export type MappedRow =
	| { ok: true; date: string; amount_cents: number; note: string; categoryName: string }
	| { ok: false; error: string };

const pad = (s: string) => s.padStart(2, '0');

/** '03/10/2026' with 'dmy' -> '2026-10-03'. A leading 4-digit year is always read as year-first. */
export function parseBankDate(raw: string, format: DateFormat): string | null {
	const parts = raw.trim().split(/[ T]/)[0].split(/[-/.]/);
	if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null;

	let y: string, m: string, d: string;
	if (parts[0].length === 4) [y, m, d] = parts;
	else {
		[d, m, y] = format === 'mdy' ? [parts[1], parts[0], parts[2]] : parts;
		if (y.length === 2) y = '20' + y;
	}
	if (y.length !== 4) return null;
	const iso = `${y}-${pad(m)}-${pad(d)}`;
	return isValidDate(iso) ? iso : null;
}

/** Day/month order isn't visible in "03/10/2026", so look for a part above 12. Defaults to day first. */
export function guessDateFormat(samples: string[]): DateFormat {
	for (const raw of samples) {
		const parts = raw.trim().split(/[ T]/)[0].split(/[-/.]/);
		if (parts.length !== 3 || parts[0].length === 4) continue;
		if (Number(parts[0]) > 12) return 'dmy';
		if (Number(parts[1]) > 12) return 'mdy';
	}
	return 'dmy';
}

/**
 * Signed cents from how banks write amounts: "-45.00", "(45.00)", "45.00-", "SAR 1,250.50", "45,50".
 * Returns null for blank, zero or unreadable values.
 */
export function parseBankAmount(raw: string): number | null {
	const s = raw.trim();
	if (s === '') return null;
	const negative = /^\(.*\)$/.test(s) || /^[-−]/.test(s) || /[-−]$/.test(s);
	// Take just the number, so punctuation inside a currency label ("ر.س", "S.R.") isn't read as a decimal point.
	let digits = /[.٫]?[\d٠-٩][\d٠-٩.,٫٬ ]*/.exec(s)?.[0].trim() ?? '';
	// "45,50" with no dot is a decimal comma; otherwise commas are thousands separators.
	if (!digits.includes('.') && /^[\d\s]+,\d{1,2}$/.test(digits.trim())) digits = digits.replace(',', '.');
	const cents = parseCents(digits);
	if (cents === null || cents === 0) return null;
	return negative ? -cents : cents;
}

/** Guesses the mapping from header names, in English and Arabic. Anything it can't find stays null. */
export function guessMapping(headers: string[], sampleDates: string[]): Mapping {
	const find = (...patterns: RegExp[]) => {
		const i = headers.findIndex((h) => patterns.some((p) => p.test(h.trim())));
		return i === -1 ? null : i;
	};
	return {
		date: find(/date|تاريخ/i),
		amount: find(/^amount$|^value$|المبلغ/i),
		debit: find(/debit|withdraw|paid out|مدين|سحب/i),
		credit: find(/credit|deposit|paid in|دائن|إيداع/i),
		note: find(/descr|detail|memo|narrat|note|payee|merchant|reference|البيان|وصف|تفاصيل/i),
		category: find(/categor|الفئة|التصنيف/i),
		dateFormat: guessDateFormat(sampleDates)
	};
}

const cell = (row: string[], i: number | null) => (i === null ? '' : (row[i] ?? '').trim());

/** One CSV row -> a transaction, or the reason it can't be imported. */
export function mapRow(row: string[], m: Mapping): MappedRow {
	const date = parseBankDate(cell(row, m.date), m.dateFormat);
	if (!date) return { ok: false, error: `Can't read the date "${cell(row, m.date)}"` };

	let amount: number | null = null;
	if (m.amount !== null) {
		amount = parseBankAmount(cell(row, m.amount));
	} else {
		// Separate columns: money out is an expense, money in is income, whatever sign the bank used.
		const out = parseBankAmount(cell(row, m.debit));
		const into = parseBankAmount(cell(row, m.credit));
		if (out !== null) amount = -Math.abs(out);
		else if (into !== null) amount = Math.abs(into);
	}
	if (amount === null) return { ok: false, error: 'No amount' };

	return {
		ok: true,
		date,
		amount_cents: amount,
		note: unsafeText(cell(row, m.note)).slice(0, 200),
		categoryName: cell(row, m.category)
	};
}
