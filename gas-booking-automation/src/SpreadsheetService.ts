import { CONFIG, COLUMNS } from './Config';
import { InquiryData, InquiryStatus } from './Types';

export class SpreadsheetService {
  /**
   * Settings シートから設定をキー・バリュー形式で取得
   */
  static getSettings(): Record<string, string> {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
    if (!sheet) return {};
    
    const data = sheet.getDataRange().getValues();
    const settings: Record<string, string> = {};
    for (let i = 1; i < data.length; i++) {
      const key = String(data[i][0]).trim();
      const value = String(data[i][1]).trim();
      if (key) {
        settings[key] = value;
      }
    }
    return settings;
  }

  /**
   * Templates シートからテンプレートを ID ベースで取得
   */
  static getTemplate(templateId: string): { subject: string, body: string } | null {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.TEMPLATES);
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === templateId) {
        return {
          subject: String(data[i][1]),
          body: String(data[i][2])
        };
      }
    }
    return null;
  }

  /**
   * 新しい問い合わせを Inquiries シートに追加し、追加された行番号を返す
   */
  static appendInquiry(inquiry: InquiryData): number {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return -1;

    const lastRow = sheet.getLastRow();
    const newId = `INQ-${String(lastRow).padStart(3, '0')}`;
    inquiry.id = newId;

    // WhatsApp用テキスト生成
    const whatsAppText = this.generateWhatsAppText(inquiry);
    
    const row = [];
    row[COLUMNS.INQUIRIES.ID - 1] = newId;
    row[COLUMNS.INQUIRIES.TIMESTAMP - 1] = inquiry.timestamp;
    row[COLUMNS.INQUIRIES.NAME - 1] = inquiry.name;
    row[COLUMNS.INQUIRIES.EMAIL - 1] = inquiry.email;
    row[COLUMNS.INQUIRIES.LANGUAGE - 1] = inquiry.language;
    row[COLUMNS.INQUIRIES.CHECK_IN - 1] = inquiry.checkIn;
    row[COLUMNS.INQUIRIES.CHECK_OUT - 1] = inquiry.checkOut;
    row[COLUMNS.INQUIRIES.ROOM_TYPE - 1] = inquiry.roomType;
    row[COLUMNS.INQUIRIES.GUESTS - 1] = inquiry.guests;
    row[COLUMNS.INQUIRIES.REMARKS - 1] = inquiry.remarks;
    row[COLUMNS.INQUIRIES.PERIOD_CATEGORY - 1] = inquiry.periodCategory;
    row[COLUMNS.INQUIRIES.IRREGULAR_FLAG - 1] = inquiry.irregularFlag;
    
    // 初期ステータスの決定
    const status: InquiryStatus = '1次送信待ち';
    row[COLUMNS.INQUIRIES.STATUS - 1] = status;
    row[COLUMNS.INQUIRIES.WHATSAPP_TEXT - 1] = whatsAppText;
    row[COLUMNS.INQUIRIES.MESSAGE_ID - 1] = inquiry.messageId;

    sheet.appendRow(row);
    return sheet.getLastRow();
  }

  /**
   * ステータスを更新
   */
  static updateStatus(rowNum: number, status: InquiryStatus): void {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return;
    sheet.getRange(rowNum, COLUMNS.INQUIRIES.STATUS).setValue(status);
  }

  /**
   * 行のデータをオブジェクトとして取得
   */
  static getInquiryByRow(rowNum: number): InquiryData | null {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return null;

    const row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    return {
      id: row[COLUMNS.INQUIRIES.ID - 1],
      timestamp: new Date(row[COLUMNS.INQUIRIES.TIMESTAMP - 1]),
      name: row[COLUMNS.INQUIRIES.NAME - 1],
      email: row[COLUMNS.INQUIRIES.EMAIL - 1],
      language: row[COLUMNS.INQUIRIES.LANGUAGE - 1],
      checkIn: new Date(row[COLUMNS.INQUIRIES.CHECK_IN - 1]),
      checkOut: new Date(row[COLUMNS.INQUIRIES.CHECK_OUT - 1]),
      roomType: row[COLUMNS.INQUIRIES.ROOM_TYPE - 1],
      guests: row[COLUMNS.INQUIRIES.GUESTS - 1],
      remarks: row[COLUMNS.INQUIRIES.REMARKS - 1],
      periodCategory: row[COLUMNS.INQUIRIES.PERIOD_CATEGORY - 1],
      irregularFlag: row[COLUMNS.INQUIRIES.IRREGULAR_FLAG - 1],
      status: row[COLUMNS.INQUIRIES.STATUS - 1] as InquiryStatus,
      messageId: row[COLUMNS.INQUIRIES.MESSAGE_ID - 1]
    };
  }

  /**
   * WhatsApp用の確認テキスト生成
   */
  private static generateWhatsAppText(inquiry: InquiryData): string {
    const ci = inquiry.checkIn.toLocaleDateString();
    const co = inquiry.checkOut.toLocaleDateString();
    let text = `Hi, new inquiry received (${inquiry.id}):\n- Name: ${inquiry.name}\n- Check-in: ${ci}\n- Check-out: ${co}\n- Room: ${inquiry.roomType}\n- Guests: ${inquiry.guests}`;
    if (inquiry.irregularFlag && inquiry.irregularFlag !== 'なし') {
      text += `\n*NOTE*: ${inquiry.irregularFlag}`;
    }
    if (inquiry.remarks) {
      text += `\n*Remarks*: ${inquiry.remarks}`;
    }
    return text;
  }
}
