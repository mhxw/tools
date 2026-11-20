import type { Metadata } from 'next'
import { SwapPage } from '@/components/pages/SwapPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('zh', 'swap')

export default function Page() {
  return <SwapPage />
}
