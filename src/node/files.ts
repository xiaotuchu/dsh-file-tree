/**
 * Host-side filesystem work for the peek drawer: one directory listing and one
 * text read, both fenced to the session workspace root.
 *
 * The fence is the security boundary of this plugin — the browser can ask for any
 * path string, so every request resolves inside `root` or fails with
 * `outside-workspace` before touching the disk.
 */
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import {
  MAX_LIST_ENTRIES,
  MAX_READ_BYTES,
  type ListResult,
  type PeekEntry,
  type ReadResult
} from '../shared/api.js'

/** Code thrown to the route layer; `code` reaches the browser verbatim. */
export class PeekError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message)
    this.name = 'PeekError'
  }
}

const isWindows = process.platform === 'win32'

/** Case-insensitive on Windows, exact elsewhere. */
function samePath(a: string, b: string): boolean {
  return isWindows ? a.toLowerCase() === b.toLowerCase() : a === b
}

/** `target` is `root` itself or lives under it (after `resolve`). */
function inside(root: string, target: string): boolean {
  if (samePath(root, target)) return true
  const prefix = root.endsWith(sep) ? root : root + sep
  return isWindows
    ? target.toLowerCase().startsWith(prefix.toLowerCase())
    : target.startsWith(prefix)
}

/** Realpath when the directory exists, `resolve` otherwise. */
export async function canonicalRoot(cwd: string): Promise<string> {
  try {
    return await realpath(cwd)
  } catch {
    throw new PeekError('workspace-missing', `workspace root is not readable: ${cwd}`, 409)
  }
}

/**
 * Resolve a client-supplied path against the root and refuse anything that
 * escapes it — including through a symlink, which is why both sides are
 * realpath'd before the prefix test.
 */
export async function resolveInside(root: string, raw: string | undefined): Promise<string> {
  const target = raw === undefined || raw === '' ? root : isAbsolute(raw) ? raw : join(root, raw)
  let real: string
  try {
    real = await realpath(target)
  } catch {
    throw new PeekError('not-found', `path does not exist: ${target}`, 404)
  }
  if (!inside(root, real)) {
    throw new PeekError('outside-workspace', `path escapes the workspace root: ${raw ?? ''}`, 403)
  }
  return real
}

/** Directories first, then natural, case-insensitive name order. */
function compareEntries(a: PeekEntry, b: PeekEntry): number {
  if (a.dir !== b.dir) return a.dir ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
}

export async function listDirectory(root: string, raw: string | undefined): Promise<ListResult> {
  const dir = await resolveInside(root, raw)
  let dirents: Dirent[]
  try {
    dirents = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOTDIR') throw new PeekError('not-directory', `${dir} is not a directory`, 400)
    throw new PeekError('list-failed', `cannot list ${dir}: ${code ?? 'unknown'}`, 500)
  }

  const truncated = dirents.length > MAX_LIST_ENTRIES
  const visible = truncated ? dirents.slice(0, MAX_LIST_ENTRIES) : dirents
  const entries: PeekEntry[] = []
  for (const dirent of visible) {
    const path = join(dir, dirent.name)
    const dirLike = dirent.isDirectory()
    let size: number | null = null
    if (!dirLike && dirent.isFile()) {
      try {
        size = (await stat(path)).size
      } catch {
        size = null
      }
    }
    // Symlinks are resolved through `stat`; a broken link is listed as a file.
    let isDir = dirLike
    if (dirent.isSymbolicLink()) {
      try {
        isDir = (await stat(path)).isDirectory()
      } catch {
        isDir = false
      }
    }
    entries.push({ name: dirent.name, path, dir: isDir, size })
  }
  entries.sort(compareEntries)
  return { root, path: dir, entries, truncated }
}

export async function readTextFile(root: string, raw: string): Promise<ReadResult> {
  const file = await resolveInside(root, raw)
  let size: number
  try {
    const info = await stat(file)
    if (!info.isFile()) throw new PeekError('not-regular-file', `${rel(root, file)} is not a file`, 400)
    size = info.size
  } catch (error) {
    if (error instanceof PeekError) throw error
    throw new PeekError('not-found', `cannot stat ${file}`, 404)
  }

  let buffer: Buffer
  try {
    buffer = await readFile(file)
  } catch {
    throw new PeekError('read-failed', `cannot read ${rel(root, file)}`, 500)
  }

  const truncated = buffer.byteLength > MAX_READ_BYTES
  const head = truncated ? buffer.subarray(0, MAX_READ_BYTES) : buffer
  // A NUL in the head is the cheap binary test every file viewer uses.
  const binary = head.includes(0)
  return {
    path: file,
    text: binary ? '' : head.toString('utf8'),
    size,
    truncated,
    binary
  }
}

/** Workspace-relative path for messages (never leaks above the root). */
function rel(root: string, path: string): string {
  const value = relative(root, path)
  return value === '' ? '.' : value
}
