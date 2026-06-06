// V2 Bohemian Natural design tokens
// Use as CSS-in-JS via these constants, or via the matching CSS variables in app/globals.v2.css
// (--v2-sage, --v2-terracotta, etc.)

export const V2_TOKENS = {
  // Greens
  sage: '#5d6f56',
  sageDark: '#3f4f3a',
  // Warm clay accents
  // 2026-05 採用 Tweaks: accentPalette=forest
  // 元の terracotta (#c47a52 / #9a5c3c) を Forest greens に置換。
  // セマンティックなトークン名 (terracotta / terracottaDark) は維持しつつ、
  // 値だけ更新。今後パレットを変えるときはここだけ交換。
  terracotta: '#5d7050',
  terracottaDark: '#3f5a3b',
  // Sandy neutrals
  sand: '#e8dcc4',
  sandLight: '#f3ecda',
  cream: '#faf5ea',
  // Inks
  mocha: '#3a2e22',
  mochaSoft: '#5a4738',
  rule: 'rgba(58,46,34,0.14)',
  muted: 'rgba(58,46,34,0.62)',
  // Type stacks
  display: '"DM Serif Display", "Noto Serif JP", Georgia, serif',
  jpSerif: '"Noto Serif JP", Georgia, serif',
  sans: '"Outfit", "Noto Sans JP", -apple-system, sans-serif',
} as const;

export type V2Token = keyof typeof V2_TOKENS;
