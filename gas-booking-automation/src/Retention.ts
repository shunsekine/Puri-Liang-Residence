import { CONFIG, COLUMNS, PRE_FIRST_REPLY_STATUSES } from './Config';
import { SpreadsheetService } from './SpreadsheetService';
import { EmailService } from './EmailService';

/** 暦日の差を数えるための 1 日（ミリ秒）。日付はスクリプトのタイムゾーンの yyyy-MM-dd にしてから比べる */
const RETENTION_DAY_MS = 24 * 60 * 60 * 1000;

type RowRef = { rowNum: number; id: string };

/**
 * 個人データの保存期間（2026-09-24 オーナー決定: 約 2 年）。Main.anonymizeExpiredInquiries（月 1 回の定期トリガー）から呼ぶ。
 *
 * - 対象: 受信日時（B列）とチェックアウト日（G列）の遅い方から Settings.RETENTION_DAYS 日を「過ぎた」行
 *   （スクリプトのタイムゾーンの暦日で数えて RETENTION_DAYS + 1 日目以降）。チェックアウトが先の予約は、それが過ぎるまで残す
 * - 消すもの: ゲストが入力した値と、それを含む生成文（personalDataColumns）。ID・日付・部屋・人数・ステータス・旗・言語は
 *   帳簿として残す。行は削除しない（ID は getLastRow で採番するので、削除すると ID が再利用される）
 * - 触らない行: 匿名化済み（S列 AnonymizedAt あり）・一次返信前（PRE_FIRST_REPLY_STATUSES）・ID が空・日付が読めない
 * - 書き込みは SpreadsheetService.anonymizeRows（まとめて・リトライ付き・書く直前に ID を照合）
 */
export class RetentionService {
  /** 匿名化で空にする列（ゲストの入力と、それを含む WhatsApp 文面）。関数にしているのは、Apps Script で他ファイルの
   * 定数をトップレベルから参照しないため（ファイルの読み込み順に依存させない） */
  static personalDataColumns(): number[] {
    const I = COLUMNS.INQUIRIES;
    return [I.NAME, I.EMAIL, I.REMARKS, I.WHATSAPP_TEXT, I.PHONE, I.NATIONALITY, I.STAY_PURPOSES];
  }

  /**
   * Settings.RETENTION_DAYS。空・未設定は既定値。数でない・下限未満は例外（何も消さずに止める。入力ミスで消しすぎない。
   * 定期トリガーの失敗として Apps Script の失敗通知が届く）
   */
  static parseRetentionDays(raw: string | undefined): number {
    const s = String(raw ?? '').trim();
    if (s === '') return CONFIG.DEFAULT_RETENTION_DAYS;
    if (/^\d+$/.test(s)) {
      const days = parseInt(s, 10);
      if (days >= CONFIG.MIN_RETENTION_DAYS) return days;
    }
    throw new Error(`Settings の RETENTION_DAYS "${s}" が不正です（${CONFIG.MIN_RETENTION_DAYS} 以上の整数。空なら ${CONFIG.DEFAULT_RETENTION_DAYS}）。何も匿名化していません`);
  }

  /** 保存期間を過ぎた行を選ぶ（シートには触らない）。expired は匿名化する行、pending は過ぎているが一次返信前で触らない行 */
  static selectExpired(data: unknown[][], now: Date, retentionDays: number, dayKey: (d: Date) => string): { expired: RowRef[]; pending: RowRef[] } {
    const I = COLUMNS.INQUIRIES;
    const today = RetentionService.dayNumber(dayKey(now));
    const expired: RowRef[] = [];
    const pending: RowRef[] = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (String(r[I.ANONYMIZED_AT - 1] ?? '').trim() !== '') continue;
      const id = String(r[I.ID - 1] ?? '').trim();
      if (!id) continue;
      const ref = RetentionService.laterDate(r[I.TIMESTAMP - 1], r[I.CHECK_OUT - 1]);
      if (!ref) continue;
      if (today - RetentionService.dayNumber(dayKey(ref)) <= retentionDays) continue;
      const target = { rowNum: i + 1, id };
      if (PRE_FIRST_REPLY_STATUSES.includes(String(r[I.STATUS - 1] ?? '').trim())) pending.push(target);
      else expired.push(target);
    }
    return { expired, pending };
  }

  /** 保存期間を過ぎた行を匿名化し、担当者へ 1 通（匿名化した行があるときだけ）。匿名化した件数を返す */
  static anonymizeExpired(now: Date): number {
    // 設定を先に読む（不正なら何も読まず・消さずに止める）
    const retentionDays = RetentionService.parseRetentionDays(SpreadsheetService.getSettings()['RETENTION_DAYS']);
    const data = SpreadsheetService.getAllValues(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!data) return 0;

    const tz = Session.getScriptTimeZone();
    const { expired, pending } = RetentionService.selectExpired(data, now, retentionDays, (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd'));
    if (pending.length > 0) console.warn(`[anonymizeExpiredInquiries] ${pending.length} expired rows skipped (first reply still pending)`);

    const done = SpreadsheetService.anonymizeRows(expired, RetentionService.personalDataColumns(), now);
    if (done.length < expired.length) console.warn(`[anonymizeExpiredInquiries] ${expired.length - done.length} rows moved after reading; left for the next run`);
    console.log(`[anonymizeExpiredInquiries] anonymized ${done.length} rows (retention ${retentionDays} days)`);
    if (done.length > 0) EmailService.notifyOwnerOfAnonymized(done, retentionDays, pending);
    return done.length;
  }

  /** 受信日時とチェックアウト日の遅い方。どちらも日付として読めなければ null */
  private static laterDate(a: unknown, b: unknown): Date | null {
    const dates = [a, b].map(RetentionService.toDate).filter((d): d is Date => d !== null);
    if (dates.length === 0) return null;
    return dates.reduce((x, y) => (x.getTime() >= y.getTime() ? x : y));
  }

  /** セルの値（getValues は日付を Date で返す）を Date に。空・数値・読めない文字列は null */
  private static toDate(v: unknown): Date | null {
    let d: Date | null = null;
    if (v instanceof Date) d = v;
    else if (typeof v === 'string' && v.trim() !== '') d = new Date(v);
    return d && !isNaN(d.getTime()) ? d : null;
  }

  /** yyyy-MM-dd → 1970-01-01 からの日数（暦日の差を数えるため） */
  private static dayNumber(ymd: string): number {
    const [y, m, d] = ymd.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / RETENTION_DAY_MS);
  }
}
