import type { Handle } from '@sveltejs/kit/hooks';
import { isCrossSiteWrite } from '#lib/csrf.ts';
import { processRenewals } from '#lib/server/renewals.ts';

// No background scheduler: due subscriptions are logged on the next request after they come due.
export const handle: Handle = ({ event, resolve }) => {
	// SvelteKit's own cross-site check doesn't run on the dev server, so we do it here (see lib/csrf.ts).
	if (isCrossSiteWrite(event.request.method, event.request.headers, event.url.origin)) {
		return new Response('Cross-site requests are not allowed.', {
			status: 403,
			headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
		});
	}

	processRenewals();

	// Financial data and no login, so lock the browser down as far as it goes. The
	// Content-Security-Policy header is added by SvelteKit from the `csp` option in vite.config.ts.
	// Routes must not set these same headers themselves (SvelteKit throws if a header is set twice).
	event.setHeaders({
		'cache-control': 'no-store',
		'x-content-type-options': 'nosniff',
		'x-frame-options': 'DENY',
		'referrer-policy': 'no-referrer',
		'cross-origin-opener-policy': 'same-origin',
		'cross-origin-resource-policy': 'same-origin',
		'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
	});
	return resolve(event);
};
