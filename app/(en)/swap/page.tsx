import type { Metadata } from 'next'
import { SwapPage } from '@/components/pages/SwapPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('en', 'swap')

export default function Page() {
  return <SwapPage />
}
