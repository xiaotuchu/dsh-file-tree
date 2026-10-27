/**
 * Browser-side transport for the host face. Every call is a POST under
 * `/file-peek/api/*`; the route resolves the workspace root from the session id,
 * so the client only ever passes paths it got back from a previous call.
 */
import {
  API_PREFIX,
  type ApiResponse,
  type ListResult,
  type ReadResult
} from '../shared/api'

export class PeekApiError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'PeekApiError'
  }
}

/**
 * Candidate origins for the host face.
 *
 * In the desktop renderer the page is served from `dsh-app://app/`, and it is not
 * given that this custom protocol forwards an arbitrary plugin prefix to the
 * host's HTTP server (its `/api/*` routes are proxied, plugin prefixes are not
 * guaranteed). So a few bases are tried in order and the first that answers is
 * remembered for the rest of the page's life.
 */
let workingBase: string | null = null

function baseCandidates(): string[] {
  if (workingBase !== null) return [workingBase]
  const bases = ['']
  try {
    const boot = (window as unknown as { __DSH_BOOT__?: Record<string, unknown> }).__DSH_BOOT__
    if (boot !== undefined && boot !== null) {
      for (const key of ['apiBase', 'baseUrl', 'serverUrl', 'origin', 'url']) {
        const value = boot[key]
        if (typeof value === 'string' && value.startsWith('http')) {
          bases.push(value.replace(/\/+$/, ''))
          break
        }
      }
      const server = boot.server
      if (server !== null && typeof server === 'object') {
        const url = (server as Record<string, unknown>).url
        if (typeof url === 'string' && url.startsWith('http')) bases.push(url.replace(/\/+$/, ''))
      }
    }
  } catch {
    /* no boot payload: relative is all we have */
  }
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    bases.push(location.origin)
  }
  return Array.from(new Set(bases))
}

async function call<T>(method: 'list' | 'read', payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const tried: string[] = []
  for (const base of baseCandidates()) {
    const url = `${base}${API_PREFIX}/${method}`
    tried.push(url)
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        cache: 'no-store',
        ...(signal === undefined ? {} : { signal })
      })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      continue
    }
    const body = (await response.json().catch(() => null)) as ApiResponse<T> | null
    if (body === null) {
      // A non-JSON answer means this base hit something else (an SPA fallback, a
      // static handler); keep trying the remaining bases.
      continue
    }
    workingBase = base
    if (!body.ok) throw new PeekApiError(body.error.code, body.error.message)
    return body.value
  }
  throw new PeekApiError('network', `无法连接宿主接口，已尝试：${tried.join('  ,  ')}`)
}

/** Human sentence for anything the transport or the route threw. */
export function apiErrorText(reason: unknown): string {
  if (reason instanceof PeekApiError) {
    switch (reason.code) {
      case 'outside-workspace':
        return '这个路径在工作区之外，已拒绝。'
      case 'not-found':
        return '文件不存在（可能刚被移动或删除）。'
      case 'not-directory':
        return '这不是目录。'
      case 'not-regular-file':
        return '这不是普通文件（目录或特殊文件）。'
      case 'network':
        return '连不上宿主接口：请确认 dsh-file-tree 的 host 半已加载（安装后需重启应用）。'
      case 'read-failed':
        return `读取失败：${reason.message}`
      default:
        return `${reason.code}: ${reason.message}`
    }
  }
  return reason instanceof Error ? reason.message : String(reason)
}

export function peekList(
  request: { sessionId?: string; cwd?: string; path?: string },
  signal?: AbortSignal
): Promise<ListResult> {
  return call<ListResult>('list', request, signal)
}

export function peekRead(
  request: { sessionId?: string; cwd?: string; path: string },
  signal?: AbortSignal
): Promise<ReadResult> {
  return call<ReadResult>('read', request, signal)
}
