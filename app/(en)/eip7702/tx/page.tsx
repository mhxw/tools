import type { Metadata } from 'next'
import { TxInspectorPage } from '@/components/pages/TxInspectorPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('en', 'tx')

export default function Eip7702TxPage() {
  return <TxInspectorPage />
}
