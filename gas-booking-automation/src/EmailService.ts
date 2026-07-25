import { SpreadsheetService } from './SpreadsheetService';
import { InquiryData } from './Types';
import { CONFIG } from './Config';

export class EmailService {
  /**
   * 定期トリガーから呼ばれる一次対応送信処理（受領から15分以上経過したものを送信）
   */
  static sendAutoReplies(): void {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return;
    
    const data = sheet.getDataRange().getValues();
    const now = new Date();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[12]; // M列 Status
      const timestamp = new Date(row[1]); // B列 Timestamp
      
      if (status === '1次送信待ち') {
        const diffMin = (now.getTime() - timestamp.getTime()) / (1000 * 60);
        
        // 受信から15分以上経過しているかチェック
        if (diffMin >= CONFIG.DELAY_FOR_AUTO_REPLY_MINUTES) {
          const inquiry = SpreadsheetService.getInquiryByRow(i + 1);
          if (inquiry) {
            this.sendInitialReply(inquiry, i + 1);
          }
        }
      }
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
