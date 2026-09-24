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

// 任意項目（2026-09-24 オーナー決定）。route（app/api/reserve/route.ts）が検証済みの値を送るが、GAS は秘密を知る者からの
// 直接の POST も受けるので形を再検証する。不正な値は記帳せず（空欄）、旗を立てる（旗付きは自動送信せず下書き）。
/** 電話: lib/phone.ts と同じ規則（前後の空白を除いて 30 文字以内・数字・空白・+ - ( ) . のみ）。一致は test/optionalFields.test.js が検査 */
const PHONE_RE = /^[0-9 +\-().]*$/;
const PHONE_MAX_LENGTH = 30;
/**
 * 国籍・滞在目的は形だけを見る。列挙の正本は messages/*.json で、route がそれと照合する（GAS に一覧を複製すると、
 * 一覧を変えたときに GAS の貼り直しを忘れるだけで正当な問い合わせが旗付き＝下書きになる）。messages の全値が通ることは
 * test/optionalFields.test.js が検査する
 */
const NATIONALITY_KEY_RE = /^(?:[A-Z]{2}|other)$/;
const MAX_STAY_PURPOSES = 10;
const MAX_STAY_PURPOSE_LENGTH = 60;
/** 先頭がこれらの文字だと Sheets が数式として扱いうる（= + - @） */
const FORMULA_LEAD_RE = /^[=+\-@]/;

export class WebhookParser {
  /**
   * 共有秘密の検証。Web アプリ URL は「全員（匿名）」に公開されているため、URL を知っているだけでは記帳できないようにする。
   * 期待値が未設定・短すぎる場合は拒否する（fail-closed。未設定を「検証しない」にしない）。
   * 両方とも前後の空白を除いてから比べる（スクリプト プロパティや Vercel に貼るときに入る改行・空白で正しい送信を拒否しない。
   * 空白だけの値は除いた後の長さで未設定と同じになる。WO-PB-3F 段階 A）。
   */
  static isAuthorized(payload: unknown, rawExpected: string | null | undefined): boolean {
    if (typeof rawExpected !== 'string') return false;
    const expected = rawExpected.trim();
    if (expected.length < WEBHOOK_SECRET_MIN_LENGTH) return false;
    if (typeof payload !== 'object' || payload === null) return false;
    const rawGiven = (payload as Record<string, unknown>)[WEBHOOK_SECRET_FIELD];
    if (typeof rawGiven !== 'string') return false;
    const given = rawGiven.trim();
    if (given.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  }

  /**
   * ウェブサイトからPOSTされたJSONペイロードをパースする
   */
  static parsePayload(payload: any): InquiryData {
    const checkInDate = new Date(payload.checkin);

    // 任意項目。不正なら空欄にして旗（detectIrregularities が IrregularFlag に入れる）
    const inputFlags: string[] = [];
    const phone = WebhookParser.parsePhone(payload.phone);
    if (phone === null) inputFlags.push('電話番号形式不正');
    const nationality = WebhookParser.parseNationality(payload.nationality);
    if (nationality === null) inputFlags.push('国籍形式不正');
    const stayPurposes = WebhookParser.parseStayPurposes(payload.stay_purposes);
    if (stayPurposes === null) inputFlags.push('滞在目的形式不正');
    
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
      messageId: `WEB-${Date.now()}`,
      phone: phone ?? '',
      nationality: nationality ?? '',
      stayPurposes: stayPurposes ?? '',
      inputFlags,
    };
  }

  /** 電話（任意）。無い・空は ''、不正なら null。値は前後の空白を除いたもの */
  static parsePhone(value: unknown): string | null {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length <= PHONE_MAX_LENGTH && PHONE_RE.test(trimmed) ? trimmed : null;
  }

  /** 国籍（任意）。無い・空は ''、キーの形（JP・other 等）でなければ null */
  static parseNationality(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return '';
    return typeof value === 'string' && NATIONALITY_KEY_RE.test(value) ? value : null;
  }

  /** 滞在目的（任意・ラベルの配列）。無い・空配列は ''、形が不正なら null。記帳は ", " で連結 */
  static parseStayPurposes(value: unknown): string | null {
    if (value === undefined || value === null) return '';
    if (!Array.isArray(value) || value.length > MAX_STAY_PURPOSES) return null;
    const labels: string[] = [];
    for (const v of value) {
      if (typeof v !== 'string') return null;
      const label = v.trim();
      if (label.length < 1 || label.length > MAX_STAY_PURPOSE_LENGTH) return null;
      if (WebhookParser.hasControlChar(label) || FORMULA_LEAD_RE.test(label) || URL_LIKE_RE.test(label)) return null;
      if (labels.includes(label)) return null;
      labels.push(label);
    }
    return labels.join(', ');
  }

  /** C0・DEL・C1 の制御文字と Unicode の行・段落区切り（app/api/reserve/route.ts の hasControlChar と同じ範囲） */
  private static hasControlChar(s: string): boolean {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
    }
    return false;
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

    // 6. 任意項目の値が不正（parsePayload で空欄にしたもの）
    if (inquiry.inputFlags) flags.push(...inquiry.inputFlags);

    return flags.length > 0 ? flags.join(' / ') : 'なし';
  }

  /** メールアドレスの形式と長さ（254 文字まで） */
  static isValidEmail(email: unknown): boolean {
    return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);
  }
}
