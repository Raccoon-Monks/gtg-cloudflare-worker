# Geolocation Headers

## GTG

Para funcionamento correto do GTG, devemos fornecer a geolocalização do usuário utilizando headers. Existem 2 formas (prefiro a primeira):


```
X-Forwarded-Country = "BR"
X-Forwarded-Region = "SP"
X-Forwarded-Geolocation = "latlong={latitude},{longitude}; city={cidade}"
```

or

```
X-Forwarded-CountryRegion = "BR-SP"
X-Forwarded-Geolocation = "latlong={latitude},{longitude};city={cidade}"
```


## sGTM

[Enable region-specific behavior for tags](https://developers.google.com/tag-platform/tag-manager/server-side/enable-region-specific-settings)

Obs: para utilizar essa funcionalidade, é necessário ativa-la/implementa-la nas tags de GA4 do sGTM.

```
X-Gclb-Country = "BR"
X-Gclb-Region = "BRSP"
```

---
---

# Cache-Control Headers

Os servidores GTG e sGTM servem os seguintes tipos de recursos:

- scripts/containeres GTM e GTAG
- rotas de saúde
- service worker
- iframe (somente para sGTM) - relacionado com o service worker
- eventos (GA4, web-to-server, etc)
- telemetria


Detalhamento dos tipos de recursos e seus respectivos headers `Cache-Control`:

### GTG

| Recurso | Header Cache-Control | Status | Obs |
| :- | :- | :- | :- |
| [scripts/containers](https://gtm-wrknvs.fps.goog/gtg/) | private, max-age=900 | ❌ | Deveria ser `public, max-age=900` para permitir cache também na CDN. |
| [saúde](https://gtm-wrknvs.fps.goog/gtg/healthy) | não tem | ✅ | Idealmente deveria ser `no-cache, no-store, must-revalidate`, mas<br>sua ausência tem esse comportamento na maioria dos browsers e CDNs. |
| [service worker](https://gtm-wrknvs.fps.goog/gtg/_/service_worker/6920/sw.js?path=/gtg) | public, max-age=31536000 | ✅ | Perfeito. |
| [eventos](https://cloudflare-worker.lcrespilh.us/gtg/ag/g/c?v=2&tid=G-8EEVZD2KXM&gtm=45g92e6992v9182072196z872289496za20kzb72289496zd72289496&_p=1789118623567&_gaz=1&gcs=G1--&gcd=13l3l3R3l5l1&npa=0&dma=0&gdid=dY2Q5Yz&_eu=AAAAAGQC&_uip=%3A%3A&cid=1229109332.1783663376&fp=1&frm=0&pscdl=noapi&rcb=17&sr=2048x1280&uaa=arm&uab=64&uafvl=Google%2520Chrome%3B153.0.8010.37%7CNot_A%2520Brand%3B8.0.0.0%7CChromium%3B153.0.8010.37&uam=&uamb=0&uap=macOS&uapv=26.6.2&uaw=0&ul=en-us&ur=BR-SP&_gsid=REEPlSVCYMC9eq9l2hHdQvSGwnjIxGcHAw&gaf=2&_s=1&tag_exp=115938466~115938469~118897920~118897930~120213116~120385422~120469145~120469153&dr=&dl=https%3A%2F%2Fcloudflare-worker.lcrespilh.us%2Fgtg-cloudflare-worker.html&sid=1789118623&sct=245&seg=0&dt=Cloudflare%20Worker%20-%20GTG%20%2B%20sGTM&_tu=RA&en=page_view&_ss=1&gap.gtb=2&ep.tag_name=All%20Pages%20-%20Load%20-%20GA4%20Google%20Tag&ep.custom_timestamp=1789118623760&ep.custom_page_referrer=&ep.navigation_type=NAVIGATE&ep.document_visibility_state=visible&ep.document_has_focus=true&ep.is_in_iframe=false&ep.pageshow=false&epn.random=748680399&up.custom_client_id=GA1.1.1229109332.1783663376&up.last_active_date=20260911&tfd=594) | no-cache, no-store, must-revalidate | ✅ | Perfeito. |
| telemetria [/a](https://gtm-wrknvs.fps.goog/gtg/a?id=GTM-WRKNVS&v=3&t=t&pid=1108001264&gtm=45E92e6992v72289496za204zd72289496&cv=QUICK_PREVIEW&rv=6992&tc=39&tag_exp=115616985~115938466~115938468~118897920~118897930~120385423~120469145~120469153&es=1&e=*&eid=3951&u=AgAAAIAIAAAAAACIAAAAAEA&ut=Ag&h=Ag&tr=1cvt.1cvt.1cvt.1cvt.1cvt.1cvt.5cvt.5cvt.5cvt.5cvt.5cvt.5cvt&ti=2cvt.2cvt.2cvt.2cvt.2cvt.2cvt.2cvt.2cvt.2cvt.2cvt.2cvt.2cvt&z=0) | não tem | ✅ | Idealmente deveria ser `no-cache, no-store, must-revalidate`, mas<br>sua ausência tem esse comportamento na maioria dos browsers e CDNs. |
| telemetria [/td](https://gtm-wrknvs.fps.goog/gtg/td?id=GTM-WRKNVS&v=3&t=t&pid=1283975603&gtm=45E92e6992v72289496za204zd72289496&seq=1&exp=115616985~115938466~115938468~118897920~118897930~120385423~120469145~120469153&dl=cloudflare-worker.lcrespilh.us%2Fgtg-cloudflare-worker.html&tdp=GTM-WRKNVS;2289496;0;0;0&frm=0&rtg=2289496&slo=2&hlo=3&lst=1&bt=2&ct=0&mde=AW-328970781;0_1~DC-13876536;0_1&z=0) | no-cache, no-store, must-revalidate | ✅ | Perfeito. |


### sGTM

| Recurso | Header Cache-Control | Status | Obs |
| :- | :- | :- | :- |
| [scripts/containers](https://gtmss.louren.co.in/viVo5WJ/) | private, max-age=900 | ❌ | Deveria ser `public, max-age=900` para permitir cache também na CDN. |
| [saúde](https://gtmss.louren.co.in/healthy) | não tem | ✅ | Idealmente deveria ser `no-cache, no-store, must-revalidate`, mas<br>sua ausência tem esse comportamento na maioria dos browsers e CDNs. |
| [service worker](https://gtmss.louren.co.in/sgtm/_/service_worker/6920/sw.js?origin=https%3A%2F%2Fexample.com&path=/viVo5WJ) | public, max-age=604800 | ✅ | Perfeito. |
| [iframe SW](https://gtmss.louren.co.in/sgtm/_/service_worker/6920/sw_iframe.html?origin=https://example.com&1p=1&path=/viVo5WJ) | public, max-age=604800 | ✅ | Perfeito. |
| [eventos](https://gtmss.louren.co.in/sgtm/g/collect?v=2&tid=G-4Z970YCHQZ&gtm=45g92e6992v9182072196za20kzb72289496zd72289496xf4&_p=1789121397005&gcs=G1--&gcd=13l3l3R3l5l1&npa=0&dma=0&gdid=dY2Q5Yz.dNzQzZD&ecid=1355173377&_eu=AEAAAGQ&ae=a&cid=1229109332.1783663376&ec_mode=c&frm=0&pscdl=noapi&rcb=1&sr=3840x2160&uaa=arm&uab=64&uafvl=Google%2520Chrome%3B153.0.8010.37%7CNot_A%2520Brand%3B8.0.0.0%7CChromium%3B153.0.8010.37&uam=&uamb=0&uap=macOS&uapv=26.6.2&uaw=0&ul=en-us&ur=BR-SP&sst.rnd=126866843.1789121398&sst.etld=google.com.br&sst.tft=1789121397005&sst.sp=1&sst.em_event=1&sst.lpc=139756513&sst.navt=n&sst.ude=1&sst.sw_exp=1&gaf=2&_s=2&tag_exp=115938465~115938468~118897920~118897930~120213116~120385422~120469145~120469153~120474863~120912439&dr=https%3A%2F%2Fcloudflare-worker.lcrespilh.us%2Fgtg-cloudflare-worker.html%3Fserver_container_url%3Dhttps%3A%2F%2Fcloudflare-worker.lcrespilh.us%2Fsgtm%26disable_media&dl=https%3A%2F%2Fcloudflare-worker.lcrespilh.us%2Fgtg-cloudflare-worker.html%3Fserver_container_url%3Dhttps%3A%2F%2Fcloudflare-worker.lcrespilh.us%2Fsgtm%26disable_media&sid=1789121396&sct=248&seg=1&dt=Cloudflare+Worker+-+GTG+%2B+sGTM&_tu=RA&en=scroll&gap.sstd=1&gap.gtb=2&ep.tag_name=All+Pages+-+Load+-+GA4+Google+Tag&ep.custom_timestamp=REDACTED&ep.custom_page_referrer=https%3A%2F%2Fcloudflare-worker.lcrespilh.us%2Fgtg-cloudflare-worker.html%3Fserver_container_url%3Dhttps%3A%2F%2Fcloudflare-worker.lcrespilh.us%2Fsgtm%26disable_media&ep.navigation_type=NAVIGATE&ep.document_visibility_state=visible&ep.document_has_focus=true&ep.is_in_iframe=false&ep.pageshow=false&epn.random=81025922&epn.percent_scrolled=90&_et=6&ep.user_data._tag_mode=CODE&up.custom_client_id=GA1.1.1229109332.1783663376&up.is_bot=false&tfd=1659&richsstsse) | no-cache | ✅ | Perfeito. |

Com a finalidade de permitir cache dos scripts servidos pelo GTG, devemos modificar o header `Cache-Control` na camada de CDN. Dessa forma os scripts de containers (GTMs e GTAGs) ficam armazenados no cache da CDN e do browser do usuário final.

Regex que dá match somente com os scripts/containers quando servidos pelo GTG ou sGTM: `/\/(gtg|sgtm)\/(?!healthy)[a-zA-Z0-9-_]*$/`
