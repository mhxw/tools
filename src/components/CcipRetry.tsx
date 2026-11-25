'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { encodeFunctionData, toHex, type Hex, type Log } from 'viem'
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from 'wagmi'
import { chainName, explorerTxUrl } from '../chain-meta'
import { useI18n, type MessageKey } from '../i18n'
import {
  OFF_RAMP_ABI,
  ccipExplorerMessageUrl,
  decodeExecutionError,
  extractRevertData,
  formatGasLimit,
  isExecutionInputsV2,
  isV2Message,
  loadCcipMessage,
  messageGasLimit,
  parseCcipLogs,
  type CcipLookup,
  type CcipLookupErrorCode,
  type RevertInfo,
} from '../lib/ccip'
import { ccipChain, ccipChainName } from '../lib/ccip-chains'
import { CopyButton } from './CopyButton'

type Eip1193 = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
}

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; code: CcipLookupErrorCode | 'unknown' }
  | { status: 'ready'; data: CcipLookup }

type ExecState =
  | { status: 'idle' }
  | { status: 'simulating' }
  | { status: 'sim-failed'; message: string; reason?: RevertInfo }
  | { status: 'sending' }
  | { status: 'pending'; hash: Hex }
  | { status: 'success'; hash: Hex }
  | { status: 'reverted'; hash: Hex; reason?: RevertInfo }
  | { status: 'timeout'; hash: Hex }
  | { status: 'error'; message: string }

const EXECUTION_STATE_LABELS: Record<number, string> = {
  0: 'statusUntouched',
  1: 'statusInProgress',
  2: 'statusSuccess',
  3: 'statusFailed',
}

const REASON_HINTS: Record<string, MessageKey> = {
  ReceiverError: 'ccip.reasonHintReceiver',
  TokenHandlingError: 'ccip.reasonHintToken',
  InsufficientGasToCompleteTx: 'ccip.reasonHintGas',
  InvalidGasLimitOverride: 'ccip.reasonHintGasLimit',
  NoStateProgressMade: 'ccip.reasonHintNoProgress',
  CursedByRMN: 'ccip.reasonHintCursed',
  RootNotCommitted: 'ccip.reasonHintNotCommitted',
}

function shortAddress(address: string, head = 6, tail = 4) {
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isUnknownChainError(error: unknown) {
  const code = (error as { code?: number } | null)?.code
  if (code === 4902) return true
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''
  return /Unrecognized chain|Try adding the chain|wallet_addEthereumChain/i.test(
    message,
  )
}

function describeError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)
  const short =
    (error as { shortMessage?: string } | null)?.shortMessage ?? raw
  if (/user rejected|user denied|rejected the request/i.test(short)) {
    return 'rejected'
  }
  if (/insufficient funds/i.test(short)) return 'insufficient-funds'
  return short.length > 260 ? `${short.slice(0, 260)}…` : short
}

export function CcipRetry() {
  const { t } = useI18n()
  const connection = useConnection()
  const connectors = useConnectors()
  const connect = useConnect()
  const { disconnect } = useDisconnect()

  // Keep the first client render identical to the prerendered HTML.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- reveal wallet state after hydration
    setHydrated(true)
  }, [])

  const walletConnected = hydrated && connection.isConnected
  const walletAddress = hydrated ? connection.address : undefined

  const [walletChainId, setWalletChainId] = useState<number | undefined>()
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- mirror wagmi chain changes
    setWalletChainId(connection.chainId)
  }, [connection.chainId])

  const [input, setInput] = useState('')
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' })
  const [exec, setExec] = useState<ExecState>({ status: 'idle' })
  const [gasInput, setGasInput] = useState('')
  const [chainBusy, setChainBusy] = useState(false)

  const runLookup = useCallback(async (raw: string) => {
    setLookup({ status: 'loading' })
    setExec({ status: 'idle' })
    try {
      const data = await loadCcipMessage(raw)
      setLookup({ status: 'ready', data })
      setGasInput('')
      const url = new URL(window.location.href)
      url.searchParams.set('tx', data.message.messageId)
      window.history.replaceState(null, '', url)
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code: CcipLookupErrorCode }).code
          : 'unknown'
      setLookup({ status: 'error', code })
      const url = new URL(window.location.href)
      url.searchParams.delete('tx')
      url.searchParams.delete('message')
      window.history.replaceState(null, '', url)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initial = params.get('tx') ?? params.get('message')
    if (!initial) return
    // oxlint-disable-next-line react/set-state-in-effect -- read query params after hydration
    setInput(initial)
    void runLookup(initial)
  }, [runLookup])

  const data = lookup.status === 'ready' ? lookup.data : undefined
  const message = data?.message
  const inputs = data?.inputs
  const inputsV2 = inputs && isExecutionInputsV2(inputs) ? inputs : undefined
  const destChainId = message ? Number(message.destNetworkInfo?.chainId ?? 0) : 0
  const destName = message
    ? (message.destNetworkInfo?.displayName ??
      ccipChainName(destChainId, chainName(destChainId)))
    : ''
  const sourceName = message
    ? (message.sourceNetworkInfo?.displayName ??
      ccipChainName(
        Number(message.sourceNetworkInfo?.chainId ?? 0),
        chainName(Number(message.sourceNetworkInfo?.chainId ?? 0)),
      ))
    : ''
  const originalGas = messageGasLimit(message)
  const v1 = message ? !isV2Message(message) : false
  const onchainState = data?.onchainState
  const alreadyDone =
    onchainState === 2 || (!onchainState && message?.status === 'SUCCESS')

  const statusLabel = useMemo(() => {
    if (onchainState !== undefined) {
      const key = EXECUTION_STATE_LABELS[onchainState]
      return key ? t(`ccip.${key}` as MessageKey) : t('ccip.statusUnknown')
    }
    const status = message?.status ?? ''
    if (status === 'SUCCESS') return t('ccip.statusSuccess')
    if (status === 'FAILED' || status === 'FAILURE') return t('ccip.statusFailed')
    if (status === 'IN_PROGRESS') return t('ccip.statusInProgress')
    if (status) return t('ccip.statusPending')
    return t('ccip.statusUnknown')
  }, [message?.status, onchainState, t])

  const statusTone =
    onchainState === 2 || message?.status === 'SUCCESS'
      ? 'success'
      : onchainState === 3 ||
          message?.status === 'FAILED' ||
          message?.status === 'FAILURE'
        ? 'danger'
        : 'info'

  const gas = useMemo(() => {
    const trimmed = gasInput.trim()
    if (!trimmed) return { value: 0, error: undefined as MessageKey | undefined }
    if (!/^\d+$/.test(trimmed)) {
      return { value: 0, error: 'ccip.gasInvalid' as MessageKey }
    }
    const parsed = Number(trimmed)
    if (!Number.isSafeInteger(parsed) || parsed > 0xffffffff) {
      return { value: 0, error: 'ccip.gasInvalid' as MessageKey }
    }
    if (originalGas && parsed !== 0) {
      try {
        if (BigInt(parsed) < BigInt(originalGas)) {
          return { value: 0, error: 'ccip.gasTooLow' as MessageKey }
        }
      } catch {
        return { value: 0, error: 'ccip.gasInvalid' as MessageKey }
      }
    }
    return { value: parsed, error: undefined as MessageKey | undefined }
  }, [gasInput, originalGas])

  const calldata = useMemo(() => {
    if (!inputsV2) return undefined
    try {
      return encodeFunctionData({
        abi: OFF_RAMP_ABI,
        functionName: 'execute',
        args: [
          inputsV2.encodedMessage,
          inputsV2.verifierAddresses,
          inputsV2.ccvData,
          gas.value,
        ],
      })
    } catch {
      return undefined
    }
  }, [gas.value, inputsV2])

  const wrongChain =
    walletConnected && destChainId > 0 && walletChainId !== destChainId

  const previousReason = useMemo(
    () => decodeExecutionError(data?.previousRevert),
    [data?.previousRevert],
  )

  function handleConnect() {
    const connector = connectors[0]
    if (!connector) return
    connect.mutate({ connector })
  }

  async function getProvider(): Promise<Eip1193> {
    const connector = connection.connector ?? connectors[0]
    if (!connector) throw new Error('No wallet connector available')
    return (await connector.getProvider()) as Eip1193
  }

  async function switchToDest(): Promise<boolean> {
    if (!destChainId) return false
    setChainBusy(true)
    try {
      const provider = await getProvider()
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: toHex(destChainId) }],
        })
      } catch (error) {
        if (!isUnknownChainError(error)) throw error
        const meta = ccipChain(destChainId)
        if (!meta) throw error
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: toHex(destChainId),
              chainName: meta.name,
              nativeCurrency: meta.currency,
              rpcUrls: [meta.rpc],
              blockExplorerUrls: [meta.explorer],
            },
          ],
        })
      }
      setWalletChainId(destChainId)
      return true
    } catch (error) {
      const described = describeError(error)
      setExec({
        status: 'error',
        message:
          described === 'rejected'
            ? t('ccip.rejected')
            : t('ccip.switchFailed', { message: described }),
      })
      return false
    } finally {
      setChainBusy(false)
    }
  }

  async function runExecute() {
    if (!inputsV2 || !destChainId) return
    if (!walletConnected || !walletAddress) {
      handleConnect()
      return
    }
    if (gas.error) {
      setExec({
        status: 'error',
        message:
          gas.error === 'ccip.gasTooLow'
            ? t('ccip.gasTooLow', {
                min: formatGasLimit(originalGas) || '0',
              })
            : t(gas.error),
      })
      return
    }
    if (walletChainId !== destChainId) {
      const switched = await switchToDest()
      if (!switched) return
    }
    if (!calldata) {
      setExec({ status: 'error', message: t('ccip.calldataFailed') })
      return
    }

    setExec({ status: 'simulating' })
    try {
      const provider = await getProvider()
      try {
        await provider.request({
          method: 'eth_call',
          params: [
            { from: walletAddress, to: inputsV2.offramp, data: calldata },
            'latest',
          ],
        })
      } catch (error) {
        setExec({
          status: 'sim-failed',
          message: describeError(error),
          reason: decodeExecutionError(extractRevertData(error)),
        })
        return
      }

      setExec({ status: 'sending' })
      let hash: Hex
      try {
        hash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [
            { from: walletAddress, to: inputsV2.offramp, data: calldata },
          ],
        })) as Hex
      } catch (error) {
        const described = describeError(error)
        setExec({
          status: 'error',
          message:
            described === 'rejected'
              ? t('ccip.rejected')
              : described === 'insufficient-funds'
                ? t('ccip.insufficientFunds')
                : t('ccip.sendFailed', { message: described }),
        })
        return
      }

      setExec({ status: 'pending', hash })
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await sleep(3000)
        let receipt: {
          status?: string | boolean | number
          logs?: readonly Log[]
        } | null = null
        try {
          receipt = (await provider.request({
            method: 'eth_getTransactionReceipt',
            params: [hash],
          })) as { status?: string | boolean | number; logs?: readonly Log[] } | null
        } catch {
          // Keep polling; a transient RPC error should not lose the tx.
        }
        if (!receipt) continue

        // A CCIP execution can land successfully while the message itself
        // fails, so the receipt status alone is not enough.
        const execution = receipt.logs
          ? parseCcipLogs(receipt.logs).find(
              (candidate) =>
                candidate.kind === 'execution' &&
                candidate.messageId.toLowerCase() ===
                  (message?.messageId ?? '').toLowerCase(),
            )
          : undefined

        if (execution?.state === 2) {
          setExec({ status: 'success', hash })
          return
        }
        if (execution?.state === 3) {
          setExec({
            status: 'reverted',
            hash,
            reason: decodeExecutionError(execution.returnData),
          })
          return
        }

        const ok =
          receipt.status === '0x1' ||
          receipt.status === '0x01' ||
          receipt.status === true ||
          receipt.status === 1
        setExec({ status: ok ? 'success' : 'reverted', hash })
        return
      }
      setExec({ status: 'timeout', hash })
    } catch (error) {
      setExec({ status: 'error', message: describeError(error) })
    }
  }

  function txLink(chainId: number, hash: string) {
    const known = explorerTxUrl(chainId, hash)
    if (known) return known
    const meta = ccipChain(chainId)
    return meta ? `${meta.explorer}/tx/${hash}` : undefined
  }

  const canExecute =
    !v1 &&
    destChainId > 0 &&
    Boolean(inputsV2?.verificationComplete) &&
    !alreadyDone

  const executeLabel = (() => {
    if (!walletConnected) {
      return connect.isPending
        ? t('common.connecting')
        : connectors.length === 0
          ? t('common.noWallet')
          : t('common.connectWallet')
    }
    if (wrongChain) {
      return chainBusy
        ? t('ccip.switching')
        : t('ccip.switchChain', {
            chain: ccipChainName(destChainId, destName),
          })
    }
    if (exec.status === 'simulating') return t('ccip.simulating')
    if (exec.status === 'sending') return t('ccip.executing')
    if (exec.status === 'pending') return t('ccip.confirming')
    if (exec.status === 'success') return t('ccip.executed')
    return t('ccip.execute')
  })()

  const executeDisabled =
    !canExecute ||
    chainBusy ||
    Boolean(gas.error) ||
    connect.isPending ||
    exec.status === 'simulating' ||
    exec.status === 'sending' ||
    exec.status === 'pending' ||
    exec.status === 'success' ||
    connectors.length === 0

  return (
    <>
      <section className="panel ccip-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">{t('ccip.eyebrow')}</p>
            <h2>{t('ccip.title')}</h2>
          </div>
          {message && (
            <span className="network-chip">{destName || `#${destChainId}`}</span>
          )}
        </div>

        <p className="swap-lede">{t('ccip.lede')}</p>

        <form
          className="search-row ccip-search"
          onSubmit={(event) => {
            event.preventDefault()
            if (input.trim()) void runLookup(input)
          }}
        >
          <input
            className="text-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('ccip.placeholder')}
            spellCheck={false}
            autoComplete="off"
            aria-label={t('ccip.placeholder')}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={lookup.status === 'loading' || !input.trim()}
          >
            {lookup.status === 'loading' ? t('ccip.searching') : t('ccip.lookup')}
          </button>
        </form>
        <p className="tx-search-hint">{t('ccip.hint')}</p>

        {lookup.status === 'loading' && (
          <div className="status-box status-loading">
            <span className="spinner" /> {t('ccip.searching')}
          </div>
        )}

        {lookup.status === 'error' && (
          <p className="notice notice-error">
            {lookup.code === 'invalid'
              ? t('ccip.invalidInput')
              : lookup.code === 'not-found'
                ? t('ccip.notFound')
                : lookup.code === 'network'
                  ? t('ccip.networkError')
                  : t('ccip.apiError')}
          </p>
        )}

        {message && (
          <>
            <div className="ccip-route">
              <span className="ccip-route-chain">
                <span className="ccip-route-label">{t('ccip.from')}</span>
                {sourceName}
              </span>
              <span className="ccip-route-arrow" aria-hidden="true">
                →
              </span>
              <span className="ccip-route-chain">
                <span className="ccip-route-label">{t('ccip.to')}</span>
                {destName}
              </span>
              <span className={`ccip-badge ccip-badge-${statusTone}`}>
                {statusLabel}
              </span>
            </div>

            {alreadyDone && (
              <p className="notice notice-success">{t('ccip.alreadyDone')}</p>
            )}

            {v1 && !alreadyDone && (
              <p className="notice notice-warning">{t('ccip.v1Unsupported')}</p>
            )}

            {!v1 && !alreadyDone && !inputsV2 && (
              <p className="notice notice-error">
                {t('ccip.inputsUnavailable', {
                  message: data?.inputsError ?? 'unknown',
                })}
              </p>
            )}

            {!v1 &&
              !alreadyDone &&
              inputsV2 &&
              !inputsV2.verificationComplete && (
                <p className="notice notice-warning">{t('ccip.unverified')}</p>
              )}

            {previousReason && (
              <div className="notice notice-warning">
                <strong>{t('ccip.prevFailure')}</strong>
                <p className="mono ccip-reason">{previousReason.text}</p>
                {previousReason.truncated && (
                  <p className="ccip-reason-note">{t('ccip.truncatedError')}</p>
                )}
                {previousReason.name && REASON_HINTS[previousReason.name] && (
                  <p>{t(REASON_HINTS[previousReason.name])}</p>
                )}
              </div>
            )}

            <div className="swap-layout ccip-layout">
              <dl className="kv ccip-facts">
                <div>
                  <dt>{t('ccip.messageId')}</dt>
                  <dd>
                    <span className="mono">{message.messageId}</span>
                    <span className="ccip-inline-actions">
                      <CopyButton value={message.messageId} />
                      <a
                        className="inline-link"
                        href={ccipExplorerMessageUrl(message.messageId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('ccip.explorer')}
                      </a>
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>{t('ccip.sender')}</dt>
                  <dd className="mono">{message.sender ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('ccip.receiver')}</dt>
                  <dd className="mono">{message.receiver ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('ccip.offramp')}</dt>
                  <dd className="mono">{message.offramp ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('ccip.gasLimit')}</dt>
                  <dd>{formatGasLimit(originalGas) || '—'}</dd>
                </div>
                <div>
                  <dt>{t('ccip.version')}</dt>
                  <dd>{message.version ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('ccip.messageStatus')}</dt>
                  <dd>{statusLabel}</dd>
                </div>
                {message.sendTransactionHash && (
                  <div>
                    <dt>{t('ccip.sourceTx')}</dt>
                    <dd>
                      {(() => {
                        const link = txLink(
                          Number(message.sourceNetworkInfo?.chainId ?? 0),
                          message.sendTransactionHash as string,
                        )
                        return link ? (
                          <a
                            className="inline-link"
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortAddress(message.sendTransactionHash)}
                          </a>
                        ) : (
                          <span className="mono">
                            {shortAddress(message.sendTransactionHash)}
                          </span>
                        )
                      })()}
                    </dd>
                  </div>
                )}
                {message.receiptTransactionHash && (
                  <div>
                    <dt>{t('ccip.destTx')}</dt>
                    <dd>
                      {(() => {
                        const link = txLink(
                          destChainId,
                          message.receiptTransactionHash as string,
                        )
                        return link ? (
                          <a
                            className="inline-link"
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortAddress(message.receiptTransactionHash)}
                          </a>
                        ) : (
                          <span className="mono">
                            {shortAddress(message.receiptTransactionHash)}
                          </span>
                        )
                      })()}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="ccip-exec">
                <h3>{t('ccip.execTitle')}</h3>
                <p className="ccip-exec-desc">{t('ccip.execDesc')}</p>

                <div className="ccip-wallet-row">
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
                  <span className="ccip-chain-chip">
                    {walletConnected && walletChainId
                      ? ccipChainName(walletChainId, chainName(walletChainId))
                      : '—'}
                  </span>
                  {wrongChain && (
                    <button
                      className="link-button"
                      type="button"
                      onClick={() => void switchToDest()}
                      disabled={chainBusy}
                    >
                      {t('ccip.switchChain', {
                        chain: ccipChainName(destChainId, destName),
                      })}
                    </button>
                  )}
                </div>

                {canExecute && (
                  <>
                    <label className="ccip-gas">
                      <span>{t('ccip.gasOverride')}</span>
                      <input
                        className="text-input"
                        value={gasInput}
                        onChange={(event) => setGasInput(event.target.value)}
                        placeholder={originalGas ?? '0'}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={t('ccip.gasOverride')}
                        aria-invalid={Boolean(gas.error)}
                      />
                    </label>
                    <div className="ccip-gas-presets">
                      {originalGas && (
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => setGasInput(originalGas)}
                        >
                          {t('ccip.gasOriginal')} · {formatGasLimit(originalGas)}
                        </button>
                      )}
                      {originalGas && (
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => {
                            try {
                              const doubled = BigInt(originalGas) * 2n
                              setGasInput(
                                doubled > 0xffffffffn
                                  ? '4294967295'
                                  : doubled.toString(),
                              )
                            } catch {
                              // Ignore malformed gas limits from the API.
                            }
                          }}
                        >
                          {t('ccip.gasDouble')}
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => setGasInput('1000000')}
                      >
                        1,000,000
                      </button>
                    </div>
                    {gas.error ? (
                      <p className="ccip-gas-error">
                        {gas.error === 'ccip.gasTooLow'
                          ? t('ccip.gasTooLow', {
                              min: formatGasLimit(originalGas) || '0',
                            })
                          : t(gas.error)}
                      </p>
                    ) : (
                      <p className="tx-search-hint">
                        {t('ccip.gasHint', {
                          gas: formatGasLimit(originalGas) || '0',
                        })}
                      </p>
                    )}

                    <button
                      className="btn btn-primary ccip-exec-btn"
                      type="button"
                      onClick={() => void runExecute()}
                      disabled={executeDisabled}
                    >
                      {executeLabel}
                    </button>
                  </>
                )}

                {exec.status === 'sim-failed' && (
                  <div className="notice notice-error">
                    <p>{t('ccip.simFailed', { message: exec.message })}</p>
                    {exec.reason && (
                      <p className="mono ccip-reason">{exec.reason.text}</p>
                    )}
                    {exec.reason?.truncated && (
                      <p className="ccip-reason-note">{t('ccip.truncatedError')}</p>
                    )}
                    {exec.reason?.name && REASON_HINTS[exec.reason.name] && (
                      <p>{t(REASON_HINTS[exec.reason.name])}</p>
                    )}
                  </div>
                )}

                {exec.status === 'error' && (
                  <p className="notice notice-error">{exec.message}</p>
                )}

                {(exec.status === 'pending' ||
                  exec.status === 'success' ||
                  exec.status === 'reverted' ||
                  exec.status === 'timeout') && (
                  <div
                    className={`notice ${
                      exec.status === 'success'
                        ? 'notice-success'
                        : exec.status === 'reverted'
                          ? 'notice-error'
                          : exec.status === 'timeout'
                            ? 'notice-warning'
                            : 'notice-info'
                    }`}
                  >
                    <p>
                      {exec.status === 'pending'
                        ? t('ccip.txPending')
                        : exec.status === 'success'
                          ? t('ccip.txSuccess')
                          : exec.status === 'timeout'
                            ? t('ccip.txTimeout')
                            : t('ccip.txReverted')}
                    </p>
                    <p className="mono ccip-reason">{exec.hash}</p>
                    {exec.status === 'reverted' && exec.reason && (
                      <>
                        <p className="mono ccip-reason">{exec.reason.text}</p>
                        {exec.reason.truncated && (
                          <p className="ccip-reason-note">
                            {t('ccip.truncatedError')}
                          </p>
                        )}
                        {exec.reason.name &&
                          REASON_HINTS[exec.reason.name] && (
                            <p>{t(REASON_HINTS[exec.reason.name])}</p>
                          )}
                      </>
                    )}
                    {(() => {
                      const link = txLink(destChainId, exec.hash)
                      return link ? (
                        <a
                          className="inline-link"
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('ccip.viewTx')}
                        </a>
                      ) : null
                    })()}
                  </div>
                )}

                <details className="ccip-advanced">
                  <summary>{t('ccip.advanced')}</summary>
                  <dl className="kv">
                    <div>
                      <dt>{t('ccip.ccvs')}</dt>
                      <dd className="mono">
                        {inputsV2 && inputsV2.verifierAddresses.length > 0
                          ? inputsV2.verifierAddresses.join(', ')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('ccip.ccvCount')}</dt>
                      <dd>{inputsV2 ? inputsV2.ccvData.length : 0}</dd>
                    </div>
                    <div>
                      <dt>{t('ccip.encodedLength')}</dt>
                      <dd>
                        {inputsV2
                          ? `${Math.max(
                              0,
                              (inputsV2.encodedMessage.length - 2) / 2,
                            )} bytes`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('ccip.calldataLength')}</dt>
                      <dd>
                        {calldata
                          ? `${Math.max(0, (calldata.length - 2) / 2)} bytes`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('ccip.onchainState')}</dt>
                      <dd>
                        {onchainState !== undefined ? onchainState : '—'}
                      </dd>
                    </div>
                  </dl>
                </details>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="explainer ccip-explainer">
        <h2>{t('ccip.faqTitle')}</h2>
        <div className="explainer-grid">
          <article>
            <h3>{t('ccip.faq1Title')}</h3>
            <p>{t('ccip.faq1Body')}</p>
          </article>
          <article>
            <h3>{t('ccip.faq2Title')}</h3>
            <p>{t('ccip.faq2Body')}</p>
          </article>
          <article>
            <h3>{t('ccip.faq3Title')}</h3>
            <p>{t('ccip.faq3Body')}</p>
          </article>
        </div>
      </section>
    </>
  )
}
