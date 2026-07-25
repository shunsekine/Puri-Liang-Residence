import { WebhookParser } from './WebhookParser';
import { EmailService } from './EmailService';
import { SpreadsheetService } from './SpreadsheetService';
import { CONFIG, COLUMNS } from './Config';

/**
 * Webhook (POSTリクエスト) のエントリポイント
 * Webサイトのフォーム送信からリアルタイムで呼び出されます
 */
export function doPost(e: GoogleAppsScript.Events.DoPost) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const settings = SpreadsheetService.getSettings();

    // 1. データパース
    const inquiry = WebhookParser.parsePayload(payload);
    
    // 2. イレギュラー検知（定員・規約キーワード）
    inquiry.irregularFlag = WebhookParser.detectIrregularities(inquiry, settings);

    // 3. スプレッドシートへ追記（ID採番・WhatsAppテキスト生成含む）
    SpreadsheetService.appendInquiry(inquiry);

    // レスポンスの返却
    return ContentService.createTextOutput(JSON.stringify({ success: true, id: inquiry.id }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error: any) {
    console.error('[doPost] Error:', error);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 10〜15分おきの定期トリガー（タイムドリブン）から実行される一次対応処理
 */
export function processAutoReplies() {
  EmailService.sendAutoReplies();
}

/**
 * スプレッドシートの編集時（onEdit）に実行される処理
 */
export function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit): void {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAMES.INQUIRIES) return;

  const rowNum = e.range.getRow();
  const colNum = e.range.getColumn();

  // M列（Status）が編集された場合
  if (colNum === COLUMNS.INQUIRIES.STATUS && rowNum > 1) {
    const newStatus = e.value;
    const inquiry = SpreadsheetService.getInquiryByRow(rowNum);
    
    if (inquiry) {
      if (['空室', '満室', 'キャンセル待ち'].includes(newStatus)) {
        EmailService.createDraftForFinalAnswer(inquiry, newStatus);
        SpreadsheetService.updateStatus(rowNum, '最終送信待ち');
      }
    }
  }
}

/**
 * 毎日1回実行されるリマインダー処理（宿泊1ヶ月前）
 */
export function sendReminders(): void {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.INQUIRIES);
  if (!sheet) return;
  
  const settings = SpreadsheetService.getSettings();
  const notifyEmail = settings['NOTIFICATION_EMAIL'];
  if (!notifyEmail) return;

  const data = sheet.getDataRange().getValues();
  const today = new Date();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[COLUMNS.INQUIRIES.STATUS - 1];
    const checkIn = new Date(row[COLUMNS.INQUIRIES.CHECK_IN - 1]);
    
    if (status === 'キャンセル待ち') {
      const diffTime = checkIn.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 30) {
        const id = row[COLUMNS.INQUIRIES.ID - 1];
        const name = row[COLUMNS.INQUIRIES.NAME - 1];
        const subject = `【リマインダー】キャンセル待ち再確認: ${id} (${name}様)`;
        const body = `宿泊の30日前になりました。\n\nID: ${id}\nName: ${name}\nCheck-in: ${checkIn.toLocaleDateString()}\n\nオーナーに再度空室状況を確認し、顧客へご連絡をお願いします。`;
        
        GmailApp.sendEmail(notifyEmail, subject, body);
      }
    }
  }
}
