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

// Diagrama do fluxo: https://excalidraw.com/#json=G3Gb2bQtQYDbzT3KssEGC,1V0p4h8myX5Dt7wEN2wqYA

const GTG_PATH = '/gtg/'
const SGTM_PATH = '/sgtm/'
const BACKEND_PATH_MAP: Record<string, Record<string, string>> = {
	'cloudflare-worker.lcrespilh.us': {
		[GTG_PATH]: 'gtm-wrknvs.fps.goog',
		[SGTM_PATH]: 'gtmss-prod-804453080160.us-central1.run.app',
	},
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const reqUrl = new URL(request.url)
		const pathname = reqUrl.pathname
		const hostname = reqUrl.hostname

		if (pathname.startsWith(GTG_PATH)) {
			const gtgProxyHost = BACKEND_PATH_MAP[hostname][GTG_PATH] // Ex: "gtm-wrknvs.fps.goog"

			// Adiciona geolocalização na requisição para o GTG
			const newRequest: Request = getNewRequestWithGeoHeaders(gtgProxyHost, request)

			const t0 = performance.now()
			const response = await fetch(newRequest, { cf: getCachePolicy(request) })
			const gtgFetchTime = Math.round(performance.now() - t0)

			// Cópia do response para poder mutar os headers
			const newResponse = new Response(response.body, response)
			// Injeta o Server-Timing na resposta para debugar o tempo do GTG
			newResponse.headers.append('Server-Timing', `gtgFetchTime;dur=${gtgFetchTime}`)

			return newResponse
		} else if (pathname.startsWith(SGTM_PATH)) {
			const sgtmProxyHost = BACKEND_PATH_MAP[hostname][SGTM_PATH] // Ex: "gtmss-prod-804453080160.us-central1.run.app"

			// Adiciona geolocalização na requisição para o sGTM
			const newRequest: Request = getNewRequestWithGeoHeaders(sgtmProxyHost, request)

			const t0 = performance.now()
			const response = await fetch(newRequest)
			const sgtmFetchTime = Math.round(performance.now() - t0)

			// Cópia do response para poder mutar os headers
			const newResponse = new Response(response.body, response)
			// Injeta o Server-Timing na resposta para debugar o tempo do sGTM
			newResponse.headers.append('Server-Timing', `sgtmFetchTime;dur=${sgtmFetchTime}`)

			return newResponse
		} else {
			return new Response(`Erro: o path deve começar com ${GTG_PATH} ou ${SGTM_PATH}`, {
				status: 400,
				statusText: 'Bad Request',
			})
		}
	},
} satisfies ExportedHandler<Env>

/**
 * Infelizmente, o header "Cache-Control" não é amigável com CDN e vem trocado em algumas situações:
 *   - scripts GTM e GTAG: vem "private,max-age=900"; deveria ser "public,max-age=900"
 *   - rotas de saúde ?validate_geo=healthy e healthy: vem "public"; deveria ser "no-cache, no-store, must-revalidate"
 *   - o resto (SW GTG, SW + IFRAME SGTM, eventos e telemetria GTG e SGTM) vem correto
 * O parâmetro `cf` corrige o comportamento para o cache da Cloudflare.
 * @param {Request} request - requisição original
 */
function getCachePolicy(request: Request): CfProperties {
	const reqUrl = new URL(request.url)
	const pathname = reqUrl.pathname
	const query = reqUrl.search
	const reqUri = pathname + query + reqUrl.hash

	const cfCacheContainer = { cacheControl: 'public,max-age=900' } // 15min = default para o browser
	const cfCacheSw = { cacheControl: 'public,max-age=31536000' } // 1 ano = default para o browser
	const cfNoCache = { cacheControl: 'no-cache, no-store, must-revalidate' }

	const hasQuery = !!query

	// Possibilidades de requests para o GTG
	const isGtg = pathname.startsWith(GTG_PATH)
	const isGtgHealthy = reqUri.match(new RegExp(`^${GTG_PATH}(\\?validate_geo=healthy)?healthy$`))
	const isGtgContainer = isGtg && !isGtgHealthy && !hasQuery
	const isGtgSw = pathname.match(new RegExp(`^${GTG_PATH}_/service_worker/`))
	// const isGtgEventOrTelemetry = isGtg && hasQuery && !isGtgHealthy && !isGtgSw // desnecessário alterar o comportamento, pois já vem correto

	// Para a rota do SGTM não é necessário modificar o comportamento, pois ele envia o header "Cache-Control"
	// corretamente para todas as suas respostas: eventos, iframe do SW, SW e telemetria.

	return isGtgContainer ? cfCacheContainer : isGtgSw ? cfCacheSw : cfNoCache
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
	reqUrl.protocol = 'https:'
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
