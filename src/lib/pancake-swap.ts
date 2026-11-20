import {
  concat,
  decodeFunctionResult,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddress,
  parseAbi,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'

/** PancakeSwap Infinity UniversalRouter on BNB Chain. */
export const UNIVERSAL_ROUTER_ADDRESS: Address =
  '0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB'
/** PancakeSwap infinity-periphery MixedQuoter on BNB Chain. */
export const MIXED_QUOTER_ADDRESS: Address =
  '0x2dCbF7B985c8C5C931818e4E107bAe8aaC8dAB7C'
/** Permit2 deployment used by the UniversalRouter on BNB Chain. */
export const PERMIT2_ADDRESS: Address =
  '0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768'
export const WBNB_ADDRESS: Address =
  '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
export const USDT_ADDRESS: Address =
  '0x55d398326f99059fF775485246999027B3197955'

export const SWAP_CHAIN_ID = 56

/** 48 Club MEV-protected BNB Chain RPC. Keeps transactions out of the public mempool. */
export const PRIVACY_RPC_URL = 'https://privacy.bsc-rpc.com'

/**
 * Chain definition for `wallet_addEthereumChain`. The name is distinct so
 * wallets that keep a separate entry per RPC show it apart from plain BSC.
 */
export const PRIVACY_BSC_CHAIN = defineChain({
  id: SWAP_CHAIN_ID,
  name: 'BNB Smart Chain (MEV Protect)',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: [PRIVACY_RPC_URL] } },
  blockExplorers: { default: { name: 'BscScan', url: 'https://bscscan.com' } },
})

/** PancakeSwap V3 fee tiers, in hundredths of a bip. */
export const V3_FEE_TIERS = [100, 500, 2500, 10000] as const

const MULTICALL3_ADDRESS: Address =
  '0xcA11bde05977b3631167028862bE2a173976CA11'

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
])

export { ERC20_ABI }

export const PERMIT2_ABI = parseAbi([
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
])

export const UNIVERSAL_ROUTER_ABI = parseAbi([
  'function execute(bytes commands, bytes[] inputs) payable',
])

const MIXED_QUOTER_ABI = parseAbi([
  'function quoteExactInputSingleV2((address tokenIn, address tokenOut, uint256 amountIn) params) returns (uint256 amountOut, uint256 gasEstimate)',
  'function quoteExactInputSingleV3((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

const MULTICALL3_ABI = parseAbi([
  'struct Call3 { address target; bool allowFailure; bytes callData; }',
  'function aggregate3(Call3[] calls) payable returns ((bool success, bytes returnData)[] returnData)',
])

export type SwapTokenInfo = {
  address: Address
  symbol: string
  name: string
  decimals: number
  native?: boolean
}

export const NATIVE_TOKEN: SwapTokenInfo = {
  address: zeroAddress,
  symbol: 'BNB',
  name: 'BNB',
  decimals: 18,
  native: true,
}

const token = (
  address: Address,
  symbol: string,
  name: string,
  decimals = 18,
): SwapTokenInfo => ({ address, symbol, name, decimals })

/** Common BNB Chain tokens. Any other ERC-20 can be added by address. */
export const BSC_TOKENS: SwapTokenInfo[] = [
  NATIVE_TOKEN,
  token(USDT_ADDRESS, 'USDT', 'Tether USD'),
  token(WBNB_ADDRESS, 'WBNB', 'Wrapped BNB'),
  token('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 'USDC', 'USD Coin'),
  token('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', 'BUSD', 'BUSD'),
  token('0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 'CAKE', 'PancakeSwap'),
  token('0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', 'BTCB', 'Bitcoin BEP20'),
  token('0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 'ETH', 'Ethereum Token'),
  token('0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409', 'FDUSD', 'First Digital USD'),
]

export function isNativeToken(address: Address) {
  return address.toLowerCase() === zeroAddress
}

/** The UniversalRouter wraps native BNB, so quotes and paths use WBNB. */
export function wrappedAddress(address: Address): Address {
  return isNativeToken(address) ? WBNB_ADDRESS : address
}

/** Chain names accepted in shareable `?chain=` links. The tool is BSC-only. */
const BSC_CHAIN_ALIASES = new Set([
  'bsc',
  'bnb',
  'bnb-chain',
  'bnbchain',
  '56',
  '0x38',
])

export function isBscChainParam(value: string | undefined) {
  if (!value) return true
  return BSC_CHAIN_ALIASES.has(value.trim().toLowerCase())
}

function tokenFromParam(value: string | undefined): Address | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (/^(bnb|native|0x0+)$/i.test(trimmed)) return zeroAddress
  if (!isAddress(trimmed, { strict: false })) return undefined
  return getAddress(trimmed)
}

export type SwapUrlState = {
  from?: Address
  to?: Address
  chainSupported: boolean
  invalidToken?: boolean
}

/**
 * Reads shareable swap links. Both compact pairs and explicit names work:
 * `?chain=bsc,bsc&token=0xabc,0xdef`
 * `?inputchain=bsc&outputchain=bsc&inputtoken=0xabc&outputtoken=0xdef`
 */
export function parseSwapUrl(search: string): SwapUrlState {
  const params = new URLSearchParams(search)
  const values = new Map<string, string>()
  for (const [key, value] of params.entries()) {
    values.set(key.toLowerCase(), value)
  }

  const chains = (values.get('chain') ?? '').split(',')
  const inputChain = values.get('inputchain') ?? chains[0]
  const outputChain = values.get('outputchain') ?? chains[1]
  if (!isBscChainParam(inputChain) || !isBscChainParam(outputChain)) {
    return { chainSupported: false }
  }

  const tokens = (values.get('token') ?? '').split(',')
  const rawFrom = values.get('inputtoken') ?? tokens[0]
  const rawTo = values.get('outputtoken') ?? tokens[1]
  const from = tokenFromParam(rawFrom)
  const to = tokenFromParam(rawTo)

  return {
    from,
    to,
    chainSupported: true,
    invalidToken:
      (Boolean(rawFrom) && !from) || (Boolean(rawTo) && !to),
  }
}

export type PoolRef = { kind: 'v2' } | { kind: 'v3'; fee: number }

export type QuoteCandidate = {
  pool: PoolRef
  amountOut: bigint
}

export type HopQuote = {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  amountOut: bigint
  pool: PoolRef
}

export type SwapRoute = {
  hops: HopQuote[]
  amountOut: bigint
}

type McResult =
  | { success: boolean; returnData: Hex }
  | readonly [boolean, Hex]

function decodeQuote(
  kind: PoolRef,
  data: Hex,
): bigint | undefined {
  try {
    if (kind.kind === 'v2') {
      const [amountOut] = decodeFunctionResult({
        abi: MIXED_QUOTER_ABI,
        functionName: 'quoteExactInputSingleV2',
        data,
      })
      return amountOut
    }
    const [amountOut] = decodeFunctionResult({
      abi: MIXED_QUOTER_ABI,
      functionName: 'quoteExactInputSingleV3',
      data,
    })
    return amountOut
  } catch {
    return undefined
  }
}

/** Every pool that is probed for each pair, in call-data order. */
const POOLS: PoolRef[] = [
  { kind: 'v2' },
  ...V3_FEE_TIERS.map((fee) => ({ kind: 'v3' as const, fee })),
]

type PairQuoteRequest = {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
}

function quoteCallData(pool: PoolRef, request: PairQuoteRequest): Hex {
  if (pool.kind === 'v2') {
    return encodeFunctionData({
      abi: MIXED_QUOTER_ABI,
      functionName: 'quoteExactInputSingleV2',
      args: [request],
    })
  }
  return encodeFunctionData({
    abi: MIXED_QUOTER_ABI,
    functionName: 'quoteExactInputSingleV3',
    args: [{ ...request, fee: pool.fee, sqrtPriceLimitX96: 0n }],
  })
}

/**
 * Quotes every requested pair in a single Multicall3 `aggregate3` call.
 * Results are returned in request order, each sorted best-first.
 */
async function quotePairs(
  client: PublicClient,
  requests: PairQuoteRequest[],
): Promise<QuoteCandidate[][]> {
  if (requests.length === 0) return []

  const calls = requests.flatMap((request) =>
    POOLS.map((pool) => ({
      target: MIXED_QUOTER_ADDRESS,
      allowFailure: true,
      callData: quoteCallData(pool, request),
    })),
  )

  const raw = await client.call({
    to: MULTICALL3_ADDRESS,
    data: encodeFunctionData({
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      args: [calls],
    }),
  })
  if (!raw.data) return requests.map(() => [])

  const decoded = decodeFunctionResult({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    data: raw.data,
  }) as readonly McResult[]

  const quotes: QuoteCandidate[][] = requests.map(() => [])
  decoded.forEach((result, index) => {
    const success =
      'success' in result ? result.success : result[0]
    const returnData =
      'returnData' in result ? result.returnData : result[1]
    if (!success) return
    const pool = POOLS[index % POOLS.length]
    const amountOut = decodeQuote(pool, returnData)
    if (amountOut === undefined || amountOut === 0n) return
    quotes[Math.floor(index / POOLS.length)].push({ pool, amountOut })
  })

  for (const pairQuotes of quotes) {
    pairQuotes.sort((a, b) =>
      a.amountOut === b.amountOut
        ? 0
        : a.amountOut > b.amountOut
          ? -1
          : 1,
    )
  }
  return quotes
}

function hopFrom(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  quote: QuoteCandidate,
): HopQuote {
  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut: quote.amountOut,
    pool: quote.pool,
  }
}

/**
 * Finds the best exact-input route across PancakeSwap V2 and V3 pools,
 * trying direct swaps plus WBNB- and USDT-intermediated routes.
 *
 * The search uses at most two Multicall3 round-trips: one for every
 * first-hop candidate, and one for the follow-up hops that depend on them.
 */
export async function findBestSwapRoute(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
): Promise<SwapRoute | null> {
  if (amountIn <= 0n) return null
  const start = wrappedAddress(tokenIn)
  const end = wrappedAddress(tokenOut)
  if (start.toLowerCase() === end.toLowerCase()) return null

  const mids = [WBNB_ADDRESS, USDT_ADDRESS].filter(
    (mid) =>
      mid.toLowerCase() !== start.toLowerCase() &&
      mid.toLowerCase() !== end.toLowerCase(),
  )

  const firstRequests: PairQuoteRequest[] = [
    { tokenIn: start, tokenOut: end, amountIn },
    ...mids.map((mid) => ({ tokenIn: start, tokenOut: mid, amountIn })),
  ]
  const firstQuotes = await quotePairs(client, firstRequests)

  const candidates: SwapRoute[] = []

  const direct = firstQuotes[0]?.[0]
  if (direct) {
    candidates.push({
      hops: [hopFrom(start, end, amountIn, direct)],
      amountOut: direct.amountOut,
    })
  }

  const secondRequests: PairQuoteRequest[] = []
  const secondMidIndex: number[] = []
  mids.forEach((mid, index) => {
    const first = firstQuotes[index + 1]?.[0]
    if (!first) return
    secondRequests.push({
      tokenIn: mid,
      tokenOut: end,
      amountIn: first.amountOut,
    })
    secondMidIndex.push(index)
  })

  const secondQuotes = await quotePairs(client, secondRequests)
  secondRequests.forEach((_, requestIndex) => {
    const midIndex = secondMidIndex[requestIndex]
    const first = firstQuotes[midIndex + 1]?.[0]
    const second = secondQuotes[requestIndex]?.[0]
    if (!first || !second) return
    candidates.push({
      hops: [
        hopFrom(start, mids[midIndex], amountIn, first),
        hopFrom(mids[midIndex], end, first.amountOut, second),
      ],
      amountOut: second.amountOut,
    })
  })

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.amountOut !== b.amountOut) {
      return a.amountOut > b.amountOut ? -1 : 1
    }
    return a.hops.length - b.hops.length
  })
  return candidates[0]
}

export type SwapCall = {
  commands: Hex
  inputs: Hex[]
  value: bigint
}

/** Applies slippage in basis points to an expected output amount. */
export function applySlippage(amount: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.min(Math.max(slippageBps, 0), 9_999))
  return (amount * (10_000n - bps)) / 10_000n
}

/**
 * A sentinel understood by the router: use the router's whole balance of the
 * token as the amount in. This keeps multi-hop swaps correct even when an
 * earlier pool returns a slightly different amount than quoted.
 */
const CONTRACT_BALANCE = 1n << 255n

type RouteSegment = {
  kind: 'v2' | 'v3'
  hops: HopQuote[]
}

/** Merges adjacent hops that use the same pool type into one router command. */
function toSegments(hops: HopQuote[]): RouteSegment[] {
  const segments: RouteSegment[] = []
  for (const hop of hops) {
    const kind = hop.pool.kind
    const current = segments[segments.length - 1]
    if (current && current.kind === kind) {
      current.hops.push(hop)
    } else {
      segments.push({ kind, hops: [hop] })
    }
  }
  return segments
}

function v3Path(segment: RouteSegment): Hex {
  const first = segment.hops[0]
  let path: Hex = first.tokenIn
  for (const hop of segment.hops) {
    if (hop.pool.kind !== 'v3') continue
    path = concat([path, toHex(hop.pool.fee, { size: 3 }), hop.tokenOut])
  }
  return path
}

export function buildSwapCall(
  route: SwapRoute,
  recipient: Address,
  slippageBps: number,
  nativeIn: boolean,
  nativeOut: boolean,
): SwapCall {
  const commands: Hex[] = []
  const inputs: Hex[] = []
  const amountIn = route.hops[0]?.amountIn ?? 0n

  if (nativeIn) {
    commands.push('0x0b') // WRAP_ETH
    inputs.push(
      encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [UNIVERSAL_ROUTER_ADDRESS, amountIn],
      ),
    )
  }

  const minOut = applySlippage(route.amountOut, slippageBps)
  const segments = toSegments(route.hops)

  segments.forEach((segment, index) => {
    const isFirst = index === 0
    const isLast = index === segments.length - 1
    const hopRecipient = isLast
      ? nativeOut
        ? UNIVERSAL_ROUTER_ADDRESS
        : recipient
      : UNIVERSAL_ROUTER_ADDRESS
    const hopMinOut = isLast ? minOut : 0n
    // Later segments consume whatever the previous swap actually produced.
    const hopAmountIn = isFirst ? amountIn : CONTRACT_BALANCE
    const payerIsUser = isFirst && !nativeIn

    if (segment.kind === 'v2') {
      commands.push('0x08') // V2_SWAP_EXACT_IN
      inputs.push(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'address[]' },
            { type: 'bool' },
          ],
          [
            hopRecipient,
            hopAmountIn,
            hopMinOut,
            [
              segment.hops[0].tokenIn,
              ...segment.hops.map((hop) => hop.tokenOut),
            ],
            payerIsUser,
          ],
        ),
      )
      return
    }

    commands.push('0x00') // V3_SWAP_EXACT_IN
    inputs.push(
      encodeAbiParameters(
        [
          { type: 'address' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'bytes' },
          { type: 'bool' },
        ],
        [hopRecipient, hopAmountIn, hopMinOut, v3Path(segment), payerIsUser],
      ),
    )
  })

  if (nativeOut) {
    commands.push('0x0c') // UNWRAP_WETH
    inputs.push(
      encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [recipient, minOut],
      ),
    )
  }

  return {
    commands: concat(commands),
    inputs,
    value: nativeIn ? amountIn : 0n,
  }
}

/** Reads an ERC-20's metadata, falling back when symbol/name are missing. */
export async function resolveToken(
  client: PublicClient,
  address: Address,
): Promise<SwapTokenInfo> {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`
  let decimals = 18
  let symbol = short
  let name = short

  const results = await client.multicall({
    allowFailure: true,
    contracts: [
      { address, abi: ERC20_ABI, functionName: 'decimals' },
      { address, abi: ERC20_ABI, functionName: 'symbol' },
      { address, abi: ERC20_ABI, functionName: 'name' },
    ],
  })

  const [decimalsResult, symbolResult, nameResult] = results
  if (decimalsResult.status !== 'success') {
    throw new Error('Address is not an ERC-20 token')
  }
  decimals = Number(decimalsResult.result)
  if (symbolResult.status === 'success' && symbolResult.result) {
    symbol = String(symbolResult.result)
  }
  if (nameResult.status === 'success' && nameResult.result) {
    name = String(nameResult.result)
  }

  return { address, symbol, name, decimals }
}
