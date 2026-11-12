const PROXY_ORIGIN = 'https://proxy.cors.dev/'
const READER_ORIGIN = 'https://r.jina.ai/'
const MAX_SCRIPTS = 16
const MAX_EXTRA_SCRIPTS = 2
const MAX_READER_SCRIPTS = 3
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
  pkg?: string
}

export type VulnInfo = {
  id: string
  summary: string
  severity?: string
  url: string
}

export type VersionInfo = {
  id: string
  name: string
  pkg: string
  current: string
  latest?: string
  outdated: boolean
  majorBehind: boolean
  vulns: VulnInfo[]
}

export type ZeroWireItem = {
  id: string
  title: string
  link: string
  published?: string
  categories: string[]
  matched: string[]
}

export type ZeroWireReport = {
  url: string
  items: ZeroWireItem[]
}

export type ExposureEnv = {
  name: string
  value?: string
  fallback?: string
  source: string
}

export type ExposureSecret = {
  kind: string
  label: string
  severity: 'critical' | 'high' | 'public'
  preview: string
  value: string
  source: string
}

export type ExposureSensitive = {
  key: string
  preview: string
  value: string
  severity: 'critical' | 'high'
  source: string
}

export type SourceMapFinding = {
  url: string
  source: string
  status: 'exposed' | 'unverified'
  hasSourcesContent: boolean
}

export type ExposureReport = {
  envNames: ExposureEnv[]
  sensitive: ExposureSensitive[]
  sensitiveNames: Array<{ name: string; source: string }>
  secrets: ExposureSecret[]
  sourceMaps: SourceMapFinding[]
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
  via: 'proxy' | 'reader'
  detections: Detection[]
  versions: VersionInfo[]
  zeroWire: ZeroWireReport
  exposure: ExposureReport
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

function isPrivateHost(host: string) {
  return (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
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

  if (isPrivateHost(url.hostname.toLowerCase())) return undefined

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

/**
 * Some sites answer the proxy with an anti-bot challenge (empty 202/403).
 * The Reader API renders the page in a browser and is CORS-enabled, so it works
 * as a best-effort fallback. It returns HTML only; when the site also blocks
 * static chunks, the runtime scripts are recovered separately with fetchReaderScript.
 */
async function fetchViaReader(
  target: string,
  signal: AbortSignal,
): Promise<FetchedText> {
  const res = await fetch(`${READER_ORIGIN}${target}`, {
    signal,
    credentials: 'omit',
    headers: { 'X-Return-Format': 'html' },
  })
  if (!res.ok) throw new Error(`http-${res.status}`)

  const text = await res.text()
  if (!text || /^\s*\{\s*"data"\s*:\s*null/.test(text)) {
    throw new Error('reader-failed')
  }
  return { url: target, text, bytes: text.length, headers: {} }
}

/**
 * Reader returns the raw text of a JS asset when asked for text output. This is
 * the only way to read runtime chunks on sites whose assets are behind a
 * Cloudflare challenge, where window.next.version is otherwise browser-only.
 */
async function fetchReaderScript(
  url: string,
  signal: AbortSignal,
): Promise<FetchedText | undefined> {
  const probe = new AbortController()
  const timer = setTimeout(() => probe.abort(), 12_000)
  const relay = () => probe.abort()
  signal.addEventListener('abort', relay)

  try {
    const res = await fetch(`${READER_ORIGIN}${url}`, {
      signal: probe.signal,
      credentials: 'omit',
      headers: { 'X-Return-Format': 'text' },
    })
    if (!res.ok) return undefined

    const text = await res.text()
    if (!text || text.length < 128 || text.length > MAX_ASSET_BYTES) return undefined
    if (/^\s*\{\s*"data"\s*:\s*null/.test(text)) return undefined
    if (
      /Just a moment\.\.\.|Attention Required! \| Cloudflare/i.test(
        text.slice(0, 600),
      )
    ) {
      return undefined
    }
    if (!/[=;{}()]/.test(text)) return undefined
    return { url, text, bytes: text.length, headers: {} }
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', relay)
  }
}

function runtimeScriptScore(url: string) {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return 0
  }
  if (/\/main[.-][^/]*\.js$/.test(path)) return 1
  if (/\/framework[.-][^/]*\.js$/.test(path)) return 2
  if (/\/pages\/_app[.-][^/]*\.js$/.test(path) || /\/_app[.-][^/]*\.js$/.test(path)) {
    return 3
  }
  if (/\/webpack[.-][^/]*\.js$/.test(path)) return 4
  if (/\/runtime[.-][^/]*\.js$/.test(path)) return 5
  return 0
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
  const runtimeVersion = firstMatch(texts, [
    /window\.next\s*=\s*\{[^}]*?version\s*:\s*["']([^"']+)["']/,
    /window\.next\s*=\s*\{[^}]*?["']version["']\s*:\s*["']([^"']+)["']/,
    /\bnext\.version\s*=\s*["']([^"']+)["']/,
  ])
  const sentryVersion = runtimeVersion
    ? undefined
    : firstMatch(texts, [
        /globalThis\._sentryNextJsVersion\s*=\s*["']([^"']+)["']/,
      ])
  const version = runtimeVersion ?? sentryVersion

  const appDir = texts.some((text) =>
    /window\.next\s*=\s*\{[^}]*appDir\s*:\s*(?:!0|true)/.test(text),
  )

  if (!htmlHasNext && !version) return undefined

  const evidence: string[] = []
  if (/self\.__next_f/.test(html)) evidence.push('内联 RSC flight 数据 (self.__next_f)')
  if (/__NEXT_DATA__/.test(html)) evidence.push('__NEXT_DATA__ 脚本')
  if (/\/_next\/static\//.test(html)) evidence.push('/_next/static/ 资源')
  if (appDir) evidence.push('window.next.appDir = true')
  if (version) {
    evidence.push(
      runtimeVersion
        ? `window.next.version = ${version.value}`
        : `Sentry Next.js version = ${version.value}`,
    )
  }
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
    pkg: 'next',
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
    pkg: 'react',
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
    pkg: 'vue',
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
  const rawVersion =
    html.match(/\bng-version\s*=\s*["']([^"']+)["']/i)?.[1] ??
    htmlSignals
      .find((signal) => signal.startsWith('generator: Angular'))
      ?.replace('generator: Angular ', '')
  const version = rawVersion?.split('+')[0]

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
    pkg: '@angular/core',
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
    pkg: 'astro',
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
    pkg: 'gatsby',
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
    pkg: 'webpack',
  }
}

function detectSolid(html: string, chunks: FetchedText[]): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const htmlSignal = /\bdata-hk=/.test(html) || /solid-js/.test(html)
  const chunkIndex = texts.findIndex((text) => /solid-js/.test(text))
  if (!htmlSignal && chunkIndex < 0) return undefined

  let version: string | undefined
  for (const text of texts) {
    if (!/solid-js/.test(text)) continue
    version = firstMatch(
      [text],
      [
        /version\s*[:=]\s*["'`](1\.\d+\.\d+[^"'`]*)["'`]/,
        /["'`](1\.\d+\.\d+(?:-[a-z0-9.-]+)?)["'`]/,
      ],
    )?.value
    if (version) break
  }

  return {
    id: 'solid',
    name: 'Solid',
    category: 'ui',
    version,
    confidence: chunkIndex >= 0 ? 'high' : 'medium',
    evidence: htmlSignal ? ['HTML 包含 Solid 水合标记'] : ['JS bundle 包含 solid-js'],
    pkg: 'solid-js',
  }
}

function detectPreact(html: string, chunks: FetchedText[]): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const chunkIndex = texts.findIndex((text) =>
    /preact\/hooks|preact\/compat|__PREACT__/.test(text),
  )
  if (chunkIndex < 0 && !/__PREACT__/.test(html)) return undefined

  let version: string | undefined
  for (const text of texts) {
    if (!/preact/.test(text)) continue
    version = firstMatch(
      [text],
      [
        /version\s*[:=]\s*["'`](10\.\d+\.\d+[^"'`]*)["'`]/,
        /["'`](10\.\d+\.\d+(?:-[a-z0-9.-]+)?)["'`]/,
      ],
    )?.value
    if (version) break
  }

  return {
    id: 'preact',
    name: 'Preact',
    category: 'ui',
    version,
    confidence: 'high',
    evidence: ['JS bundle 包含 Preact 运行时'],
    pkg: 'preact',
  }
}

function detectAlpine(html: string, chunks: FetchedText[]): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const htmlSignal =
    /\bx-data\s*=/.test(html) ||
    /\bx-init\s*=/.test(html) ||
    /\bx-on:/.test(html)
  const chunkIndex = texts.findIndex((text) => /Alpine\.version|alpinejs/.test(text))
  if (!htmlSignal && chunkIndex < 0) return undefined

  let version: string | undefined
  for (const text of texts) {
    if (!/Alpine|alpinejs/.test(text)) continue
    version = firstMatch(
      [text],
      [
        /Alpine\.version\s*=\s*["'`](3\.\d+\.\d+[^"'`]*)["'`]/,
        /version\s*[:=]\s*["'`](3\.\d+\.\d+[^"'`]*)["'`]/,
      ],
    )?.value
    if (version) break
  }

  return {
    id: 'alpine',
    name: 'Alpine.js',
    category: 'ui',
    version,
    confidence: htmlSignal ? 'high' : 'medium',
    evidence: htmlSignal ? ['HTML 包含 x-data / x-init 指令'] : ['JS bundle 包含 Alpine'],
    pkg: 'alpinejs',
  }
}

function detectQwik(html: string, chunks: FetchedText[]): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const hasMarker =
    /q:container/.test(html) ||
    /q:version/.test(html) ||
    texts.some((text) => /qwik\/|@builder\.io\/qwik/.test(text))
  if (!hasMarker) return undefined

  const version = html.match(/\bq:version\s*=\s*["']([^"']+)["']/)?.[1]

  return {
    id: 'qwik',
    name: 'Qwik',
    category: 'framework',
    version,
    confidence: 'high',
    evidence: ['HTML 包含 q:container / q:version 标记'],
    pkg: '@builder.io/qwik',
  }
}

function detectEmber(html: string, chunks: FetchedText[]): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const hasMarker =
    /ember-view|data-ember-action/.test(html) ||
    texts.some((text) => /ember-source|Ember\.VERSION/.test(text))
  if (!hasMarker) return undefined

  let version: string | undefined
  for (const text of texts) {
    if (!/Ember|ember-source/.test(text)) continue
    version = firstMatch(
      [text],
      [/Ember\.VERSION\s*=\s*["'`]([\d.]+[^"'`]*)["'`]/],
    )?.value
    if (version) break
  }

  return {
    id: 'ember',
    name: 'Ember',
    category: 'framework',
    version,
    confidence: 'high',
    evidence: ['HTML 或 JS 包含 Ember 标记'],
    pkg: 'ember-source',
  }
}

function detectLit(html: string, chunks: FetchedText[]): Detection | undefined {
  const texts = chunks.map((chunk) => chunk.text)
  const hasMarker =
    /lit-html|lit-element|reactive-element/.test(html) ||
    texts.some((text) => /lit-html|lit-element|reactive-element/.test(text))
  if (!hasMarker) return undefined

  return {
    id: 'lit',
    name: 'Lit',
    category: 'ui',
    confidence: 'medium',
    evidence: ['JS bundle 包含 lit-html / lit-element'],
    pkg: 'lit',
  }
}

function detectCssInJs(chunks: FetchedText[]): Detection[] {
  const texts = chunks.map((chunk) => chunk.text)
  const result: Detection[] = []

  if (texts.some((text) => /styled-components/.test(text))) {
    result.push({
      id: 'styled-components',
      name: 'styled-components',
      category: 'css',
      confidence: 'medium',
      evidence: ['JS bundle 包含 styled-components'],
      pkg: 'styled-components',
    })
  }

  if (texts.some((text) => /@emotion\//.test(text))) {
    result.push({
      id: 'emotion',
      name: 'Emotion',
      category: 'css',
      confidence: 'medium',
      evidence: ['JS bundle 包含 @emotion'],
      pkg: '@emotion/react',
    })
  }

  return result
}

function detectGenerators(html: string): Detection[] {
  const known: Record<string, { id: string; category: TechCategory; pkg?: string }> = {
    vitepress: { id: 'vitepress', category: 'framework', pkg: 'vitepress' },
    docusaurus: { id: 'docusaurus', category: 'framework', pkg: '@docusaurus/core' },
    mkdocs: { id: 'mkdocs', category: 'platform' },
    hugo: { id: 'hugo', category: 'platform' },
    jekyll: { id: 'jekyll', category: 'platform' },
    ghost: { id: 'ghost', category: 'platform' },
  }

  const out: Detection[] = []
  for (const match of html.matchAll(
    /<meta\b[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/gi,
  )) {
    const content = decodeEntities(match[1]).trim()
    const parsed = content.match(/^([A-Za-z][\w .-]*?)(?:\s+v?(\d[\w.+-]*))?$/i)
    if (!parsed) continue
    const name = parsed[1].trim()
    const version = parsed[2]
    const meta = known[name.toLowerCase()]
    if (!meta) continue
    out.push({
      id: meta.id,
      name,
      category: meta.category,
      version,
      confidence: 'high',
      evidence: [`generator meta = ${content}`],
      pkg: meta.pkg,
    })
  }
  return out
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
    pkg: 'jquery',
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
    pkg: 'bootstrap',
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

function normalizeVersion(version: string | undefined) {
  if (!version) return undefined
  const cleaned = version.trim().replace(/^v/i, '').split('+')[0]
  return /^\d+\.\d+\.\d+$/.test(cleaned) ? cleaned : undefined
}

function compareVersions(a: string, b: string) {
  const left = a.split('.').map((part) => Number(part) || 0)
  const right = b.split('.').map((part) => Number(part) || 0)
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i] ?? 0
    const r = right[i] ?? 0
    if (l !== r) return l < r ? -1 : 1
  }
  return 0
}

const latestCache = new Map<string, string | null>()

async function fetchLatestVersion(pkg: string, signal: AbortSignal) {
  if (latestCache.has(pkg)) return latestCache.get(pkg) ?? undefined

  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`,
      { signal, credentials: 'omit' },
    )
    if (!res.ok) {
      latestCache.set(pkg, null)
      return undefined
    }
    const data = (await res.json()) as { version?: unknown }
    const version = typeof data.version === 'string' ? data.version : undefined
    latestCache.set(pkg, version ?? null)
    return version
  } catch {
    return undefined
  }
}

type OsvVuln = {
  id?: string
  summary?: string
  database_specific?: { severity?: string }
}

async function fetchVulns(
  pkg: string,
  version: string,
  signal: AbortSignal,
): Promise<VulnInfo[]> {
  try {
    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      signal,
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        package: { name: pkg, ecosystem: 'npm' },
        version,
      }),
    })
    if (!res.ok) return []

    const data = (await res.json()) as { vulns?: OsvVuln[] }
    return (data.vulns ?? []).slice(0, 6).map((vuln) => ({
      id: vuln.id ?? 'OSV',
      summary: vuln.summary ?? '',
      severity: vuln.database_specific?.severity,
      url: `https://osv.dev/vulnerability/${vuln.id ?? ''}`,
    }))
  } catch {
    return []
  }
}

const ZERO_WIRE_RSS = 'https://radar.cloudflare.com/security/zero-wire/rss'
const ZERO_WIRE_HOME = 'https://radar.cloudflare.com/security/zero-wire'

let zeroWireCache: { at: number; items: ZeroWireItem[] } | undefined

async function fetchZeroWire(signal: AbortSignal): Promise<ZeroWireItem[]> {
  if (zeroWireCache && Date.now() - zeroWireCache.at < 5 * 60_000) {
    return zeroWireCache.items
  }

  try {
    const res = await fetch(proxied(ZERO_WIRE_RSS), {
      signal,
      credentials: 'omit',
    })
    if (!res.ok) return []

    const xml = await res.text()
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    if (doc.querySelector('parsererror')) return []

    const items = [...doc.querySelectorAll('item')]
      .map((item, index) => {
        const title = item.querySelector('title')?.textContent?.trim() ?? ''
        const link = item.querySelector('link')?.textContent?.trim() ?? ''
        const published =
          item.querySelector('pubDate')?.textContent?.trim() || undefined
        const categories = [...item.querySelectorAll('category')]
          .map((category) => category.textContent?.trim() ?? '')
          .filter(Boolean)

        return {
          id: link || String(index),
          title,
          link,
          published,
          categories,
          matched: [],
        }
      })
      .filter((item) => item.title && item.link)

    zeroWireCache = { at: Date.now(), items }
    return items
  } catch {
    return []
  }
}

const ZERO_WIRE_ALIASES: Record<string, string[]> = {
  nextjs: ['next.js', 'nextjs'],
  react: ['react'],
  vue: ['vue'],
  nuxt: ['nuxt'],
  angular: ['angular'],
  svelte: ['svelte'],
  sveltekit: ['sveltekit'],
  astro: ['astro'],
  remix: ['remix'],
  gatsby: ['gatsby'],
  wordpress: ['wordpress'],
  shopify: ['shopify'],
  jquery: ['jquery'],
  bootstrap: ['bootstrap'],
  tailwind: ['tailwind'],
  vite: ['vite'],
  webpack: ['webpack'],
  solid: ['solid'],
  preact: ['preact'],
  alpine: ['alpine'],
  qwik: ['qwik'],
  ember: ['ember'],
  lit: ['lit'],
  vitepress: ['vitepress'],
  docusaurus: ['docusaurus'],
}

function hasAlias(haystack: string, alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack)
}

const ZERO_WIRE_TITLE_MATCH = new Set([
  'nextjs',
  'nuxt',
  'angular',
  'sveltekit',
  'astro',
  'remix',
  'gatsby',
  'wordpress',
  'shopify',
  'jquery',
  'bootstrap',
  'docusaurus',
  'vitepress',
  'ember',
  'qwik',
])

function matchZeroWire(
  items: ZeroWireItem[],
  detections: Detection[],
): ZeroWireItem[] {
  return items
    .map((item) => {
      const categories = item.categories.join(' ').toLowerCase()
      const withTitle = `${item.title} ${item.categories.join(' ')}`.toLowerCase()

      const matched = detections
        .filter((detection) => {
          const haystack = ZERO_WIRE_TITLE_MATCH.has(detection.id)
            ? withTitle
            : categories
          return (ZERO_WIRE_ALIASES[detection.id] ?? [
            detection.name.toLowerCase(),
          ]).some((alias) => hasAlias(haystack, alias.toLowerCase()))
        })
        .map((detection) => detection.name)

      return { ...item, matched: [...new Set(matched)] }
    })
    .filter((item) => item.matched.length > 0)
}

const ENV_NAME_SOURCE =
  'NEXT_PUBLIC_[A-Z0-9_]{2,}|VITE_[A-Z0-9_]{2,}|REACT_APP_[A-Z0-9_]{2,}|NUXT_PUBLIC_[A-Z0-9_]{2,}|EXPO_PUBLIC_[A-Z0-9_]{2,}|GATSBY_[A-Z0-9_]{2,}'

const SECRET_PATTERNS: Array<{
  kind: string
  label: string
  severity: ExposureSecret['severity']
  re: RegExp
}> = [
  {
    kind: 'private-key',
    label: 'Private key block',
    severity: 'critical',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]{20,}?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    kind: 'stripe-secret',
    label: 'Stripe secret key',
    severity: 'critical',
    re: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/g,
  },
  {
    kind: 'github-token',
    label: 'GitHub token',
    severity: 'critical',
    re: /\b(?:ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{40,})\b/g,
  },
  {
    kind: 'slack-token',
    label: 'Slack token',
    severity: 'critical',
    re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
  },
  {
    kind: 'sendgrid-key',
    label: 'SendGrid key',
    severity: 'critical',
    re: /\bSG\.[0-9A-Za-z_-]{16,}\.[0-9A-Za-z_-]{16,}\b/g,
  },
  {
    kind: 'anthropic-key',
    label: 'Anthropic API key',
    severity: 'critical',
    re: /\bsk-ant-[0-9A-Za-z_-]{20,}\b/g,
  },
  {
    kind: 'openai-key',
    label: 'OpenAI API key',
    severity: 'critical',
    re: /\bsk-proj-[0-9A-Za-z_-]{20,}\b/g,
  },
  {
    kind: 'aws-key',
    label: 'AWS access key ID',
    severity: 'high',
    re: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    kind: 'google-key',
    label: 'Google API key',
    severity: 'public',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    kind: 'stripe-pk',
    label: 'Stripe publishable key',
    severity: 'public',
    re: /\bpk_(?:live|test)_[0-9A-Za-z]{16,}\b/g,
  },
  {
    kind: 'mapbox-token',
    label: 'Mapbox token',
    severity: 'public',
    re: /\bpk\.[0-9A-Za-z]{20,}\b/g,
  },
]

const SENSITIVE_KEY_SOURCE =
  'site[_-]?password|admin[_-]?password|db[_-]?password|database[_-]?password|password|passwd|pwd|secret[_-]?key|client[_-]?secret|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|access[_-]?key|private[_-]?key|jwt[_-]?secret|encryption[_-]?key|signing[_-]?key|mnemonic|seed[_-]?phrase'

const SENSITIVE_NAME_SOURCE =
  '[A-Z][A-Z0-9]*_(?:PASSWORD|PASSWD|PWD|SECRET|TOKEN|API_KEY|ACCESS_KEY|PRIVATE_KEY|CLIENT_SECRET)'

const SENSITIVE_LABELS =
  /^(?:private key|public key|secret key|api key|access token|refresh token|password|passphrase|seed phrase|mnemonic|forgot password|change password|verify password|enter password|site password)$/i

function isSensitiveValue(value: string, key: string) {
  const trimmed = value.trim()
  if (trimmed.length < 4) return false
  if (trimmed.toLowerCase() === key.toLowerCase()) return false
  if (/^[*x•\s-]+$/i.test(trimmed)) return false
  if (/^%[^%]+%$/.test(trimmed)) return false
  if (/^\{\{[\s\S]*\}\}$/.test(trimmed)) return false
  if (/^\$\{[\s\S]*\}$/.test(trimmed)) return false
  if (/^<[\s\S]*>$/.test(trimmed)) return false
  if (SENSITIVE_LABELS.test(trimmed)) return false
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(trimmed)) return false
  if (
    /^(?:password|passwd|pwd|secret|token|changeme|placeholder|example|your[_-]?|请输入|密码|\*+)$/i.test(
      trimmed,
    )
  ) {
    return false
  }
  if (/^(?:true|false|null|undefined|none)$/i.test(trimmed)) return false
  return true
}

function maskValue(value: string) {
  const trimmed = value.trim()
  if (trimmed.length <= 8) return `${trimmed.slice(0, 1)}…`
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

function isPlaceholder(value: string) {
  return /xxxx|your[_-]?key|placeholder|changeme|example\.com|0000000000/i.test(
    value,
  )
}

function isRealPrivateKey(value: string) {
  const body = value
    .replace(/-----BEGIN[^-]+-----/, '')
    .replace(/-----END[^-]+-----/, '')
    .replace(/\s/g, '')
  return body.length >= 40 && /^[A-Za-z0-9+/=]+$/.test(body)
}

function scanExposure(html: string, chunks: FetchedText[]): ExposureReport {
  const sources = [
    { url: 'HTML', text: html },
    ...chunks.map((chunk) => ({ url: chunk.url, text: chunk.text })),
  ]

  const envMap = new Map<string, ExposureEnv>()
  const nameRe = new RegExp(`\\b(?:${ENV_NAME_SOURCE})\\b`, 'g')
  for (const source of sources) {
    for (const match of source.text.matchAll(nameRe)) {
      const name = match[0]
      if (!envMap.has(name)) {
        envMap.set(name, { name, source: source.url })
      }
    }
  }

  const valueRe = new RegExp(
    `["']?(${ENV_NAME_SOURCE})["']?\\s*[:=]\\s*["'\`]([^"'\`\\n]{1,200})["'\`]`,
    'g',
  )
  for (const source of sources) {
    for (const match of source.text.matchAll(valueRe)) {
      const name = match[1]
      const raw = match[2]
      if (!name || !raw) continue
      const existing = envMap.get(name)
      if (existing && !existing.value) {
        existing.value = raw.trim().slice(0, 200)
      }
    }
  }

  const fallbackRe = new RegExp(
    `(${ENV_NAME_SOURCE})\\s*(?:\\|\\||\\?\\?)\\s*["'\`]([^"'\`\\n]{1,200})["'\`]`,
    'g',
  )
  const fallbackCallRe = new RegExp(
    `(?:env\\.|\\.env\\.)(${ENV_NAME_SOURCE})\\s*,\\s*["'\`]([^"'\`\\n]{1,200})["'\`]`,
    'g',
  )
  for (const source of sources) {
    for (const re of [fallbackRe, fallbackCallRe]) {
      for (const match of source.text.matchAll(re)) {
        const name = match[1]
        const raw = match[2]
        if (!name || !raw) continue
        const existing = envMap.get(name)
        if (existing && !existing.fallback) {
          existing.fallback = raw.trim().slice(0, 200)
        }
      }
    }
  }

  const secrets: ExposureSecret[] = []
  const seen = new Set<string>()
  outer: for (const source of sources) {
    for (const pattern of SECRET_PATTERNS) {
      pattern.re.lastIndex = 0
      for (const match of source.text.matchAll(pattern.re)) {
        const raw = match[0]
        if (isPlaceholder(raw)) continue
        if (pattern.kind === 'private-key' && !isRealPrivateKey(raw)) continue
        const key = `${pattern.kind}:${raw}`
        if (seen.has(key)) continue
        seen.add(key)
        secrets.push({
          kind: pattern.kind,
          label: pattern.label,
          severity: pattern.severity,
          preview:
            pattern.kind === 'private-key'
              ? '-----BEGIN … PRIVATE KEY-----'
              : maskValue(raw),
          value: raw.slice(0, 4000),
          source: source.url,
        })
        if (secrets.length >= 8) break outer
      }
    }
  }

  const sensitive: ExposureSensitive[] = []
  const sensitiveSeen = new Set<string>()
  const sensitiveKeyRe = new RegExp(
    `["']?\\b(${SENSITIVE_KEY_SOURCE})\\b["']?\\s*[:=]\\s*["'\`]([^"'\`\\n]{3,200})["'\`]`,
    'gi',
  )
  sensitiveLoop: for (const source of sources) {
    for (const match of source.text.matchAll(sensitiveKeyRe)) {
      const key = match[1]
      const raw = match[2]
      if (!key || !raw) continue
      if (!isSensitiveValue(raw, key)) continue
      const dedupe = `${key.toLowerCase()}:${raw}`
      if (sensitiveSeen.has(dedupe)) continue
      sensitiveSeen.add(dedupe)
      sensitive.push({
        key,
        preview: maskValue(raw),
        value: raw.trim().slice(0, 200),
        severity:
          /private|mnemonic|seed|client[_-]?secret|jwt|secret[_-]?key|encryption|signing/i.test(
            key,
          )
            ? 'critical'
            : 'high',
        source: source.url,
      })
      if (sensitive.length >= 10) break sensitiveLoop
    }
  }

  const sensitiveNames: Array<{ name: string; source: string }> = []
  const seenNames = new Set<string>()
  const upperSensitiveRe = new RegExp(`\\b(?:${SENSITIVE_NAME_SOURCE})\\b`, 'g')

  for (const chunk of chunks) {
    for (const match of chunk.text.matchAll(upperSensitiveRe)) {
      const name = match[0]
      const lower = name.toLowerCase()
      if (seenNames.has(lower)) continue
      if (envMap.has(name)) continue
      if ([...sensitiveSeen].some((entry) => entry.startsWith(`${lower}:`))) {
        continue
      }
      seenNames.add(lower)
      sensitiveNames.push({ name, source: chunk.url })
      if (sensitiveNames.length >= 12) break
    }
    if (sensitiveNames.length >= 12) break
  }

  const sourceMaps: SourceMapFinding[] = []
  const seenMaps = new Set<string>()
  for (const chunk of chunks) {
    const match = chunk.text.match(/\/\/# sourceMappingURL=([^\s'"]+)/)
    if (!match) continue
    try {
      const url = new URL(match[1], chunk.url)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
      if (isPrivateHost(url.hostname.toLowerCase())) continue
      const value = url.toString()
      if (seenMaps.has(value)) continue
      seenMaps.add(value)
      sourceMaps.push({
        url: value,
        source: chunk.url,
        status: 'unverified',
        hasSourcesContent: false,
      })
    } catch {
      // ignore malformed source map references
    }
    if (sourceMaps.length >= 5) break
  }

  return {
    envNames: [...envMap.values()].slice(0, 24),
    sensitive,
    sensitiveNames,
    secrets,
    sourceMaps,
  }
}

async function readPrefix(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, maxBytes)

  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let total = 0
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      parts.push(value)
      total += value.byteLength
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.byteLength
  }
  return new TextDecoder().decode(merged)
}

/**
 * A sourceMappingURL in a production bundle is only a real exposure when the
 * .map file is actually reachable. Probe the first bytes and look for the
 * JSON map shape instead of downloading multi-megabyte files.
 */
async function verifySourceMaps(
  sourceMaps: SourceMapFinding[],
  signal: AbortSignal,
) {
  await mapLimit(sourceMaps.slice(0, 3), 2, async (map) => {
    const probe = new AbortController()
    const timer = setTimeout(() => probe.abort(), 6000)
    const relay = () => probe.abort()
    signal.addEventListener('abort', relay)
    try {
      const res = await fetch(proxied(map.url), {
        signal: probe.signal,
        credentials: 'omit',
        headers: { accept: '*/*' },
      })
      if (!res.ok) return
      const prefix = await readPrefix(res, 128 * 1024)
      if (!/^\s*\{/.test(prefix)) return
      if (!/"mappings"\s*:/.test(prefix) && !/"sources"\s*:/.test(prefix)) return
      map.status = 'exposed'
      map.hasSourcesContent = /"sourcesContent"\s*:\s*\[/.test(prefix)
    } catch {
      // keep 'unverified' when the proxy blocks or the request times out
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', relay)
    }
  })
}

export async function lookupVersion(
  name: string,
  pkg: string,
  version: string,
  signal?: AbortSignal,
): Promise<VersionInfo | undefined> {
  const current = normalizeVersion(version)
  if (!current) return undefined

  const requestSignal = signal ?? new AbortController().signal
  const [latest, vulns] = await Promise.all([
    fetchLatestVersion(pkg, requestSignal),
    fetchVulns(pkg, current, requestSignal),
  ])
  const outdated = Boolean(latest && compareVersions(current, latest) < 0)
  const majorBehind = Boolean(
    latest && Number(current.split('.')[0]) < Number(latest.split('.')[0]),
  )

  return {
    id: 'nextjs',
    name,
    pkg,
    current,
    latest,
    outdated,
    majorBehind,
    vulns,
  }
}

async function enrichVersions(
  detections: Detection[],
  signal: AbortSignal,
): Promise<VersionInfo[]> {
  const seen = new Set<string>()
  const targets = detections.filter((detection) => {
    if (!detection.pkg || !normalizeVersion(detection.version)) return false
    const key = `${detection.pkg}@${normalizeVersion(detection.version)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const results = await Promise.all(
    targets.map(async (detection): Promise<VersionInfo | undefined> => {
      const pkg = detection.pkg as string
      const current = normalizeVersion(detection.version) as string

      try {
        const [latest, vulns] = await Promise.all([
          fetchLatestVersion(pkg, signal),
          fetchVulns(pkg, current, signal),
        ])
        const outdated = Boolean(
          latest && compareVersions(current, latest) < 0,
        )
        const majorBehind = Boolean(
          latest &&
            Number(current.split('.')[0]) < Number(latest.split('.')[0]),
        )

        return {
          id: detection.id,
          name: detection.name,
          pkg,
          current,
          latest,
          outdated,
          majorBehind,
          vulns,
        }
      } catch {
        return undefined
      }
    }),
  )

  return results.filter((item): item is VersionInfo => Boolean(item))
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
    let page: FetchedText
    let via: 'proxy' | 'reader' = 'proxy'
    try {
      page = await fetchText(target, controller.signal)
      if (!page.bytes) throw new Error('empty-response')
    } catch {
      page = await fetchViaReader(target, controller.signal)
      via = 'reader'
    }
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

    // Cloudflare-protected sites often let Reader render the page but block
    // every JS chunk for the proxy. Recover a few runtime entry chunks through
    // Reader so the framework version is still detectable.
    const failedRefs = assetRefs.filter((_, index) => !fetched[index])
    if (via === 'reader' && failedRefs.length > 0) {
      const runtimeRefs = failedRefs
        .map((ref) => ({ ref, score: runtimeScriptScore(ref.url) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => a.score - b.score)
        .slice(0, MAX_READER_SCRIPTS)

      if (runtimeRefs.length > 0) {
        const recovered = await mapLimit(runtimeRefs, 2, async ({ ref }) =>
          fetchReaderScript(ref.url, controller.signal),
        )
        for (const item of recovered) {
          if (item) chunks.push(item)
        }
      }
    }

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

    const exposure = scanExposure(html, chunks)
    await verifySourceMaps(exposure.sourceMaps, controller.signal)

    const next = detectNext(html, chunks, htmlSignals)
    const detections: Detection[] = []

    if (next) detections.push(next)
    const react = detectReact(html, chunks, Boolean(next))
    if (react) detections.push(react)

    const nuxt = detectNuxt(html)
    if (nuxt) detections.push(nuxt)

    const vue = detectVue(html, chunks)
    if (vue) detections.push(vue)

    const solid = detectSolid(html, chunks)
    if (solid) detections.push(solid)

    const preact = detectPreact(html, chunks)
    if (preact) detections.push(preact)

    const alpine = detectAlpine(html, chunks)
    if (alpine) detections.push(alpine)

    const qwik = detectQwik(html, chunks)
    if (qwik) detections.push(qwik)

    const ember = detectEmber(html, chunks)
    if (ember) detections.push(ember)

    const lit = detectLit(html, chunks)
    if (lit) detections.push(lit)

    const angular = detectAngular(html, htmlSignals)
    if (angular) detections.push(angular)

    detections.push(...detectSvelte(html, chunks))

    const astro = detectAstro(html)
    if (astro) detections.push(astro)

    const remix = detectRemix(html, chunks)
    if (remix) detections.push(remix)

    const gatsby = detectGatsby(html)
    if (gatsby) detections.push(gatsby)

    detections.push(...detectGenerators(html))

    const vite = detectVite(html, chunks)
    if (vite) detections.push(vite)

    const rolldown = detectRolldown(html, chunks)
    if (rolldown) detections.push(rolldown)

    const webpack = detectWebpack(chunks)
    if (webpack) detections.push(webpack)

    detections.push(...detectCssInJs(chunks))

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
      {
        label: 'source',
        value: via === 'reader' ? 'Reader fallback (r.jina.ai)' : 'proxy.cors.dev',
      },
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

    const uniqueDetections = detections.filter(
      (detection, index, all) =>
        all.findIndex((item) => item.id === detection.id) === index,
    )

    // Version enrichment is best-effort: never let a slow registry or OSV
    // lookup hold up the stack report for long.
    const versionAbort = new AbortController()
    const versionTimer = setTimeout(() => versionAbort.abort(), 7000)
    const abortVersions = () => versionAbort.abort()
    controller.signal.addEventListener('abort', abortVersions)
    let versions: VersionInfo[] = []
    let zeroWireItems: ZeroWireItem[] = []
    try {
      ;[versions, zeroWireItems] = await Promise.all([
        enrichVersions(uniqueDetections, versionAbort.signal),
        fetchZeroWire(versionAbort.signal),
      ])
    } finally {
      clearTimeout(versionTimer)
      controller.signal.removeEventListener('abort', abortVersions)
    }
    const zeroWire: ZeroWireReport = {
      url: ZERO_WIRE_HOME,
      items: matchZeroWire(zeroWireItems, uniqueDetections),
    }

    return {
      url: target,
      title: pageTitle(html),
      htmlBytes: page.bytes,
      scriptCount: assetRefs.length,
      buildId,
      router,
      via,
      detections: uniqueDetections,
      versions,
      zeroWire,
      exposure,
      assets,
      signals,
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
