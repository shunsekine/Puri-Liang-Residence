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
  | 'クローズ'
  | 'エラー'; // 自動処理が失敗した行。担当者が原因を直して '1次送信待ち' に戻すと再処理される

export interface InquiryData {
  id?: string;
  timestamp: Date;
  name: string;
  email: string;
  language: string; // 'ja' | 'en' | 'id'（テンプレートは `${種類}_${言語}`、無ければ _en）
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
  // 任意項目（2026-09-24 オーナー決定）。未入力・不正な値は ''
  phone: string;
  nationality: string;
  /** 選んだ滞在目的を ", " で連結した文字列 */
  stayPurposes: string;
  /** 受信時の検証で捨てた任意項目の旗（parsePayload → detectIrregularities。シートには IrregularFlag として残る） */
  inputFlags?: string[];
}
