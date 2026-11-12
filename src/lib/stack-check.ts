const PROXY_ORIGIN = 'https://proxy.cors.dev/'
const MAX_SCRIPTS = 10
const MAX_EXTRA_SCRIPTS = 2
const MAX_ASSET_BYTES = 4_500_000

const ANALYTICS_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'googleadservices.com',
  'doubleclick.net',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'segment.com',
  'segment.io',
  'mixpanel.com',
  'amplitude.com',
  'clarity.ms',
  'sentry.io',
  'cloudflareinsights.com',
  'vercel-insights.com',
]

export type TechCategory =
  | 'framework'
  | 'ui'
  | 'build'
  | 'runtime'
  | 'library'
  | 'css'
  | 'platform'

export type Detection = {
  id: string
  name: string
  category: TechCategory
  version?: string
  confidence: 'high' | 'medium'
  evidence: string[]
}

export type AssetFetch = {
  url: string
  ok: boolean
  bytes: number
  status?: number
}

export type StackReport = {
  url: string
  title?: string
  htmlBytes: number
  scriptCount: number
  buildId?: string
  router?: 'app' | 'pages'
  detections: Detection[]
  assets: AssetFetch[]
  signals: Array<{ label: string; value: string }>
}

type FetchedText = {
  url: string
  text: string
  bytes: number
  headers: Record<string, string>
}

type AssetRef = {
  url: string
  priority: number
}

export function normalizeTarget(input: string): string | undefined {
  const raw = input.trim()
  if (!raw) return undefined

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return undefined
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined

  const host = url.hostname.toLowerCase()
  const privateHost =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (privateHost) return undefined

  url.hash = ''
  return url.toString()
}

function proxied(url: string) {
  return `${PROXY_ORIGIN}${url}`
}

function isAnalytics(hostname: string) {
  const host = hostname.toLowerCase()
  return ANALYTICS_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`),
  )
}

export function stackErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'timeout'
    return error.message
  }
  return String(error)
}

async function fetchText(
  url: string,
  signal: AbortSignal,
): Promise<FetchedText> {
  const res = await fetch(proxied(url), {
    signal,
    credentials: 'omit',
    headers: { accept: '*/*' },
  })

  if (!res.ok) {
    throw new Error(`http-${res.status}`)
  }

  const text = await res.text()
  const headers: Record<string, string> = {}
  const poweredBy = res.headers.get('x-powered-by')
  if (poweredBy) headers['x-powered-by'] = poweredBy
  return { url, text, bytes: text.length, headers }
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function collectAssets(html: string, base: string): AssetRef[] {
  const seen = new Map<string, AssetRef>()
  const baseUrl = new URL(base)

  const add = (raw: string | undefined) => {
    if (!raw) return
    const value = decodeEntities(raw.trim())
    if (!value || value.startsWith('data:') || value.startsWith('blob:')) return

    let url: URL
    try {
      url = new URL(value, baseUrl)
    } catch {
      return
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return
    if (url.origin === baseUrl.origin) {
      // same-origin assets are always fair game
    } else if (isAnalytics(url.hostname)) {
      return
    }

    const priority = url.pathname.includes('/_next/static/')
      ? 1
      : url.pathname.includes('/assets/') ||
          url.pathname.includes('/_app/') ||
          url.pathname.includes('/static/js/') ||
          url.pathname.includes('/_nuxt/')
        ? 2
        : 3

    seen.set(url.toString(), { url: url.toString(), priority })
  }

  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    add(match[1])
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0]
    const isModulePreload = /\brel\s*=\s*["']modulepreload["']/i.test(tag)
    const isScriptPreload =
      /\brel\s*=\s*["']preload["']/i.test(tag) &&
      /\bas\s*=\s*["']script["']/i.test(tag)
    if (!isModulePreload && !isScriptPreload) continue

    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
    add(href)
  }

  return [...seen.values()]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_SCRIPTS)
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor
        cursor += 1
        results[index] = await fn(items[index])
      }
    },
  )

  await Promise.all(workers)
  return results
}

function firstMatch(
  texts: string[],
  patterns: RegExp[],
): { value: string; index: number } | undefined {
  for (const [index, text] of texts.entries()) {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1]) return { value: match[1], index }
    }
  }
  return undefined
}

function detectNext(
  html: string,
  chunks: FetchedText[],
  htmlSignals: string[],
): Detection | undefined {
  const htmlHasNext =
    /\/_next\/static\//.test(html) ||
    /self\.__next_f/.test(html) ||
    /__NEXT_DATA__/.test(html) ||
    /id=["']__next["']/.test(html)

  const texts = chunks.map((chunk) => chunk.text)
  const version = firstMatch(texts, [
    /window\.next\s*=\s*\{[^}]*?version\s*:\s*["']([^"']+)["']/,
    /window\.next\s*=\s*\{[^}]*?["']version["']\s*:\s*["']([^"']+)["']/,
    /\bnext\.version\s*=\s*["']([^"']+)["']/,
  ])

  const appDir = texts.some((text) =>
    /window\.next\s*=\s*\{[^}]*appDir\s*:\s*(?:!0|true)/.test(text),
  )

  if (!htmlHasNext && !version) return undefined

  const evidence: string[] = []
  if (/self\.__next_f/.test(html)) evidence.push('内联 RSC flight 数据 (self.__next_f)')
  if (/__NEXT_DATA__/.test(html)) evidence.push('__NEXT_DATA__ 脚本')
  if (/\/_next\/static\//.test(html)) evidence.push('/_next/static/ 资源')
  if (appDir) evidence.push('window.next.appDir = true')
  if (version) evidence.push(`window.next.version = ${version.value}`)
  if (htmlSignals.some((signal) => signal.includes('x-powered-by: Next.js'))) {
    evidence.push('x-powered-by: Next.js')
  }

  return {
    id: 'nextjs',
    name: 'Next.js',
    category: 'framework',
    version: version?.value,
    confidence: 'high',
    evidence,
  }
}

function detectReact(
  html: string,
  chunks: FetchedText[],
  nextDetected: boolean,
): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const reactChunkIndex = texts.findIndex((text) =>
    /react-dom|ReactDOM|__REACT_DEVTOOLS_GLOBAL_HOOK__|react\.production/.test(text),
  )
  const htmlSignal =
    /data-reactroot/.test(html) ||
    /__REACT_DEVTOOLS_GLOBAL_HOOK__/.test(html) ||
    /id=["']__next["']/.test(html)

  if (reactChunkIndex < 0 && !htmlSignal && !nextDetected) return undefined

  const evidence: string[] = []
  if (reactChunkIndex >= 0) evidence.push('JS bundle 包含 react-dom')
  if (nextDetected) evidence.push('Next.js 运行时内置 React')

  let version: string | undefined
  for (const text of texts) {
    if (!/react-dom|ReactDOM|__REACT_DEVTOOLS_GLOBAL_HOOK__|react\.production/.test(text)) {
      continue
    }
    const match = firstMatch(
      [text],
      [
        /reconcilerVersion\s*:\s*["']([^"']+)["']/,
        /version\s*=\s*["'](1[89]\.\d+\.\d+[^"']*)["']/,
        /["'](1[89]\.\d+\.\d+(?:-[a-z0-9.-]+)?)["']/,
      ],
    )
    if (match?.value) {
      version = match.value
      evidence.push(`bundle version = ${version}`)
      break
    }
  }

  return {
    id: 'react',
    name: 'React',
    category: 'ui',
    version,
    confidence: version ? 'high' : nextDetected ? 'high' : 'medium',
    evidence,
  }
}

function detectVue(html: string, chunks: FetchedText[]): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const htmlSignal =
    /__VUE__/.test(html) || /\bdata-v-[0-9a-f]{6,}/.test(html) || /__vue__/.test(html)
  const chunkIndex = texts.findIndex((text) =>
    /createBaseVNode|__v_isRef|Vue\.version/.test(text),
  )

  if (!htmlSignal && chunkIndex < 0) return undefined

  const evidence: string[] = []
  if (htmlSignal) evidence.push('HTML 包含 Vue 标记')
  if (chunkIndex >= 0) evidence.push('JS bundle 包含 Vue 运行时')

  let version: string | undefined
  for (const text of texts) {
    if (!/createBaseVNode|__v_isRef|Vue\.version/.test(text)) continue
    version = firstMatch(
      [text],
      [
        /version\s*[:=]\s*["'`](3\.\d+\.\d+[^"'`]*)["'`]/,
        /["'`](3\.\d+\.\d+(?:-[a-z0-9.-]+)?)["'`]/,
      ],
    )?.value
    if (version) {
      evidence.push(`bundle version = ${version}`)
      break
    }
  }

  return {
    id: 'vue',
    name: 'Vue',
    category: 'ui',
    version,
    confidence: version ? 'high' : 'medium',
    evidence,
  }
}

function detectNuxt(html: string): Detection | undefined {
  const hasMarker =
    /\/_nuxt\//.test(html) ||
    /__NUXT__/.test(html) ||
    /id=["']__nuxt["']/.test(html) ||
    /nuxt-link/.test(html)

  if (!hasMarker) return undefined

  const evidence: string[] = []
  if (/\/_nuxt\//.test(html)) evidence.push('/_nuxt/ 构建资源')
  if (/__NUXT__/.test(html)) evidence.push('window.__NUXT__ 运行时')
  if (/id=["']__nuxt["']/.test(html)) evidence.push('#__nuxt 挂载点')

  return {
    id: 'nuxt',
    name: 'Nuxt',
    category: 'framework',
    confidence: 'high',
    evidence,
  }
}

function detectAngular(html: string, htmlSignals: string[]): Detection | undefined {
  const version =
    html.match(/\bng-version\s*=\s*["']([^"']+)["']/i)?.[1] ??
    htmlSignals
      .find((signal) => signal.startsWith('generator: Angular'))
      ?.replace('generator: Angular ', '')

  const hasMarker =
    Boolean(version) ||
    /ng-app|ng-controller|ng-version/.test(html) ||
    html.includes('@angular/core')

  if (!hasMarker) return undefined

  return {
    id: 'angular',
    name: 'Angular',
    category: 'framework',
    version,
    confidence: version ? 'high' : 'medium',
    evidence: version ? [`ng-version = ${version}`] : ['HTML 包含 Angular 标记'],
  }
}

function detectSvelte(
  html: string,
  chunks: FetchedText[],
): Detection[] {
  const texts = chunks.map((chunk) => chunk.text)
  const svelteKit =
    /__sveltekit_/.test(html) ||
    /data-sveltekit-/.test(html) ||
    /\/_app\/immutable\//.test(html)

  const svelte =
    svelteKit ||
    /__svelte/.test(html) ||
    texts.some((text) => /svelte\/internal|__svelte_meta/.test(text))

  if (!svelte) return []

  const result: Detection[] = []
  if (svelteKit) {
    result.push({
      id: 'sveltekit',
      name: 'SvelteKit',
      category: 'framework',
      confidence: 'high',
      evidence: ['HTML 包含 SvelteKit 标记'],
    })
  }

  result.push({
    id: 'svelte',
    name: 'Svelte',
    category: 'ui',
    confidence: svelteKit ? 'high' : 'medium',
    evidence: [
      svelteKit ? 'SvelteKit 内置 Svelte' : 'HTML 或 JS 包含 Svelte 标记',
    ],
  })
  return result
}

function detectAstro(html: string): Detection | undefined {
  const generator = html.match(
    /<meta\b[^>]*name=["']generator["'][^>]*content=["']Astro(?:\s+v?([\d.]+))?["']/i,
  )
  const hasMarker =
    Boolean(generator) ||
    /astro-island/.test(html) ||
    /data-astro-cid/.test(html) ||
    /astro:page-load/.test(html)

  if (!hasMarker) return undefined

  return {
    id: 'astro',
    name: 'Astro',
    category: 'framework',
    version: generator?.[1],
    confidence: generator?.[1] ? 'high' : 'medium',
    evidence: generator
      ? [`generator meta = Astro${generator[1] ? ` v${generator[1]}` : ''}`]
      : ['HTML 包含 astro-island / astro-cid 标记'],
  }
}

function detectRemix(html: string, chunks: FetchedText[]): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const hasMarker =
    /__remixContext/.test(html) ||
    /__remix/.test(html) ||
    texts.some((text) => /remix-run|remix\/router/.test(text))

  if (!hasMarker) return undefined

  return {
    id: 'remix',
    name: 'Remix',
    category: 'framework',
    confidence: 'high',
    evidence: ['HTML 包含 __remixContext 或 remix 运行时'],
  }
}

function detectGatsby(html: string): Detection | undefined {
  const generator = html.match(
    /<meta\b[^>]*name=["']generator["'][^>]*content=["']Gatsby(?:\s+v?([\d.]+))?["']/i,
  )
  const hasMarker =
    Boolean(generator) || /___gatsby/.test(html) || /\/page-data\//.test(html)

  if (!hasMarker) return undefined

  return {
    id: 'gatsby',
    name: 'Gatsby',
    category: 'framework',
    version: generator?.[1],
    confidence: generator?.[1] ? 'high' : 'medium',
    evidence: generator ? [`generator meta = Gatsby`] : ['HTML 包含 ___gatsby 标记'],
  }
}

function detectVite(
  html: string,
  chunks: FetchedText[],
): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const htmlSignal =
    !/\/_next\//.test(html) &&
    /<script\b[^>]*type=["']module["'][^>]*src=["'][^"']*\/assets\//.test(html)
  const chunkSignal = texts.some((text) => /__vite__|vite\/modulepreload/.test(text))

  if (!htmlSignal && !chunkSignal) return undefined

  const evidence: string[] = []
  if (htmlSignal) evidence.push('ES module 入口指向 /assets/ 哈希文件')
  if (chunkSignal) evidence.push('JS 包含 __vite__ 运行时标记')

  return {
    id: 'vite',
    name: 'Vite',
    category: 'build',
    confidence: chunkSignal ? 'high' : 'medium',
    evidence,
  }
}

function detectRolldown(html: string, chunks: FetchedText[]): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const hasMarker =
    /rolldown/i.test(html) || texts.some((text) => /rolldown/i.test(text))

  if (!hasMarker) return undefined

  return {
    id: 'rolldown',
    name: 'Rolldown',
    category: 'build',
    confidence: 'high',
    evidence: ['资源或运行时包含 rolldown'],
  }
}

function detectWebpack(chunks: FetchedText[]): Detection | undefined {
  const index = chunks.findIndex((chunk) =>
    /webpackChunk|__webpack_require__|webpackJsonp/.test(chunk.text),
  )
  if (index < 0) return undefined

  return {
    id: 'webpack',
    name: 'webpack',
    category: 'build',
    confidence: 'high',
    evidence: ['JS bundle 包含 webpack 运行时'],
  }
}

function detectJquery(html: string, chunks: FetchedText[]): Detection | undefined {
  const urlVersion = html.match(
    /jquery(?:-|\.|@|\/)(\d+\.\d+\.\d+)(?:\.min)?\.js/i,
  )?.[1]
  const texts = chunks.map((chunk) => chunk.text)
  const bundleVersion = firstMatch(texts, [
    /\bjquery\s*:\s*["'](\d+\.\d+\.\d+)["']/,
    /jQuery\.fn\.jquery\s*=\s*["'](\d+\.\d+\.\d+)["']/,
  ])?.value

  const hasMarker =
    Boolean(urlVersion) ||
    Boolean(bundleVersion) ||
    /jquery(?:\.min)?\.js/i.test(html) ||
    texts.some((text) => /jQuery\.fn\.jquery|jquery:"\d/.test(text))

  if (!hasMarker) return undefined

  const version = urlVersion ?? bundleVersion
  return {
    id: 'jquery',
    name: 'jQuery',
    category: 'library',
    version,
    confidence: version ? 'high' : 'medium',
    evidence: version ? [`jQuery ${version}`] : ['页面加载了 jQuery'],
  }
}

function detectBootstrap(html: string): Detection | undefined {
  const version =
    html.match(/bootstrap(?:@|\/|-)(\d+\.\d+\.\d+)/i)?.[1] ??
    html.match(/Bootstrap\s+v(\d+\.\d+\.\d+)/i)?.[1]
  const hasMarker =
    Boolean(version) ||
    /bootstrap(?:\.bundle)?(?:\.min)?\.(?:css|js)/i.test(html)

  if (!hasMarker) return undefined

  return {
    id: 'bootstrap',
    name: 'Bootstrap',
    category: 'css',
    version,
    confidence: version ? 'high' : 'medium',
    evidence: version ? [`Bootstrap ${version}`] : ['页面加载了 Bootstrap 资源'],
  }
}

function detectWordPress(html: string): Detection | undefined {
  const version = html.match(
    /<meta\b[^>]*name=["']generator["'][^>]*content=["']WordPress\s*([\d.]+)?["']/i,
  )?.[1]
  const hasMarker = /wp-content|wp-includes/.test(html)
  if (!hasMarker && !version) return undefined

  return {
    id: 'wordpress',
    name: 'WordPress',
    category: 'platform',
    version,
    confidence: 'high',
    evidence: hasMarker ? ['页面引用 wp-content / wp-includes'] : ['generator meta = WordPress'],
  }
}

function detectShopify(html: string): Detection | undefined {
  const hasMarker =
    /cdn\.shopify\.com/.test(html) || /Shopify\.theme/.test(html) || /shopify-section/.test(html)
  if (!hasMarker) return undefined

  return {
    id: 'shopify',
    name: 'Shopify',
    category: 'platform',
    confidence: 'high',
    evidence: ['页面包含 Shopify CDN / theme 标记'],
  }
}

function detectTailwind(css: string | undefined): Detection | undefined {
  if (!css) return undefined
  if (!/--tw-|tailwind/i.test(css)) return undefined

  return {
    id: 'tailwind',
    name: 'Tailwind CSS',
    category: 'css',
    confidence: 'high',
    evidence: ['CSS 包含 --tw-* 变量'],
  }
}

function pageTitle(html: string) {
  const raw = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  if (!raw) return undefined
  const text = decodeEntities(raw).replace(/\s+/g, ' ').trim()
  return text.slice(0, 160) || undefined
}

function generatorSignals(html: string) {
  const signals: string[] = []
  for (const match of html.matchAll(
    /<meta\b[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/gi,
  )) {
    signals.push(`generator: ${decodeEntities(match[1])}`)
  }
  return signals
}

function headerSignals(headers: Record<string, string>) {
  const signals: string[] = []
  const poweredBy = headers['x-powered-by']
  if (poweredBy) signals.push(`x-powered-by: ${poweredBy}`)
  return signals
}

function buildIdOf(html: string) {
  return (
    html.match(/"buildId"\s*:\s*"([^"]+)"/)?.[1] ??
    html.match(/\/_next\/static\/([^/"?]+)\/_buildManifest\.js/)?.[1]
  )
}

export async function checkStack(
  input: string,
  signal?: AbortSignal,
): Promise<StackReport> {
  const target = normalizeTarget(input)
  if (!target) throw new Error('invalid-url')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort)

  try {
    const page = await fetchText(target, controller.signal)
    const html = page.text
    const htmlSignals = [
      ...generatorSignals(html),
      ...headerSignals(page.headers),
    ]

    const assetRefs = collectAssets(html, target)
    const fetched = await mapLimit(assetRefs, 4, async (ref): Promise<FetchedText | undefined> => {
      try {
        const file = await fetchText(ref.url, controller.signal)
        if (file.bytes > MAX_ASSET_BYTES) return undefined
        return file
      } catch {
        return undefined
      }
    })

    const chunks = fetched.filter((item): item is FetchedText => Boolean(item))

    // React is often split into its own react-dom chunk referenced from the
    // entry bundle. Follow one level of those references.
    const seen = new Set(chunks.map((chunk) => chunk.url))
    const extraRefs: string[] = []
    for (const chunk of chunks) {
      const match = chunk.text.match(/(?:\.\/)?(react-dom[-\w]*\.js)/)
      if (!match) continue
      try {
        const url = new URL(match[1], chunk.url).toString()
        if (!seen.has(url) && extraRefs.length < MAX_EXTRA_SCRIPTS) {
          seen.add(url)
          extraRefs.push(url)
        }
      } catch {
        // ignore malformed references
      }
    }

    const extra = await mapLimit(extraRefs, 2, async (url) => {
      try {
        return await fetchText(url, controller.signal)
      } catch {
        return undefined
      }
    })
    for (const item of extra) {
      if (item) chunks.push(item)
    }

    const next = detectNext(html, chunks, htmlSignals)
    const detections: Detection[] = []

    if (next) detections.push(next)
    const react = detectReact(html, chunks, Boolean(next))
    if (react) detections.push(react)

    const nuxt = detectNuxt(html)
    if (nuxt) detections.push(nuxt)

    const vue = detectVue(html, chunks)
    if (vue) detections.push(vue)

    const angular = detectAngular(html, htmlSignals)
    if (angular) detections.push(angular)

    detections.push(...detectSvelte(html, chunks))

    const astro = detectAstro(html)
    if (astro) detections.push(astro)

    const remix = detectRemix(html, chunks)
    if (remix) detections.push(remix)

    const gatsby = detectGatsby(html)
    if (gatsby) detections.push(gatsby)

    const vite = detectVite(html, chunks)
    if (vite) detections.push(vite)

    const rolldown = detectRolldown(html, chunks)
    if (rolldown) detections.push(rolldown)

    const webpack = detectWebpack(chunks)
    if (webpack) detections.push(webpack)

    const jquery = detectJquery(html, chunks)
    if (jquery) detections.push(jquery)

    const bootstrap = detectBootstrap(html)
    if (bootstrap) detections.push(bootstrap)

    const wordpress = detectWordPress(html)
    if (wordpress) detections.push(wordpress)

    const shopify = detectShopify(html)
    if (shopify) detections.push(shopify)

    // Tailwind leaves a very distinctive signature in its generated CSS.
    const cssUrl = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => match[1])
      .find((href) => href && !href.startsWith('data:'))
    if (cssUrl) {
      try {
        const css = await fetchText(new URL(cssUrl, target).toString(), controller.signal)
        const tailwind = detectTailwind(css.text)
        if (tailwind) detections.push(tailwind)
      } catch {
        // CSS is a nice-to-have signal only
      }
    }

    const router = next
      ? /self\.__next_f/.test(html)
        ? 'app'
        : /__NEXT_DATA__/.test(html)
          ? 'pages'
          : /\/_next\/static\/chunks\/app\//.test(html)
            ? 'app'
            : undefined
      : undefined

    const assets: AssetFetch[] = [
      ...assetRefs.map((ref) => ({
        url: ref.url,
        ok: chunks.some((chunk) => chunk.url === ref.url),
        bytes: chunks.find((chunk) => chunk.url === ref.url)?.bytes ?? 0,
      })),
      ...extraRefs.map((url) => ({
        url,
        ok: chunks.some((chunk) => chunk.url === url),
        bytes: chunks.find((chunk) => chunk.url === url)?.bytes ?? 0,
      })),
    ]

    const signals = [
      { label: 'html', value: `${Math.round(page.bytes / 1024)} KB` },
      { label: 'scripts', value: String(assetRefs.length) },
      {
        label: 'analyzed',
        value: `${chunks.length} files · ${Math.round(
          chunks.reduce((sum, chunk) => sum + chunk.bytes, 0) / 1024,
        )} KB`,
      },
      ...htmlSignals.map((signal) => ({ label: 'meta', value: signal })),
    ]

    const buildId = buildIdOf(html)
    if (buildId) signals.push({ label: 'buildId', value: buildId })

    return {
      url: target,
      title: pageTitle(html),
      htmlBytes: page.bytes,
      scriptCount: assetRefs.length,
      buildId,
      router,
      detections,
      assets,
      signals,
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
