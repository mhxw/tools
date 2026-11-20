import type { Metadata } from 'next'
import { DiffCheckerPage } from '@/components/pages/DiffCheckerPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('en', 'diff')

export default function DiffPage() {
  return <DiffCheckerPage />
}
