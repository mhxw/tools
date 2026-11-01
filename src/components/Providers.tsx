'use client'

import type { ReactNode } from 'react'
import { I18nProvider, type Language } from '@/i18n'
import { ToolboxProvider } from '@/toolbox'

export function Providers({
  lang,
  children,
}: {
  lang: Language
  children: ReactNode
}) {
  return (
    <I18nProvider lang={lang}>
      <ToolboxProvider>{children}</ToolboxProvider>
    </I18nProvider>
  )
}
