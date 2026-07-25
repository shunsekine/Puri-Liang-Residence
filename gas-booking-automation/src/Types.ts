export type InquiryStatus = 
  | 'New'
  | '1次送信待ち'
  | '1次送信済'
  | 'オーナー確認中'
  | '空室'
  | '満室'
  | 'キャンセル待ち'
  | '最終送信待ち'
  | '最終送信済'
  | 'クローズ';

export interface InquiryData {
  id?: string;
  timestamp: Date;
  name: string;
  email: string;
  language: string; // 'ja' | 'en'
  checkIn: Date;
  checkOut: Date;
  roomType: string;
  guests: number;
  remarks: string;
  periodCategory?: '1ヶ月以内' | '1ヶ月以上先';
  irregularFlag?: string; // 'なし' | '定員超過' | 'NGワード検知'
  status?: InquiryStatus;
  whatsAppText?: string;
  messageId: string;
}
