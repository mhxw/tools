import type { Metadata } from 'next'
import { ToolboxHome } from '@/components/ToolboxHome'
import { pageMetadata } from '@/seo'

export const metadata: Metadata = pageMetadata('en', 'home')

export default function HomePage() {
  return <ToolboxHome />
}
