'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n, type MessageKey } from '@/i18n'
import {
  checkDomain,
  type CaaRecord,
  type DomainReport,
  type MxRecord,
} from '@/lib/domain-check'

type RiskLevel = 'high' | 'medium' | 'info'

type Risk = {
  level: RiskLevel
  text: string
}

type Props = {
  initialDomain?: string
  onInputDomain: (value: string) => void
  onQueryDomain: (domain: string) => void
}

function buildRisks(
  report: DomainReport,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): Risk[] {
  const risks: Risk[] = []

  if (report.nxdomain) {
    risks.push({ level: 'high', text: t('domain.riskNxdomain') })
  }
  if (report.isPunycode) {
    risks.push({ level: 'medium', text: t('domain.riskPunycode') })
  }
  if (report.hasMixedScript) {
    risks.push({ level: 'high', text: t('domain.riskMixedScript') })
  }
  if (report.hasHiddenChars) {
    risks.push({ level: 'high', text: t('domain.riskHidden') })
  }

  if (!report.spf) {
    risks.push({ level: 'medium', text: t('domain.riskSpfMissing') })
  } else if (report.spfAll === '+all' || report.spfAll === '?all') {
    risks.push({ level: 'high', text: t('domain.riskSpfPermissive') })
  }

  if (!report.dmarc) {
    risks.push({ level: 'medium', text: t('domain.riskDmarcMissing') })
  } else if (report.dmarcPolicy === 'none') {
    risks.push({ level: 'medium', text: t('domain.riskDmarcNone') })
  }

  if (report.caa.length === 0) {
    risks.push({ level: 'info', text: t('domain.riskCaaMissing') })
  }
  if (report.dnssec === 'invalid') {
    risks.push({ level: 'medium', text: t('domain.riskDnssecInvalid') })
  } else if (report.dnssec !== 'valid') {
    risks.push({ level: 'info', text: t('domain.riskDnssecMissing') })
  }
  if (report.dsWeak) {
    risks.push({ level: 'info', text: t('domain.riskDsWeak') })
  }
  if (report.ns.length < 2) {
    risks.push({
      level: 'medium',
      text: t('domain.riskNsCount', { count: report.ns.length }),
    })
  }
  if (report.spfRecords.length > 1) {
    risks.push({ level: 'high', text: t('domain.riskSpfMultiple') })
  }
  if (report.spfLookups > 10) {
    risks.push({
      level: 'medium',
      text: t('domain.riskSpfLookup', { count: report.spfLookups }),
    })
  }
  if (report.dmarcPct !== undefined && report.dmarcPct < 100) {
    risks.push({
      level: 'medium',
      text: t('domain.riskDmarcPct', { pct: report.dmarcPct }),
    })
  }
  if (report.dmarc && !report.dmarcRua) {
    risks.push({ level: 'info', text: t('domain.riskDmarcRua') })
  }
  if (report.rdap?.ageDays !== undefined && report.rdap.ageDays < 90) {
    risks.push({
      level: 'high',
      text: t('domain.riskNewDomain', { days: report.rdap.ageDays }),
    })
  }
  if (report.rdap?.expiresDays !== undefined) {
    if (report.rdap.expiresDays < 30) {
      risks.push({
        level: 'high',
        text: t('domain.riskExpiringSoon', {
          days: report.rdap.expiresDays,
        }),
      })
    } else if (report.rdap.expiresDays < 60) {
      risks.push({
        level: 'medium',
        text: t('domain.riskExpiring', {
          days: report.rdap.expiresDays,
        }),
      })
    }
  }
  if (report.mx.length === 0 && !report.nullMx) {
    risks.push({ level: 'info', text: t('domain.riskNoMx') })
  }
  if (report.nullMx) {
    risks.push({ level: 'info', text: t('domain.riskNullMx') })
  }
  if (report.dkim.length === 0) {
    risks.push({ level: 'info', text: t('domain.riskDkimNone') })
  }

  const statuses = (report.rdap?.statuses ?? []).map((status) =>
    status.toLowerCase().replace(/[\s_-]+/g, ''),
  )
  if (
    statuses.includes('clienthold') ||
    statuses.includes('serverhold')
  ) {
    risks.push({ level: 'high', text: t('domain.riskDomainHold') })
  }
  if (
    statuses.includes('pendingdelete') ||
    statuses.includes('redemptionperiod')
  ) {
    risks.push({ level: 'high', text: t('domain.riskPendingDelete') })
  }
  if (statuses.length > 0) {
    if (!statuses.includes('clienttransferprohibited')) {
      risks.push({ level: 'medium', text: t('domain.riskTransferLock') })
    }
    if (!statuses.includes('clientupdateprohibited')) {
      risks.push({ level: 'info', text: t('domain.riskUpdateLock') })
    }
    if (!statuses.includes('clientdeleteprohibited')) {
      risks.push({ level: 'info', text: t('domain.riskDeleteLock') })
    }
  }

  return risks
}

const LEVEL_KEY: Record<RiskLevel, MessageKey> = {
  high: 'domain.riskHigh',
  medium: 'domain.riskMedium',
  info: 'domain.riskInfo',
}

const DNSSEC_KEY: Record<DomainReport['dnssec'], MessageKey> = {
  valid: 'domain.dnssecValid',
  invalid: 'domain.dnssecInvalid',
  unsigned: 'domain.dnssecUnsigned',
  unknown: 'domain.dnssecUnknown',
}

const SPF_ALL_KEY: Record<string, MessageKey> = {
  '-all': 'domain.spfAllStrict',
  '~all': 'domain.spfAllSoft',
  '?all': 'domain.spfAllNeutral',
  '+all': 'domain.spfAllPermissive',
}

const DMARC_KEY: Record<string, MessageKey> = {
  reject: 'domain.dmarcReject',
  quarantine: 'domain.dmarcQuarantine',
  none: 'domain.dmarcNone',
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'ok' | 'warn' | 'danger' | 'neutral'
}) {
  return (
    <div className={`domain-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RecordValues({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) return <span className="muted">{empty}</span>
  return (
    <div className="record-list">
      {values.map((value) => (
        <code key={value}>{value}</code>
      ))}
    </div>
  )
}

function MxValues({
  values,
  empty,
}: {
  values: MxRecord[]
  empty: string
}) {
  if (values.length === 0) return <span className="muted">{empty}</span>
  return (
    <div className="record-list">
      {values.map((value) => (
        <code key={`${value.priority}-${value.host}`}>
          {value.priority} {value.host}
        </code>
      ))}
    </div>
  )
}

function CaaValues({
  values,
  empty,
}: {
  values: CaaRecord[]
  empty: string
}) {
  if (values.length === 0) return <span className="muted">{empty}</span>
  return (
    <div className="record-list">
      {values.map((value) => (
        <code key={`${value.flags}-${value.tag}-${value.value}`}>
          {value.flags} {value.tag} &quot;{value.value}&quot;
        </code>
      ))}
    </div>
  )
}

function formatDate(value?: string) {
  if (!value) return undefined
  const time = Date.parse(value)
  return Number.isFinite(time)
    ? new Date(time).toISOString().slice(0, 10)
    : value
}

export function DomainChecker({
  initialDomain,
  onInputDomain,
  onQueryDomain,
}: Props) {
  const { t } = useI18n()
  const [input, setInput] = useState(initialDomain ?? '')
  const [dkimSelector, setDkimSelector] = useState('')
  const [report, setReport] = useState<DomainReport>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const autoRan = useRef(false)

  const runCheck = useCallback(
    async (value: string, selector?: string) => {
      setLoading(true)
      setError(undefined)
      setReport(undefined)

      try {
        const result = await checkDomain(value, selector)
        setReport(result)
        setInput(result.domain)
        onQueryDomain(result.domain)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(
          message === 'invalid-domain'
            ? t('domain.invalid')
            : t('domain.error', { message }),
        )
      } finally {
        setLoading(false)
      }
    },
    [onQueryDomain, t],
  )

  useEffect(() => {
    if (!initialDomain || autoRan.current) return
    autoRan.current = true
    // oxlint-disable-next-line react/set-state-in-effect -- run the shared-link check after hydration
    void runCheck(initialDomain)
  }, [initialDomain, runCheck])

  function handleCheck() {
    void runCheck(input, dkimSelector)
  }

  const risks = report ? buildRisks(report, t) : []
  const dnsValue = report
    ? report.nxdomain
      ? t('domain.nxdomainTitle')
      : report.a.length || report.aaaa.length || report.cname.length
        ? t('domain.ok')
        : t('domain.missing')
    : ''

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{t('domain.eyebrow')}</p>
          <h2>{t('domain.title')}</h2>
        </div>
        <span className="network-chip">DNS</span>
      </div>

      <div className="search-row domain-search-row">
        <input
          className="text-input"
          value={input}
          onChange={(event) => {
            const value = event.target.value
            setInput(value)
            onInputDomain(value)
            setError(undefined)
            if (report && value.trim().toLowerCase() !== report.domain) {
              setReport(undefined)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleCheck()
          }}
          placeholder={t('domain.placeholder')}
          spellCheck={false}
          autoComplete="off"
        />
        <input
          className="text-input domain-dkim-input"
          value={dkimSelector}
          onChange={(event) => setDkimSelector(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleCheck()
          }}
          placeholder={t('domain.dkimPlaceholder')}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleCheck}
          disabled={loading}
        >
          {loading ? t('domain.checkingShort') : t('domain.check')}
        </button>
      </div>

      <p className="muted small domain-hint">{t('domain.inputHint')}</p>
      <p className="muted small">{t('domain.privacy')}</p>

      {error && <p className="notice notice-error">{error}</p>}

      {loading && (
        <div className="status-box status-loading domain-loading">
          <span className="spinner" /> {t('domain.checking')}
        </div>
      )}

      {report && !loading && (
        <div className="domain-report">
          <div className="result-head">
            <div>
              <p className="eyebrow">{t('domain.resultFor')}</p>
              <p className="mono address-line">{report.domain}</p>
            </div>
            <span className="network-chip">
              {report.nxdomain
                ? t('domain.nxdomainTitle')
                : t('domain.ok')}
            </span>
          </div>

          <div className="domain-summary">
            <Stat
              label={t('domain.summaryDns')}
              value={dnsValue}
              tone={
                report.nxdomain
                  ? 'danger'
                  : report.a.length || report.aaaa.length
                    ? 'ok'
                    : 'warn'
              }
            />
            <Stat
              label={t('domain.summaryDnssec')}
              value={t(DNSSEC_KEY[report.dnssec])}
              tone={
                report.dnssec === 'valid'
                  ? 'ok'
                  : report.dnssec === 'invalid'
                    ? 'danger'
                    : 'neutral'
              }
            />
            <Stat
              label={t('domain.summarySpf')}
              value={
                report.spf
                  ? report.spfAll
                    ? t(SPF_ALL_KEY[report.spfAll] ?? 'domain.present')
                    : t('domain.present')
                  : t('domain.spfMissing')
              }
              tone={
                !report.spf
                  ? 'warn'
                  : report.spfAll === '+all' || report.spfAll === '?all'
                    ? 'danger'
                    : 'ok'
              }
            />
            <Stat
              label={t('domain.summaryDmarc')}
              value={
                report.dmarc
                  ? report.dmarcPolicy
                    ? t(DMARC_KEY[report.dmarcPolicy] ?? 'domain.present')
                    : t('domain.present')
                  : t('domain.dmarcMissing')
              }
              tone={
                !report.dmarc || report.dmarcPolicy === 'none'
                  ? 'warn'
                  : 'ok'
              }
            />
            <Stat
              label={t('domain.summaryCaa')}
              value={
                report.caa.length
                  ? String(report.caa.length)
                  : t('domain.caaNone')
              }
              tone={report.caa.length ? 'ok' : 'neutral'}
            />
            <Stat
              label={t('domain.summaryMx')}
              value={
                report.nullMx
                  ? t('domain.nullMx')
                  : report.mx.length
                    ? String(report.mx.length)
                    : t('domain.mxNone')
              }
              tone={report.mx.length && !report.nullMx ? 'ok' : 'neutral'}
            />
          </div>

          {report.nxdomain ? (
            <div className="status-box status-error">
              <div className="status-icon">!</div>
              <div>
                <strong>{t('domain.nxdomainTitle')}</strong>
                <p>{t('domain.nxdomainBody')}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="domain-section">
                <h3>{t('domain.riskTitle')}</h3>
                {risks.length ? (
                  <div className="domain-risk-list">
                    {risks.map((risk, index) => (
                      <div
                        className={`domain-risk ${risk.level}`}
                        key={`${risk.level}-${index}`}
                      >
                        <span className={`domain-risk-level ${risk.level}`}>
                          {t(LEVEL_KEY[risk.level])}
                        </span>
                        <span>{risk.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">{t('domain.riskNone')}</p>
                )}
              </div>

              <div className="domain-section">
                <h3>{t('domain.sectionDns')}</h3>
                <dl className="kv">
                  <div>
                    <dt>{t('domain.recordA')}</dt>
                    <dd>
                      <RecordValues values={report.a} empty={t('domain.none')} />
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.recordAaaa')}</dt>
                    <dd>
                      <RecordValues
                        values={report.aaaa}
                        empty={t('domain.none')}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.recordCname')}</dt>
                    <dd>
                      <RecordValues
                        values={report.cname}
                        empty={t('domain.none')}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.recordNs')}</dt>
                    <dd>
                      <RecordValues values={report.ns} empty={t('domain.none')} />
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="domain-section">
                <h3>{t('domain.sectionEmail')}</h3>
                <dl className="kv">
                  <div>
                    <dt>{t('domain.spf')}</dt>
                    <dd>
                      {report.spf ? (
                        <code className="block-code">{report.spf}</code>
                      ) : (
                        <span className="muted">{t('domain.spfMissing')}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.dmarc')}</dt>
                    <dd>
                      {report.dmarc ? (
                        <code className="block-code">{report.dmarc}</code>
                      ) : (
                        <span className="muted">
                          {t('domain.dmarcMissing')}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.dkim')}</dt>
                    <dd>
                      {report.dkim.length ? (
                        <div className="domain-dkim-list">
                          {report.dkim.map((item) => (
                            <div
                              className="domain-dkim-item"
                              key={item.selector}
                            >
                              <span className="tag">{item.selector}</span>
                              <code className="block-code">{item.record}</code>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">{t('domain.dkimNone')}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.recordMx')}</dt>
                    <dd>
                      {report.nullMx ? (
                        <span className="muted">{t('domain.nullMx')}</span>
                      ) : (
                        <MxValues
                          values={report.mx}
                          empty={t('domain.mxNone')}
                        />
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.mtaSts')}</dt>
                    <dd>
                      {report.mtaSts ? (
                        <code className="block-code">{report.mtaSts}</code>
                      ) : (
                        <span className="muted">{t('domain.missing')}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.tlsRpt')}</dt>
                    <dd>
                      {report.tlsRpt ? (
                        <code className="block-code">{report.tlsRpt}</code>
                      ) : (
                        <span className="muted">{t('domain.missing')}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.bimi')}</dt>
                    <dd>
                      {report.bimi ? (
                        <code className="block-code">{report.bimi}</code>
                      ) : (
                        <span className="muted">{t('domain.missing')}</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="domain-section">
                <h3>{t('domain.sectionDnssec')}</h3>
                <dl className="kv">
                  <div>
                    <dt>{t('domain.summaryDnssec')}</dt>
                    <dd>{t(DNSSEC_KEY[report.dnssec])}</dd>
                  </div>
                  <div>
                    <dt>{t('domain.recordDs')}</dt>
                    <dd>
                      <RecordValues values={report.ds} empty={t('domain.none')} />
                    </dd>
                  </div>
                  <div>
                    <dt>{t('domain.recordCaa')}</dt>
                    <dd>
                      <CaaValues
                        values={report.caa}
                        empty={t('domain.caaNone')}
                      />
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="domain-section">
                <h3>{t('domain.sectionRdap')}</h3>
                {report.rdap ? (
                  <>
                    <dl className="kv">
                    <div>
                      <dt>{t('domain.source')}</dt>
                      <dd>
                        {report.rdap.source === 'whois'
                          ? t('domain.whoisSource')
                          : t('domain.rdapSource')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('domain.registrar')}</dt>
                      <dd>{report.rdap.registrar ?? t('domain.unknown')}</dd>
                    </div>
                    <div>
                      <dt>{t('domain.created')}</dt>
                      <dd>
                        {formatDate(report.rdap.createdAt) ??
                          t('domain.unknown')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('domain.expires')}</dt>
                      <dd>
                        {formatDate(report.rdap.expiresAt) ??
                          t('domain.unknown')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('domain.age')}</dt>
                      <dd>
                        {report.rdap.ageDays !== undefined
                          ? t('domain.ageDays', {
                              days: report.rdap.ageDays,
                            })
                          : t('domain.unknown')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('domain.status')}</dt>
                      <dd className="mono break">
                        {report.rdap.statuses.length
                          ? report.rdap.statuses.join(' · ')
                          : t('domain.unknown')}
                      </dd>
                    </div>
                  </dl>
                  <p className="muted small">{t('domain.registryLockHint')}</p>
                  </>
                ) : (
                  <p className="muted">{t('domain.rdapUnavailable')}</p>
                )}
              </div>

              <div className="domain-section">
                <h3>{t('domain.sectionHomograph')}</h3>
                {report.isPunycode ||
                report.hasMixedScript ||
                report.hasHiddenChars ? (
                  <ul className="notes-list">
                    {report.isPunycode && <li>{t('domain.riskPunycode')}</li>}
                    {report.hasMixedScript && (
                      <li>{t('domain.riskMixedScript')}</li>
                    )}
                    {report.hasHiddenChars && (
                      <li>{t('domain.riskHidden')}</li>
                    )}
                  </ul>
                ) : (
                  <p className="muted">{t('domain.noHomograph')}</p>
                )}
              </div>

              {report.queryErrors.length > 0 && (
                <p className="muted small domain-query-errors">
                  {t('domain.queryErrors', {
                    items: report.queryErrors.join(', '),
                  })}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
