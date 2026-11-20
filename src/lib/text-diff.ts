export type DiffOptions = {
  ignoreWhitespace: boolean
  ignoreCase: boolean
}

export type DiffPart = {
  text: string
  changed: boolean
}

export type DiffSide = {
  no: number
  text: string
  parts: DiffPart[]
}

export type DiffRow =
  | {
      kind: 'equal' | 'change'
      left: DiffSide
      right: DiffSide
    }
  | {
      kind: 'add'
      left: null
      right: DiffSide
    }
  | {
      kind: 'remove'
      left: DiffSide
      right: null
    }

export type DiffLineKind = 'equal' | 'added' | 'removed' | 'changed'

export type DiffEditorLine = {
  kind: DiffLineKind
  parts: DiffPart[]
}

export type DiffStats = {
  added: number
  removed: number
  changed: number
  unchanged: number
  leftLines: number
  rightLines: number
  identical: boolean
  rawIdentical: boolean
}

export type DiffResult = {
  rows: DiffRow[]
  stats: DiffStats
  coarse: boolean
  limited: boolean
}

/** Hard limit to keep the comparison responsive in a browser tab. */
export const MAX_LINES_PER_SIDE = 8000

/** Myers stops after this many edit steps and falls back to a coarse diff. */
const MAX_EDIT_DISTANCE = 2500

type Op =
  | { type: 'equal'; left: number; right: number }
  | { type: 'delete'; left: number }
  | { type: 'insert'; right: number }

/**
 * Split text into lines. CRLF is normalized and a single trailing newline is
 * ignored so "a\n" and "a" compare as the same content.
 */
export function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n')
  if (normalized === '') return []
  const trimmed = normalized.endsWith('\n')
    ? normalized.slice(0, -1)
    : normalized
  return trimmed.split('\n')
}

export function countLines(text: string): number {
  return splitLines(text).length
}

function normalizeLine(line: string, options: DiffOptions): string {
  let value = line
  if (options.ignoreWhitespace) value = value.replace(/\s+/g, ' ').trim()
  if (options.ignoreCase) value = value.toLowerCase()
  return value
}

/**
 * Myers O(ND) diff over comparable line keys. The trace is stored sparsely
 * (one snapshot of the active diagonals per edit step) to avoid allocating a
 * full matrix for larger inputs.
 */
function myers(a: string[], b: string[]): Op[] | null {
  const n = a.length
  const m = b.length
  const max = n + m
  const limit = Math.min(max, MAX_EDIT_DISTANCE)
  const offset = max
  const v = new Int32Array(2 * max + 1)
  const trace: Int32Array[] = []

  for (let d = 0; d <= limit; d += 1) {
    trace.push(v.slice(offset - d, offset + d + 1))

    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]
      } else {
        x = v[offset + k - 1] + 1
      }

      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x += 1
        y += 1
      }
      v[offset + k] = x

      if (x >= n && y >= m) {
        return backtrack(trace, a, b, d)
      }
    }
  }

  return null
}

function backtrack(
  trace: Int32Array[],
  a: string[],
  b: string[],
  finalDistance: number,
): Op[] {
  let x = a.length
  let y = b.length
  const ops: Op[] = []

  for (let d = finalDistance; d >= 0; d -= 1) {
    if (d === 0) {
      while (x > 0 && y > 0) {
        ops.push({ type: 'equal', left: x - 1, right: y - 1 })
        x -= 1
        y -= 1
      }
      while (x > 0) {
        x -= 1
        ops.push({ type: 'delete', left: x })
      }
      while (y > 0) {
        y -= 1
        ops.push({ type: 'insert', right: y })
      }
      break
    }

    const snapshot = trace[d]
    const k = x - y
    const at = (diagonal: number) => snapshot[diagonal + d]

    let previousK: number
    if (k === -d || (k !== d && at(k - 1) < at(k + 1))) {
      previousK = k + 1
    } else {
      previousK = k - 1
    }

    const previousX = at(previousK)
    const previousY = previousX - previousK

    while (x > previousX && y > previousY) {
      ops.push({ type: 'equal', left: x - 1, right: y - 1 })
      x -= 1
      y -= 1
    }

    if (x === previousX) {
      y -= 1
      ops.push({ type: 'insert', right: y })
    } else {
      x -= 1
      ops.push({ type: 'delete', left: x })
    }
  }

  return ops.reverse()
}

function coarseDiff(a: string[], b: string[], aOffset: number, bOffset: number) {
  const ops: Op[] = []
  const shared = Math.min(a.length, b.length)

  for (let index = 0; index < shared; index += 1) {
    if (a[index] === b[index]) {
      ops.push({
        type: 'equal',
        left: aOffset + index,
        right: bOffset + index,
      })
    } else {
      ops.push({ type: 'delete', left: aOffset + index })
      ops.push({ type: 'insert', right: bOffset + index })
    }
  }

  for (let index = shared; index < a.length; index += 1) {
    ops.push({ type: 'delete', left: aOffset + index })
  }
  for (let index = shared; index < b.length; index += 1) {
    ops.push({ type: 'insert', right: bOffset + index })
  }

  return ops
}

function diffKeys(
  a: string[],
  b: string[],
): { ops: Op[]; coarse: boolean } {
  const n = a.length
  const m = b.length

  let prefix = 0
  while (prefix < n && prefix < m && a[prefix] === b[prefix]) prefix += 1

  let endA = n
  let endB = m
  while (endA > prefix && endB > prefix && a[endA - 1] === b[endB - 1]) {
    endA -= 1
    endB -= 1
  }

  const ops: Op[] = []
  for (let index = 0; index < prefix; index += 1) {
    ops.push({ type: 'equal', left: index, right: index })
  }

  const middleA = a.slice(prefix, endA)
  const middleB = b.slice(prefix, endB)
  let coarse = false

  if (middleA.length === 0) {
    for (let index = 0; index < middleB.length; index += 1) {
      ops.push({ type: 'insert', right: prefix + index })
    }
  } else if (middleB.length === 0) {
    for (let index = 0; index < middleA.length; index += 1) {
      ops.push({ type: 'delete', left: prefix + index })
    }
  } else {
    const middle = myers(middleA, middleB)
    if (middle) {
      for (const op of middle) {
        if (op.type === 'equal') {
          ops.push({
            type: 'equal',
            left: prefix + op.left,
            right: prefix + op.right,
          })
        } else if (op.type === 'delete') {
          ops.push({ type: 'delete', left: prefix + op.left })
        } else {
          ops.push({ type: 'insert', right: prefix + op.right })
        }
      }
    } else {
      coarse = true
      ops.push(...coarseDiff(middleA, middleB, prefix, prefix))
    }
  }

  const suffixLength = n - endA
  for (let index = 0; index < suffixLength; index += 1) {
    ops.push({
      type: 'equal',
      left: endA + index,
      right: endB + index,
    })
  }

  return { ops, coarse }
}

function inlineParts(left: string, right: string): {
  left: DiffPart[]
  right: DiffPart[]
} {
  const a = Array.from(left)
  const b = Array.from(right)

  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const build = (chars: string[]) => {
    const parts: DiffPart[] = []
    const head = chars.slice(0, prefix).join('')
    if (head) parts.push({ text: head, changed: false })

    const middle = chars.slice(prefix, chars.length - suffix).join('')
    if (middle) parts.push({ text: middle, changed: true })

    const tail = suffix > 0 ? chars.slice(chars.length - suffix).join('') : ''
    if (tail) parts.push({ text: tail, changed: false })
    return parts
  }

  return { left: build(a), right: build(b) }
}

function plainParts(text: string): DiffPart[] {
  return [{ text, changed: false }]
}

function side(lineNumber: number, text: string, parts?: DiffPart[]): DiffSide {
  return {
    no: lineNumber,
    text,
    parts: parts ?? plainParts(text),
  }
}

function buildRows(
  leftLines: string[],
  rightLines: string[],
  ops: Op[],
): DiffRow[] {
  const rows: DiffRow[] = []
  let index = 0

  while (index < ops.length) {
    const op = ops[index]
    if (op.type === 'equal') {
      rows.push({
        kind: 'equal',
        left: side(op.left + 1, leftLines[op.left]),
        right: side(op.right + 1, rightLines[op.right]),
      })
      index += 1
      continue
    }

    const deletes: number[] = []
    const inserts: number[] = []
    while (index < ops.length && ops[index].type !== 'equal') {
      const current = ops[index]
      if (current.type === 'delete') deletes.push(current.left)
      else if (current.type === 'insert') inserts.push(current.right)
      index += 1
    }

    const paired = Math.min(deletes.length, inserts.length)
    for (let pair = 0; pair < paired; pair += 1) {
      const leftIndex = deletes[pair]
      const rightIndex = inserts[pair]
      const leftText = leftLines[leftIndex]
      const rightText = rightLines[rightIndex]
      const parts = inlineParts(leftText, rightText)
      rows.push({
        kind: 'change',
        left: side(leftIndex + 1, leftText, parts.left),
        right: side(rightIndex + 1, rightText, parts.right),
      })
    }

    for (let rest = paired; rest < deletes.length; rest += 1) {
      const leftIndex = deletes[rest]
      rows.push({
        kind: 'remove',
        left: side(leftIndex + 1, leftLines[leftIndex]),
        right: null,
      })
    }

    for (let rest = paired; rest < inserts.length; rest += 1) {
      const rightIndex = inserts[rest]
      rows.push({
        kind: 'add',
        left: null,
        right: side(rightIndex + 1, rightLines[rightIndex]),
      })
    }
  }

  return rows
}

export function compareText(
  leftText: string,
  rightText: string,
  options: DiffOptions,
): DiffResult {
  const leftLines = splitLines(leftText)
  const rightLines = splitLines(rightText)
  const rawIdentical = leftText === rightText

  const baseStats: DiffStats = {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
    leftLines: leftLines.length,
    rightLines: rightLines.length,
    identical: true,
    rawIdentical,
  }

  if (
    leftLines.length > MAX_LINES_PER_SIDE ||
    rightLines.length > MAX_LINES_PER_SIDE
  ) {
    return {
      rows: [],
      stats: { ...baseStats, identical: false },
      coarse: false,
      limited: true,
    }
  }

  const leftKeys = leftLines.map((line) => normalizeLine(line, options))
  const rightKeys = rightLines.map((line) => normalizeLine(line, options))
  const { ops, coarse } = diffKeys(leftKeys, rightKeys)
  const rows = buildRows(leftLines, rightLines, ops)

  const stats: DiffStats = { ...baseStats }
  for (const row of rows) {
    if (row.kind === 'add') stats.added += 1
    else if (row.kind === 'remove') stats.removed += 1
    else if (row.kind === 'change') stats.changed += 1
    else if (row.kind === 'equal') stats.unchanged += 1
  }
  stats.identical = stats.added + stats.removed + stats.changed === 0

  return { rows, stats, coarse, limited: false }
}

/**
 * Split text the same way a textarea lays it out, keeping the empty line that
 * follows a trailing newline and showing one line for empty text.
 */
function visualLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n')
}

/** Number of lines shown by the editor, matching the textarea layout. */
export function countVisualLines(text: string): number {
  let count = 1
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code === 10) {
      count += 1
    } else if (code === 13) {
      count += 1
      if (text.charCodeAt(index + 1) === 10) index += 1
    }
  }
  return count
}

/**
 * Project aligned diff rows back onto one side so an editor can highlight
 * every line by its actual line number. Lines outside the diff (and every line
 * before the deferred comparison settles) are rendered as plain text.
 */
export function editorLines(
  rows: DiffRow[],
  side: 'left' | 'right',
  text: string,
): DiffEditorLine[] {
  const lines: DiffEditorLine[] = visualLines(text).map((line) => ({
    kind: 'equal' as const,
    parts: plainParts(line),
  }))

  for (const row of rows) {
    const cell = side === 'left' ? row.left : row.right
    if (!cell) continue

    const kind: DiffLineKind =
      row.kind === 'change'
        ? 'changed'
        : row.kind === 'remove'
          ? 'removed'
          : row.kind === 'add'
            ? 'added'
            : 'equal'

    const target = lines[cell.no - 1]
    if (!target) continue
    target.kind = kind
    target.parts = cell.parts
  }

  return lines
}
