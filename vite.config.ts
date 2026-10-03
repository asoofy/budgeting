import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Logger, type Plugin } from 'vite';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Budgeting has no login, so say so loudly if the server is reachable from other machines (--host). */
function warnIfExposed(): Plugin {
	const warn = (host: string | boolean | undefined, logger: Logger) => {
		if (host === undefined || (typeof host === 'string' && LOOPBACK.has(host))) return;
		logger.warn(
			'\n  WARNING: Budgeting has no login. Bound to your network like this, anyone on it can read\n' +
				'  and change your financial data. Run it on localhost only. SECURITY.md lists safer ways to\n' +
				'  reach it from a phone.\n',
			{ timestamp: false }
		);
	};
	return {
		name: 'budgeting-warn-if-exposed',
		configureServer(server) {
			warn(server.config.server.host, server.config.logger);
		},
		configurePreviewServer(server) {
			warn(server.config.preview.host, server.config.logger);
		}
	};
}

export default defineConfig(({ command }) => ({
	plugins: [
		tailwindcss(),
		sveltekit({
			// Everything comes from this server: no CDNs, fonts, analytics or other third parties.
			// SvelteKit adds nonces for its own inline script. The Vite dev server also needs a WebSocket for hot reload.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					// 'unsafe-inline' is needed for style="width: 40%" on the progress bars.
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:'],
					'connect-src': command === 'serve' ? ['self', 'ws:'] : ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		}),
		warnIfExposed()
	]
}));
