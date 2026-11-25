import {
  createPublicClient,
  decodeAbiParameters,
  decodeErrorResult,
  hexToString,
  http,
  keccak256,
  parseAbi,
  toHex,
  type Address,
  type Hex,
  type Log,
} from 'viem'
import { ccipChain } from './ccip-chains'

export const CCIP_API_BASE = 'https://api.ccip.chain.link/v2'
export const CCIP_EXPLORER_BASE = 'https://ccip.chain.link'

/** CCIP 2.0 OffRamp surface used by manual execution. */
export const OFF_RAMP_ABI = parseAbi([
  'function execute(bytes encodedMessage, address[] ccvs, bytes[] verifierResults, uint32 gasLimitOverride)',
  'function getExecutionState(bytes32 messageId) view returns (uint8)',
])

/**
 * Reverts surfaced by 2.0 and 1.5 OffRamps. Only used to make failure reasons
 * readable; decoding is best-effort.
 */
export const OFF_RAMP_ERRORS_ABI = parseAbi([
  'error CursedByRMN(uint64 sourceChainSelector)',
  'error GasCannotBeZero()',
  'error InboundImplementationNotFound(address ccv, bytes verifierResults)',
  'error InsufficientGasToCompleteTx(bytes4 err)',
  'error InvalidEVMAddress(bytes encodedAddress)',
  'error InvalidGasLimitOverride(uint32 messageGasLimit, uint32 gasLimitOverride)',
  'error InvalidMessageDestChainSelector(uint64 messageDestChainSelector)',
  'error InvalidNumberOfTokens(uint256 numTokens)',
  'error InvalidOffRamp(address expected, bytes got)',
  'error InvalidOnRamp(bytes got)',
  'error InvalidOptionalThreshold(uint8 wanted, uint256 got)',
  'error InvalidVerifierResultsLength(uint256 expected, uint256 got)',
  'error NoStateProgressMade(bytes32 messageId, bytes err)',
  'error NotACompatiblePool(address notPool)',
  'error OptionalCCVQuorumNotReached(uint256 wanted, uint256 got)',
  'error ReceiverError(bytes err)',
  'error ReentrancyGuardReentrantCall()',
  'error RequiredCCVMissing(address requiredCCV)',
  'error SkippedAlreadyExecutedMessage(bytes32 messageId, uint64 sourceChainSelector, uint64 messageNumber)',
  'error SourceChainNotEnabled(uint64 sourceChainSelector)',
  'error TokenHandlingError(address target, bytes err)',
  'error ZeroChainSelectorNotAllowed()',
  // 1.5 and earlier
  'error AlreadyExecuted(bytes32 messageId)',
  'error GasLimitTooHigh()',
  'error InvalidProof(bytes32 merkleRoot)',
  'error InvalidSourceChain(uint64 sourceChainSelector)',
  'error RootNotCommitted(bytes32 merkleRoot)',
  'error SenderNotAllowed(address sender)',
  'error UnsupportedNumberOfTokens(uint256 numberOfTokens)',
])

export const EXECUTION_STATE_CHANGED_TOPIC =
  '0x8c324ce1367b83031769f6a813e3bb4c117aba2185789d66b98b791405be6df2'
export const MESSAGE_SENT_TOPIC =
  '0x9b877de93ea9895756e337442c657f95a34fc68e7eb988bdfa693d5be83016b6'

export type CcipNetworkInfo = {
  name?: string
  displayName?: string
  chainSelector?: string
  chainId?: string
  chainFamily?: string
  environment?: string
}

export type CcipTokenAmount = {
  token?: Address
  amount?: string
}

export type CcipMessage = {
  messageId: Hex
  status: string
  sequenceNumber?: string
  onramp?: Address
  offramp?: Address
  origin?: string
  sender?: string
  receiver?: string
  sourceNetworkInfo: CcipNetworkInfo
  destNetworkInfo: CcipNetworkInfo
  sendTransactionHash?: Hex
  sendTimestamp?: string
  sendBlockNumber?: number
  receiptTransactionHash?: Hex
  receiptTimestamp?: string
  receiptBlockNumber?: number
  tokenAmounts?: CcipTokenAmount[]
  extraArgs?: {
    gasLimit?: string
    requestedFinalityConfig?: string
    [key: string]: unknown
  }
  readyForManualExecution?: boolean
  version?: string
  data?: Hex
  executor?: { address?: string; status?: string }
  verifiers?: { items?: unknown[]; optionalThreshold?: number }
  fees?: { fixedFeesDetails?: { tokenAddress?: string; totalAmount?: string } }
}

export type CcipSearchResult = {
  messageId: Hex
  status: string
  sendTransactionHash?: Hex
  receiptTransactionHash?: Hex
  sendTimestamp?: string
  receiptTimestamp?: string
  readyForManualExecution?: boolean
  sourceNetworkInfo?: CcipNetworkInfo
  destNetworkInfo?: CcipNetworkInfo
}

export type ExecutionInputsV2 = {
  offramp: Address
  encodedMessage: Hex
  verifierAddresses: Address[]
  ccvData: Hex[]
  verificationComplete: boolean
}

export type ExecutionInputsV1 = {
  offramp: Address
  merkleRoot: Hex
  messageBatch: Array<{ data: Hex }>
}

export type ExecutionInputs = ExecutionInputsV2 | ExecutionInputsV1

export function isExecutionInputsV2(
  inputs: ExecutionInputs,
): inputs is ExecutionInputsV2 {
  return 'encodedMessage' in inputs
}

export type MessageCandidate = {
  messageId: Hex
  kind: 'execution' | 'send'
  /** On-chain execution state from an ExecutionStateChanged log. */
  state?: number
  /** Raw revert data from the failed execution attempt. */
  returnData?: Hex
}

export type CcipLookup = {
  message: CcipMessage
  inputs?: ExecutionInputs
  inputsError?: string
  /** Authoritative on-chain state, read from the destination RPC. */
  onchainState?: number
  /** Raw revert data from the latest ExecutionStateChanged log. */
  previousRevert?: Hex
}

export type CcipLookupErrorCode =
  | 'invalid'
  | 'not-found'
  | 'network'
  | 'api'
  | 'unsupported'

export class CcipLookupError extends Error {
  readonly code: CcipLookupErrorCode
  readonly status?: number

  constructor(code: CcipLookupErrorCode, status?: number) {
    super(`CCIP lookup failed: ${code}`)
    this.name = 'CcipLookupError'
    this.code = code
    this.status = status
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  let response: Response
  try {
    response = await fetch(`${CCIP_API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
  } catch {
    throw new CcipLookupError('network')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) throw new CcipLookupError('api', response.status)
  try {
    return (await response.json()) as T
  } catch {
    throw new CcipLookupError('network')
  }
}

export async function fetchCcipMessage(messageId: Hex): Promise<CcipMessage> {
  return apiGet<CcipMessage>(`/messages/${messageId}`)
}

/**
 * The API's general search matches message IDs as well as send and receipt
 * transaction hashes, so one call covers every hash a user may paste.
 */
export async function searchCcipMessages(
  query: string,
): Promise<CcipSearchResult[]> {
  const payload = await apiGet<{ data?: CcipSearchResult[] }>(
    `/messages?q=${encodeURIComponent(query)}&limit=10`,
  )
  return Array.isArray(payload.data) ? payload.data : []
}

export async function fetchCcipExecutionInputs(
  messageId: Hex,
): Promise<ExecutionInputs> {
  return apiGet<ExecutionInputs>(`/messages/${messageId}/execution-inputs`)
}

const HASH_PATTERN = /0x[0-9a-fA-F]{64}/

/** Accepts a raw hash or an explorer URL containing one. */
export function extractHash(value: string): Hex | undefined {
  const match = value.trim().match(HASH_PATTERN)
  return match ? (match[0].toLowerCase() as Hex) : undefined
}

function pickSearchResult(
  results: CcipSearchResult[],
  hash: Hex,
): CcipSearchResult | undefined {
  const lower = hash.toLowerCase()
  return (
    results.find(
      (item) => item.receiptTransactionHash?.toLowerCase() === lower,
    ) ??
    results.find((item) => item.sendTransactionHash?.toLowerCase() === lower) ??
    results.find((item) => item.messageId.toLowerCase() === lower) ??
    results[0]
  )
}

export function parseCcipLogs(logs: readonly Log[]): MessageCandidate[] {
  const candidates: MessageCandidate[] = []
  const seen = new Set<string>()

  for (const log of logs) {
    const topic0 = log.topics[0]
    if (!topic0) continue

    if (topic0 === EXECUTION_STATE_CHANGED_TOPIC && log.topics.length >= 4) {
      const messageId = log.topics[3] as Hex
      if (seen.has(messageId)) continue
      try {
        const [state, returnData] = decodeAbiParameters(
          [{ type: 'uint8' }, { type: 'bytes' }],
          log.data ?? '0x',
        )
        seen.add(messageId)
        candidates.push({
          messageId,
          kind: 'execution',
          state: Number(state),
          returnData: returnData as Hex,
        })
      } catch {
        // Ignore malformed logs and keep looking.
      }
      continue
    }

    if (topic0 === MESSAGE_SENT_TOPIC) {
      try {
        const [encodedMessage] = decodeAbiParameters(
          [{ type: 'bytes' }],
          log.data ?? '0x',
        )
        const messageId = keccak256(encodedMessage)
        if (seen.has(messageId)) continue
        seen.add(messageId)
        candidates.push({ messageId, kind: 'send' })
      } catch {
        // Ignore malformed logs.
      }
    }
  }

  return candidates
}

function publicClientFor(chainId: number) {
  const chain = ccipChain(chainId)
  if (!chain) return undefined
  return createPublicClient({
    transport: http(chain.rpc, { timeout: 10_000, retryCount: 0 }),
  })
}

export async function readExecutionState(
  chainId: number,
  offramp: Address,
  messageId: Hex,
): Promise<number | undefined> {
  const client = publicClientFor(chainId)
  if (!client) return undefined
  try {
    const state = await client.readContract({
      address: offramp,
      abi: OFF_RAMP_ABI,
      functionName: 'getExecutionState',
      args: [messageId],
    })
    return Number(state)
  } catch {
    return undefined
  }
}

export async function findExecutionEvent(
  chainId: number,
  txHash: Hex,
): Promise<MessageCandidate | undefined> {
  const client = publicClientFor(chainId)
  if (!client) return undefined
  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash })
    return parseCcipLogs(receipt.logs).find(
      (candidate) => candidate.kind === 'execution',
    )
  } catch {
    return undefined
  }
}

/** Resolve any hash (send tx, receipt tx or message ID) into a full message. */
export async function loadCcipMessage(raw: string): Promise<CcipLookup> {
  const hash = extractHash(raw)
  if (!hash) throw new CcipLookupError('invalid')

  let results: CcipSearchResult[]
  try {
    results = await searchCcipMessages(hash)
  } catch (error) {
    if (error instanceof CcipLookupError && error.status === 400) {
      throw new CcipLookupError('invalid')
    }
    throw error
  }

  const match = pickSearchResult(results, hash)
  if (!match) throw new CcipLookupError('not-found')

  const message = await fetchCcipMessage(match.messageId)
  const destChainId = Number(message.destNetworkInfo?.chainId ?? 0)

  let inputs: ExecutionInputs | undefined
  let inputsError: string | undefined
  try {
    inputs = await fetchCcipExecutionInputs(message.messageId)
  } catch (error) {
    inputsError =
      error instanceof CcipLookupError
        ? `HTTP ${error.status ?? 'network'}`
        : 'unknown'
  }

  let onchainState: number | undefined
  let previousRevert: Hex | undefined

  if (message.offramp) {
    const offramp = message.offramp as Address
    const [state, event] = await Promise.all([
      Number.isFinite(destChainId) && destChainId > 0
        ? readExecutionState(destChainId, offramp, message.messageId)
        : Promise.resolve(undefined),
      message.receiptTransactionHash
        ? findExecutionEvent(destChainId, message.receiptTransactionHash)
        : Promise.resolve(undefined),
    ])
    onchainState = state
    previousRevert = event?.returnData
  }

  return { message, inputs, inputsError, onchainState, previousRevert }
}

export type RevertInfo = {
  name?: string
  args?: readonly unknown[]
  text: string
  raw?: Hex
  /** The OffRamp's return-data buffer cut the payload short. */
  truncated?: boolean
}

function decodeInnerRevert(data?: Hex): RevertInfo | undefined {
  if (!data || data === '0x') return undefined

  if (data.startsWith('0x08c379a0')) {
    try {
      const [message] = decodeAbiParameters(
        [{ type: 'string' }],
        `0x${data.slice(10)}`,
      )
      return { name: 'Error', text: message }
    } catch {
      const partial = readPartialAbiString(data.slice(10))
      if (partial) {
        return { name: 'Error', text: `${partial}…`, truncated: true }
      }
      return {
        name: 'Error',
        text: 'Error(string)',
        truncated: true,
      }
    }
  }

  if (data.startsWith('0x4e487b71')) {
    try {
      const [code] = decodeAbiParameters([{ type: 'uint256' }], `0x${data.slice(10)}`)
      return { name: 'Panic', text: `Panic(0x${code.toString(16)})` }
    } catch {
      return { name: 'Panic', text: 'Panic(uint256)', truncated: true }
    }
  }

  try {
    const decoded = decodeErrorResult({ abi: OFF_RAMP_ERRORS_ABI, data })
    return describeDecodedError(decoded.errorName, decoded.args, data)
  } catch {
    return { text: shortHex(data), raw: data }
  }
}

function describeDecodedError(
  name: string,
  args: readonly unknown[] | undefined,
  raw: Hex,
): RevertInfo {
  const parts = (args ?? [])
    .filter(
      (arg) => !(typeof arg === 'string' && arg.startsWith('0x') && arg.length > 74),
    )
    .map((arg) => (typeof arg === 'string' ? shortHex(arg) : String(arg)))

  let inner: RevertInfo | undefined
  if (name === 'NoStateProgressMade' && args?.[1]) {
    inner = decodeInnerRevert(args[1] as Hex)
  } else if (
    (name === 'ReceiverError' || name === 'TokenHandlingError') &&
    args?.[name === 'ReceiverError' ? 0 : 1]
  ) {
    inner = decodeInnerRevert(args[name === 'ReceiverError' ? 0 : 1] as Hex)
  }

  const head = parts.length > 0 ? `${name}(${parts.join(', ')})` : name
  const text = inner ? `${head} → ${inner.text}` : head

  return { name, args, text, raw, truncated: inner?.truncated }
}

/**
 * Recover a readable prefix from an Error(string) whose return data was
 * truncated by the OffRamp's return-data buffer.
 */
function readPartialAbiString(body: string): string | undefined {
  if (body.length < 128) return undefined
  try {
    const offset = Number(BigInt(`0x${body.slice(0, 64)}`))
    const lengthPos = offset * 2
    if (!Number.isSafeInteger(lengthPos) || body.length < lengthPos + 64) {
      return undefined
    }
    const length = Number(BigInt(`0x${body.slice(lengthPos, lengthPos + 64)}`))
    if (!Number.isSafeInteger(length) || length <= 0) return undefined

    const available = body.slice(lengthPos + 64)
    const take = Math.min(length * 2, available.length - (available.length % 2))
    if (take <= 0) return undefined

    const text = hexToString(`0x${available.slice(0, take)}`, { size: 32 })
    const cleaned = text.split('\u0000').join('').trim()
    return cleaned || undefined
  } catch {
    return undefined
  }
}

function shortHex(value: string) {
  return value.length > 74 ? `${value.slice(0, 74)}…` : value
}

const PARTIAL_ERROR_SPECS: Record<string, { name: string; bytesWord: number }> =
  {
    [keccak256(toHex('ReceiverError(bytes)')).slice(0, 10)]: {
      name: 'ReceiverError',
      bytesWord: 0,
    },
    [keccak256(toHex('NoStateProgressMade(bytes32,bytes)')).slice(0, 10)]: {
      name: 'NoStateProgressMade',
      bytesWord: 1,
    },
    [keccak256(toHex('TokenHandlingError(address,bytes)')).slice(0, 10)]: {
      name: 'TokenHandlingError',
      bytesWord: 1,
    },
  }

/**
 * Recover the outer error name when the OffRamp truncated the encoded revert
 * data, in which case the strict ABI decoder rejects the whole payload.
 */
function decodePartialCustomError(data: Hex): RevertInfo | undefined {
  const spec = PARTIAL_ERROR_SPECS[data.slice(0, 10).toLowerCase()]
  if (!spec) return undefined

  const body = data.slice(10)
  const headStart = spec.bytesWord * 64
  const head = body.slice(headStart, headStart + 64)
  if (head.length < 64) return undefined

  try {
    const offset = Number(BigInt(`0x${head}`))
    const bytesPos = offset * 2
    if (!Number.isSafeInteger(bytesPos) || body.length < bytesPos + 64) {
      return undefined
    }
    const length = Number(BigInt(`0x${body.slice(bytesPos, bytesPos + 64)}`))
    if (!Number.isSafeInteger(length) || length <= 0) return undefined

    const available = body.slice(bytesPos + 64)
    const take = Math.min(length * 2, available.length - (available.length % 2))
    if (take <= 0) return undefined

    const inner = decodeInnerRevert(`0x${available.slice(0, take)}` as Hex)
    return {
      name: spec.name,
      text: inner ? `${spec.name} → ${inner.text}` : spec.name,
      raw: data,
      truncated: true,
    }
  } catch {
    return undefined
  }
}

/** Turn raw OffRamp revert data into a readable reason. */
export function decodeExecutionError(data?: Hex): RevertInfo | undefined {
  if (!data || data === '0x') return undefined
  try {
    const decoded = decodeErrorResult({ abi: OFF_RAMP_ERRORS_ABI, data })
    return describeDecodedError(decoded.errorName, decoded.args, data)
  } catch {
    return decodePartialCustomError(data) ?? decodeInnerRevert(data)
  }
}

/** Pull hex revert data out of the many shapes wallets return. */
export function extractRevertData(error: unknown): Hex | undefined {
  const seen = new Set<unknown>()

  function walk(value: unknown, depth: number): Hex | undefined {
    if (depth > 5 || value == null) return undefined
    if (typeof value === 'string') {
      return /^0x[0-9a-fA-F]*$/.test(value) && value.length > 10
        ? (value as Hex)
        : undefined
    }
    if (typeof value !== 'object') return undefined
    if (seen.has(value)) return undefined
    seen.add(value)

    const record = value as Record<string, unknown>
    for (const key of ['data', 'revertData', 'returnData', 'result']) {
      const found = walk(record[key], depth + 1)
      if (found) return found
    }
    for (const key of ['error', 'info', 'cause', 'body']) {
      const found = walk(record[key], depth + 1)
      if (found) return found
    }
    return undefined
  }

  return walk(error, 0)
}

export function messageGasLimit(
  message?: CcipMessage,
): string | undefined {
  const value = message?.extraArgs?.gasLimit
  return typeof value === 'string' ? value : undefined
}

export function formatGasLimit(value?: string): string {
  if (!value) return ''
  try {
    return BigInt(value).toLocaleString('en-US')
  } catch {
    return value
  }
}

export function isV2Message(message: CcipMessage): boolean {
  return !message.version || message.version.startsWith('2.')
}

export function ccipExplorerMessageUrl(messageId: string): string {
  return `${CCIP_EXPLORER_BASE}/msg/${messageId}`
}
