# PROJECT_CONTEXT — Puri Liang Residence Website

> グローバルルールに基づくプロジェクトコンテキスト。VM共用（Gemini / Antigravity / Claude）のため、作業前に本ファイルを確認すること。

---

## プロジェクト概要

- **目的**: バリ・サヌール地区の長期滞在向けレジデンス「Puri Liang Residence」の公式ウェブサイト
- **方向性**: V2 Bohemian Natural リデザイン適用 — Forest 緑系パレット + Docked nav + 3言語化 + FAQ追加 + Web3Forms 実送信
- **現状**: V2リデザインを `feat/v2-bohemian-natural` ブランチに適用完了。ローカルビルド・3言語×6ページ動作確認済。PR未作成。

## 技術スタック

| カテゴリ | バージョン |
|---|---|
| Next.js | 16.2.3 (App Router, Turbopack) |
| React | 19.2.3 |
| next-intl | 4.8.1 |
| Tailwind CSS | 4.1.18 |
| TypeScript | (tsconfig path alias: `@/*` → `./*`) |
| Node ランタイム | (devcontainer 構成あり) |
| フォーム送信 | Web3Forms（`NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` 未設定時はモック成功） |
| デプロイ | Vercel（想定） |

## ディレクトリ構成（V2適用後）

```
app/
├── globals.v2.css              # V2デザインシステム（Forest + Docked baked-in）
├── globals.v2.pages.css        # ページ固有スタイル
├── sitemap.ts
└── [locale]/                   # ja | en | id
    ├── layout.tsx
    ├── page.tsx                # Home (V2)
    ├── faq/page.tsx            # 新規（V2）
    ├── features/page.tsx       # 4グループ + Inclusions + Voices
    ├── location/page.tsx       # Crossroads + Map + POI + Neighborhood
    ├── reserve/page.tsx        # ヒーロー + ReserveForm
    └── rooms/page.tsx          # 詳細行 × 3 + Simulator + Amenities + House Rules
components/
├── common/{Header,Footer,LanguageSwitcher}.tsx
└── pages/
    ├── ReserveForm.tsx         # Web3Forms送信 + ハウスルールmodal + i18n
    └── v2/{RoomPreviewCard,RoomSimulator,FAQAccordionItem}.tsx
lib/
├── data.ts                     # ROOMS / IMG / LOCATION / SIMULATOR_DEFAULTS / CANCELLATION / FAQ_CATEGORIES
└── tokens.ts                   # V2_TOKENS（CSS変数のJS版）
messages/{ja,en,id}.json         # 591 keys × 3言語（旧+V2マージ済）
middleware.ts
navigation.ts                    # locales: ['ja','en','id']
.incoming/                       # 受領パッケージ展開先（gitignore済）
```

## コーディング規約・設計方針

- **Strategy A 段階移行**: messages/*.json は旧スキーマと V2 スキーマをディープマージ。旧キーは V2 完全移行後の別PRで削除予定。
- **Tweaks ベイクイン**: V2 で確定した設計値（Forest / Manifesto / Bohemian / Split hero / Docked nav / Pill button）は `.v2-*` クラスに直接書き込み済。Tweaks切替用の動的スタイルシートは不採用。
- **path alias**: `@/lib/*`, `@/navigation`, `@/components/*`
- **多言語**: `app/[locale]/...` で動的セグメント。matcher は `/(ja|en|id)/:path*`。
- **lint**: eslint-config-next の core-web-vitals + typescript を使用。`.incoming/**` はignore。

## 現在のブランチ・最終コミット

- **ブランチ**: `feat/v2-bohemian-natural`（main から派生）
- **main最終コミット**: `93937dc fix: update next and dependencies to fix security vulnerabilities`
- **本ブランチの未コミット差分**: 17ファイル変更 + 9ファイル新規（PROJECT_CONTEXT.md含まず）

## 完了済みタスク（直近）

- [2026-05-23] V2 Bohemian Natural リデザインパッケージ受領（zipでscp転送）
- [2026-05-23] `.incoming/20260514/` に展開、`.gitignore` 追加
- [2026-05-23] feat/v2-bohemian-natural ブランチ作成、rsync で 24ファイル配置
- [2026-05-23] lint エラー3件修正（`.incoming/**` ignore、Header.tsx の React 19 ルール対応、i18n.ts の `any` 修正）
- [2026-05-23] `npm install` / `npm run lint` / `npm run build` すべて成功
- [2026-05-23] dev server で 3言語×6ページ=18URL すべて HTTP 200 を確認

## 次にやること（優先順）

1. **commit + push + PR作成** (`feat: V2 Bohemian Natural redesign`) ※公開操作のためユーザー承認待ち
2. Vercel に `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` を登録（無料: https://web3forms.com/#start）
3. Vercel プレビューで全18URLの目視確認
4. en/id 翻訳のネイティブレビュー（特に id：富裕層・長期滞在者向け敬語トーン）
5. 旧スキーマキー削除（V2安定後、別PR）
6. King Studio 写真の差し込み（2026年6月撮影予定）
7. Next.js 16 の `middleware.ts` → `proxy.ts` 移行（廃止予定警告対応）

## 既知の問題・触ってはいけない箇所

- **lint warning（非ブロッキング、要追跡）**:
  - `app/[locale]/layout.tsx`: 未使用 `Metadata` import / `no-page-custom-font`
  - `components/pages/ReserveForm.tsx`: 未使用 `Image`, `BRAND`
- **VM共用注意**: 別ユーザ所有の `next dev` プロセス（cwd: `/app/...`）が起動中。Gemini/Antigravity の作業の可能性。**触らないこと**。
- `.incoming/` は受領パッケージ展開先。原本保管目的で残しているが gitignore 済。

## 起動中のプロセス・ポート

- Claude が起動した dev server (port 3210) は **停止済**
- 別エージェント所有の `next dev` プロセス（PID 2357/2417、`/app/node_modules/.bin/next dev`）が稼働中 — **不可侵**

---

- **最終更新日時**: 2026-05-23
- **更新したエージェント名**: Claude
