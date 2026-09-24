// 顧客へのメールの文面（src/Templates.ts）とその選び方。test/run.sh から実行される。
// 経緯: 文面は 2026-09-24 まで Templates シートにあり、事業ルールとのずれ（キャンセル 3 日前・電気の実費精算）、_id の行の欠落
//   （インドネシア語の問い合わせに一次返信が出なかった）、見出し行が無いことによる 1 行目の読み飛ばし（日本語の一次返信が
//   止まっていた）が起きた。2026-09-24 にコードへ移した（シートの文面をそのまま移し、全 15 件が一致することを確認済み）。
// 守ること:
//   ① 全種類（1MonthLater・1MonthWithin・Available・Full・AcceptWaiting）× ja・en・id の件名と本文がある。前後の空白・タブが無い
//   ② 差し込み文字は {ID} {Name} {CheckIn} {CheckOut} {RoomType} {Guests} だけ（綴りを誤ると顧客に {Nmae} のまま届く）。
//      差し込んだ後に { } が残らない
//   ③ 事業ルールの値が lib/data.ts と一致する（空室の案内に、デポジット DEPOSIT_IDR・電気の目安 SIMULATOR_DEFAULTS.electricityIDR・
//      全額返金の日数 CANCELLATION）。デポジットはサイトの文言（messages/*.json）にも同じ額がある。規約へのリンクは
//      その言語の /faq#terms で、FAQ ページに id="terms" がある
//   ④ Templates シートは読まない（正本はコード。シートが残っていても、消えていても動く）
//   ⑤ 言語の文面を使う。ja・en・id 以外は英語で代用し、担当者へ伝える（一次返信: 担当者への通知に 1 行。最終回答: ステータスの
//      セルのメモに日付付きで 1 行。担当者が手で書いたメモは消さない）。constructor 等のプロトタイプのキーも英語
//   ⑥ 最終回答の下書きを作れない（Gmail の失敗）: 分かる文言で例外・ステータスは担当者が選んだまま・セルにメモ
//   ⑦ Main は onEdit という名前の関数を公開しない（シンプルトリガーとして動くと Gmail を呼べず、インストール型と二重にも動く）
// 検出力の確認（2026-09-24）: 変更前の src（96f449d。文面はシートから読む）をビルドして GAS_BUILD_DIR で実行し、30 件中 28 件が
//   落ちることを確認した（Templates モジュールが無い・シートを読む・ステータスのメモの文言）。変更前も通る 2 件: ⑥ の例外とメモ、
//   ⑦ onEdit を公開しない（どちらも従来の挙動の回帰検査）。③ は DEPOSIT_IDR を 2500000 に・全額返金を 14 日前に変えた lib/data.ts（DATA_TS）で、それぞれ FAIL を確認した。
const assert = require('assert');
const { readFileSync } = require('fs');
const { join } = require('path');

const REPO = join(__dirname, '..', '..');
const TZ = 'Asia/Tokyo';
const HEADER = ['ID', 'Timestamp', 'Name', 'Email', 'Language', 'CheckIn', 'CheckOut', 'RoomType', 'Guests', 'Remarks', 'PeriodCategory', 'IrregularFlag', 'Status', 'WhatsAppText', 'MessageId', 'Phone', 'Nationality', 'StayPurposes', 'AnonymizedAt'];
const COL = { STATUS: 12 }; // 0 始まり
const STATUS_COLUMN = 13; // M（1 始まり）
const OWNER = 'owner@example.com';
const DAY = 864e5;
const KINDS = ['1MonthLater', '1MonthWithin', 'Available', 'Full', 'AcceptWaiting'];
const LANGS = ['ja', 'en', 'id'];
const PLACEHOLDERS = ['ID', 'Name', 'CheckIn', 'CheckOut', 'RoomType', 'Guests'];

let inquiries, calls, notes, draftError;
const now = Date.now();
const row = (id, language, { flag = 'なし', status = '1次送信待ち', period = '1ヶ月以上先' } = {}) =>
  [id, new Date(now - 20 * 60e3), 'Guest ' + id, id.toLowerCase() + '@example.com', language, new Date(now + 40 * DAY), new Date(now + 70 * DAY), 'Villa', 2, '', period, flag, status, '', 'WEB-' + id, '', '', '', ''];
function reset(rows) {
  inquiries = [HEADER.slice(), ...rows];
  calls = { sent: [], drafts: [] };
  notes = {};
  draftError = null;
}
const inquiriesSheet = {
  getLastRow: () => inquiries.length,
  getLastColumn: () => HEADER.length,
  getDataRange: () => ({ getValues: () => inquiries.map((r) => r.slice()) }),
  getRange: (r, c) => ({
    getValues: () => [inquiries[r - 1].slice()],
    setValue: (v) => { inquiries[r - 1][c - 1] = v; },
    getNote: () => notes[`${r},${c}`] ?? '',
    setNote: (n) => { notes[`${r},${c}`] = n; },
  }),
};
let templatesSheetRead = 0;
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (n) => {
      if (n === 'Templates') {
        templatesSheetRead++;
        // 読まれたら、シートの古い文面が使われたと分かる値を返す
        return { getDataRange: () => ({ getValues: () => KINDS.flatMap((k) => LANGS.map((l) => [`${k}_${l}`, 'SHEET subject', 'SHEET body'])) }) };
      }
      return n === 'Inquiries' ? inquiriesSheet
        : n === 'Settings' ? { getDataRange: () => ({ getValues: () => [['Key', 'Value'], ['NOTIFICATION_EMAIL', OWNER]] }) }
          : null;
    },
  }),
};
global.GmailApp = {
  sendEmail: (to, subject, body) => calls.sent.push({ to, subject, body }),
  createDraft: (to, subject, body) => {
    if (draftError) throw new Error(draftError);
    calls.drafts.push({ to, subject, body });
  },
};
global.Utilities = {
  sleep: () => {},
  formatDate: (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
};
global.Session = { getScriptTimeZone: () => TZ };
console.warn = () => {}; console.error = () => {};

const Main = require(process.env.GAS_BUILD_DIR + '/Main');
const { onStatusEdit } = Main;
const { EmailService } = require(process.env.GAS_BUILD_DIR + '/EmailService');
let MAIL_TEMPLATES = {};
try {
  ({ MAIL_TEMPLATES } = require(process.env.GAS_BUILD_DIR + '/Templates'));
} catch (e) {
  console.log(`Templates モジュールを読めない: ${String(e.message).split('\n')[0]}`);
}
/** lib/data.ts（事業ルールの値の正本）を TS から読む */
function loadData() {
  const ts = require(join(REPO, 'node_modules', 'typescript'));
  const out = ts.transpileModule(readFileSync(process.env.DATA_TS ?? join(REPO, 'lib', 'data.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const lib = { exports: {} };
  new Function('require', 'module', 'exports', out)(require, lib, lib.exports);
  return lib.exports;
}

const failures = [];
let total = 0;
function t(label, fn) {
  total++;
  try {
    fn();
  } catch (e) {
    failures.push(label);
    console.log(`FAIL ${label}: ${String(e.message).split('\n')[0]}`);
  }
}
const tpl = (kind, lang) => (MAIL_TEMPLATES[kind] || {})[lang] || {};
const customerMails = () => calls.sent.filter((s) => s.to !== OWNER);
const ownerMails = () => calls.sent.filter((s) => s.to === OWNER);
const status = (id) => inquiries.find((r) => r[0] === id)[COL.STATUS];
/** 担当者が M 列（Status）を value に変えたときの onStatusEdit（インストール型の編集時トリガー） */
function editStatus(id, value) {
  const rowNum = inquiries.findIndex((r) => r[0] === id) + 1;
  inquiries[rowNum - 1][COL.STATUS] = value;
  return onStatusEdit({ range: { getSheet: () => ({ getName: () => 'Inquiries' }), getRow: () => rowNum, getColumn: () => STATUS_COLUMN }, value });
}
const noteOf = (id) => notes[`${inquiries.findIndex((r) => r[0] === id) + 1},${STATUS_COLUMN}`];
/** EmailService と同じ差し込み（row() の値） */
const filled = (text, id) => text.replace(/{ID}/g, id).replace(/{Name}/g, 'Guest ' + id)
  .replace(/{CheckIn}/g, new Date(now + 40 * DAY).toLocaleDateString()).replace(/{CheckOut}/g, new Date(now + 70 * DAY).toLocaleDateString())
  .replace(/{RoomType}/g, 'Villa').replace(/{Guests}/g, '2');

// ---------------------------------------------------------------- ① ② 文面の形
for (const kind of KINDS) {
  for (const lang of LANGS) {
    t(`① ${kind}_${lang} の件名と本文がある（前後の空白・タブなし）`, () => {
      const { subject, body } = tpl(kind, lang);
      for (const [name, v] of [['件名', subject], ['本文', body]]) {
        assert.ok(typeof v === 'string' && v.length > 0, `${name}が無い`);
        assert.strictEqual(v, v.trim(), `${name}の前後に空白`);
        assert.ok(!v.includes('\t'), `${name}にタブ`);
      }
      assert.ok(!subject.includes('\n'), '件名に改行');
    });
  }
}
t('② 差し込み文字は 6 種類だけ・本文は宛名 {Name} で始まる・一次返信は日程と部屋と人数を入れる', () => {
  const bad = [];
  for (const kind of KINDS) for (const lang of LANGS) {
    const { subject = '', body = '' } = tpl(kind, lang);
    for (const m of `${subject}\n${body}`.matchAll(/{([^{}]*)}/g)) if (!PLACEHOLDERS.includes(m[1])) bad.push(`${kind}_${lang}: {${m[1]}}`);
    if (!/^(Dear |Halo )?{Name}/.test(body)) bad.push(`${kind}_${lang}: 宛名 {Name} で始まらない`);
    if (kind.startsWith('1Month')) for (const p of ['CheckIn', 'CheckOut', 'RoomType', 'Guests']) if (!body.includes(`{${p}}`)) bad.push(`${kind}_${lang}: {${p}} が無い`);
  }
  assert.deepStrictEqual(bad, []);
});

// ---------------------------------------------------------------- ③ 事業ルールの値
t('③ 空室の案内のデポジット・電気の目安・全額返金の日数が lib/data.ts と一致し、デポジットはサイトの文言にもある', () => {
  const data = loadData();
  const fullRefund = data.CANCELLATION.tiers.find((x) => x.refundPct === 100);
  assert.ok(typeof data.DEPOSIT_IDR === 'number', 'lib/data.ts に DEPOSIT_IDR が無い');
  const rp = (lang, n) => `Rp ${new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US').format(n)}`;
  const refund = { ja: `チェックイン${fullRefund.daysBefore}日前まで`, en: `Up to ${fullRefund.daysBefore} days before check-in`, id: `${fullRefund.daysBefore} hari sebelum check-in` };
  const bad = [];
  for (const lang of LANGS) {
    const body = tpl('Available', lang).body || '';
    for (const want of [rp(lang, data.DEPOSIT_IDR), rp(lang, data.SIMULATOR_DEFAULTS.electricityIDR), refund[lang]]) {
      if (!body.includes(want)) bad.push(`Available_${lang} に「${want}」が無い`);
    }
    const site = readFileSync(join(REPO, 'messages', `${lang}.json`), 'utf8');
    if (!site.includes(rp(lang, data.DEPOSIT_IDR))) bad.push(`messages/${lang}.json に「${rp(lang, data.DEPOSIT_IDR)}」が無い`);
  }
  assert.deepStrictEqual(bad, []);
});
t('③ 規約へのリンクはその言語の /faq#terms で、FAQ ページに id="terms" がある', () => {
  for (const lang of LANGS) {
    const urls = (tpl('Available', lang).body || '').match(/https?:\/\/\S+/g) || [];
    assert.deepStrictEqual(urls, [`https://puri-liang-residence.vercel.app/${lang}/faq#terms`], `Available_${lang}`);
  }
  assert.match(readFileSync(join(REPO, 'app', '[locale]', 'faq', 'page.tsx'), 'utf8'), /id="terms"/);
});

// ---------------------------------------------------------------- ④ ⑤ 一次返信
for (const lang of LANGS) {
  t(`④⑤ 一次返信（${lang}）: コードの文面で送り、Templates シートを読まない・代用の注記なし`, () => {
    reset([row('INQ-001', lang)]);
    templatesSheetRead = 0;
    EmailService.sendAutoReplies();
    const want = tpl('1MonthLater', lang);
    assert.deepStrictEqual(customerMails().map((m) => [m.subject, m.body]), [[want.subject, filled(want.body || '', 'INQ-001')]]);
    assert.strictEqual(templatesSheetRead, 0, 'Templates シートを読んだ');
    assert.strictEqual(status('INQ-001'), '1次送信済');
    assert.ok(!/※/.test(ownerMails()[0].body), '代用していないのに注記');
  });
}
t('④⑤ 一次返信: 旗付き（下書き）は 1 ヶ月以内の文面・その言語', () => {
  reset([row('INQ-001', 'id', { flag: '定員超過(上限2名に対し3名)', period: '1ヶ月以内' })]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(calls.drafts.map((d) => d.subject), [`【要確認】${tpl('1MonthWithin', 'id').subject}`]);
  assert.strictEqual(status('INQ-001'), '最終送信待ち');
});
t('⑤ 一次返信: 対応外の言語（fr）は英語で送り、担当者への通知に代用を書く（通知は増やさない）', () => {
  reset([row('INQ-001', 'fr')]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails().map((m) => m.subject), [tpl('1MonthLater', 'en').subject]);
  assert.strictEqual(ownerMails().length, 1);
  assert.match(ownerMails()[0].body, /1MonthLater_fr.*1MonthLater_en/);
});
t('⑤ 一次返信: 言語がプロトタイプのキー（constructor）でも英語', () => {
  reset([row('INQ-001', 'constructor')]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails().map((m) => m.subject), [tpl('1MonthLater', 'en').subject]);
  assert.strictEqual(status('INQ-001'), '1次送信済');
});

// ---------------------------------------------------------------- ④ ⑤ ⑥ 最終回答（onStatusEdit）
const FINAL = { '空室': 'Available', '満室': 'Full', 'キャンセル待ち': 'AcceptWaiting' };
for (const [value, kind] of Object.entries(FINAL)) {
  t(`④⑤ 最終回答（${value}・id）: コードの文面で下書き・最終送信待ち・メモなし・シートを読まない`, () => {
    reset([row('INQ-001', 'id', { status: '1次送信済' })]);
    templatesSheetRead = 0;
    editStatus('INQ-001', value);
    const want = tpl(kind, 'id');
    assert.deepStrictEqual(calls.drafts.map((d) => [d.subject, d.body]), [[`Re: ${want.subject} (INQ-001)`, filled(want.body || '', 'INQ-001')]]);
    assert.strictEqual(templatesSheetRead, 0, 'Templates シートを読んだ');
    assert.strictEqual(status('INQ-001'), '最終送信待ち');
    assert.strictEqual(noteOf('INQ-001'), undefined);
  });
}
t('⑤ 最終回答: 対応外の言語は英語で下書き・セルに代用のメモ・担当者が手で書いたメモは消さない', () => {
  reset([row('INQ-001', 'fr', { status: '1次送信済' })]);
  notes[`2,${STATUS_COLUMN}`] = 'owner memo';
  editStatus('INQ-001', '空室');
  assert.deepStrictEqual(calls.drafts.map((d) => d.subject), [`Re: ${tpl('Available', 'en').subject} (INQ-001)`]);
  assert.match(String(noteOf('INQ-001')), /^owner memo\n\d{4}-\d{2}-\d{2} .*Available_fr.*Available_en/);
});
t('⑥ 最終回答: 下書きを作れない → 例外・ステータスはそのまま・セルに【エラー】のメモ', () => {
  reset([row('INQ-001', 'ja', { status: '1次送信済' })]);
  draftError = 'Service invoked too many times: gmail';
  assert.throws(() => editStatus('INQ-001', '空室'), /too many times/);
  assert.strictEqual(calls.drafts.length, 0);
  assert.strictEqual(status('INQ-001'), '空室', '最終送信待ちにしてはいけない（下書きが無い）');
  assert.match(String(noteOf('INQ-001')), /【エラー】/);
});

// ---------------------------------------------------------------- ⑦
t('⑦ Main は onEdit という名前の関数を公開しない', () => {
  assert.strictEqual(typeof Main.onEdit, 'undefined');
  assert.strictEqual(typeof Main.onStatusEdit, 'function');
});

console.log(`templates: ${total - failures.length}/${total} passed`);
if (failures.length) {
  console.log(`templates: ${failures.length} 件 FAILED`);
  process.exit(1);
}
console.log('templates: ALL ASSERTIONS PASSED');
