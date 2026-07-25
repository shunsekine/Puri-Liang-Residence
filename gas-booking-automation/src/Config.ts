export const CONFIG = {
  SHEET_NAMES: {
    INQUIRIES: 'Inquiries',
    SETTINGS: 'Settings',
    TEMPLATES: 'Templates'
  },
  GMAIL_LABEL_QUERY: 'is:unread label:inbox subject:"Booking Inquiry"', // 調整必要
  POLLING_INTERVAL_MINUTES: 5,
  DELAY_FOR_AUTO_REPLY_MINUTES: 15,
};

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
    MESSAGE_ID: 15 // O
  }
};
