export type DnssecStatus = 'valid' | 'invalid' | 'unsigned' | 'unknown'

export type MxRecord = {
  priority: number
  host: string
}

export type CaaRecord = {
  flags: number
  tag: string
  value: string
}

export type DkimRecord = {
  selector: string
  record: string
}

export type RdapInfo = {
  registrar?: string
  createdAt?: string
  expiresAt?: string
  ageDays?: number
  expiresDays?: number
  statuses: string[]
}

export type DomainReport = {
  input: string
  domain: string
  isPunycode: boolean
  hasMixedScript: boolean
  hasHiddenChars: boolean
  nxdomain: boolean
  a: string[]
  aaaa: string[]
  cname: string[]
  ns: string[]
  mx: MxRecord[]
  caa: CaaRecord[]
  ds: string[]
  dnssec: DnssecStatus
  spf?: string
  spfRecords: string[]
  spfAll?: string
  spfLookups: number
  dmarc?: string
  dmarcPolicy?: string
  dmarcPct?: number
  dmarcRua: boolean
  mtaSts?: string
  tlsRpt?: string
  bimi?: string
  nullMx: boolean
  dsWeak: boolean
  dkim: DkimRecord[]
  rdap?: RdapInfo
  queryErrors: string[]
}

type DohRecord = {
  name: string
  type: number
  TTL: number
  data: string
}

type DohResponse = {
  Status: number
  AD?: boolean
  Answer?: DohRecord[]
}

const DEFAULT_DKIM_SELECTORS = [
  'default',
  'google',
  'selector1',
  'selector2',
  'k1',
  'mail',
]

const RECORD_TYPES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  DS: 43,
  CAA: 257,
} as const

async function fetchDoh(
  name: string,
  type: keyof typeof RECORD_TYPES,
): Promise<DohResponse> {
  const urls = [
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  ]
  let lastError: unknown

  for (const url of urls) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)

    try {
      const response = await fetch(url, {
        headers: { accept: 'application/dns-json' },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = (await response.json()) as DohResponse
      if (data.Status === 2 || data.Status === 5) {
        throw new Error(`DNS status ${data.Status}`)
      }
      return data
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError ?? new Error('DNS query failed')
}

async function safeDoh(name: string, type: keyof typeof RECORD_TYPES) {
  try {
    return await fetchDoh(name, type)
  } catch {
    return undefined
  }
}

function records(response: DohResponse | undefined, type: number) {
  return (response?.Answer ?? []).filter((record) => record.type === type)
}

function stripDot(value: string) {
  return value.replace(/\.$/, '')
}

function cleanTxt(value: string) {
  return value.replace(/"\s+"/g, '').replace(/^"|"$/g, '')
}

function parseMx(data: string): MxRecord {
  const [priority, host = ''] = data.trim().split(/\s+/)
  return {
    priority: Number(priority) || 0,
    host: stripDot(host),
  }
}

function parseCaa(data: string): CaaRecord {
  const match = data.match(/^(\d+)\s+([a-z0-9]+)\s+"?([^"]*)"?$/i)
  if (!match) return { flags: 0, tag: '?', value: data }
  return {
    flags: Number(match[1]),
    tag: match[2].toLowerCase(),
    value: match[3],
  }
}

function getSpfAll(spf: string | undefined) {
  return spf?.match(/(^|\s)([+\-~?]all)(\s|$)/i)?.[2].toLowerCase()
}

function getDmarcPolicy(dmarc: string | undefined) {
  return dmarc
    ?.match(/\bp\s*=\s*(none|quarantine|reject)\b/i)?.[1]
    .toLowerCase()
}

async function checkDkim(
  domain: string,
  selectors: string[],
): Promise<DkimRecord[]> {
  const results = await Promise.all(
    selectors.map(async (selector) => {
      const response = await safeDoh(
        `${selector}._domainkey.${domain}`,
        'TXT',
      )
      const record = records(response, RECORD_TYPES.TXT)
        .map((item) => cleanTxt(item.data))
        .find((value) => /\bp\s*=\s*[^;\s]+/i.test(value))

      return record ? { selector, record } : null
    }),
  )

  return results.filter((result): result is DkimRecord => Boolean(result))
}

type RdapEvent = {
  eventAction?: string
  eventDate?: string
}

type VcardEntry = [string, unknown, string, unknown]

type RdapEntity = {
  roles?: string[]
  vcardArray?: [string, VcardEntry[]]
}

type RdapResponse = {
  events?: RdapEvent[]
  entities?: RdapEntity[]
  status?: string[]
}

async function fetchRdap(domain: string): Promise<RdapInfo | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(
      `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      {
        headers: { accept: 'application/rdap+json' },
        signal: controller.signal,
      },
    )
    if (!response.ok) return undefined

    const data = (await response.json()) as RdapResponse
    const events = data.events ?? []
    const getEvent = (action: string) =>
      events.find((event) => event.eventAction === action)?.eventDate

    const createdAt = getEvent('registration')
    const expiresAt = getEvent('expiration')
    const createdTime = createdAt ? Date.parse(createdAt) : Number.NaN
    const ageDays = Number.isFinite(createdTime)
      ? Math.max(0, Math.floor((Date.now() - createdTime) / 86_400_000))
      : undefined
    const expiresTime = expiresAt ? Date.parse(expiresAt) : Number.NaN
    const expiresDays = Number.isFinite(expiresTime)
      ? Math.floor((expiresTime - Date.now()) / 86_400_000)
      : undefined

    const registrarEntity = (data.entities ?? []).find((entity) =>
      entity.roles?.includes('registrar'),
    )
    const fn = registrarEntity?.vcardArray?.[1].find(
      (entry): entry is VcardEntry => Array.isArray(entry) && entry[0] === 'fn',
    )
    const registrar = typeof fn?.[3] === 'string' ? fn[3] : undefined

    return {
      registrar,
      createdAt,
      expiresAt,
      ageDays,
      expiresDays,
      statuses: data.status ?? [],
    }
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

export function normalizeDomain(input: string) {
  let value = input.trim()
  if (!value) return ''

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    try {
      value = new URL(value).hostname
    } catch {
      return ''
    }
  } else {
    value = value.split(/[/?#]/)[0]
  }

  value = stripDot(value.toLowerCase())

  try {
    value = new URL(`https://${value}`).hostname
  } catch {
    return ''
  }

  const labels = value.split('.')
  if (labels.length < 2) return ''
  if (labels.some((label) => label.length === 0 || label.length > 63)) {
    return ''
  }
  if (
    !labels.every((label) =>
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    return ''
  }

  return value
}

function analyzeInput(input: string) {
  const hasHiddenChars = /[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/.test(
    input,
  )
  const scripts = new Set<string>()

  for (const char of input.toLowerCase()) {
    const code = char.codePointAt(0) ?? 0
    if (code >= 0x0400 && code <= 0x04ff) scripts.add('cyrillic')
    else if (code >= 0x0370 && code <= 0x03ff) scripts.add('greek')
    else if (code >= 0x4e00 && code <= 0x9fff) scripts.add('han')
    else if (char >= 'a' && char <= 'z') scripts.add('latin')
  }

  return {
    hasHiddenChars,
    hasMixedScript:
      scripts.has('latin') &&
      (scripts.has('cyrillic') || scripts.has('greek')),
  }
}

export async function checkDomain(
  input: string,
  dkimSelector?: string,
): Promise<DomainReport> {
  const domain = normalizeDomain(input)
  if (!domain) throw new Error('invalid-domain')

  const { hasHiddenChars, hasMixedScript } = analyzeInput(input)
  const selectors = dkimSelector?.trim()
    ? [dkimSelector.trim().toLowerCase()]
    : DEFAULT_DKIM_SELECTORS

  const [a, aaaa, ns, cname, mx, txt, caa, ds, dmarcTxt] =
    await Promise.all([
      safeDoh(domain, 'A'),
      safeDoh(domain, 'AAAA'),
      safeDoh(domain, 'NS'),
      safeDoh(domain, 'CNAME'),
      safeDoh(domain, 'MX'),
      safeDoh(domain, 'TXT'),
      safeDoh(domain, 'CAA'),
      safeDoh(domain, 'DS'),
      safeDoh(`_dmarc.${domain}`, 'TXT'),
    ])

  if (!a && !aaaa && !cname) {
    throw new Error('dns-unavailable')
  }

  const aRecords = records(a, RECORD_TYPES.A).map((record) =>
    stripDot(record.data),
  )
  const aaaaRecords = records(aaaa, RECORD_TYPES.AAAA).map((record) =>
    stripDot(record.data),
  )
  const cnameRecords = records(cname, RECORD_TYPES.CNAME).map((record) =>
    stripDot(record.data),
  )
  const nsRecords = records(ns, RECORD_TYPES.NS).map((record) =>
    stripDot(record.data),
  )
  const rawMxRecords = records(mx, RECORD_TYPES.MX)
  const nullMx = rawMxRecords.some(
    (record) => record.data.trim().split(/\s+/)[1] === '.',
  )
  const mxRecords = rawMxRecords
    .filter((record) => record.data.trim().split(/\s+/)[1] !== '.')
    .map((record) => parseMx(record.data))
  const caaRecords = records(caa, RECORD_TYPES.CAA).map((record) =>
    parseCaa(record.data),
  )
  const dsRecords = records(ds, RECORD_TYPES.DS).map((record) => record.data)
  const dsWeak = dsRecords.some(
    (data) => data.trim().split(/\s+/)[2] === '1',
  )
  const txtRecords = records(txt, RECORD_TYPES.TXT).map((record) =>
    cleanTxt(record.data),
  )

  const spfRecords = txtRecords.filter((value) =>
    /^v=spf1(\s|$)/i.test(value),
  )
  const spf = spfRecords[0]
  const spfLookups = spf
    ? spf
        .split(/\s+/)
        .filter((term) =>
          /^(include:|a(?::|\/|$)|mx(?::|\/|$)|ptr(?::|$)|exists:|redirect=)/i.test(
            term,
          ),
        ).length
    : 0

  const dmarc = records(dmarcTxt, RECORD_TYPES.TXT)
    .map((record) => cleanTxt(record.data))
    .find((value) => /^v=DMARC1\s*;/i.test(value))
  const dmarcPctMatch = dmarc?.match(/\bpct\s*=\s*(\d+)/i)
  const dmarcPct = dmarcPctMatch ? Number(dmarcPctMatch[1]) : undefined
  const dmarcRua = Boolean(dmarc && /\brua\s*=/i.test(dmarc))

  const authenticated = Boolean(a?.AD || aaaa?.AD || ns?.AD)
  const dnssec: DnssecStatus = ds
    ? authenticated
      ? 'valid'
      : dsRecords.length
        ? 'invalid'
        : 'unsigned'
    : authenticated
      ? 'valid'
      : 'unknown'

  const nxdomain =
    (a?.Status === 3 || aaaa?.Status === 3) &&
    aRecords.length === 0 &&
    aaaaRecords.length === 0 &&
    cnameRecords.length === 0

  let rdap: RdapInfo | undefined
  let dkim: DkimRecord[] = []
  let mtaSts: string | undefined
  let tlsRpt: string | undefined
  let bimi: string | undefined
  if (!nxdomain) {
    const [rdapResult, dkimResult, mtaStsResult, tlsRptResult, bimiResult] =
      await Promise.all([
        fetchRdap(domain),
        checkDkim(domain, selectors),
        safeDoh(`_mta-sts.${domain}`, 'TXT'),
        safeDoh(`_smtp._tls.${domain}`, 'TXT'),
        safeDoh(`default._bimi.${domain}`, 'TXT'),
      ])
    rdap = rdapResult
    dkim = dkimResult

    const txtValues = (response: typeof mtaStsResult) =>
      records(response, RECORD_TYPES.TXT).map((record) =>
        cleanTxt(record.data),
      )
    mtaSts = txtValues(mtaStsResult).find((value) =>
      /^v=STSv1\b/i.test(value),
    )
    tlsRpt = txtValues(tlsRptResult).find((value) =>
      /^v=TLSRPTv1\b/i.test(value),
    )
    bimi = txtValues(bimiResult).find((value) => /^v=BIMI1\b/i.test(value))
  }

  const queryErrors = [
    ['A', a],
    ['AAAA', aaaa],
    ['NS', ns],
    ['CNAME', cname],
    ['MX', mx],
    ['TXT', txt],
    ['CAA', caa],
    ['DS', ds],
    ['DMARC', dmarcTxt],
  ]
    .filter(([, response]) => !response)
    .map(([name]) => String(name))

  return {
    input,
    domain,
    isPunycode: /(^|\.)xn--/.test(domain),
    hasMixedScript,
    hasHiddenChars,
    nxdomain,
    a: aRecords,
    aaaa: aaaaRecords,
    cname: cnameRecords,
    ns: nsRecords,
    mx: mxRecords,
    caa: caaRecords,
    ds: dsRecords,
    dsWeak,
    dnssec,
    spf,
    spfRecords,
    spfAll: getSpfAll(spf),
    spfLookups,
    dmarc,
    dmarcPolicy: getDmarcPolicy(dmarc),
    dmarcPct,
    dmarcRua,
    mtaSts,
    tlsRpt,
    bimi,
    nullMx,
    dkim,
    rdap,
    queryErrors,
  }
}
