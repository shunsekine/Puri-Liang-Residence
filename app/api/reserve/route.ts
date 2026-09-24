import { NextResponse } from 'next/server';
import type { RoomId } from '@/lib/data';
import { isValidPhone } from '@/lib/phone';
import jaMessages from '@/messages/ja.json';
import enMessages from '@/messages/en.json';
import idMessages from '@/messages/id.json';

// 入口の検証（WO-PB-3F F1・F2。docs/2026-09-24-WO-PB-3F-reserve-abuse.md）。
// 本文をそのまま転送せず、GAS（gas-booking-automation/src/WebhookParser.ts parsePayload）が読む項目だけを検証して組み立て直す。
// - submitted_at は送らない（受信時刻は GAS のサーバー時刻。F2）
// - 料金・subject などフォームが送る他の項目は GAS が読まないので送らない。記録するなら GAS 側と同時にここへ足す
// - room はクライアントの文字列を使わず、room_id と language から作る（フォームが送る tRoom(`${id}.name`) と同じ値。
//   任意の文字列を自動返信の {RoomType} や担当者通知へ差し込ませない）
// - phone・nationality・stay_purposes は任意（2026-09-24 オーナー決定。無い・空は通す）。GAS が P・Q・R 列に記帳する
// 受け入れる形は components/pages/ReserveForm.tsx の handleSubmit と validate() に合わせている（片方だけ変えない）。
const LANGUAGES = ['ja', 'en', 'id'] as const;
const ROOM_IDS = ['villa', 'king', 'twin'] as const satisfies readonly RoomId[];
const MESSAGES = { ja: jaMessages, en: enMessages, id: idMessages };
/** ReserveForm.tsx の validate() と同じ式（フォームで通るアドレスをここで落とさない）。 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

type Language = (typeof LANGUAGES)[number];
type ForwardedInquiry = {
  name: string;
  email: string;
  language: Language;
  checkin: string;
  checkout: string;
  room: string;
  room_id: RoomId;
  guests: number;
  notes: string;
  /** 前後の空白を除いた値。未入力は '' */
  phone: string;
  /** messages の Reserve.nationalities のキー。未回答は '' */
  nationality: string;
  /** その言語の Reserve.purposes のラベル（重複なし）。未選択は [] */
  stay_purposes: string[];
};

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

/** C0・DEL・C1 の制御文字と Unicode の行・段落区切り（改行を差し込ませない）。 */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
  }
  return false;
}

/** YYYY-MM-DD かつ実在する日付。 */
function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** 違反があれば、その項目名を返す（ログ用。値は返さない）。 */
function parseInquiry(body: Record<string, unknown>): ForwardedInquiry | { invalid: string } {
  const { email, name, language, room_id, guests, checkin, checkout } = body;
  const notes = body.notes ?? '';

  if (typeof email !== 'string' || email.length > 254 || hasControlChar(email) || !EMAIL_RE.test(email)) return { invalid: 'email' };
  if (typeof name !== 'string') return { invalid: 'name' };
  // 貼り付けで入るタブは空白に寄せる（input type=text は改行を取り除くがタブは残すため、正当な送信を落とさない）。
  // 改行・それ以外の制御文字は拒否（担当者通知・WhatsApp 文面への偽装行の差し込みを入口で止める）
  const tabFreeName = name.replace(/\t/g, ' ');
  if (hasControlChar(tabFreeName)) return { invalid: 'name' };
  const trimmedName = tabFreeName.trim();
  if (trimmedName.length < 1 || trimmedName.length > 100) return { invalid: 'name' };
  if (typeof notes !== 'string' || notes.length > 2000) return { invalid: 'notes' };
  if (!oneOf(LANGUAGES, language)) return { invalid: 'language' };
  if (!oneOf(ROOM_IDS, room_id)) return { invalid: 'room_id' };
  if (typeof guests !== 'number' || !Number.isInteger(guests) || guests < 1 || guests > 10) return { invalid: 'guests' };
  if (!isIsoDate(checkin) || !isIsoDate(checkout) || checkout <= checkin) return { invalid: 'dates' };
  // フォームは「今日（ブラウザの UTC 日付）」以降しか送らない。サーバーは UTC の前日まで許す（時計のずれ・日付の境目の余裕）
  const yesterdayUtc = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
  if (checkin < yesterdayUtc) return { invalid: 'dates' };

  // 任意項目。null は「無い」と同じ扱い（notes と同じ）
  const phone = body.phone ?? '';
  if (typeof phone !== 'string' || !isValidPhone(phone.trim())) return { invalid: 'phone' };
  const reserve = MESSAGES[language].Reserve;
  const rawNationality = body.nationality ?? '';
  // Object.keys で照合する（`in` や添字だと constructor・__proto__ などプロトタイプのキーが通る）
  const nationality = rawNationality === '' ? '' : oneOf(Object.keys(reserve.nationalities), rawNationality) ? rawNationality : null;
  if (nationality === null) return { invalid: 'nationality' };
  const purposes = body.stay_purposes ?? [];
  const allowedPurposes: readonly string[] = reserve.purposes;
  if (!Array.isArray(purposes) || !purposes.every((p) => oneOf(allowedPurposes, p)) || new Set(purposes).size !== purposes.length) {
    return { invalid: 'stay_purposes' };
  }

  return {
    name: trimmedName,
    email,
    language,
    checkin,
    checkout,
    room: MESSAGES[language].RoomData[room_id].name,
    room_id,
    guests,
    notes,
    phone: phone.trim(),
    nationality,
    stay_purposes: purposes,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 形式の違反は 400。message は返さない（フォームは message が無いと各言語の errors.submitFailed を出す）
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ success: false }, { status: 400 });
    }
    const parsed = parseInquiry(body);
    if ('invalid' in parsed) {
      console.warn(`[API /api/reserve] rejected: invalid ${parsed.invalid}`);
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const gasUrl = process.env.GAS_WEBHOOK_URL;
    if (!gasUrl) {
      console.warn('[API /api/reserve] GAS_WEBHOOK_URL is not set in environment variables.');
      // モック成功レスポンス（GAS URL未設定時用）
      return NextResponse.json({ success: true, mock: true });
    }

    // GAS の Web アプリ URL は匿名公開なので、共有秘密を本文に付けて GAS 側で検証させる（doPost はヘッダーを読めない）。
    // 秘密が未設定なら転送しない（fail-closed。未設定を「秘密なしで送る」にしない）。
    const secret = process.env.GAS_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[API /api/reserve] GAS_WEBHOOK_SECRET is not set; refusing to forward.');
      return NextResponse.json({ success: false, message: 'Service unavailable' }, { status: 503 });
    }

    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      // 組み立て直した項目だけを送る（クライアントの本文は展開しない。webhook_secret を送ってきても届かない）
      body: JSON.stringify({ ...parsed, webhook_secret: secret }),
    });

    const data = await gasRes.json().catch(() => ({ success: true }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API /api/reserve] Error proxying to GAS:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
