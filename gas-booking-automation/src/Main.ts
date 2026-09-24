import { WebhookParser, WEBHOOK_SECRET_FIELD, WEBHOOK_SECRET_PROPERTY } from './WebhookParser';
import { EmailService } from './EmailService';
import { SpreadsheetService } from './SpreadsheetService';
import { RetentionService } from './Retention';
import { CONFIG, COLUMNS } from './Config';
import { errorMessage } from './Retry';

/**
 * Webhook (POSTリクエスト) のエントリポイント
 * Webサイトのフォーム送信からリアルタイムで呼び出されます
 */
export function doPost(e: GoogleAppsScript.Events.DoPost) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // 0. 共有秘密の検証（シートに触れる前に行う。拒否理由は返さない）
    const expected = PropertiesService.getScriptProperties().getProperty(WEBHOOK_SECRET_PROPERTY);
    if (!WebhookParser.isAuthorized(payload, expected)) {
      console.warn('[doPost] rejected: webhook secret missing or invalid');
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    delete payload[WEBHOOK_SECRET_FIELD];

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
  } catch (error) {
    // 応答は固定文言（例外のメッセージにはシートの ID や値が入りうる。詳細は実行ログだけ。WO-PB-3F F6）
    console.error('[doPost] Error:', error);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'internal' }))
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
 * スプレッドシートの編集時に実行される処理（担当者が M 列のステータスを変えたら最終回答の下書きを作る）。
 * インストール型トリガー（スプレッドシートから・編集時）で puriliangresidence.bali@gmail.com が登録する。
 * 名前を onEdit にしない: onEdit はシンプルトリガーとして自動で動き、Gmail を呼べずに失敗する（2026-09-24 に本番で
 * 下書きが作られていなかった原因）。インストール型も足すと二重に動く
 */
export function onStatusEdit(e: GoogleAppsScript.Events.SheetsOnEdit): void {
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
        let result: { note: string | null } | null;
        try {
          result = EmailService.createDraftForFinalAnswer(inquiry, newStatus);
        } catch (error) {
          // 下書きを作れなかった（Gmail の失敗等）。ステータスは担当者が選んだ値のまま残し、理由をセルに書いてから投げ直す
          // （トリガーの失敗として実行ログと Apps Script の失敗通知にも残る）
          try {
            SpreadsheetService.addStatusNote(rowNum, `【エラー】最終回答の下書きを作成できませんでした: ${errorMessage(error)}。時間をおいてから、ステータスを選び直してください。`);
          } catch (e) {
            console.error(`[onStatusEdit] failed to add the note on row ${rowNum}: ${errorMessage(e)}`);
          }
          throw error;
        }
        SpreadsheetService.updateStatus(rowNum, '最終送信待ち');
        // 英語で代用したときだけ、ステータスのセルに注記（下書きは作れているので、メモの失敗で onStatusEdit を落とさない）
        if (result?.note) {
          try {
            SpreadsheetService.addStatusNote(rowNum, result.note);
          } catch (e) {
            console.error(`[onStatusEdit] failed to add the note on row ${rowNum}: ${errorMessage(e)}`);
          }
        }
      }
    }
  }
}

/**
 * 月 1 回の定期トリガー（時間主導型・月ベース）から実行: 保存期間（Settings.RETENTION_DAYS・既定 730 日）を過ぎた問い合わせの
 * 個人データを消す（行は消さない）。詳細は Retention.ts。トリガーは puriliangresidence.bali@gmail.com で作る（README）
 */
export function anonymizeExpiredInquiries(): void {
  RetentionService.anonymizeExpired(new Date());
}

/**
 * 毎日1回実行されるリマインダー処理（宿泊1ヶ月前）
 */
export function sendReminders(): void {
  const settings = SpreadsheetService.getSettings();
  const notifyEmail = settings['NOTIFICATION_EMAIL'];
  if (!notifyEmail) return;

  const data = SpreadsheetService.getAllValues(CONFIG.SHEET_NAMES.INQUIRIES);
  if (!data) return;
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
