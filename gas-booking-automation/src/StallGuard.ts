import { errorMessage } from './Retry';

/**
 * processAutoReplies が打ち切られ続けたとき（Google 側でシートの操作が止まったとき）に、次の実行を間引く。
 *
 * 背景（2026-10-12）: シートの読み取りが例外を出さずに止まり、3 時間半で 10 回、6 分の上限で打ち切られた。無料アカウントの
 * トリガーは 1 日の実行時間の合計が 90 分までで、この日は約 69 分を使った。上限に達すると一次返信・最終回答の下書き
 * （onStatusEdit）・リマインダーのトリガーが最大 24 時間止まる。止まっている間に実行を続けても 6 分ずつ失うだけなので間引く。
 *
 * 判定: 開始時に印（startedAt）を書き、最後まで動いたら消す。打ち切られた実行は finally も通らないので印が残り、次の実行が
 * 「前回は止まった」と数える。最後まで動いても STALL.SLOW_RUN_MS 以上かかった実行（止まった後に戻った・止まった後に例外）も
 * 数える。2 回続いたら 30 分 → 60 分 → 120 分 → 240 分（以後 240 分）の間、定期実行を飛ばす。速く終わった実行で数を戻す。
 * 状態はスクリプト プロパティ STALL.PROPERTY に JSON で 1 つ（止まったのはシート。保存先を分ける）。
 * ここで例外が出ても一次返信は止めない（間引かずに動かす）。エディタからの手動実行（引数なし）は間引かない。
 */
export const STALL = {
  PROPERTY: 'AUTO_REPLY_STALL_GUARD',
  /** これ以上かかった実行は、最後まで動いても「止まった」と数える（ふだんは 2〜7 秒。上限は 360 秒） */
  SLOW_RUN_MS: 180000,
  /** 止まった実行がこの回数続いたら間引き始める（1 回だけなら次も動かす） */
  MIN_STREAK_TO_SKIP: 2,
  BASE_SKIP_MINUTES: 30,
  MAX_SKIP_MINUTES: 240,
};

interface StallState {
  /** 実行中の印（開始時刻 ms）。次の実行の開始時に残っていれば、その実行は打ち切られた */
  startedAt?: number;
  /** 続けて止まった回数 */
  streak?: number;
  /** この時刻（ms）までは定期実行を飛ばす */
  skipUntil?: number;
}

export class StallGuard {
  /**
   * 実行の開始。動かしてよければ true（呼び出し側は処理の後に必ず end を呼ぶ）、間引くなら false。
   * manual は手動実行（間引かない。打ち切りの印は同じように付ける）
   */
  static begin(nowMs: number, manual: boolean): boolean {
    try {
      let state = StallGuard.read();
      const interrupted = state.startedAt !== undefined;
      if (interrupted) {
        console.warn(`[StallGuard] the previous run (started ${new Date(state.startedAt as number).toISOString()}) did not finish`);
        state = StallGuard.countStall(state, nowMs);
      }
      if (!manual && state.skipUntil !== undefined && nowMs < state.skipUntil) {
        console.warn(`[StallGuard] skipping this run until ${new Date(state.skipUntil).toISOString()} (stalled ${state.streak} times in a row)`);
        if (interrupted) StallGuard.write(state);
        return false;
      }
      state.startedAt = nowMs;
      StallGuard.write(state);
    } catch (error) {
      console.error(`[StallGuard] begin failed; running without the guard: ${errorMessage(error)}`);
    }
    return true;
  }

  /** 実行の終わり（例外で終わったときも呼ぶ）。遅かったら数え、速ければ数を戻す */
  static end(startMs: number, nowMs: number): void {
    try {
      let state = StallGuard.read();
      delete state.startedAt;
      if (nowMs - startMs >= STALL.SLOW_RUN_MS) {
        console.warn(`[StallGuard] this run took ${Math.round((nowMs - startMs) / 1000)}s`);
        state = StallGuard.countStall(state, nowMs);
      } else {
        state = {};
      }
      StallGuard.write(state);
    } catch (error) {
      console.error(`[StallGuard] end failed: ${errorMessage(error)}`);
    }
  }

  /** 止まった実行を 1 回数え、続いていれば間引く期間を決める（startedAt は消す） */
  private static countStall(state: StallState, nowMs: number): StallState {
    const streak = (state.streak ?? 0) + 1;
    const next: StallState = { streak };
    if (streak >= STALL.MIN_STREAK_TO_SKIP) {
      const minutes = Math.min(STALL.BASE_SKIP_MINUTES * Math.pow(2, streak - STALL.MIN_STREAK_TO_SKIP), STALL.MAX_SKIP_MINUTES);
      next.skipUntil = nowMs + minutes * 60 * 1000;
    }
    return next;
  }

  /** 読めない値（手で書き換えた等）は「何も記録が無い」とみなす（間引かない側に倒す） */
  private static read(): StallState {
    const raw = PropertiesService.getScriptProperties().getProperty(STALL.PROPERTY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return {};
      const state: StallState = {};
      if (typeof parsed.startedAt === 'number') state.startedAt = parsed.startedAt;
      if (typeof parsed.streak === 'number') state.streak = parsed.streak;
      if (typeof parsed.skipUntil === 'number') state.skipUntil = parsed.skipUntil;
      return state;
    } catch {
      return {};
    }
  }

  private static write(state: StallState): void {
    const props = PropertiesService.getScriptProperties();
    if (Object.keys(state).length === 0) props.deleteProperty(STALL.PROPERTY);
    else props.setProperty(STALL.PROPERTY, JSON.stringify(state));
  }
}
