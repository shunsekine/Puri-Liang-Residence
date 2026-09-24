import { SpreadsheetService } from './SpreadsheetService';
import { InquiryData } from './Types';
import { CONFIG, COLUMNS } from './Config';
import { errorMessage } from './Retry';

const HOUR_MS = 60 * 60 * 1000;
/** 送信前の状態。これ以外の状態で旗なしの行は「自動返信を経た」とみなす（AutoReplyLimiter.wasAutoReplied） */
const PRE_SEND_STATUSES = ['', 'New', '1次送信待ち', 'エラー'];

/**
 * 自動返信の上限（WO-PB-3F F1: 公開フォームから任意のアドレスへ自動返信を送らせる踏み台を、件数で止める）。
 * - 同じアドレスへは CONFIG.SAME_ADDRESS_AUTO_REPLY_HOURS（24 時間）に 1 通
 * - 1 日（スクリプトのタイムゾーン）の自動返信は Settings.DAILY_AUTO_REPLY_CAP 件まで（未設定・数でなければ既定値）
 * 状態は Inquiries シートの行（実行開始時の読み取り）と、この実行で送った分から数える（getValues はスナップショットなので、
 * 実行中に送った分は recordSent で足す）。
 * シートに送信時刻の列は無いので、受信時刻（B 列）で代用する。送信は受信の 15〜30 分後なので、窓はその分だけ前にずれる。
 */
class AutoReplyLimiter {
  private readonly recent: { email: string; at: number }[] = [];
  private todayCount = 0;
  private readonly today: string;

  constructor(
    private readonly cap: number,
    private readonly now: Date,
    private readonly dayKey: (d: Date) => string,
  ) {
    this.today = dayKey(now);
  }

  static fromSheet(data: unknown[][], now: Date, settings: Record<string, string>): AutoReplyLimiter {
    const tz = Session.getScriptTimeZone();
    const limiter = new AutoReplyLimiter(
      AutoReplyLimiter.parseCap(settings['DAILY_AUTO_REPLY_CAP']),
      now,
      (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
    );
    const I = COLUMNS.INQUIRIES;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!AutoReplyLimiter.wasAutoReplied(r[I.STATUS - 1], r[I.IRREGULAR_FLAG - 1])) continue;
      const at = new Date(r[I.TIMESTAMP - 1] as string | number | Date);
      if (isNaN(at.getTime())) continue;
      limiter.add(String(r[I.EMAIL - 1]), at);
    }
    return limiter;
  }

  /** 未設定・数でない値は既定値（上限を外す方向に倒さない）。0 は「自動送信しない（すべて下書き）」 */
  static parseCap(raw: string | undefined): number {
    const s = String(raw ?? '').trim();
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (s) console.warn('[sendAutoReplies] DAILY_AUTO_REPLY_CAP is not a non-negative integer; using the default');
    return CONFIG.DEFAULT_DAILY_AUTO_REPLY_CAP;
  }

  /**
   * 自動返信（1次送信済）を経た行か。担当者が状態を進めても（空室・クローズ等）数え続けるため、状態の文字列ではなく
   * 「旗なし（＝自動送信の対象）で、送信前の状態でない」で判定する。旗付きの行は下書きなので数えない。
   */
  private static wasAutoReplied(status: unknown, flag: unknown): boolean {
    const f = String(flag ?? '').trim();
    return (f === '' || f === 'なし') && !PRE_SEND_STATUSES.includes(String(status ?? '').trim());
  }

  private static key(email: unknown): string {
    return String(email ?? '').trim().toLowerCase();
  }

  private add(email: string, at: Date): void {
    // 2 日より前の行は 24 時間の窓にも「今日」にも入らない（formatDate を全行に呼ばない）
    if (this.now.getTime() - at.getTime() > 48 * HOUR_MS) return;
    this.recent.push({ email: AutoReplyLimiter.key(email), at: at.getTime() });
    if (this.dayKey(at) === this.today) this.todayCount++;
  }

  /** 送ってはいけない理由（IrregularFlag に書く文言）。送ってよければ null */
  holdReason(email: string): string | null {
    const k = AutoReplyLimiter.key(email);
    const since = this.now.getTime() - CONFIG.SAME_ADDRESS_AUTO_REPLY_HOURS * HOUR_MS;
    if (this.recent.some((r) => r.email === k && r.at > since)) {
      return `同一アドレスへ${CONFIG.SAME_ADDRESS_AUTO_REPLY_HOURS}時間以内に自動返信済み`;
    }
    if (this.todayCount >= this.cap) return `1日の自動返信上限(${this.cap}件)に到達`;
    return null;
  }

  recordSent(email: string): void {
    this.add(email, this.now);
  }
}

export class EmailService {
  /**
   * 定期トリガーから呼ばれる一次対応送信処理（受領から15分以上経過したものを送信）
   */
  static sendAutoReplies(): void {
    // シート読み取りはリトライ付き。ここで失敗した場合は今回の実行を諦め、次回トリガーに任せる
    // （まだ何も送信していないので、失敗させても副作用は無い）
    const data = SpreadsheetService.getAllValues(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!data) return;

    const now = new Date();
    const failures: { rowNum: number; id: string; error: string }[] = [];
    const held: { rowNum: number; id: string; reason: string }[] = [];
    let limiter: AutoReplyLimiter | null = null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[COLUMNS.INQUIRIES.STATUS - 1];
      const timestamp = new Date(row[COLUMNS.INQUIRIES.TIMESTAMP - 1]);
      if (status !== '1次送信待ち') continue;

      // 受信から15分以上経過しているかチェック
      const diffMin = (now.getTime() - timestamp.getTime()) / (1000 * 60);
      if (diffMin < CONFIG.DELAY_FOR_AUTO_REPLY_MINUTES) continue;

      const rowNum = i + 1;
      // 送信上限の判定材料（Settings の上限値・シートの送信履歴）は、送る候補が初めて出たときに 1 回だけ用意する。
      // この時点ではまだ何も送っていないので、読み取りに失敗したら今回の実行を諦めて次回に任せる（行を「エラー」にしない）
      if (!limiter) limiter = AutoReplyLimiter.fromSheet(data, now, SpreadsheetService.getSettings());
      // 行単位で隔離: 1行の失敗で後続の問い合わせが止まらないようにする
      try {
        const inquiry = SpreadsheetService.getInquiryByRow(rowNum);
        if (inquiry) {
          const reason = this.sendInitialReply(inquiry, rowNum, limiter);
          if (reason) held.push({ rowNum, id: String(inquiry.id), reason });
        }
      } catch (error) {
        const message = errorMessage(error);
        const id = String(row[COLUMNS.INQUIRIES.ID - 1]);
        console.error(`[sendAutoReplies] row ${rowNum} (${id}) failed: ${message}`);
        failures.push({ rowNum, id, error: message });

        // 同じ行で毎回失敗し続ける（10〜15分ごとに通知が飛ぶ）のを防ぐため 'エラー' に退避。
        // 担当者が原因を直して '1次送信待ち' に戻せば再処理される。
        // ここも失敗した場合は '1次送信待ち' のまま残り、次回実行で再試行される
        // （sendEmail 成功後に updateStatus が失敗したケースでは二重送信になりうる。残存リスクとして許容）。
        try {
          SpreadsheetService.updateStatus(rowNum, 'エラー');
        } catch (e) {
          console.error(`[sendAutoReplies] failed to mark row ${rowNum} as error: ${errorMessage(e)}`);
        }
      }
    }

    if (failures.length > 0) {
      this.notifyOwnerOfFailures(failures);
    }
    if (held.length > 0) {
      this.notifyOwnerOfHeld(held);
    }
  }

  /**
   * 送信上限で保留（下書き）にした行を担当者へまとめて通知（1実行につき1通。行ごとの通知は出さない＝
   * 大量の問い合わせで担当者宛ての送信が Gmail の送信上限を食わないように）
   */
  private static notifyOwnerOfHeld(held: { rowNum: number; id: string; reason: string }[]): void {
    try {
      const settings = SpreadsheetService.getSettings();
      const notifyEmail = settings['NOTIFICATION_EMAIL'];
      if (!notifyEmail) return;

      const subject = `【要確認】送信上限のため一次返信を ${held.length} 件保留しました`;
      const lines = [
        '自動返信の送信上限に当たったため、以下の問い合わせは送信せず Gmail の下書きにしました（IrregularFlag に理由を追記、ステータスは「最終送信待ち」）。',
        '本物の問い合わせなら下書きを確認して送信してください。心当たりのない宛先への問い合わせが大量に来ている場合は、フォームの悪用（第三者へのスパム送信）の可能性があります。その場合は下書きを送らずに削除してください。',
        '',
        ...held.map(h => `- 行 ${h.rowNum} / ${h.id}: ${h.reason}`),
        '',
        `上限: 同じアドレスへは ${CONFIG.SAME_ADDRESS_AUTO_REPLY_HOURS} 時間に 1 通・1 日 DAILY_AUTO_REPLY_CAP 件（Settings シート。未設定なら ${CONFIG.DEFAULT_DAILY_AUTO_REPLY_CAP} 件）。`,
      ];
      GmailApp.sendEmail(notifyEmail, subject, lines.join('\n'));
    } catch (error) {
      // 通知自体の失敗で本処理を落とさない（実行ログには残す）
      console.error(`[notifyOwnerOfHeld] ${errorMessage(error)}`);
    }
  }

  /**
   * 一次返信処理で失敗した行を担当者へまとめて通知（1実行につき1通）
   */
  private static notifyOwnerOfFailures(failures: { rowNum: number; id: string; error: string }[]): void {
    try {
      const settings = SpreadsheetService.getSettings();
      const notifyEmail = settings['NOTIFICATION_EMAIL'];
      if (!notifyEmail) return;

      const subject = `【GASエラー】一次返信処理で ${failures.length} 件失敗しました`;
      const lines = [
        '一次返信の自動処理で失敗した問い合わせがあります。',
        '該当行のステータスは「エラー」に変更済みです。原因を修正のうえ「1次送信待ち」に戻すと再処理されます。',
        '',
        ...failures.map(f => `- 行 ${f.rowNum} / ${f.id}: ${f.error}`),
        '',
        '※ "Service Spreadsheets failed while accessing document" はGoogle側の一過性エラーです。リトライ後も失敗した場合のみここに載ります。',
      ];
      GmailApp.sendEmail(notifyEmail, subject, lines.join('\n'));
    } catch (error) {
      // 通知自体の失敗で本処理を落とさない（実行ログには残す）
      console.error(`[notifyOwnerOfFailures] ${errorMessage(error)}`);
    }
  }

  /**
   * 一次返信の送信または下書き作成。送信上限で保留した場合はその理由を返す（担当者への通知は呼び出し側で 1 通にまとめる）
   */
  static sendInitialReply(inquiry: InquiryData, rowNum: number, limiter: AutoReplyLimiter): string | null {
    const templateId = inquiry.periodCategory === '1ヶ月以上先' 
      ? `1MonthLater_${inquiry.language}` 
      : `1MonthWithin_${inquiry.language}`;

    const template = SpreadsheetService.getTemplate(templateId);
    if (!template) {
      console.error(`Template not found: ${templateId}`);
      return null;
    }

    const body = this.replacePlaceholders(template.body, inquiry);
    const subject = this.replacePlaceholders(template.subject, inquiry);

    if (inquiry.irregularFlag && inquiry.irregularFlag !== 'なし') {
      // イレギュラーがある場合は下書きとして作成
      this.createAlertDraft(inquiry, subject, body);
      SpreadsheetService.updateStatus(rowNum, '最終送信待ち');
    } else {
      // 自動送信の直前に送信上限を判定する（WO-PB-3F F1）。当たれば送らずに旗を追記して下書き
      const reason = limiter.holdReason(inquiry.email);
      if (reason) {
        const current = inquiry.irregularFlag;
        inquiry.irregularFlag = current && current !== 'なし' ? `${current} / ${reason}` : reason;
        SpreadsheetService.updateIrregularFlag(rowNum, inquiry.irregularFlag);
        this.createAlertDraft(inquiry, subject, body);
        SpreadsheetService.updateStatus(rowNum, '最終送信待ち');
        return reason;
      }
      // 正常な場合は自動送信（送った直後に数える。後続の状態更新が失敗しても、送った事実は上限に入れる）
      GmailApp.sendEmail(inquiry.email, subject, body);
      limiter.recordSent(inquiry.email);
      SpreadsheetService.updateStatus(rowNum, '1次送信済');
    }

    this.notifyOwnerOfReply(inquiry);
    return null;
  }

  /**
   * イレギュラー（旗付き・送信上限）の問い合わせへの返信を、担当者の確認用の下書きとして作成
   */
  private static createAlertDraft(inquiry: InquiryData, subject: string, body: string): void {
    const alertBody = `【システムアラート: 要確認】\n以下の問い合わせにフラグが検出されました: ${inquiry.irregularFlag}\n\n------------------------\n${body}`;
    GmailApp.createDraft(inquiry.email, `【要確認】${subject}`, alertBody);
  }

  /**
   * 一次返信の送信（またはイレギュラー時の下書き作成）を担当者へ通知
   */
  private static notifyOwnerOfReply(inquiry: InquiryData): void {
    const settings = SpreadsheetService.getSettings();
    const notifyEmail = settings['NOTIFICATION_EMAIL'];
    if (!notifyEmail) return;

    const hasFlag = !!inquiry.irregularFlag && inquiry.irregularFlag !== 'なし';
    const subject = hasFlag
      ? `【要確認】新規問い合わせ: ${inquiry.id} (${inquiry.name}様)`
      : `【一次返信送信済】新規問い合わせ: ${inquiry.id} (${inquiry.name}様)`;

    const lines = [
      '新しい問い合わせに一次対応しました。',
      '',
      `ID: ${inquiry.id}`,
      `Name: ${inquiry.name}`,
      `Email: ${inquiry.email}`,
      `Check-in: ${inquiry.checkIn.toLocaleDateString()}`,
      `Check-out: ${inquiry.checkOut.toLocaleDateString()}`,
      `Room: ${inquiry.roomType}`,
      `Guests: ${inquiry.guests}`,
      '',
      hasFlag
        ? `※イレギュラー検知: ${inquiry.irregularFlag}\nGmailの下書きを確認のうえ送信してください。`
        : '定型の一次返信を自動送信済みです。空室状況が分かり次第、スプレッドシートのステータスを更新してください。',
    ];

    GmailApp.sendEmail(notifyEmail, subject, lines.join('\n'));
  }

  /**
   * 最終回答の新規下書き作成（新規メール下書きとして生成）
   */
  static createDraftForFinalAnswer(inquiry: InquiryData, status: string): void {
    let templateId = '';
    if (status === '空室') {
      templateId = `Available_${inquiry.language}`;
    } else if (status === '満室') {
      templateId = `Full_${inquiry.language}`;
    } else if (status === 'キャンセル待ち') {
      templateId = `AcceptWaiting_${inquiry.language}`;
    }

    if (!templateId) return;

    const template = SpreadsheetService.getTemplate(templateId);
    if (template) {
      const body = this.replacePlaceholders(template.body, inquiry);
      const subject = `Re: ${this.replacePlaceholders(template.subject, inquiry)} (${inquiry.id})`;
      
      // Webリクエスト起点のため、新規の下書きメールとして生成
      GmailApp.createDraft(inquiry.email, subject, body);
    }
  }

  /**
   * テキストのプレースホルダーを置換
   */
  private static replacePlaceholders(text: string, inquiry: InquiryData): string {
    return text
      .replace(/{ID}/g, inquiry.id || '')
      .replace(/{Name}/g, inquiry.name)
      .replace(/{CheckIn}/g, inquiry.checkIn.toLocaleDateString())
      .replace(/{CheckOut}/g, inquiry.checkOut.toLocaleDateString())
      .replace(/{RoomType}/g, inquiry.roomType)
      .replace(/{Guests}/g, inquiry.guests.toString());
  }
}
