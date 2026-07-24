/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

interface Env {
	GTG_KV: KVNamespace;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const t0 = performance.now();
		await env.GTG_KV.get('minha_chave');
		const tGet = Math.round(performance.now() - t0);
		const hostname = new URL(request.url).hostname;
		console.log('> hostname:', hostname);
		const headers = new Headers();
		headers.append('Server-Timing', `kvget;dur=${tGet}`);
		headers.append(
			'X-Forwarded-CountryRegion',
			request.cf?.country && request.cf?.regionCode ? `${request.cf?.country}-${request.cf?.regionCode}` : 'unknown',
		);
		headers.append('X-Forwarded-Country', request.cf?.country || 'unknown');
		headers.append('X-Forwarded-Region', request.cf?.regionCode || 'unknown');
		const city = (request.cf?.city || 'unknown').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
		headers.append('X-Forwarded-Geolocation', `latlong=${request.cf?.latitude},${request.cf?.longitude};city=${city}`);
		headers.append('X-Gclb-Country', request.cf?.country || 'unknown');
		headers.append('X-Gclb-Region', `${request.cf?.country}${request.cf?.regionCode}` || 'unknown');
		return new Response('Hello Worker!', { headers });
	},
} satisfies ExportedHandler<Env>;
