// 個人データの保存期間（2026-09-24 オーナー決定: 約 2 年）。test/run.sh から実行される。
// 守ること（anonymizeExpiredInquiries・月 1 回の定期トリガー）:
//   - 受信日時とチェックアウト日の遅い方から Settings.RETENTION_DAYS（既定 730）日を「過ぎた」行（スクリプトのタイムゾーンの暦日で
//     731 日目以降）の個人データの列（氏名・メール・備考・WhatsApp 文面・電話・国籍・滞在目的）を空にし、S 列 AnonymizedAt に日時を入れる
//   - 行は消さない（ID は getLastRow で採番するので、消すと ID が再利用される）。ID・日付・部屋・人数・ステータス・旗は残す
//   - 匿名化済み（S 列あり）の行・一次返信前（1次送信待ち・エラー等）の行・日付が読めない行には触らない
//   - 書き込みはまとめて（消去 1 回・印 1 回）、withRetry で。書く直前に ID を読み直し、並べ替え等で行がずれていたら触らない
//   - 匿名化した件数を担当者へ 1 通（何も無ければ送らない）。通知に個人データを入れない
//   - RETENTION_DAYS が数でない・365 未満なら何も消さずに例外（入力ミスで消しすぎない。空欄は既定の 730）
// 検出力の確認（2026-09-24）: 変更前の src（32706ad）をビルドして GAS_BUILD_DIR で実行し、11 件すべてが落ちることを確認した
//   （anonymizeExpiredInquiries が無い）。
const assert = require('assert');

const TZ = 'Asia/Tokyo';
const HEADER = ['ID', 'Timestamp', 'Name', 'Email', 'Language', 'CheckIn', 'CheckOut', 'RoomType', 'Guests', 'Remarks', 'PeriodCategory', 'IrregularFlag', 'Status', 'WhatsAppText', 'MessageId', 'Phone', 'Nationality', 'StayPurposes', 'AnonymizedAt'];
/** 匿名化で空にする列（0 始まり）: C 氏名・D メール・J 備考・N WhatsApp 文面・P 電話・Q 国籍・R 滞在目的 */
const PERSONAL = [2, 3, 9, 13, 15, 16, 17];
const ANON = 18; // S
const OWNER = 'owner@example.com';
const DAY = 864e5;
const now = new Date();

let inquiries, settingsRows, calls, hooks;
function reset(rows, settings = {}) {
  inquiries = [HEADER.slice(), ...rows.map((r) => r.slice())];
  settingsRows = [['Key', 'Value'], ['NOTIFICATION_EMAIL', OWNER], ...Object.entries(settings)];
  calls = { sent: [], clear: 0, mark: 0, sleep: 0, writes: [] };
  hooks = { afterRead: null, failClearOnce: false };
}
const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const parseA1 = (a1) => {
  const m = /^([A-Z]+)(\d+)$/.exec(a1);
  assert.ok(m, `A1 表記でない: ${a1}`);
  return { r: Number(m[2]), c: colIndex(m[1]) };
};
const inquiriesSheet = {
  getLastRow: () => inquiries.length,
  getLastColumn: () => HEADER.length,
  getDataRange: () => ({
    getValues: () => {
      const snapshot = inquiries.map((r) => r.slice());
      if (hooks.afterRead) { const f = hooks.afterRead; hooks.afterRead = null; f(); }
      return snapshot;
    },
  }),
  getRange: (r, c, nr = 1, nc = 1) => ({
    getValues: () => inquiries.slice(r - 1, r - 1 + nr).map((x) => x.slice(c - 1, c - 1 + nc)),
    setValue: (v) => { calls.writes.push(`${r},${c}`); inquiries[r - 1][c - 1] = v; },
  }),
  getRangeList: (a1s) => ({
    clearContent: () => {
      if (hooks.failClearOnce) { hooks.failClearOnce = false; throw new Error('Service Spreadsheets failed while accessing document with id X'); }
      calls.clear++;
      for (const a1 of a1s) { const { r, c } = parseA1(a1); calls.writes.push(`${r},${c}`); inquiries[r - 1][c - 1] = ''; }
    },
    setValue: (v) => {
      calls.mark++;
      for (const a1 of a1s) { const { r, c } = parseA1(a1); calls.writes.push(`${r},${c}`); inquiries[r - 1][c - 1] = v; }
    },
  }),
};
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (n) => (n === 'Inquiries' ? inquiriesSheet
      : n === 'Settings' ? { getDataRange: () => ({ getValues: () => settingsRows }) }
        : null),
  }),
};
global.GmailApp = {
  sendEmail: (to, subject, body) => calls.sent.push({ to, subject, body }),
  createDraft: () => { throw new Error('匿名化で下書きは作らない'); },
};
global.Utilities = {
  sleep: () => { calls.sleep++; },
  formatDate: (d, tz, fmt) => {
    assert.strictEqual(fmt, 'yyyy-MM-dd', 'formatDate のスタブは yyyy-MM-dd だけ');
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  },
};
global.Session = { getScriptTimeZone: () => TZ };
// 実装のログ（件数だけ）は出さない。このテストの結果は log で出す
const log = console.log;
console.warn = () => {}; console.error = () => {}; console.log = () => {};

const { anonymizeExpiredInquiries } = require(process.env.GAS_BUILD_DIR + '/Main');

const failures = [];
let total = 0;
function t(label, fn) {
  total++;
  try {
    fn();
  } catch (e) {
    failures.push(label);
    log(`FAIL ${label}: ${String(e.message).split('\n')[0]}`);
  }
}

const daysAgo = (n) => new Date(now.getTime() - n * DAY);
/** 受信 tsDays 日前・チェックアウト coDays 日前（負なら未来）の行。個人データの列はすべて埋める */
const mk = (id, tsDays, coDays, status = 'クローズ', anonymizedAt = '') => [
  id, typeof tsDays === 'number' ? daysAgo(tsDays) : tsDays, 'Guest ' + id, id.toLowerCase() + '@example.com', 'en',
  typeof coDays === 'number' ? daysAgo(coDays + 30) : '', typeof coDays === 'number' ? daysAgo(coDays) : coDays,
  'Villa', 2, 'remarks ' + id, '1ヶ月以上先', 'なし', status, 'WhatsApp text ' + id, 'WEB-' + id,
  "'0812" + id.length, 'ID', 'Surfing', anonymizedAt,
];
const byId = (id) => inquiries.find((r) => r[0] === id);
function assertAnonymized(id, before) {
  const r = byId(id);
  for (const c of PERSONAL) assert.strictEqual(r[c], '', `${id} の列 ${HEADER[c]} が残っている`);
  assert.ok(r[ANON] instanceof Date && Math.abs(r[ANON].getTime() - Date.now()) < 60e3, `${id} に AnonymizedAt が無い`);
  for (let c = 0; c < HEADER.length; c++) {
    if (PERSONAL.includes(c) || c === ANON) continue;
    assert.deepStrictEqual(r[c], before[c], `${id} の列 ${HEADER[c]} が変わった（帳簿として残す列）`);
  }
}
const assertUntouched = (id, before) => assert.deepStrictEqual(byId(id), before, `${id} に触れた`);

// ---------------------------------------------------------------- 判定と書き込み
const ROWS = [
  mk('EXP-800', 800, 770),                        // 過ぎた
  mk('EDGE-730', 760, 730),                       // チェックアウトからちょうど 730 日 → まだ（「過ぎた」ではない）
  mk('EDGE-731', 760, 731),                       // 731 日 → 匿名化
  mk('FUTURE-CO', 800, -30),                      // 受信は古いがチェックアウトが未来 → 残す
  mk('RECENT-CO', 800, 100),                      // 遅い方（チェックアウト）が 100 日前 → 残す
  mk('TS-730', 730, 745),                         // チェックアウトより受信が遅い（過去日付の問い合わせ）。遅い方＝受信 730 日 → 残す
  mk('DONE', 900, 870, 'クローズ', daysAgo(30)),   // 匿名化済み → 触らない
  mk('PENDING', 900, 870, '1次送信待ち'),          // 一次返信前 → 触らない
  mk('ERROR', 900, 870, 'エラー'),                 // 一次返信前（自動処理の失敗） → 触らない
  mk('BAD-DATE', 'not a date', ''),               // 日付が読めない → 触らない
];
const snapshotOf = (id) => ROWS.find((r) => r[0] === id).slice();

t('過ぎた行だけ個人データを消して印を付け、帳簿の列は残す（境界: 730 日は残し 731 日で消す）', () => {
  reset(ROWS);
  anonymizeExpiredInquiries();
  assertAnonymized('EXP-800', snapshotOf('EXP-800'));
  assertAnonymized('EDGE-731', snapshotOf('EDGE-731'));
  for (const id of ['EDGE-730', 'FUTURE-CO', 'RECENT-CO', 'TS-730', 'DONE', 'PENDING', 'ERROR', 'BAD-DATE']) assertUntouched(id, snapshotOf(id));
  assert.strictEqual(inquiries.length, ROWS.length + 1, '行を消した');
});
t('書き込みはまとめて 1 回ずつ（消去 1・印 1）', () => {
  reset(ROWS);
  anonymizeExpiredInquiries();
  assert.deepStrictEqual([calls.clear, calls.mark], [1, 1]);
});
t('担当者へ 1 通（件数・ID。個人データは入れない）', () => {
  reset(ROWS);
  anonymizeExpiredInquiries();
  assert.strictEqual(calls.sent.length, 1);
  const [mail] = calls.sent;
  assert.strictEqual(mail.to, OWNER);
  assert.match(mail.subject, /2 件/);
  assert.match(mail.body, /EXP-800/);
  assert.match(mail.body, /EDGE-731/);
  for (const s of ['Guest EXP-800', 'exp-800@example.com', 'remarks EXP-800', 'WhatsApp text']) assert.ok(!mail.body.includes(s), `通知に個人データ ${s}`);
});
t('2 回目の実行は何も書かず、通知も出さない', () => {
  reset(ROWS);
  anonymizeExpiredInquiries();
  calls = { sent: [], clear: 0, mark: 0, sleep: 0, writes: [] };
  anonymizeExpiredInquiries();
  assert.deepStrictEqual(calls.writes, []);
  assert.strictEqual(calls.sent.length, 0);
});
t('Settings.RETENTION_DAYS を読む（365 → 400 日前の行も消す）。空欄は既定の 730', () => {
  reset([mk('OLD-400', 500, 400), mk('NEW-300', 400, 300)], { RETENTION_DAYS: '365' });
  anonymizeExpiredInquiries();
  assertAnonymized('OLD-400', mk('OLD-400', 500, 400));
  assert.strictEqual(byId('NEW-300')[2], 'Guest NEW-300');
  reset([mk('OLD-400', 500, 400)], { RETENTION_DAYS: '' });
  anonymizeExpiredInquiries();
  assert.strictEqual(byId('OLD-400')[2], 'Guest OLD-400', '空欄なのに 730 日より短い期間で消した');
});
for (const bad of ['abc', '100', '-1', '730日']) {
  t(`RETENTION_DAYS が不正（${bad}）→ 何も消さずに例外`, () => {
    reset(ROWS, { RETENTION_DAYS: bad });
    assert.throws(() => anonymizeExpiredInquiries(), /RETENTION_DAYS/);
    assert.deepStrictEqual(calls.writes, []);
  });
}
t('一過性のエラーは withRetry で再試行して完了する', () => {
  reset(ROWS);
  hooks.failClearOnce = true;
  anonymizeExpiredInquiries();
  assert.ok(calls.sleep >= 1, 'リトライしていない');
  assertAnonymized('EXP-800', snapshotOf('EXP-800'));
});
t('読み取り後に行がずれた（担当者が並べ替えた）行には触らない', () => {
  reset([mk('EXP-A', 800, 770), mk('KEEP-B', 10, -30), mk('EXP-C', 800, 770)]);
  // 読み取りの直後に 2 行目と 3 行目が入れ替わる（EXP-A の位置に KEEP-B が来る）
  hooks.afterRead = () => { [inquiries[1], inquiries[2]] = [inquiries[2], inquiries[1]]; };
  anonymizeExpiredInquiries();
  assert.strictEqual(byId('KEEP-B')[2], 'Guest KEEP-B', '別の行（KEEP-B）の個人データを消した');
  assert.strictEqual(byId('EXP-A')[2], 'Guest EXP-A', 'ずれた行は次回に回す');
  assertAnonymized('EXP-C', mk('EXP-C', 800, 770));
});

log(`retention: ${total - failures.length}/${total} passed`);
if (failures.length) {
  log(`retention: ${failures.length} 件 FAILED`);
  process.exit(1);
}
log('retention: ALL ASSERTIONS PASSED');
