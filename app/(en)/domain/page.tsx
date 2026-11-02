import type { Metadata } from 'next'
import { DomainCheckerPage } from '@/components/pages/DomainCheckerPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('en', 'domain')

export default function DomainPage() {
  return <DomainCheckerPage />
}
