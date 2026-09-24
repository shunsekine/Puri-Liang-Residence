// doPost の共有秘密検証（WO-PB-3 / AGENTS.md §11 ③）。test/run.sh から実行される。
// 守ること: Web アプリ URL は「全員（匿名）」に公開されているので、URL を知っているだけでは Inquiries に記帳できない。
//   秘密が無い・違う・長さ違い・スクリプト プロパティ未設定（fail-closed）のいずれでもシートに触れず unauthorized を返す。
// 検出力の確認（2026-09-23）: 検証を足す前の Main.ts（1bf5baf）に対して実行し、ケース 1 で appendRow が呼ばれて落ちることを確認した。
const assert = require('assert');

const SECRET = 'x'.repeat(40);
let scriptProps = {};
const appended = [];
let sheetTouched = 0;
const inquiriesSheet = {
  getLastRow: () => 1 + appended.length,
  appendRow: (row) => appended.push(row),
  getRange: () => ({ setValue: () => {}, setValues: () => {} }),
};
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => {
    sheetTouched++;
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
global.Utilities = { sleep: () => {} };
console.warn = () => {}; console.error = () => {};

const { doPost } = require(process.env.GAS_BUILD_DIR + '/Main');

const future = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
const later = new Date(Date.now() + 70 * 864e5).toISOString().slice(0, 10);
const inquiry = { name: 'Synthetic', email: 'synthetic@example.com', language: 'en', checkin: future, checkout: later, room: 'villa', guests: '2', notes: '' };
const post = (obj) => doPost({ postData: { contents: JSON.stringify(obj) } }).body;

function expectRejected(label, obj) {
  const before = { appended: appended.length, touched: sheetTouched };
  const res = post(obj);
  assert.deepStrictEqual(res, { success: false, error: 'unauthorized' }, `${label}: unauthorized を返す`);
  assert.strictEqual(appended.length, before.appended, `${label}: 記帳しない`);
  assert.strictEqual(sheetTouched, before.touched, `${label}: シートに触れない`);
}

// 1) プロパティ設定済み・秘密なし／違う／長さ違い／文字列以外 → 拒否
scriptProps = { WEBHOOK_SECRET: SECRET };
expectRejected('秘密なし', inquiry);
expectRejected('秘密が違う', { ...inquiry, webhook_secret: 'y'.repeat(40) });
expectRejected('長さ違い（前方一致）', { ...inquiry, webhook_secret: SECRET.slice(0, 39) });
expectRejected('文字列以外', { ...inquiry, webhook_secret: ['x'.repeat(40)] });

// 2) プロパティ未設定・空・短すぎる → 正しい形の秘密を送っても拒否（fail-closed）
scriptProps = {};
expectRejected('プロパティ未設定', { ...inquiry, webhook_secret: SECRET });
scriptProps = { WEBHOOK_SECRET: '' };
expectRejected('プロパティ空', { ...inquiry, webhook_secret: '' });
scriptProps = { WEBHOOK_SECRET: 'short' };
expectRejected('プロパティが短すぎる', { ...inquiry, webhook_secret: 'short' });

// 3) 正しい秘密 → 記帳され、秘密は行に残らない
scriptProps = { WEBHOOK_SECRET: SECRET };
const ok = post({ ...inquiry, webhook_secret: SECRET });
assert.strictEqual(ok.success, true, '正しい秘密なら success');
assert.strictEqual(appended.length, 1, '1 行だけ記帳');
assert.ok(!JSON.stringify(appended[0]).includes(SECRET), '秘密は Inquiries の行に書かれない');

console.log('doPost: ALL ASSERTIONS PASSED');
