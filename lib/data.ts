// Shared site data (numbers, image paths, room specs, currency helpers).
// Localized copy lives in messages/{ja,en,id}.json; this file holds only values that are the same
// in every locale. Owner-confirmed business rules (prices, deposit, cancellation, electricity, languages)
// are listed in PROJECT_CONTEXT.md「事業ルール」— keep the messages, this file and the GAS templates in step.

// -----------------------------------------------------------------------------
// Image paths (public/images/*)
// -----------------------------------------------------------------------------

export const IMG = {
  hero: '/images/Home_Villa.jpg',
  villa1: '/images/Room_Villa_1.jpg',
  villa2: '/images/Room_Villa_2.jpg',
  villa3: '/images/Room_Villa_3.jpg',
  king1: '/images/Room_King_Studio_1.jpeg',
  king2: '/images/Room_King_Studio_2.jpeg',
  king3: '/images/Room_King_Studio_3.jpeg',
  twin1: '/images/Room_Twin_Studio_1.webp',
  twin2: '/images/Room_Twin_Studio_2.webp',
  twin3: '/images/Room_Twin_Studio_3.jpeg',
  workspace: '/images/Workspace.jpg',
  housekeeping: '/images/Housekeeping.jpg',
  laundry: '/images/Laundry.webp',
  sanur: '/images/Sanur.jpg',
  canggu: '/images/Canggu.jpg',
  ubud: '/images/Ubud.jpg',
  uluwatu: '/images/Uluwatu.jpg',
  hospital: '/images/Inmedika_Hospital_Denpasar.webp',
  logo: '/logo.png',
} as const;

export type ImageKey = keyof typeof IMG;

// -----------------------------------------------------------------------------
// Rooms
// -----------------------------------------------------------------------------

export type RoomId = 'villa' | 'king' | 'twin';

export interface Room {
  id: RoomId;
  // Names live in the messages file under RoomData.{id}.name / nameLocal
  size: number;       // m²
  capacity: number;   // sleeps
  bedrooms: number;
  bathrooms: number;
  // Floor labels live in the messages file under RoomData.{id}.floor
  priceJPY: number;
  priceUSD: number;
  priceIDR: number;
  price2WeeksJPY: number;
  price2WeeksUSD: number;
  price2WeeksIDR: number;
  photos: ImageKey[];
  // Available flag — "Photographed" or "Photoshoot scheduled (YYYY-MM)"
  // The pages render the localized form via messages RoomData.{id}.available.
}

export const ROOMS: Room[] = [
  {
    id: 'villa',
    size: 50,
    capacity: 4,
    bedrooms: 1,
    bathrooms: 1,
    priceJPY: 82000,
    priceUSD: 510,
    priceIDR: 9000000,
    price2WeeksJPY: 45000,
    price2WeeksUSD: 280,
    price2WeeksIDR: 5000000,
    photos: ['villa1', 'villa2', 'villa3'],
  },
  {
    id: 'king',
    size: 35,
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    priceJPY: 64000,
    priceUSD: 400,
    priceIDR: 7000000,
    price2WeeksJPY: 36000,
    price2WeeksUSD: 230,
    price2WeeksIDR: 4000000,
    photos: ['king2', 'king1', 'king3'],
  },
  {
    id: 'twin',
    size: 20,
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    priceJPY: 55000,
    priceUSD: 340,
    priceIDR: 6000000,
    price2WeeksJPY: 32000,
    price2WeeksUSD: 200,
    price2WeeksIDR: 3500000,
    photos: ['twin1', 'twin2', 'twin3'],
  },
];

// -----------------------------------------------------------------------------
// Location coordinates + map highlights
// -----------------------------------------------------------------------------

export const LOCATION = {
  area: 'Sidakarya',
  region: 'Denpasar Selatan, Bali',
  country: 'Indonesia',
  lat: -8.70543,
  lng: 115.2392145,
  coord: { ns: '8°42′20″S', ew: '115°14′21″E' },
  // 地図ピンで「場所情報」を表示させるための実在地点クエリ・共有リンク
  placeQuery: 'Puri Liang, Jl. Tukad Balian Selatan No.12, Sidakarya, Denpasar Selatan, Bali',
  googleShareUrl: 'https://maps.app.goo.gl/HCmzFGPzSz7wkcYa6',
};

// -----------------------------------------------------------------------------
// Simulator defaults (for the monthly estimator on /rooms)
// -----------------------------------------------------------------------------

export const SIMULATOR_DEFAULTS = {
  // 電気代の目安: 1名あたり月額（2026-09 オーナー確認）。電気はプリペイド（トークン）式で、
  // 滞在中にゲストがスタッフへ代金を渡してチャージを代行してもらう。前払い（家賃）には含めない
  electricityIDR: 300000,
  electricityJPY: 2700,
  electricityUSD: 18,
  discounts: [
    { months: 6, rate: 0.15 },
    { months: 3, rate: 0.10 },
  ],
} as const;

// -----------------------------------------------------------------------------
// Cancellation policy (V2 2026-05)
// -----------------------------------------------------------------------------

export const CANCELLATION = {
  // Up to 7 days before check-in: full refund, minus the actual bank transfer fee for the refund
  // After that: non-refundable
  // (2026-09 unified with FAQ / Terms; the old 3-day tier is gone)
  tiers: [
    { daysBefore: 7, refundPct: 100 },
    { daysBefore: 0, refundPct: 0 },
  ],
} as const;

// -----------------------------------------------------------------------------
// FAQ category metadata (icons + labels live here; content in messages.FAQ.items)
// -----------------------------------------------------------------------------

export type FAQCategory = 'booking' | 'pricing' | 'facilities' | 'location' | 'rules';

export const FAQ_CATEGORIES: { id: FAQCategory; icon: string }[] = [
  { id: 'booking', icon: '1' },
  { id: 'pricing', icon: '2' },
  { id: 'facilities', icon: '3' },
  { id: 'location', icon: '4' },
  { id: 'rules', icon: '5' },
];

// 通貨表示（基準は IDR。表示のみ locale で切替。支払いは常に IDR）
export type CurrencyCode = 'JPY' | 'USD' | 'IDR';

const LOCALE_CURRENCY: Record<string, CurrencyCode> = { ja: 'JPY', en: 'USD', id: 'IDR' };

export function currencyForLocale(locale: string): CurrencyCode {
  return LOCALE_CURRENCY[locale] ?? 'IDR';
}

const SYMBOL: Record<CurrencyCode, string> = { JPY: '¥', USD: '$', IDR: 'Rp ' };

// IDR は id ロケールでだけ表示されるので、インドネシア式の桁区切り（Rp 9.000.000）にする（本文の表記と揃える）
export function formatPrice(code: CurrencyCode, amount: number): string {
  return `${SYMBOL[code]}${amount.toLocaleString(code === 'IDR' ? 'id-ID' : 'en-US')}`;
}

export function roomPriceAmount(room: Room, code: CurrencyCode): number {
  return code === 'JPY' ? room.priceJPY : code === 'USD' ? room.priceUSD : room.priceIDR;
}

export function roomPrice2WeeksAmount(room: Room, code: CurrencyCode): number {
  return code === 'JPY' ? room.price2WeeksJPY : code === 'USD' ? room.price2WeeksUSD : room.price2WeeksIDR;
}

export function electricityAmount(code: CurrencyCode): number {
  return code === 'JPY' ? SIMULATOR_DEFAULTS.electricityJPY
       : code === 'USD' ? SIMULATOR_DEFAULTS.electricityUSD
       : SIMULATOR_DEFAULTS.electricityIDR;
}
