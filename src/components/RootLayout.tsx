import type { ReactNode } from 'react'
import type { Language } from '@/i18n'
import { Providers } from './Providers'
import { Shell } from './Shell'

export function RootLayout({
  lang,
  children,
}: {
  lang: Language
  children: ReactNode
}) {
  return (
    <html lang={lang === 'zh' ? 'zh-CN' : 'en'}>
      <body>
        <Providers lang={lang}>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  )
}
