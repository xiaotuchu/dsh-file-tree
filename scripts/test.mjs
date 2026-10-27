import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
await mkdir('artifacts/tests', { recursive: true })
await build({ entryPoints: ['src/client/drawer.tsx', 'src/client/index.ts'], outdir: 'artifacts/tests', bundle: true, alias: { '@deepseek-ai/dsh-client-ui-primitives': './tests/host-primitives.mjs' }, platform: 'node', format: 'esm', external: ['react', 'react-dom', 'react-dom/client'] })
await build({ entryPoints: ['src/node/index.ts'], outfile: 'artifacts/tests/host.js', bundle: true, alias: { '@deepseek-ai/dsh-client-ui-primitives': './tests/host-primitives.mjs' }, platform: 'node', format: 'esm' })
await import('../tests/tree.test.mjs')
await import('../tests/host.test.mjs')
