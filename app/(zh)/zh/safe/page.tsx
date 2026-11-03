import type { Metadata } from 'next'
import { SafeCheckerPage } from '@/components/pages/SafeCheckerPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('zh', 'safe')

export default function SafePage() {
  return <SafeCheckerPage />
}
