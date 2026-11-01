'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n'

type Props = {
  value: string
  label?: string
}

export function CopyButton({ value, label }: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard permissions can be denied; keep the full value visible.
    }
  }

  return (
    <button
      className="btn btn-ghost btn-sm copy-btn"
      type="button"
      onClick={copy}
    >
      {copied ? t('common.copied') : (label ?? t('common.copy'))}
    </button>
  )
}
