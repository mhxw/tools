import type { Metadata } from 'next'
import { ApprovalsPage } from '@/components/pages/ApprovalsPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('zh', 'approvals')

export default function Page() {
  return <ApprovalsPage />
}
