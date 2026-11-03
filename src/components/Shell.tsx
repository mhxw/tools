'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  MAINNET_CHAIN_META,
  TESTNET_CHAIN_META,
  chainName,
} from '@/chain-meta'
import { useI18n, type MessageKey } from '@/i18n'
import {
  EIP7702_SUB_TOOLS,
  localePath,
  stripLocale,
  toolFromPath,
  topLevelFromPath,
  type TopLevelToolId,
} from '@/tools'
import { useToolbox } from '@/toolbox'

const NAV: Array<{ id: TopLevelToolId; label: MessageKey; path: string }> = [
  { id: 'home', label: 'app.navHome', path: '/' },
  { id: 'eip7702', label: 'app.nav7702', path: '/eip7702' },
  { id: 'safe', label: 'app.navSafe', path: '/safe' },
  { id: 'domain', label: 'app.navDomain', path: '/domain' },
]

export function Shell({ children }: { children: ReactNode }) {
  const { lang, t } = useI18n()
  const { chainId, setChainId } = useToolbox()
  const pathname = usePathname() ?? '/'
  const basePath = stripLocale(pathname)
  const activeTool = toolFromPath(basePath)
  const activeTopLevel = topLevelFromPath(basePath)
  const [query, setQuery] = useState('')

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- preserve query params after hydration
    setQuery(window.location.search)
  }, [pathname])

  const enHref = `${basePath}${query}`
  const zhHref = `${localePath('zh', basePath)}${query}`

  return (
    <div className="app">
      <div className="glow glow-a" />
      <div className="glow glow-b" />

      <header className="topbar">
        <Link
          className="brand brand-button"
          href={localePath(lang, '/')}
          aria-label="Tools"
        >
          <span className="brand-mark">Tools</span>
        </Link>

        <div className="top-actions">
          <div
            className="segmented compact"
            role="group"
            aria-label={t('app.language')}
          >
            <Link
              href={zhHref}
              hrefLang="zh-CN"
              className={lang === 'zh' ? 'active' : ''}
            >
              中文
            </Link>
            <Link
              href={enHref}
              hrefLang="en"
              className={lang === 'en' ? 'active' : ''}
            >
              EN
            </Link>
          </div>

          {activeTopLevel !== 'domain' && (
            <label className="network-select-wrap">
              <select
                className="network-select"
                value={chainId}
                aria-label={t('app.network')}
                onChange={(event) => setChainId(Number(event.target.value))}
              >
                <optgroup label={t('app.mainnets')}>
                  {MAINNET_CHAIN_META.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chainName(chain.id)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('app.testnets')}>
                  {TESTNET_CHAIN_META.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chainName(chain.id)}
                    </option>
                  ))}
                </optgroup>
              </select>
              <span className="network-caret" aria-hidden="true">
                ▾
              </span>
            </label>
          )}
        </div>
      </header>

      <main>
        <nav className="tabs tool-tabs" aria-label={t('app.navHome')}>
          {NAV.map((item) => (
            <Link
              key={item.id}
              href={localePath(lang, item.path)}
              className={activeTopLevel === item.id ? 'active' : ''}
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>

        {activeTopLevel === 'eip7702' && (
          <nav className="tabs subtabs" aria-label={t('app.nav7702')}>
            {EIP7702_SUB_TOOLS.map((item) => (
              <Link
                key={item.id}
                href={localePath(lang, item.path)}
                className={activeTool === item.id ? 'active' : ''}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>
        )}

        {children}

        <footer>
          <p>{t('app.footer1')}</p>
          <p className="footer-meta">
            <a
              href="https://github.com/mhxw/tools"
              target="_blank"
              rel="noreferrer"
            >
              {t('app.footerGithub')}
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/mhxw/tools/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
            >
              {t('app.footerLicense')}
            </a>
          </p>
        </footer>
      </main>
    </div>
  )
}
