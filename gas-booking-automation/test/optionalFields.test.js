// 任意項目（電話・国籍・滞在目的）の記帳（2026-09-24 オーナー決定: 任意にして、実際に記録する）。test/run.sh から実行される。
// 守ること:
//   - doPost は phone・nationality・stay_purposes を P・Q・R 列に記帳する。無い・空は空欄で旗なし（任意項目）
//   - phone は先頭に ' を付けて文字列として記帳する（Sheets が 0 始まりや + 付きの番号を数値に変えて桁を落とさないように）
//   - GAS は直接の POST も受けるので再検証する。不正な値は記帳せず空欄にし、旗を立てる（旗付きは自動送信せず下書き）
//     phone は route と同じ規則（lib/phone.ts）。nationality・stay_purposes は形だけを見る（列挙の正本は messages/*.json で、
//     route が照合する。GAS に一覧を複製しない＝貼り直し忘れで正当な問い合わせを旗付きにしない）。messages の全値が通ることも確かめる
//   - 担当者への通知には入れる。WhatsApp 文面には入れない
// 検出力の確認（2026-09-24）: 変更前の src（32706ad）をビルドして GAS_BUILD_DIR で実行し、26 件中 23 件が落ちることを確認した
//   ― 記帳 5 件（P・Q・R 列に何も書かない）、不正な値 16 件（その値を記帳しない・旗を立てる、のどちらも無い）、担当者への
//   通知 1 件、lib/phone.ts との一致 1 件（lib/phone.ts が無い）。変更前も通る 3 件: messages の国籍キー・messages の滞在目的
//   （旗なし）・WhatsApp 文面に入れない（誤検知しないこと・入れてはいけない場所の回帰検査）。
const assert = require('assert');
const { readFileSync } = require('fs');
const { join } = require('path');

const SECRET = 'x'.repeat(40);
const TZ = 'Asia/Tokyo';
const HEADER = ['ID', 'Timestamp', 'Name', 'Email', 'Language', 'CheckIn', 'CheckOut', 'RoomType', 'Guests', 'Remarks', 'PeriodCategory', 'IrregularFlag', 'Status', 'WhatsAppText', 'MessageId', 'Phone', 'Nationality', 'StayPurposes', 'AnonymizedAt'];
const COL = { TS: 1, FLAG: 11, STATUS: 12, WA: 13, PHONE: 15, NAT: 16, PURPOSES: 17 }; // 0 始まり
const OWNER = 'owner@example.com';
const REPO = join(__dirname, '..', '..');

let inquiries, calls;
function reset() {
  inquiries = [HEADER.slice()];
  calls = { sent: [], drafts: [] };
}
const inquiriesSheet = {
  getLastRow: () => inquiries.length,
  getLastColumn: () => HEADER.length,
  appendRow: (row) => { inquiries.push(row.slice()); },
  getDataRange: () => ({ getValues: () => inquiries.map((r) => r.slice()) }),
  getRange: (r, c) => ({
    getValues: () => [inquiries[r - 1].slice()],
    setValue: (v) => { inquiries[r - 1][c - 1] = v; },
  }),
};
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (n) => (n === 'Inquiries' ? inquiriesSheet
      : n === 'Settings' ? { getDataRange: () => ({ getValues: () => [['Key', 'Value'], ['NOTIFICATION_EMAIL', OWNER]] }) }
        : null),
  }),
};
global.GmailApp = {
  sendEmail: (to, subject, body) => calls.sent.push({ to, subject, body }),
  createDraft: (to, subject, body) => calls.drafts.push({ to, subject, body }),
};
global.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k === 'WEBHOOK_SECRET' ? SECRET : null) }) };
global.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ body: JSON.parse(s), setMimeType() { return this; } }) };
global.Utilities = {
  sleep: () => {},
  formatDate: (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
};
global.Session = { getScriptTimeZone: () => TZ };
console.warn = () => {}; console.error = () => {};

const { doPost } = require(process.env.GAS_BUILD_DIR + '/Main');
const { EmailService } = require(process.env.GAS_BUILD_DIR + '/EmailService');

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

const DAY = 864e5;
const isoDay = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const base = { name: 'Synthetic', email: 'synthetic@example.com', language: 'en', checkin: isoDay(40), checkout: isoDay(70), room: 'Villa', room_id: 'villa', guests: 2, notes: '', webhook_secret: SECRET };
const post = (obj) => doPost({ postData: { contents: JSON.stringify(obj) } }).body;
const lastRow = () => inquiries[inquiries.length - 1];
const withFields = { ...base, phone: '+62 812-3456-7890', nationality: 'ID', stay_purposes: ['Remote work', 'Surfing'] };

// ---------------------------------------------------------------- 記帳
t('記帳: phone・nationality・stay_purposes を P・Q・R 列に入れる（旗なし）', () => {
  reset();
  assert.strictEqual(post(withFields).success, true);
  assert.strictEqual(lastRow()[COL.PHONE], "'+62 812-3456-7890");
  assert.strictEqual(lastRow()[COL.NAT], 'ID');
  assert.strictEqual(lastRow()[COL.PURPOSES], 'Remote work, Surfing');
  assert.strictEqual(lastRow()[COL.FLAG], 'なし');
});
t("記帳: 0 始まりの番号も ' 付きの文字列（数値にして先頭の 0 を落とさせない）", () => {
  reset();
  post({ ...base, phone: '081234567890' });
  assert.strictEqual(lastRow()[COL.PHONE], "'081234567890");
});
t('記帳: 任意項目が無い → 空欄・旗なし', () => {
  reset();
  post(base);
  assert.deepStrictEqual([lastRow()[COL.PHONE], lastRow()[COL.NAT], lastRow()[COL.PURPOSES]], ['', '', '']);
  assert.strictEqual(lastRow()[COL.FLAG], 'なし');
});
t('記帳: 任意項目が空（回答しない）→ 空欄・旗なし', () => {
  reset();
  post({ ...base, phone: '', nationality: '', stay_purposes: [] });
  assert.deepStrictEqual([lastRow()[COL.PHONE], lastRow()[COL.NAT], lastRow()[COL.PURPOSES]], ['', '', '']);
  assert.strictEqual(lastRow()[COL.FLAG], 'なし');
});
t('記帳: phone の前後の空白は落とす', () => {
  reset();
  post({ ...base, phone: '  (03) 1234.5678 ' });
  assert.strictEqual(lastRow()[COL.PHONE], "'(03) 1234.5678");
  assert.strictEqual(lastRow()[COL.FLAG], 'なし');
});

// ---------------------------------------------------------------- 直接の POST の不正な値 → 空欄＋旗
const badValues = [
  ['phone', '090-CALL-ME', /電話/],
  ['phone', '=HYPERLINK("http://spam.example","x")', /電話/],
  ['phone', '1'.repeat(31), /電話/],
  ['phone', '090\n1234', /電話/],
  ['phone', 819000000000, /電話/],
  ['nationality', 'Japan', /国籍/],
  ['nationality', '=1+1', /国籍/],
  ['nationality', 42, /国籍/],
  ['nationality', ['JP'], /国籍/],
  ['stay_purposes', 'Remote work', /滞在目的/],
  ['stay_purposes', ['Surfing', 'Surfing'], /滞在目的/],
  ['stay_purposes', [42], /滞在目的/],
  ['stay_purposes', ['=cmd|x'], /滞在目的/],
  ['stay_purposes', ['Visit http://spam.example'], /滞在目的/],
  ['stay_purposes', ['x'.repeat(61)], /滞在目的/],
  ['stay_purposes', Array.from({ length: 11 }, (_, k) => `p${k}`), /滞在目的/],
];
const colOf = { phone: COL.PHONE, nationality: COL.NAT, stay_purposes: COL.PURPOSES };
for (const [field, value, flagRe] of badValues) {
  const shown = JSON.stringify(value);
  t(`不正な ${field}（${shown.length > 30 ? shown.slice(0, 30) + '…' : shown}）→ 記帳はするが値は空欄・旗を立てる`, () => {
    reset();
    assert.strictEqual(post({ ...base, [field]: value }).success, true, '記帳はする');
    assert.strictEqual(inquiries.length, 2);
    assert.strictEqual(lastRow()[colOf[field]], '', '不正な値を記帳した');
    assert.match(String(lastRow()[COL.FLAG]), flagRe);
  });
}

// ---------------------------------------------------------------- 正本（lib/phone.ts・messages）との一致
t('電話番号の判定は route・フォームと同じ（lib/phone.ts の isValidPhone と一致）', () => {
  const ts = require(join(REPO, 'node_modules', 'typescript'));
  const src = readFileSync(join(REPO, 'lib', 'phone.ts'), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const lib = { exports: {} };
  new Function('require', 'module', 'exports', out)(require, lib, lib.exports);
  const samples = ['', ' ', '+62 812-3456-7890', '(03) 1234.5678', '081234567890', '1'.repeat(30), '1'.repeat(31), ` ${'1'.repeat(30)} `,
    'abc', '=1+1', '@SUM(1)', '090\t1234', '０９０', '090_1234', '090/1234', '#090', '+1+2', '-1'];
  for (const s of samples) {
    reset();
    post({ ...base, phone: s });
    const gasOk = !/電話/.test(String(lastRow()[COL.FLAG]));
    assert.strictEqual(gasOk, lib.exports.isValidPhone(s.trim()), `phone ${JSON.stringify(s)}: GAS ${gasOk ? '通す' : '旗'}・lib ${gasOk ? '拒否' : '許可'}`);
  }
});
t('messages/*.json の国籍キーはすべて旗なしで記帳される（GAS の形の検査が正当な値を落とさない）', () => {
  for (const lang of ['ja', 'en', 'id']) {
    for (const code of Object.keys(JSON.parse(readFileSync(join(REPO, 'messages', `${lang}.json`), 'utf8')).Reserve.nationalities)) {
      reset();
      post({ ...base, nationality: code });
      assert.strictEqual(lastRow()[COL.FLAG], 'なし', `${lang} ${code}`);
    }
  }
});
t('messages/*.json の滞在目的（全ラベル）は旗なしで記帳される', () => {
  for (const lang of ['ja', 'en', 'id']) {
    const all = JSON.parse(readFileSync(join(REPO, 'messages', `${lang}.json`), 'utf8')).Reserve.purposes;
    reset();
    post({ ...base, language: lang, stay_purposes: all });
    assert.strictEqual(lastRow()[COL.FLAG], 'なし', lang);
  }
});

// ---------------------------------------------------------------- 出し先
t('WhatsApp 文面に電話・国籍・滞在目的を入れない', () => {
  reset();
  post(withFields);
  const wa = String(lastRow()[COL.WA]);
  for (const s of ['812-3456', 'Nationality', 'Remote work', 'Surfing']) assert.ok(!wa.includes(s), `WhatsApp 文面に ${s}`);
});
t('担当者への通知（一次返信時）に電話・国籍・滞在目的を入れる（電話の先頭の \' は付けない）', () => {
  reset();
  post(withFields);
  lastRow()[COL.TS] = new Date(Date.now() - 20 * 60e3); // 15 分の待ちを過ぎた扱い
  EmailService.sendAutoReplies();
  const notice = calls.sent.find((s) => s.to === OWNER);
  assert.ok(notice, '担当者への通知が無い');
  assert.match(notice.body, /: \+62 812-3456-7890$/m);
  assert.match(notice.body, /Nationality: ID$/m);
  assert.match(notice.body, /: Remote work, Surfing$/m);
});

console.log(`optionalFields: ${total - failures.length}/${total} passed`);
if (failures.length) {
  console.log(`optionalFields: ${failures.length} 件 FAILED`);
  process.exit(1);
}
console.log('optionalFields: ALL ASSERTIONS PASSED');
