// messages/{ja,en,id}.json とリンクの契約。npm run check:public から実行される。
// ① 3 言語でキー集合（配列の長さを含む）が一致する（片方の言語だけ直して他が欠けると、その言語のページが落ちる）
// ② すべての文字列が ICU メッセージとして解釈できる（複数形 {count, plural, …} と <tag> を使うキーがある。
//    アポストロフィを { や < の直前に置くと ICU のエスケープになり壊れる）
// ③ 空リンク href="#" が無い（2026-09 まで予約フォームの「プライバシーポリシー」が href="#" だった）
// ④ プライバシーポリシーのページと、予約フォーム・フッターからの導線がある
// 検出力の確認（2026-09-24）: 合成データ（id だけキー欠落・配列の長さ違い・閉じ忘れの plural・'{ の誤エスケープ・
//   href="#"・導線の欠落）で 6 件すべて FAIL になることを確認した（MESSAGES_DIR / SRC_ROOT で差し替えて実行）。
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { IntlMessageFormat } = require('intl-messageformat')

const messagesDir = process.env.MESSAGES_DIR ?? join(root, 'messages')
const srcRoot = process.env.SRC_ROOT ?? root
const LOCALES = ['ja', 'en', 'id']

let failed = 0
function check(name, fn) {
  try {
    fn()
  } catch (e) {
    failed++
    console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`)
  }
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (Array.isArray(v)) {
      out[`${key}[]`] = v.length
      v.forEach((item, i) => (item && typeof item === 'object' ? flatten(item, `${key}.${i}`, out) : (out[`${key}.${i}`] = item)))
    } else if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = v
  }
  return out
}

const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(JSON.parse(readFileSync(join(messagesDir, `${l}.json`), 'utf8')))]))

check('① 3 言語でキー集合が一致', () => {
  const [base, ...rest] = LOCALES
  for (const l of rest) {
    const a = Object.keys(flat[base]).filter((k) => !(k in flat[l]))
    const b = Object.keys(flat[l]).filter((k) => !(k in flat[base]))
    const len = Object.keys(flat[base]).filter((k) => k.endsWith('[]') && k in flat[l] && flat[base][k] !== flat[l][k])
    assert.deepEqual({ missingIn: a, extraIn: b, lengthDiff: len }, { missingIn: [], extraIn: [], lengthDiff: [] }, `${base} と ${l}`)
  }
})

check('② すべての文字列が ICU として解釈できる', () => {
  const bad = []
  for (const l of LOCALES) {
    for (const [k, v] of Object.entries(flat[l])) {
      if (typeof v !== 'string') continue
      try {
        new IntlMessageFormat(v, l)
      } catch (e) {
        bad.push(`${l} ${k}: ${e.message}`)
      }
      if (/'[{<]/.test(v)) bad.push(`${l} ${k}: アポストロフィが { か < の直前にある`)
    }
  }
  assert.deepEqual(bad, [])
})

function sourceFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p))
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

check('③ 空リンク href="#" が無い', () => {
  const hits = ['app', 'components']
    .flatMap((d) => (existsSync(join(srcRoot, d)) ? sourceFiles(join(srcRoot, d)) : []))
    .filter((f) => /href=(["'])#\1|href=\{(["'])#\2\}/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(hits, [])
})

check('④ プライバシーポリシーのページと導線（予約フォーム・フッター）', () => {
  assert.ok(existsSync(join(srcRoot, 'app/[locale]/privacy/page.tsx')), 'ページが無い')
  for (const f of ['components/pages/ReserveForm.tsx', 'components/common/Footer.tsx']) {
    assert.match(readFileSync(join(srcRoot, f), 'utf8'), /href="\/privacy"/, `${f} に /privacy へのリンクが無い`)
  }
  for (const l of LOCALES) assert.ok(flat[l]['Privacy.sections[]'] > 0, `${l} に Privacy.sections が無い`)
})

if (failed) {
  console.error(`messages: ${failed} 件 FAILED`)
  process.exit(1)
}
console.log('messages: ALL ASSERTIONS PASSED')
