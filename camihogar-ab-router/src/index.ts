function sanitizeHeaders(headers: Headers): Headers {
  const newHeaders = new Headers(headers)
  const cd = newHeaders.get('content-disposition')
  if (cd) {
    const cleanCd = cd.replace(/;\s*filename\*=[^;]+/gi, '').trim()
    newHeaders.set('content-disposition', cleanCd)
    newHeaders.set('Access-Control-Expose-Headers', 'Content-Disposition')
  }
  return newHeaders
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url)
    const cookieHeader = request.headers.get('Cookie') || ''

    // Check query params for opt-in / opt-out
    const betaParam = url.searchParams.get('beta')

    let isV2 = false
    let setCookieHeader: string | null = null

    if (betaParam === '1') {
      isV2 = true
      // 1-year cookie for v2
      setCookieHeader = 'camihogar_version=v2; Path=/; Max-Age=31536000; SameSite=Lax; Secure'
    } else if (betaParam === '0') {
      isV2 = false
      // Clear cookie to revert to legacy v1
      setCookieHeader = 'camihogar_version=; Path=/; Max-Age=0; SameSite=Lax; Secure'
    } else {
      // Check existing cookie
      isV2 = cookieHeader.includes('camihogar_version=v2')
    }

    if (!isV2) {
      // Pass-through to legacy origin (RPi tunnel port 3000)
      const originResponse = await fetch(request)
      const newHeaders = sanitizeHeaders(originResponse.headers)
      if (setCookieHeader) {
        newHeaders.set('Set-Cookie', setCookieHeader)
      }
      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: newHeaders
      })
    }

    // User is on V2!
    // 1. API proxy to .NET 10 Modular Monolith (Same-Origin eliminating CORS preflights)
    if (url.pathname.startsWith('/api/')) {
      const apiTarget = new URL(request.url)
      apiTarget.hostname = 'ch-api-v2.verkku.com'
      apiTarget.protocol = 'https:'
      apiTarget.port = ''

      const apiHeaders = new Headers(request.headers)
      apiHeaders.set('Host', 'ch-api-v2.verkku.com')
      apiHeaders.set('X-Forwarded-Host', url.host)

      const apiRequest = new Request(apiTarget.toString(), {
        method: request.method,
        headers: apiHeaders,
        body: request.body,
        redirect: 'manual'
      })

      const apiResponse = await fetch(apiRequest)
      const resHeaders = sanitizeHeaders(apiResponse.headers)
      if (setCookieHeader) {
        resHeaders.set('Set-Cookie', setCookieHeader)
      }
      return new Response(apiResponse.body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: resHeaders
      })
    }

    // 2. SPA assets proxy to Cloudflare Pages: camihogar-v2.pages.dev
    const targetUrl = new URL(request.url)
    targetUrl.hostname = 'camihogar-v2.pages.dev'
    targetUrl.protocol = 'https:'
    targetUrl.port = ''

    const reqHeaders = new Headers(request.headers)
    reqHeaders.set('Host', 'camihogar-v2.pages.dev')
    reqHeaders.set('X-Forwarded-Host', url.host)

    const pagesRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: reqHeaders,
      body: request.body,
      redirect: 'manual'
    })

    const pagesResponse = await fetch(pagesRequest)
    const resHeaders = new Headers(pagesResponse.headers)

    if (setCookieHeader) {
      resHeaders.set('Set-Cookie', setCookieHeader)
    }

    return new Response(pagesResponse.body, {
      status: pagesResponse.status,
      statusText: pagesResponse.statusText,
      headers: resHeaders
    })
  }
}
