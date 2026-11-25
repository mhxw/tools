import type { Metadata } from 'next'
import { CcipRetryPage } from '@/components/pages/CcipRetryPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('zh', 'ccip')

export default function Page() {
  return <CcipRetryPage />
}
