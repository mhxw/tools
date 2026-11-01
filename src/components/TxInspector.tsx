'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isHash, type Hash, type Hex } from 'viem'
import { recoverAuthorizationAddress } from 'viem/utils'
import { usePublicClient } from 'wagmi'
import {
  chainName,
  explorerAddressUrl,
  explorerName,
  explorerTxUrl,
} from '../chain-meta'
import { useI18n } from '../i18n'
import { getKnownDelegate, shortAddress } from '../lib/eip7702'

type Props = {
  chainId: number
  initialTxHash?: Hash
  onInspectAddress: (address: `0x${string}`) => void
}

export function TxInspector({
  chainId,
  initialTxHash,
  onInspectAddress,
}: Props) {
  const { t } = useI18n()
  const [input, setInput] = useState(() => initialTxHash ?? '')
  const [txHash, setTxHash] = useState<Hash | undefined>(initialTxHash)
  const [inputError, setInputError] = useState<string>()
  const publicClient = usePublicClient({ chainId })

  const txQuery = useQuery({
    queryKey: ['tx-inspect', chainId, txHash],
    enabled: Boolean(publicClient && txHash),
    queryFn: async () => {
      if (!publicClient || !txHash) throw new Error('Missing RPC client or hash')

      const [transaction, receipt] = await Promise.all([
        publicClient.getTransaction({ hash: txHash }),
        publicClient.getTransactionReceipt({ hash: txHash }),
      ])

      const authorizations = await Promise.all(
        (transaction.authorizationList ?? []).map(async (authorization) => {
          const authority = await recoverAuthorizationAddress({
            authorization,
          }).catch(() => undefined)
          return { ...authorization, authority }
        }),
      )

      return { transaction, receipt, authorizations }
    },
  })

  function handleQuery() {
    const value = input.trim()
    if (!isHash(value)) {
      setInputError(t('tx.inputError'))
      return
    }
    setInputError(undefined)
    setTxHash(value as Hash)
  }

  const transaction = txQuery.data?.transaction
  const receipt = txQuery.data?.receipt
  const authorizations = txQuery.data?.authorizations ?? []
  const is7702 = transaction?.type === 'eip7702'

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{t('tx.eyebrow')}</p>
          <h2>{t('tx.title')}</h2>
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
          placeholder={t('tx.placeholder')}
          spellCheck={false}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="button" onClick={handleQuery}>
          {t('tx.parse')}
        </button>
      </div>

      {inputError && <p className="notice notice-error">{inputError}</p>}

      {txHash && (
        <div className="result">
          <div className="result-head">
            <div>
              <p className="eyebrow">{t('tx.txHash')}</p>
              <p className="mono address-line">
                {txHash}
                <a
                  className="inline-link"
                  href={explorerTxUrl(chainId, txHash)}
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
              onClick={() => txQuery.refetch()}
              disabled={txQuery.isFetching}
            >
              {txQuery.isFetching
                ? t('common.refreshing')
                : t('common.refresh')}
            </button>
          </div>

          {txQuery.isPending ? (
            <div className="status-box status-loading">
              <span className="spinner" /> {t('tx.loading')}
            </div>
          ) : txQuery.isError ? (
            <div className="status-box status-error">
              {t('tx.parseFailed', { message: txQuery.error.message })}
            </div>
          ) : transaction ? (
            <>
              <div
                className={`status-box ${is7702 ? 'status-danger' : 'status-neutral'}`}
              >
                <div className={`status-icon ${is7702 ? '' : 'neutral'}`}>
                  {is7702 ? '7702' : 'TX'}
                </div>
                <div>
                  <strong>
                    {is7702 ? t('tx.is7702') : t('tx.not7702')}
                  </strong>
                  <p>
                    {t('tx.type')}
                    <code>{transaction.type}</code>
                    {is7702 &&
                      t('tx.authCount', { count: authorizations.length })}
                  </p>
                </div>
              </div>

              <dl className="kv">
                <div>
                  <dt>{t('tx.from')}</dt>
                  <dd className="mono">
                    {transaction.from}
                    <a
                      className="inline-link"
                      href={explorerAddressUrl(chainId, transaction.from)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {explorerName(chainId)}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>{t('tx.to')}</dt>
                  <dd className="mono">
                    {transaction.to ?? t('tx.contractCreation')}
                    {transaction.to && (
                      <a
                        className="inline-link"
                        href={explorerAddressUrl(chainId, transaction.to)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {explorerName(chainId)}
                      </a>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t('tx.blockStatus')}</dt>
                  <dd>
                    {transaction.blockNumber?.toString() ?? '-'} ·{' '}
                    {receipt?.status === 'success' ? (
                      <span className="kv-ok">{t('common.success')}</span>
                    ) : (
                      <span className="kv-bad">{t('common.failed')}</span>
                    )}
                  </dd>
                </div>
              </dl>

              {authorizations.length > 0 && (
                <div className="auth-list">
                  <h3>{t('tx.authList')}</h3>
                  {authorizations.map((authorization, index) => {
                    const known = getKnownDelegate(authorization.address)
                    return (
                      <article className="auth-card" key={index}>
                        <header>
                          <span className="auth-index">#{index + 1}</span>
                          <span className="mono">
                            {shortAddress(
                              authorization.authority ?? authorization.address,
                              10,
                              8,
                            )}
                          </span>
                        </header>
                        <dl className="kv">
                          <div>
                            <dt>{t('tx.signer')}</dt>
                            <dd className="mono break">
                              {authorization.authority ?? t('tx.unrecoverable')}
                              {authorization.authority && (
                                <button
                                  className="link-button"
                                  type="button"
                                  onClick={() =>
                                    onInspectAddress(authorization.authority!)
                                  }
                                >
                                  {t('tx.inspect')}
                                </button>
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('tx.delegate')}</dt>
                            <dd className="mono break">
                              {authorization.address}
                              {known && (
                                <span className="tag">{known.name}</span>
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('tx.nonce')}</dt>
                            <dd className="mono">
                              {authorization.nonce.toString()}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('tx.chainId')}</dt>
                            <dd className="mono">
                              {authorization.chainId.toString()}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('tx.signature')}</dt>
                            <dd className="mono break small">
                              yParity: {authorization.yParity} · r:{' '}
                              {truncateHex(authorization.r)} · s:{' '}
                              {truncateHex(authorization.s)}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </section>
  )
}

function truncateHex(value: Hex) {
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}
