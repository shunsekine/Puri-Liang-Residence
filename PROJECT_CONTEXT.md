# PROJECT_CONTEXT — Puri Liang Residence Website

> グローバルルールに基づくプロジェクトコンテキスト。VM共用（Gemini / Antigravity / Claude）のため、作業前に本ファイルを確認すること。

---

## プロジェクト概要

- **目的**: バリ島 デンパサール南部シダカルヤ（Sidakarya, Denpasar Selatan）の長期滞在・リモートワーク向けレジデンス「Puri Liang Residence」公式ウェブサイト
- **方向性**: V2 Bohemian Natural リデザイン（Forest 緑系パレット / Docked nav / 3言語 / FAQ / Web3Forms 実送信 / IDRベース価格）
- **現状**: 🟢 **本番公開済み**（2026-06-06 / PR #1 を main にマージ）。本番URL `https://puri-liang-residence.vercel.app` で新サイト稼働中。Web3Forms 実送信・本番フォームE2Eテスト確認済。残るは Google 再インデックス等の公開後タスクのみ。

## 技術スタック

| カテゴリ | バージョン / 内容 |
|---|---|
| Next.js | 16.2.3 (App Router, Turbopack) |
| React | 19.2.3 |
| next-intl | 4.8.1 |
| Tailwind CSS | 4.1.18 |
| TypeScript | path alias `@/*` → `./*` |
| フォーム送信 | Web3Forms（`NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` を Vercel に設定済 / 未設定時はモック成功フォールバック）。届け先: `shun.sekine14@gmail.com`（将来変更の可能性あり） |
| デプロイ | Vercel（チーム: shun-projects-workspace / owner: puriliangresidence.bali@gmail.com / Hobby・無料 / リポ Public） |

## 価格・通貨方針（重要）

- **基準通貨は IDR（実支払い）**。表示は locale 別: `ja→JPY` / `en→USD` / `id→IDR`。各価格に「参考価格・支払いは IDR」注記。
- 簡易レート: **100 JPY = 11,000 IDR（1JPY=110IDR）** / **1 USD = 18,000 IDR**
- 月額: Villa `Rp 8,500,000`(¥77,000/$470) / King `Rp 6,500,000`(¥59,000/$360) / Twin `Rp 5,500,000`(¥50,000/$310)。電気代 `Rp 500,000`(¥4,500/$30)/月。
- ヘルパー: `lib/data.ts` の `currencyForLocale` / `formatPrice` / `roomPriceAmount` / `electricityAmount`

## ディレクトリ構成（主要）

```
app/
├── globals.v2.css / globals.v2.pages.css   # V2デザインシステム
├── sitemap.ts
└── [locale]/   (ja|en|id)
    ├── layout.tsx        # メタデータ(siteName/OG/Twitter/WebSite JSON-LD/google verification)
    ├── page.tsx          # Home（title:{absolute}）
    ├── faq|features|location|reserve|rooms/page.tsx
components/
├── common/{Header,Footer,LanguageSwitcher}.tsx   # ロゴは fullName 表示 / Footerに Powered by JPFT
└── pages/ReserveForm.tsx + v2/{RoomPreviewCard,RoomSimulator,FAQAccordionItem}.tsx
lib/{data.ts(通貨ヘルパー含む), tokens.ts}
messages/{ja,en,id}.json
public/images/   # 客室画像 + powered-by.png（会社ロゴ）
修正指示_20260606.md   # Claude作成の修正指示書（未追跡 / 作業メモ）
.incoming/             # 受領パッケージ展開先（gitignore済）
```

## コーディング規約・設計方針

- **Strategy A 段階移行**: messages は旧スキーマ + V2 スキーマ共存（旧キーは安定後に別PRで削除）
- **Tweaks ベイクイン**: Forest / Manifesto / Bohemian / Split hero / Docked nav / Pill を `.v2-*` に直書き
- **多言語**: `app/[locale]/...` / matcher `/(ja|en|id)/:path*`
- **連絡先非掲載ポリシー**: Email/WhatsApp 等の直接連絡先はサイトに一切載せない。問い合わせは **Reserve フォームに一本化**（フッターは Reserve / FAQ 導線）。**物件住所は掲載可**。
- **lint**: eslint-config-next（core-web-vitals + typescript）。`.incoming/**` ignore。

## 役割分担（VM共用）

- **Antigravity**: コード実装・commit・push を担当
- **Claude**: 監査・修正指示書（`修正指示_20260606.md`）生成・本ドキュメント更新を担当
- 双方、他エージェントの作業ファイル・プロセスを予告なく上書き/停止しないこと

## 現在のブランチ・最終コミット

- **canonical ブランチ**: `main`（本番）
- **main 最新**: `e6e2f97 Merge PR #1: V2 Bohemian Natural リデザイン`（**本番デプロイ済み**）
- **PR**: #1「V2 Bohemian Natural リデザイン」 **マージ済み（クローズ）**
- **feat/v2-bohemian-natural**: 役割完了。**今後の変更は main から新ブランチを切る**こと（feat は整理/削除可）。

## 完了済みタスク（2026-06-06 時点）

- V2リデザイン適用 / PR #1 作成 / Vercel公開（リポ Public 化で作者アクセス問題を解決、commit作者を `puriliangresidence.bali@gmail.com` に統一）
- 価格を IDR ベース化＋locale 別通貨表示（参考価格注記）
- Twin Studio 画像表示修正（ファイル名のスペース→アンダースコア + `url()` クォート化）
- ホーム Hero の「3 rooms · …」バナー＋「空室を見る」ボタン削除（全言語）
- 予約: 規約2チェックが両方ONで送信ボタン有効化
- 連絡先（Email/WhatsApp）全削除 → Reserve / FAQ 導線へ置換
- Twin 説明文の「同じ広さ」等の誤表現を削除（全言語）
- 住所変更: `Jl. Tukad Balian Selatan No.12, Sidakarya, Denpasar Selatan, Bali`（"Tabanan" 全廃）／地図座標も Sidakarya 系へ更新
- ブランド表記: ヘッダー/フッターのロゴを「Puri Liang Residence」(fullName) に
- フッターに「Powered by JPFT」ロゴ＋ japanpft.com リンク（ローカル設置 `public/images/powered-by.png`、クリーム角丸チップで視認性確保）
- フッター縦余白の半減＋「JP · EN · ID」ラベル削除
- SEO: siteName「Puri Liang Residence」/ Home title ブランド先頭＋新description / title absolute化 / og:site_name / WebSite JSON-LD / og:locale(ja_JP/en_US/id_ID) / og:image(Home_Villa.jpg) / Twitterカード
- Web3Forms 設定・デプロイ完了 / **本番フォーム実送信E2Eテスト確認済**
- **本番公開**: PR #1 を main にマージ（`e6e2f97`）→ 本番デプロイ success → 本番URLで全反映確認（Tabanan 0件 / 価格IDR / OGタグ / Powered by）

## 次にやること（公開後 / 優先順）

1. **Google Search Console で再インデックス申請**（sitemap.xml 送信＋主要URLのインデックス登録リクエスト）。タイトル/説明/サイト名/住所の検索反映を促進（反映まで数日〜）。
2. en/id 翻訳のネイティブレビュー（特に id）
3. King Studio 写真差し込み（2026年6月撮影予定 / 現在は `photos: []` でプレースホルダ）
4. （任意）専用 OG 画像 1200×630 を作成し差し替え
5. 旧スキーマキー削除（V2 安定後、別PR）
6. （任意）独自ドメイン取得（`.vercel.app` 脱却 / Google の「Vercel」サイト名表示の根本解消）
7. Next.js 16 `middleware.ts` → `proxy.ts` 移行（廃止予定警告）

## 既知の問題・触ってはいけない箇所

- **フォーム**: キー未設定だと「モック成功（無送信）」になる設計。Vercel にキー設定済みだが、**環境(Production/Preview)別の設定漏れに注意**。実送信は要 E2E 確認。
- 残存 lint warning（非ブロッキング）。連絡先削除に伴い `ReserveForm.tsx` の `BRAND`/`tBrand` 等が未使用化していないか要確認。
- **VM共用**: 他エージェント（Gemini/Antigravity）のプロセス・作業を予告なく停止/上書きしない。
- `.incoming/`（受領パッケージ, gitignore済）/ `修正指示_20260606.md`（未追跡の作業メモ）。
- King Studio は写真未撮影 → プレースホルダ表示中。

## デプロイ / 環境

- Vercel: shun-projects-workspace / Hobby / リポ **Public**
- 本番URL: `https://puri-liang-residence.vercel.app`（🟢 **新サイト稼働中** / main `e6e2f97`）
- プレビュー: ブランチ自動デプロイ（**Deployment Protection 有効＝閲覧にVercelログイン必要**）
- 環境変数: `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`（設定済）/ `NEXT_PUBLIC_BASE_URL`（任意・既定 `https://puri-liang-residence.vercel.app`）
- Google site verification token: `layout.tsx` に設定済（Search Console 連携可）

---

- **最終更新日時**: 2026-06-06（本番公開後）
- **更新したエージェント名**: Claude
