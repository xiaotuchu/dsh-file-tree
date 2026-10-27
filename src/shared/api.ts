/**
 * Contract shared by the two halves. Both the Node route and the browser bundle
 * import these types, so a field rename breaks the build instead of the runtime.
 */

/** Loader row id; also the settings namespace of this plugin. */
export const ENTRY_ID = 'dsh-file-tree'

/** HTTP prefix of the host face. Kept under its own namespace so it cannot
 *  collide with the stock `/api/*` routes or with dsh-better-sidebar's `/sidebar`. */
export const API_PREFIX = '/file-peek/api'

/** Entries returned by one directory listing. */
export const MAX_LIST_ENTRIES = 800

/** Bytes returned by one file read (text only; see `binary` in ReadResult). */
export const MAX_READ_BYTES = 512 * 1024

export interface PeekEntry {
  /** Basename shown in the tree. */
  name: string
  /** Absolute path; the client sends it back verbatim. */
  path: string
  /** True for directories (expandable). */
  dir: boolean
  /** Bytes for files; `null` when the stat failed (shown without a size). */
  size: number | null
}

export interface ListResult {
  /** Workspace root the listing is fenced to. */
  root: string
  /** Directory that was actually listed. */
  path: string
  entries: PeekEntry[]
  /** True when the directory held more entries than MAX_LIST_ENTRIES. */
  truncated: boolean
}

export interface ReadResult {
  path: string
  /** File decoded as UTF-8; empty when `binary` is true. */
  text: string
  size: number
  /** True when the file is larger than MAX_READ_BYTES and was cut. */
  truncated: boolean
  /** True when a NUL byte appeared in the head we read. */
  binary: boolean
}

export interface ApiErrorBody {
  code: string
  message: string
}

export type ApiResponse<T> = { ok: true; value: T } | { ok: false; error: ApiErrorBody }

/** Request bodies. `cwd` is only a hint: the host prefers its own session header. */
export interface ListRequest {
  sessionId?: string
  cwd?: string
  path?: string
}

export interface ReadRequest {
  sessionId?: string
  cwd?: string
  path: string
}

export const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  svg: 'svg',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  sh: 'shell',
  bash: 'shell',
  ps1: 'powershell',
  sql: 'sql',
  txt: 'text',
  log: 'text'
}

/** Basename extension, lowercased, without the dot (`''` when there is none). */
export function extOf(path: string): string {
  const base = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
}
