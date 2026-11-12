import type { Metadata } from 'next'
import { StackCheckerPage } from '@/components/pages/StackCheckerPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('zh', 'stack')

export default function StackPage() {
  return <StackCheckerPage />
}
