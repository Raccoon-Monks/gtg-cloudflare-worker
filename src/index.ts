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

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const reqUrl = new URL(request.url)
		const pathname = reqUrl.pathname
		const query = reqUrl.search
		const reqUri = pathname + query + reqUrl.hash

		// https://excalidraw.com/#json=UZP_BHJ9OPhhVBDMQXxne,nIvP4zsJG7QvDIH94P1xMg
		if (reqUrl.pathname.startsWith('/gtg/')) {
			const [gtgHostname, kvQueryTime] = await getGtgHostname(request, env) // Ex: ['gtm-wrknvs.fps.goog', 25]

			// muda a url de requisição
			reqUrl.hostname = gtgHostname

			// Adiciona geolocalização na requisição para o GTG
			const newRequest = new Request(reqUrl, request) // Cópia para poder modificar headers
			setGeoHeders(newRequest)

			const isHealthyRequest = reqUri.match(/^\/gtg\/(\?validate_geo=)?healthy$/) // saúde/healthy do GTG
			const isContainerRequest = !isHealthyRequest && !query // scripts GTM e GTAG

			// Para realizar cache dos scripts (GTM e GTAG) é necessário forçar (com `cf`),
			// porque o GTG responde os scripts com "Cache-Control: private,max-age=900".
			const cf: CfProperties = isContainerRequest
				? { cacheControl: 'public,max-age=900' } // aparentemente a Cloudflare precisa que max-age>14400
				: { cacheControl: 'no-cache, no-store, must-revalidate' }
			const t0 = performance.now()
			const response = await fetch(newRequest, { cf })
			const gtgFetchTime = Math.round(performance.now() - t0)

			// Cópia do response para poder mutar os headers
			const newResponse = new Response(response.body, response)

			// Injeta o Server-Timing na resposta para debugar o tempo do KV e do GTG
			newResponse.headers.append('Server-Timing', `kvQueryTime;dur=${kvQueryTime}, gtgFetchTime;dur=${gtgFetchTime}`)
			return newResponse
		} else {
			return new Response('Erro: o path deve começar com /gtg/', {
				status: 400,
				statusText: 'Bad Request',
			})
		}
	},
} satisfies ExportedHandler<Env>

/**
 * Adiciona headers de geolocalização para GTG e sGTM.
 * @param {Request<unknown, IncomingRequestCfProperties<unknown>>} newRequest
 */
function setGeoHeders(newRequest: Request<unknown, IncomingRequestCfProperties<unknown>>) {
	const cfCountry = newRequest.cf?.country
	const cfRegion = newRequest.cf?.regionCode
	const cfLatitude = newRequest.cf?.latitude
	const cfLongitude = newRequest.cf?.longitude
	const cfCity = newRequest.cf?.city?.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
	if (cfCountry && cfRegion) {
		newRequest.headers.set('X-Forwarded-CountryRegion', `${cfCountry}-${cfRegion}`)
		newRequest.headers.set('X-Gclb-Country', cfCountry)
		newRequest.headers.set('X-Gclb-Region', cfRegion)
	}
	if (cfLatitude && cfLongitude && cfCity) {
		newRequest.headers.set('X-Forwarded-Geolocation', `latlong=${cfLatitude},${cfLongitude};city=${cfCity}`)
	}
}

async function getGtgHostname(request: Request, env: Env): Promise<[string, number]> {
	const t0 = performance.now()
	// o namespace GTG_KV foi criado via comando:
	// - npx wrangler kv namespace create GTG_KV
	// e depois foi feito o bind em wrangler.jsonc na propriedade kv_namespaces:
	//    "kv_namespaces": [
	//        {
	//            "binding": "GTG_KV",
	//            "id": "02853256eacc435f87f77331df9e7faf",
	//            "remote": true
	//        }
	//    ]
	// https://developers.cloudflare.com/kv/get-started/#2-create-a-kv-namespace
	const gtgHost: string = (await env.GTG_KV.get(request.headers.get('host') as string)) + '.fps.goog' // Ex: gtm-wrknvs.fps.goog
	const kvQueryTime: number = Math.round(performance.now() - t0)
	return [gtgHost, kvQueryTime]
}
