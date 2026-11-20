'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  encodeFunctionData,
  formatUnits,
  isAddress,
  maxUint160,
  maxUint256,
  parseUnits,
  type Address,
  type Hash,
} from 'viem'
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
  useWriteContract,
} from 'wagmi'
import { addChain } from 'viem/actions'
import {
  chainName,
  explorerAddressUrl,
  explorerName,
  explorerTxUrl,
} from '../chain-meta'
import { useI18n } from '../i18n'
import {
  BSC_TOKENS,
  ERC20_ABI,
  MIXED_QUOTER_ADDRESS,
  PERMIT2_ABI,
  PERMIT2_ADDRESS,
  PRIVACY_BSC_CHAIN,
  PRIVACY_RPC_URL,
  SWAP_CHAIN_ID,
  UNIVERSAL_ROUTER_ABI,
  UNIVERSAL_ROUTER_ADDRESS,
  applySlippage,
  buildSwapCall,
  findBestSwapRoute,
  resolveToken,
  wrappedAddress,
  type PoolRef,
  type SwapRoute,
  type SwapTokenInfo,
} from '../lib/pancake-swap'

type TxState =
  | { status: 'idle' }
  | { status: 'quoting' }
  | { status: 'approving-token' }
  | { status: 'approving-router' }
  | { status: 'swapping' }
  | { status: 'confirming'; hash: Hash }
  | { status: 'success'; hash: Hash }
  | { status: 'error'; message: string }

const SLIPPAGE_OPTIONS = [10, 50, 100, 200] as const

type RpcMessage = {
  tone: 'info' | 'success' | 'warning' | 'error'
  text: string
}

function formatAmount(
  value: bigint,
  decimals: number,
  maxFraction = 6,
): string {
  const raw = formatUnits(value, decimals)
  const [whole, fraction = ''] = raw.split('.')
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, '')
  if (!trimmed) {
    if (value > 0n && whole === '0') {
      return `<0.${'0'.repeat(Math.max(maxFraction - 1, 0))}1`
    }
    return whole
  }
  return `${whole}.${trimmed}`
}

function trimTrailingZeros(value: string) {
  return value.includes('.')
    ? value.replace(/0+$/, '').replace(/\.$/, '')
    : value
}

function sanitizeAmount(raw: string) {
  let next = raw.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const firstDot = next.indexOf('.')
  if (firstDot !== -1) {
    next =
      next.slice(0, firstDot + 1) +
      next.slice(firstDot + 1).replace(/\./g, '')
  }
  return next
}

function poolLabel(pool: PoolRef) {
  if (pool.kind === 'v2') return 'V2'
  return `V3 ${(pool.fee / 10_000).toFixed(2)}%`
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function symbolFor(address: Address, tokens: SwapTokenInfo[]) {
  return (
    tokens.find(
      (item) => item.address.toLowerCase() === address.toLowerCase(),
    )?.symbol ?? shortAddress(address)
  )
}

type TokenPickerProps = {
  value: SwapTokenInfo
  tokens: SwapTokenInfo[]
  adding: boolean
  error?: string
  onSelect: (token: SwapTokenInfo) => void
  onAdd: (address: Address) => Promise<boolean>
  onSearch: () => void
}

function TokenPicker({
  value,
  tokens,
  adding,
  error,
  onSelect,
  onAdd,
  onSearch,
}: TokenPickerProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [open])

  const trimmed = query.trim()
  const search = trimmed.toLowerCase()
  const filtered = tokens.filter((item) => {
    if (!search) return true
    return (
      item.symbol.toLowerCase().includes(search) ||
      item.name.toLowerCase().includes(search) ||
      item.address.toLowerCase() === search
    )
  })
  const isAddressQuery = isAddress(trimmed)
  const alreadyListed =
    isAddressQuery &&
    tokens.some(
      (item) => item.address.toLowerCase() === trimmed.toLowerCase(),
    )

  function pick(token: SwapTokenInfo) {
    onSelect(token)
    setOpen(false)
    setQuery('')
  }

  async function importToken() {
    if (!isAddressQuery) return
    const added = await onAdd(trimmed)
    if (added) {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="swap-picker" ref={rootRef}>
      <button
        className="swap-token-select"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="swap-token-symbol">{value.symbol}</span>
        <span className="swap-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="swap-token-menu">
          <input
            className="text-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              onSearch()
            }}
            placeholder={t('swap.searchToken')}
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />

          <div className="swap-token-list">
            {filtered.map((item) => (
              <button
                className={
                  item.address.toLowerCase() === value.address.toLowerCase()
                    ? 'swap-token-option active'
                    : 'swap-token-option'
                }
                type="button"
                key={item.address}
                onClick={() => pick(item)}
              >
                <span className="swap-token-option-symbol">
                  {item.symbol}
                </span>
                <span className="swap-token-option-name">{item.name}</span>
                {item.native && (
                  <span className="swap-token-option-tag">
                    {t('swap.nativeTag')}
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && !isAddressQuery && (
              <p className="muted small">{t('swap.noTokenMatch')}</p>
            )}
          </div>

          {isAddressQuery && !alreadyListed && (
            <button
              className="swap-token-import"
              type="button"
              disabled={adding}
              onClick={() => void importToken()}
            >
              {adding
                ? t('swap.importing')
                : t('swap.importToken', { address: shortAddress(trimmed) })}
            </button>
          )}

          {error && <p className="notice notice-error">{error}</p>}
        </div>
      )}
    </div>
  )
}

type PancakeSwapProps = {
  initialFrom?: Address
  initialTo?: Address
  initialChainUnsupported?: boolean
  initialInvalidToken?: boolean
  onTokensChange?: (from: Address, to: Address) => void
}

export function PancakeSwap({
  initialFrom,
  initialTo,
  initialChainUnsupported,
  initialInvalidToken,
  onTokensChange,
}: PancakeSwapProps) {
  const { t } = useI18n()
  const publicClient = usePublicClient({ chainId: SWAP_CHAIN_ID })
  const connection = useConnection()
  const connectors = useConnectors()
  const connect = useConnect()
  const { disconnect } = useDisconnect()
  const switchChain = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const { data: walletClient } = useWalletClient()

  // Wagmi restores the last connection before hydration finishes. Keep the
  // first client render identical to the prerendered HTML, then reveal it.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- reveal wallet state after hydration
    setHydrated(true)
  }, [])
  const walletConnected = hydrated && connection.isConnected
  const walletAddress = hydrated ? connection.address : undefined
  const walletChainId = hydrated ? connection.chainId : undefined

  const [fromToken, setFromToken] = useState<SwapTokenInfo>(BSC_TOKENS[0])
  const [toToken, setToToken] = useState<SwapTokenInfo>(
    BSC_TOKENS.find((item) => item.symbol === 'USDT') ?? BSC_TOKENS[1],
  )
  const [amount, setAmount] = useState('')
  const [slippageBps, setSlippageBps] = useState(50)
  const [customTokens, setCustomTokens] = useState<SwapTokenInfo[]>([])
  const [addingToken, setAddingToken] = useState(false)
  const [tokenError, setTokenError] = useState<string>()
  const [urlError, setUrlError] = useState<string>()
  const [tx, setTx] = useState<TxState>({ status: 'idle' })
  const [addingRpc, setAddingRpc] = useState(false)
  const [rpcMessage, setRpcMessage] = useState<RpcMessage>()
  const appliedUrl = useRef(false)

  // Apply tokens from a shareable link once, after hydration.
  useEffect(() => {
    if (appliedUrl.current) return
    if (
      !initialFrom &&
      !initialTo &&
      !initialChainUnsupported &&
      !initialInvalidToken
    ) {
      return
    }
    if (!publicClient) return
    appliedUrl.current = true

    let cancelled = false
    const errors: string[] = []

    async function fromUrl(
      address: Address | undefined,
    ): Promise<SwapTokenInfo | undefined> {
      if (!address) return undefined
      const known = BSC_TOKENS.find(
        (item) => item.address.toLowerCase() === address.toLowerCase(),
      )
      if (known) return known
      try {
        const info = await resolveToken(publicClient!, address)
        setCustomTokens((current) =>
          current.some(
            (item) => item.address.toLowerCase() === address.toLowerCase(),
          )
            ? current
            : [...current, info],
        )
        return info
      } catch {
        const short = `${address.slice(0, 6)}…${address.slice(-4)}`
        errors.push(t('swap.urlTokenError', { address: short }))
        return undefined
      }
    }

    if (initialChainUnsupported) errors.unshift(t('swap.urlChainError'))
    if (initialInvalidToken) errors.push(t('swap.urlInvalidToken'))

    void (async () => {
      const [from, to] = await Promise.all([
        fromUrl(initialFrom),
        fromUrl(initialTo),
      ])
      if (cancelled) return
      if (errors.length > 0) setUrlError(errors.join(' '))

      let nextFrom = from ?? BSC_TOKENS[0]
      const usdt =
        BSC_TOKENS.find((item) => item.symbol === 'USDT') ?? BSC_TOKENS[1]
      let nextTo = to ?? usdt
      if (
        wrappedAddress(nextFrom.address).toLowerCase() ===
        wrappedAddress(nextTo.address).toLowerCase()
      ) {
        // Keep whichever side the link resolved and fill the other one.
        if (from && !to) {
          nextTo = nextFrom.native ? usdt : BSC_TOKENS[0]
        } else if (!from && to) {
          nextFrom = nextTo.native ? usdt : BSC_TOKENS[0]
        } else if (nextFrom.native) {
          nextTo = usdt
        } else {
          nextFrom = BSC_TOKENS[0]
        }
      }
      setFromToken(nextFrom)
      setToToken(nextTo)
    })()

    return () => {
      cancelled = true
    }
  }, [
    initialFrom,
    initialTo,
    initialChainUnsupported,
    initialInvalidToken,
    publicClient,
    t,
  ])

  const tokens = useMemo(() => {
    const extra = customTokens.filter(
      (custom) =>
        !BSC_TOKENS.some(
          (item) =>
            item.address.toLowerCase() === custom.address.toLowerCase(),
        ),
    )
    return [...BSC_TOKENS, ...extra]
  }, [customTokens])

  const parsedAmount = useMemo<{
    value: bigint
    error?: string
  }>(() => {
    const trimmed = amount.trim()
    if (!trimmed) return { value: 0n }
    try {
      return { value: parseUnits(trimmed, fromToken.decimals) }
    } catch {
      return { value: 0n, error: t('swap.invalidAmount') }
    }
  }, [amount, fromToken.decimals, t])

  const [quoteAmount, setQuoteAmount] = useState(0n)
  useEffect(() => {
    const timer = window.setTimeout(
      () => setQuoteAmount(parsedAmount.value),
      400,
    )
    return () => window.clearTimeout(timer)
  }, [parsedAmount.value])

  const sameAsset =
    wrappedAddress(fromToken.address).toLowerCase() ===
    wrappedAddress(toToken.address).toLowerCase()

  const readBalance = async (token: SwapTokenInfo) => {
    if (!publicClient || !connection.address) return 0n
    if (token.native) {
      return publicClient.getBalance({ address: connection.address })
    }
    return publicClient.readContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [connection.address],
    })
  }

  const fromBalanceQuery = useQuery({
    queryKey: [
      'swap-balance',
      SWAP_CHAIN_ID,
      connection.address,
      fromToken.address,
    ],
    enabled: Boolean(publicClient && connection.address),
    queryFn: () => readBalance(fromToken),
    refetchInterval: 20_000,
  })

  const toBalanceQuery = useQuery({
    queryKey: [
      'swap-balance',
      SWAP_CHAIN_ID,
      connection.address,
      toToken.address,
    ],
    enabled: Boolean(publicClient && connection.address),
    queryFn: () => readBalance(toToken),
    refetchInterval: 20_000,
  })

  const allowanceQuery = useQuery({
    queryKey: [
      'swap-allowance',
      SWAP_CHAIN_ID,
      connection.address,
      fromToken.address,
    ],
    enabled: Boolean(
      publicClient && connection.address && !fromToken.native,
    ),
    queryFn: async () => {
      if (!publicClient || !connection.address) {
        throw new Error('missing wallet')
      }
      const [erc20, permit2] = await publicClient.multicall({
        allowFailure: false,
        contracts: [
          {
            address: fromToken.address,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [connection.address, PERMIT2_ADDRESS],
          },
          {
            address: PERMIT2_ADDRESS,
            abi: PERMIT2_ABI,
            functionName: 'allowance',
            args: [
              connection.address,
              fromToken.address,
              UNIVERSAL_ROUTER_ADDRESS,
            ],
          },
        ],
      })
      return {
        erc20,
        permit2Amount: permit2[0],
        permit2Active:
          permit2[1] > Math.floor(Date.now() / 1000),
      }
    },
  })

  const quoteQuery = useQuery({
    queryKey: [
      'swap-quote',
      SWAP_CHAIN_ID,
      fromToken.address,
      toToken.address,
      quoteAmount.toString(),
    ],
    enabled: Boolean(
      publicClient && quoteAmount > 0n && !sameAsset,
    ),
    queryFn: async (): Promise<SwapRoute | null> => {
      if (!publicClient) throw new Error('missing client')
      return findBestSwapRoute(
        publicClient,
        fromToken.address,
        toToken.address,
        quoteAmount,
      )
    },
    retry: 1,
  })

  const route = quoteQuery.data ?? null
  const fromBalance = fromBalanceQuery.data ?? 0n
  const toBalance = toBalanceQuery.data ?? 0n
  const wrongChain =
    walletConnected &&
    walletChainId !== undefined &&
    walletChainId !== SWAP_CHAIN_ID
  const busy =
    tx.status === 'quoting' ||
    tx.status === 'approving-token' ||
    tx.status === 'approving-router' ||
    tx.status === 'swapping' ||
    tx.status === 'confirming'

  const tokenApproved =
    fromToken.native ||
    (allowanceQuery.data !== undefined &&
      allowanceQuery.data.erc20 >= parsedAmount.value)
  const routerApproved =
    fromToken.native ||
    (allowanceQuery.data !== undefined &&
      allowanceQuery.data.permit2Amount >= parsedAmount.value &&
      allowanceQuery.data.permit2Active)

  function handleConnect() {
    const connector = connectors[0]
    if (!connector) return
    connect.mutate({ connector })
  }

  function handleMax() {
    if (fromBalance === 0n) return
    let max = fromBalance
    if (fromToken.native) {
      const reserve = 3_000_000_000_000_000n // 0.003 BNB for gas
      max = fromBalance > reserve ? fromBalance - reserve : 0n
    }
    setAmount(trimTrailingZeros(formatUnits(max, fromToken.decimals)))
  }

  function handleFlip() {
    const nextAmount = route
      ? trimTrailingZeros(formatUnits(route.amountOut, toToken.decimals))
      : ''
    setFromToken(toToken)
    setToToken(fromToken)
    setAmount(nextAmount)
    if (!nextAmount) setQuoteAmount(0n)
    setTx({ status: 'idle' })
    setUrlError(undefined)
    onTokensChange?.(toToken.address, fromToken.address)
  }

  async function addToken(
    side: 'from' | 'to',
    address: Address,
  ): Promise<boolean> {
    if (!publicClient) return false
    setAddingToken(true)
    setTokenError(undefined)
    try {
      const info = await resolveToken(publicClient, address)
      setCustomTokens((current) =>
        current.some(
          (item) => item.address.toLowerCase() === address.toLowerCase(),
        )
          ? current
          : [...current, info],
      )
      if (side === 'from') {
        let nextTo = toToken
        if (toToken.address.toLowerCase() === address.toLowerCase()) {
          nextTo = BSC_TOKENS[1]
          setToToken(nextTo)
        }
        setFromToken(info)
        setUrlError(undefined)
        onTokensChange?.(info.address, nextTo.address)
      } else {
        let nextFrom = fromToken
        if (fromToken.address.toLowerCase() === address.toLowerCase()) {
          nextFrom = BSC_TOKENS[0]
          setFromToken(nextFrom)
        }
        setToToken(info)
        setUrlError(undefined)
        onTokensChange?.(nextFrom.address, info.address)
      }
      return true
    } catch {
      setTokenError(t('swap.tokenError'))
      return false
    } finally {
      setAddingToken(false)
    }
  }

  function describeError(error: unknown) {
    const raw =
      error instanceof Error ? error.message : String(error)
    const short =
      (error as { shortMessage?: string } | null)?.shortMessage ?? raw
    if (/user rejected|user denied|rejected the request/i.test(short)) {
      return t('swap.rejected')
    }
    if (/insufficient funds/i.test(short)) {
      return t('swap.insufficientFunds')
    }
    if (
      /TooLittleReceived|INSUFFICIENT_OUTPUT_AMOUNT|TooMuchRequested|Too little received/i.test(
        short,
      )
    ) {
      return t('swap.slippageError')
    }
    return short.length > 260 ? `${short.slice(0, 260)}…` : short
  }

  async function copyRpcUrl(): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(PRIVACY_RPC_URL)
        return true
      }
    } catch {
      // Fall back to a temporary textarea below.
    }
    try {
      const area = document.createElement('textarea')
      area.value = PRIVACY_RPC_URL
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const copied = document.execCommand('copy')
      area.remove()
      return copied
    } catch {
      return false
    }
  }

  async function handleCopyRpc() {
    const copied = await copyRpcUrl()
    setRpcMessage(
      copied
        ? { tone: 'success', text: t('swap.rpcCopied') }
        : { tone: 'warning', text: t('swap.rpcCopyFailed') },
    )
  }

  async function handleAddRpc() {
    if (!walletConnected) {
      handleConnect()
      return
    }
    if (!walletClient || addingRpc) return

    setAddingRpc(true)
    setRpcMessage(undefined)
    try {
      await addChain(walletClient, { chain: PRIVACY_BSC_CHAIN })
      setRpcMessage({ tone: 'success', text: t('swap.rpcAdded') })
    } catch (error) {
      const detail = [
        (error as { shortMessage?: string } | null)?.shortMessage,
        error instanceof Error ? error.message : String(error),
        (error as { cause?: { message?: string } } | null)?.cause?.message,
      ]
        .filter(Boolean)
        .join(' ')
      if (/user rejected|user denied|rejected the request|4001/i.test(detail)) {
        setRpcMessage({ tone: 'warning', text: t('swap.rejected') })
        return
      }
      if (/already|duplicate|same chain|exists/i.test(detail)) {
        const copied = await copyRpcUrl()
        setRpcMessage({
          tone: 'info',
          text: copied
            ? t('swap.rpcExists')
            : `${t('swap.rpcExists')} ${t('swap.rpcCopyFailed')}`,
        })
        return
      }
      setRpcMessage({
        tone: 'error',
        text: t('swap.rpcError', { message: describeError(error) }),
      })
    } finally {
      setAddingRpc(false)
    }
  }

  async function handleSwap() {
    if (!publicClient || !connection.address) {
      setTx({ status: 'error', message: t('swap.connectFirst') })
      return
    }
    if (parsedAmount.error || parsedAmount.value <= 0n) {
      setTx({ status: 'error', message: t('swap.invalidAmount') })
      return
    }
    if (sameAsset) {
      setTx({ status: 'error', message: t('swap.sameToken') })
      return
    }
    if (parsedAmount.value > fromBalance) {
      setTx({ status: 'error', message: t('swap.insufficientBalance') })
      return
    }

    try {
      if (connection.chainId !== SWAP_CHAIN_ID) {
        await switchChain.mutateAsync({ chainId: SWAP_CHAIN_ID })
      }

      if (!fromToken.native) {
        const erc20Allowance = await publicClient.readContract({
          address: fromToken.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [connection.address, PERMIT2_ADDRESS],
        })
        if (erc20Allowance < parsedAmount.value) {
          setTx({ status: 'approving-token' })
          const approveHash = await writeContractAsync({
            address: fromToken.address,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [PERMIT2_ADDRESS, maxUint256],
            account: connection.address,
            chainId: SWAP_CHAIN_ID,
          })
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: approveHash,
          })
          if (receipt.status !== 'success') {
            throw new Error('approve reverted')
          }
        }

        const permit2Allowance = await publicClient.readContract({
          address: PERMIT2_ADDRESS,
          abi: PERMIT2_ABI,
          functionName: 'allowance',
          args: [
            connection.address,
            fromToken.address,
            UNIVERSAL_ROUTER_ADDRESS,
          ],
        })
        const nowSeconds = Math.floor(Date.now() / 1000)
        if (
          permit2Allowance[0] < parsedAmount.value ||
          permit2Allowance[1] <= nowSeconds
        ) {
          setTx({ status: 'approving-router' })
          const approveHash = await writeContractAsync({
            address: PERMIT2_ADDRESS,
            abi: PERMIT2_ABI,
            functionName: 'approve',
            args: [
              fromToken.address,
              UNIVERSAL_ROUTER_ADDRESS,
              maxUint160,
              2 ** 48 - 1,
            ],
            account: connection.address,
            chainId: SWAP_CHAIN_ID,
          })
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: approveHash,
          })
          if (receipt.status !== 'success') {
            throw new Error('permit2 approve reverted')
          }
        }

        void allowanceQuery.refetch()
      }

      setTx({ status: 'quoting' })
      const fresh = await findBestSwapRoute(
        publicClient,
        fromToken.address,
        toToken.address,
        parsedAmount.value,
      )
      if (!fresh) {
        setTx({ status: 'error', message: t('swap.noRoute') })
        return
      }

      const call = buildSwapCall(
        fresh,
        connection.address,
        slippageBps,
        Boolean(fromToken.native),
        Boolean(toToken.native),
      )

      // Dry-run the router call so failures surface before the wallet prompt.
      await publicClient.call({
        account: connection.address,
        to: UNIVERSAL_ROUTER_ADDRESS,
        data: encodeFunctionData({
          abi: UNIVERSAL_ROUTER_ABI,
          functionName: 'execute',
          args: [call.commands, call.inputs],
        }),
        value: call.value,
      })

      setTx({ status: 'swapping' })
      const hash = await writeContractAsync({
        address: UNIVERSAL_ROUTER_ADDRESS,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: 'execute',
        args: [call.commands, call.inputs],
        value: call.value,
        account: connection.address,
        chainId: SWAP_CHAIN_ID,
      })

      setTx({ status: 'confirming', hash })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error(t('swap.reverted'))
      }

      setTx({ status: 'success', hash })
      await Promise.all([
        fromBalanceQuery.refetch(),
        toBalanceQuery.refetch(),
        allowanceQuery.refetch(),
        quoteQuery.refetch(),
      ])
    } catch (error) {
      setTx({ status: 'error', message: describeError(error) })
    }
  }

  const amountOut = route
    ? formatAmount(route.amountOut, toToken.decimals, 8)
    : ''
  const amountChanged = quoteAmount !== parsedAmount.value
  const minReceived = route
    ? formatAmount(
        applySlippage(route.amountOut, slippageBps),
        toToken.decimals,
        8,
      )
    : ''
  const rate =
    route && quoteAmount > 0n
      ? formatAmount(
          (route.amountOut * 10n ** BigInt(fromToken.decimals)) /
            quoteAmount,
          toToken.decimals,
        )
      : ''
  const fromBalanceLabel = walletAddress
    ? formatAmount(fromBalance, fromToken.decimals, 4)
    : '—'
  const toBalanceLabel = walletAddress
    ? formatAmount(toBalance, toToken.decimals, 4)
    : '—'

  const insufficientBalance =
    walletAddress !== undefined &&
    parsedAmount.value > 0n &&
    parsedAmount.value > fromBalance

  let buttonLabel: string = t('swap.submit')
  let buttonDisabled = busy
  if (!walletConnected) {
    buttonLabel =
      connectors.length === 0
        ? t('common.noWallet')
        : connect.isPending
          ? t('common.connecting')
          : t('swap.connectFirst')
    buttonDisabled = true
  } else if (wrongChain) {
    buttonLabel = t('swap.switchNetwork')
    buttonDisabled = false
  } else if (parsedAmount.error) {
    buttonLabel = t('swap.invalidAmount')
    buttonDisabled = true
  } else if (parsedAmount.value <= 0n) {
    buttonLabel = t('swap.enterAmount')
    buttonDisabled = true
  } else if (sameAsset) {
    buttonLabel = t('swap.sameToken')
    buttonDisabled = true
  } else if (insufficientBalance) {
    buttonLabel = t('swap.insufficientBalance')
    buttonDisabled = true
  } else if (!route) {
    buttonLabel = quoteQuery.isFetching
      ? t('swap.quoting')
      : t('swap.noRoute')
    buttonDisabled = true
  } else if (busy) {
    buttonLabel =
      tx.status === 'approving-token'
        ? t('swap.statusApprovingToken')
        : tx.status === 'approving-router'
          ? t('swap.statusApprovingRouter')
          : tx.status === 'confirming'
            ? t('swap.statusConfirming')
            : t('swap.statusSwapping')
  }

  function onPrimaryAction() {
    if (!walletConnected) {
      handleConnect()
      return
    }
    if (wrongChain) {
      switchChain.mutate(
        { chainId: SWAP_CHAIN_ID },
        {
          onError: (error) =>
            setTx({ status: 'error', message: describeError(error) }),
        },
      )
      return
    }
    void handleSwap()
  }

  return (
    <section className="panel swap-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{t('swap.eyebrow')}</p>
          <h2>{t('swap.title')}</h2>
        </div>
        <div className="swap-head-meta">
          <span className="network-chip">{chainName(SWAP_CHAIN_ID)}</span>
          {walletConnected ? (
            <div className="wallet-pill">
              <span className="dot" />
              <span className="mono">
                {walletAddress ? shortAddress(walletAddress) : ''}
              </span>
              <button
                className="link-button"
                type="button"
                onClick={() => disconnect()}
              >
                {t('common.disconnect')}
              </button>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={handleConnect}
              disabled={connect.isPending || connectors.length === 0}
            >
              {connect.isPending
                ? t('common.connecting')
                : connectors.length === 0
                  ? t('common.noWallet')
                  : t('common.connectWallet')}
            </button>
          )}
          {walletConnected && wrongChain && (
            <button
              className="link-button swap-chain-warning"
              type="button"
              onClick={() => switchChain.mutate({ chainId: SWAP_CHAIN_ID })}
            >
              {t('swap.switchNetwork')}
            </button>
          )}
        </div>
      </div>

      <p className="swap-lede">{t('swap.lede')}</p>

      {urlError && <p className="notice notice-warning">{urlError}</p>}

      <div className="swap-layout">
        <div className="swap-form">
          <div className="swap-token-card">
            <div className="swap-token-card-head">
              <span>{t('swap.from')}</span>
              <span className="swap-balance">
                {t('swap.balance')} {fromBalanceLabel}
              </span>
            </div>
            <div className="swap-token-row">
              <input
                className="swap-amount-input"
                value={amount}
                onChange={(event) => {
                  const next = sanitizeAmount(event.target.value)
                  setAmount(next)
                  if (!next.trim()) setQuoteAmount(0n)
                  if (tx.status === 'success' || tx.status === 'error') {
                    setTx({ status: 'idle' })
                  }
                }}
                placeholder="0.0"
                inputMode="decimal"
                spellCheck={false}
                autoComplete="off"
                aria-label={t('swap.amount')}
              />
              <TokenPicker
                value={fromToken}
                tokens={tokens}
                adding={addingToken}
                error={tokenError}
                onSelect={(token) => {
                  setFromToken(token)
                  setTx({ status: 'idle' })
                  setUrlError(undefined)
                  onTokensChange?.(token.address, toToken.address)
                }}
                onAdd={(address) => addToken('from', address)}
                onSearch={() => setTokenError(undefined)}
              />
            </div>
            <div className="swap-token-card-foot">
              <span className="muted small">
                {fromToken.native
                  ? t('swap.nativeHint')
                  : fromToken.name}
              </span>
              <button
                className="link-button"
                type="button"
                onClick={handleMax}
                disabled={fromBalance === 0n}
              >
                {t('swap.max')}
              </button>
            </div>
          </div>

          <button
            className="swap-flip"
            type="button"
            onClick={handleFlip}
            aria-label={t('swap.flip')}
            title={t('swap.flip')}
          >
            ⇅
          </button>

          <div className="swap-token-card">
            <div className="swap-token-card-head">
              <span>{t('swap.to')}</span>
              <span className="swap-balance">
                {t('swap.balance')} {toBalanceLabel}
              </span>
            </div>
            <div className="swap-token-row">
              <div className="swap-amount-output" aria-live="polite">
                {amountChanged
                  ? '…'
                  : amountOut ||
                    (quoteQuery.isFetching && quoteAmount > 0n
                      ? '…'
                      : '0.0')}
              </div>
              <TokenPicker
                value={toToken}
                tokens={tokens}
                adding={addingToken}
                error={tokenError}
                onSelect={(token) => {
                  setToToken(token)
                  setTx({ status: 'idle' })
                  setUrlError(undefined)
                  onTokensChange?.(fromToken.address, token.address)
                }}
                onAdd={(address) => addToken('to', address)}
                onSearch={() => setTokenError(undefined)}
              />
            </div>
            <div className="swap-token-card-foot">
              <span className="muted small">
                {toToken.native ? t('swap.nativeHint') : toToken.name}
              </span>
            </div>
          </div>

          {parsedAmount.error && (
            <p className="notice notice-error">{parsedAmount.error}</p>
          )}
          {sameAsset && (
            <p className="notice notice-warning">{t('swap.sameToken')}</p>
          )}
          {insufficientBalance && (
            <p className="notice notice-warning">
              {t('swap.insufficientBalance')}
            </p>
          )}
        </div>

        <div className="swap-quote">
          <div className="swap-quote-head">
            <h3>{t('swap.quoteTitle')}</h3>
            <button
              className="link-button"
              type="button"
              onClick={() => void quoteQuery.refetch()}
              disabled={
                !publicClient || quoteAmount === 0n || quoteQuery.isFetching
              }
            >
              {quoteQuery.isFetching
                ? t('common.refreshing')
                : t('common.refresh')}
            </button>
          </div>

          {quoteAmount === 0n ? (
            <p className="swap-quote-empty">{t('swap.emptyQuote')}</p>
          ) : quoteQuery.isError ? (
            <p className="notice notice-error">
              {t('swap.quoteError', {
                message: describeError(quoteQuery.error),
              })}
            </p>
          ) : quoteQuery.isFetching && !route ? (
            <div className="status-box status-loading">
              <span className="spinner" /> {t('swap.quoting')}
            </div>
          ) : route ? (
            <>
              <div className="swap-out">
                <span className="swap-out-label">
                  {t('swap.expectedOut')}
                </span>
                <strong>
                  {amountOut}{' '}
                  <span className="swap-out-symbol">
                    {toToken.symbol}
                  </span>
                </strong>
              </div>

              <div className="swap-route">
                <span className="swap-route-token">{fromToken.symbol}</span>
                {route.hops.map((hop, index) => (
                  <span className="swap-route-step" key={index}>
                    <span
                      className={
                        hop.pool.kind === 'v2'
                          ? 'swap-pool swap-pool-v2'
                          : 'swap-pool swap-pool-v3'
                      }
                    >
                      {poolLabel(hop.pool)}
                    </span>
                    <span className="swap-route-arrow" aria-hidden="true">
                      →
                    </span>
                    <span className="swap-route-token">
                      {index === route.hops.length - 1
                        ? toToken.symbol
                        : symbolFor(hop.tokenOut, tokens)}
                    </span>
                  </span>
                ))}
              </div>

              <dl className="swap-facts">
                <div>
                  <dt>{t('swap.minReceived')}</dt>
                  <dd>
                    {minReceived} {toToken.symbol}
                  </dd>
                </div>
                <div>
                  <dt>{t('swap.rate')}</dt>
                  <dd>
                    1 {fromToken.symbol} ≈ {rate} {toToken.symbol}
                  </dd>
                </div>
                <div>
                  <dt>{t('swap.slippage')}</dt>
                  <dd>
                    <select
                      className="swap-slippage"
                      value={slippageBps}
                      onChange={(event) =>
                        setSlippageBps(Number(event.target.value))
                      }
                      aria-label={t('swap.slippage')}
                    >
                      {SLIPPAGE_OPTIONS.map((bps) => (
                        <option key={bps} value={bps}>
                          {bps / 100}%
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="notice notice-info">{t('swap.noRoute')}</p>
          )}

          {walletConnected &&
            !fromToken.native &&
            parsedAmount.value > 0n && (
              <div className="swap-approvals">
                <span
                  className={
                    tokenApproved ? 'swap-check ok' : 'swap-check warn'
                  }
                >
                  {tokenApproved
                    ? t('swap.approvedToken')
                    : t('swap.needTokenApproval')}
                </span>
                <span
                  className={
                    routerApproved ? 'swap-check ok' : 'swap-check warn'
                  }
                >
                  {routerApproved
                    ? t('swap.approvedRouter')
                    : t('swap.needRouterApproval')}
                </span>
              </div>
            )}

          {connect.isError && (
            <p className="notice notice-error">
              {/provider not found|no provider|not installed/i.test(
                connect.error.message,
              )
                ? t('common.noWallet')
                : t('common.walletConnectFailed', {
                    message: connect.error.message,
                  })}
            </p>
          )}

          <button
            className="btn btn-primary swap-submit"
            type="button"
            disabled={buttonDisabled}
            onClick={onPrimaryAction}
          >
            {buttonLabel}
          </button>

          {tx.status !== 'idle' && (
            <div
              className={`notice ${
                tx.status === 'error'
                  ? 'notice-error'
                  : tx.status === 'success'
                    ? 'notice-success'
                    : 'notice-info'
              }`}
            >
              {tx.status === 'quoting' && t('swap.statusQuoting')}
              {tx.status === 'approving-token' &&
                t('swap.statusApprovingToken')}
              {tx.status === 'approving-router' &&
                t('swap.statusApprovingRouter')}
              {tx.status === 'swapping' && t('swap.statusSwapping')}
              {tx.status === 'confirming' && tx.hash && (
                <>
                  {t('swap.statusConfirming')}{' '}
                  <a
                    className="inline-link"
                    href={explorerTxUrl(SWAP_CHAIN_ID, tx.hash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('swap.viewTx')}
                  </a>
                </>
              )}
              {tx.status === 'success' && (
                <>
                  {t('swap.statusSuccess')}{' '}
                  <a
                    className="inline-link"
                    href={explorerTxUrl(SWAP_CHAIN_ID, tx.hash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('swap.viewTx')}
                  </a>
                </>
              )}
              {tx.status === 'error' && (
                <>
                  <strong>{t('swap.statusFailed')}</strong>
                  <p className="break">{tx.message}</p>
                </>
              )}
            </div>
          )}

          {!fromToken.native && (
            <p className="muted small swap-approve-hint">
              {t('swap.approveHint')}
            </p>
          )}
        </div>
      </div>

      <div className="swap-rpc">
        <div className="swap-rpc-head">
          <span className="swap-rpc-icon" aria-hidden="true">
            🛡
          </span>
          <div>
            <strong>{t('swap.rpcTitle')}</strong>
            <p className="muted small swap-rpc-desc">{t('swap.rpcDesc')}</p>
          </div>
        </div>
        <div className="swap-rpc-actions">
          <code className="swap-rpc-url">{PRIVACY_RPC_URL}</code>
          <div className="swap-rpc-buttons">
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => void handleCopyRpc()}
            >
              {t('swap.rpcCopy')}
            </button>
            {walletConnected ? (
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => void handleAddRpc()}
                disabled={addingRpc}
              >
                {addingRpc ? t('swap.rpcAdding') : t('swap.rpcAdd')}
              </button>
            ) : (
              <span className="muted small swap-rpc-hint">
                {t('swap.rpcConnectFirst')}
              </span>
            )}
          </div>
        </div>
        {rpcMessage && (
          <p
            className={`notice notice-${rpcMessage.tone}`}
            role="status"
          >
            {rpcMessage.text}
          </p>
        )}
      </div>

      <div className="swap-contracts">
        <span className="muted small">{t('swap.contractsLabel')}</span>
        <a
          className="inline-link mono small"
          href={explorerAddressUrl(SWAP_CHAIN_ID, UNIVERSAL_ROUTER_ADDRESS)}
          target="_blank"
          rel="noreferrer"
        >
          UniversalRouter {shortAddress(UNIVERSAL_ROUTER_ADDRESS)}
        </a>
        <a
          className="inline-link mono small"
          href={explorerAddressUrl(SWAP_CHAIN_ID, MIXED_QUOTER_ADDRESS)}
          target="_blank"
          rel="noreferrer"
        >
          MixedQuoter {shortAddress(MIXED_QUOTER_ADDRESS)}
        </a>
        <span className="muted small">
          {explorerName(SWAP_CHAIN_ID)}
        </span>
        <p className="muted small swap-disclaimer">{t('swap.disclaimer')}</p>
      </div>
    </section>
  )
}
