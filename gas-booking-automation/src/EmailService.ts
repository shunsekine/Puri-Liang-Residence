import { SpreadsheetService } from './SpreadsheetService';
import { InquiryData } from './Types';
import { CONFIG, COLUMNS } from './Config';
import { errorMessage } from './Retry';

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

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[COLUMNS.INQUIRIES.STATUS - 1];
      const timestamp = new Date(row[COLUMNS.INQUIRIES.TIMESTAMP - 1]);
      if (status !== '1次送信待ち') continue;

      // 受信から15分以上経過しているかチェック
      const diffMin = (now.getTime() - timestamp.getTime()) / (1000 * 60);
      if (diffMin < CONFIG.DELAY_FOR_AUTO_REPLY_MINUTES) continue;

      const rowNum = i + 1;
      // 行単位で隔離: 1行の失敗で後続の問い合わせが止まらないようにする
      try {
        const inquiry = SpreadsheetService.getInquiryByRow(rowNum);
        if (inquiry) {
          this.sendInitialReply(inquiry, rowNum);
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
   * 一次返信の送信または下書き作成
   */
  static sendInitialReply(inquiry: InquiryData, rowNum: number): void {
    const templateId = inquiry.periodCategory === '1ヶ月以上先' 
      ? `1MonthLater_${inquiry.language}` 
      : `1MonthWithin_${inquiry.language}`;

    const template = SpreadsheetService.getTemplate(templateId);
    if (!template) {
      console.error(`Template not found: ${templateId}`);
      return;
    }

    const body = this.replacePlaceholders(template.body, inquiry);
    const subject = this.replacePlaceholders(template.subject, inquiry);

    if (inquiry.irregularFlag && inquiry.irregularFlag !== 'なし') {
      // イレギュラーがある場合は下書きとして作成
      const alertBody = `【システムアラート: 要確認】\n以下の問い合わせにフラグが検出されました: ${inquiry.irregularFlag}\n\n------------------------\n${body}`;
      GmailApp.createDraft(inquiry.email, `【要確認】${subject}`, alertBody);
      SpreadsheetService.updateStatus(rowNum, '最終送信待ち');
    } else {
      // 正常な場合は自動送信
      GmailApp.sendEmail(inquiry.email, subject, body);
      SpreadsheetService.updateStatus(rowNum, '1次送信済');
    }

    this.notifyOwnerOfReply(inquiry);
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
