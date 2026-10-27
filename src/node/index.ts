/**
 * Host half of dsh-file-tree.
 *
 * The browser half renders the drawer; this half is the only thing that touches
 * the disk. It exposes two methods over one loopback-fenced HTTP prefix:
 *
 *   POST /file-peek/api/list  { sessionId?, cwd?, path? } -> ListResult
 *   POST /file-peek/api/read  { sessionId?, cwd?, path }  -> ReadResult
 *
 * Deliberately declares no `inject`: a service dependency here would leave the
 * row permanently pending in profiles that mount no web server, and the row only
 * needs to be mounted for the browser bundle to be served. Everything it needs is
 * acquired through `ctx.inject` at runtime instead.
 */
import { ENTRY_ID, API_PREFIX, type ApiErrorBody } from '../shared/api.js'
import { PeekError, canonicalRoot, listDirectory, readTextFile } from './files.js'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

interface PluginConfig {
  enabled?: boolean
}

/** Stable plugin name; matches the row id in cordis.patch.yml. */
export const name = ENTRY_ID

const MAX_BODY_BYTES = 64 * 1024

function singleHeader(headers: Record<string, unknown>, wanted: string): string | undefined {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) continue
    return Array.isArray(value) ? String(value[0] ?? '') : value === undefined ? undefined : String(value)
  }
  return undefined
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]'
}

/**
 * Same fence dsh-better-sidebar and dsh-sidebar-hover use: the Host must be
 * loopback (or an authority the deployment trusts), a cross-site fetch is
 * refused, and a present Origin must name the same host.
 */
function isTrustedRequest(req: any, trustedHosts: readonly string[]): boolean {
  const host = singleHeader(req.headers ?? {}, 'host')
  if (host === undefined || host === '') return false
  const bracketEnd = host.indexOf(']')
  const colon = host.lastIndexOf(':')
  const hostname = (bracketEnd !== -1 ? host.slice(1, bracketEnd) : colon === -1 ? host : host.slice(0, colon)).toLowerCase()
  if (!isLoopbackHostname(hostname)) {
    const authority = host.toLowerCase()
    if (!trustedHosts.some((candidate) => candidate.toLowerCase() === authority)) return false
  }
  if (singleHeader(req.headers ?? {}, 'sec-fetch-site') === 'cross-site') return false
  const origin = singleHeader(req.headers ?? {}, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).hostname.toLowerCase() === hostname
  } catch {
    return false
  }
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? ''))
      size += buffer.byteLength
      if (size > MAX_BODY_BYTES) {
        reject(new PeekError('bad-request', 'request body too large', 413))
        return
      }
      chunks.push(buffer)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: any, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function failure(error: unknown): { status: number; body: ApiErrorBody } {
  if (error instanceof PeekError) return { status: error.status, body: { code: error.code, message: error.message } }
  const message = error instanceof Error ? error.message : String(error)
  return { status: 500, body: { code: 'internal', message } }
}

/**
 * Session requests require the authoritative live header. Only requests without
 * a session retain the explicit cwd / process cwd compatibility fallback.
 */
/**
 * Live session registry, captured through `ctx.inject` at mount time.
 *
 * `ctx.sessions` must never be read directly: cordis throws
 * `cannot get property "sessions" without inject`, which surfaced as an
 * `internal:` error inside the panel and killed the whole resolve. The face below
 * is the only door.
 */
let sessionsFace: any = undefined

function resolveCwd(_ctx: any, sessionId: unknown, hint: unknown): string {
  if (typeof sessionId === 'string' && sessionId !== '') {
    try {
      const header = sessionsFace?.get?.(sessionId)?.header
      if (typeof header?.cwd === 'string' && header.cwd !== '') return header.cwd
    } catch {
      /* Report an unavailable session workspace below. */
    }
    throw new PeekError('workspace-missing', '当前会话的工作区尚未就绪，请稍后刷新。', 409)
  }
  if (typeof hint === 'string' && hint !== '') return hint
  return process.cwd()
}

async function dispatch(ctx: any, method: string, payload: Record<string, unknown>) {
  // Diagnostics first: it touches no workspace path and must work even when no
  // session is resolvable (that is often exactly what is being debugged).
  if (method === 'diag') {
    const file = join(tmpdir(), 'dsh-file-tree-diag.json')
    await writeFile(file, JSON.stringify(payload, null, 2), 'utf8')
    return { written: file }
  }
  if (method !== 'list' && method !== 'read') {
    throw new PeekError('bad-request', `unknown method "${method}"`, 404)
  }
  const cwd = resolveCwd(ctx, payload.sessionId, payload.cwd)
  const root = await canonicalRoot(cwd)
  if (method === 'list') {
    const path = typeof payload.path === 'string' ? payload.path : undefined
    return listDirectory(root, path)
  }
  if (typeof payload.path !== 'string' || payload.path === '') {
    throw new PeekError('bad-request', 'path is required', 400)
  }
  return readTextFile(root, payload.path)
}

export function apply(ctx: any, config: PluginConfig = {}): void {
  const state: { trustedHosts: readonly string[] } = { trustedHosts: [] }

  if (config.enabled === false) {
    ctx.logger?.info?.(`${ENTRY_ID}: disabled by configuration`)
    return
  }

  ctx.inject(['webRuntime'], (cctx: any) => {
    cctx.effect(() => {
      state.trustedHosts = cctx.webRuntime?.trustedHosts ?? []
      return () => {
        state.trustedHosts = []
      }
    }, `${ENTRY_ID}: trusted hosts`)
  })

  ctx.inject(['sessions'], (cctx: any) => {
    cctx.effect(() => {
      sessionsFace = cctx.sessions
      return () => {
        sessionsFace = undefined
      }
    }, `${ENTRY_ID}: session registry`)
  })

  ctx.inject(['webServer'], (cctx: any) => {
    const handler = async (req: any, res: any): Promise<void> => {
      if (!isTrustedRequest(req, state.trustedHosts)) {
        sendJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'untrusted request' } })
        return
      }
      let payload: Record<string, unknown>
      try {
        const parsed: unknown = JSON.parse((await readBody(req)) || '{}')
        payload = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
      } catch (error) {
        const { status, body } = failure(error)
        sendJson(res, status, { ok: false, error: body })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://x').pathname
      const rest = pathname.startsWith(`${API_PREFIX}/`) ? decodeURIComponent(pathname.slice(API_PREFIX.length + 1)) : ''
      const method = rest !== '' ? rest : typeof payload.method === 'string' ? payload.method : ''
      try {
        const value = await dispatch(ctx, method, payload)
        sendJson(res, 200, { ok: true, value })
      } catch (error) {
        const { status, body } = failure(error)
        sendJson(res, status, { ok: false, error: body })
      }
    }

    cctx.effect(
      () =>
        cctx.webServer.register({
          kind: 'prefix',
          path: API_PREFIX,
          handler
        }),
      `${ENTRY_ID}: peek api route`
    )
    ctx.logger?.info?.(`${ENTRY_ID}: serving ${API_PREFIX}`)
  })
}
