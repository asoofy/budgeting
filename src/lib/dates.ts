// Dates are 'YYYY-MM-DD' strings, months are 'YYYY-MM'. Arithmetic uses UTC to avoid DST surprises.

const pad = (n: number) => String(n).padStart(2, '0');

function toIso(d: Date): string {
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function fromIso(date: string): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

/** Today in the machine's local time zone. */
export function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth(): string {
	return today().slice(0, 7);
}

/**
 * Years outside this range are almost always typos (1926 for 2026) and would make renewal
 * math run away, so they are rejected everywhere a date comes in: forms, URLs and CSV imports.
 */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2099;

export function isValidDate(s: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const year = Number(s.slice(0, 4));
	return year >= MIN_YEAR && year <= MAX_YEAR && toIso(fromIso(s)) === s;
}

export function isValidMonth(s: string): boolean {
	return /^\d{4}-\d{2}$/.test(s) && isValidDate(`${s}-01`);
}

export function addDays(date: string, days: number): string {
	const d = fromIso(date);
	d.setUTCDate(d.getUTCDate() + days);
	return toIso(d);
}

/** Jan 31 + 1 month = Feb 28 (or 29): clamps to the last day instead of overflowing. */
export function addMonths(date: string, months: number): string {
	const d = fromIso(date);
	const day = d.getUTCDate();
	d.setUTCDate(1);
	d.setUTCMonth(d.getUTCMonth() + months);
	const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
	d.setUTCDate(Math.min(day, lastDay));
	return toIso(d);
}

export function shiftMonth(month: string, delta: number): string {
	return addMonths(`${month}-01`, delta).slice(0, 7);
}

/** '2026-10' -> 'October 2026' */
export function monthLabel(month: string): string {
	return fromIso(`${month}-01`).toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** '2026-10-03' -> 'Sat, Oct 3' */
export function dayLabel(date: string): string {
	return fromIso(date).toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
}
