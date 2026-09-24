// app/api/reserve/route.ts の契約。npm run check:public から実行される。
// WO-PB-3（共有秘密・AGENTS.md §11 ③）: ① GAS_WEBHOOK_SECRET 未設定なら GAS へ転送しない（fail-closed）② 転送時は本文に webhook_secret を付ける
//   ③ クライアントが webhook_secret を送ってきても環境変数の値で上書きする ④ 本文がオブジェクトでなければ転送しない
//   ⑤ GAS_WEBHOOK_URL 未設定時はモック成功（既存の設計。PROJECT_CONTEXT「既知の問題」）。
//   検出力の確認（2026-09-23）: 秘密を足す前の route.ts（1bf5baf）に対して実行し、ケース 1 で転送が起きて落ちることを確認した。
// WO-PB-3F（F1・F2。docs/2026-09-24-WO-PB-3F-reserve-abuse.md）:
//   ⑥ GAS が読む 9 項目だけを組み立て直して転送する（submitted_at・phone などは送らない。room はクライアントの値を使わず
//      room_id と language から messages/*.json の RoomData で作る＝フォームが送る値と同じ）
//   ⑦ 形式違反は 400・GAS を呼ばない・message を返さない（フォームは message が無いと各言語の errors.submitFailed を出す）
//   ⑧ 実フォーム（components/pages/ReserveForm.tsx の handleSubmit）が送る形は、境界値（今日・UTC の前日・2 週間）も含めて転送される
//   検出力の確認（2026-09-24）: 変更前の route.ts（429be83）に ROUTE_UNDER_TEST で実行し、新規 41 件が落ちることを確認した
//     ― ⑥ 4 件すべて（submitted_at・bcc 等がそのまま転送／room にクライアントの文字列）、⑦ 違反 34 件すべて「GAS へ転送された」、
//     ⑦ モック時の違反が 200、⑧ name の空白除去・タブの空白化の 2 件。⑧ の実フォーム形 17 件は変更前も通る（正当な送信を落とさない
//     ことの回帰検査）。
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
  // esModuleInterop はプロジェクトの tsconfig と同じ（route が JSON を default import するため）
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
})
const NextResponse = { json: (data, init) => ({ data, status: init?.status ?? 200 }) }
const mod = { exports: {} }
new Function('require', 'module', 'exports', outputText)(
  (id) => (id === 'next/server' ? { NextResponse } : require(id.startsWith('@/') ? join(root, id.slice(2)) : id)),
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

// ---- 実フォームと同じ形の本文（components/pages/ReserveForm.tsx handleSubmit の payload。キー・型・書式を合わせる）
const DAY = 864e5
const utcDay = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10)
const addDays = (ymd, n) => new Date(Date.parse(ymd) + n * DAY).toISOString().slice(0, 10)
const roomName = (lang, id) => require(join(root, 'messages', `${lang}.json`)).RoomData[id].name
function formPayload(over = {}) {
  const checkin = over.checkin ?? utcDay(40)
  const language = over.language ?? 'ja'
  const room_id = over.room_id ?? 'villa'
  return {
    subject: '【予約問い合わせ】Synthetic Guest 様 / Villa / 3ヶ月',
    from_name: 'Puri Liang Residence — Reservation Form',
    name: 'Synthetic Guest',
    nationality: 'JP',
    email: 'synthetic@example.com',
    phone: '+81 90 0000 0000',
    // フォームは tRoom(`${r.id}.name`)＝表示中の言語の RoomData の名前を送る（列挙外の違反ケースでは適当な名前）
    room: ['ja', 'en', 'id'].includes(language) && ['villa', 'king', 'twin'].includes(room_id) ? roomName(language, room_id) : 'Villa',
    room_id,
    checkin,
    checkout: addDays(checkin, 92),
    months: 3,
    guests: 2,
    stay_purposes: '(none)',
    notes: '(none)',
    language,
    currency: 'JPY',
    rent_amount: 231000,
    discount_pct: 5,
    discount_amount: 11550,
    electricity_amount: 13500,
    total_amount: 232950,
    total_idr: 25725000,
    rent_idr: 25500000,
    electricity_idr: 1500000,
    discount_idr: 1275000,
    submitted_at: new Date().toISOString(),
    page: 'https://puri-liang-residence.vercel.app/ja/reserve',
    ...over,
  }
}
/** GAS の WebhookParser.parsePayload が読む項目（submitted_at を除く）。これ以外は転送しない。 */
const GAS_FIELDS = ['name', 'email', 'language', 'checkin', 'checkout', 'room', 'room_id', 'guests', 'notes']

// ---- 新しいケースは 1 件ずつ記録し、最後にまとめて判定する（変更前のコードで「どれが落ちるか」を全部見るため）
const failures = []
async function t(label, fn) {
  try {
    await fn()
  } catch (e) {
    failures.push(label)
    console.log(`FAIL ${label}: ${e.message.split('\n')[0]}`)
  }
}

// 1) URL あり・秘密なし → 転送しない
process.env.GAS_WEBHOOK_URL = 'https://gas.invalid/exec'
delete process.env.GAS_WEBHOOK_SECRET
let res = await POST(req(formPayload()))
assert.equal(forwarded.length, 0, '秘密なしで GAS へ転送してはならない')
assert.equal(res.data.success, false)
assert.equal(res.status, 503)

// 2) 秘密あり → 本文に付けて転送
process.env.GAS_WEBHOOK_SECRET = SECRET
res = await POST(req(formPayload()))
assert.equal(forwarded.length, 1)
assert.equal(forwarded[0].body.webhook_secret, SECRET)
assert.equal(forwarded[0].body.email, 'synthetic@example.com')
assert.equal(res.data.success, true)

// 3) クライアントが webhook_secret を送っても上書きされる
await POST(req({ ...formPayload(), webhook_secret: 'attacker-chosen' }))
assert.equal(forwarded.at(-1).body.webhook_secret, SECRET)

// 4) 本文がオブジェクトでない → 転送しない
for (const bad of [null, 'text', ['a'], 42]) {
  const n = forwarded.length
  res = await POST(req(bad))
  assert.equal(forwarded.length, n, `本文 ${JSON.stringify(bad)} を転送してはならない`)
  assert.equal(res.status, 400)
}

// ---------------------------------------------------------------- WO-PB-3F
// ⑥ allowlist: 実フォームの本文 → GAS が読む 9 項目＋秘密だけ。値は従来の転送と同じ
await t('⑥ 転送は GAS が読む 9 項目＋webhook_secret だけ（submitted_at・phone・料金などを送らない）', async () => {
  const sent = formPayload()
  const n = forwarded.length
  res = await POST(req(sent))
  assert.equal(res.status, 200)
  assert.equal(forwarded.length, n + 1, '転送されること')
  const body = forwarded.at(-1).body
  assert.deepEqual(Object.keys(body).sort(), [...GAS_FIELDS, 'webhook_secret'].sort())
  for (const k of GAS_FIELDS) assert.deepEqual(body[k], sent[k], `${k} の値は従来どおり`)
})
await t('⑥ submitted_at を過去にしても転送されない（F2）', async () => {
  await POST(req(formPayload({ submitted_at: '2020-01-01T00:00:00.000Z' })))
  assert.ok(!('submitted_at' in forwarded.at(-1).body), 'submitted_at が転送された')
})
await t('⑥ 未知の項目は転送されない', async () => {
  await POST(req(formPayload({ bcc: 'x@example.com', status: '1次送信済', timestamp: '2020-01-01' })))
  const body = forwarded.at(-1).body
  for (const k of ['bcc', 'status', 'timestamp']) assert.ok(!(k in body), `${k} が転送された`)
})
await t('⑥ room はクライアントの文字列でなく room_id と language から作る', async () => {
  await POST(req(formPayload({ room: 'Click http://spam.example', room_id: 'king', language: 'en' })))
  assert.equal(forwarded.at(-1).body.room, roomName('en', 'king'))
})

// ⑧ 実フォームが送りうる境界値は通る
const passes = [
  ['チェックイン＝今日（フォームの初期値）・2 週間', { checkin: utcDay(0), checkout: addDays(utcDay(0), 14), months: 0.5 }],
  ['チェックイン＝UTC の前日（バリとの時差の余裕）', { checkin: utcDay(-1) }],
  ['guests 1', { guests: 1 }],
  ['guests 10', { guests: 10 }],
  ['name 100 文字', { name: 'x'.repeat(100) }],
  ['name 日本語', { name: '山田 太郎' }],
  ['notes 2,000 文字（改行を含む）', { notes: 'line\n'.repeat(400) }],
  ['email 254 文字', { email: 'a'.repeat(242) + '@example.com' }],
]
for (const lang of ['ja', 'en', 'id']) for (const id of ['villa', 'king', 'twin']) passes.push([`language=${lang} room_id=${id}`, { language: lang, room_id: id }])
for (const [label, over] of passes) {
  await t(`⑧ 通る: ${label}`, async () => {
    const sent = formPayload(over)
    const n = forwarded.length
    res = await POST(req(sent))
    assert.equal(res.status, 200, `status ${res.status}`)
    assert.equal(forwarded.length, n + 1, '転送されない')
    const body = forwarded.at(-1).body
    for (const k of GAS_FIELDS) {
      const want = k === 'room' ? roomName(sent.language, sent.room_id) : sent[k]
      assert.deepEqual(body[k], want, `${k}`)
    }
  })
}
await t('⑧ name の前後の空白は落として転送する', async () => {
  await POST(req(formPayload({ name: '  Synthetic Guest  ' })))
  assert.equal(forwarded.at(-1).body.name, 'Synthetic Guest')
})
await t('⑧ name のタブ（貼り付け。input type=text はタブを残す）は拒否せず空白にして転送する', async () => {
  const n = forwarded.length
  res = await POST(req(formPayload({ name: 'Synthetic\tGuest' })))
  assert.equal(res.status, 200, `status ${res.status}`)
  assert.equal(forwarded.length, n + 1)
  assert.equal(forwarded.at(-1).body.name, 'Synthetic Guest')
})

// ⑦ 違反は 400・転送しない・message を返さない
const violations = [
  ['email なし', { email: undefined }],
  ['email 形式違い', { email: 'not-an-email' }],
  ['email ドメインにドットなし', { email: 'a@b' }],
  ['email に空白', { email: 'a b@example.com' }],
  ['email 255 文字', { email: 'a'.repeat(243) + '@example.com' }],
  ['email が文字列でない', { email: ['synthetic@example.com'] }],
  ['email に制御文字', { email: 'a\u0000b@example.com' }],
  ['name なし', { name: undefined }],
  ['name 空', { name: '' }],
  ['name 空白だけ', { name: '   ' }],
  ['name 101 文字', { name: 'x'.repeat(101) }],
  ['name に改行', { name: 'Guest\nBcc: x@example.com' }],
  ['name に CR', { name: 'Guest\rX' }],
  ['name に U+2028', { name: 'Guest X' }],
  ['name が文字列でない', { name: 42 }],
  ['notes 2,001 文字', { notes: 'x'.repeat(2001) }],
  ['notes が文字列でない', { notes: { a: 1 } }],
  ['room_id 列挙外', { room_id: 'penthouse' }],
  ['room_id 大文字', { room_id: 'Villa' }],
  ['room_id なし', { room_id: undefined }],
  ['guests 0', { guests: 0 }],
  ['guests 11', { guests: 11 }],
  ['guests 小数', { guests: 2.5 }],
  ['guests 文字列', { guests: '2' }],
  ['guests なし', { guests: undefined }],
  ['language 列挙外', { language: 'fr' }],
  ['language なし', { language: undefined }],
  ['checkin 書式違い', { checkin: '2030/10/01', checkout: '2030-12-01' }],
  ['checkin 存在しない日付', { checkin: '2030-02-30', checkout: '2030-05-01' }],
  ['checkin なし', { checkin: undefined, checkout: utcDay(60) }],
  ['checkout 書式違い', { checkout: 'tomorrow' }],
  ['checkout = checkin', { checkin: utcDay(40), checkout: utcDay(40) }],
  ['checkout < checkin', { checkin: utcDay(40), checkout: utcDay(39) }],
  ['checkin が UTC の 2 日前', { checkin: utcDay(-2) }],
]
for (const [label, over] of violations) {
  await t(`⑦ 400: ${label}`, async () => {
    const sent = formPayload(over)
    for (const [k, v] of Object.entries(over)) if (v === undefined) delete sent[k]
    const n = forwarded.length
    res = await POST(req(sent))
    assert.equal(forwarded.length, n, 'GAS へ転送された')
    assert.equal(res.status, 400, `status ${res.status}`)
    assert.equal(res.data.success, false)
    assert.ok(!('message' in res.data), 'message を返した（フォームは message があるとそれを表示する）')
  })
}

// 5) URL なし → モック成功・転送しない（形式の検証はモックより先。Preview でも本番と同じ判定になる）
delete process.env.GAS_WEBHOOK_URL
const n = forwarded.length
res = await POST(req(formPayload()))
assert.deepEqual(res.data, { success: true, mock: true })
assert.equal(forwarded.length, n)
await t('⑦ URL なし（モック）でも違反は 400', async () => {
  res = await POST(req(formPayload({ email: 'not-an-email' })))
  assert.equal(res.status, 400)
})

if (failures.length) {
  console.log(`reserve-route: ${failures.length} 件 FAILED`)
  process.exit(1)
}
console.log('reserve-route: ALL ASSERTIONS PASSED')
