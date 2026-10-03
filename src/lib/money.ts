// All money is integer cents. These helpers never round-trip through floats for parsing.

export const DEFAULT_CURRENCY = 'SAR';

/**
 * Largest amount accepted anywhere: 100 million, in cents. Far beyond real use, and small enough
 * that sums over many rows stay exact (JavaScript numbers are exact only up to 2^53).
 */
export const MAX_CENTS = 10_000_000_000;

/** Digits only, no sign: "12.5" -> 1250, zero allowed. Null if it isn't a number or is above MAX_CENTS. */
export function parseCents(input: string): number | null {
	const s = input
		.trim()
		.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
		.replace(/٫/g, '.')
		.replace(/[\s,٬]/g, '');
	const match = /^(\d*)(?:\.(\d{1,2}))?$/.exec(s);
	if (!match || s === '' || s === '.') return null;
	const whole = match[1] || '0';
	const frac = (match[2] ?? '').padEnd(2, '0');
	const cents = Number(whole) * 100 + Number(frac);
	return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

/**
 * Parses what a person types ("45", "12.5", "1,250.00", Arabic-Indic digits) into
 * positive cents. Returns null for anything else, including zero.
 */
export function parseAmount(input: string): number | null {
	const cents = parseCents(input);
	return cents === null || cents <= 0 ? null : cents;
}

/** Like parseAmount but for balances: allows a leading minus (a card you owe on), zero, and blank (= 0). */
export function parseBalance(input: string): number | null {
	const s = input.trim();
	if (s === '') return 0;
	const negative = /^[-−]/.test(s);
	const cents = parseCents(negative ? s.slice(1) : s);
	if (cents === null) return null;
	return negative ? -cents : cents;
}

const formatter = new Intl.NumberFormat('en-US', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/** 125050 -> "1,250.50". Sign is kept: -4500 -> "-45.00". */
export function formatCents(cents: number): string {
	return formatter.format(cents / 100);
}

/** 125050 -> "1250.50", for putting a stored amount back into an input. */
export function centsToInput(cents: number): string {
	const abs = Math.abs(cents);
	return `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Converts cents in an account's currency to the default currency with its manual rate. */
export function toDefault(cents: number, rate: number): number {
	return Math.round(cents * rate);
}

/** Expenses are stored negative, income positive. The user always types a positive amount. */
export function signedAmount(cents: number, isIncome: boolean): number {
	return isIncome ? Math.abs(cents) : -Math.abs(cents);
}
