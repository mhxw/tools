import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@/index.css'
import '@/App.css'
import { RootLayout } from '@/components/RootLayout'
import { SITE_URL } from '@/seo'

const description =
  '一键扫描 Ethereum、BSC、Base、Arbitrum、Optimism、Polygon、Monad 的 EIP-7702 委托，解析 type-4 交易，并提供私钥与 MetaMask 撤销方式。'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'Tools',
  title: {
    default: 'EIP-7702 多链授权检测与撤销工具',
    template: '%s · Tools',
  },
  description,
  openGraph: {
    type: 'website',
    siteName: 'Tools',
    locale: 'zh_CN',
    title: 'EIP-7702 多链授权检测与撤销工具',
    description,
  },
  twitter: {
    card: 'summary',
    title: 'EIP-7702 多链授权检测与撤销工具',
    description,
  },
}

export default function ZhLayout({ children }: { children: ReactNode }) {
  return <RootLayout lang="zh">{children}</RootLayout>
}
