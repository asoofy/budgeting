import { describe, expect, it } from 'vitest';
import { isCrossSiteWrite } from '#lib/csrf.ts';

const SELF = 'http://localhost:5173';
const check = (method: string, headers: Record<string, string> = {}, origin = SELF) =>
	isCrossSiteWrite(method, new Headers(headers), origin);

describe('isCrossSiteWrite', () => {
	it('never blocks reads', () => {
		for (const m of ['GET', 'HEAD', 'OPTIONS', 'get']) {
			expect(check(m, { 'sec-fetch-site': 'cross-site', origin: 'http://evil.example' })).toBe(false);
		}
	});

	it('blocks every kind of write from another site, whatever the content type', () => {
		for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
			expect(check(m, { 'sec-fetch-site': 'cross-site', origin: 'http://evil.example' })).toBe(true);
			expect(check(m, { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' })).toBe(true);
			expect(check(m, { 'sec-fetch-site': 'cross-site', 'content-type': 'text/plain' })).toBe(true);
		}
	});

	it('trusts Sec-Fetch-Site when the browser sends it', () => {
		expect(check('POST', { 'sec-fetch-site': 'same-origin', origin: SELF })).toBe(false);
		expect(check('POST', { 'sec-fetch-site': 'none' })).toBe(false);
		expect(check('POST', { 'sec-fetch-site': 'cross-site' })).toBe(true);
		// Another app on localhost (a different port) is "same-site" but still another origin.
		expect(check('POST', { 'sec-fetch-site': 'same-site', origin: 'http://localhost:3000' })).toBe(true);
	});

	it('falls back to an exact Origin match without Sec-Fetch-Site', () => {
		expect(check('POST', { origin: SELF })).toBe(false);
		expect(check('POST', { origin: 'http://evil.example' })).toBe(true);
		expect(check('POST', { origin: 'http://localhost:5174' })).toBe(true);
		expect(check('POST', { origin: 'https://localhost:5173' })).toBe(true);
		expect(check('POST', { origin: 'http://localhost:5173.evil.example' })).toBe(true);
	});

	it('refuses a write with a missing or null Origin', () => {
		expect(check('POST')).toBe(true);
		expect(check('POST', { origin: 'null' })).toBe(true);
		expect(check('POST', { origin: '' })).toBe(true);
	});

	it('works for a server reached by IP address', () => {
		expect(check('POST', { origin: 'http://192.168.1.20:5173' }, 'http://192.168.1.20:5173')).toBe(false);
		expect(check('POST', { origin: 'http://localhost:5173' }, 'http://192.168.1.20:5173')).toBe(true);
	});
});
