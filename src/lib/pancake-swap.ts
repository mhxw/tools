import {
  concat,
  decodeFunctionResult,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
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
/** PancakeSwap Infinity concentrated-liquidity pool manager on BNB Chain. */
export const INFINITY_CL_POOL_MANAGER_ADDRESS: Address =
  '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b'
/** PancakeSwap Infinity bin pool manager on BNB Chain. */
export const INFINITY_BIN_POOL_MANAGER_ADDRESS: Address =
  '0xC697d2898e0D09264376196696c51D7aBbbAA4a9'
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
  'function quoteMixedExactInput(address[] paths, bytes actions, bytes[] params, uint256 amountIn) returns (uint256 amountOut, uint256 gasEstimate)',
])

const INFINITY_POOL_MANAGER_ABI = parseAbi([
  'function poolIdToPoolKey(bytes32 poolId) view returns (address currency0, address currency1, address hooks, address poolManager, uint24 fee, bytes32 parameters)',
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
  /** Infinity pool ID or transaction hash from `?pool=`. */
  pool?: Hex
  invalidPool?: boolean
}

/**
 * Reads shareable swap links. Both compact pairs and explicit names work:
 * `?chain=bsc,bsc&token=0xabc,0xdef`
 * `?inputchain=bsc&outputchain=bsc&inputtoken=0xabc&outputtoken=0xdef`
 * `?pool=0x…` pins a PancakeSwap Infinity pool.
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
  const rawPool = values.get('pool')
  const pool = isInfinityPoolRef(rawPool)
    ? (rawPool.trim() as Hex)
    : undefined

  return {
    from,
    to,
    chainSupported: true,
    invalidToken:
      (Boolean(rawFrom) && !from) || (Boolean(rawTo) && !to),
    pool,
    invalidPool: Boolean(rawPool) && !pool,
  }
}

/**
 * A PancakeSwap Infinity CL pool key. Infinity identifies pools by the hash of
 * this struct instead of a factory-created pair address.
 */
export type InfinityPoolKey = {
  currency0: Address
  currency1: Address
  hooks: Address
  poolManager: Address
  fee: number
  parameters: Hex
}

export type InfinityPool = {
  id: Hex
  key: InfinityPoolKey
}

export type PoolRef =
  | { kind: 'v2' }
  | { kind: 'v3'; fee: number }
  | { kind: 'infinity'; pool: InfinityPool }

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

const POOL_KEY_COMPONENTS = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'hooks', type: 'address' },
  { name: 'poolManager', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'parameters', type: 'bytes32' },
] as const

const POOL_KEY_TUPLE = {
  name: 'poolKey',
  type: 'tuple',
  components: POOL_KEY_COMPONENTS,
} as const

/** Fee / tick-spacing pairs commonly used when creating Infinity CL pools. */
const INFINITY_POOL_SHAPES = [
  { fee: 100, tickSpacing: 1 },
  { fee: 500, tickSpacing: 10 },
  { fee: 2500, tickSpacing: 50 },
  { fee: 10000, tickSpacing: 200 },
  { fee: 0x800000, tickSpacing: 1 },
  { fee: 0x800000, tickSpacing: 10 },
  { fee: 0x800000, tickSpacing: 50 },
  { fee: 0x800000, tickSpacing: 200 },
] as const

/**
 * Infinity pools cannot be enumerated from a static site, so discovery probes
 * a bounded set of common CL fee / tick-spacing shapes for the selected pair.
 * Any other pool can be loaded explicitly by pool ID or transaction hash; a
 * 32-byte reference is accepted from the URL or UI.
 */
export function isInfinityPoolRef(value: string | undefined): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value?.trim() ?? '')
}

function sortCurrencies(a: Address, b: Address): [Address, Address] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]
}

export function infinityPoolKey(
  currencyA: Address,
  currencyB: Address,
  fee: number,
  tickSpacing: number,
  hooks: Address = zeroAddress,
  poolManager: Address = INFINITY_CL_POOL_MANAGER_ADDRESS,
): InfinityPoolKey {
  const [currency0, currency1] = sortCurrencies(currencyA, currencyB)
  return {
    currency0,
    currency1,
    hooks,
    poolManager,
    fee,
    // CL parameters keep hook flags in the low 16 bits and tickSpacing in
    // bits 16..39 (see CLPoolParametersHelper.getTickSpacing).
    parameters: `0x${(BigInt(tickSpacing) << 16n)
      .toString(16)
      .padStart(64, '0')}` as Hex,
  }
}

export function infinityPoolId(key: InfinityPoolKey): Hex {
  return keccak256(
    encodeAbiParameters(POOL_KEY_COMPONENTS, [
      key.currency0,
      key.currency1,
      key.hooks,
      key.poolManager,
      key.fee,
      key.parameters,
    ]),
  )
}

export function infinityKeyMatchesPair(
  key: InfinityPoolKey,
  tokenIn: Address,
  tokenOut: Address,
): boolean {
  const mine = new Set([
    key.currency0.toLowerCase(),
    key.currency1.toLowerCase(),
  ])
  return (
    mine.has(tokenIn.toLowerCase()) && mine.has(tokenOut.toLowerCase())
  )
}

const infinityPoolCache = new Map<string, InfinityPool | null>()
const infinityPairCache = new Map<string, InfinityPool[]>()

/** Loads a pool key from its ID and builds the `InfinityPool` wrapper. */
export async function resolveInfinityPool(
  client: PublicClient,
  poolId: Hex,
): Promise<InfinityPool | null> {
  const cached = infinityPoolCache.get(poolId.toLowerCase())
  if (cached !== undefined) return cached

  const [key, binKey] = await client.multicall({
    allowFailure: true,
    contracts: [
      {
        address: INFINITY_CL_POOL_MANAGER_ADDRESS,
        abi: INFINITY_POOL_MANAGER_ABI,
        functionName: 'poolIdToPoolKey',
        args: [poolId],
      },
      {
        address: INFINITY_BIN_POOL_MANAGER_ADDRESS,
        abi: INFINITY_POOL_MANAGER_ABI,
        functionName: 'poolIdToPoolKey',
        args: [poolId],
      },
    ],
  })

  if (key.status === 'success') {
    const pool: InfinityPool = {
      id: poolId,
      key: {
        currency0: getAddress(key.result[0]),
        currency1: getAddress(key.result[1]),
        hooks: getAddress(key.result[2]),
        poolManager: getAddress(key.result[3]),
        fee: key.result[4],
        parameters: key.result[5],
      },
    }
    if (
      pool.key.poolManager !== zeroAddress &&
      pool.key.currency0.toLowerCase() !== pool.key.currency1.toLowerCase() &&
      infinityPoolId(pool.key).toLowerCase() === poolId.toLowerCase()
    ) {
      infinityPoolCache.set(poolId.toLowerCase(), pool)
      return pool
    }
  }

  if (binKey.status === 'success' && binKey.result[3] !== zeroAddress) {
    throw new Error('Infinity bin pools are not supported')
  }

  infinityPoolCache.set(poolId.toLowerCase(), null)
  return null
}

/**
 * Accepts a pool ID or a transaction hash. For a transaction, the pool ID is
 * read from any pool-manager log (Infinity events index the pool ID first).
 */
export async function resolveInfinityPoolRef(
  client: PublicClient,
  value: string,
): Promise<InfinityPool | null> {
  const ref = value.trim() as Hex
  if (!isInfinityPoolRef(ref)) {
    throw new Error('invalid pool reference')
  }

  const direct = await resolveInfinityPool(client, ref)
  if (direct) return direct

  let receipt
  try {
    receipt = await client.getTransactionReceipt({ hash: ref })
  } catch {
    return null
  }

  for (const log of receipt.logs) {
    const manager = log.address.toLowerCase()
    if (
      manager !== INFINITY_CL_POOL_MANAGER_ADDRESS.toLowerCase() &&
      manager !== INFINITY_BIN_POOL_MANAGER_ADDRESS.toLowerCase()
    ) {
      continue
    }
    const topic = log.topics[1]
    if (!topic) continue
    const pool = await resolveInfinityPool(client, topic)
    if (pool) return pool
  }
  return null
}

/** Pinned pools plus a bounded probe of common Infinity CL pool shapes. */
export async function findInfinityPools(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
): Promise<InfinityPool[]> {
  const cacheKey = [tokenIn, tokenOut]
    .map((address) => address.toLowerCase())
    .sort()
    .join(':')
  const cached = infinityPairCache.get(cacheKey)
  if (cached) return cached

  const pools: InfinityPool[] = []
  const seen = new Set<string>()

  const candidates = INFINITY_POOL_SHAPES.map(({ fee, tickSpacing }) => {
    const key = infinityPoolKey(tokenIn, tokenOut, fee, tickSpacing)
    return { id: infinityPoolId(key), key }
  })

  const results = await client.multicall({
    allowFailure: true,
    contracts: candidates.map((candidate) => ({
      address: INFINITY_CL_POOL_MANAGER_ADDRESS,
      abi: INFINITY_POOL_MANAGER_ABI,
      functionName: 'poolIdToPoolKey' as const,
      args: [candidate.id] as const,
    })),
  })

  results.forEach((result, index) => {
    if (result.status !== 'success') return
    if (result.result[3] === zeroAddress) return
    const candidate = candidates[index]
    if (seen.has(candidate.id)) return
    seen.add(candidate.id)
    pools.push(candidate)
  })

  infinityPairCache.set(cacheKey, pools)
  return pools
}

function decodeQuote(kind: PoolRef, data: Hex): bigint | undefined {
  try {
    if (kind.kind === 'v2') {
      const [amountOut] = decodeFunctionResult({
        abi: MIXED_QUOTER_ABI,
        functionName: 'quoteExactInputSingleV2',
        data,
      })
      return amountOut
    }
    if (kind.kind === 'v3') {
      const [amountOut] = decodeFunctionResult({
        abi: MIXED_QUOTER_ABI,
        functionName: 'quoteExactInputSingleV3',
        data,
      })
      return amountOut
    }
    const [amountOut] = decodeFunctionResult({
      abi: MIXED_QUOTER_ABI,
      functionName: 'quoteMixedExactInput',
      data,
    })
    return amountOut
  } catch {
    return undefined
  }
}

const V2_V3_POOLS: PoolRef[] = [
  { kind: 'v2' },
  ...V3_FEE_TIERS.map((fee) => ({ kind: 'v3' as const, fee })),
]

type PairQuoteRequest = {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  pools: PoolRef[]
}

/**
 * Infinity quote params are a struct with a dynamic `hookData` member, so the
 * struct itself must be encoded as a single ABI argument (leading offset).
 */
function infinityQuoteParams(pool: InfinityPool): Hex {
  return encodeAbiParameters(
    [
      {
        name: 'params',
        type: 'tuple',
        components: [POOL_KEY_TUPLE, { name: 'hookData', type: 'bytes' }],
      },
    ],
    [{ poolKey: pool.key, hookData: '0x' }],
  )
}

function quoteCallData(pool: PoolRef, request: PairQuoteRequest): Hex {
  if (pool.kind === 'v2') {
    return encodeFunctionData({
      abi: MIXED_QUOTER_ABI,
      functionName: 'quoteExactInputSingleV2',
      args: [request],
    })
  }
  if (pool.kind === 'v3') {
    return encodeFunctionData({
      abi: MIXED_QUOTER_ABI,
      functionName: 'quoteExactInputSingleV3',
      args: [{ ...request, fee: pool.fee, sqrtPriceLimitX96: 0n }],
    })
  }
  return encodeFunctionData({
    abi: MIXED_QUOTER_ABI,
    functionName: 'quoteMixedExactInput',
    args: [
      [request.tokenIn, request.tokenOut],
      '0x04', // INFI_CL_EXACT_INPUT_SINGLE
      [infinityQuoteParams(pool.pool)],
      request.amountIn,
    ],
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

  const calls: {
    target: Address
    allowFailure: boolean
    callData: Hex
  }[] = []
  const owners: { requestIndex: number; pool: PoolRef }[] = []

  requests.forEach((request, requestIndex) => {
    request.pools.forEach((pool) => {
      calls.push({
        target: MIXED_QUOTER_ADDRESS,
        allowFailure: true,
        callData: quoteCallData(pool, request),
      })
      owners.push({ requestIndex, pool })
    })
  })

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
    const success = 'success' in result ? result.success : result[0]
    const returnData =
      'returnData' in result ? result.returnData : result[1]
    if (!success) return
    const owner = owners[index]
    if (!owner) return
    const amountOut = decodeQuote(owner.pool, returnData)
    if (amountOut === undefined || amountOut === 0n) return
    quotes[owner.requestIndex].push({
      pool: owner.pool,
      amountOut,
    })
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
export type SwapRouteOptions = {
  /** Restrict the direct route to this Infinity pool ID. */
  infinityPoolId?: Hex
}

export async function findBestSwapRoute(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  options: SwapRouteOptions = {},
): Promise<SwapRoute | null> {
  if (amountIn <= 0n) return null
  const start = wrappedAddress(tokenIn)
  const end = wrappedAddress(tokenOut)
  if (start.toLowerCase() === end.toLowerCase()) return null

  if (options.infinityPoolId) {
    const pool = await resolveInfinityPoolRef(
      client,
      options.infinityPoolId,
    )
    if (!pool || !infinityKeyMatchesPair(pool.key, tokenIn, tokenOut)) {
      return null
    }
    const [quotes] = await quotePairs(client, [
      {
        tokenIn,
        tokenOut,
        amountIn,
        pools: [{ kind: 'infinity', pool }],
      },
    ])
    const quote = quotes?.[0]
    if (!quote) return null
    return {
      hops: [hopFrom(tokenIn, tokenOut, amountIn, quote)],
      amountOut: quote.amountOut,
    }
  }

  const infinityPools = await findInfinityPools(client, tokenIn, tokenOut)
  const mids = [WBNB_ADDRESS, USDT_ADDRESS].filter(
    (mid) =>
      mid.toLowerCase() !== start.toLowerCase() &&
      mid.toLowerCase() !== end.toLowerCase(),
  )

  const firstRequests: PairQuoteRequest[] = [
    { tokenIn: start, tokenOut: end, amountIn, pools: V2_V3_POOLS },
  ]

  // Infinity keys must use the real currencies, so native BNB is quoted
  // against address(0) rather than its WBNB wrapper.
  let infinityRequestIndex = -1
  if (infinityPools.length > 0) {
    infinityRequestIndex = firstRequests.length
    firstRequests.push({
      tokenIn,
      tokenOut,
      amountIn,
      pools: infinityPools.map((pool) => ({
        kind: 'infinity' as const,
        pool,
      })),
    })
  }

  const midRequestStart = firstRequests.length
  firstRequests.push(
    ...mids.map((mid) => ({
      tokenIn: start,
      tokenOut: mid,
      amountIn,
      pools: V2_V3_POOLS,
    })),
  )

  const firstQuotes = await quotePairs(client, firstRequests)

  const candidates: SwapRoute[] = []

  const direct = firstQuotes[0]?.[0]
  if (direct) {
    candidates.push({
      hops: [hopFrom(start, end, amountIn, direct)],
      amountOut: direct.amountOut,
    })
  }

  const infinityDirect =
    infinityRequestIndex >= 0
      ? firstQuotes[infinityRequestIndex]?.[0]
      : undefined
  if (infinityDirect) {
    candidates.push({
      hops: [hopFrom(tokenIn, tokenOut, amountIn, infinityDirect)],
      amountOut: infinityDirect.amountOut,
    })
  }

  const secondRequests: PairQuoteRequest[] = []
  const secondMidIndex: number[] = []
  mids.forEach((mid, index) => {
    const first = firstQuotes[midRequestStart + index]?.[0]
    if (!first) return
    secondRequests.push({
      tokenIn: mid,
      tokenOut: end,
      amountIn: first.amountOut,
      pools: V2_V3_POOLS,
    })
    secondMidIndex.push(index)
  })

  const secondQuotes = await quotePairs(client, secondRequests)
  secondRequests.forEach((_, requestIndex) => {
    const midIndex = secondMidIndex[requestIndex]
    const first = firstQuotes[midRequestStart + midIndex]?.[0]
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
    if (hop.pool.kind === 'infinity') continue
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

/**
 * CL_SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL. The router moves the input
 * through Permit2 (or msg.value for native BNB) and the vault pays the output
 * straight to the connected wallet.
 */
function buildInfinitySwapCall(
  route: SwapRoute,
  slippageBps: number,
): SwapCall {
  const hop = route.hops[0]
  if (route.hops.length !== 1 || hop?.pool.kind !== 'infinity') {
    throw new Error('Unsupported Infinity route')
  }

  const { key } = hop.pool.pool
  const tokenIn =
    hop.tokenIn.toLowerCase() === key.currency0.toLowerCase()
      ? key.currency0
      : key.currency1
  const tokenOut =
    tokenIn.toLowerCase() === key.currency0.toLowerCase()
      ? key.currency1
      : key.currency0
  if (
    tokenIn.toLowerCase() !== hop.tokenIn.toLowerCase() ||
    tokenOut.toLowerCase() !== hop.tokenOut.toLowerCase()
  ) {
    throw new Error('Infinity pool does not contain this pair')
  }

  const zeroForOne =
    tokenIn.toLowerCase() === key.currency0.toLowerCase()
  const minOut = applySlippage(route.amountOut, slippageBps)
  const actions = '0x060c0f'
  const params = [
    encodeAbiParameters(
      [
        {
          name: 'params',
          type: 'tuple',
          components: [
            POOL_KEY_TUPLE,
            { name: 'zeroForOne', type: 'bool' },
            { name: 'amountIn', type: 'uint128' },
            { name: 'amountOutMinimum', type: 'uint128' },
            { name: 'hookData', type: 'bytes' },
          ],
        },
      ],
      [
        {
          poolKey: key,
          zeroForOne,
          amountIn: hop.amountIn,
          amountOutMinimum: minOut,
          hookData: '0x',
        },
      ],
    ),
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [tokenIn, hop.amountIn],
    ),
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [tokenOut, minOut],
    ),
  ]

  return {
    commands: '0x10', // INFI_SWAP
    inputs: [
      encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [actions, params],
      ),
    ],
    value: isNativeToken(tokenIn) ? hop.amountIn : 0n,
  }
}

export function buildSwapCall(
  route: SwapRoute,
  recipient: Address,
  slippageBps: number,
  nativeIn: boolean,
  nativeOut: boolean,
): SwapCall {
  if (route.hops.length === 1 && route.hops[0].pool.kind === 'infinity') {
    return buildInfinitySwapCall(route, slippageBps)
  }
  if (route.hops.some((hop) => hop.pool.kind === 'infinity')) {
    throw new Error('Mixed Infinity routes are not supported')
  }

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
