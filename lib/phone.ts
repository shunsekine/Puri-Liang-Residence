// 予約フォームの WhatsApp / 電話番号（任意項目）の規則。フォーム（components/pages/ReserveForm.tsx の validate()）と
// route（app/api/reserve/route.ts）はこの関数を共有する（片方だけ変えない）。
// GAS（gas-booking-automation/src/WebhookParser.ts）は別プロジェクトに貼るため同じ式を持つ。一致は
// gas-booking-automation/test/optionalFields.test.js が検査する。
// 英字・= @ などを許さないので、Sheets に数式（=HYPERLINK 等）として記帳されることもない。

/** 前後の空白を除いた長さの上限 */
export const PHONE_MAX_LENGTH = 30;
/** 数字・空白・+ - ( ) . のみ（空は「未入力」として通す） */
const PHONE_RE = /^[0-9 +\-().]*$/;

/** 前後の空白を除いた値を渡す。空文字は未入力として true。 */
export function isValidPhone(trimmed: string): boolean {
  return trimmed.length <= PHONE_MAX_LENGTH && PHONE_RE.test(trimmed);
}

/** フォームの入力を送る形にする（全角の数字・記号・空白を半角にし、前後の空白を除く）。route はこの変換をしない（厳密に検証する）。 */
export function normalizePhoneInput(raw: string): string {
  return raw.normalize('NFKC').trim();
}
