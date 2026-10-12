// processAutoReplies の間引き（StallGuard。2026-10-12 のタイムアウト調査）。test/run.sh から実行される。
// 守ること:
//   ① 普段の実行は毎回シートを読み、終わったら記録を残さない
//   ② 打ち切り（印が残る）が 1 回なら次も動かす。2 回続いたら 30 分、以後 60・120・240 分（上限 240 分）定期実行を飛ばす
//   ③ 最後まで動いても 180 秒以上かかった実行は「止まった」と数える。速く終わった実行で数を戻す
//   ④ 手動実行（引数なし）は間引かない
//   ⑤ 例外で終わった実行: 速ければ数えない（印も消す）、遅ければ数える。例外はそのまま投げ直す
//   ⑥ 記録が読めない・スクリプト プロパティが失敗する → 間引かずに動かす（一次返信を止めない）
// 打ち切りの再現: StallGuard.begin だけを呼んで end を呼ばない（実物では finally も通らない）。
// 検出力の確認（2026-10-13）: ビルドした StallGuard.js を 5 通りに壊し、どれも落ちることを確認した ― 間引かない 4 件（10/12 の
//   再現は「打ち切り 10 回」＝実測と同じ）・打ち切りを数えない 4 件・遅く終わった実行を数えない 3 件・速く終わっても数を戻さない
//   5 件・手動実行も間引く 1 件
const assert = require('assert');

const MIN = 60 * 1000;
let props, propsFail, reads, readCost, readThrows;
function reset() {
  props = new Map(); propsFail = false; reads = 0; readCost = 0; readThrows = false;
}
global.PropertiesService = {
  getScriptProperties: () => {
    if (propsFail) throw new Error('Service unavailable: Properties');
    return {
      getProperty: (k) => (props.has(k) ? props.get(k) : null),
      setProperty: (k, v) => { props.set(k, String(v)); },
      deleteProperty: (k) => { props.delete(k); },
    };
  },
};
const inquiries = [['ID', 'Timestamp', 'Name', 'Email', 'Language', 'CheckIn', 'CheckOut', 'RoomType', 'Guests', 'Remarks', 'PeriodCategory', 'IrregularFlag', 'Status', 'WhatsAppText', 'MessageId']];
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (n) => (n === 'Inquiries' ? {
      getDataRange: () => ({
        getValues: () => {
          reads++;
          clock += readCost;
          if (readThrows) throw new Error('Service Spreadsheets failed while accessing document with id X');
          return inquiries;
        },
      }),
    } : null),
  }),
};
global.GmailApp = { sendEmail: () => {}, createDraft: () => {} };
global.Utilities = { sleep: () => {}, formatDate: () => '2026-10-12' };
global.Session = { getScriptTimeZone: () => 'Asia/Tokyo' };
let clock = Date.UTC(2026, 9, 11, 18, 22, 5); // 2026-10-12 03:22:05 JST
Date.now = () => clock;
console.warn = () => {}; console.error = () => {};

const { processAutoReplies } = require(process.env.GAS_BUILD_DIR + '/Main');
const { StallGuard, STALL } = require(process.env.GAS_BUILD_DIR + '/StallGuard');

const TRIGGER = { triggerUid: 'synthetic' }; // 定期トリガーは引数にイベントを渡す
const state = () => (props.has(STALL.PROPERTY) ? JSON.parse(props.get(STALL.PROPERTY)) : null);
/** 15 分後の定期実行。読んだら true */
function tick() { clock += 15 * MIN; const n = reads; processAutoReplies(TRIGGER); return reads > n; }
/** 15 分後の定期実行が打ち切られる（begin だけ）。動いたら true */
function killedTick() { clock += 15 * MIN; return StallGuard.begin(clock, false); }

const failures = [];
function t(label, fn) {
  reset();
  try {
    fn();
  } catch (e) {
    failures.push(label);
    console.log(`FAIL ${label}: ${String(e.message).split('\n')[0]}`);
  }
}

t('① 普段の実行は毎回読み、記録を残さない', () => {
  assert.strictEqual(tick(), true);
  assert.strictEqual(tick(), true);
  assert.strictEqual(state(), null);
});

t('② 打ち切りが 1 回なら次も動かし、速く終われば記録を消す', () => {
  assert.strictEqual(killedTick(), true);
  assert.strictEqual(tick(), true);
  assert.strictEqual(state(), null);
});

t('② 2 回続いたら 30 分飛ばし、その後は動かす', () => {
  killedTick(); killedTick();         // 2 回打ち切られた（2 回目の開始時に 1 回目を数える）
  assert.strictEqual(tick(), false);  // 開始時に 2 回目を数えて 30 分飛ばす
  assert.strictEqual(state().streak, 2);
  assert.strictEqual(tick(), false);  // +15 分: まだ飛ばす
  assert.strictEqual(tick(), true);   // +30 分: 動かす
  assert.strictEqual(state(), null);
});

t('② 止まり続ける間、間引きを 30・60・120・240・240 分と広げる', () => {
  // 動いた実行はすべて打ち切られる（begin だけ）。間引きが決まった時点の幅を記録する
  const widths = [];
  for (let i = 0; i < 200 && widths.length < 5; i++) {
    const before = state();
    killedTick();
    const s = state();
    if (s && s.skipUntil && s.skipUntil !== (before && before.skipUntil)) widths.push((s.skipUntil - clock) / MIN);
  }
  assert.deepStrictEqual(widths, [30, 60, 120, 240, 240]);
});

t('② 2026-10-12 の再現: 03:22〜05:52 に止まり続けても、打ち切りは 10 回でなく 4 回', () => {
  // 実測: 03:22〜05:52 の 11 回のうち 04:07 だけが 2 秒で完了、他は 6 分で打ち切り。06:07 は 98 秒で完了、以後は通常
  const at = (h, m) => Date.UTC(2026, 9, 11, h - 9, m, 5); // JST → UTC
  const stalled = (ms) => ms >= at(3, 22) && ms <= at(5, 52) && ms !== at(4, 7);
  let kills = 0;
  const ranAfter = [];
  for (clock = at(3, 22); clock <= at(9, 7); clock += 15 * MIN) {
    if (stalled(clock)) {
      if (StallGuard.begin(clock, false)) kills++; // 動いたら打ち切られる
    } else {
      const n = reads;
      processAutoReplies(TRIGGER);
      if (reads > n && clock > at(5, 52)) ranAfter.push(new Date(clock + 9 * 3600e3).toISOString().slice(11, 16));
    }
  }
  assert.strictEqual(kills, 4, `打ち切り ${kills} 回`);
  assert.strictEqual(ranAfter[0], '07:52', `止まりが明けて最初に動いたのは ${ranAfter[0]}（間引きの代償。実際は 06:07 に戻っていた）`);
  assert.strictEqual(state(), null);
});

t('③ 180 秒以上かかって終わった実行も数え、2 回続いたら飛ばす', () => {
  readCost = 200 * 1000;
  assert.strictEqual(tick(), true);
  assert.strictEqual(state().streak, 1);
  assert.strictEqual(tick(), true);
  assert.strictEqual(state().streak, 2);
  readCost = 0;
  assert.strictEqual(tick(), false);
});

t('③ 速く終わった実行で数を戻す', () => {
  readCost = 200 * 1000;
  tick();
  readCost = 0;
  tick();
  assert.strictEqual(state(), null);
  readCost = 200 * 1000;
  tick();
  assert.strictEqual(state().streak, 1, '数え直しは 1 から');
});

t('④ 手動実行（引数なし）は間引き中でも動かし、速く終われば間引きを解く', () => {
  killedTick(); killedTick();
  assert.strictEqual(tick(), false);
  clock += 1 * MIN;
  const n = reads;
  processAutoReplies();
  assert.strictEqual(reads, n + 1);
  assert.strictEqual(state(), null);
  assert.strictEqual(tick(), true);
});

t('⑤ 速く例外で終わった実行は数えず、例外は投げ直す', () => {
  readThrows = true;
  assert.throws(() => processAutoReplies(TRIGGER), /Service Spreadsheets failed/);
  assert.strictEqual(state(), null);
});

t('⑤ 止まった後の例外（180 秒以上）は数える', () => {
  readThrows = true;
  readCost = 60 * 1000; // 4 回の試行で 240 秒
  assert.throws(() => processAutoReplies(TRIGGER));
  assert.strictEqual(state().streak, 1);
});

t('⑥ 記録が読めない値なら、間引かずに動かす', () => {
  props.set(STALL.PROPERTY, 'not json');
  assert.strictEqual(tick(), true);
  assert.strictEqual(state(), null);
});

t('⑥ スクリプト プロパティが失敗しても、間引かずに動かす', () => {
  propsFail = true;
  assert.strictEqual(tick(), true);
  assert.strictEqual(tick(), true);
});

if (failures.length > 0) {
  console.log(`stallGuard: ${failures.length} 件 FAILED`);
  process.exit(1);
}
console.log('stallGuard: ALL ASSERTIONS PASSED');
