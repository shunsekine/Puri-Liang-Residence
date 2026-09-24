import { SpreadsheetService } from './SpreadsheetService';
import { InquiryData } from './Types';
import { CONFIG, COLUMNS, PRE_FIRST_REPLY_STATUSES } from './Config';
import { errorMessage } from './Retry';

const HOUR_MS = 60 * 60 * 1000;
/** 最終回答のステータス → テンプレートの種類（Templates シートの `${種類}_${言語}`） */
const FINAL_ANSWER_TEMPLATE_KINDS: Record<string, string> = { '空室': 'Available', '満室': 'Full', 'キャンセル待ち': 'AcceptWaiting' };

/** Templates シートから選んだテンプレート。fallbackFrom は、無かったので英語で代用した元の ID（代用していなければ null） */
interface ResolvedTemplate {
  id: string;
  subject: string;
  body: string;
  fallbackFrom: string | null;
}

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
   * 「旗なし（＝自動送信の対象）で、送信前の状態（PRE_FIRST_REPLY_STATUSES）でない」で判定する。旗付きの行は下書きなので数えない。
   */
  private static wasAutoReplied(status: unknown, flag: unknown): boolean {
    const f = String(flag ?? '').trim();
    return (f === '' || f === 'なし') && !PRE_FIRST_REPLY_STATUSES.includes(String(status ?? '').trim());
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
   * テンプレートを `${kind}_${言語}` → `${kind}_en` の順に探す。どちらも無ければ例外（黙って送らないままにしない。
   * 一次返信は sendAutoReplies の行単位の隔離で「エラー」＋担当者への失敗通知になり、最終回答は onEdit がセルにメモを残す）
   */
  private static resolveTemplate(kind: string, language: string): ResolvedTemplate {
    const lang = String(language ?? '').trim() || CONFIG.TEMPLATE_FALLBACK_LANGUAGE;
    const wanted = `${kind}_${lang}`;
    const fallback = `${kind}_${CONFIG.TEMPLATE_FALLBACK_LANGUAGE}`;
    const ids = wanted === fallback ? [wanted] : [wanted, fallback];
    const found = SpreadsheetService.findTemplate(ids);
    if (!found) {
      throw new Error(`Templates シートにテンプレートがありません（件名・本文が空の行も含む）: ${ids.join(' / ')}`);
    }
    return { ...found, fallbackFrom: found.id === wanted ? null : wanted };
  }

  /** 英語で代用したことの担当者向けの注記（代用していなければ null） */
  private static fallbackNote(template: ResolvedTemplate): string | null {
    if (!template.fallbackFrom) return null;
    return `※ Templates シートに ${template.fallbackFrom} が無いため、英語のテンプレート ${template.id} を使いました。` +
      `${template.fallbackFrom} の行（件名・本文）を追加すると、次からはそちらを使います。`;
  }

  /**
   * 一次返信の送信または下書き作成。送信上限で保留した場合はその理由を返す（担当者への通知は呼び出し側で 1 通にまとめる）。
   * テンプレートが無ければ例外（呼び出し側で行を「エラー」にして担当者へ通知）
   */
  static sendInitialReply(inquiry: InquiryData, rowNum: number, limiter: AutoReplyLimiter): string | null {
    const kind = inquiry.periodCategory === '1ヶ月以上先' ? '1MonthLater' : '1MonthWithin';
    const template = this.resolveTemplate(kind, inquiry.language);

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

    this.notifyOwnerOfReply(inquiry, this.fallbackNote(template));
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
   * 一次返信の送信（またはイレギュラー時の下書き作成）を担当者へ通知。templateNote は英語のテンプレートで代用したときの注記
   * （通知を増やさず、この 1 通に書く）
   */
  private static notifyOwnerOfReply(inquiry: InquiryData, templateNote: string | null): void {
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
      // 任意項目（未回答は "-"）。WhatsApp 文面（N列）には入れない
      `WhatsApp/Phone: ${inquiry.phone || '-'}`,
      `Nationality: ${inquiry.nationality || '-'}`,
      `Purpose of stay: ${inquiry.stayPurposes || '-'}`,
      '',
      hasFlag
        ? `※イレギュラー検知: ${inquiry.irregularFlag}\nGmailの下書きを確認のうえ送信してください。`
        : '定型の一次返信を自動送信済みです。空室状況が分かり次第、スプレッドシートのステータスを更新してください。',
    ];
    if (templateNote) lines.push('', templateNote);

    GmailApp.sendEmail(notifyEmail, subject, lines.join('\n'));
  }

  /**
   * 最終回答の新規下書き作成（新規メール下書きとして生成）。
   * 英語で代用したときはその注記を返す（onEdit がステータスのセルにメモする）。テンプレートが無ければ例外
   */
  static createDraftForFinalAnswer(inquiry: InquiryData, status: string): { note: string | null } | null {
    // 自分のキーだけを見る（添字だと constructor 等のプロトタイプのキーが通る）
    if (!Object.prototype.hasOwnProperty.call(FINAL_ANSWER_TEMPLATE_KINDS, status)) return null;
    const kind = FINAL_ANSWER_TEMPLATE_KINDS[status];

    const template = this.resolveTemplate(kind, inquiry.language);
    const body = this.replacePlaceholders(template.body, inquiry);
    const subject = `Re: ${this.replacePlaceholders(template.subject, inquiry)} (${inquiry.id})`;

    // Webリクエスト起点のため、新規の下書きメールとして生成
    GmailApp.createDraft(inquiry.email, subject, body);
    return { note: this.fallbackNote(template) };
  }

  /**
   * 保存期間を過ぎて匿名化した問い合わせを担当者へまとめて通知（1 実行 1 通）。ID だけを書き、個人データは入れない
   */
  static notifyOwnerOfAnonymized(done: { rowNum: number; id: string }[], retentionDays: number, pending: { rowNum: number; id: string }[]): void {
    try {
      const settings = SpreadsheetService.getSettings();
      const notifyEmail = settings['NOTIFICATION_EMAIL'];
      if (!notifyEmail) return;

      const subject = `【個人データの整理】保存期間を過ぎた問い合わせ ${done.length} 件を匿名化しました`;
      const lines = [
        `Inquiries シートで、受信日時とチェックアウト日の遅い方から ${retentionDays} 日（Settings の RETENTION_DAYS）を過ぎた問い合わせの個人データを消しました。`,
        '消した列: 氏名・メール・備考・WhatsApp 文面・電話・国籍・滞在目的。ID・日付・部屋・人数・ステータスは帳簿として残しています（行は削除していません）。',
        '匿名化した行は AnonymizedAt 列（S列）に日時が入っています。',
        '',
        ...done.map(d => `- 行 ${d.rowNum} / ${d.id}`),
      ];
      if (pending.length > 0) {
        lines.push(
          '',
          '次の行は保存期間を過ぎていますが、一次返信前（1次送信待ち・エラー等）のため触っていません。ステータスを整理すると次回の実行で匿名化されます。',
          ...pending.map(d => `- 行 ${d.rowNum} / ${d.id}`),
        );
      }
      lines.push('', '※ Gmail に残っている送受信メール・下書きは対象外です。');
      GmailApp.sendEmail(notifyEmail, subject, lines.join('\n'));
    } catch (error) {
      // 通知自体の失敗で本処理を落とさない（匿名化はもう済んでいる。実行ログには残す）
      console.error(`[notifyOwnerOfAnonymized] ${errorMessage(error)}`);
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
