import type { Metadata } from 'next'
import type { Language } from './i18n'

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mhxw.github.io/tools'
).replace(/\/+$/, '')

export type SeoPage = 'home' | 'address' | 'tx' | 'domain' | 'safe' | 'guide'

const PATHS: Record<SeoPage, string> = {
  home: '/',
  address: '/eip7702',
  tx: '/eip7702/tx',
  domain: '/domain',
  safe: '/safe',
  guide: '/eip7702/metamask',
}

type Copy = {
  title: string
  description: string
}

const COPY: Record<Language, Record<SeoPage, Copy>> = {
  en: {
    home: {
      title: 'EIP-7702 Delegation Checker & Revoke Tools',
      description:
        'Check EIP-7702 delegation across Ethereum, BSC, Base, Arbitrum, Optimism, Polygon and Monad, inspect type-4 transactions, and revoke safely.',
    },
    address: {
      title: 'EIP-7702 Delegation Checker',
      description:
        'Enter one address to scan EIP-7702 delegation across seven networks, inspect the delegate contract, and revoke it per network.',
    },
    tx: {
      title: 'EIP-7702 Transaction Inspector',
      description:
        'Inspect EIP-7702 type-4 transactions: authorization lists, signers, delegate addresses and nonces.',
    },
    domain: {
      title: 'Domain Security Check (DNS, DNSSEC, SPF, DMARC)',
      description:
        'Check a domain for DNS records, DNSSEC, CAA, SPF, DMARC, DKIM, homograph tricks and RDAP registration data.',
    },
    safe: {
      title: 'Safe Multisig Owner & Threshold Inspector',
      description:
        'Inspect a Safe multisig: owners, n/m threshold, nonce and version. For 1-signature Safes, add or remove owners directly.',
    },
    guide: {
      title: 'Cancel EIP-7702 Authorization in MetaMask',
      description:
        'Step-by-step guide to disable EIP-7702 delegation inside MetaMask smart accounts, per network, with gas and verification notes.',
    },
  },
  zh: {
    home: {
      title: 'EIP-7702 多链授权检测与撤销工具',
      description:
        '一键扫描 Ethereum、BSC、Base、Arbitrum、Optimism、Polygon、Monad 的 EIP-7702 委托，解析 type-4 交易，并提供私钥与 MetaMask 撤销方式。',
    },
    address: {
      title: 'EIP-7702 授权检测',
      description:
        '输入一个地址，并行扫描七个网络的 EIP-7702 委托，查看委托合约，并按网络撤销。',
    },
    tx: {
      title: 'EIP-7702 交易解析',
      description:
        '解析 EIP-7702 type-4 交易，展示授权列表、签名账户、委托地址与 nonce。',
    },
    domain: {
      title: '域名安全检查（DNS / DNSSEC / SPF / DMARC）',
      description:
        '检查域名的 DNS、DNSSEC、CAA、SPF、DMARC、DKIM、同形异义风险与 RDAP 注册信息。',
    },
    safe: {
      title: 'Safe 多签 Owner 与阈值查询',
      description:
        '查询 Safe 的 owner 列表、n/m 签名阈值、nonce 和版本；1 个签名即可执行时，可直接添加或移除 owner。',
    },
    guide: {
      title: '在 MetaMask 中取消 EIP-7702 授权',
      description:
        '在 MetaMask 智能账户中按网络关闭 EIP-7702 委托，包含 gas、验证与注意事项。',
    },
  },
}

function withSlash(path: string) {
  return path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`
}

function urlFor(lang: Language, page: SeoPage) {
  const path = withSlash(PATHS[page])
  if (lang === 'zh') {
    return `${SITE_URL}${path === '/' ? '/zh/' : `/zh${path}`}`
  }
  return `${SITE_URL}${path}`
}

export function pageMetadata(lang: Language, page: SeoPage): Metadata {
  const copy = COPY[lang][page]
  const canonical = urlFor(lang, page)
  const en = urlFor('en', page)
  const zh = urlFor('zh', page)

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical,
      languages: {
        en,
        'zh-CN': zh,
        'x-default': en,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Tools',
      locale: lang === 'zh' ? 'zh_CN' : 'en_US',
      url: canonical,
      title: copy.title,
      description: copy.description,
    },
    twitter: {
      card: 'summary',
      title: copy.title,
      description: copy.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}
