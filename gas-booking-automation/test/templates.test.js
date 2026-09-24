// テンプレートが無いときに黙って止まらない（2026-09-24。サイトは ja・en・id だが Templates シートには _ja・_en しか無い）。
// test/run.sh から実行される。
// 守ること:
//   - テンプレートは `${種類}_${言語}` → `${種類}_en` の順に探す（件名か本文が空の行は無いものとして扱う）
//   - 英語で代用したときは担当者に伝える（一次返信: 既存の担当者通知に 1 行足す。最終回答: ステータスのセルのメモに日付付きで
//     1 行足す。担当者が手で書いたメモは消さない）
//   - どちらも無い: 一次返信は例外 → 既存の行単位の隔離で「エラー」＋担当者へ失敗通知（従来は '1次送信待ち' のまま毎回
//     素通りし、送られず、誰にも知らされなかった）。最終回答（onEdit）は分かる文言の例外＋セルにメモ（従来は何もしなかった）
// 検出力の確認（2026-09-24）: 変更前の src（32706ad）をビルドして GAS_BUILD_DIR で実行し、10 件中 8 件が落ちることを確認した
//   ― 英語で代用 4 件（一次返信の送信・旗付きの下書き・未知の言語・最終回答の下書き。何も送られない）、代用の通知 2 件
//   （担当者への通知・セルのメモ）、どちらも無いときの「エラー」＋失敗通知 1 件（'1次送信待ち' のまま）、最終回答の例外 1 件
//   （例外が出ない）。変更前も通る 2 件: _id・_ja があればそれを使う（正常系の回帰検査）。
const assert = require('assert');

const TZ = 'Asia/Tokyo';
const HEADER = ['ID', 'Timestamp', 'Name', 'Email', 'Language', 'CheckIn', 'CheckOut', 'RoomType', 'Guests', 'Remarks', 'PeriodCategory', 'IrregularFlag', 'Status', 'WhatsAppText', 'MessageId', 'Phone', 'Nationality', 'StayPurposes', 'AnonymizedAt'];
const COL = { FLAG: 11, STATUS: 12 }; // 0 始まり
const STATUS_COLUMN = 13; // M（1 始まり）
const OWNER = 'owner@example.com';
const DAY = 864e5;

let inquiries, templates, calls, notes;
const now = Date.now();
const row = (id, language, { flag = 'なし', status = '1次送信待ち', period = '1ヶ月以上先' } = {}) =>
  [id, new Date(now - 20 * 60e3), 'Guest ' + id, id.toLowerCase() + '@example.com', language, new Date(now + 40 * DAY), new Date(now + 70 * DAY), 'Villa', 2, '', period, flag, status, '', 'WEB-' + id, '', '', '', ''];
function reset(rows, templateIds) {
  inquiries = [HEADER.slice(), ...rows];
  templates = [['ID', 'Subject', 'Body'], ...templateIds.map((id) => [id, `[${id}] Hi {Name}`, `Body ${id} {ID}`])];
  calls = { sent: [], drafts: [] };
  notes = {};
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
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (n) => (n === 'Inquiries' ? inquiriesSheet
      : n === 'Settings' ? { getDataRange: () => ({ getValues: () => [['Key', 'Value'], ['NOTIFICATION_EMAIL', OWNER]] }) }
        : n === 'Templates' ? { getDataRange: () => ({ getValues: () => templates }) }
          : null),
  }),
};
global.GmailApp = {
  sendEmail: (to, subject, body) => calls.sent.push({ to, subject, body }),
  createDraft: (to, subject, body) => calls.drafts.push({ to, subject, body }),
};
global.Utilities = {
  sleep: () => {},
  formatDate: (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
};
global.Session = { getScriptTimeZone: () => TZ };
console.warn = () => {}; console.error = () => {};

const { onEdit } = require(process.env.GAS_BUILD_DIR + '/Main');
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
const customerMails = () => calls.sent.filter((s) => s.to !== OWNER);
const ownerMails = () => calls.sent.filter((s) => s.to === OWNER);
const status = (id) => inquiries.find((r) => r[0] === id)[COL.STATUS];
/** 担当者が M 列（Status）を value に変えたときの onEdit */
function editStatus(id, value) {
  const rowNum = inquiries.findIndex((r) => r[0] === id) + 1;
  inquiries[rowNum - 1][COL.STATUS] = value;
  return onEdit({ range: { getSheet: () => ({ getName: () => 'Inquiries' }), getRow: () => rowNum, getColumn: () => STATUS_COLUMN }, value });
}
const noteOf = (id) => notes[`${inquiries.findIndex((r) => r[0] === id) + 1},${STATUS_COLUMN}`];

const JA_EN = ['1MonthLater_ja', '1MonthLater_en', '1MonthWithin_ja', '1MonthWithin_en', 'Available_ja', 'Available_en', 'Full_ja', 'Full_en', 'AcceptWaiting_ja', 'AcceptWaiting_en'];

// ---------------------------------------------------------------- 一次返信
t('一次返信: _id が無ければ _en で送る（1次送信済）', () => {
  reset([row('INQ-001', 'id')], JA_EN);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails().map((m) => m.subject), ['[1MonthLater_en] Hi Guest INQ-001']);
  assert.strictEqual(status('INQ-001'), '1次送信済');
});
t('一次返信: 英語で代用したことを担当者への通知に書く（通知は増やさない）', () => {
  reset([row('INQ-001', 'id')], JA_EN);
  EmailService.sendAutoReplies();
  assert.strictEqual(ownerMails().length, 1, `担当者宛て ${ownerMails().length} 通`);
  assert.match(ownerMails()[0].body, /1MonthLater_id/);
  assert.match(ownerMails()[0].body, /1MonthLater_en/);
});
t('一次返信: 旗付き（下書き）でも _en で代用する', () => {
  reset([row('INQ-001', 'id', { flag: '定員超過(上限2名に対し3名)', period: '1ヶ月以内' })], JA_EN);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(calls.drafts.map((d) => d.subject), ['【要確認】[1MonthWithin_en] Hi Guest INQ-001']);
  assert.strictEqual(status('INQ-001'), '最終送信待ち');
});
t('一次返信: 未知の言語（fr）も _en', () => {
  reset([row('INQ-001', 'fr')], JA_EN);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails().map((m) => m.subject), ['[1MonthLater_en] Hi Guest INQ-001']);
});
t('一次返信: _id があればそれを使い、代用の注記は出さない', () => {
  reset([row('INQ-001', 'id')], [...JA_EN, '1MonthLater_id']);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails().map((m) => m.subject), ['[1MonthLater_id] Hi Guest INQ-001']);
  assert.ok(!/1MonthLater_en/.test(ownerMails()[0].body), '代用していないのに注記');
});
t('一次返信: _ja はそのまま _ja', () => {
  reset([row('INQ-001', 'ja')], JA_EN);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMails().map((m) => m.subject), ['[1MonthLater_ja] Hi Guest INQ-001']);
});
t('一次返信: 言語の行も _en も無い（または件名・本文が空）→ 行は「エラー」・失敗通知にテンプレート ID・後続の行は処理する', () => {
  reset([row('INQ-001', 'id'), row('INQ-002', 'ja')], ['1MonthLater_ja']);
  templates.push(['1MonthLater_en', '', '']); // 貼り付け前の空行は「無い」と同じ（空のメールを送らない）
  EmailService.sendAutoReplies();
  assert.strictEqual(status('INQ-001'), 'エラー');
  assert.strictEqual(status('INQ-002'), '1次送信済', '後続の行が止まった');
  assert.deepStrictEqual(customerMails().map((m) => m.to), ['inq-002@example.com'], '空のテンプレートで送った');
  const failMail = ownerMails().find((m) => m.subject.startsWith('【GASエラー】'));
  assert.ok(failMail, '失敗通知が無い');
  assert.match(failMail.body, /INQ-001.*1MonthLater_id.*1MonthLater_en/);
});

// ---------------------------------------------------------------- 最終回答（onEdit）
t('最終回答: Available_id が無ければ Available_en で下書き・最終送信待ち・セルに代用のメモ', () => {
  reset([row('INQ-001', 'id', { status: '1次送信済' })], JA_EN);
  editStatus('INQ-001', '空室');
  assert.deepStrictEqual(calls.drafts.map((d) => d.subject), ['Re: [Available_en] Hi Guest INQ-001 (INQ-001)']);
  assert.strictEqual(status('INQ-001'), '最終送信待ち');
  assert.match(String(noteOf('INQ-001')), /Available_id/);
});
t('最終回答: 代用していなければメモを書かない・担当者が手で書いたメモは消さない', () => {
  reset([row('INQ-001', 'ja', { status: '1次送信済' })], JA_EN);
  notes[`2,${STATUS_COLUMN}`] = 'owner memo';
  editStatus('INQ-001', '満室');
  assert.deepStrictEqual(calls.drafts.map((d) => d.subject), ['Re: [Full_ja] Hi Guest INQ-001 (INQ-001)']);
  assert.strictEqual(noteOf('INQ-001'), 'owner memo');
  reset([row('INQ-001', 'id', { status: '1次送信済' })], JA_EN);
  notes[`2,${STATUS_COLUMN}`] = 'owner memo';
  editStatus('INQ-001', '満室');
  assert.match(String(noteOf('INQ-001')), /^owner memo\n.*Full_id/);
});
t('最終回答: どちらも無い → 分かる文言で例外・下書きなし・ステータスはそのまま・セルにメモ', () => {
  reset([row('INQ-001', 'id', { status: '1次送信済' })], ['Available_ja']);
  assert.throws(() => editStatus('INQ-001', '空室'), /Available_id.*Available_en/);
  assert.strictEqual(calls.drafts.length, 0);
  assert.strictEqual(status('INQ-001'), '空室', '最終送信待ちにしてはいけない（下書きが無い）');
  assert.match(String(noteOf('INQ-001')), /Available_en/);
});

console.log(`templates: ${total - failures.length}/${total} passed`);
if (failures.length) {
  console.log(`templates: ${failures.length} 件 FAILED`);
  process.exit(1);
}
console.log('templates: ALL ASSERTIONS PASSED');
