import { InquiryData } from './Types';

export class WebhookParser {
  /**
   * ウェブサイトからPOSTされたJSONペイロードをパースする
   */
  static parsePayload(payload: any): InquiryData {
    const checkInDate = new Date(payload.checkin);
    
    // 1ヶ月ルールの判定 (チェックインが30日以上先か)
    const today = new Date();
    const diffTime = checkInDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const periodCategory = diffDays >= 30 ? '1ヶ月以上先' : '1ヶ月以内';

    return {
      timestamp: new Date(payload.submitted_at || new Date().toISOString()),
      name: payload.name || 'Unknown',
      email: payload.email,
      language: payload.language || 'en',
      checkIn: checkInDate,
      checkOut: new Date(payload.checkout),
      roomType: payload.room || payload.room_id || 'villa',
      guests: parseInt(payload.guests, 10) || 1,
      remarks: payload.notes || '',
      periodCategory: periodCategory,
      messageId: `WEB-${Date.now()}`
    };
  }

  /**
   * ウェブサイトの規定（定員、NGワード）に基づきイレギュラーを検知する
   */
  static detectIrregularities(inquiry: InquiryData, settings: Record<string, string>): string {
    const flags: string[] = [];

    // 1. サイト規定の部屋定員チェック (lib/data.ts に準拠)
    const capacities: Record<string, number> = {
      'villa': 4,
      'king': 2,
      'twin': 2
    };
    
    const roomKey = String(inquiry.roomType).toLowerCase();
    let maxCapacity = 2; // デフォルト
    if (roomKey.includes('villa')) maxCapacity = 4;
    else if (roomKey.includes('king')) maxCapacity = 2;
    else if (roomKey.includes('twin')) maxCapacity = 2;

    if (inquiry.guests > maxCapacity) {
      flags.push(`定員超過(上限${maxCapacity}名に対し${inquiry.guests}名)`);
    }

    // 2. 規約外要望（NGキーワード）チェック
    const defaultNgWords = ['party', 'smoke', 'smoking', 'free cancel', 'refund', 'discount', 'pet', 'pets'];
    const sheetNgWordsStr = settings['NG_KEYWORDS'] || '';
    const sheetNgWords = sheetNgWordsStr.split(',').map(w => w.trim().toLowerCase()).filter(w => w);
    const ngWords = Array.from(new Set([...defaultNgWords, ...sheetNgWords]));
    
    const remarksLower = inquiry.remarks.toLowerCase();
    for (const word of ngWords) {
      if (remarksLower.includes(word)) {
        flags.push(`規約外キーワード検知("${word}")`);
      }
    }

    return flags.length > 0 ? flags.join(' / ') : 'なし';
  }
}
