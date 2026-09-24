// 合成データでの検証ハーネス（GAS のグローバルをスタブ）。test/run.sh から実行される。
const calls = { sleep: [], sent: [], drafts: [], status: {} };
let failGetValuesTimes = 0;
const now = new Date();
const old = new Date(now.getTime() - 60 * 60 * 1000); // 1時間前
const mkRow = (id, email, status) => [id, old, 'Guest ' + id, email, 'en', new Date(now.getTime()+40*864e5), new Date(now.getTime()+70*864e5), 'villa', 2, '', '1ヶ月以上先', 'なし', status, '', 'WEB-1'];
const inquiries = [
  ['ID','Timestamp','Name','Email','Language','CheckIn','CheckOut','RoomType','Guests','Remarks','PeriodCategory','IrregularFlag','Status','WhatsAppText','MessageId'],
  mkRow('INQ-001', 'a@example.com', '1次送信待ち'),
  mkRow('INQ-002', 'BAD', '1次送信待ち'),          // sendEmail が失敗する行
  mkRow('INQ-003', 'c@example.com', '1次送信待ち'),  // 後続が処理されることを確認
];
const sheets = {
  Inquiries: {
    getDataRange: () => ({ getValues: () => { if (failGetValuesTimes-- > 0) throw new Error('Service Spreadsheets failed while accessing document with id X'); return inquiries; } }),
    getLastColumn: () => 15,
    getRange: (r, c, nr, nc) => ({ getValues: () => [inquiries[r-1]], setValue: (v) => { calls.status[r] = v; inquiries[r-1][12] = v; } }),
  },
  Settings: { getDataRange: () => ({ getValues: () => [['Key','Value'],['NOTIFICATION_EMAIL','owner@example.com']] }) },
  Templates: { getDataRange: () => ({ getValues: () => [['ID','Subject','Body'],['1MonthLater_en','Hi {Name}','Body {ID}']] }) },
};
global.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheets[n] || null }) };
global.GmailApp = {
  sendEmail: (to, subject, body) => { if (to === 'BAD') throw new Error('Invalid email: BAD'); calls.sent.push({ to, subject }); },
  createDraft: (to, subject) => calls.drafts.push({ to, subject }),
};
// formatDate・Session は送信上限（WO-PB-3F F1）の「今日」の判定が使う。上限の挙動そのものは abuse.test.js で見る
global.Utilities = {
  sleep: (ms) => calls.sleep.push(ms),
  formatDate: (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
};
global.Session = { getScriptTimeZone: () => 'Asia/Tokyo' };
console.warn = () => {}; console.error = () => {};

const { EmailService } = require(process.env.GAS_BUILD_DIR + '/EmailService');
const { withRetry } = require(process.env.GAS_BUILD_DIR + '/Retry');
const assert = require('assert');

// 1) withRetry: 2回失敗→3回目成功 / バックオフ 1s,2s
let n = 0;
assert.strictEqual(withRetry('t', () => { if (++n < 3) throw new Error('x'); return 'ok'; }), 'ok');
assert.deepStrictEqual(calls.sleep, [1000, 2000]);
// 2) withRetry: 4回すべて失敗→例外を投げ直す
calls.sleep.length = 0;
assert.throws(() => withRetry('t', () => { throw new Error('always'); }), /always/);
assert.deepStrictEqual(calls.sleep, [1000, 2000, 4000]);

// 3) sendAutoReplies: 一過性の getValues 失敗を吸収し、行2の失敗で行3が止まらない
calls.sleep.length = 0; failGetValuesTimes = 1;
EmailService.sendAutoReplies();
assert.deepStrictEqual(calls.sleep, [1000], 'getValues の一過性失敗を1回リトライ');
assert.deepStrictEqual(calls.sent.map(s => s.to), ['a@example.com', 'owner@example.com', 'c@example.com', 'owner@example.com', 'owner@example.com'],
  '顧客2通 + 担当者通知2通 + 失敗通知1通');
assert.strictEqual(inquiries[1][12], '1次送信済');
assert.strictEqual(inquiries[2][12], 'エラー');
assert.strictEqual(inquiries[3][12], '1次送信済');
const failMail = calls.sent.find(s => s.subject.startsWith('【GASエラー】'));
assert.ok(failMail && failMail.subject.includes('1 件'), '失敗通知は1通・1件');

// 4) 2回目の実行: 'エラー' 行は再処理されない（通知スパム防止）
const before = calls.sent.length;
EmailService.sendAutoReplies();
assert.strictEqual(calls.sent.length, before, 'エラー行は再送されない');
console.log('ALL ASSERTIONS PASSED');
