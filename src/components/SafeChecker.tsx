'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  hashTypedData,
  isAddress,
  isAddressEqual,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
} from 'viem'
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  usePublicClient,
  useSignTypedData,
  useSwitchChain,
  useWriteContract,
} from 'wagmi'
import {
  chainName,
  explorerAddressUrl,
  explorerName,
  explorerTxUrl,
} from '../chain-meta'
import { useI18n } from '../i18n'
import {
  SAFE_ABI,
  SAFE_TX_TYPES,
  encodeAddOwner,
  encodeRemoveOwner,
  getPrevOwner,
  safeTxDomain,
  type SafeInfo,
} from '../lib/safe'

type TxState =
  | { status: 'idle' }
  | { status: 'signing' }
  | { status: 'sending' }
  | { status: 'confirming'; hash: Hash }
  | { status: 'success'; hash: Hash }
  | { status: 'error'; message: string }

type Props = {
  chainId: number
  initialSafe?: Address
  onQuerySafe: (safe: Address) => void
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function SafeChecker({ chainId, initialSafe, onQuerySafe }: Props) {
  const { t } = useI18n()
  const [input, setInput] = useState(initialSafe ?? '')
  const [safeAddress, setSafeAddress] = useState<Address | undefined>(
    initialSafe,
  )
  const [inputError, setInputError] = useState<string>()
  const [newOwner, setNewOwner] = useState('')
  const [addThreshold, setAddThreshold] = useState('')
  const [removeTarget, setRemoveTarget] = useState('')
  const [tx, setTx] = useState<TxState>({ status: 'idle' })
  const lastInitialSafe = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!initialSafe || lastInitialSafe.current === initialSafe) return
    lastInitialSafe.current = initialSafe
    // oxlint-disable-next-line react/set-state-in-effect -- sync a shared ?safe= link after hydration
    setInput(initialSafe)
    setSafeAddress(initialSafe)
  }, [initialSafe])

  const publicClient = usePublicClient({ chainId })
  const connection = useConnection()
  const connectors = useConnectors()
  const connect = useConnect()
  const { disconnect } = useDisconnect()
  const switchChain = useSwitchChain()
  const { signTypedDataAsync } = useSignTypedData()
  const { writeContractAsync } = useWriteContract()

  const safeQuery = useQuery({
    queryKey: ['safe-info', chainId, safeAddress],
    enabled: Boolean(publicClient && safeAddress),
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'not-safe') return false
      return failureCount < 2
    },
    queryFn: async (): Promise<SafeInfo> => {
      if (!publicClient || !safeAddress) throw new Error('missing safe')

      const code = await publicClient.getCode({ address: safeAddress })
      if (!code || code === '0x') throw new Error('not-safe')

      // Any deployed contract passes the code check, so probe VERSION() first.
      // A non-Safe contract has no such function and reverts.
      let version: string
      try {
        version = await publicClient.readContract({
          address: safeAddress,
          abi: SAFE_ABI,
          functionName: 'VERSION',
        })
      } catch {
        throw new Error('not-safe')
      }

      const [owners, threshold, nonce] = await Promise.all([
        publicClient.readContract({
          address: safeAddress,
          abi: SAFE_ABI,
          functionName: 'getOwners',
        }),
        publicClient.readContract({
          address: safeAddress,
          abi: SAFE_ABI,
          functionName: 'getThreshold',
        }),
        publicClient.readContract({
          address: safeAddress,
          abi: SAFE_ABI,
          functionName: 'nonce',
        }),
      ])

      return {
        owners: [...owners] as Address[],
        threshold,
        version,
        nonce,
      }
    },
  })

  const info = safeQuery.data
  const isOwner = Boolean(
    connection.address &&
      info?.owners.some((owner) =>
        isAddressEqual(owner, connection.address as Address),
      ),
  )
  const wrongChain =
    connection.isConnected &&
    connection.chainId !== undefined &&
    connection.chainId !== chainId
  const canManage = Boolean(info && info.threshold === 1n && isOwner && !wrongChain)
  const newOwnerCount = info ? info.owners.length + 1 : 1
  const defaultAddThreshold = info ? String(info.threshold) : '1'
  const thresholdValue = addThreshold || defaultAddThreshold

  const selectedRemoveOwner = useMemo(() => {
    if (!info) return ''
    return info.owners.some(
      (owner) => owner.toLowerCase() === removeTarget.toLowerCase(),
    )
      ? removeTarget
      : info.owners[0] ?? ''
  }, [info, removeTarget])

  function handleQuery() {
    const value = input.trim()
    if (!isAddress(value)) {
      setInputError(t('safe.inputError'))
      return
    }

    setInputError(undefined)
    setSafeAddress(value)
    setTx({ status: 'idle' })
    onQuerySafe(value)
  }

  function handleConnect() {
    const connector = connectors[0]
    if (!connector) return
    connect.mutate({ connector })
  }

  async function executeSafeCall(data: Hex) {
    if (!info || !publicClient || !safeAddress || !connection.address) {
      setTx({ status: 'error', message: t('safe.connectFirst') })
      return
    }

    setTx({ status: 'signing' })

    try {
      const safeTx = {
        to: safeAddress,
        value: 0n,
        data,
        operation: 0,
        safeTxGas: 0n,
        baseGas: 0n,
        gasPrice: 0n,
        gasToken: zeroAddress,
        refundReceiver: zeroAddress,
        nonce: info.nonce,
      }
      const domain = safeTxDomain(chainId, safeAddress, info.version)

      // Verify that our locally built EIP-712 payload matches the digest the
      // Safe contract expects. This catches unsupported Safe versions before
      // the wallet ever signs.
      const localHash = hashTypedData({
        domain,
        types: SAFE_TX_TYPES,
        primaryType: 'SafeTx',
        message: safeTx,
      })
      const onchainHash = await publicClient.readContract({
        address: safeAddress,
        abi: SAFE_ABI,
        functionName: 'getTransactionHash',
        args: [
          safeTx.to,
          safeTx.value,
          safeTx.data,
          safeTx.operation,
          safeTx.safeTxGas,
          safeTx.baseGas,
          safeTx.gasPrice,
          safeTx.gasToken,
          safeTx.refundReceiver,
          safeTx.nonce,
        ],
      })
      if (localHash.toLowerCase() !== onchainHash.toLowerCase()) {
        throw new Error(t('safe.hashMismatch'))
      }

      const signature = await signTypedDataAsync({
        account: connection.address,
        domain,
        types: SAFE_TX_TYPES,
        primaryType: 'SafeTx',
        message: safeTx,
      })

      setTx({ status: 'sending' })

      const hash = await writeContractAsync({
        address: safeAddress,
        abi: SAFE_ABI,
        functionName: 'execTransaction',
        args: [
          safeTx.to,
          safeTx.value,
          safeTx.data,
          safeTx.operation,
          safeTx.safeTxGas,
          safeTx.baseGas,
          safeTx.gasPrice,
          safeTx.gasToken,
          safeTx.refundReceiver,
          signature,
        ],
        account: connection.address,
        chainId,
      })

      setTx({ status: 'confirming', hash })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error('transaction reverted')
      }

      setTx({ status: 'success', hash })
      setNewOwner('')
      setRemoveTarget('')
      await safeQuery.refetch()
    } catch (error) {
      setTx({ status: 'error', message: safeErrorMessage(error) })
    }
  }

  async function handleAddOwner() {
    if (!info) return
    if (!isAddress(newOwner)) {
      setTx({ status: 'error', message: t('safe.invalidOwner') })
      return
    }
    if (
      info.owners.some((owner) => isAddressEqual(owner, newOwner))
    ) {
      setTx({ status: 'error', message: t('safe.ownerExists') })
      return
    }

    const threshold = Number(addThreshold || defaultAddThreshold)
    if (
      !Number.isInteger(threshold) ||
      threshold < 1 ||
      threshold > newOwnerCount
    ) {
      setTx({
        status: 'error',
        message: t('safe.invalidThreshold', { max: newOwnerCount }),
      })
      return
    }

    await executeSafeCall(encodeAddOwner(newOwner, BigInt(threshold)))
  }

  async function handleRemoveOwner() {
    if (!info || !isAddress(selectedRemoveOwner)) return
    if (info.owners.length <= 1) {
      setTx({ status: 'error', message: t('safe.removeLastOwner') })
      return
    }

    const owner = selectedRemoveOwner as Address
    const prevOwner = getPrevOwner(info.owners, owner)
    if (!prevOwner) {
      setTx({ status: 'error', message: t('safe.invalidOwner') })
      return
    }

    await executeSafeCall(encodeRemoveOwner(prevOwner, owner, 1n))
  }

  const owners = info?.owners ?? []
  const threshold = info ? Number(info.threshold) : 0

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{t('safe.eyebrow')}</p>
          <h2>{t('safe.title')}</h2>
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
          placeholder={t('safe.placeholder')}
          spellCheck={false}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="button" onClick={handleQuery}>
          {t('safe.query')}
        </button>
      </div>

      {inputError && <p className="notice notice-error">{inputError}</p>}

      {safeQuery.isFetching ? (
        <div className="status-box status-loading safe-loading">
          <span className="spinner" /> {t('safe.loading')}
        </div>
      ) : safeQuery.isError ? (
        <div className="status-box status-error">
          {t('safe.queryFailed', {
            message:
              safeQuery.error.message === 'not-safe'
                ? t('safe.notSafe')
                : safeQuery.error.message,
          })}
        </div>
      ) : info ? (
        <div className="result">
          <div className="result-head">
            <div>
              <p className="eyebrow">{t('safe.addressLabel')}</p>
              <p className="mono address-line">
                {safeAddress}
                <a
                  className="inline-link"
                  href={explorerAddressUrl(chainId, safeAddress ?? '')}
                  target="_blank"
                  rel="noreferrer"
                >
                  {explorerName(chainId)}
                </a>
              </p>
            </div>
          </div>

          <div className="safe-summary">
            <div className="domain-stat ok">
              <span>{t('safe.threshold')}</span>
              <strong>
                {t('safe.thresholdValue', {
                  threshold,
                  owners: owners.length,
                })}
              </strong>
            </div>
            <div className="domain-stat neutral">
              <span>{t('safe.version')}</span>
              <strong>{info.version}</strong>
            </div>
            <div className="domain-stat neutral">
              <span>{t('safe.nonce')}</span>
              <strong>{info.nonce.toString()}</strong>
            </div>
          </div>

          <div className="safe-section">
            <h3>{t('safe.ownersTitle')}</h3>
            <div className="safe-owners">
              {owners.map((owner) => (
                <code
                  className={
                    connection.address &&
                    isAddressEqual(owner, connection.address)
                      ? 'safe-owner current'
                      : 'safe-owner'
                  }
                  key={owner}
                >
                  {owner}
                </code>
              ))}
            </div>
          </div>

          <div className="safe-wallet-row">
            {connection.isConnected ? (
              <div className="wallet-pill">
                <span className="dot" />
                <span className="mono">
                  {connection.address
                    ? `${connection.address.slice(0, 6)}...${connection.address.slice(-4)}`
                    : ''}
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
                {t('safe.connect')}
              </button>
            )}

            {connection.isConnected && (
              <span className={isOwner ? 'kv-ok' : 'kv-bad'}>
                {isOwner ? t('safe.isOwner') : t('safe.notOwner')}
              </span>
            )}

            {wrongChain && (
              <button
                className="link-button"
                type="button"
                onClick={() => switchChain.mutate({ chainId })}
              >
                {t('safe.switchNetwork')}
              </button>
            )}
          </div>

          {info.threshold !== 1n ? (
            <div className="notice notice-info">
              {t('safe.readOnly', {
                threshold,
                owners: owners.length,
              })}
            </div>
          ) : (
            <>
              {owners.length === 1 && (
                <div className="notice notice-warning">
                  {t('safe.singleOwnerWarning')}
                </div>
              )}

              <div className="safe-section">
                <h3>{t('safe.addTitle')}</h3>
                <div className="safe-form">
                  <label className="field">
                    <span>{t('safe.newOwner')}</span>
                    <input
                      className="text-input mono"
                      value={newOwner}
                      onChange={(event) => setNewOwner(event.target.value)}
                      placeholder={t('safe.newOwnerPlaceholder')}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </label>
                  <label className="field safe-threshold-field">
                    <span>{t('safe.newThreshold')}</span>
                    <input
                      className="text-input mono"
                      type="number"
                      min={1}
                      max={newOwnerCount}
                      value={thresholdValue}
                      onChange={(event) => setAddThreshold(event.target.value)}
                    />
                  </label>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={!canManage || tx.status === 'signing' || tx.status === 'sending' || tx.status === 'confirming'}
                    onClick={() => void handleAddOwner()}
                  >
                    {t('safe.addCta')}
                  </button>
                </div>
                <p className="muted small">
                  {t('safe.addHint', { count: newOwnerCount })}
                </p>
              </div>

              <div className="safe-section">
                <h3>{t('safe.removeTitle')}</h3>
                <div className="safe-form">
                  <label className="field">
                    <span>{t('safe.removeSelect')}</span>
                    <select
                      className="network-select safe-owner-select"
                      value={selectedRemoveOwner}
                      onChange={(event) => setRemoveTarget(event.target.value)}
                      disabled={owners.length <= 1}
                    >
                      {owners.map((owner) => (
                        <option key={owner} value={owner}>
                          {owner}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={
                      !canManage ||
                      owners.length <= 1 ||
                      tx.status === 'signing' ||
                      tx.status === 'sending' ||
                      tx.status === 'confirming'
                    }
                    onClick={() => void handleRemoveOwner()}
                  >
                    {t('safe.removeCta')}
                  </button>
                </div>
                <p className="muted small">{t('safe.removeHint')}</p>
              </div>
            </>
          )}

          {tx.status !== 'idle' && (
            <div className={`notice ${tx.status === 'error' ? 'notice-error' : tx.status === 'success' ? 'notice-success' : 'notice-info'}`}>
              {tx.status === 'signing' && t('safe.signing')}
              {tx.status === 'sending' && t('safe.sending')}
              {tx.status === 'confirming' && t('safe.confirming')}
              {tx.status === 'success' && (
                <>
                  {t('safe.success')}{' '}
                  <a
                    className="inline-link"
                    href={explorerTxUrl(chainId, tx.hash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('safe.tx')}
                  </a>
                </>
              )}
              {tx.status === 'error' && (
                <>
                  <strong>{t('safe.failed')}</strong>
                  <p className="break">{tx.message}</p>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
