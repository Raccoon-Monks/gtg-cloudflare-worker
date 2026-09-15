/**
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
const GTG_UPSTREAM = 'gtm-wrknvs.fps.goog'
const SGTM_UPSTREAM = 'gtmss-prod-804453080160.us-central1.run.app'

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const reqUrl = new URL(request.url)
		const pathname = reqUrl.pathname

		if (!pathname.startsWith(GTG_PATH) && !pathname.startsWith(SGTM_PATH)) {
			return new Response(`Erro: o path deve começar com ${GTG_PATH} ou ${SGTM_PATH}`, {
				status: 400,
				statusText: 'Bad Request',
			})
		}

		const upstreamRequest: Request = buildUpstreamRequest(request)
		const edgeCacheOptions = resolveEdgeCacheOptions(request)
		const response = await fetch(upstreamRequest, { cf: edgeCacheOptions })

		if (edgeCacheOptions.cacheEverything) {
			// É script/container. O browser receberia "private, max-age=900". Não está errado, pois o browser fará
			// o cache localmente. Porém, quero indicar que o cache foi feito também na CDN/edge, e por isso altero
			// para "public, max-age=900".
			const newResponse = new Response(response.body, response)
			newResponse.headers.set('Cache-Control', `public, max-age=${edgeCacheOptions.cacheTtl}`)
			return newResponse
		} else {
			return response
		}
	},
} satisfies ExportedHandler<Env>

/**
 * Configura as políticas de Edge Cache da Cloudflare para subrequisições:
 * - Containers/scripts: força cache na CDN (`cacheEverything`) com TTL customizado (`cacheTtl`).
 * - Demais rotas (saúde, eventos, SW, iframe-SW e telemetria): mantém o comportamento padrão da origem.
 *
 * @param {Request} request - Requisição original
 */
function resolveEdgeCacheOptions(request: Request): RequestInitCfProperties {
	const reqUrl = new URL(request.url)
	const reqUri = reqUrl.pathname + reqUrl.search + reqUrl.hash
	const reContainers = /\/(gtg|sgtm)\/(?!healthy)[a-zA-Z0-9-_]*$/ // só dá match com scripts/containers em produção
	const cfCacheContainer: RequestInitCfProperties = { cacheTtl: 900, cacheEverything: true } // 900s = 15min = default para o browser
	return reContainers.test(reqUri) ? cfCacheContainer : {}
}

/**
 * Constrói a requisição upstream reescrevendo o hostname de destino e enriquecendo-a
 * com os cabeçalhos de geolocalização (`X-Forwarded-*` / `X-Gclb-*`) providos pela Cloudflare.
 *
 * @param {Request<unknown, IncomingRequestCfProperties<unknown>>} request - Requisição original
 */
function buildUpstreamRequest(request: Request<unknown, IncomingRequestCfProperties<unknown>>) {
	const requestUrl = new URL(request.url)
	const requestPathname = requestUrl.pathname
	// Reescreve o upstream de destino
	requestUrl.hostname = requestPathname.startsWith(GTG_PATH) ? GTG_UPSTREAM : SGTM_UPSTREAM
	requestUrl.protocol = 'https:'
	requestUrl.port = ''
	const newRequest = new Request(requestUrl, request)
	const cfCountry = newRequest.cf?.country
	const cfRegion = newRequest.cf?.regionCode
	const cfLatitude = newRequest.cf?.latitude
	const cfLongitude = newRequest.cf?.longitude
	const cfCity = newRequest.cf?.city?.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
	// Enriquece com cabeçalhos de geolocalização
	if (cfCountry) {
		newRequest.headers.set('X-Forwarded-Country', cfCountry) // Ex: "BR"
		newRequest.headers.set('X-Gclb-Country', cfCountry) // Ex: "BR"
	}
	if (cfRegion) {
		newRequest.headers.set('X-Forwarded-Region', cfRegion) // Ex: "SP"
		newRequest.headers.set('X-Gclb-Region', `${cfCountry}${cfRegion}`) // Ex: "BRSP"
	}
	if (cfLatitude && cfLongitude && cfCity) {
		newRequest.headers.set('X-Forwarded-Geolocation', `latlong=${cfLatitude},${cfLongitude};city=${cfCity}`) // Ex: "latlong=22.8047,-45.0825;city=Sao Paulo"
	}
	return newRequest
}
