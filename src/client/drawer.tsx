import { createElement as h, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { apiErrorText, peekList } from './api'
import type { ListResult } from '../shared/api'

export interface DrawerProps {
  sessionId: string
  onOpenFile?: (path: string, root: string) => boolean | Promise<boolean>
  onClose: () => void
}
type Cache = Map<string, ListResult>
const nameOf = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase()
  const [label, color] = ext === 'ts' || ext === 'tsx' ? ['TS', '#397dcc']
    : ext === 'js' || ext === 'jsx' ? ['JS', '#b58b18']
    : ext === 'json' ? ['{}', '#d68236'] : ext === 'md' ? ['M↓', '#39945b']
    : ext === 'yml' || ext === 'yaml' ? ['≡', '#c96578'] : ['◇', 'currentColor']
  return h('span', { className: 'fp-file-icon', style: { color }, 'aria-hidden': true }, label)
}

function treeKeys(event: KeyboardEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement
  if (target.getAttribute('role') !== 'treeitem') return
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]'))
  const index = items.indexOf(target)
  let next: HTMLElement | undefined
  if (event.key === 'ArrowDown') next = items[Math.min(index + 1, items.length - 1)]
  else if (event.key === 'ArrowUp') next = items[Math.max(index - 1, 0)]
  else if (event.key === 'Home') next = items[0]
  else if (event.key === 'End') next = items[items.length - 1]
  else if (event.key === 'ArrowRight') {
    if (target.getAttribute('aria-expanded') === 'false') target.click()
    else next = items[index + 1]
  } else if (event.key === 'ArrowLeft') {
    if (target.getAttribute('aria-expanded') === 'true') target.click()
    else next = items.slice(0, index).reverse().find(item => Number(item.getAttribute('aria-level')) < Number(target.getAttribute('aria-level')))
  } else return
  event.preventDefault()
  next?.focus()
}

export function Drawer({ sessionId, onOpenFile, onClose }: DrawerProps): JSX.Element {
  const [version, setVersion] = useState(0)
  const [root, setRoot] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [filter, setFilter] = useState('')
  const [openingError, setOpeningError] = useState('')
  const cache = useRef<Cache>(new Map())
  const selectionRequest = useRef(0)
  useEffect(() => {
    cache.current.clear()
    setRoot(''); setError(''); setSelected(''); setOpeningError('')
    selectionRequest.current++
    if (!sessionId) { setError('请选择一个会话以查看工作区文件。'); return }
    const controller = new AbortController()
    peekList({ sessionId }, controller.signal).then(result => {
      if (controller.signal.aborted) return
      cache.current.set(result.root, result)
      setRoot(result.root)
    }).catch(reason => {
      if (!controller.signal.aborted) setError(apiErrorText(reason))
    })
    return () => { controller.abort(); selectionRequest.current++ }
  }, [sessionId, version])
  const select = async (path: string) => {
    setSelected(path); setOpeningError('')
    const request = ++selectionRequest.current
    try {
      const opened = await onOpenFile?.(path, root)
      if (!opened && request === selectionRequest.current) setOpeningError('未能打开文件，请确认原生预览栏已就绪后重试。')
    } catch (reason) {
      if (request === selectionRequest.current) setOpeningError(`无法打开文件：${apiErrorText(reason)}`)
    }
  }
  return h('aside', { className: 'fp-tree', 'aria-label': '工作区文件' },
    h('div', { className: 'fp-toolbar' },
      h('span', { className: 'fp-search-icon', 'aria-hidden': true }, '⌕'),
      h('input', { type: 'search', value: filter, placeholder: '筛选文件…', 'aria-label': '筛选文件', onChange: (e: { target: { value: string } }) => setFilter(e.target.value) }),
      h('button', { className: 'fp-iconbtn', 'aria-label': '刷新文件树', title: '刷新文件树', onClick: () => setVersion(v => v + 1) }, '↻'),
      h('button', { className: 'fp-iconbtn', 'aria-label': '收起文件树', title: '收起文件树', onClick: onClose }, '×')),
    openingError ? h('div', { className: 'fp-note fp-error', role: 'alert' }, openingError) : null,
    h('div', { className: 'fp-scroll', role: 'tree', 'aria-label': '文件树', onKeyDown: treeKeys },
      error ? h('div', { className: 'fp-note', role: 'alert' }, error)
      : !root ? h('div', { className: 'fp-note', role: 'status' }, '读取工作区…')
      : h(TreeDir, { key: `${sessionId}:${version}:${root}`, sessionId, path: root, root, cache: cache.current, depth: 0, selected, select, filter: filter.trim().toLowerCase(), initialOpen: true })),
    filter ? h('div', { className: 'fp-filter-hint' }, '筛选已展开目录中的文件') : null)
}
interface DirProps {
  sessionId: string; path: string; root: string; cache: Cache; depth: number
  selected: string; select: (path: string) => void; filter: string; initialOpen?: boolean
}
function TreeDir(props: DirProps): JSX.Element {
  const { sessionId, path, cache, depth, selected, select, filter } = props
  const [open, setOpen] = useState(props.initialOpen ?? false)
  const [result, setResult] = useState(cache.get(path))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!open || cache.has(path)) return
    const controller = new AbortController()
    setError('')
    peekList({ sessionId, path }, controller.signal).then(value => {
      if (controller.signal.aborted) return
      cache.set(path, value); setResult(value)
    }).catch(reason => { if (!controller.signal.aborted) setError(apiErrorText(reason)) })
    return () => controller.abort()
  }, [open, sessionId, path, cache, attempt])
  const entries = result?.entries.filter(entry => entry.dir || !filter || entry.name.toLowerCase().includes(filter)) ?? []
  const noteProps = { className: 'fp-note', style: { paddingLeft: 33 + depth * 10 } }
  return h('div', null,
    h('button', { type: 'button', className: 'fp-row fp-directory', role: 'treeitem', 'aria-level': depth + 1, 'aria-expanded': open, title: path, style: { paddingLeft: 8 + depth * 10 }, onClick: () => setOpen(v => !v) },
      h('svg', { className: 'fp-caret', width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M3.75 2.5 6.25 5 3.75 7.5' })), h('span', { className: 'fp-name' }, nameOf(path))),
    open ? h('div', { role: 'group' },
      error ? h('div', { ...noteProps, role: 'alert' }, error, h('button', { className: 'fp-retry', onClick: () => setAttempt(v => v + 1) }, '重试'))
      : !result ? h('div', { ...noteProps, role: 'status' }, '读取中…')
      : entries.length === 0 ? h('div', noteProps, filter ? '没有匹配的文件' : '空目录')
      : entries.map(entry => entry.dir
        ? h(TreeDir, { ...props, key: entry.path, path: entry.path, depth: depth + 1, initialOpen: false })
        : h('button', { key: entry.path, type: 'button', className: 'fp-row', role: 'treeitem', 'aria-level': depth + 2, 'aria-selected': selected === entry.path, title: entry.path, style: { paddingLeft: 18 + depth * 10 }, onClick: () => select(entry.path) }, h(FileIcon, { name: entry.name }), h('span', { className: 'fp-name' }, entry.name))),
      result?.truncated ? h('div', noteProps, '仅显示前 800 项') : null) : null)
}
