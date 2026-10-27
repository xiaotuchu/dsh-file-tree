/** Native dock integration. Select documented DOM markers, never viewport geometry. */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { Drawer } from './drawer'
import { CSS } from './styles'

interface Surface { panel: HTMLElement; pane: HTMLElement; header: HTMLElement; body: HTMLElement; chrome: HTMLElement; sessionId: string }
function findSurface(): Surface | null {
  for (const panel of document.querySelectorAll<HTMLElement>('[data-sidebar-right-panel][data-sidebar-right-open]')) {
    if (panel.closest('[hidden], [aria-hidden="true"]')) continue
    const chrome = panel.querySelector<HTMLElement>('[data-dockkit-strip-chrome]')
    const pane = chrome?.closest<HTMLElement>('[data-dockkit-pane]')
    if (!chrome || !pane || pane.closest('[hidden], [aria-hidden="true"]')) continue
    let header: HTMLElement = chrome
    while (header.parentElement && header.parentElement !== pane) header = header.parentElement
    const body = Array.from(pane.children).find((child): child is HTMLElement => child instanceof HTMLElement && child !== header && !child.hasAttribute('data-file-peek-tree'))
    const sessionId = panel.dataset.sidebarRightSession
    if (body && sessionId) return { panel, pane, header, body, chrome, sessionId }
  }
  return null
}
export function fileAddress(sessionId: string, path: string, root: string): string {
  const normalized = path.replace(/\\/g, '/')
  const base = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const windows = /^[A-Za-z]:/.test(base) || base.startsWith('//')
  const comparison = windows ? normalized.toLowerCase() : normalized
  const prefix = (windows ? base.toLowerCase() : base) + '/'
  const relative = comparison.startsWith(prefix) ? normalized.slice(base.length + 1) : normalized
  const encode = (part: string) => encodeURIComponent(part).replace(/%3A/gi, ':')
  return `dsh-resource://file/session/${encode(sessionId)}/${relative.split('/').map(encode).join('/')}`
}

export function apply(ctx: any): void {
  ctx.inject(['sidebarRight'], (scope: any) => {
    scope.effect(() => {
      const style = document.createElement('style'); style.textContent = CSS; document.head.append(style)
      const tree = document.createElement('div'); tree.dataset.filePeekTree = ''; tree.className = 'fp-host'
      const content = document.createElement('div'); content.className = 'fp-content'
      const resize = document.createElement('div'); resize.className = 'fp-resize'; resize.tabIndex = 0
      resize.setAttribute('role', 'separator'); resize.setAttribute('aria-orientation', 'vertical'); resize.setAttribute('aria-label', '调整文件树宽度')
      tree.append(resize, content)
      const root = createRoot(content)
      const toggle = document.createElement('span'); toggle.style.display = 'inline-flex'
      toggle.dataset.filePeekToggle = ''
      const toggleRoot = createRoot(toggle)
      let surface: Surface | null = null
      let sessionId = ''
      let open = true
      let width = 240
      let disposed = false
      let scheduled = false
      let endDrag: (() => void) | undefined
      const clearLayout = () => {
        if (!surface) return
        surface.pane.removeAttribute('data-file-peek-layout')
        surface.pane.style.removeProperty('--fp-width')
        surface.header.removeAttribute('data-file-peek-header')
        surface.body.removeAttribute('data-file-peek-preview')
      }
      const setOpen = (value: boolean) => {
        open = value
        tree.hidden = !value
        toggleRoot.render(createElement(Tooltip, { label: '显示 / 隐藏文件树', side: 'bottom', delayMs: 500 },
          createElement('button', { type: 'button', className: 'fp-toggle', 'aria-label': '切换文件树', 'aria-expanded': value },
            createElement('svg', { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
              createElement('path', { d: 'M2 5V3.5a1 1 0 0 1 1-1h3l1.5 2H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z' }),
              createElement('path', { d: 'M2 5.5h12' })))))
        surface?.pane.toggleAttribute('data-file-peek-layout', value)
      }
      toggle.onclick = () => setOpen(!open)
      const setWidth = (value: number) => {
        width = Math.max(160, Math.min(400, value))
        surface?.pane.style.setProperty('--fp-width', `${width}px`)
        resize.setAttribute('aria-valuenow', String(Math.round(width)))
        resize.setAttribute('aria-valuemin', '160'); resize.setAttribute('aria-valuemax', '400')
      }
      resize.onkeydown = event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault(); setWidth(width + (event.key === 'ArrowLeft' ? 16 : -16))
      }
      resize.onpointerdown = event => {
        if (event.button !== 0) return
        event.preventDefault(); endDrag?.()
        const startX = event.clientX; const startWidth = tree.getBoundingClientRect().width
        const move = (e: PointerEvent) => setWidth(startWidth + startX - e.clientX)
        endDrag = () => {
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish)
          endDrag = undefined
        }
        const finish = () => endDrag?.()
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish)
      }
      const sync = () => {
        if (disposed) return
        const next = findSurface()
        if (!next) {
          clearLayout(); surface = null; tree.remove(); toggle.remove()
          return
        }
        if (surface?.pane === next.pane && tree.parentElement === next.pane && toggle.parentElement === next.chrome && sessionId === next.sessionId) return
        endDrag?.(); clearLayout(); surface = next
        next.header.dataset.filePeekHeader = ''; next.body.dataset.filePeekPreview = ''
        next.pane.append(tree); next.chrome.prepend(toggle)
        setWidth(width); setOpen(open)
        if (sessionId !== next.sessionId) {
          sessionId = next.sessionId
          root.render(createElement(Drawer, {
            key: sessionId, sessionId,
            onClose: () => setOpen(false),
            onOpenFile: (path: string, workspace: string) => {
              if (!surface || surface.sessionId !== sessionId) return false
              scope.sidebarRight.openResource(fileAddress(sessionId, path, workspace), { paneId: surface.pane.dataset.dockkitPane })
              return true
            }
          }))
        }
      }
      const observer = new MutationObserver(() => {
        if (scheduled || disposed) return
        scheduled = true
        queueMicrotask(() => { scheduled = false; sync() })
      })
      observer.observe(document.body, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['hidden', 'aria-hidden', 'data-sidebar-right-open', 'data-sidebar-right-session', 'data-dockkit-pane'] })
      sync()
      return () => {
        disposed = true; observer.disconnect(); endDrag?.(); clearLayout()
        root.unmount(); toggleRoot.unmount(); tree.remove(); toggle.remove(); style.remove()
      }
    }, 'dsh-file-tree: preview-side tree')
  })
}
