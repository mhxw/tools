'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n, type MessageKey } from '../i18n'
import {
  checkStack,
  normalizeTarget,
  stackErrorMessage,
  type Detection,
  type StackReport,
} from '../lib/stack-check'

type ViewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; report: StackReport }
  | { status: 'error'; message: string }

type Props = {
  initialUrl?: string
  onQueryUrl: (url: string) => void
}

const EXAMPLES = ['https://nextjs.org', 'https://app.uniswap.org']

function categoryKey(category: Detection['category']): MessageKey {
  return `stack.cat.${category}` as MessageKey
}

export function StackChecker({ initialUrl, onQueryUrl }: Props) {
  const { t } = useI18n()
  const [input, setInput] = useState(initialUrl ?? '')
  const [state, setState] = useState<ViewState>({ status: 'idle' })
  const lastInitial = useRef<string | undefined>(undefined)
  const controller = useRef<AbortController | null>(null)

  function describeError(code: string) {
    if (code === 'invalid-url') return t('stack.invalid')
    if (code === 'timeout') return t('stack.timeout')
    if (code === 'http-429') return t('stack.rateLimit')
    const status = code.match(/^http-(\d+)$/)?.[1]
    if (status) return t('stack.httpError', { status })
    return t('stack.error', { message: code })
  }

  const runCheck = useCallback(
    async (value: string) => {
      const target = normalizeTarget(value)
      if (!target) {
        setState({ status: 'error', message: 'invalid-url' })
        return
      }

      controller.current?.abort()
      const nextController = new AbortController()
      controller.current = nextController

      setInput(target)
      setState({ status: 'loading' })
      onQueryUrl(target)

      try {
        const report = await checkStack(target, nextController.signal)
        if (nextController.signal.aborted) return
        setState({ status: 'ready', report })
      } catch (error) {
        if (nextController.signal.aborted) return
        setState({ status: 'error', message: stackErrorMessage(error) })
      }
    },
    [onQueryUrl],
  )

  useEffect(() => {
    if (!initialUrl || lastInitial.current === initialUrl) return
    lastInitial.current = initialUrl
    // oxlint-disable-next-line react/set-state-in-effect -- run a shared ?url= link after hydration
    setInput(initialUrl)
    void runCheck(initialUrl)
  }, [initialUrl, runCheck])

  useEffect(() => () => controller.current?.abort(), [])

  const report = state.status === 'ready' ? state.report : undefined
  const next = report?.detections.find((item) => item.id === 'nextjs')
  const react = report?.detections.find((item) => item.id === 'react')
  const buildTool = report?.detections.find((item) => item.category === 'build')

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{t('stack.eyebrow')}</p>
          <h2>{t('stack.title')}</h2>
        </div>
        <span className="network-chip">HTTP</span>
      </div>

      <div className="search-row">
        <input
          className="text-input"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            if (state.status === 'error') setState({ status: 'idle' })
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void runCheck(input)
          }}
          placeholder={t('stack.placeholder')}
          spellCheck={false}
          autoComplete="off"
          inputMode="url"
        />
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => void runCheck(input)}
          disabled={state.status === 'loading'}
        >
          {state.status === 'loading' ? t('stack.checking') : t('stack.query')}
        </button>
      </div>

      <div className="stack-examples">
        <span className="muted small">{t('stack.examples')}</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            className="chip-button"
            type="button"
            onClick={() => void runCheck(example)}
          >
            {example.replace('https://', '')}
          </button>
        ))}
      </div>

      {state.status === 'loading' && (
        <div className="status-box status-loading">
          <span className="spinner" /> {t('stack.loading')}
        </div>
      )}

      {state.status === 'error' && (
        <div className="status-box status-error">
          {describeError(state.message)}
        </div>
      )}

      {report && (
        <div className="result">
          <div className={`stack-hero ${next ? 'ok' : 'neutral'}`}>
            <div>
              <p className="eyebrow">
                {next ? t('stack.nextDetected') : t('stack.nextMissing')}
              </p>
              <h3>
                {next
                  ? `Next.js${next.version ? ` ${next.version}` : ''}`
                  : t('stack.notNext')}
              </h3>
              <p className="muted small">
                {next
                  ? next.version
                    ? t('stack.nextVersionHint', { version: next.version })
                    : t('stack.nextNoVersion')
                  : t('stack.notNextHint')}
              </p>
            </div>
            {next && (
              <span className="stack-badge">
                {report.router === 'app'
                  ? t('stack.routerApp')
                  : report.router === 'pages'
                    ? t('stack.routerPages')
                    : t('stack.routerUnknown')}
              </span>
            )}
          </div>

          <div className="safe-summary stack-summary">
            <div className={`domain-stat ${next?.version ? 'ok' : 'neutral'}`}>
              <span>{t('stack.summaryNext')}</span>
              <strong>{next ? next.version ?? t('stack.detected') : t('stack.notDetected')}</strong>
            </div>
            <div className={`domain-stat ${react ? 'ok' : 'neutral'}`}>
              <span>{t('stack.summaryReact')}</span>
              <strong>
                {react ? react.version ?? t('stack.detected') : t('stack.notDetected')}
              </strong>
            </div>
            <div className="domain-stat neutral">
              <span>{t('stack.summaryRouter')}</span>
              <strong>
                {report.router === 'app'
                  ? t('stack.routerApp')
                  : report.router === 'pages'
                    ? t('stack.routerPages')
                    : '—'}
              </strong>
            </div>
            <div className="domain-stat neutral">
              <span>{t('stack.summaryBuild')}</span>
              <strong>{buildTool?.name ?? '—'}</strong>
            </div>
          </div>

          <div className="stack-section">
            <h3>{t('stack.detectionsTitle')}</h3>
            {report.detections.length === 0 ? (
              <div className="notice notice-info">{t('stack.empty')}</div>
            ) : (
              <div className="stack-grid">
                {report.detections.map((item) => (
                  <article className="stack-card" key={item.id}>
                    <div className="stack-card-head">
                      <span className="stack-name">{item.name}</span>
                      <span
                        className={`stack-version ${item.version ? '' : 'unknown'}`}
                      >
                        {item.version ?? t('stack.noVersion')}
                      </span>
                    </div>
                    <span className="stack-cat">{t(categoryKey(item.category))}</span>
                    <p className="stack-evidence">{item.evidence.join(' · ')}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <details className="stack-raw">
            <summary>{t('stack.rawTitle')}</summary>
            <dl className="stack-raw-list">
              <div>
                <dt>{t('stack.rawPage')}</dt>
                <dd className="mono break">{report.url}</dd>
              </div>
              {report.title && (
                <div>
                  <dt>{t('stack.rawPageTitle')}</dt>
                  <dd>{report.title}</dd>
                </div>
              )}
              {report.signals.map((signal) => (
                <div key={`${signal.label}-${signal.value}`}>
                  <dt className="mono">{signal.label}</dt>
                  <dd className="mono break">{signal.value}</dd>
                </div>
              ))}
            </dl>

            <p className="muted small">{t('stack.assetsTitle')}</p>
            <ul className="stack-assets">
              {report.assets.map((asset) => (
                <li key={asset.url} className={asset.ok ? '' : 'failed'}>
                  <span className="mono break">{asset.url}</span>
                  <span className="muted">
                    {asset.ok ? `${Math.round(asset.bytes / 1024)} KB` : t('stack.assetFailed')}
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <p className="notice notice-info stack-disclaimer">
            {t('stack.disclaimer')}
          </p>
        </div>
      )}
    </section>
  )
}
