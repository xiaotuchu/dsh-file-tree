import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Drawer } from '../artifacts/tests/drawer.js'
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
for (const name of ['window','location','document','HTMLElement','Element','MutationObserver','Event','MouseEvent','KeyboardEvent']) globalThis[name] = dom.window[name]
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const entry = (name, dir = false) => ({ name, dir, path: `D:/work/${name}`, size: 10 })
const result = (entries) => ({ root: 'D:/work', path: 'D:/work', entries, truncated: false })
const reply = (value) => ({ json: async () => ({ ok: true, value }) })
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 10)) })
const click = async (el) => { assert.ok(el, 'control exists'); await act(async () => el.click()); await settle() }
const button = (text) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text))
async function mount(props = {}) {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(React.createElement(Drawer, { sessionId: 's1', onClose() {}, ...props })))
  await settle()
  return async () => { await act(async () => root.unmount()); host.remove() }
}
test('file stays selected while tree remains visible when native opening fails', async () => {
  globalThis.fetch = async () => reply(result([entry('alpha.ts')]))
  const dispose = await mount({ onOpenFile: () => false })
  try {
    await click(button('alpha.ts'))
    assert.ok(document.querySelector('[aria-label="筛选文件"]'))
    assert.ok(document.querySelector('[aria-selected="true"]'))
    assert.match(document.body.textContent, /无法打开|未能打开/)
  } finally { await dispose() }
})
test('collapse during loading can expand and load again', async () => {
  let childCalls = 0
  globalThis.fetch = async (_url, options) => {
    const { path } = JSON.parse(options.body)
    if (path === 'D:/work/src') {
      childCalls++
      if (childCalls === 1) return new Promise((_resolve,reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted','AbortError'))))
      return reply(result([entry('child.ts')]))
    }
    return reply(result([entry('src', true)]))
  }
  const dispose = await mount()
  try {
    await click(button('src')); await click(button('src')); await click(button('src'))
    assert.ok(button('child.ts'))
    assert.equal(childCalls, 2)
  } finally { await dispose() }
})
test('refresh displays files added after first load', async () => {
  let added = false
  globalThis.fetch = async () => reply(result([entry(added ? 'new.ts' : 'old.ts')]))
  const dispose = await mount()
  try {
    added = true
    await click(document.querySelector('[aria-label="刷新文件树"]'))
    assert.ok(button('new.ts'))
  } finally { await dispose() }
})


test('mount uses native pane markers, keeps tree across tabs, and restores layout', async () => {
  const { apply } = await import('../artifacts/tests/index.js')
  document.body.innerHTML = '<div data-sidebar-right-panel="push" data-sidebar-right-open data-sidebar-right-session="s1"><section data-dockkit-pane="p1"><div><div data-dockkit-strip="p1" role="tablist"><div data-dockkit-strip-chrome><button data-sidebar-right-toggle>collapse</button></div></div></div><div class="native-body">native preview</div></section></div>'
  globalThis.fetch = async () => reply(result([entry('alpha.ts')]))
  let cleanup
  const opened = []
  const ctx = { sidebarRight: { openResource: (...args) => opened.push(args) }, effect(fn) { cleanup = fn() }, inject(_deps, fn) { fn(ctx) } }
  await act(async () => apply(ctx)); await settle()
  try {
    const tree = document.querySelector('.fp-tree')
    assert.ok(tree, 'file tree mounts without geometry heuristics')
    assert.ok(document.querySelector('[data-file-peek-layout]'))
    await click(button('alpha.ts'))
    assert.equal(opened[0][0], 'dsh-resource://file/session/s1/alpha.ts')
    assert.equal(opened[0][1].paneId, 'p1')
    const panel = document.querySelector('[data-sidebar-right-panel]')
    const oldPane = panel.firstElementChild
    const newPane = oldPane.cloneNode(true)
    newPane.querySelector('[data-file-peek-tree]')?.remove()
    newPane.querySelector('[data-file-peek-toggle]')?.remove()
    newPane.removeAttribute('data-file-peek-layout')
    oldPane.replaceWith(newPane)
    await settle()
    assert.equal(document.querySelector('.fp-tree'), tree, 'same tree survives native tab replacement')
  } finally { await act(async () => cleanup?.()); document.body.innerHTML = '' }
  assert.equal(document.querySelector('[data-file-peek-layout]'), null)
})

test('mount closes and reopens without changing native preview; session switch resets selection', async () => {
  const { apply, fileAddress } = await import('../artifacts/tests/index.js')
  assert.equal(fileAddress('s 1', 'd:\\WORK\\a #.ts', 'D:\\work'), 'dsh-resource://file/session/s%201/a%20%23.ts')
  document.body.innerHTML = '<div data-sidebar-right-panel="push" data-sidebar-right-open data-sidebar-right-session="s1"><section data-dockkit-pane="p1"><div><div data-dockkit-strip-chrome></div></div><div id="native">preview</div></section></div>'
  globalThis.fetch = async (_url, options) => reply(result([entry(JSON.parse(options.body).sessionId + '.ts')]))
  let cleanup
  const ctx = { sidebarRight: { openResource() {} }, effect(fn) { cleanup = fn() }, inject(_deps, fn) { fn(ctx) } }
  await act(async () => apply(ctx)); await settle()
  try {
    await click(button('s1.ts'))
    await click(document.querySelector('[aria-label="收起文件树"]'))
    assert.equal(document.querySelector('[data-file-peek-layout]'), null)
    assert.equal(document.getElementById('native').textContent, 'preview')
    await click(document.querySelector('[data-file-peek-toggle]'))
    assert.ok(document.querySelector('[data-file-peek-layout]'))
    document.querySelector('[data-sidebar-right-panel]').dataset.sidebarRightSession = 's2'
    await settle()
    assert.ok(button('s2.ts')); assert.equal(button('s1.ts'), undefined)
    assert.equal(document.querySelector('[aria-selected="true"]'), null)
  } finally { await act(async () => cleanup()); }
  assert.equal(document.querySelector('[data-file-peek-layout]'), null)
  assert.equal(document.querySelector('[data-file-peek-tree]'), null)
  assert.equal(document.getElementById('native').textContent, 'preview')
  document.body.innerHTML = ''
})
