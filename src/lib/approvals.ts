import {
  formatUnits,
  isAddress,
  maxUint256,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'

export const APPROVALS_CHAIN_ID = 56
export const APPROVALS_CHAIN_NAME = 'BNB Chain'
export const GOPLUS_APPROVALS_URL =
  'https://api.gopluslabs.io/api/v2/token_approval_security/56'

export const erc20ApprovalAbi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decreaseAllowance',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'subtractedValue', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

export type ApprovalErrorCode =
  | 'invalid'
  | 'network'
  | 'rate-limit'
  | 'api'

export class ApprovalError extends Error {
  code: ApprovalErrorCode

  constructor(code: ApprovalErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'ApprovalError'
    this.code = code
  }
}

export type ApprovalVerification = 'confirmed' | 'reverted' | 'skipped'

export type TokenApproval = {
  /** Stable `token:spender` key used for React rows and revoke state. */
  key: string
  token: Address
  symbol: string
  name: string
  decimals: number
  balance?: string
  spender: Address
  spenderName?: string
  spenderTag?: string
  amount: bigint
  unlimited: boolean
  approvedAt?: number
  txHash?: Hex
  spenderMalicious: boolean
  spenderDoubt: boolean
  spenderTrusted: boolean
  tokenMalicious: boolean
  tokenOpenSource: boolean | null
  verification: ApprovalVerification
  /** True when GoPlus omitted symbol or decimals and they still need a read. */
  metadataMissing: boolean
}

export type ApprovalScan = {
  owner: Address
  rows: TokenApproval[]
  /** GoPlus rows dropped because the on-chain allowance is already zero. */
  stale: number
  /** Whether the allowance multicall completed. */
  verifiedOnChain: boolean
  fetchedAt: number
}

type GoPlusAddressInfo = {
  contract_name?: string | null
  tag?: string | null
  is_contract?: number
  doubt_list?: number
  malicious_address?: number
  malicious_behavior?: string[] | null
  trust_list?: number
  is_open_source?: number
}

type GoPlusApproval = {
  approved_contract?: string
  approved_amount?: string
  approved_time?: number
  initial_approval_time?: number
  hash?: string
  initial_approval_hash?: string
  address_info?: GoPlusAddressInfo | null
}

type GoPlusToken = {
  token_address?: string
  token_name?: string
  token_symbol?: string
  decimals?: number | string
  balance?: string
  is_open_source?: number
  malicious_address?: number
  malicious_behavior?: string[] | null
  approved_list?: GoPlusApproval[] | null
}

type GoPlusResponse = {
  code?: number
  message?: string
  result?: GoPlusToken[] | null
}

const FETCH_TIMEOUT_MS = 15_000
const MULTICALL_CHUNK = 40

export function shortAddress(address: string, head = 6, tail = 4) {
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/**
 * Tokens such as BSC USDT decrement the allowance when it is spent, so an
 * "infinite" approval lands slightly below type(uint256).max. Treat anything
 * above half of max as unlimited.
 */
export function isUnlimitedAmount(amount: bigint) {
  return amount >= maxUint256 / 2n
}

function parseApprovedAmount(raw: string | undefined, decimals: number) {
  const value = (raw ?? '').trim()
  if (!value || /^(unlimited|infinite|max)$/i.test(value)) {
    return { amount: maxUint256, unlimited: true }
  }

  const safeDecimals =
    Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18

  // GoPlus reports finite approvals in token units (for example "100000000000"
  // for a token with 18 decimals), not in base units.
  try {
    const amount = parseUnits(value, safeDecimals)
    return { amount, unlimited: isUnlimitedAmount(amount) }
  } catch {
    try {
      const amount = BigInt(value)
      return { amount, unlimited: isUnlimitedAmount(amount) }
    } catch {
      // Keep the row visible instead of silently dropping it.
      return { amount: maxUint256, unlimited: true }
    }
  }
}

/** GoPlus often repeats the contract name in `tag`; drop that duplicate. */
function distinctTag(tag?: string | null, name?: string | null) {
  const value = tag?.trim()
  if (!value) return undefined
  if (name && value.toLowerCase() === name.trim().toLowerCase()) return undefined
  return value
}

function tokenSymbol(token: GoPlusToken, address: Address) {
  const symbol = token.token_symbol?.trim()
  return symbol || shortAddress(address)
}

export function normalizeApprovals(tokens: GoPlusToken[]): TokenApproval[] {
  const rows = new Map<string, TokenApproval>()

  for (const token of tokens) {
    const tokenAddress = token.token_address?.trim()
    if (!tokenAddress || !isAddress(tokenAddress)) continue

    const decimals = Number(token.decimals)
    const decimalsKnown = Number.isInteger(decimals) && decimals >= 0 && decimals <= 36
    const symbolKnown = Boolean(token.token_symbol?.trim())
    const tokenMalicious =
      token.malicious_address === 1 ||
      (token.malicious_behavior?.length ?? 0) > 0

    for (const approval of token.approved_list ?? []) {
      const spender = approval.approved_contract?.trim()
      if (!spender || !isAddress(spender)) continue

      const info = approval.address_info ?? {}
      const parsed = parseApprovedAmount(
        approval.approved_amount,
        decimalsKnown ? decimals : 18,
      )
      const key = `${tokenAddress.toLowerCase()}:${spender.toLowerCase()}`

      const row: TokenApproval = {
        key,
        token: tokenAddress as Address,
        symbol: tokenSymbol(token, tokenAddress as Address),
        name: token.token_name?.trim() ?? '',
        decimals: decimalsKnown ? decimals : 18,
        balance: formatTokenBalance(token.balance),
        spender: spender as Address,
        spenderName: info.contract_name?.trim() || undefined,
        spenderTag: distinctTag(info.tag, info.contract_name),
        amount: parsed.amount,
        unlimited: parsed.unlimited,
        approvedAt: approval.approved_time ?? approval.initial_approval_time,
        txHash: (approval.hash ?? approval.initial_approval_hash) as
          | Hex
          | undefined,
        spenderMalicious:
          info.malicious_address === 1 ||
          (info.malicious_behavior?.length ?? 0) > 0,
        spenderDoubt: info.doubt_list === 1,
        spenderTrusted: info.trust_list === 1,
        tokenMalicious,
        tokenOpenSource:
          token.is_open_source === 1
            ? true
            : token.is_open_source === 0
              ? false
              : null,
        verification: 'skipped',
        metadataMissing: !decimalsKnown || !symbolKnown,
      }

      const existing = rows.get(key)
      if (!existing || (row.approvedAt ?? 0) >= (existing.approvedAt ?? 0)) {
        rows.set(key, row)
      }
    }
  }

  return [...rows.values()]
}

export async function fetchGoPlusApprovals(
  owner: Address,
  signal?: AbortSignal,
): Promise<GoPlusToken[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort)

  try {
    const response = await fetch(
      `${GOPLUS_APPROVALS_URL}?addresses=${owner}`,
      {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      },
    )

    if (response.status === 429) throw new ApprovalError('rate-limit')
    if (!response.ok) {
      throw new ApprovalError(response.status >= 500 ? 'network' : 'api')
    }

    const payload = (await response.json()) as GoPlusResponse
    if (payload.code !== 1) {
      throw new ApprovalError(
        payload.code === 4029 ? 'rate-limit' : 'api',
        payload.message,
      )
    }
    return payload.result ?? []
  } catch (error) {
    if (error instanceof ApprovalError) throw error
    throw new ApprovalError('network')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

type AllowanceResult =
  | { status: 'success'; result: bigint }
  | { status: 'failure'; error: Error }

async function readAllowances(
  client: PublicClient,
  owner: Address,
  rows: TokenApproval[],
): Promise<Array<bigint | null>> {
  const allowances: Array<bigint | null> = []

  for (let start = 0; start < rows.length; start += MULTICALL_CHUNK) {
    const slice = rows.slice(start, start + MULTICALL_CHUNK)
    const results = (await client.multicall({
      contracts: slice.map((row) => ({
        address: row.token,
        abi: erc20ApprovalAbi,
        functionName: 'allowance' as const,
        args: [owner, row.spender] as const,
      })),
      allowFailure: true,
    })) as AllowanceResult[]

    for (const result of results) {
      allowances.push(
        result.status === 'success' ? (result.result as bigint) : null,
      )
    }
  }

  return allowances
}

async function backfillMetadata(
  client: PublicClient,
  rows: TokenApproval[],
): Promise<void> {
  const targets = new Map<string, Address>()
  for (const row of rows) {
    if (row.metadataMissing) targets.set(row.token.toLowerCase(), row.token)
  }
  if (targets.size === 0) return

  const tokens = [...targets.values()]
  for (let start = 0; start < tokens.length; start += MULTICALL_CHUNK) {
    const slice = tokens.slice(start, start + MULTICALL_CHUNK)
    const results = await client.multicall({
      contracts: slice.flatMap((address) => [
        {
          address,
          abi: erc20ApprovalAbi,
          functionName: 'symbol' as const,
        },
        {
          address,
          abi: erc20ApprovalAbi,
          functionName: 'decimals' as const,
        },
      ]),
      allowFailure: true,
    })

    const metadata = new Map<
      string,
      { symbol?: string; decimals?: number }
    >()

    slice.forEach((address, index) => {
      const symbolResult = results[index * 2]
      const decimalsResult = results[index * 2 + 1]
      const entry: { symbol?: string; decimals?: number } = {}

      if (
        symbolResult?.status === 'success' &&
        typeof symbolResult.result === 'string' &&
        symbolResult.result.trim()
      ) {
        entry.symbol = symbolResult.result.trim()
      }
      if (
        decimalsResult?.status === 'success' &&
        typeof decimalsResult.result === 'number'
      ) {
        entry.decimals = decimalsResult.result
      }
      metadata.set(address.toLowerCase(), entry)
    })

    for (const row of rows) {
      const entry = metadata.get(row.token.toLowerCase())
      if (!entry) continue
      if (entry.symbol) row.symbol = entry.symbol
      if (entry.decimals !== undefined) row.decimals = entry.decimals
    }
  }
}

export function riskScore(row: TokenApproval) {
  let score = 0
  if (row.spenderMalicious || row.tokenMalicious) score += 16
  if (row.spenderDoubt) score += 4
  if (row.unlimited) score += 8
  if (row.verification === 'reverted') score += 2
  if (row.spenderTrusted) score -= 1
  return score
}

export function isRiskyApproval(row: TokenApproval) {
  return (
    row.spenderMalicious ||
    row.tokenMalicious ||
    row.spenderDoubt ||
    row.verification === 'reverted'
  )
}

export function sortApprovals(rows: TokenApproval[]) {
  return [...rows].sort((a, b) => {
    const byScore = riskScore(b) - riskScore(a)
    if (byScore !== 0) return byScore
    const bySymbol = a.symbol.localeCompare(b.symbol)
    if (bySymbol !== 0) return bySymbol
    return a.spender.localeCompare(b.spender)
  })
}

export async function scanApprovals(
  client: PublicClient,
  owner: Address,
  signal?: AbortSignal,
): Promise<ApprovalScan> {
  const tokens = await fetchGoPlusApprovals(owner, signal)
  const normalized = normalizeApprovals(tokens)

  if (normalized.length === 0) {
    return {
      owner,
      rows: [],
      stale: 0,
      verifiedOnChain: true,
      fetchedAt: Date.now(),
    }
  }

  let allowances: Array<bigint | null> = normalized.map(() => null)
  let verifiedOnChain = true

  try {
    allowances = await readAllowances(client, owner, normalized)
  } catch {
    // The RPC may be rate limited. Keep the indexer values but flag them.
    verifiedOnChain = false
  }

  const rows: TokenApproval[] = []
  let stale = 0

  normalized.forEach((row, index) => {
    const allowance = allowances[index]

    if (allowance === null) {
      row.verification = verifiedOnChain ? 'reverted' : 'skipped'
      rows.push(row)
      return
    }

    if (allowance === 0n) {
      stale += 1
      return
    }

    row.verification = 'confirmed'
    row.amount = allowance
    row.unlimited = isUnlimitedAmount(allowance)
    rows.push(row)
  })

  if (rows.some((row) => row.metadataMissing)) {
    try {
      await backfillMetadata(client, rows)
    } catch {
      // Metadata is cosmetic; keep the GoPlus values.
    }
  }

  return {
    owner,
    rows: sortApprovals(rows),
    stale,
    verifiedOnChain,
    fetchedAt: Date.now(),
  }
}

function groupDigits(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * GoPlus reports balances as human-readable strings, sometimes in scientific
 * notation ("9.39E-16") for dust holdings. Normalise them for display.
 */
export function formatTokenBalance(raw?: string) {
  const value = raw?.trim()
  if (!value) return undefined

  const num = Number(value)
  if (!Number.isFinite(num)) return value
  if (num === 0) return '0'
  if (num < 0.000001) return '<0.000001'

  const fixed = num >= 1 ? num.toFixed(4) : num.toFixed(6)
  const trimmed = fixed.replace(/\.?0+$/, '') || '0'
  const [whole, fraction] = trimmed.split('.')
  return fraction ? `${groupDigits(whole)}.${fraction}` : groupDigits(whole)
}

export function formatTokenAmount(amount: bigint, decimals: number) {
  if (amount === 0n) return '0'
  const safeDecimals =
    Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18

  let formatted: string
  try {
    formatted = formatUnits(amount, safeDecimals)
  } catch {
    return groupDigits(amount.toString())
  }

  const [whole, fraction = ''] = formatted.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  if (!trimmed) return groupDigits(whole)

  const shown = trimmed.slice(0, 6)
  if (whole === '0' && /^0+$/.test(shown)) return '<0.000001'
  return `${groupDigits(whole)}.${shown}`
}

export function formatApprovalAmount(
  row: TokenApproval,
  unlimitedLabel = 'Unlimited',
) {
  if (row.unlimited) return unlimitedLabel
  return formatTokenAmount(row.amount, row.decimals)
}

export function formatApprovalDate(timestamp?: number) {
  if (!timestamp || !Number.isFinite(timestamp)) return undefined
  const date = new Date(timestamp * 1000)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10)
}

export async function readAllowance(
  client: PublicClient,
  owner: Address,
  row: TokenApproval,
) {
  return client.readContract({
    address: row.token,
    abi: erc20ApprovalAbi,
    functionName: 'allowance',
    args: [owner, row.spender],
  })
}

export type RevokeCall =
  | { functionName: 'approve'; args: readonly [Address, bigint] }
  | {
      functionName: 'decreaseAllowance'
      args: readonly [Address, bigint]
    }

/**
 * Prefer `approve(spender, 0)`. A few legacy tokens reject it, so fall back to
 * `decreaseAllowance(spender, current)` when the current amount is finite.
 */
export async function prepareRevoke(
  client: PublicClient,
  owner: Address,
  row: TokenApproval,
): Promise<RevokeCall> {
  try {
    await client.simulateContract({
      account: owner,
      address: row.token,
      abi: erc20ApprovalAbi,
      functionName: 'approve',
      args: [row.spender, 0n],
    })
    return { functionName: 'approve', args: [row.spender, 0n] }
  } catch (error) {
    if (row.unlimited || row.amount === 0n) throw error

    await client.simulateContract({
      account: owner,
      address: row.token,
      abi: erc20ApprovalAbi,
      functionName: 'decreaseAllowance',
      args: [row.spender, row.amount],
    })
    return {
      functionName: 'decreaseAllowance',
      args: [row.spender, row.amount],
    }
  }
}

export function withoutApproval(scan: ApprovalScan, key: string): ApprovalScan {
  return { ...scan, rows: scan.rows.filter((row) => row.key !== key) }
}

export function withUpdatedAllowance(
  scan: ApprovalScan,
  key: string,
  amount: bigint,
): ApprovalScan {
  return {
    ...scan,
    rows: scan.rows.map((row) =>
      row.key === key
        ? {
            ...row,
            amount,
            unlimited: isUnlimitedAmount(amount),
            verification: 'confirmed',
          }
        : row,
    ),
  }
}
