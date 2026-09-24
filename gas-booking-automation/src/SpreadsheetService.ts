import { CONFIG, COLUMNS } from './Config';
import { InquiryData, InquiryStatus } from './Types';
import { withRetry } from './Retry';

type SheetValues = ReturnType<GoogleAppsScript.Spreadsheet.Range['getValues']>;

export class SpreadsheetService {
  /**
   * シートを名前で取得（一過性エラーはリトライ）
   */
  static getSheet(name: string): GoogleAppsScript.Spreadsheet.Sheet | null {
    return withRetry(`getSheet(${name})`, () =>
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)
    );
  }

  /**
   * シートの全データを取得（一過性エラーはリトライ）。シートが無ければ null
   */
  static getAllValues(name: string): SheetValues | null {
    return withRetry(`getAllValues(${name})`, () => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
      return sheet ? sheet.getDataRange().getValues() : null;
    });
  }

  /**
   * Settings シートから設定をキー・バリュー形式で取得
   */
  static getSettings(): Record<string, string> {
    const data = this.getAllValues(CONFIG.SHEET_NAMES.SETTINGS);
    if (!data) return {};

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
    const data = this.getAllValues(CONFIG.SHEET_NAMES.TEMPLATES);
    if (!data) return null;

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
    const sheet = this.getSheet(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return -1;

    const lastRow = withRetry('getLastRow', () => sheet.getLastRow());
    const newId = `INQ-${String(lastRow).padStart(3, '0')}`;
    inquiry.id = newId;

    // WhatsApp用テキスト生成
    const whatsAppText = this.generateWhatsAppText(inquiry);
    
    const row: unknown[] = [];
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

    // 記帳失敗＝問い合わせの消失なので、まれな二重行のリスクより優先してリトライする
    // （二重行は O列 MessageId で判別可能）
    return withRetry('appendRow', () => {
      sheet.appendRow(row);
      return sheet.getLastRow();
    });
  }

  /**
   * ステータスを更新
   */
  static updateStatus(rowNum: number, status: InquiryStatus): void {
    const sheet = this.getSheet(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return;
    withRetry(`updateStatus(row ${rowNum})`, () =>
      sheet.getRange(rowNum, COLUMNS.INQUIRIES.STATUS).setValue(status)
    );
  }

  /**
   * イレギュラーフラグ（L列）を更新
   */
  static updateIrregularFlag(rowNum: number, flag: string): void {
    const sheet = this.getSheet(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return;
    withRetry(`updateIrregularFlag(row ${rowNum})`, () =>
      sheet.getRange(rowNum, COLUMNS.INQUIRIES.IRREGULAR_FLAG).setValue(flag)
    );
  }

  /**
   * 行のデータをオブジェクトとして取得
   */
  static getInquiryByRow(rowNum: number): InquiryData | null {
    const sheet = this.getSheet(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return null;

    const row = withRetry(`getInquiryByRow(${rowNum})`, () =>
      sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0]
    );
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
