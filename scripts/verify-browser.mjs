import { build } from 'esbuild'
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
await build({ entryPoints: ['tests/preview-entry.ts'], outfile: 'artifacts/preview.js', bundle: true, alias: { '@deepseek-ai/dsh-client-ui-primitives': './tests/host-primitives.mjs' }, platform: 'browser', format: 'iife' })
const html = `<!doctype html><meta charset="UTF-8"><title>File tree layout verification</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f7f7;font:13px system-ui;color:#292929}main{height:100vh;display:grid;grid-template-columns:260px 1fr}nav{padding:28px;background:#efefef;border-right:1px solid #ddd}section[data-dockkit-pane]{height:100%;min-width:0;display:flex;flex-direction:column;border:1px solid #ddd}header{display:flex;align-items:center;height:44px;border-bottom:1px solid #ddd;padding:0 12px}header span{flex:1}[data-dockkit-strip-chrome]{display:flex}header button{border:0;background:none;padding:6px}#preview{flex:1;min-height:0;padding:24px;overflow:auto;background:#fafafa;font:13px/1.9 Consolas,monospace;white-space:pre-wrap}div[data-sidebar-right-panel]{min-width:0;height:100%}</style>
<main><nav><b>DeepSeek Harness</b><p>当前会话</p><p>改进 dsh-file-peek 文件树</p></nav><div data-sidebar-right-panel="push" data-sidebar-right-open data-sidebar-right-session="demo"><section data-dockkit-pane="p1"><header><span>tsconfig.json</span><div data-dockkit-strip-chrome><button data-sidebar-right-toggle>□</button></div></header><div id="preview">{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true
  }
}</div></section></div></main><script src="preview.js"></script>`
await writeFile('artifacts/preview.html', html)
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
 const errors = []; page.on('pageerror', error => errors.push(error.message))
 await page.goto(pathToFileURL(process.cwd() + '/artifacts/preview.html').href)
 await page.getByRole('treeitem', { name: 'dsh-file-peek', exact: false }).click()
 await page.getByRole('treeitem', { name: 'package.json', exact: false }).waitFor()
 const tree = await page.locator('[data-file-peek-tree]').boundingBox()
 const preview = await page.locator('#preview').boundingBox()
 const header = await page.locator('header').boundingBox()
 assert.ok(preview.x + preview.width <= tree.x + 1, 'tree does not overlap preview')
 assert.ok(tree.y >= header.y + header.height - 1, 'tree is below tab strip')
 await page.getByRole('treeitem', { name: 'package.json', exact: false }).click()
 assert.match(await page.locator('#preview').textContent(), /package.json/)
 await page.screenshot({ path: 'artifacts/file-tree-preview.png' })
 await page.getByRole('button', { name: '收起文件树', exact: true }).click()
 assert.ok((await page.locator('#preview').boundingBox()).width > preview.width)
 await page.getByRole('button', { name: '切换文件树' }).click()
 await page.setViewportSize({ width: 800, height: 650 })
 const narrowTree = await page.locator('[data-file-peek-tree]').boundingBox()
 const narrowPreview = await page.locator('#preview').boundingBox()
 assert.ok(narrowTree.width >= 140 && narrowPreview.width > 200)
 assert.ok(narrowPreview.x + narrowPreview.width <= narrowTree.x + 1)
 assert.deepEqual(errors, [])
 console.log('Browser layout: no overlap, native file open, toggle, narrow width, no page errors: PASS')
} finally { await browser.close() }
