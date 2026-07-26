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
		const pathname = new URL(request.url).pathname

		// https://excalidraw.com/#json=UZP_BHJ9OPhhVBDMQXxne,nIvP4zsJG7QvDIH94P1xMg
		if (pathname.startsWith('/gtg/')) {
			const gtgProxyHost = getBackendHost(request) // Ex: gtm-wrknvs.fps.goog, gtmss-prod-804453080160.us-central1.run.app

			// Adiciona geolocalização na requisição para o GTG
			const newRequest: Request = getNewRequestWithGeoHeaders(gtgProxyHost, request)

			// Para realizar cache dos scripts (GTM e GTAG) é necessário forçar (via objeto `cf`), porque o GTG responde os
			// scripts de containers com "Cache-Control: private,max-age=900". E não devemos realizar cache para o resto.
			// O GTG responde o "Cache-Control: no-cache, no-store, must-revalidate" corretamente para eventos, porém não
			// entrega o header "Cache-Control" para as rotas de saúde. O objeto `cf` nos permite modificar o comportamento
			// do cache da Cloudflare de forma programática.
			const cf: CfProperties = isContainerRequest(request)
				? { cacheControl: 'public,max-age=900' } // forçar cache para scripts
				: { cacheControl: 'no-cache, no-store, must-revalidate' } // proibir cache para o resto
			const t0 = performance.now()
			const response = await fetch(newRequest, { cf })
			const gtgFetchTime = Math.round(performance.now() - t0)

			// Cópia do response para poder mutar os headers
			const newResponse = new Response(response.body, response)

			// Injeta o Server-Timing na resposta para debugar o tempo do GTG
			newResponse.headers.append('Server-Timing', `gtgFetchTime;dur=${gtgFetchTime}`)
			return newResponse
		} else if (pathname.startsWith('/sgtm/')) {
			return new Response('Path /sgtm/ em manutenção', {
				status: 503,
				statusText: 'Service Unavailable',
			})
		} else {
			return new Response('Erro: o path deve começar com /gtg/', {
				status: 400,
				statusText: 'Bad Request',
			})
		}
	},
} satisfies ExportedHandler<Env>

/**
 * Verifica se a requisição é para um container GTM ou GTAG.
 * @param {Request} request - objeto request original
 * @returns {boolean} - true se for requisição para um container GTM ou GTAG
 */
function isContainerRequest(request: Request): boolean {
	const reqUrl = new URL(request.url)
	const pathname = reqUrl.pathname
	const query = reqUrl.search
	const reqUri = pathname + query + reqUrl.hash
	// health check do GTG
	const isHealthyRequest = reqUri.match(/^\/gtg\/(\?validate_geo=)?healthy$/)
	// scripts de containers do GTG não possuem query parameters
	const isContainerRequest = !isHealthyRequest && !query
	return isContainerRequest
}

/**
 * Retorna um novo objeto Request contendo headers de geolocalização para GTG e sGTM.
 * É necessário criar um novo objeto Request, pois o original é imutável.
 * @param {string} backendHost - nova url da requisição
 * @param {Request<unknown, IncomingRequestCfProperties<unknown>>} request - objeto request original
 */
function getNewRequestWithGeoHeaders(backendHost: string, request: Request<unknown, IncomingRequestCfProperties<unknown>>) {
	const reqUrl = new URL(request.url)
	reqUrl.hostname = backendHost
	const newRequest = new Request(reqUrl, request)
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
	return newRequest
}

/**
 * Retorna o hostname (sem o https://) do Backend/Origin com base no host e path da requisição.
 * @param {Request} request - requisição original
 * @returns {string}
 */
function getBackendHost(request: Request): string {
	const url = new URL(request.url)
	const host = url.hostname
	const path: string | undefined = url.pathname.match(/\/\w+\//)?.[0]
	if (!path) {
		throw new Error('Invalid path')
	}

	// O backend deve começar com "https://" obrigatoriamente
	const map: Record<string, Record<string, string>> = {
		'lcrespilho.com': {
			'/gtg/': 'gtm-wrknvs.fps.goog',
			'/sgtm/': 'gtmss-prod-804453080160.us-central1.run.app',
		},
	}
	return map[host][path]
}
