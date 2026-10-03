// Small CSV reader/writer (RFC 4180 quoting). Used in the browser for the import preview and on the server.

/** Picks the delimiter (comma, semicolon or tab) that appears most in the first line, ignoring quoted text. */
function detectDelimiter(text: string): string {
	const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
	let quoted = false;
	for (const ch of text) {
		if (ch === '"') quoted = !quoted;
		else if (!quoted && (ch === '\n' || ch === '\r')) break;
		else if (!quoted && ch in counts) counts[ch]++;
	}
	return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
}

/** Parses CSV text into rows of cells. Blank lines are dropped. */
export function parseCsv(input: string): string[][] {
	const text = input.replace(/^﻿/, '');
	const delimiter = detectDelimiter(text);
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;

	const endCell = () => {
		row.push(cell);
		cell = '';
	};
	const endRow = () => {
		endCell();
		if (row.some((c) => c.trim() !== '')) rows.push(row);
		row = [];
	};

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (ch === '"') {
				quoted = false;
			} else {
				cell += ch;
			}
		} else if (ch === '"') {
			quoted = true;
		} else if (ch === delimiter) {
			endCell();
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && text[i + 1] === '\n') i++;
			endRow();
		} else {
			cell += ch;
		}
	}
	if (cell !== '' || row.length > 0) endRow();
	return rows;
}

/**
 * Text that a spreadsheet would run as a formula gets a leading apostrophe. Use on free text
 * (notes, names) but not on numbers, which legitimately start with "-".
 */
export function safeText(value: string): string {
	return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Undoes safeText, so exporting and re-importing gives back the original text. */
export function unsafeText(value: string): string {
	return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function quote(value: string | number): string {
	const s = String(value);
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV text. Starts with a BOM so Excel reads non-English text (Arabic notes) correctly. */
export function toCsv(rows: (string | number)[][]): string {
	return '﻿' + rows.map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n';
}
