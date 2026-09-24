export const CONFIG = {
  SHEET_NAMES: {
    INQUIRIES: 'Inquiries',
    SETTINGS: 'Settings',
    TEMPLATES: 'Templates'
  },
  GMAIL_LABEL_QUERY: 'is:unread label:inbox subject:"Booking Inquiry"', // 調整必要
  POLLING_INTERVAL_MINUTES: 5,
  DELAY_FOR_AUTO_REPLY_MINUTES: 15,
  // 自動返信の上限（WO-PB-3F F1。公開フォームを踏み台にした第三者へのスパム送信を件数で止める）
  /** 1 日（スクリプトのタイムゾーン）の自動返信の上限。Settings シートの DAILY_AUTO_REPLY_CAP で上書き（未設定・数でなければこの値） */
  DEFAULT_DAILY_AUTO_REPLY_CAP: 20,
  /** 同じアドレスへは、この時間内に 1 通まで */
  SAME_ADDRESS_AUTO_REPLY_HOURS: 24,
  // 個人データの保存期間（2026-09-24 オーナー決定: 約 2 年。anonymizeExpiredInquiries）
  /** Settings シートの RETENTION_DAYS が空・未設定のときの日数 */
  DEFAULT_RETENTION_DAYS: 730,
  /** RETENTION_DAYS の下限。これ未満や数でない値は入力ミスとみなし、何も消さずに止める（消した個人データは戻せないため） */
  MIN_RETENTION_DAYS: 365,
  /** テンプレートに `${種類}_${言語}` の行が無いときに使う言語（Templates シート） */
  TEMPLATE_FALLBACK_LANGUAGE: 'en',
};

/**
 * 一次返信を送る前の状態。自動返信の上限の数え方（EmailService）と、保存期間の匿名化で触らない行（Retention）が使う。
 * 'エラー' は自動処理が失敗して担当者の対応待ちの行（一次返信はまだ送っていない）
 */
export const PRE_FIRST_REPLY_STATUSES: readonly string[] = ['', 'New', '1次送信待ち', 'エラー'];

export const COLUMNS = {
  INQUIRIES: {
    ID: 1, // A
    TIMESTAMP: 2, // B
    NAME: 3, // C
    EMAIL: 4, // D
    LANGUAGE: 5, // E
    CHECK_IN: 6, // F
    CHECK_OUT: 7, // G
    ROOM_TYPE: 8, // H
    GUESTS: 9, // I
    REMARKS: 10, // J
    PERIOD_CATEGORY: 11, // K
    IRREGULAR_FLAG: 12, // L
    STATUS: 13, // M
    WHATSAPP_TEXT: 14, // N
    MESSAGE_ID: 15, // O
    // 任意項目（2026-09-24 オーナー決定）。見出しは担当者が手で足す（README「スプレッドシート構成」）
    PHONE: 16, // P  先頭に ' を付けて文字列として記帳（0 始まり・+ 付きの番号を数値にさせない）
    NATIONALITY: 17, // Q  messages の Reserve.nationalities のキー（JP 等）
    STAY_PURPOSES: 18, // R  選んだ滞在目的のラベルを ", " で連結
    ANONYMIZED_AT: 19 // S  保存期間を過ぎて個人データを消した日時（anonymizeExpiredInquiries）。空なら未処理
  }
};
