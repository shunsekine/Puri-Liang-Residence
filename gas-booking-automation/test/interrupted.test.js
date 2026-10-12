// 一次返信の途中で実行が打ち切られたとき（2026-10-12 のタイムアウト調査）。test/run.sh から実行される。
// 守ること:
//   ① Gmail を操作する（送信・下書き）前に、行の状態を「送信中」にしている
//   ② 打ち切り（6 分の上限。catch も finally も通らない）が送信の後・「1次送信済」の書き込みの前に起きても、次の実行は送り直さない
//      （「送信中」の行は「エラー」にして担当者へ【GASエラー】で知らせる。同じ実行の他の行は普段どおり処理する）
//   ③ 打ち切りが送信の前（「送信中」の書き込み）で起きたら、次の実行で 1 回だけ送る（取りこぼさない）
//   ④ 1 回の試行が 30 秒以上かかったシートの操作はログに残す（どの呼び出しが遅いかを次に特定するため）
// 打ち切りの再現: 指定した書き込みの瞬間に kill し、以後の Gmail・シートの操作をすべて失敗させる（打ち切られた実行は以後の
//   副作用を起こさない）。シートはその瞬間の状態のまま次の実行を迎える。
// 検出力の確認（2026-10-13）: 変更前の src（1c1be87）で実行し、10 件中 8 件が落ちることを確認した（② の打ち切りの再現では
//   変更前は次の実行で二重に送った）。変更前も通る 2 件（エラー行を再び知らせない・速い呼び出しはログに残さない）は誤検知の確認
const assert = require('assert');

const HEADER = ['ID', 'Timestamp', 'Name', 'Email', 'Language', 'CheckIn', 'CheckOut', 'RoomType', 'Guests', 'Remarks', 'PeriodCategory', 'IrregularFlag', 'Status', 'WhatsAppText', 'MessageId'];
const S = 12; // Status の添字（0 始まり）
const OWNER = 'owner@example.com';
const DAY = 864e5;
const old = () => new Date(Date.now() - 60 * 60 * 1000); // 受信 1 時間前（15 分の待ちを過ぎている）
const row = (id, email, status, flag = 'なし') => [id, old(), 'Guest ' + id, email, 'en', new Date(Date.now() + 40 * DAY), new Date(Date.now() + 70 * DAY), 'villa', 2, '', '1ヶ月以上先', flag, status, '', 'WEB-' + id];

let inquiries, settingsRows, calls, killOn, killed, clockSkew;
function reset(rows, settings = {}) {
  inquiries = [HEADER.slice(), ...rows];
  settingsRows = [['Key', 'Value'], ['NOTIFICATION_EMAIL', OWNER], ...Object.entries(settings)];
  calls = { sent: [], drafts: [], statusAtGmail: [], warn: [] };
  killOn = null; killed = false; clockSkew = {};
}
function alive() { if (killed) throw new Error('KILLED (simulated timeout)'); }
const inquiriesSheet = {
  getLastRow: () => inquiries.length,
  getLastColumn: () => HEADER.length,
  getDataRange: () => ({ getValues: () => { alive(); if (clockSkew.read) advance(clockSkew.read); return inquiries.map((r) => r.slice()); } }),
  getRange: (r, c) => ({
    getValues: () => { alive(); return [inquiries[r - 1].slice()]; },
    setValue: (v) => {
      alive();
      if (killOn && killOn(r, c, v)) { killed = true; throw new Error('KILLED (simulated timeout)'); }
      inquiries[r - 1][c - 1] = v;
    },
  }),
};
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (n) => {
      alive();
      if (clockSkew.open) advance(clockSkew.open);
      return n === 'Inquiries' ? inquiriesSheet
        : n === 'Settings' ? { getDataRange: () => ({ getValues: () => { alive(); return settingsRows; } }) }
          : null;
    },
  }),
};
// 顧客宛ての Gmail を呼んだ瞬間のシートの状態を記録する（①。担当者への通知は除く）
const atGmail = (to) => { if (to !== OWNER) calls.statusAtGmail.push([to, (inquiries.find((r) => r[3] === to) || [])[S]]); };
global.GmailApp = {
  sendEmail: (to, subject, body) => { alive(); atGmail(to); calls.sent.push({ to, subject, body }); },
  createDraft: (to, subject, body) => { alive(); atGmail(to); calls.drafts.push({ to, subject, body }); },
};
global.Utilities = {
  sleep: () => {},
  formatDate: (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
};
global.Session = { getScriptTimeZone: () => 'Asia/Tokyo' };
// ④ の時計: Date.now だけを進める（new Date() は実時間のまま）
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
function advance(ms) { offset += ms; }
console.warn = (...a) => calls.warn.push(a.join(' '));
console.error = () => {};

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
const customerMail = () => calls.sent.filter((m) => m.to !== OWNER);
const failMails = () => calls.sent.filter((m) => m.to === OWNER && m.subject.startsWith('【GASエラー】'));

// ---------------------------------------------------------------- ①
t('① 自動送信の前に「送信中」、送った後に「1次送信済」', () => {
  reset([row('INQ-001', 'a@example.com', '1次送信待ち')]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(calls.statusAtGmail, [['a@example.com', '送信中']]);
  assert.strictEqual(inquiries[1][S], '1次送信済');
});
t('① 旗付き（下書き）も、下書きを作る前に「送信中」', () => {
  reset([row('INQ-001', 'a@example.com', '1次送信待ち', '定員超過')]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(calls.statusAtGmail, [['a@example.com', '送信中']]);
  assert.strictEqual(calls.drafts.length, 1);
  assert.strictEqual(inquiries[1][S], '最終送信待ち');
});
t('① 送信上限で保留（下書き）も、下書きを作る前に「送信中」', () => {
  reset([row('INQ-001', 'a@example.com', '1次送信待ち')], { DAILY_AUTO_REPLY_CAP: '0' });
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(calls.statusAtGmail, [['a@example.com', '送信中']]);
  assert.strictEqual(calls.sent.filter((m) => m.to === 'a@example.com').length, 0);
  assert.strictEqual(inquiries[1][S], '最終送信待ち');
});

// ---------------------------------------------------------------- ②
t('② 送信の後・「1次送信済」の前に打ち切られても、次の実行は送り直さない', () => {
  reset([row('INQ-001', 'a@example.com', '1次送信待ち')]);
  killOn = (r, c, v) => v === '1次送信済';
  EmailService.sendAutoReplies();
  assert.strictEqual(customerMail().length, 1, '打ち切られた実行で 1 通送っている');
  killed = false; killOn = null;
  EmailService.sendAutoReplies();
  assert.strictEqual(customerMail().length, 1, '次の実行で送り直した（二重送信）');
  assert.strictEqual(inquiries[1][S], 'エラー');
});
t('② 「送信中」で残った行は「エラー」にして担当者へ知らせ、同じ実行の他の行は普段どおり送る', () => {
  reset([row('INQ-001', 'a@example.com', '送信中'), row('INQ-002', 'b@example.com', '1次送信待ち')]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(customerMail().map((m) => m.to), ['b@example.com']);
  assert.strictEqual(calls.drafts.length, 0);
  assert.strictEqual(inquiries[1][S], 'エラー');
  assert.strictEqual(inquiries[2][S], '1次送信済');
  const mails = failMails();
  assert.strictEqual(mails.length, 1, '【GASエラー】が 1 通');
  assert.ok(mails[0].body.includes('INQ-001') && mails[0].body.includes('送信済み'), '行の ID と確かめ方を書く');
});
t('② 「エラー」にした行は、次の実行で再び知らせない', () => {
  reset([row('INQ-001', 'a@example.com', '送信中')]);
  EmailService.sendAutoReplies();
  const n = calls.sent.length;
  EmailService.sendAutoReplies();
  assert.strictEqual(calls.sent.length, n);
});

// ---------------------------------------------------------------- ③
t('③ 「送信中」の書き込みで打ち切られたら、次の実行で 1 回だけ送る', () => {
  reset([row('INQ-001', 'a@example.com', '1次送信待ち')]);
  killOn = (r, c, v) => v === '送信中';
  EmailService.sendAutoReplies();
  assert.strictEqual(customerMail().length, 0);
  killed = false; killOn = null;
  EmailService.sendAutoReplies();
  assert.strictEqual(customerMail().length, 1);
  assert.strictEqual(inquiries[1][S], '1次送信済');
});

// ---------------------------------------------------------------- ④
t('④ シートの読み取りが 30 秒以上かかったら、呼び出しと秒数をログに残す', () => {
  reset([]);
  clockSkew.read = 40000;
  EmailService.sendAutoReplies();
  assert.ok(calls.warn.some((w) => w.includes('getAllValues(Inquiries)') && w.includes('40s')), calls.warn.join(' / '));
});
t('④ 開くのが遅いときは、開くのに何秒かかったかも残す', () => {
  reset([]);
  clockSkew.open = 35000;
  EmailService.sendAutoReplies();
  assert.ok(calls.warn.some((w) => w.includes('opening Inquiries') && w.includes('35s')), calls.warn.join(' / '));
});
t('④ 速い呼び出しはログに残さない', () => {
  reset([row('INQ-001', 'a@example.com', '1次送信待ち')]);
  EmailService.sendAutoReplies();
  assert.deepStrictEqual(calls.warn.filter((w) => w.includes('took')), []);
});

if (failures.length > 0) {
  console.log(`interrupted: ${failures.length} 件 FAILED`);
  process.exit(1);
}
console.log('interrupted: ALL ASSERTIONS PASSED');
