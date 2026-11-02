'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isAddress, isAddressEqual, type Address, type Hex } from 'viem'
import { useBytecode, usePublicClient } from 'wagmi'
import { SCAN_CHAINS } from '../chains'
import {
  chainName,
  explorerAddressUrl,
  explorerName,
  explorerTxUrl,
} from '../chain-meta'
import { useI18n } from '../i18n'
import {
  getKnownDelegate,
  parseDelegation,
  shortAddress,
} from '../lib/eip7702'
import { privateKeyToAddress, revokeDelegation } from '../lib/revoke'
import { scanDelegations, type ChainScanResult } from '../lib/scan'
import { RichText } from './RichText'

type RevokeState =
  | { status: 'idle' }
  | { status: 'signing' }
  | { status: 'sending' }
  | { status: 'confirming'; hash: Hex }
  | { status: 'success'; hash: Hex }
  | { status: 'error'; message: string }

type ScanState = {
  status: 'idle' | 'loading' | 'done'
  results: ChainScanResult[]
}

type Props = {
  chainId: number
  connectedAddress: Address | undefined
  connectedChainId: number | undefined
  isConnecting: boolean
  onConnect: () => void
  onDisconnect: () => void
  onSwitchChain: () => void
  onSelectChain: (chainId: number) => void
  onOpenGuide: (address: Address) => void
  initialAddress?: Address
}

function normalizePrivateKey(value: string): Hex | undefined {
  const compact = value.trim().replace(/\s+/g, '')
  const body = compact.toLowerCase().startsWith('0x')
    ? compact.slice(2)
    : compact
  if (!/^[0-9a-fA-F]{64}$/.test(body)) return undefined
  return `0x${body}` as Hex
}

export function AddressChecker({
  chainId,
  connectedAddress,
  connectedChainId,
  isConnecting,
  onConnect,
  onDisconnect,
  onSwitchChain,
  onSelectChain,
  onOpenGuide,
  initialAddress,
}: Props) {
  const { lang, t } = useI18n()
  const [input, setInput] = useState(() => initialAddress ?? '')
  const [queryAddress, setQueryAddress] = useState<Address | undefined>(
    initialAddress,
  )
  const [inputError, setInputError] = useState<string>()

  const [revokeOpen, setRevokeOpen] = useState(false)
  const [method, setMethod] = useState<'key' | 'wallet'>('key')
  const [privateKey, setPrivateKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [revoke, setRevoke] = useState<RevokeState>({ status: 'idle' })
  const [scan, setScan] = useState<ScanState>({ status: 'idle', results: [] })
  const scanNonce = useRef(0)
  const lastAutoScanned = useRef<string | undefined>(undefined)

  const publicClient = usePublicClient({ chainId })

  const codeQuery = useBytecode({
    address: queryAddress,
    chainId,
    query: { enabled: Boolean(queryAddress) },
  })

  const info = useMemo(() => parseDelegation(codeQuery.data), [codeQuery.data])
  const knownDelegate =
    info.status === 'delegated' ? getKnownDelegate(info.delegate) : undefined

  const normalizedKey = useMemo(
    () => normalizePrivateKey(privateKey),
    [privateKey],
  )
  const derivedAddress = useMemo(
    () => (normalizedKey ? privateKeyToAddress(normalizedKey) : undefined),
    [normalizedKey],
  )

  const keyMatches =
    Boolean(derivedAddress && queryAddress) &&
    isAddressEqual(derivedAddress as Address, queryAddress as Address)

  const canRevoke =
    info.status === 'delegated' &&
    revoke.status !== 'signing' &&
    revoke.status !== 'sending' &&
    revoke.status !== 'confirming' &&
    confirmed &&
    keyMatches

  const lookup = useCallback((address: Address) => {
    setQueryAddress(address)
    setRevokeOpen(false)
    setRevoke({ status: 'idle' })
    setPrivateKey('')
    setConfirmed(false)
  }, [])

  const runScan = useCallback(async (address: Address) => {
    const nonce = ++scanNonce.current
    setScan({ status: 'loading', results: [] })
    const results = await scanDelegations(address)
    if (nonce === scanNonce.current) {
      setScan({ status: 'done', results })
    }
  }, [])

  useEffect(() => {
    if (!queryAddress) {
      scanNonce.current += 1
      return
    }

    // oxlint-disable-next-line react/set-state-in-effect -- kick off the external multi-chain RPC scan
    void runScan(queryAddress)
    return () => {
      scanNonce.current += 1
    }
  }, [queryAddress, runScan])

  // Connecting a wallet is enough to trigger a read-only multi-chain scan.
  // An explicit address (URL/preset/manual query) is never overridden.
  useEffect(() => {
    if (!connectedAddress) {
      lastAutoScanned.current = undefined
      return
    }
    if (queryAddress) {
      lastAutoScanned.current = connectedAddress
      return
    }
    if (lastAutoScanned.current === connectedAddress) return

    lastAutoScanned.current = connectedAddress
    setInput(connectedAddress)
    setInputError(undefined)
    lookup(connectedAddress)
  }, [connectedAddress, lookup, queryAddress])

  function handleQuery() {
    const value = input.trim()
    if (!isAddress(value)) {
      setInputError(t('addr.inputError'))
      return
    }
    setInputError(undefined)
    lookup(value)
  }

  function handleUseConnected() {
    if (!connectedAddress) {
      onConnect()
      return
    }
    setInput(connectedAddress)
    setInputError(undefined)
    lookup(connectedAddress)
  }

  function refreshAll() {
    if (queryAddress) void runScan(queryAddress)
    void codeQuery.refetch()
  }

  async function handleRevoke() {
    const key = normalizePrivateKey(privateKey)
    if (!queryAddress || !key) return

    if (!publicClient) {
      setRevoke({ status: 'error', message: t('addr.rpcUnavailable') })
      return
    }

    try {
      const result = await revokeDelegation({
        privateKey: key,
        chainId,
        onStep: (step) => {
          setRevoke(
            step === 'signing'
              ? { status: 'signing' }
              : { status: 'sending' },
          )
        },
      })

      setPrivateKey('')
      setShowKey(false)
      setConfirmed(false)
      setRevoke({ status: 'confirming', hash: result.hash })

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: result.hash,
      })

      if (receipt.status !== 'success') {
        setRevoke({
          status: 'error',
          message: t('addr.txReverted', { hash: result.hash }),
        })
        return
      }

      let refreshed = await codeQuery.refetch()
      if (parseDelegation(refreshed.data).status === 'delegated') {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        refreshed = await codeQuery.refetch()
      }

      if (parseDelegation(refreshed.data).status === 'delegated') {
        setRevoke({
          status: 'error',
          message: t('addr.stillDelegated'),
        })
        return
      }

      setRevoke({ status: 'success', hash: result.hash })
      void runScan(queryAddress)
    } catch (error) {
      setRevoke({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const busy =
    revoke.status === 'signing' ||
    revoke.status === 'sending' ||
    revoke.status === 'confirming'

  const delegatedScanResults = scan.results.filter(
    (result) => result.info?.status === 'delegated',
  )
  const scanErrorCount = scan.results.filter((result) => result.error).length
  const selectedChainScanned = SCAN_CHAINS.some(
    (chain) => chain.id === chainId,
  )

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{t('addr.eyebrow')}</p>
          <h2>{t('addr.title')}</h2>
        </div>
        <span className="network-chip">{chainName(chainId)}</span>
      </div>

      <div className="search-row">
        <input
          className="text-input"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setInputError(undefined)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleQuery()
          }}
          placeholder={t('addr.placeholder')}
          spellCheck={false}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="button" onClick={handleQuery}>
          {t('addr.query')}
        </button>
        <button className="btn btn-ghost" type="button" onClick={handleUseConnected}>
          {connectedAddress
            ? t('addr.queryMine')
            : isConnecting
              ? t('common.connecting')
              : t('common.connectWallet')}
        </button>
      </div>

      {connectedAddress && (
        <div className="wallet-line">
          <div className="wallet-pill">
            <span className="dot" />
            <span className="mono">{shortAddress(connectedAddress)}</span>
            <button
              className="link-button"
              type="button"
              onClick={onDisconnect}
            >
              {t('common.disconnect')}
            </button>
          </div>
        </div>
      )}

      {inputError && <p className="notice notice-error">{inputError}</p>}

      {queryAddress && (
        <div className="result">
          <div className="result-head">
            <div>
              <p className="eyebrow">{t('addr.queryAddress')}</p>
              <p className="mono address-line">
                {queryAddress}
                <a
                  className="inline-link"
                  href={explorerAddressUrl(chainId, queryAddress)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {explorerName(chainId)}
                </a>
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={refreshAll}
              disabled={codeQuery.isFetching || scan.status === 'loading'}
            >
              {codeQuery.isFetching || scan.status === 'loading'
                ? t('common.refreshing')
                : t('common.refresh')}
            </button>
          </div>

          <div className="scan">
            <div className="scan-head">
              <div>
                <h3>{t('scan.title')}</h3>
                <p className="muted small">
                  {t('scan.subtitle', { count: SCAN_CHAINS.length })}
                </p>
              </div>
              <span className="scan-progress">
                {scan.status === 'loading' && <span className="spinner" />}
                {scan.status === 'loading'
                  ? t('scan.scanning')
                  : t('scan.networks', { count: scan.results.length })}
              </span>
            </div>

            <div className="scan-grid">
              {SCAN_CHAINS.map((chain) => {
                const result = scan.results.find(
                  (item) => item.chainId === chain.id,
                )
                const status = result?.error
                  ? 'error'
                  : result?.info?.status ??
                    (scan.status === 'loading' ? 'loading' : 'idle')
                const delegated =
                  result?.info && result.info.status === 'delegated'
                    ? result.info
                    : undefined
                const label =
                  status === 'loading' || status === 'idle'
                    ? t('scan.checking')
                    : status === 'delegated'
                      ? t('scan.delegated')
                      : status === 'empty'
                        ? t('scan.empty')
                        : status === 'contract'
                          ? t('scan.contract')
                          : t('scan.error')

                return (
                  <button
                    className={`scan-card scan-${status} ${
                      chain.id === chainId ? 'active' : ''
                    }`}
                    key={chain.id}
                    type="button"
                    onClick={() => onSelectChain(chain.id)}
                    title={result?.error ?? delegated?.delegate}
                  >
                    <span className="scan-top">
                      <span className="scan-name">
                        {chainName(chain.id)}
                      </span>
                      {chain.id === chainId && (
                        <span className="scan-current">
                          {t('scan.current')}
                        </span>
                      )}
                    </span>
                    <span className="scan-state">{label}</span>
                    {delegated && (
                      <span className="scan-detail mono">
                        {t('scan.delegate')}{' '}
                        {shortAddress(delegated.delegate, 8, 6)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <p className="muted small scan-hint">{t('scan.selectHint')}</p>

            {scan.status === 'loading' && (
              <p className="notice notice-info">
                <span className="spinner" /> {t('scan.loading')}
              </p>
            )}

            {scan.status === 'done' && delegatedScanResults.length > 0 && (
              <p className="notice notice-warning">
                {t('scan.summaryDelegated', {
                  count: delegatedScanResults.length,
                  chains: delegatedScanResults
                    .map((result) => chainName(result.chainId))
                    .join(' · '),
                })}
              </p>
            )}

            {scan.status === 'done' && delegatedScanResults.length === 0 && (
              <p className="notice notice-success">
                {t('scan.summarySafe', { count: scan.results.length })}
              </p>
            )}

            {scan.status === 'done' && scanErrorCount > 0 && (
              <p className="muted small">
                {t('scan.partialError', { count: scanErrorCount })}
              </p>
            )}

            {!selectedChainScanned && (
              <p className="muted small">
                {t('scan.testnetNote', { chain: chainName(chainId) })}
              </p>
            )}

            <p className="muted small scan-privacy">{t('scan.privacy')}</p>
          </div>

          {codeQuery.isFetching && !codeQuery.data ? (
            <div className="status-box status-loading">
              <span className="spinner" /> {t('addr.loadingCode')}
            </div>
          ) : codeQuery.isError ? (
            <div className="status-box status-error">
              {t('addr.queryFailed', { message: codeQuery.error.message })}
            </div>
          ) : info.status === 'delegated' ? (
            <>
              <div className="status-box status-danger">
                <div className="status-icon">!</div>
                <div>
                  <strong>{t('addr.delegatedTitle')}</strong>
                  <p>
                    <RichText text={t('addr.delegatedBody')} />
                  </p>
                </div>
              </div>

              <dl className="kv">
                <div>
                  <dt>{t('addr.delegateContract')}</dt>
                  <dd className="mono">
                    {info.delegate}
                    <a
                      className="inline-link"
                      href={explorerAddressUrl(chainId, info.delegate)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {explorerName(chainId)}
                    </a>
                  </dd>
                </div>
                {knownDelegate && (
                  <div>
                    <dt>{t('addr.recognized')}</dt>
                    <dd>
                      {knownDelegate.name}
                      {knownDelegate.url && (
                        <a
                          className="inline-link"
                          href={knownDelegate.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('common.source')}
                        </a>
                      )}
                      <p className="muted small">
                        {knownDelegate.description[lang]}
                      </p>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{t('addr.rawCode')}</dt>
                  <dd className="mono break">{info.code}</dd>
                </div>
              </dl>

              <div className="revoke">
                <div className="revoke-head">
                  <div>
                    <h3>{t('addr.revokeTitle')}</h3>
                    <p className="muted">{t('addr.revokeDescription')}</p>
                  </div>
                  {!revokeOpen && (
                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={() => {
                        setRevokeOpen(true)
                        setRevoke({ status: 'idle' })
                      }}
                    >
                      {t('addr.revokeCta')}
                    </button>
                  )}
                </div>

                {revokeOpen && (
                  <div className="revoke-body">
                    <p className="method-label">{t('addr.methodTitle')}</p>
                    <div
                      className="segmented method-switch"
                      role="group"
                      aria-label={t('addr.methodTitle')}
                    >
                      <button
                        type="button"
                        className={method === 'key' ? 'active' : ''}
                        onClick={() => setMethod('key')}
                      >
                        {t('addr.methodKey')}
                      </button>
                      <button
                        type="button"
                        className={method === 'wallet' ? 'active' : ''}
                        onClick={() => setMethod('wallet')}
                      >
                        {t('addr.methodWallet')}
                      </button>
                    </div>

                    {method === 'wallet' ? (
                      <div className="method-card">
                        <h4>{t('addr.walletMethodTitle')}</h4>
                        <p>{t('addr.methodWalletHint')}</p>
                        <p className="muted small">{t('addr.guideNote')}</p>
                        <div className="actions">
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() =>
                              queryAddress && onOpenGuide(queryAddress)
                            }
                          >
                            {t('addr.openGuide')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="muted small method-hint">
                          {t('addr.methodKeyHint')}
                        </p>

                        <div className="notice notice-warning">
                          <strong>{t('addr.securityTitle')}</strong>
                          <p>{t('addr.securityBody')}</p>
                        </div>

                        {connectedAddress &&
                          !isAddressEqual(connectedAddress, queryAddress) && (
                            <p className="muted small">
                              {t('addr.walletMismatch', {
                                address: shortAddress(connectedAddress),
                              })}
                            </p>
                          )}

                        {connectedAddress &&
                          isAddressEqual(connectedAddress, queryAddress) &&
                          connectedChainId !== chainId && (
                            <p className="muted small">
                              {t('addr.walletChainMismatch')}
                              <button
                                className="link-button"
                                type="button"
                                onClick={onSwitchChain}
                              >
                                {t('addr.switchNetwork')}
                              </button>
                            </p>
                          )}

                        <label className="field">
                          <span>{t('addr.privateKeyLabel')}</span>
                          <div className="key-row">
                            <input
                              className="text-input mono"
                              type={showKey ? 'text' : 'password'}
                              value={privateKey}
                              onChange={(event) => {
                                setPrivateKey(event.target.value)
                                setRevoke({ status: 'idle' })
                              }}
                              placeholder={t('addr.privateKeyPlaceholder')}
                              spellCheck={false}
                              autoComplete="off"
                            />
                            <button
                              className="btn btn-ghost btn-sm"
                              type="button"
                              onClick={() => setShowKey((value) => !value)}
                            >
                              {showKey ? t('common.hide') : t('common.show')}
                            </button>
                          </div>
                        </label>

                        {privateKey.trim().length > 0 && !normalizedKey && (
                          <p className="notice notice-error">
                            {t('addr.invalidKey')}
                          </p>
                        )}

                        {derivedAddress && (
                          <p className={keyMatches ? 'kv-ok' : 'kv-bad'}>
                            {t('addr.derivedAddressPrefix')}
                            <span className="mono">{derivedAddress}</span>
                            {keyMatches
                              ? t('addr.keyMatches')
                              : t('addr.keyMismatch')}
                          </p>
                        )}

                        <label className="check">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) =>
                              setConfirmed(event.target.checked)
                            }
                          />
                          <span>{t('addr.confirmText')}</span>
                        </label>

                        <div className="actions">
                          <button
                            className="btn btn-danger"
                            type="button"
                            disabled={!canRevoke || busy}
                            onClick={handleRevoke}
                          >
                            {revoke.status === 'signing'
                              ? t('addr.signing')
                              : revoke.status === 'sending'
                                ? t('addr.broadcasting')
                                : revoke.status === 'confirming'
                                  ? t('addr.confirming')
                                  : t('addr.confirmRevoke')}
                          </button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setRevokeOpen(false)
                              setPrivateKey('')
                              setConfirmed(false)
                              setRevoke({ status: 'idle' })
                            }}
                          >
                            {t('common.close')}
                          </button>
                        </div>

                        {revoke.status === 'confirming' && (
                          <p className="notice notice-info">
                            {t('addr.txSent')}
                            <a
                              className="inline-link"
                              href={explorerTxUrl(chainId, revoke.hash)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {shortAddress(revoke.hash, 10, 8)}
                            </a>
                          </p>
                        )}

                        {revoke.status === 'error' && (
                          <div className="notice notice-error">
                            <strong>{t('addr.revokeFailedTitle')}</strong>
                            <p className="break">{revoke.message}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : info.status === 'contract' ? (
            <div className="status-box status-neutral">
              <div className="status-icon neutral">C</div>
              <div>
                <strong>{t('addr.notDelegatedTitle')}</strong>
                <p>
                  <RichText text={t('addr.notDelegatedBody')} />
                </p>
              </div>
            </div>
          ) : (
            <div className="status-box status-safe">
              <div className="status-icon ok">OK</div>
              <div>
                <strong>{t('addr.notEnabledTitle')}</strong>
                <p>{t('addr.notEnabledBody')}</p>
              </div>
            </div>
          )}

          {revoke.status === 'success' && (
            <div className="notice notice-success">
              <strong>{t('addr.revokeSuccessTitle')}</strong>
              <p>
                {t('addr.revokeSuccessPrefix')}
                <a
                  className="inline-link"
                  href={explorerTxUrl(chainId, revoke.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddress(revoke.hash, 10, 8)}
                </a>
                {t('addr.revokeSuccessSuffix')}
              </p>
            </div>
          )}
        </div>
      )}
      <p className="muted small panel-note">
        {t('app.delegateDisclaimer')}
      </p>
    </section>
  )
}
