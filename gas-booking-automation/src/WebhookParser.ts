import { InquiryData } from './Types';

/** プロキシ（app/api/reserve/route.ts）が本文に付ける共有秘密のフィールド名。doPost は HTTP ヘッダーを読めないため本文で渡す。 */
export const WEBHOOK_SECRET_FIELD = 'webhook_secret';
/** スクリプト プロパティのキー。値は Vercel の GAS_WEBHOOK_SECRET と同じ。シートに置かない（オーナー側に見えるため）。 */
export const WEBHOOK_SECRET_PROPERTY = 'WEBHOOK_SECRET';
/** これより短い秘密は未設定と同じ扱い（推測・総当たりに耐えない値で「設定済み」にしない）。 */
export const WEBHOOK_SECRET_MIN_LENGTH = 32;
/** app/api/reserve/route.ts・components/pages/ReserveForm.tsx の validate() と同じ式（WO-PB-3F F1） */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 氏名に URL らしき文字列（{Name} 経由で自動返信の本文へ宣伝・誘導文を差し込ませない。WO-PB-3F F1） */
const URL_LIKE_RE = /http|www\.|:\/\//i;

export class WebhookParser {
  /**
   * 共有秘密の検証。Web アプリ URL は「全員（匿名）」に公開されているため、URL を知っているだけでは記帳できないようにする。
   * 期待値が未設定・短すぎる場合は拒否する（fail-closed。未設定を「検証しない」にしない）。
   */
  static isAuthorized(payload: unknown, expected: string | null | undefined): boolean {
    if (typeof expected !== 'string' || expected.length < WEBHOOK_SECRET_MIN_LENGTH) return false;
    if (typeof payload !== 'object' || payload === null) return false;
    const given = (payload as Record<string, unknown>)[WEBHOOK_SECRET_FIELD];
    if (typeof given !== 'string' || given.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  }

  /**
   * ウェブサイトからPOSTされたJSONペイロードをパースする
   */
  static parsePayload(payload: any): InquiryData {
    const checkInDate = new Date(payload.checkin);
    
    // 1ヶ月ルールの判定 (チェックインが30日以上先か)
    const today = new Date();
    const diffTime = checkInDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const periodCategory = diffDays >= 30 ? '1ヶ月以上先' : '1ヶ月以内';

    return {
      // 受信時刻はサーバー時刻。payload.submitted_at は送り手が自由に書けるので使わない
      // （過去にすると 15 分の待ちを飛ばして即時送信できた。WO-PB-3F F2）
      timestamp: new Date(),
      name: payload.name || 'Unknown',
      email: payload.email,
      language: payload.language || 'en',
      checkIn: checkInDate,
      checkOut: new Date(payload.checkout),
      roomType: payload.room || payload.room_id || 'villa',
      guests: parseInt(payload.guests, 10) || 1,
      remarks: payload.notes || '',
      periodCategory: periodCategory,
      messageId: `WEB-${Date.now()}`
    };
  }

  /**
   * ウェブサイトの規定（定員、NGワード）に基づきイレギュラーを検知する
   */
  static detectIrregularities(inquiry: InquiryData, settings: Record<string, string>): string {
    const flags: string[] = [];

    // 1. サイト規定の部屋定員チェック (lib/data.ts に準拠)
    const capacities: Record<string, number> = {
      'villa': 4,
      'king': 2,
      'twin': 2
    };
    
    const roomKey = String(inquiry.roomType).toLowerCase();
    let maxCapacity = 2; // デフォルト
    if (roomKey.includes('villa')) maxCapacity = 4;
    else if (roomKey.includes('king')) maxCapacity = 2;
    else if (roomKey.includes('twin')) maxCapacity = 2;

    if (inquiry.guests > maxCapacity) {
      flags.push(`定員超過(上限${maxCapacity}名に対し${inquiry.guests}名)`);
    }

    // 2. 規約外要望（NGキーワード）チェック
    const defaultNgWords = ['party', 'smoke', 'smoking', 'free cancel', 'refund', 'discount', 'pet', 'pets'];
    const sheetNgWordsStr = settings['NG_KEYWORDS'] || '';
    const sheetNgWords = sheetNgWordsStr.split(',').map(w => w.trim().toLowerCase()).filter(w => w);
    const ngWords = Array.from(new Set([...defaultNgWords, ...sheetNgWords]));
    
    const remarksLower = inquiry.remarks.toLowerCase();
    for (const word of ngWords) {
      if (remarksLower.includes(word)) {
        flags.push(`規約外キーワード検知("${word}")`);
      }
    }

    // 3. 過去日付チェック（チェックインが本日より前）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDay = new Date(inquiry.checkIn);
    checkInDay.setHours(0, 0, 0, 0);
    if (checkInDay.getTime() < today.getTime()) {
      flags.push(`過去日付検知(チェックイン: ${inquiry.checkIn.toLocaleDateString()})`);
    }

    // 4. メール形式（WO-PB-3F F1）。route でも検証するが、判定は記帳する側にも置く（旗付きは自動送信せず下書き）
    if (!WebhookParser.isValidEmail(inquiry.email)) {
      flags.push('メール形式不正');
    }

    // 5. 氏名に URL らしき文字列（WO-PB-3F F1）
    if (URL_LIKE_RE.test(String(inquiry.name))) {
      flags.push('氏名にURL');
    }

    return flags.length > 0 ? flags.join(' / ') : 'なし';
  }

  /** メールアドレスの形式と長さ（254 文字まで） */
  static isValidEmail(email: unknown): boolean {
    return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);
  }
}
