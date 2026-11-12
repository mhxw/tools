'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n, type MessageKey } from '../i18n'
import {
  checkStack,
  lookupVersion,
  normalizeTarget,
  stackErrorMessage,
  type Detection,
  type StackReport,
  type VersionInfo,
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

function formatDate(value: string | undefined, lang: 'zh' | 'en') {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function StackChecker({ initialUrl, onQueryUrl }: Props) {
  const { lang, t } = useI18n()
  const [input, setInput] = useState(initialUrl ?? '')
  const [state, setState] = useState<ViewState>({ status: 'idle' })
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [manualVersion, setManualVersion] = useState('')
  const [manualInfo, setManualInfo] = useState<VersionInfo>()
  const [manualError, setManualError] = useState('')
  const lastInitial = useRef<string | undefined>(undefined)
  const controller = useRef<AbortController | null>(null)

  function toggleReveal(id: string) {
    setRevealed((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
      setRevealed(new Set())
      setManualVersion('')
      setManualInfo(undefined)
      setManualError('')
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

  async function applyManualVersion() {
    const value = manualVersion.trim()
    if (!/^\d+\.\d+\.\d+$/.test(value)) {
      setManualError(t('stack.manualInvalid'))
      return
    }
    setManualError('')
    const info = await lookupVersion('Next.js', 'next', value)
    setManualInfo(info)
  }

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
  const nextDetection = report?.detections.find((item) => item.id === 'nextjs')
  const primaryVersion =
    primary?.id === 'nextjs'
      ? primary.version ?? manualInfo?.current
      : primary?.version
  const displayVersions =
    report && manualInfo && !report.versions.some((item) => item.id === 'nextjs')
      ? [...report.versions, manualInfo]
      : (report?.versions ?? [])

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
          {report.via === 'reader' && (
            <div className="notice notice-info">
              {t('stack.readerFallback')}
            </div>
          )}
          <div className={`stack-hero ${primary ? 'ok' : 'neutral'}`}>
            <div>
              <p className="eyebrow">
                {primary
                  ? t('stack.detectedTitle', { count: report.detections.length })
                  : t('stack.eyebrow')}
              </p>
              <h3>
                {primary
                  ? `${primary.name}${primaryVersion ? ` ${primaryVersion}` : ''}`
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

          {nextDetection && !nextDetection.version && !manualInfo && (
            <div className="stack-manual">
              <p className="stack-manual-title">{t('stack.manualTitle')}</p>
              <p className="muted small">
                {t('stack.manualHint')} <code>window.next?.version</code>
              </p>
              <div className="stack-manual-form">
                <input
                  className="text-input mono"
                  value={manualVersion}
                  onChange={(event) => {
                    setManualVersion(event.target.value)
                    setManualError('')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void applyManualVersion()
                  }}
                  placeholder={t('stack.manualPlaceholder')}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => void applyManualVersion()}
                >
                  {t('stack.manualUse')}
                </button>
              </div>
              {manualError && (
                <p className="stack-manual-error">{manualError}</p>
              )}
            </div>
          )}

          {manualInfo && (
            <p className="muted small stack-manual-applied">
              {t('stack.manualApplied', { version: manualInfo.current })}
            </p>
          )}

          <div className="safe-summary stack-summary">
            <div className={`domain-stat ${primary ? 'ok' : 'neutral'}`}>
              <span>{t('stack.summaryFramework')}</span>
              <strong>
                {primary
                  ? `${primary.name}${primaryVersion ? ` ${primaryVersion}` : ''}`
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
                {report.detections.map((item) => {
                  const itemVersion =
                    item.id === 'nextjs'
                      ? item.version ?? manualInfo?.current
                      : item.version
                  return (
                    <article className="stack-card" key={item.id}>
                      <div className="stack-card-head">
                        <span className="stack-name">{item.name}</span>
                        <span
                          className={`stack-version ${itemVersion ? '' : 'unknown'}`}
                        >
                          {itemVersion ?? t('stack.noVersion')}
                        </span>
                      </div>
                      <span className="stack-cat">
                        {t(categoryKey(item.category))}
                      </span>
                      <p className="stack-evidence">
                        {item.evidence.join(' · ')}
                      </p>
                      {item.id === 'nextjs' && !itemVersion && (
                        <p className="stack-evidence muted">
                          {t('stack.nextVersionMissing')}
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          {displayVersions.length > 0 && (
            <div className="stack-section">
              <h3>{t('stack.versionsTitle')}</h3>
              <div className="stack-version-list">
                {displayVersions.map((item) => {
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

          <div className="stack-section">
            <div className="stack-zw-head">
              <h3>{t('stack.zeroWireTitle')}</h3>
              <a
                className="inline-link"
                href={report.zeroWire.url}
                target="_blank"
                rel="noreferrer"
              >
                {t('stack.zeroWireMore')}
              </a>
            </div>
            {report.zeroWire.items.length === 0 ? (
              <p className="muted small">{t('stack.zeroWireEmpty')}</p>
            ) : (
              <div className="stack-zw-list">
                {report.zeroWire.items.map((item) => (
                  <article className="stack-zw-item" key={item.id}>
                    <a
                      className="stack-zw-title"
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.title}
                    </a>
                    <div className="stack-zw-meta">
                      {item.published && (
                        <span>{formatDate(item.published, lang)}</span>
                      )}
                      <span>
                        {t('stack.zeroWireMatch', {
                          names: item.matched.join(', '),
                        })}
                      </span>
                    </div>
                    <div className="stack-zw-tags">
                      {item.categories.slice(0, 5).map((category) => (
                        <span className="stack-zw-tag" key={category}>
                          {category}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className="muted small">{t('stack.zeroWireSource')}</p>
          </div>

          <div className="stack-section">
            <h3>{t('stack.exposureTitle')}</h3>
            {report.exposure.envNames.length === 0 &&
            report.exposure.sensitive.length === 0 &&
            report.exposure.sensitiveNames.length === 0 &&
            report.exposure.secrets.length === 0 &&
            report.exposure.sourceMaps.length === 0 ? (
              <p className="muted small">{t('stack.exposureEmpty')}</p>
            ) : (
              <>
                {report.exposure.envNames.length > 0 && (
                  <div className="stack-exp-block">
                    <p className="stack-exp-label">
                      {t('stack.exposureNames', {
                        count: report.exposure.envNames.length,
                      })}
                    </p>
                    <div className="stack-exp-chips">
                      {report.exposure.envNames.map((item) => (
                        <span
                          className="stack-exp-chip"
                          key={item.name}
                          title={item.source}
                        >
                          <span>{item.name}</span>
                          {item.value ? (
                            <span className="stack-exp-value"> = {item.value}</span>
                          ) : item.fallback ? (
                            <span className="stack-exp-value">
                              {' '}
                              → {item.fallback}
                            </span>
                          ) : (
                            <span className="stack-exp-muted">
                              {' '}
                              {t('stack.exposureNoValue')}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {report.exposure.sensitive.length > 0 && (
                  <div className="stack-exp-block">
                    <p className="stack-exp-label">
                      {t('stack.exposureSensitive', {
                        count: report.exposure.sensitive.length,
                      })}
                    </p>
                    <ul className="stack-exp-secrets">
                      {report.exposure.sensitive.map((item) => {
                        const revealId = `sensitive:${item.key}:${item.source}:${item.preview}`
                        const isRevealed = revealed.has(revealId)
                        return (
                          <li key={revealId}>
                            <span className={`stack-sev ${item.severity}`}>
                              {t(
                                `stack.exposureSeverity.${item.severity}` as MessageKey,
                              )}
                            </span>
                            <code>{item.key}</code>
                            <span className="muted">=</span>
                            <code className="break">
                              {isRevealed ? item.value : item.preview}
                            </code>
                            <button
                              className="link-button stack-reveal"
                              type="button"
                              onClick={() => toggleReveal(revealId)}
                            >
                              {isRevealed ? t('common.hide') : t('stack.reveal')}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {report.exposure.sensitiveNames.length > 0 && (
                  <div className="stack-exp-block">
                    <p className="stack-exp-label">
                      {t('stack.exposureSensitiveNames', {
                        count: report.exposure.sensitiveNames.length,
                      })}
                    </p>
                    <div className="stack-exp-chips">
                      {report.exposure.sensitiveNames.map((item) => (
                        <span
                          className="stack-exp-chip"
                          key={item.name}
                          title={item.source}
                        >
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {report.exposure.secrets.length > 0 && (
                  <div className="stack-exp-block">
                    <p className="stack-exp-label">
                      {t('stack.exposureSecrets', {
                        count: report.exposure.secrets.length,
                      })}
                    </p>
                    <ul className="stack-exp-secrets">
                      {report.exposure.secrets.map((item) => {
                        const revealId = `secret:${item.kind}:${item.source}:${item.preview}`
                        const isRevealed = revealed.has(revealId)
                        return (
                          <li key={revealId}>
                            <span className={`stack-sev ${item.severity}`}>
                              {t(
                                `stack.exposureSeverity.${item.severity}` as MessageKey,
                              )}
                            </span>
                            <span>{item.label}</span>
                            <code className="break">
                              {isRevealed ? item.value : item.preview}
                            </code>
                            <button
                              className="link-button stack-reveal"
                              type="button"
                              onClick={() => toggleReveal(revealId)}
                            >
                              {isRevealed ? t('common.hide') : t('stack.reveal')}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {report.exposure.sourceMaps.length > 0 && (
                  <div className="stack-exp-block">
                    <p className="stack-exp-label">
                      {t('stack.exposureMaps', {
                        count: report.exposure.sourceMaps.length,
                      })}
                    </p>
                    <div className="stack-exp-warning">
                      <strong>{t('stack.sourceMapWarningTitle')}</strong>
                      <p>{t('stack.sourceMapWarningBody')}</p>
                    </div>
                    <ul className="stack-exp-maps">
                      {report.exposure.sourceMaps.map((item) => (
                        <li key={item.url}>
                          <span
                            className={`stack-sev ${
                              item.status === 'exposed' ? 'high' : 'public'
                            }`}
                          >
                            {t(
                              item.status !== 'exposed'
                                ? 'stack.sourceMapUnverified'
                                : item.hasSourcesContent
                                  ? 'stack.sourceMapSources'
                                  : 'stack.sourceMapExposed',
                            )}
                          </span>
                          <span className="mono break">{item.url}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            <p className="muted small">{t('stack.exposureNote')}</p>
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

      <details className="stack-guide">
        <summary>{t('stack.guideTitle')}</summary>
        <p className="muted small">{t('stack.guideIntro')}</p>

        <div className="stack-guide-grid">
          <section>
            <h4>{t('stack.guideStep1Title')}</h4>
            <p>{t('stack.guideStep1Body')}</p>
            <pre>
              <code>{`window.next?.version
pnpm up next@latest react@latest react-dom@latest
pnpm build`}</code>
            </pre>
          </section>

          <section>
            <h4>{t('stack.guideStep2Title')}</h4>
            <p>{t('stack.guideStep2Body')}</p>
          </section>

          <section>
            <h4>{t('stack.guideStep3Title')}</h4>
            <p>{t('stack.guideStep3Body')}</p>
          </section>

          <section>
            <h4>{t('stack.guideStep4Title')}</h4>
            <p>{t('stack.guideStep4Body')}</p>
          </section>

          <section>
            <h4>{t('stack.guideStep5Title')}</h4>
            <p>{t('stack.guideStep5Body')}</p>
          </section>
        </div>

        <h4 className="stack-guide-check-title">{t('stack.guideChecklistTitle')}</h4>
        <ul className="stack-guide-checklist">
          <li>{t('stack.guideCheck1')}</li>
          <li>{t('stack.guideCheck2')}</li>
          <li>{t('stack.guideCheck3')}</li>
          <li>{t('stack.guideCheck4')}</li>
          <li>{t('stack.guideCheck5')}</li>
          <li>{t('stack.guideCheck6')}</li>
        </ul>
      </details>
    </section>
  )
}
