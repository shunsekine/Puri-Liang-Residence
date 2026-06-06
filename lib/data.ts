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
  address: 'Jl. Tukad Balian, Tabanan, Bali 82122, Indonesia',
  addressShort: 'Tukad Balian, Tabanan, Bali',
  email: 'stay@puriliang.com',
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
  twin1: '/images/Room_Twin Studio_1.webp',
  twin2: '/images/Room_Twin Studio_2.webp',
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
    priceJPY: 78000,
    priceUSD: 520,
    priceIDR: 8200000,
    photos: ['villa1', 'villa2', 'villa3'],
  },
  {
    id: 'king',
    size: 30,
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    floor: '3F',
    priceJPY: 58000,
    priceUSD: 390,
    priceIDR: 6100000,
    photos: [],
  },
  {
    id: 'twin',
    size: 20,
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    floor: '2F',
    priceJPY: 48000,
    priceUSD: 320,
    priceIDR: 5000000,
    photos: ['twin1', 'twin2'],
  },
];

// -----------------------------------------------------------------------------
// Location coordinates + map highlights
// -----------------------------------------------------------------------------

export const LOCATION = {
  area: 'Tukad Balian',
  region: 'Tabanan, Bali',
  country: 'Indonesia',
  lat: -8.42,
  lng: 115.07,
  coord: { ns: '8°25′12″S', ew: '115°04′48″E' },
} as const;

// -----------------------------------------------------------------------------
// Simulator defaults (for the monthly estimator on /rooms)
// -----------------------------------------------------------------------------

export const SIMULATOR_DEFAULTS = {
  electricityIDR: 900000,    // monthly average per room
  electricityJPYPerMonth: 9000,
  // Long-stay discount thresholds — applied as a % off rent only.
  discounts: [
    { months: 6, rate: 0.15 },
    { months: 3, rate: 0.10 },
  ],
} as const;

// -----------------------------------------------------------------------------
// Cancellation policy (V2 2026-05)
// -----------------------------------------------------------------------------

export const CANCELLATION = {
  // 2 weeks before check-in: 50% refund
  // 1 week before check-in: 25% refund
  // Less than 1 week: non-refundable
  tiers: [
    { daysBefore: 14, refundPct: 50 },
    { daysBefore: 7, refundPct: 25 },
    { daysBefore: 0, refundPct: 0 },
  ],
} as const;

// -----------------------------------------------------------------------------
// FAQ category metadata (icons + labels live here; content in messages.FAQ.items)
// -----------------------------------------------------------------------------

export type FAQCategory = 'booking' | 'pricing' | 'facilities' | 'location' | 'rules';

export const FAQ_CATEGORIES: { id: FAQCategory; icon: string }[] = [
  { id: 'booking', icon: '①' },
  { id: 'pricing', icon: '②' },
  { id: 'facilities', icon: '③' },
  { id: 'location', icon: '④' },
  { id: 'rules', icon: '⑤' },
];
