import type { Metadata } from 'next'
import { AddressCheckerPage } from '@/components/pages/AddressCheckerPage'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('en', 'address')

export default function Eip7702Page() {
  return <AddressCheckerPage />
}
