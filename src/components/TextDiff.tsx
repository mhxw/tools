'use client'

import {
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from 'react'
import { useI18n } from '../i18n'
import {
  MAX_LINES_PER_SIDE,
  compareText,
  countVisualLines,
  editorLines,
  type DiffEditorLine,
} from '../lib/text-diff'

const SAMPLE_LEFT = [
  'function greet(name) {',
  '  const message = "Hello, " + name',
  '  console.log(message)',
  '  return message',
  '}',
  '',
  'greet("world")',
].join('\n')

const SAMPLE_RIGHT = [
  'function greet(name, punctuation = "!") {',
  '  const message = `Hello, ${name}${punctuation}`',
  '  console.log(message)',
  '  return message',
  '}',
  '',
  'greet("world")',
  'greet("tools")',
].join('\n')

type DiffEditorProps = {
  side: 'left' | 'right'
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  lineCount: number
  lines: DiffEditorLine[] | null
  wrap: boolean
}

/** Keep in sync with --diff-line-height in App.css. */
const LINE_HEIGHT = 22
const OVERSCAN = 16
const INITIAL_WINDOW = 80

type LineRange = { start: number; end: number }

function visibleRange(scrollTop: number, height: number, total: number): LineRange {
  const count = Math.ceil(height / LINE_HEIGHT) + OVERSCAN * 2
  const first = Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN
  const start = Math.max(0, Math.min(first, Math.max(0, total - count)))
  return { start, end: Math.min(total, start + count) }
}

function sameRange(a: LineRange, b: LineRange) {
  return a.start === b.start && a.end === b.end
}

function DiffEditor({
  side,
  label,
  value,
  onChange,
  placeholder,
  lineCount,
  lines,
  wrap,
}: DiffEditorProps) {
  const { t } = useI18n()
  const bodyRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState<LineRange>({
    start: 0,
    end: INITIAL_WINDOW,
  })

  const total = lines?.length ?? 0
  const start = wrap ? 0 : Math.min(range.start, Math.max(0, total - 1))
  const end = wrap ? total : Math.min(Math.max(range.end, start), total)
  const visible = lines ? lines.slice(start, end) : []
  const slicePadding = `calc(var(--diff-pad-y) + ${start * LINE_HEIGHT}px)`

  function scrollLayers(el: HTMLTextAreaElement) {
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(${-el.scrollTop}px)`
    }
    if (highlightRef.current) {
      highlightRef.current.style.transform = `translateY(${-el.scrollTop}px)`
    }
    if (codeRef.current) {
      codeRef.current.style.transform = wrap
        ? `translateY(${-el.scrollTop}px)`
        : `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`
    }
  }

  function updateRange(el: HTMLTextAreaElement) {
    const next = visibleRange(el.scrollTop, el.clientHeight, total)
    setRange((prev) => (sameRange(prev, next) ? prev : next))
  }

  useLayoutEffect(() => {
    const el = textareaRef.current
    const body = bodyRef.current
    if (!el || !body) return

    const sync = () => {
      // Reserve the native scrollbar width so wrapped lines break at the same
      // point in the textarea and in the highlighted layer underneath it.
      body.style.setProperty('--diff-sbw', `${el.offsetWidth - el.clientWidth}px`)
      body.style.setProperty('--diff-hsbw', `${el.offsetHeight - el.clientHeight}px`)
      updateRange(el)
      scrollLayers(el)
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
    // scrollLayers only reads refs; re-sync when the content or wrap mode moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, wrap, lines?.length])

  function handleScroll(event: UIEvent<HTMLTextAreaElement>) {
    scrollLayers(event.currentTarget)
    updateRange(event.currentTarget)
  }

  return (
    <section className="diff-editor">
      <div className="diff-editor-head">
        <span>{label}</span>
        <span className="diff-line-count">
          {t('diff.lines', { count: lineCount })}
        </span>
      </div>
      <div
        className={`diff-editor-body diff-side-${side}${
          wrap ? ' is-wrapped' : ''
        }${lines ? '' : ' is-plain'}`}
        ref={bodyRef}
      >
        {lines && !wrap && (
          <div className="diff-gutter" aria-hidden="true">
            <div
              className="diff-gutter-inner"
              ref={gutterRef}
              style={{ paddingTop: slicePadding }}
            >
              {visible.map((line, offset) => (
                <div
                  className={`diff-gutter-line diff-kind-${line.kind}`}
                  key={start + offset}
                >
                  {start + offset + 1}
                </div>
              ))}
            </div>
          </div>
        )}

        {lines && (
          <div
            className={`diff-code-layer${wrap ? ' is-wrapped' : ''}`}
            aria-hidden="true"
          >
            {!wrap && (
              <div className="diff-highlight-layer">
                <div
                  className="diff-highlight-inner"
                  ref={highlightRef}
                  style={{ paddingTop: slicePadding }}
                >
                  {visible.map((line, offset) => (
                    <div
                      className={`diff-highlight-line diff-kind-${line.kind}`}
                      key={start + offset}
                    />
                  ))}
                </div>
              </div>
            )}
            <div
              className="diff-code-inner"
              ref={codeRef}
              style={{ paddingTop: slicePadding }}
            >
              {visible.map((line, offset) => {
                const index = start + offset
                return (
                  <div
                    className={`diff-code-line diff-kind-${line.kind}`}
                    key={index}
                  >
                    {wrap && <span className="diff-inline-no">{index + 1}</span>}
                    <span className="diff-line-text">
                      {line.parts.map((part, partIndex) =>
                        part.changed ? (
                          <mark key={partIndex}>{part.text}</mark>
                        ) : (
                          <span key={partIndex}>{part.text}</span>
                        ),
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="diff-textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleScroll}
          placeholder={placeholder}
          aria-label={label}
          spellCheck={false}
          wrap={wrap ? 'soft' : 'off'}
        />
      </div>
    </section>
  )
}

export function TextDiff() {
  const { t } = useI18n()
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [wrap, setWrap] = useState(false)

  const deferredLeft = useDeferredValue(left)
  const deferredRight = useDeferredValue(right)
  const pending = left !== deferredLeft || right !== deferredRight

  const result = useMemo(
    () =>
      compareText(deferredLeft, deferredRight, {
        ignoreWhitespace,
        ignoreCase,
      }),
    [deferredLeft, deferredRight, ignoreWhitespace, ignoreCase],
  )

  const leftLineCount = useMemo(() => countVisualLines(left), [left])
  const rightLineCount = useMemo(() => countVisualLines(right), [right])

  const leftLines = useMemo(
    () =>
      leftLineCount > MAX_LINES_PER_SIDE
        ? null
        : editorLines(
            pending || result.limited ? [] : result.rows,
            'left',
            left,
          ),
    [left, leftLineCount, pending, result],
  )

  const rightLines = useMemo(
    () =>
      rightLineCount > MAX_LINES_PER_SIDE
        ? null
        : editorLines(
            pending || result.limited ? [] : result.rows,
            'right',
            right,
          ),
    [right, rightLineCount, pending, result],
  )

  const bothEmpty = left.length === 0 && right.length === 0
  const hasDifferences =
    result.stats.added + result.stats.removed + result.stats.changed > 0

  function swapSides() {
    setLeft(right)
    setRight(left)
  }

  function clearAll() {
    setLeft('')
    setRight('')
  }

  function loadSample() {
    setLeft(SAMPLE_LEFT)
    setRight(SAMPLE_RIGHT)
  }

  return (
    <section className="panel diff-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{t('diff.eyebrow')}</p>
          <h2>{t('diff.title')}</h2>
        </div>
        <span className="network-chip">LOCAL</span>
      </div>

      <p className="diff-copy">{t('diff.copy')}</p>

      <div className="diff-editors">
        <DiffEditor
          side="left"
          label={t('diff.leftLabel')}
          value={left}
          onChange={setLeft}
          placeholder={t('diff.leftPlaceholder')}
          lineCount={leftLineCount}
          lines={leftLines}
          wrap={wrap}
        />
        <DiffEditor
          side="right"
          label={t('diff.rightLabel')}
          value={right}
          onChange={setRight}
          placeholder={t('diff.rightPlaceholder')}
          lineCount={rightLineCount}
          lines={rightLines}
          wrap={wrap}
        />
      </div>

      <div className="diff-toolbar">
        <div className="diff-toggles">
          <label className="diff-toggle">
            <input
              type="checkbox"
              checked={ignoreWhitespace}
              onChange={(event) => setIgnoreWhitespace(event.target.checked)}
            />
            <span>{t('diff.ignoreWhitespace')}</span>
          </label>
          <label className="diff-toggle">
            <input
              type="checkbox"
              checked={ignoreCase}
              onChange={(event) => setIgnoreCase(event.target.checked)}
            />
            <span>{t('diff.ignoreCase')}</span>
          </label>
          <label className="diff-toggle">
            <input
              type="checkbox"
              checked={wrap}
              onChange={(event) => setWrap(event.target.checked)}
            />
            <span>{t('diff.wrap')}</span>
          </label>
        </div>

        <div className="diff-actions">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={loadSample}
          >
            {t('diff.sample')}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={swapSides}
            disabled={bothEmpty}
          >
            {t('diff.swap')}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={clearAll}
            disabled={bothEmpty}
          >
            {t('diff.clear')}
          </button>
        </div>
      </div>

      <p className="diff-privacy">{t('diff.privacy')}</p>

      {bothEmpty ? (
        <div className="status-box status-neutral diff-empty">
          <div>
            <strong>{t('diff.empty')}</strong>
          </div>
        </div>
      ) : (
        <div className="diff-summary">
          {result.limited && (
            <div className="notice notice-warning">
              {t('diff.limited', { max: MAX_LINES_PER_SIDE })}
            </div>
          )}

          {!result.limited && (
            <div className="diff-summary-head">
              <div className="diff-stats" aria-live="polite">
                <span className="diff-stat diff-stat-added">
                  <b>{result.stats.added}</b> {t('diff.added')}
                </span>
                <span className="diff-stat diff-stat-removed">
                  <b>{result.stats.removed}</b> {t('diff.removed')}
                </span>
                <span className="diff-stat diff-stat-changed">
                  <b>{result.stats.changed}</b> {t('diff.changed')}
                </span>
                <span className="diff-stat diff-stat-unchanged">
                  <b>{result.stats.unchanged}</b> {t('diff.unchanged')}
                </span>
              </div>

              {hasDifferences && (
                <div className="diff-legend">
                  <span className="diff-legend-item diff-legend-added">
                    {t('diff.legendAdded')}
                  </span>
                  <span className="diff-legend-item diff-legend-removed">
                    {t('diff.legendRemoved')}
                  </span>
                  <span className="diff-legend-item diff-legend-changed">
                    {t('diff.legendChanged')}
                  </span>
                </div>
              )}
            </div>
          )}

          {result.coarse && (
            <div className="notice notice-warning">{t('diff.coarse')}</div>
          )}

          {result.stats.identical && !result.limited && (
            <div className="notice notice-success">
              {result.stats.rawIdentical
                ? t('diff.identicalRaw')
                : t('diff.identicalIgnored')}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
