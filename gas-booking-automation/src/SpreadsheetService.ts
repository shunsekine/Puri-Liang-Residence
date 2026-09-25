import { CONFIG, COLUMNS } from './Config';
import { InquiryData, InquiryStatus } from './Types';
import { withRetry } from './Retry';
import { formatMailDate } from './Templates';

type SheetValues = ReturnType<GoogleAppsScript.Spreadsheet.Range['getValues']>;

/** 保存期間の匿名化で 1 回の RangeList に入れる行数の上限（A1 表記の並びが長くなりすぎないように） */
const ANONYMIZE_BATCH_ROWS = 100;
/** 先頭がこれらだと Sheets が数式として解釈しうる（= + - @。タブ・CR は CSV に書き出したときに同じ扱いになりうる） */
const CELL_FORMULA_LEAD_RE = /^[=+\-@\t\r]/;

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
    // 任意項目（P・Q・R）。電話は ' を前置して文字列にする（Sheets は "0812…" を数値にして先頭の 0 を落とし、
    // 長い番号は指数表記にする。' はセルの表示・getValues には出ない）
    row[COLUMNS.INQUIRIES.PHONE - 1] = inquiry.phone ? `'${inquiry.phone}` : '';
    row[COLUMNS.INQUIRIES.NATIONALITY - 1] = inquiry.nationality;
    row[COLUMNS.INQUIRIES.STAY_PURPOSES - 1] = inquiry.stayPurposes;

    // 数式の無害化（WO-PB-3F F3）。フォームの値（氏名・備考など）が = で始まると、Sheets は数式として評価する
    // （=HYPERLINK で担当者の画面に偽のリンク、=IMPORTXML で行の値を外部へ送らせる）。' を前置すると文字列になり、
    // セルの表示と getValues には ' が出ない（電話の ' と同じ）。途中の = や、先頭が ' の値（電話）は変えない
    for (let i = 0; i < row.length; i++) {
      const v = row[i];
      if (typeof v === 'string' && CELL_FORMULA_LEAD_RE.test(v)) row[i] = `'${v}`;
    }

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
   * ステータス（M列）のセルのメモに日付付きで 1 行足す。最終回答の下書きで英語のテンプレートを代用した・作れなかったことを、
   * ステータスを変えた担当者に見える場所で伝える。既存のメモ（担当者が手で書いたもの）は消さない
   */
  static addStatusNote(rowNum: number, text: string): void {
    const sheet = this.getSheet(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return;
    const day = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    withRetry(`addStatusNote(row ${rowNum})`, () => {
      const range = sheet.getRange(rowNum, COLUMNS.INQUIRIES.STATUS);
      const current = String(range.getNote() ?? '');
      range.setNote(current ? `${current}\n${day} ${text}` : `${day} ${text}`);
    });
  }

  /**
   * 保存期間を過ぎた行の個人データの列を空にし、AnonymizedAt（S列）に stamp を入れる。行は消さない（ID は getLastRow で
   * 採番するので、消すと ID が再利用される）。
   * targets は getAllValues の時点の行番号と ID。書く直前に A 列を読み直し、ID が一致した行だけを書く（読み取り後の
   * 並べ替え・行の挿入で別の問い合わせの個人データを消さない。ずれた行は次回の実行に回る）。
   * 消去 → 印の順に、それぞれ RangeList 1 回（ANONYMIZE_BATCH_ROWS 行ごと）で書く。どちらも冪等なのでリトライしてよい。
   * 消去の後に印が失敗しても、次回は印が無いので同じ行をもう一度消して印を付ける（印だけ付いて個人データが残ることは無い）。
   * 書いた行を返す。
   */
  static anonymizeRows(targets: { rowNum: number, id: string }[], personalColumns: number[], stamp: Date): { rowNum: number, id: string }[] {
    if (targets.length === 0) return [];
    const sheet = this.getSheet(CONFIG.SHEET_NAMES.INQUIRIES);
    if (!sheet) return [];

    const I = COLUMNS.INQUIRIES;
    const maxRow = Math.max(...targets.map((t) => t.rowNum));
    const ids = withRetry('anonymizeRows: re-read IDs', () => sheet.getRange(1, I.ID, maxRow, 1).getValues());
    const confirmed = targets.filter((t) => t.id !== '' && String(ids[t.rowNum - 1]?.[0] ?? '') === t.id);

    for (let start = 0; start < confirmed.length; start += ANONYMIZE_BATCH_ROWS) {
      const batch = confirmed.slice(start, start + ANONYMIZE_BATCH_ROWS);
      const cells = batch.flatMap((t) => personalColumns.map((c) => SpreadsheetService.a1(t.rowNum, c)));
      const marks = batch.map((t) => SpreadsheetService.a1(t.rowNum, I.ANONYMIZED_AT));
      withRetry(`anonymizeRows: clear ${batch.length} rows`, () => sheet.getRangeList(cells).clearContent());
      withRetry(`anonymizeRows: mark ${batch.length} rows`, () => sheet.getRangeList(marks).setValue(stamp));
    }
    return confirmed;
  }

  /** 行・列番号（1 始まり）を A1 表記に */
  private static a1(rowNum: number, col: number): string {
    let letters = '';
    for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) {
      letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
    }
    return `${letters}${rowNum}`;
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
      messageId: row[COLUMNS.INQUIRIES.MESSAGE_ID - 1],
      // 任意項目の列（P〜R）は、見出しを足す前の古いシートでは範囲外（undefined）になりうる
      phone: String(row[COLUMNS.INQUIRIES.PHONE - 1] ?? '').replace(/^'/, ''),
      nationality: String(row[COLUMNS.INQUIRIES.NATIONALITY - 1] ?? ''),
      stayPurposes: String(row[COLUMNS.INQUIRIES.STAY_PURPOSES - 1] ?? '')
    };
  }

  /**
   * WhatsApp用の確認テキスト生成
   */
  private static generateWhatsAppText(inquiry: InquiryData): string {
    // オーナー向けの英語の文面。数字だけの日付は 4 月 11 日とも読めるので月名にする（Templates.formatMailDate）
    const ci = formatMailDate(inquiry.checkIn, 'en');
    const co = formatMailDate(inquiry.checkOut, 'en');
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
