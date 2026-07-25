// Shared data exported from the prototype's src/shared.jsx.
// Strings are duplicated here for type safety — the page components also pull
// some strings from next-intl messages (messages/{ja,en,id}.json). When data
// fields contain Japanese phrasing only, that's intentional placeholder content
// for the JP/EN/ID multi-locale wrapper — translate via the messages file.
//
// 2026-05 update reflects all V2 Bohemian Natural content decisions:
//   - 9 inclusions (down from 15)
//   - "同じ敷地" wording (not "同じ建物")
//   - 1ヶ月から (not 28泊から)
//   - JPY/USD displays are approximations (約 / approx.)
//   - King Studio: 3F, king-size bed only
//   - Twin Studio: 2F, 2 × semi-double beds
//   - House rules: pool times removed
//   - Cancellation: 2 weeks 50% / 1 week 25% / non-refundable thereafter
//   - Workspace section removed from Home
//   - East/West/South/North crossroads on Location

// -----------------------------------------------------------------------------
// Brand
// -----------------------------------------------------------------------------

export const BRAND = {
  name: 'Puri Liang',
  fullName: 'Puri Liang Residence',
  address: 'Jl. Tukad Balian Selatan No.12, Sidakarya, Denpasar Selatan, Bali',
  addressShort: 'Sidakarya, Denpasar Selatan, Bali',
  email: 'puriliangresidence.bali@gmail.com', // 公開せず、システム送信用途のみで使用
  whatsapp: '+62 813-xxxx-xxxx',
} as const;

// -----------------------------------------------------------------------------
// Image paths (public/images/*)
// -----------------------------------------------------------------------------

export const IMG = {
  hero: '/images/Home_Villa.jpg',
  villa1: '/images/Room_Villa_1.jpg',
  villa2: '/images/Room_Villa_2.jpg',
  villa3: '/images/Room_Villa_3.jpg',
  twin1: '/images/Room_Twin_Studio_1.webp',
  twin2: '/images/Room_Twin_Studio_2.webp',
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
  floor: string;
  priceJPY: number;
  priceUSD: number;
  priceIDR: number;
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
    floor: '1F & 2F',
    priceJPY: 77000,
    priceUSD: 470,
    priceIDR: 8500000,
    photos: ['villa1', 'villa2', 'villa3'],
  },
  {
    id: 'king',
    size: 30,
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    floor: '3F',
    priceJPY: 59000,
    priceUSD: 360,
    priceIDR: 6500000,
    photos: [],
  },
  {
    id: 'twin',
    size: 20,
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    floor: '2F',
    priceJPY: 50000,
    priceUSD: 310,
    priceIDR: 5500000,
    photos: ['twin1', 'twin2'],
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
  electricityIDR: 500000,
  electricityJPY: 4500,   // 旧 electricityJPYPerMonth(9000) を改名・更新
  electricityUSD: 30,     // 追加
  discounts: [
    { months: 6, rate: 0.15 },
    { months: 3, rate: 0.10 },
  ],
} as const;

// -----------------------------------------------------------------------------
// Cancellation policy (V2 2026-05)
// -----------------------------------------------------------------------------

export const CANCELLATION = {
  // 1 week before check-in: 100% refund
  // 3 days before check-in: 50% refund
  // Less than 3 days: non-refundable
  tiers: [
    { daysBefore: 7, refundPct: 100 },
    { daysBefore: 3, refundPct: 50 },
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

export function formatPrice(code: CurrencyCode, amount: number): string {
  return `${SYMBOL[code]}${amount.toLocaleString('en-US')}`;
}

export function roomPriceAmount(room: Room, code: CurrencyCode): number {
  return code === 'JPY' ? room.priceJPY : code === 'USD' ? room.priceUSD : room.priceIDR;
}

export function electricityAmount(code: CurrencyCode): number {
  return code === 'JPY' ? SIMULATOR_DEFAULTS.electricityJPY
       : code === 'USD' ? SIMULATOR_DEFAULTS.electricityUSD
       : SIMULATOR_DEFAULTS.electricityIDR;
}
