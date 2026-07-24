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
		// Busca o host no KV
		const gtgHost = (await env.GTG_KV.get(request.headers.get('host') as string)) + '.fps.goog'; // Ex: gtm-wrknvs.fps.goog
		const kvTime = Math.round(performance.now() - t0);

		// 1. MODIFICAÇÃO DO REQUEST
		const gtgUrl = new URL(request.url);
		gtgUrl.hostname = gtgHost;

		// Cria o novo request mantendo corpo, método e headers originais
		const newRequest = new Request(gtgUrl, request);

		// Extrai as variáveis do request.cf
		const cfCountry = request.cf?.country;
		const cfRegion = request.cf?.regionCode;
		const cfLatitude = request.cf?.latitude;
		const cfLongitude = request.cf?.longitude;
		const cfCity = request.cf?.city?.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
		if (cfCountry && cfRegion) {
			newRequest.headers.set('X-Forwarded-CountryRegion', `${cfCountry}-${cfRegion}`);
		}
		if (cfLatitude && cfLongitude && cfCity) {
			newRequest.headers.set('X-Forwarded-Geolocation', `latlong=${cfLatitude},${cfLongitude};city=${cfCity}`);
		}

		const response = await fetch(newRequest);

		// 2. MODIFICAÇÃO DO RESPONSE
		const newResponse = new Response(response.body, response);

		// Injeta o Server-Timing na resposta para debugar o tempo do KV
		newResponse.headers.append('Server-Timing', `kvTime;dur=${kvTime}`);

		return newResponse;
	},
} satisfies ExportedHandler<Env>;
