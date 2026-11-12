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
  const primary =
    report?.detections.find((item) => item.category === 'framework') ??
    report?.detections.find((item) => item.category === 'ui') ??
    report?.detections[0]
  const uiRuntime = report?.detections.find((item) => item.category === 'ui')
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
          <div className={`stack-hero ${primary ? 'ok' : 'neutral'}`}>
            <div>
              <p className="eyebrow">
                {primary
                  ? t('stack.detectedTitle', { count: report.detections.length })
                  : t('stack.eyebrow')}
              </p>
              <h3>
                {primary
                  ? `${primary.name}${primary.version ? ` ${primary.version}` : ''}`
                  : t('stack.noneTitle')}
              </h3>
              <p className="muted small">
                {primary
                  ? t('stack.heroHint', {
                      count: report.detections.length,
                      build: buildTool?.name ?? '—',
                    })
                  : t('stack.empty')}
              </p>
            </div>
            {report.router && (
              <span className="stack-badge">
                {report.router === 'app'
                  ? t('stack.routerApp')
                  : t('stack.routerPages')}
              </span>
            )}
          </div>

          <div className="safe-summary stack-summary">
            <div className={`domain-stat ${primary ? 'ok' : 'neutral'}`}>
              <span>{t('stack.summaryFramework')}</span>
              <strong>
                {primary
                  ? `${primary.name}${primary.version ? ` ${primary.version}` : ''}`
                  : t('stack.notDetected')}
              </strong>
            </div>
            <div className={`domain-stat ${uiRuntime ? 'ok' : 'neutral'}`}>
              <span>{t('stack.summaryUi')}</span>
              <strong>
                {uiRuntime
                  ? `${uiRuntime.name}${uiRuntime.version ? ` ${uiRuntime.version}` : ''}`
                  : '—'}
              </strong>
            </div>
            <div className="domain-stat neutral">
              <span>{t('stack.summaryBuild')}</span>
              <strong>{buildTool?.name ?? '—'}</strong>
            </div>
            <div className="domain-stat neutral">
              <span>{t('stack.summaryCount')}</span>
              <strong>
                {t('stack.summaryCountValue', {
                  count: report.detections.length,
                })}
              </strong>
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

          {report.versions.length > 0 && (
            <div className="stack-section">
              <h3>{t('stack.versionsTitle')}</h3>
              <div className="stack-version-list">
                {report.versions.map((item) => {
                  const status = !item.latest
                    ? 'unknown'
                    : !item.outdated
                      ? 'fresh'
                      : item.majorBehind
                        ? 'major'
                        : 'outdated'
                  return (
                    <article
                      className="stack-version-row"
                      key={`${item.id}-${item.current}`}
                    >
                      <div className="stack-version-head">
                        <span className="stack-name">{item.name}</span>
                        <span className="stack-pkg mono">{item.pkg}</span>
                      </div>
                      <div className="stack-version-meta">
                        <span>
                          {t('stack.current')} <code>{item.current}</code>
                        </span>
                        <span>
                          {t('stack.latest')} <code>{item.latest ?? '—'}</code>
                        </span>
                        <span className={`stack-status ${status}`}>
                          {status === 'fresh'
                            ? t('stack.versionFresh')
                            : status === 'major'
                              ? t('stack.versionMajor')
                              : status === 'outdated'
                                ? t('stack.versionOutdated')
                                : t('stack.versionUnknown')}
                        </span>
                      </div>
                      <div
                        className={`stack-vuln-line ${item.vulns.length ? 'bad' : 'ok'}`}
                      >
                        {item.vulns.length === 0
                          ? t('stack.vulnNone')
                          : t('stack.vulnCount', { count: item.vulns.length })}
                      </div>
                      {item.vulns.length > 0 && (
                        <ul className="stack-vuln-list">
                          {item.vulns.map((vuln) => (
                            <li key={vuln.id}>
                              <a
                                href={vuln.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {vuln.id}
                              </a>
                              {vuln.severity && (
                                <span className="stack-sev">{vuln.severity}</span>
                              )}
                              <span className="muted">{vuln.summary}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  )
                })}
              </div>
              <p className="muted small">{t('stack.versionDisclaimer')}</p>
            </div>
          )}

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
