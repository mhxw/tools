'use client'

import { useState } from 'react'
import { isAddress, type Address } from 'viem'
import {
  chainName,
  explorerAddressUrl,
  explorerName,
} from '../chain-meta'
import { useI18n, type MessageKey } from '../i18n'
import { RichText } from './RichText'

type Props = {
  chainId: number
  address?: Address
  onCheckAddress: (address: Address) => void
}

const STEPS: Array<{ title: MessageKey; body: MessageKey }> = [
  { title: 'guide.step1Title', body: 'guide.step1Body' },
  { title: 'guide.step2Title', body: 'guide.step2Body' },
  { title: 'guide.step3Title', body: 'guide.step3Body' },
  { title: 'guide.step4Title', body: 'guide.step4Body' },
  { title: 'guide.step5Title', body: 'guide.step5Body' },
  { title: 'guide.step6Title', body: 'guide.step6Body' },
]

const NOTES: MessageKey[] = [
  'guide.note1',
  'guide.note2',
  'guide.note3',
  'guide.note4',
  'guide.note5',
]

export function MetaMaskGuide({ chainId, address, onCheckAddress }: Props) {
  const { t } = useI18n()
  const [input, setInput] = useState(address ?? '')
  const [inputError, setInputError] = useState<string>()

  function handleCheck() {
    const value = input.trim()
    if (!isAddress(value)) {
      setInputError(t('guide.invalidAddress'))
      return
    }
    setInputError(undefined)
    onCheckAddress(value)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{t('guide.eyebrow')}</p>
          <h2>{t('guide.title')}</h2>
        </div>
        <span className="network-chip">{chainName(chainId)}</span>
      </div>

      <div className="guide-intro">
        <p>
          <RichText text={t('guide.intro')} />
        </p>
        <p className="muted small">
          {t('guide.chainHint', { chain: chainName(chainId) })}
        </p>
      </div>

      <div className="notice notice-warning">
        <strong>{t('guide.whyTitle')}</strong>
        <p>{t('guide.whyBody')}</p>
      </div>

      <div className="search-row guide-check">
        <input
          className="text-input"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setInputError(undefined)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleCheck()
          }}
          placeholder={t('guide.addressPlaceholder')}
          spellCheck={false}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="button" onClick={handleCheck}>
          {t('guide.checkButton')}
        </button>
      </div>
      <p className="muted small">{t('guide.checkBody')}</p>
      {inputError && <p className="notice notice-error">{inputError}</p>}

      {address && (
        <div className="guide-address">
          <div>
            <p className="eyebrow">{t('addr.queryAddress')}</p>
            <p className="mono address-line">{address}</p>
          </div>
          <div className="actions">
            <a
              className="btn btn-ghost btn-sm"
              href={explorerAddressUrl(chainId, address)}
              target="_blank"
              rel="noreferrer"
            >
              {t('guide.openExplorer')}
            </a>
            <a
              className="btn btn-ghost btn-sm"
              href={`https://revoke.cash/address/${address}?chainId=${chainId}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('guide.openRevokeCash')}
            </a>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => onCheckAddress(address)}
            >
              {t('guide.recheck')}
            </button>
          </div>
        </div>
      )}

      <div className="guide-section">
        <h3>{t('guide.stepsTitle')}</h3>
        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="step-num">{index + 1}</span>
              <div>
                <strong>{t(step.title)}</strong>
                <p>{t(step.body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="guide-section">
        <h3>{t('guide.notesTitle')}</h3>
        <ul className="notes-list">
          {NOTES.map((note) => (
            <li key={note}>{t(note)}</li>
          ))}
        </ul>
      </div>

      <div className="guide-section">
        <h3>{t('guide.verifyTitle')}</h3>
        <p className="muted">
          <RichText text={t('guide.verifyBody')} />
        </p>
        {address && (
          <p className="muted small">
            {t('addr.queryAddress')}:{' '}
            <a
              className="inline-link"
              href={explorerAddressUrl(chainId, address)}
              target="_blank"
              rel="noreferrer"
            >
              {explorerName(chainId)}
            </a>
          </p>
        )}
      </div>
    </section>
  )
}
