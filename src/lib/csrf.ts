// Cross-site request forgery guard. SvelteKit has its own, but it is switched off while the Vite dev
// server runs (`if (!__SVELTEKIT_DEV__)` in its respond.js), and this app runs on the dev server.
// Without a guard, any web page you have open could submit a hidden form to localhost and delete
// or overwrite your data.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * True if a request that changes data came from another site and must be rejected.
 * Applies to every non-read method and every content type, so no endpoint can be forgotten.
 *
 * Modern browsers say where a request came from in `Sec-Fetch-Site`; `same-site` (another port on
 * localhost, say) counts as another site. Without that header, the `Origin` header must match this
 * server exactly. A missing or "null" Origin is refused too: browsers always send one on form posts.
 */
export function isCrossSiteWrite(method: string, headers: Headers, urlOrigin: string): boolean {
	if (SAFE_METHODS.has(method.toUpperCase())) return false;

	const site = headers.get('sec-fetch-site');
	if (site !== null) return site !== 'same-origin' && site !== 'none';

	return headers.get('origin') !== urlOrigin;
}
