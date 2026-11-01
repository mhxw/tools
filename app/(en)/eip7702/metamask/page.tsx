import type { Metadata } from 'next'
import { MetaMaskGuidePage } from '@/components/pages/MetaMaskGuidePage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('en', 'guide')

export default function Eip7702MetaMaskPage() {
  return <MetaMaskGuidePage />
}
