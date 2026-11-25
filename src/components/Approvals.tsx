'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAddress, isAddress, type Hex } from 'viem'
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from 'wagmi'
import { chainName, explorerAddressUrl, explorerTxUrl } from '../chain-meta'
import { useI18n } from '../i18n'
import {
  APPROVALS_CHAIN_ID,
  ApprovalError,
  erc20ApprovalAbi,
  formatApprovalAmount,
  formatApprovalDate,
  formatTokenAmount,
  isRiskyApproval,
  prepareRevoke,
  readAllowance,
  scanApprovals,
  shortAddress,
  withUpdatedAllowance,
  withoutApproval,
  type ApprovalErrorCode,
  type ApprovalScan,
  type TokenApproval,
} from '../lib/approvals'
import { CopyButton } from './CopyButton'

type ScanState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; code: ApprovalErrorCode }
  | { status: 'ready'; scan: ApprovalScan }

type RevokeEntry =
  | { status: 'simulating' }
  | { status: 'sending' }
  | { status: 'pending'; hash: Hex }
  | { status: 'success'; hash: Hex }
  | {
      status: 'error'
      code: 'rejected' | 'insufficient' | 'failed' | 'still'
      message?: string
      hash?: Hex
    }

type Filter = 'all' | 'unlimited' | 'risk'

function describeError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)
  const short =
    (error as { shortMessage?: string } | null)?.shortMessage ?? raw
  if (/user rejected|user denied|rejected the request/i.test(short)) {
    return { code: 'rejected' as const, message: '' }
  }
  if (/insufficient funds/i.test(short)) {
    return { code: 'insufficient' as const, message: '' }
  }
  return {
    code: 'failed' as const,
    message: short.length > 220 ? `${short.slice(0, 220)}…` : short,
  }
}

export function Approvals() {
  const { t } = useI18n()
  const publicClient = usePublicClient({ chainId: APPROVALS_CHAIN_ID })
  const connection = useConnection()
  const connectors = useConnectors()
  const connect = useConnect()
  const { disconnect } = useDisconnect()
  const switchChain = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  // Keep the first client render identical to the prerendered HTML.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- reveal wallet state after hydration
    setHydrated(true)
  }, [])

  const walletConnected = hydrated && connection.isConnected
  const walletAddress = hydrated ? connection.address : undefined
  const walletChainId = connection.chainId

  const [input, setInput] = useState('')
  const [state, setState] = useState<ScanState>({ status: 'idle' })
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [revokes, setRevokes] = useState<Record<string, RevokeEntry>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [lastSuccess, setLastSuccess] = useState<{
    symbol: string
    hash: Hex
  } | null>(null)

  const controllerRef = useRef<AbortController | null>(null)
  const revokeInFlight = useRef(false)
  const booted = useRef(false)

  const runScan = useCallback(
    async (raw: string) => {
      const value = raw.trim()
      if (!isAddress(value)) {
        setState({ status: 'error', code: 'invalid' })
        return
      }
      if (!publicClient) {
        setState({ status: 'error', code: 'network' })
        return
      }

      const owner = getAddress(value)
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      setState({ status: 'loading' })
      setFilter('all')
      setQuery('')
      setRevokes({})
      setLastSuccess(null)

      try {
        const scan = await scanApprovals(publicClient, owner, controller.signal)
        if (controller.signal.aborted) return

        setState({ status: 'ready', scan })
        setInput(owner)

        const url = new URL(window.location.href)
        url.searchParams.set('address', scan.owner.toLowerCase())
        window.history.replaceState(null, '', url)
      } catch (error) {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          code: error instanceof ApprovalError ? error.code : 'network',
        })
      }
    },
    [publicClient],
  )

  useEffect(() => {
    if (!hydrated || !publicClient || booted.current) return
    booted.current = true

    const initial = new URLSearchParams(window.location.search).get('address')
    if (!initial) return
    // oxlint-disable-next-line react/set-state-in-effect -- read query params after hydration
    setInput(initial)
    void runScan(initial)
  }, [hydrated, publicClient, runScan])

  useEffect(() => {
    if (!hydrated || !walletAddress) return
    // oxlint-disable-next-line react/set-state-in-effect -- prefill the wallet address once
    setInput((current) => (current.trim() ? current : walletAddress))
  }, [hydrated, walletAddress])

  const scan = state.status === 'ready' ? state.scan : undefined
  const ownsView = Boolean(
    scan &&
      walletConnected &&
      walletAddress &&
      scan.owner.toLowerCase() === walletAddress.toLowerCase(),
  )
  const wrongChain =
    walletConnected &&
    walletChainId !== undefined &&
    walletChainId !== APPROVALS_CHAIN_ID

  const counts = useMemo(() => {
    const rows = scan?.rows ?? []
    const tokens = new Set<string>()
    let unlimited = 0
    let risky = 0

    for (const row of rows) {
      tokens.add(row.token.toLowerCase())
      if (row.unlimited) unlimited += 1
      if (isRiskyApproval(row)) risky += 1
    }

    return { total: rows.length, unlimited, risky, tokens: tokens.size }
  }, [scan])

  const visibleRows = useMemo(() => {
    if (!scan) return []
    const term = query.trim().toLowerCase()

    return scan.rows.filter((row) => {
      if (filter === 'unlimited' && !row.unlimited) return false
      if (filter === 'risk' && !isRiskyApproval(row)) return false
      if (!term) return true

      return (
        row.symbol.toLowerCase().includes(term) ||
        row.name.toLowerCase().includes(term) ||
        row.spender.toLowerCase().includes(term) ||
        (row.spenderName?.toLowerCase().includes(term) ?? false) ||
        (row.spenderTag?.toLowerCase().includes(term) ?? false)
      )
    })
  }, [filter, query, scan])

  function handleConnect() {
    const connector = connectors[0]
    if (!connector) return
    connect.mutate({ connector })
  }

  function updateRevoke(key: string, entry: RevokeEntry) {
    setRevokes((current) => ({ ...current, [key]: entry }))
  }

  async function handleRevoke(row: TokenApproval) {
    if (!walletConnected) {
      handleConnect()
      return
    }
    if (!ownsView || !walletAddress || revokeInFlight.current || !publicClient) {
      return
    }

    revokeInFlight.current = true
    setBusyKey(row.key)
    updateRevoke(row.key, { status: 'simulating' })

    try {
      if (walletChainId !== APPROVALS_CHAIN_ID) {
        await switchChain.mutateAsync({ chainId: APPROVALS_CHAIN_ID })
      }

      const prepared = await prepareRevoke(publicClient, walletAddress, row)
      updateRevoke(row.key, { status: 'sending' })

      const hash =
        prepared.functionName === 'approve'
          ? await writeContractAsync({
              address: row.token,
              abi: erc20ApprovalAbi,
              functionName: 'approve',
              args: prepared.args,
              chainId: APPROVALS_CHAIN_ID,
            })
          : await writeContractAsync({
              address: row.token,
              abi: erc20ApprovalAbi,
              functionName: 'decreaseAllowance',
              args: prepared.args,
              chainId: APPROVALS_CHAIN_ID,
            })

      updateRevoke(row.key, { status: 'pending', hash })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        updateRevoke(row.key, { status: 'error', code: 'failed', hash })
        return
      }

      let remaining: bigint | undefined
      try {
        remaining = await readAllowance(publicClient, walletAddress, row)
      } catch {
        remaining = undefined
      }

      if (remaining === 0n) {
        updateRevoke(row.key, { status: 'success', hash })
        setLastSuccess({ symbol: row.symbol, hash })
        setState((current) =>
          current.status === 'ready'
            ? { ...current, scan: withoutApproval(current.scan, row.key) }
            : current,
        )
        return
      }

      if (remaining !== undefined) {
        setState((current) =>
          current.status === 'ready'
            ? {
                ...current,
                scan: withUpdatedAllowance(current.scan, row.key, remaining),
              }
            : current,
        )
      }

      updateRevoke(row.key, {
        status: 'error',
        code: 'still',
        hash,
        message:
          remaining !== undefined
            ? formatTokenAmount(remaining, row.decimals)
            : undefined,
      })
    } catch (error) {
      const described = describeError(error)
      updateRevoke(row.key, {
        status: 'error',
        code: described.code,
        message: described.message,
      })
    } finally {
      revokeInFlight.current = false
      setBusyKey(null)
    }
  }

  function revokeLabel(row: TokenApproval) {
    const entry = revokes[row.key]
    if (entry) {
      if (entry.status === 'simulating') return t('approvals.revokeSimulating')
      if (entry.status === 'sending') return t('approvals.revokeSending')
      if (entry.status === 'pending') return t('approvals.revokePending')
      if (entry.status === 'success') return t('approvals.revokeSuccess')
      if (entry.status === 'error') return t('approvals.revokeRetry')
    }
    if (!walletConnected) {
      return connectors.length === 0
        ? t('common.noWallet')
        : t('common.connectWallet')
    }
    if (!ownsView) return t('approvals.revoke')
    if (wrongChain) return t('approvals.switchAndRevoke')
    return t('approvals.revoke')
  }

  function revokeError(entry: Extract<RevokeEntry, { status: 'error' }>) {
    if (entry.code === 'rejected') return t('approvals.revokeRejected')
    if (entry.code === 'insufficient') return t('approvals.revokeInsufficient')
    if (entry.code === 'still') {
      return t('approvals.revokeStill', { amount: entry.message ?? '—' })
    }
    return t('approvals.revokeFailed', { message: entry.message ?? '—' })
  }

  const ownerUrl = scan
    ? explorerAddressUrl(APPROVALS_CHAIN_ID, scan.owner)
    : undefined

  return (
    <>
      <section className="panel approvals-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">{t('approvals.eyebrow')}</p>
            <h2>{t('approvals.title')}</h2>
          </div>
          <span className="network-chip">BNB Chain</span>
        </div>

        <p className="swap-lede">{t('approvals.lede')}</p>

        <form
          className="search-row approvals-search"
          onSubmit={(event) => {
            event.preventDefault()
            if (input.trim()) void runScan(input)
          }}
        >
          <input
            className="text-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('approvals.placeholder')}
            spellCheck={false}
            autoComplete="off"
            aria-label={t('approvals.placeholder')}
            aria-invalid={state.status === 'error' && state.code === 'invalid'}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={state.status === 'loading' || !input.trim()}
          >
            {state.status === 'loading'
              ? t('approvals.scanning')
              : t('approvals.scan')}
          </button>
        </form>
        <p className="tx-search-hint">{t('approvals.hint')}</p>

        <div className="approvals-wallet-row">
          {walletConnected ? (
            <div className="wallet-pill">
              <span className="dot" />
              <span className="mono">
                {walletAddress ? shortAddress(walletAddress) : ''}
              </span>
              <span className="approvals-chain-chip">
                {walletChainId ? chainName(walletChainId) : '—'}
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

          {walletConnected && walletAddress && (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                setInput(walletAddress)
                void runScan(walletAddress)
              }}
              disabled={state.status === 'loading'}
            >
              {t('approvals.useWallet')}
            </button>
          )}
        </div>

        {state.status === 'loading' && (
          <div className="status-box status-loading">
            <span className="spinner" /> {t('approvals.scanning')}
          </div>
        )}

        {state.status === 'error' && (
          <p className="notice notice-error">
            {state.code === 'invalid'
              ? t('approvals.invalidAddress')
              : state.code === 'rate-limit'
                ? t('approvals.rateLimit')
                : state.code === 'network'
                  ? t('approvals.networkError')
                  : t('approvals.apiError')}
          </p>
        )}

        {scan && (
          <>
            <div className="approvals-owner">
              <span className="mono">{scan.owner}</span>
              <CopyButton value={scan.owner} />
              {ownerUrl && (
                <a
                  className="inline-link"
                  href={ownerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('approvals.explorer')}
                </a>
              )}
            </div>

            <div className="approvals-summary">
              <div className="approvals-stat">
                <strong>{counts.total}</strong>
                <span>{t('approvals.summaryTotal')}</span>
              </div>
              <div className="approvals-stat">
                <strong
                  className={
                    counts.unlimited > 0 ? 'approvals-stat-warn' : undefined
                  }
                >
                  {counts.unlimited}
                </strong>
                <span>{t('approvals.summaryUnlimited')}</span>
              </div>
              <div className="approvals-stat">
                <strong
                  className={
                    counts.risky > 0 ? 'approvals-stat-danger' : undefined
                  }
                >
                  {counts.risky}
                </strong>
                <span>{t('approvals.summaryRisky')}</span>
              </div>
              <div className="approvals-stat">
                <strong>{counts.tokens}</strong>
                <span>{t('approvals.summaryTokens')}</span>
              </div>
            </div>

            {!scan.verifiedOnChain && (
              <p className="notice notice-warning">
                {t('approvals.verifyUnavailable')}
              </p>
            )}

            {scan.stale > 0 && (
              <p className="approvals-note">
                {t('approvals.staleNote', { count: scan.stale })}
              </p>
            )}

            {scan.rows.length > 0 && !walletConnected && (
              <p className="notice notice-info">
                {t('approvals.connectToRevoke')}
              </p>
            )}

            {scan.rows.length > 0 && walletConnected && !ownsView && (
              <div className="notice notice-warning">
                <p>
                  {t('approvals.ownerMismatch', {
                    connected: shortAddress(walletAddress ?? ''),
                    scanned: shortAddress(scan.owner),
                  })}
                </p>
                {walletAddress && (
                  <button
                    className="btn btn-ghost btn-sm approvals-mismatch-btn"
                    type="button"
                    onClick={() => {
                      setInput(walletAddress)
                      void runScan(walletAddress)
                    }}
                  >
                    {t('approvals.switchToWallet')}
                  </button>
                )}
              </div>
            )}

            {lastSuccess && (
              <p className="notice notice-success">
                {t('approvals.revokeSuccessNote', {
                  token: lastSuccess.symbol,
                })}{' '}
                <a
                  className="inline-link"
                  href={explorerTxUrl(APPROVALS_CHAIN_ID, lastSuccess.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('approvals.viewTx')}
                </a>
              </p>
            )}

            {scan.rows.length > 0 && (
              <div className="approvals-toolbar">
                <div
                  className="approvals-filters"
                  role="group"
                  aria-label={t('approvals.filterLabel')}
                >
                  {(['all', 'unlimited', 'risk'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={filter === value ? 'active' : undefined}
                      onClick={() => setFilter(value)}
                    >
                      {value === 'all'
                        ? t('approvals.filterAll')
                        : value === 'unlimited'
                          ? t('approvals.filterUnlimited')
                          : t('approvals.filterRisk')}
                    </button>
                  ))}
                </div>

                <div className="approvals-toolbar-right">
                  <input
                    className="text-input approvals-filter-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('approvals.searchPlaceholder')}
                    aria-label={t('approvals.searchPlaceholder')}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => void runScan(scan.owner)}
                    disabled={state.status === 'loading'}
                  >
                    {state.status === 'loading'
                      ? t('common.refreshing')
                      : t('common.refresh')}
                  </button>
                </div>
              </div>
            )}

            {scan.rows.length === 0 ? (
              <div className="approvals-empty">
                <strong>{t('approvals.emptyTitle')}</strong>
                <p>{t('approvals.emptyBody')}</p>
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="approvals-empty">
                <p>{t('approvals.noMatch')}</p>
              </div>
            ) : (
              <div className="approvals-table">
                <div className="approvals-head" aria-hidden="true">
                  <span>{t('approvals.colToken')}</span>
                  <span>{t('approvals.colSpender')}</span>
                  <span>{t('approvals.colAmount')}</span>
                  <span>{t('approvals.colApproved')}</span>
                  <span />
                </div>

                {visibleRows.map((row) => {
                  const entry = revokes[row.key]
                  const date = formatApprovalDate(row.approvedAt)
                  const txUrl = row.txHash
                    ? explorerTxUrl(APPROVALS_CHAIN_ID, row.txHash)
                    : undefined
                  const spenderUrl = explorerAddressUrl(
                    APPROVALS_CHAIN_ID,
                    row.spender,
                  )
                  const tokenUrl = explorerAddressUrl(
                    APPROVALS_CHAIN_ID,
                    row.token,
                  )

                  return (
                    <div
                      className={`approvals-row ${isRiskyApproval(row) ? 'is-risk' : ''}`}
                      key={row.key}
                    >
                      <div className="approvals-token">
                        <span className="approvals-symbol">{row.symbol}</span>
                        {tokenUrl ? (
                          <a
                            className="mono approvals-address"
                            href={tokenUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortAddress(row.token, 8, 6)}
                          </a>
                        ) : (
                          <span className="mono approvals-address">
                            {shortAddress(row.token, 8, 6)}
                          </span>
                        )}
                        {row.balance && (
                          <span className="approvals-balance">
                            {t('approvals.balance')} {row.balance}
                          </span>
                        )}
                      </div>

                      <div className="approvals-spender">
                        {(row.spenderName || row.spenderTag) && (
                          <span className="approvals-spender-name">
                            {row.spenderName}
                            {row.spenderTag && (
                              <span className="approvals-spender-tag">
                                {row.spenderTag}
                              </span>
                            )}
                          </span>
                        )}
                        {spenderUrl ? (
                          <a
                            className="mono approvals-address"
                            href={spenderUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortAddress(row.spender, 8, 6)}
                          </a>
                        ) : (
                          <span className="mono approvals-address">
                            {shortAddress(row.spender, 8, 6)}
                          </span>
                        )}
                        <span className="approvals-chips">
                          {row.spenderMalicious && (
                            <span className="approvals-chip chip-danger">
                              {t('approvals.chipMalicious')}
                            </span>
                          )}
                          {row.tokenMalicious && (
                            <span className="approvals-chip chip-danger">
                              {t('approvals.chipTokenMalicious')}
                            </span>
                          )}
                          {row.tokenOpenSource === false &&
                            !row.tokenMalicious && (
                              <span className="approvals-chip chip-info">
                                {t('approvals.chipTokenUnverified')}
                              </span>
                            )}
                          {row.spenderDoubt && (
                            <span className="approvals-chip chip-warn">
                              {t('approvals.chipDoubt')}
                            </span>
                          )}
                          {row.verification === 'reverted' && (
                            <span
                              className="approvals-chip chip-warn"
                              title={t('approvals.chipUnverifiedHint')}
                            >
                              {t('approvals.chipUnverified')}
                            </span>
                          )}
                          {row.verification === 'skipped' && (
                            <span className="approvals-chip chip-info">
                              {t('approvals.chipIndexed')}
                            </span>
                          )}
                          {row.spenderTrusted && (
                            <span className="approvals-chip chip-ok">
                              {t('approvals.chipTrusted')}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="approvals-amount">
                        <span
                          className={
                            row.unlimited ? 'approvals-unlimited' : undefined
                          }
                        >
                          {formatApprovalAmount(
                            row,
                            t('approvals.chipUnlimited'),
                          )}
                        </span>
                      </div>

                      <div className="approvals-date">
                        <span>{date ?? '—'}</span>
                        {txUrl && (
                          <a
                            className="inline-link approvals-tx"
                            href={txUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('approvals.viewTx')}
                          </a>
                        )}
                      </div>

                      <div className="approvals-row-actions">
                        <button
                          className={
                            walletConnected && ownsView
                              ? 'btn btn-danger btn-sm'
                              : 'btn btn-ghost btn-sm'
                          }
                          type="button"
                          onClick={() => void handleRevoke(row)}
                          disabled={
                            busyKey !== null ||
                            (walletConnected && !ownsView) ||
                            connectors.length === 0 ||
                            (entry !== undefined &&
                              (entry.status === 'simulating' ||
                                entry.status === 'sending' ||
                                entry.status === 'pending'))
                          }
                        >
                          {revokeLabel(row)}
                        </button>
                      </div>

                      {entry?.status === 'pending' && (
                        <p className="approvals-row-status">
                          <a
                            className="inline-link"
                            href={explorerTxUrl(
                              APPROVALS_CHAIN_ID,
                              entry.hash,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('approvals.revokePendingLink')}
                          </a>
                        </p>
                      )}

                      {entry?.status === 'error' && (
                        <p className="approvals-row-status approvals-row-error">
                          {revokeError(entry)}
                          {entry.hash && (
                            <a
                              className="inline-link"
                              href={explorerTxUrl(
                                APPROVALS_CHAIN_ID,
                                entry.hash,
                              )}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('approvals.viewTx')}
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <p className="approvals-source">{t('approvals.sourceNote')}</p>
          </>
        )}
      </section>

      <section className="explainer approvals-explainer">
        <h2>{t('approvals.faqTitle')}</h2>
        <div className="explainer-grid">
          <article>
            <h3>{t('approvals.faq1Title')}</h3>
            <p>{t('approvals.faq1Body')}</p>
          </article>
          <article>
            <h3>{t('approvals.faq2Title')}</h3>
            <p>{t('approvals.faq2Body')}</p>
          </article>
          <article>
            <h3>{t('approvals.faq3Title')}</h3>
            <p>{t('approvals.faq3Body')}</p>
          </article>
        </div>
      </section>
    </>
  )
}
