import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { apply } from '../artifacts/tests/host.js'
test('unknown session cannot accidentally list host process directory', async () => {
 let handler
 const ctx = { sessions: { get() {} }, webRuntime: { trustedHosts: [] }, webServer: { register(route) { handler = route.handler; return () => {} } }, inject(_deps, fn) { fn(ctx) }, effect(fn) { fn() } }
 apply(ctx)
 const req = new EventEmitter(); req.headers = { host: 'localhost' }; req.url = '/file-peek/api/list'
 let status; let body
 const pending = handler(req, { writeHead(value) { status = value }, end(value) { body = JSON.parse(value) } })
 req.emit('data', JSON.stringify({ sessionId: 'missing-session' })); req.emit('end')
 await pending
 assert.equal(status, 409)
 assert.equal(body.error.code, 'workspace-missing')
})
