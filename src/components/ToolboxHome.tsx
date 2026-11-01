'use client'

import Link from 'next/link'
import { chainName } from '@/chain-meta'
import { useI18n } from '@/i18n'
import { RichText } from './RichText'
import { TOOLS, TOOL_PATHS, localePath } from '@/tools'
import { useToolbox } from '@/toolbox'

export function ToolboxHome() {
  const { lang, t } = useI18n()
  const { chainId } = useToolbox()

  return (
    <>
      <section className="hero home-hero">
        <p className="eyebrow">{t('home.eyebrow')}</p>
        <h1>
          {t('home.title1')}
          <span className="gradient-text"> {t('home.titleAccent')}</span>
          <br />
          {t('home.title2')}
        </h1>
        <p className="hero-copy">
          <RichText text={t('home.copy', { chain: chainName(chainId) })} />
        </p>

        <div className="hero-meta">
          <span>{t('home.meta1')}</span>
          <span>{t('home.meta2')}</span>
          <span>{t('home.meta3')}</span>
        </div>
      </section>

      <section className="toolbox">
        <div className="section-head">
          <div>
            <h2>{t('home.toolsTitle')}</h2>
            <p>{t('home.toolsCopy')}</p>
          </div>
        </div>

        <div className="tool-grid">
          {TOOLS.map((tool) =>
            tool.status === 'ready' ? (
              <Link
                className="tool-card"
                key={tool.id}
                href={localePath(lang, TOOL_PATHS[tool.id])}
              >
                <span className="tool-card-top">
                  <span className="tool-icon">{tool.icon}</span>
                  <span className="tool-tag">{t(tool.tag)}</span>
                </span>
                <span className="tool-title">{t(tool.title)}</span>
                <span className="tool-desc">{t(tool.description)}</span>
                <span className="tool-open">{t('home.open')} →</span>
              </Link>
            ) : (
              <div
                className="tool-card tool-card-coming"
                key={tool.id}
                aria-disabled="true"
              >
                <span className="tool-card-top">
                  <span className="tool-icon">{tool.icon}</span>
                  <span className="tool-tag">{t(tool.tag)}</span>
                </span>
                <span className="tool-title">{t(tool.title)}</span>
                <span className="tool-desc">{t(tool.description)}</span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="explainer">
        <h2>{t('app.explainerTitle')}</h2>
        <div className="explainer-grid">
          <article>
            <h3>{t('app.explainer1Title')}</h3>
            <p>
              <RichText text={t('app.explainer1Body')} />
            </p>
          </article>
          <article>
            <h3>{t('app.explainer2Title')}</h3>
            <p>
              <RichText text={t('app.explainer2Body')} />
            </p>
          </article>
          <article>
            <h3>{t('app.explainer3Title')}</h3>
            <p>
              <RichText text={t('app.explainer3Body')} />
            </p>
          </article>
        </div>
      </section>
    </>
  )
}
