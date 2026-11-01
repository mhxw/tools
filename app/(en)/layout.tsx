import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@/index.css'
import '@/App.css'
import { RootLayout } from '@/components/RootLayout'
import { SITE_URL } from '@/seo'

const description =
  'Check EIP-7702 delegation across Ethereum, BSC, Base, Arbitrum, Optimism, Polygon and Monad, inspect type-4 transactions, and revoke safely.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'Tools',
  title: {
    default: 'EIP-7702 Delegation Checker & Revoke Tools',
    template: '%s · Tools',
  },
  description,
  openGraph: {
    type: 'website',
    siteName: 'Tools',
    locale: 'en_US',
    title: 'EIP-7702 Delegation Checker & Revoke Tools',
    description,
  },
  twitter: {
    card: 'summary',
    title: 'EIP-7702 Delegation Checker & Revoke Tools',
    description,
  },
}

export default function EnLayout({ children }: { children: ReactNode }) {
  return <RootLayout lang="en">{children}</RootLayout>
}
