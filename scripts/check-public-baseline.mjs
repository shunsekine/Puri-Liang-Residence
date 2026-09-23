#!/usr/bin/env node
/**
 * 公開物の最低ライン（AGENTS.md §11・PUBLIC_BASELINE.md・WO-PB-3）のうち、字句と成果物で見られるものを機械チェックする。
 *
 * 使い方（リポジトリのルートから）:
 *   node scripts/check-public-baseline.mjs               # 静的検査 A〜C。不備があれば exit 1
 *   node scripts/check-public-baseline.mjs --self-test   # 合成データで検出力を確認。穴があれば exit 1
 *   node scripts/check-public-baseline.mjs --bundle .next/static   # 成果物検査 D のみ（npm run build の postbuild）
 *
 * なぜ要るか: このリポは **Public**。1 コミットで秘密を追跡した瞬間に世界へ配られ、履歴から消せない。
 *   また GAS の Web アプリ URL は「全員（匿名）」に公開されているので、URL 自体を秘密として扱い（転送は server 側の
 *   app/api/reserve/route.ts だけ）、加えて共有秘密 GAS_WEBHOOK_SECRET で守る（検証は tests/reserve-route.test.mjs と
 *   gas-booking-automation/test/doPost.test.js）。どちらも見た目には何も変わらずに崩れるので、文書ではなくここで止める。
 *
 * 検査:
 *   A 追跡ファイルの秘密スキャン: 鍵らしい文字列・GAS Web アプリの実 URL・禁止ファイル名（.env*・*.pem）、.gitignore の `.env*`
 *   B ブラウザへ届く環境変数: NEXT_PUBLIC_ は allowlist のみ／それ以外の process.env は SERVER_ONLY_DIRS の中だけ・
 *     'use client' では不可／process.env[...] の動的参照は不可／next.config の env: で NEXT_PUBLIC_ 以外を露出しない
 *   C ログに PII を書かない（§11 ⑤）: server 側（app/api・GAS）の console.* が本文・メール・氏名・備考を参照しない
 *   D 成果物（ブラウザに配る .next/static）に秘密の値・名前・GAS の実 URL が無い
 *
 * 限界: A は字句でしか探せない（組み立てた鍵・未知の形式は漏れる）。B は import 経由で client に入る server モジュールを
 *   見ない（Next のバンドラ判定。D が成果物側で補う）。D は環境に値がある秘密しか探せない（Vercel のビルドでは本番の値がある）。
 *   C は識別子名での判定で、別名に代入してから出力すれば素通りする。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

/** ブラウザへ配ってよい環境変数（NEXT_PUBLIC_ を除いた名前）。増やす＝「配る」宣言なので、このファイルの編集＝レビューを伴う。 */
export const NEXT_PUBLIC_ALLOWLIST = new Set(['BASE_URL', 'GA_ID', 'CLARITY_ID'])
/** NEXT_PUBLIC_ 以外の process.env を読んでよい場所（server 専用）。 */
export const SERVER_ONLY_DIRS = ['app/api/']
/** B・C の走査対象（Next のソース）。 */
const SOURCE_DIRS = ['app', 'components', 'lib']
const SOURCE_ROOT_FILES = ['middleware.ts', 'i18n.ts', 'navigation.ts']
/** C の走査対象（server 側でログを書く場所）。 */
const LOG_DIRS = ['app/api', 'gas-booking-automation/src']
/** D で値と名前を必ず探す秘密（名前の規則に合わなくても）。 */
export const ALWAYS_SECRET_NAMES = ['GAS_WEBHOOK_URL', 'GAS_WEBHOOK_SECRET']
export const SECRET_NAME_RE = /(SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE|API_KEY|_KEY|WEBHOOK_URL)$/i

/** GAS Web アプリの実 URL（デプロイ ID は AKfy で始まる長い英数字）。README の `<YOUR_SCRIPT_ID>` は対象外。 */
const GAS_URL_RE = /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,}/
const SECRET_PATTERNS = [
  ['秘密鍵ブロック', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['GitHub トークン', /\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['AWS アクセスキー', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack トークン', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Webhook/Resend 系の秘密', /\b(whsec_[A-Za-z0-9+/=]{10,}|re_[A-Za-z0-9]{20,})\b/],
  ['Stripe 系の秘密', /\bsk_(live|test)_[A-Za-z0-9]{8,}/],
  ['Google API キー', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ['GAS Web アプリの実 URL', GAS_URL_RE],
  ['Web3Forms アクセスキー（UUID 形式の access_key）', /access_key["'\s:=]+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i],
]
const FORBIDDEN_NAMES = /^(\.env|\.env\..+|.*\.pem|.*\.p12|id_rsa|id_ed25519|\.clasprc\.json)$/
const A_SKIP_NAMES = new Set(['package-lock.json'])
const A_MAX_BYTES = 2 * 1024 * 1024

/** C: server 側ログに出してはならない識別子（問い合わせ本文と個人情報）。 */
const PII_IDENT_RE = /\b(body|payload|email|remarks|notes|phone|whatsapp|inquiry(?!\.id\b)|row|guest|name)\b/i

const toPosix = (p) => p.split(sep).join('/')

function* walk(dir) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(name)) continue
      yield* walk(full)
    } else {
      yield full
    }
  }
}

const listFiles = (root) => [...walk(root)].map((f) => toPosix(relative(root, f)))
const trackedFiles = (root) =>
  execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)

const isText = (buf) => !buf.subarray(0, 8192).includes(0)
const lineOf = (text, index) => text.slice(0, index).split('\n').length

// ---------------------------------------------------------------- A
export function checkA(root, files) {
  const errs = []
  for (const rel of files) {
    const base = rel.split('/').pop()
    if (FORBIDDEN_NAMES.test(base)) errs.push(`[A] 追跡してはいけないファイル名: ${rel}`)
    const p = join(root, rel)
    if (A_SKIP_NAMES.has(base) || !existsSync(p) || !statSync(p).isFile() || statSync(p).size > A_MAX_BYTES) continue
    const buf = readFileSync(p)
    if (!isText(buf)) continue
    const text = buf.toString('utf8')
    for (const [what, re] of SECRET_PATTERNS) {
      const m = re.exec(text)
      if (m) errs.push(`[A] ${rel}:${lineOf(text, m.index)} に${what}らしき文字列`)
    }
  }
  const gi = join(root, '.gitignore')
  if (!existsSync(gi)) errs.push('[A] .gitignore が無い')
  else if (!readFileSync(gi, 'utf8').split('\n').some((l) => l.trim() === '.env*')) errs.push('[A] .gitignore に `.env*` の行が無い')
  return errs
}

// ---------------------------------------------------------------- B
const isClientModule = (src) => /^\s*['"]use client['"]/.test(src.replace(/^(\s*(\/\*[\s\S]*?\*\/|\/\/[^\n]*\n))*/, ''))

function sourceFiles(root) {
  const out = []
  for (const d of SOURCE_DIRS) for (const f of walk(join(root, d))) if (/\.(ts|tsx|js|jsx|mjs)$/.test(f)) out.push(toPosix(relative(root, f)))
  for (const f of SOURCE_ROOT_FILES) if (existsSync(join(root, f))) out.push(f)
  return out
}

export function checkB(root) {
  const errs = []
  for (const rel of sourceFiles(root)) {
    const text = readFileSync(join(root, rel), 'utf8')
    const client = isClientModule(text)
    const serverOnly = !client && SERVER_ONLY_DIRS.some((d) => rel.startsWith(d))
    text.split('\n').forEach((line, i) => {
      const at = `${rel}:${i + 1}`
      for (const m of line.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        const name = m[1]
        if (name.startsWith('NEXT_PUBLIC_')) {
          if (!NEXT_PUBLIC_ALLOWLIST.has(name.slice('NEXT_PUBLIC_'.length)))
            errs.push(`[B] ${at} ${name} は NEXT_PUBLIC_ALLOWLIST に無い（ブラウザへ配る変数を増やすなら allowlist を編集する）`)
        } else if (!serverOnly) {
          errs.push(`[B] ${at} process.env.${name} を server 専用の場所（${SERVER_ONLY_DIRS.join(', ')}）以外で読んでいる`)
        }
      }
      if (/process\.env\s*\[/.test(line)) errs.push(`[B] ${at} process.env[...] の動的参照は不可（何が読まれるか検査できない）`)
    })
  }
  for (const name of ['next.config.ts', 'next.config.mjs', 'next.config.js']) {
    const cfg = join(root, name)
    if (!existsSync(cfg)) continue
    const m = readFileSync(cfg, 'utf8').match(/\benv\s*:\s*\{([^}]*)\}/)
    if (!m) continue
    for (const k of m[1].matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g))
      if (!k[1].startsWith('NEXT_PUBLIC_')) errs.push(`[B] ${name} の env: が ${k[1]} をクライアントバンドルへ埋め込む`)
  }
  return errs
}

// ---------------------------------------------------------------- C
/** 文字列リテラルの中身を消し、テンプレートの ${...} だけ残す（ログ文言中の単語を誤検出しないため）。 */
function codeOnly(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const q = s[i]
    if (q !== '"' && q !== "'" && q !== '`') { out += q; continue }
    let j = i + 1
    while (j < s.length && s[j] !== q) {
      if (s[j] === '\\') { j += 2; continue }
      if (q === '`' && s[j] === '$' && s[j + 1] === '{') {
        let depth = 1, k = j + 2
        while (k < s.length && depth) { if (s[k] === '{') depth++; else if (s[k] === '}') depth--; k++ }
        out += ' ' + s.slice(j + 2, k - 1) + ' '
        j = k
        continue
      }
      j++
    }
    i = j
  }
  return out
}

export function checkC(root) {
  const errs = []
  for (const d of LOG_DIRS) {
    for (const f of walk(join(root, d))) {
      if (!/\.(ts|tsx|js|mjs)$/.test(f)) continue
      const rel = toPosix(relative(root, f))
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const at = line.search(/\b(console\.\w+|Logger\.log)\s*\(/)
        if (at < 0) return
        const m = codeOnly(line.slice(at).replace(/^(console\.\w+|Logger\.log)/, '')).match(PII_IDENT_RE)
        if (m) errs.push(`[C] ${rel}:${i + 1} ログが「${m[1]}」を出力している（問い合わせ本文・個人情報はログに書かない。ID だけにする）`)
      })
    }
  }
  return errs
}

// ---------------------------------------------------------------- D
export function parseEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

export function collectSecrets(env) {
  const out = {}
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('NEXT_PUBLIC_')) continue
    if (!(SECRET_NAME_RE.test(name) || ALWAYS_SECRET_NAMES.includes(name))) continue
    if (typeof value === 'string' && value.length >= 12) out[name] = value
  }
  return out
}

export function checkD(bundleDir, secrets) {
  if (!existsSync(bundleDir)) return [`[D] 成果物ディレクトリ ${bundleDir} が無い（npm run build の後に呼ぶ）`]
  const errs = []
  const names = new Set([...Object.keys(secrets), ...ALWAYS_SECRET_NAMES])
  for (const f of walk(bundleDir)) {
    const buf = readFileSync(f)
    if (!isText(buf)) continue
    const text = buf.toString('utf8')
    const rel = toPosix(relative(process.cwd(), f))
    for (const [name, value] of Object.entries(secrets)) if (text.includes(value)) errs.push(`[D] ${rel} に ${name} の値が含まれる`)
    for (const name of names) if (text.includes(name)) errs.push(`[D] ${rel} に ${name} という名前が含まれる（server コードがバンドルされた兆候）`)
    if (GAS_URL_RE.test(text)) errs.push(`[D] ${rel} に GAS Web アプリの実 URL が含まれる`)
  }
  return errs
}

// ---------------------------------------------------------------- self-test
const W = (root, rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text) }

/** 現行リポと同じ形の正常フィクスチャ。 */
function cleanRepo(root) {
  W(root, '.gitignore', '/node_modules\n.env*\n')
  W(root, 'app/api/reserve/route.ts', "const u = process.env.GAS_WEBHOOK_URL;\nconst s = process.env.GAS_WEBHOOK_SECRET;\nconsole.error('[API] Error proxying to GAS:', error);\nconsole.warn('[API] GAS_WEBHOOK_URL is not set');\n")
  W(root, 'app/[locale]/layout.tsx', "const b = process.env.NEXT_PUBLIC_BASE_URL;\nconst g = process.env.NEXT_PUBLIC_GA_ID;\n")
  W(root, 'components/pages/ReserveForm.tsx', "'use client';\nfetch('/api/reserve');\n")
  W(root, 'gas-booking-automation/src/EmailService.ts', "console.error(`[sendAutoReplies] row ${rowNum} (${id}) failed: ${message}`);\nconsole.error(`Template not found: ${templateId}`);\n")
  W(root, 'gas-booking-automation/README.md', 'GAS_WEBHOOK_URL=https://script.google.com/macros/s/<YOUR_SCRIPT_ID>/exec\n')
  W(root, 'next.config.mjs', 'const nextConfig = {};\n')
  W(root, 'bundle/chunk.js', 'fetch("/api/reserve")\n')
}

// 合成の秘密は連結で組み立てる（本ファイル自身が検査 A に引っかからないように）
const FAKE_GAS_URL = 'https://script.google.com/macros/s/' + 'AKfycb' + 'x'.repeat(60) + '/exec'
const FAKE_SECRET = 'f'.repeat(48)
const FAKE_ENV = { GAS_WEBHOOK_URL: FAKE_GAS_URL, GAS_WEBHOOK_SECRET: FAKE_SECRET, NEXT_PUBLIC_BASE_URL: 'https://example.invalid' }

const CASES = [
  ['A', 'GAS の実 URL をコミット', (r) => W(r, 'README.md', `GAS_WEBHOOK_URL=${FAKE_GAS_URL}\n`)],
  ['A', '.env.local を追跡', (r) => W(r, '.env.local', 'X=1\n')],
  ['A', '秘密鍵ブロック', (r) => W(r, 'lib/k.ts', '-----BEGIN ' + 'PRIVATE KEY-----\n')],
  ['A', 'JWT', (r) => W(r, 'lib/j.ts', 'const t = "eyJ' + 'hbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.abcdefghijk";\n')],
  ['A', 'Web3Forms キー直書き', (r) => W(r, 'lib/w.ts', 'const body = { access_key: "' + '12345678-1234-1234-1234-123456789abc" };\n')],
  ['A', '.gitignore から .env* を削除', (r) => W(r, '.gitignore', '/node_modules\n')],
  ['B', "'use client' で秘密を読む", (r) => W(r, 'components/pages/ReserveForm.tsx', "'use client';\nconst s = process.env.GAS_WEBHOOK_SECRET;\n")],
  ['B', 'server 専用外（ページ）で秘密を読む', (r) => W(r, 'app/[locale]/page.tsx', 'const u = process.env.GAS_WEBHOOK_URL;\n')],
  ['B', "app/api 配下でも 'use client' なら不可", (r) => W(r, 'app/api/x/c.tsx', "'use client';\nconst u = process.env.GAS_WEBHOOK_URL;\n")],
  ['B', 'allowlist 外の NEXT_PUBLIC_', (r) => W(r, 'lib/data.ts', 'const k = process.env.NEXT_PUBLIC_GAS_WEBHOOK_URL;\n')],
  ['B', 'process.env の動的参照', (r) => W(r, 'lib/data.ts', "const k = process.env['GAS_' + 'WEBHOOK_URL'];\n")],
  ['B', 'next.config の env: で露出', (r) => W(r, 'next.config.mjs', 'const nextConfig = { env: { GAS_WEBHOOK_URL: process.env.GAS_WEBHOOK_URL } };\n')],
  ['C', 'route が本文をログ', (r) => W(r, 'app/api/reserve/route.ts', "console.log('[API] body', body);\n")],
  ['C', 'GAS がメールをテンプレートでログ', (r) => W(r, 'gas-booking-automation/src/EmailService.ts', 'console.error(`failed for ${inquiry.email}`);\n')],
  ['C', 'GAS が payload をログ', (r) => W(r, 'gas-booking-automation/src/Main.ts', "console.log('[doPost] got', JSON.stringify(payload));\n")],
  ['D', '成果物に GAS URL の値', (r) => W(r, 'bundle/chunk.js', `fetch(${JSON.stringify(FAKE_GAS_URL)})\n`)],
  ['D', '成果物に共有秘密の値', (r) => W(r, 'bundle/chunk.js', `const s="${FAKE_SECRET}"\n`)],
  ['D', '成果物に秘密の変数名', (r) => W(r, 'bundle/chunk.js', 'process.env.GAS_WEBHOOK_SECRET\n')],
]

function runCheck(key, root) {
  if (key === 'A') return checkA(root, listFiles(root).filter((f) => !f.startsWith('bundle/')))
  if (key === 'B') return checkB(root)
  if (key === 'C') return checkC(root)
  return checkD(join(root, 'bundle'), collectSecrets(FAKE_ENV))
}

function selfTest() {
  const failures = []
  const withRepo = (fn) => {
    const root = mkdtempSync(join(tmpdir(), 'pb-selftest-'))
    try { cleanRepo(root); return fn(root) } finally { rmSync(root, { recursive: true, force: true }) }
  }
  for (const key of ['A', 'B', 'C', 'D']) {
    const errs = withRepo((r) => runCheck(key, r))
    if (errs.length) failures.push(`${key} 正常フィクスチャで NG: ${errs.join(' / ')}`)
  }
  for (const [key, name, mutate] of CASES) {
    const errs = withRepo((r) => { mutate(r); return runCheck(key, r) })
    if (!errs.length) failures.push(`${key} 「${name}」を検出できない`)
    else console.log(`[検出] ${key} ${name}: ${errs[0]}`)
  }
  if (failures.length) {
    console.error('★検出力に穴あり:\n' + failures.map((f) => '  - ' + f).join('\n'))
    return 1
  }
  console.log(`自己テストOK: 正常 4 / 不正 ${CASES.length} ケースを判定できた`)
  return 0
}

// ---------------------------------------------------------------- main
function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const bi = argv.indexOf('--bundle')
  if (bi >= 0) {
    const env = { ...parseEnvFile(join(REPO, '.env.local')), ...process.env }
    const errs = checkD(argv[bi + 1], collectSecrets(env))
    if (errs.length) { console.error('★ブラウザ向け成果物に秘密:\n' + errs.join('\n')); return 1 }
    console.log(`check-public-baseline: D OK（${argv[bi + 1]}・探した秘密 ${Object.keys(collectSecrets(env)).length} 件）`)
    return 0
  }
  const errs = [...checkA(REPO, trackedFiles(REPO)), ...checkB(REPO), ...checkC(REPO)]
  if (errs.length) { console.error('★公開物の最低ラインに不備:\n' + errs.join('\n')); return 1 }
  console.log('check-public-baseline: A/B/C OK（③ 追跡ファイル・ブラウザへ届く環境変数、⑤ ログの PII）')
  return 0
}

process.exit(main(process.argv.slice(2)))
