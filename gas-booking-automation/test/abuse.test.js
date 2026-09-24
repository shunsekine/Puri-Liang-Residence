// WO-PB-3F（F1・F2。docs/2026-09-24-WO-PB-3F-reserve-abuse.md）の GAS 側。test/run.sh から実行される。
// 守ること:
//   F2 doPost の受信時刻はサーバー時刻（payload.submitted_at を信じない＝15 分の待ちを飛ばせない）
//   F1 doPost: メール形式が不正／氏名に URL らしき文字列 → 記帳はするが IrregularFlag を立てる（自動送信せず下書き）
//   F1 sendAutoReplies: 自動送信の直前に「同じアドレスへ 24 時間以内に自動返信済み」「今日（スクリプトのタイムゾーン）の
//      自動返信が Settings.DAILY_AUTO_REPLY_CAP（未設定なら 20）に到達」を判定し、当たれば送らずに下書き＋旗の追記＋
//      担当者への通知（1 実行 1 通・行ごとの通知は出さない）
// 検出力の確認（2026-09-24）: 変更前の src（429be83）をビルドして GAS_BUILD_DIR で実行し、17 件が落ちることを確認した
//   ― F2 2 件（受信時刻が 2020-01-01／2099-01-01 のまま）、メール形式 5 件・氏名 URL 4 件（旗が「なし」）、送信上限 6 件
//   （2 件目・上限超過分へも sendEmail した）。誤検知しないことの 3 件（正常は旗なし・24 時間より前と旗付きは数えない・
//   上限値が数でなければ既定）は変更前も通る。
const assert = require('assert');

const SECRET = 'x'.repeat(40);
const TZ = 'Asia/Tokyo';
const HEADER = ['ID', 'Timestamp', 'Name', 'Email', 'Language', 'CheckIn', 'CheckOut', 'RoomType', 'Guests', 'Remarks', 'PeriodCategory', 'IrregularFlag', 'Status', 'WhatsAppText', 'MessageId'];
const COL = { TS: 1, NAME: 2, EMAIL: 3, FLAG: 11, STATUS: 12 }; // 0 始まり
const OWNER = 'owner@example.com';

let inquiries, settingsRows, calls;
function reset(rows = [], settings = {}) {
  inquiries = [HEADER.slice(), ...rows];
  settingsRows = [['Key', 'Value'], ['NOTIFICATION_EMAIL', OWNER], ...Object.entries(settings)];
  calls = { sent: [], drafts: [] };
}
const inquiriesSheet = {
  getLastRow: () => inquiries.length,
  getLastColumn: () => HEADER.length,
  appendRow: (row) => { inquiries.push(row.slice()); },
  // 実物の getValues はスナップショット（後の setValue は反映されない）。同じ実行で送った分を実装が自分で数えているかを
  // 確かめるため、コピーを返す
  getDataRange: () => ({ getValues: () => inquiries.map((r) => r.slice()) }),
  getRange: (r, c) => ({
    getValues: () => [inquiries[r - 1].slice()],
    setValue: (v) => { inquiries[r - 1][c - 1] = v; },
  }),
};
const TEMPLATES = [['ID', 'Subject', 'Body'], ['1MonthLater_en', 'Hi {Name}', 'Body {ID}'], ['1MonthWithin_en', 'Hi {Name}', 'Body {ID}']];
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (n) => (n === 'Inquiries' ? inquiriesSheet
      : n === 'Settings' ? { getDataRange: () => ({ getValues: () => settingsRows }) }
        : n === 'Templates' ? { getDataRange: () => ({ getValues: () => TEMPLATES }) }
          : null),
  }),
};
global.GmailApp = {
  sendEmail: (to, subject, body) => calls.sent.push({ to, subject, body }),
  createDraft: (to, subject, body) => calls.drafts.push({ to, subject, body }),
};
global.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k === 'WEBHOOK_SECRET' ? SECRET : null) }) };
global.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ body: JSON.parse(s), setMimeType() { return this; } }) };
const ymd = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
global.Utilities = {
  sleep: () => {},
  formatDate: (d, tz, fmt) => { assert.strictEqual(fmt, 'yyyy-MM-dd', 'formatDate のスタブは yyyy-MM-dd だけ'); return ymd(d, tz); },
};
global.Session = { getScriptTimeZone: () => TZ };
console.warn = () => {}; console.error = () => {};

const { doPost } = require(process.env.GAS_BUILD_DIR + '/Main');
const { EmailService } = require(process.env.GAS_BUILD_DIR + '/EmailService');

const failures = [];
function t(label, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(label);
    console.log(`FAIL ${label}: ${String(e.message).split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------- doPost
const DAY = 864e5;
const isoDay = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const base = { name: 'Synthetic', email: 'synthetic@example.com', language: 'en', checkin: isoDay(40), checkout: isoDay(70), room: 'Villa', room_id: 'villa', guests: 2, notes: '(none)', webhook_secret: SECRET };
const post = (obj) => doPost({ postData: { contents: JSON.stringify(obj) } }).body;
const lastRow = () => inquiries[inquiries.length - 1];

t('F2: 過去の submitted_at を送っても受信時刻は現在', () => {
  reset();
  const before = Date.now();
  assert.strictEqual(post({ ...base, submitted_at: '2020-01-01T00:00:00.000Z' }).success, true);
  const ts = new Date(lastRow()[COL.TS]).getTime();
  assert.ok(ts >= before - 1000 && ts <= Date.now() + 1000, `受信時刻が ${new Date(ts).toISOString()}`);
});
t('F2: 未来の submitted_at も無視', () => {
  reset();
  post({ ...base, submitted_at: '2099-01-01T00:00:00.000Z' });
  assert.ok(Math.abs(new Date(lastRow()[COL.TS]).getTime() - Date.now()) < 5000);
});
t('正常な問い合わせは旗なし（誤検知しない）', () => {
  reset();
  post(base);
  assert.strictEqual(lastRow()[COL.FLAG], 'なし');
});
for (const email of ['not-an-email', 'a@b', 'a b@example.com', 'a'.repeat(243) + '@example.com', '']) {
  t(`F1: メール形式不正（${JSON.stringify(email.length > 30 ? email.slice(0, 10) + '…(' + email.length + ')' : email)}）は記帳して旗を立てる`, () => {
    reset();
    assert.strictEqual(post({ ...base, email }).success, true, '記帳はする');
    assert.strictEqual(inquiries.length, 2);
    assert.match(String(lastRow()[COL.FLAG]), /メール/);
  });
}
for (const name of ['Visit http://spam.example', 'www.spam.example', 'HTTPS SPAM', 'go to x://y']) {
  t(`F1: 氏名に URL らしき文字列（${name}）は旗を立てる`, () => {
    reset();
    post({ ...base, name });
    assert.match(String(lastRow()[COL.FLAG]), /URL/);
  });
}

// ---------------------------------------------------------------- sendAutoReplies
const now = Date.now();
const minutesAgo = (m) => new Date(now - m * 60e3);
const row = (id, email, status, ts, flag = 'なし') =>
  [id, ts, 'Guest ' + id, email, 'en', new Date(now + 40 * DAY), new Date(now + 70 * DAY), 'Villa', 2, '', '1ヶ月以上先', flag, status, '', 'WEB-' + id];
const customerMails = () => calls.sent.filter((s) => s.to !== OWNER).map((s) => s.to);
const ownerMails = () => calls.sent.filter((s) => s.to === OWNER);
const cell = (id, col) => inquiries.find((r) => r[0] === id)[col];

t('F1: 同じアドレスへ 24 時間以内に自動返信済み → 2 件目は送らず下書き・旗・通知 1 通', () => {
  reset([
    row('INQ-001', 'victim@example.com', '1次送信済', minutesAgo(120)),
    row('INQ-002', 'Victim@Example.com', '1次送信待ち', minutesAgo(20)),
  ]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails(), [], '顧客へ送った');
  assert.deepStrictEqual(calls.drafts.map((d) => d.to), ['Victim@Example.com'], '下書き');
  assert.ok(calls.drafts[0].subject.startsWith('【要確認】'));
  assert.strictEqual(cell('INQ-002', COL.STATUS), '最終送信待ち');
  assert.match(String(cell('INQ-002', COL.FLAG)), /24時間/);
  assert.strictEqual(ownerMails().length, 1, `担当者への通知は 1 通（実際 ${ownerMails().length}）`);
});
t('F1: 同じ実行の中で同じアドレスが 2 件 → 1 件目だけ送る（読み取り後に送った分も数える）', () => {
  reset([
    row('INQ-001', 'dup@example.com', '1次送信待ち', minutesAgo(30)),
    row('INQ-002', 'DUP@example.com', '1次送信待ち', minutesAgo(20)),
  ]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails(), ['dup@example.com']);
  assert.deepStrictEqual(calls.drafts.map((d) => d.to), ['DUP@example.com']);
  assert.strictEqual(cell('INQ-001', COL.STATUS), '1次送信済');
  assert.strictEqual(cell('INQ-002', COL.STATUS), '最終送信待ち');
});
t('F1: 担当者が状態を進めた（クローズ）自動返信済みの行も 24 時間の判定に数える', () => {
  reset([
    row('INQ-001', 'victim@example.com', 'クローズ', minutesAgo(180)),
    row('INQ-002', 'victim@example.com', '1次送信待ち', minutesAgo(20)),
  ]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails(), []);
  assert.strictEqual(calls.drafts.length, 1);
});
t('誤検知しない: 24 時間より前の自動返信・旗付き（下書き）だった行は数えない', () => {
  reset([
    row('INQ-001', 'repeat@example.com', '1次送信済', minutesAgo(25 * 60)),
    row('INQ-002', 'held@example.com', '最終送信待ち', minutesAgo(60), '定員超過(上限2名に対し3名)'),
    row('INQ-003', 'repeat@example.com', '1次送信待ち', minutesAgo(20)),
    row('INQ-004', 'held@example.com', '1次送信待ち', minutesAgo(20)),
  ]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails(), ['repeat@example.com', 'held@example.com']);
  assert.strictEqual(calls.drafts.length, 0);
});

const sentToday = (n) => Array.from({ length: n }, (_, k) => row(`INQ-T${k}`, `today${k}@example.com`, '1次送信済', new Date(now)));
const sentLongAgo = (n) => Array.from({ length: n }, (_, k) => row(`INQ-O${k}`, `old${k}@example.com`, '1次送信済', new Date(now - 3 * DAY)));
// 24 時間と 1 分前＝スクリプトのタイムゾーン（Asia/Tokyo・夏時間なし）で必ず「昨日以前」かつ 48 時間以内（日付の判定そのものを通る）
const sentYesterday = (n) => Array.from({ length: n }, (_, k) => row(`INQ-Y${k}`, `yday${k}@example.com`, '1次送信済', new Date(now - DAY - 60e3)));
const pending = (n) => Array.from({ length: n }, (_, k) => row(`INQ-P${k}`, `new${k}@example.com`, '1次送信待ち', minutesAgo(20)));

t('F1: 上限（未設定＝20）の次の 1 件から下書き。前日以前の送信は数えない。通知は 1 実行 1 通', () => {
  reset([...sentLongAgo(5), ...sentYesterday(5), ...sentToday(19), ...pending(3)]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails(), ['new0@example.com'], `送った先 ${JSON.stringify(customerMails())}`);
  assert.deepStrictEqual(calls.drafts.map((d) => d.to), ['new1@example.com', 'new2@example.com']);
  for (const id of ['INQ-P1', 'INQ-P2']) {
    assert.strictEqual(cell(id, COL.STATUS), '最終送信待ち');
    assert.match(String(cell(id, COL.FLAG)), /上限/);
  }
  const held = ownerMails().filter((m) => !m.subject.startsWith('【一次返信送信済】'));
  assert.strictEqual(held.length, 1, `保留の通知は 1 通（実際 ${held.length}）`);
  assert.match(held[0].subject, /2 件/);
});
t('F1: Settings.DAILY_AUTO_REPLY_CAP を読む（2 → 3 件目から下書き）', () => {
  reset(pending(3), { DAILY_AUTO_REPLY_CAP: '2' });
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails(), ['new0@example.com', 'new1@example.com']);
  assert.deepStrictEqual(calls.drafts.map((d) => d.to), ['new2@example.com']);
});
t('F1: DAILY_AUTO_REPLY_CAP = 0 は自動送信を止める', () => {
  reset(pending(2), { DAILY_AUTO_REPLY_CAP: '0' });
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails(), []);
  assert.strictEqual(calls.drafts.length, 2);
});
t('DAILY_AUTO_REPLY_CAP が数でなければ既定の 20（送信を止めない）', () => {
  reset(pending(3), { DAILY_AUTO_REPLY_CAP: 'abc' });
  EmailService.sendAutoReplies();
  assert.strictEqual(customerMails().length, 3);
});

if (failures.length) {
  console.log(`abuse: ${failures.length} 件 FAILED`);
  process.exit(1);
}
console.log('abuse: ALL ASSERTIONS PASSED');
