// app/api/reserve/route.ts の共有秘密の契約（WO-PB-3 / AGENTS.md §11 ③）。npm run check:public から実行される。
// 守ること: ① GAS_WEBHOOK_SECRET 未設定なら GAS へ転送しない（fail-closed）② 転送時は本文に webhook_secret を付ける
//   ③ クライアントが webhook_secret を送ってきても環境変数の値で上書きする ④ 本文がオブジェクトでなければ転送しない
//   ⑤ GAS_WEBHOOK_URL 未設定時はモック成功（既存の設計。PROJECT_CONTEXT「既知の問題」）。
// 検出力の確認（2026-09-23）: 秘密を足す前の route.ts（1bf5baf）に対して実行し、ケース 1 で転送が起きて落ちることを確認した。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')

const routePath = process.env.ROUTE_UNDER_TEST ?? join(root, 'app/api/reserve/route.ts')
const { outputText } = ts.transpileModule(readFileSync(routePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const NextResponse = { json: (data, init) => ({ data, status: init?.status ?? 200 }) }
const mod = { exports: {} }
new Function('require', 'module', 'exports', outputText)(
  (id) => (id === 'next/server' ? { NextResponse } : require(id)),
  mod,
  mod.exports,
)
const { POST } = mod.exports

const forwarded = []
globalThis.fetch = async (url, init) => {
  forwarded.push({ url, body: JSON.parse(init.body) })
  return { json: async () => ({ success: true, id: 'INQ-TEST' }) }
}
console.warn = () => {}
console.error = () => {}
const req = (body) => ({ json: async () => body })
const SECRET = 's'.repeat(64)
const inquiry = { name: 'Synthetic', email: 'synthetic@example.com' }

// 1) URL あり・秘密なし → 転送しない
process.env.GAS_WEBHOOK_URL = 'https://gas.invalid/exec'
delete process.env.GAS_WEBHOOK_SECRET
let res = await POST(req(inquiry))
assert.equal(forwarded.length, 0, '秘密なしで GAS へ転送してはならない')
assert.equal(res.data.success, false)
assert.equal(res.status, 503)

// 2) 秘密あり → 本文に付けて転送
process.env.GAS_WEBHOOK_SECRET = SECRET
res = await POST(req(inquiry))
assert.equal(forwarded.length, 1)
assert.equal(forwarded[0].body.webhook_secret, SECRET)
assert.equal(forwarded[0].body.email, inquiry.email)
assert.equal(res.data.success, true)

// 3) クライアントが webhook_secret を送っても上書きされる
await POST(req({ ...inquiry, webhook_secret: 'attacker-chosen' }))
assert.equal(forwarded.at(-1).body.webhook_secret, SECRET)

// 4) 本文がオブジェクトでない → 転送しない
for (const bad of [null, 'text', ['a'], 42]) {
  const n = forwarded.length
  res = await POST(req(bad))
  assert.equal(forwarded.length, n, `本文 ${JSON.stringify(bad)} を転送してはならない`)
  assert.equal(res.status, 400)
}

// 5) URL なし → モック成功・転送しない
delete process.env.GAS_WEBHOOK_URL
const n = forwarded.length
res = await POST(req(inquiry))
assert.deepEqual(res.data, { success: true, mock: true })
assert.equal(forwarded.length, n)

console.log('reserve-route: ALL ASSERTIONS PASSED')
