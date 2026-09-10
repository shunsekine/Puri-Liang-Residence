/**
 * Google 側の一過性エラー（例: "Service Spreadsheets failed while accessing document with id ..."）を
 * 吸収するための指数バックオフ付きリトライ。
 *
 * 対象は冪等な操作（スプレッドシートの読み取り・ステータス更新）に限る。
 * GmailApp.sendEmail / createDraft は成功したのに例外が返る可能性がゼロではなく、
 * リトライすると二重送信になりうるためラップしない。
 */
export const RETRY = {
  MAX_ATTEMPTS: 4,        // 初回 + 3回の再試行
  BASE_DELAY_MS: 1000,    // 待機: 1s → 2s → 4s（合計 7s）
};

/** 例外からメッセージ文字列を取り出す（Error 以外が投げられても落ちない） */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function withRetry<T>(label: string, fn: () => T): T {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      return fn();
    } catch (error) {
      lastError = error;
      if (attempt < RETRY.MAX_ATTEMPTS) {
        const delay = RETRY.BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[withRetry] ${label} failed (attempt ${attempt}/${RETRY.MAX_ATTEMPTS}), retrying in ${delay}ms: ${errorMessage(error)}`);
        Utilities.sleep(delay);
      }
    }
  }
  console.error(`[withRetry] ${label} failed after ${RETRY.MAX_ATTEMPTS} attempts`);
  throw lastError;
}
