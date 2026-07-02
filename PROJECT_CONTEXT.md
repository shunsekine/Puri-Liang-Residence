# PROJECT_CONTEXT — Puri Liang Residence Website

> グローバルルールに基づくプロジェクトコンテキスト。VM共用（Gemini / Antigravity / Claude）のため、作業前に本ファイルを確認すること。

---

## プロジェクト概要

- **目的**: バリ島 デンパサール南部シダカルヤ（Sidakarya, Denpasar Selatan）の長期滞在・リモートワーク向けレジデンス「Puri Liang Residence」公式ウェブサイト
- **方向性**: V2 Bohemian Natural リデザイン（Forest 緑系パレット / Docked nav / 3言語 / FAQ / Web3Forms 実送信 / IDRベース価格）
- **現状**: 🟢 **本番公開済み・運用中**（2026-06-06 公開 / PR #1）。本番URL `https://puri-liang-residence.vercel.app` で新サイト稼働中。Web3Forms 実送信・本番フォームE2Eテスト確認済。2026-06-08 に**全ページ遷移ローディングアニメーション**を本番反映（`a5ea213`）。2026-06-10 に **Feature/Location の改善**を作業ブランチ `feat/features-location-update` で実装（プレビュー確認済み・**main 未マージ**）。現在は文言（コピー）加筆修正フェーズ。

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
├── common/{Header,Footer,LanguageSwitcher,ImageCarousel}.tsx   # ロゴは fullName 表示 / Footerに Powered by JPFT
├── common/PageTransitionLoader.tsx   # 初回ロード+全ページ遷移ローディングオーバーレイ(client)
└── pages/{Hero,ReserveForm}.tsx + v2/{RoomPreviewCard,RoomSimulator,FAQAccordionItem}.tsx
lib/{data.ts(通貨ヘルパー含む), tokens.ts}
messages/{ja,en,id}.json
public/images/   # 客室画像 + powered-by.png（会社ロゴ）+ loader-logo.png（ローダー用ブランドマーク288px/11KB）
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

- **今後の新規実装の原則（クオータ節約方針 / 2026-06-10〜）**: **Claude は実装指示書（Markdown）を生成**し、**実装・commit・push は Antigravity が担当**。Claude は要件整理・指示書作成・監査・本ドキュメント更新に専念。
  - ただし **Claude が既に実装まで完了した分は、重複作業を避けるためそのまま採用**（Antigravity に作り直させない）。
- **これまでの実績**: ローディングアニメーション / Feature・Location 改善は Claude が実装・push 済み。
- 双方、他エージェントの作業ファイル・プロセスを予告なく上書き/停止しないこと

## 現在のブランチ・最終コミット

- **canonical ブランチ**: `main`（本番）
- **main 最新**: `e352b68`（`feat/features-location-update` は `5c0c451` で**マージ済み・本番反映済み**）
- **未マージの作業ブランチ**: ⚠️ **`feat/terms-page`**（2026-07-02 / Claude）。利用規約（Terms & Conditions）統合一式。**ユーザーの「本番反映」指示でマージ予定**。
- **直近マージ済みブランチ**: `feat/features-location-update` / `feat/page-transition-loader`（削除可。念のため残置）
- **PR**: #1「V2 Bohemian Natural リデザイン」 **マージ済み（クローズ）**
- **今後の変更は main から新ブランチを切る**こと

## 完了済みタスク（直近 / 2026-07-02・`feat/terms-page` / main 未マージ）

- **利用規約（Terms & Conditions）のサイト統合**（オーナー提供の13条項を監査→統合。条項1(メール/WA限定)・4(12歳未満不可)はオーナー指示で除外、2は「チェックイン時に身分証提出」、3は「初回=1ヶ月分を3日前まで・残額はチェックイン時」、5は「事前許可のない来客禁止」に修正）
  - 支払い表記の整合: FAQ支払い・見積もりサマリー（`Reserve.summary.depositTitle/depositSuffix/balanceNote`）
  - 来客「事前申請制」→「事前許可制」（`HouseRules.items[4]` / FAQ来客）、FAQ 3件追加（延長・デポジット返金・責任）
  - Step2 に身分証提出の注記（`Reserve.fields.idNote`）
- **UX見直し（ユーザー指摘: 予約フォームのチェック3つは心理的障壁が高い／FAQとT&Cは別ページにすると心理的障壁が高い）を受けて再設計**
  - `/[locale]/terms` 単独ページは**廃止**。利用規約の正文（全12条）は `/[locale]/faq` ページ最下部に `id="terms"` セクションとして統合（`Terms.section.*` / `Terms.items` / サイドナビに項目追加）。導線は「疑問もルールも1ページ」に一本化。フッターの規約リンクも `/faq#terms` へ変更。sitemap から `/terms` を削除。
  - キャンセル条項を第3条として新設: **「チェックインの3日前以降のキャンセルはできません」のみ**（3日前まで支払い自体が発生しないため無料キャンセルは自明。3日前以降は現地判断とし、返金率などはサイトに明記しない方針）。旧キャンセルポリシー（2週間前50%/1週間前25%）は全箇所から削除。
  - 予約フォームの同意チェックを**3つ→1つに集約**（`agree` state 1本）。「ハウスルール（モーダル）と利用規約（キャンセルポリシー含む・`/faq#terms` を新タブ）を確認のうえ、同意します」の1チェックのみで送信可（`Reserve.terms.*` / `errors.agreeRequired`）。証跡としての明示同意は残しつつ、契約書面の取り交わし前段（問い合わせ段階）の摩擦を最小化。

## 完了済みタスク（2026-06-10・`feat/features-location-update`→ `5c0c451` で main マージ済み）

- **Feature ページ**（`app/[locale]/features/page.tsx`）
  - 写真の「01 / 4」番号表示（`v2-feat-tag`）を削除
  - 全写真に「準備中」注記を画像上に表示。`Common.photoPlaceholder` を3言語追加（ja「写真は準備中（後日更新）」/ en「To be updated」/ id「Segera diperbarui」）。CSS `.v2-photo-tbu`
- **Location 地図（Google埋め込み）**（`app/[locale]/location/page.tsx`）
  - 正確なピン座標に更新（`lib/data.ts` LOCATION: lat `-8.70543` / lng `115.2392145`）
  - 埋め込みを座標指定→**場所名+住所クエリ**に変更しピンで「場所情報」を表示（`LOCATION.placeQuery`）。座標指定は"ドロップピン=場所情報なし"になる
  - 「Google Mapで開く」=実在地点の共有リンク（`LOCATION.googleShareUrl` = maps.app.goo.gl）、「Apple Mapで開く」=名称+座標
- **Location 方位ダイヤル（コンパス改良版）**（鳥瞰図の置換）
  - 当初: コンパス→バリ島南部 俯瞰マップ（Wikimedia 輪郭 `Bali-outline.svg` を投影整合で背景）を試作 → **輪郭品質が不足のため撤去**（`lib/baliOutline.ts` 削除）
  - 最終: **方位ダイヤル**。中心 Puri Liang(Sidakarya) + N/E/S/W に代表エリア名＋距離/所要時間。CSS `.v2-cdial*`（grid areas で十字配置・レスポンシブ）
  - 各方位の距離/所要時間は `Location.directions[].access` を3言語追加。エリア名は `en`（"方位 · 地名"）から導出
  - **方角による色分けは廃止 → 単一アクセント（テラコッタ）で統一**（4方位詳細カード `dir-*` も統一）
  - 旧 `.v2-compass-hub/axis/cardinal`・`.v2-balimap*` CSS を整理。`Location.crossroads.mapCaption` 追加（3言語）

## 完了済みタスク（直近 / 2026-06-08）

- **全ページ遷移ローディングアニメーション追加**（`a5ea213` 本番反映済み）
  - `components/common/PageTransitionLoader.tsx`（client）新規。初回ロードで表示→フェードアウト／内部リンククリック捕捉で即時表示→`usePathname` 変化（遷移完了）で消去／戻る・進む(popstate)対応／最小表示 600ms でちらつき防止／`prefers-reduced-motion` 対応
  - スタイルは `app/globals.v2.css` に `plr-` 接頭辞で追記（衝突回避）。`app/[locale]/layout.tsx` の `<body>` 直下に組み込み（3言語共通・SSRで初回ペイントから被覆）
  - ロゴ素材（家＋木＋赤い太陽のブランドマーク）を Drive 受領 → 2048px原本を sharp で 288px/11KB に最適化し `public/images/loader-logo.png` 配置
  - 元素材は単体HTML（`showLoading/hideLoading` 手動制御）。React+ルーティング自動検知へ変換し見た目は100%維持

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

1. **`feat/terms-page` の本番反映**（ユーザー確認後に main へマージ）。利用規約統合一式を含む（未マージ）。
2. **文言（コピー）の加筆・修正フェーズ**（進行中）。messages/{ja,en,id}.json を3言語同期で修正。住所/価格/連絡先非掲載/ブランド表記の制約を厳守。**今後の新規実装は Claude が指示書を作成し Antigravity が実装**（クオータ節約）。
3. **Google Search Console で再インデックス申請**（sitemap.xml 送信＋主要URLのインデックス登録リクエスト）。タイトル/説明/サイト名/住所の検索反映を促進（反映まで数日〜）。
4. en/id 翻訳のネイティブレビュー（特に id）
5. King Studio 写真差し込み（2026年6月撮影予定 / 現在は `photos: []` でプレースホルダ）
6. （任意）専用 OG 画像 1200×630 を作成し差し替え
7. 旧スキーマキー削除（V2 安定後、別PR）
8. （任意）独自ドメイン取得（`.vercel.app` 脱却 / Google の「Vercel」サイト名表示の根本解消）
9. Next.js 16 `middleware.ts` → `proxy.ts` 移行（廃止予定警告）

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

- **最終更新日時**: 2026-07-02（利用規約統合実装後・`feat/terms-page` は main 未マージ）
- **更新したエージェント名**: Claude
