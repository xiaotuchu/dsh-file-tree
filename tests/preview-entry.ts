import { apply } from '../src/client/index'
const lists: Record<string, [string, boolean][]> = {
  'D:/Document/dsh': [['dsh-file-peek', true], ['dsh-old', true], ['dsh-theme-eye-care', true]],
  'D:/Document/dsh/dsh-file-peek': [['src', true], ['tests', true], ['package.json', false], ['README.md', false], ['tsconfig.json', false]],
  'D:/Document/dsh/dsh-file-peek/src': [['client', true], ['node', true], ['shared', true]],
}
window.fetch = async (_url, options) => {
  const path = JSON.parse(String(options?.body)).path || 'D:/Document/dsh'
  return new Response(JSON.stringify({ ok: true, value: { root: 'D:/Document/dsh', path, truncated: false, entries: (lists[path] || []).map(([name, dir]) => ({ name, dir, path: `${path}/${name}`, size: 100 })) } }))
}
const ctx: any = { sidebarRight: { openResource(address: string) { document.getElementById('preview')!.textContent = address } }, inject(_deps: string[], fn: any) { fn(ctx) }, effect(fn: any) { (window as any).cleanupPeek = fn() } }
apply(ctx)
