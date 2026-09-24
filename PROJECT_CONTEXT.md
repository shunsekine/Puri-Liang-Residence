# PROJECT_CONTEXT — Puri Liang Residence Website

コンテキスト予算: soft=9000 hard=12000 history=2000

> グローバルルールに基づくプロジェクトコンテキスト。VM共用（Gemini / Antigravity / Claude）のため、作業前に本ファイルを確認すること。

---

## プロジェクト概要

- **目的**: バリ島 デンパサール南部シダカルヤ（Sidakarya, Denpasar Selatan）の長期滞在・リモートワーク向けレジデンス「Puri Liang Residence」公式ウェブサイト
- **方向性**: V2 Bohemian Natural リデザイン（Forest 緑系パレット / Docked nav / 3言語 / FAQ / 実送信連携 / IDRベース価格）
- **開発の背景とオーナーとのスタンス**:
  - **ターゲットと提供価値**: 本サイトはインドネシア国外の客をメインターゲットとする。当方が外国人客との予約調整を担うことで、オーナー（母親）の言語的・実務的負担を大きく減らすことを提供価値の主軸とする。
  - **システムのブラックボックス化（防衛策）**: 構築したシステムは当方の善意による独自の専有資産である。悪用や無断複製を防ぐため、オーナー側（息子含む）には裏側の技術的な仕組み（GAS連携等）を一切明かさず、ブラックボックスを貫く。
  - **善意の無償支援と保守費用**: 制作・基本保守の費用は徴収しない。本サイト経由の予約に限り、直接契約時の基本価格に上乗せされた差額分を保守費用として当方が受け取る。
  - **撤退の権利と公式アドレスの利用**: 共同ビジネスではなくあくまで善意の支援であるため、当方の判断でいつでもサイトを閉鎖・削除できる権利を維持する。なお、Google Map等の権限要求や連絡時には、オーナー側の心理的抵抗を減らすため、個人のアドレスではなく `puriliangresidence.bali@gmail.com` を一貫して使用する。
- **現状**: 🟢 **本番公開済み・運用中**（2026-06-06 公開 / PR #1）。本番URL `https://puri-liang-residence.vercel.app` で稼働中。2026-07-02に利用規約統合を実施。**2026-07-25 に「GAS（Google Apps Script）による予約半自動化バックエンド」を導入・疎通完了**。従来のWeb3Formsから自社専用のPush型システムへ移行しました。

## 技術スタック

| カテゴリ | バージョン / 内容 |
|---|---|
| Next.js | 16.2.3 (App Router, Turbopack) |
| React | 19.2.3 |
| next-intl | 4.8.1 |
| Tailwind CSS | 4.1.18 |
| TypeScript | path alias `@/*` → `./*` |
| フォーム送信・バックエンド | **Next.js API Route (`/api/reserve`) ➔ GAS Webhook ➔ Google Spreadsheet**。環境変数 `GAS_WEBHOOK_URL` を使用（旧Web3Formsキーは廃止）。 |
| デプロイ | Vercel（チーム: shun-projects-workspace / owner: puriliangresidence.bali@gmail.com / Hobby・無料 / リポ Public） |

## 検証手段

| 対象 | コマンド（プロジェクトルート） | 期待 exit code |
|---|---|---|
| Next.js 型チェック | `npx tsc --noEmit` | 0 |
| Next.js ビルド | `npm run build` | 0 |
| Lint | `npm run lint` | 現状 **1**（GAS ソースの `any` 等、既存4件。新規エラーを増やさないことを基準にする） |
| GAS（`gas-booking-automation/`） | `npm run gas:check`（型チェック＋スタブ付き合成テスト） | 0 |
| 公開物の最低ライン（§11 ③⑤・WO-PB-3） | `npm run check:public`（検出力の自己テスト→追跡ファイルの秘密・ブラウザへ届く env allowlist・ログの PII→プロキシの共有秘密テスト）。成果物検査は `npm run build` の postbuild で自動 | 0 |
| モデル層監査（不変条件スロット） | `python3 /home/ubuntu/agent-global-rules/audit_model_layer.py . --gate` | 0 |

GAS の**実機**への反映は検証手段が無い。`src/*.ts` は `import`/`export` を含むためそのままでは貼れず、`clasp push` も未検証。2026-09-24 は import 行と `export` を外して `tsc --target ES2019 --module none` で変換し、エディタに貼った（変換後も `gas:check` の 2 テストが全ファイル 1 スコープで通ることを確認）。反映後は本番フォームから 1 件送り、応答 `success:true` と記帳を確認する（匿名実行の `doPost` はエディタの「実行数」でログを開けない）。

## 不変条件と担保場所

無い（データは Google Sheets が保持。書込は GAS `gas-booking-automation/src/SpreadsheetService.ts` の `appendRow`/`setValue` の 1 モジュール + 人手のステータス変更。Next 側 `app/api/reserve/route.ts` は proxy で値を持たない）
- §11 ①②（別主体・行ルール）: **該当なし**（ログイン・会員データ・ブラウザから読める DB が無い。Sheets への唯一の外部書込口 `doPost` は共有秘密 `WEBHOOK_SECRET` で fail-closed。担保＝`npm run gas:check` の `doPost.test.js`）。ログインや読み出し API を足した時点で実テストが要る

## 予約自動化アーキテクチャ・設計思想（2026-07-25導入）

- **目的と意義**: 予約頻度（月1回程度）に対し、Gmailを5分おきに監視するPull型設計はリソースの無駄であり不毛であった。これを解消するため、サイトから予約送信した時点で即座にバックエンドをキックする **Push型（Webhook）アーキテクチャ** に転換した。
- **システムの役割**: 
  - **Next.js側 (`app/api/reserve/route.ts`)**: クライアントから直接GASを叩かせず、CORS回避とURL秘匿のためのプロキシ。
  - **GAS側**: Webhook (`doPost`) でデータを受け取りスプレッドシートへ即時記帳。イレギュラー（定員超過・NGワード）をルールベースで厳格検知。
  - **自動化と人間介入の分離**: 正常な一次返信はGASの定期トリガーにより15分後に遅延送信（機械的すぎない対応）。最終回答（空室/満室等）は担当者がスプレッドシートのステータスを手動変更した際、GASが「メールの下書き」を自動生成する。完全自動化せず、最終確認を人間に残す「半自動化」の徹底。

## 価格・通貨方針（重要）

- **基準通貨は IDR（実支払い）**。表示は locale 別: `ja→JPY` / `en→USD` / `id→IDR`。各価格に「参考価格・支払いは IDR」注記。
- 簡易レート: **100 JPY = 11,000 IDR（1JPY=110IDR）** / **1 USD = 18,000 IDR**
- 月額: Villa `Rp 8,500,000`(¥77,000/$470) / King `Rp 6,500,000`(¥59,000/$360) / Twin `Rp 5,500,000`(¥50,000/$310)。電気代 `Rp 500,000`(¥4,500/$30)/月。
- ヘルパー: `lib/data.ts` の `currencyForLocale` / `formatPrice` / `roomPriceAmount` / `electricityAmount`

## ディレクトリ構成（主要）

```
app/
├── globals.v2.css / globals.v2.pages.css
├── sitemap.ts
├── api/reserve/route.ts          # [NEW] GAS連携用プロキシAPI
└── [locale]/   (ja|en|id)
    ├── layout.tsx
    ├── page.tsx
    ├── faq|features|location|reserve|rooms/page.tsx
components/
├── common/
└── pages/{Hero,ReserveForm.tsx(API送信化)}
gas-booking-automation/           # [NEW] GAS バックエンドソースコード
├── src/{Main,Config,EmailService,SpreadsheetService,WebhookParser}.ts
└── README.md
lib/{data.ts(通貨・キャンセルポリシー等), tokens.ts}
messages/{ja,en,id}.json
```

## コーディング規約・設計方針

- **ハルシネーション（捏造）の絶対防止**: `agent-global-rules/AGENTS.md` に基づき、URLやメールアドレス、仕様などを適当なプレースホルダーで捏造しない。不明な場合は必ずソースコードから裏付けを取るか、明確にユーザーへ質問する。
- **連絡先非掲載ポリシー**: Email/WhatsApp 等の直接連絡先はサイトに一切載せない。送信システム用の隠しアドレスは `puriliangresidence.bali@gmail.com` で統一。
- **多言語**: `app/[locale]/...` / matcher `/(ja|en|id)/:path*`

## 完了済みタスク（直近 / 2026-09-10・GAS の一過性エラー対策）

- **発端**: 09-09 10:07 JST に `processAutoReplies` が `Service Spreadsheets failed while accessing document with id …` で1回失敗（Apps Script の日次失敗ダイジェストで検知）。単発・以後の実行は成功しており Google 側の一過性エラーと判定、実害なし。
- **対策**: `src/Retry.ts`（スプレッドシート操作の指数バックオフ・最大4回）／`sendAutoReplies` の行単位隔離（失敗行は `エラー` に退避し担当者へ1通で通知）／`npm run gas:check`（型チェック＋合成テスト）を新設。詳細と失敗通知の読み方は `gas-booking-automation/README.md`「障害時の挙動」。
- **GAS 実機へ反映済み**（2026-09-24、09-05・WO-PB-3 の変更と合わせて。バージョン番号は Apps Script「デプロイを管理」で確認）。

## 完了済みタスク（2026-09-05・予約データ整合性と通知ギャップの是正）

- **過去日付での予約送信を防止**: ReserveFormのチェックイン初期値が固定文字列（`'2026-06-15'`）でメンテされておらず、日付欄を一度も触らず送信すると常に過去日付になる欠陥を修正（本日基準の動的初期値＋`min`属性＋`validate()`でのJSチェック。`<form noValidate>`のためJS側チェックが実質の防御）。GAS側（`WebhookParser.detectIrregularities`）にも同種の検知を追加し、フォームを経由しない直接POSTにも対応。3言語に`Reserve.errors.checkinPast`を追加。
  - 発端: INQ-005で「送信日時7/30・チェックイン/アウトが過去日付」という不自然なレコードを検知。オーナー側関係者（ユニ氏の息子）によるテスト操作と推定、当該レコードへの特別対応は不要と判断。
- **問い合わせ発生時の担当者通知を追加**: 一次返信の自動送信/下書き作成時（`EmailService.sendInitialReply`）に、既存の`Settings.NOTIFICATION_EMAIL`へ通知メールを送信するよう変更。従来は問い合わせが来ても担当者（あなた）に通知が飛ばず、スプレッドシートを自分で開かない限り気づけない設計だった。
- コミット `767b6db`（origin/main push済み）。GAS 実機へは 2026-09-24 に反映済み。

## 完了済みタスク（以前）

- **2026-07-30**: 最低滞在期間を1ヶ月→2週間に短縮（0.5ヶ月選択・専用料金ロジック追加）。支払い・キャンセルポリシー文言の整理。ja/en/id翻訳の自然化。Roomsページ UI微調整。
- **2026-07-25**: GASバックエンド連携（Web3Formsから自前Next.js API Route + GAS WebhookへのPush型設計への移行、遅延自動返信の実装）。
- **2026-07-02**: 利用規約（T&C）のサイト統合、同意チェックの1本化。
- **2026-06-10**: Featureページの改良、Location方位ダイヤルへの改良。
- **2026-06-08**: 全ページ遷移ローディングアニメーションの追加。

## in_flight

- （なし）

## 次にやること（公開後 / 優先順）

0. **【高】WO-PB-3F（F1・F2・F3・F5・F6 と GAS 変換のスクリプト化・秘密の空白除去）**: `docs/2026-09-24-WO-PB-3F-reserve-abuse.md`。着手前に §5 の 2 点をユーザーに確認。
1. （0 に統合）
2. **Google Search Console で再インデックス申請**。
3. King Studio 写真差し込み。
4. 旧スキーマキー削除（V2 安定後、別PR）。
5. Next.js 16 `middleware.ts` → `proxy.ts` 移行（廃止予定警告）。

## 既知の問題・触ってはいけない箇所

- **フォーム**: 環境変数 `GAS_WEBHOOK_URL` 未設定時はモック成功レスポンスを返す安全設計。Vercel設定忘れに注意。URL 設定済みで `GAS_WEBHOOK_SECRET` 未設定なら 503（転送しない）。
- **§11 ④ 攻撃者役レビュー**: 2026-09-23 Fable 5.1（実装は Opus 5.5）。所見 8 件（高 2・中 3・低 3）、**F1 スパム踏み台・F2 記帳偽造（高）は未対応**。詳細と状態は `docs/2026-09-23-WO-PB-3-attacker-review.md`。
- **§11 ⑤ ログ**: Next の route と GAS は本文・個人情報をログに書かない（検査 C）。記録は Sheets の `Inquiries`（ID・受信日時）が担う。閲覧者の記録は無い（ログインが無いため）。
- **VM共用**: 他エージェント（Gemini/Antigravity/Claude）のプロセス・作業を予告なく停止/上書きしない。
- **GAS のデプロイは `puriliangresidence.bali@gmail.com` で行う**: スプレッドシートとスクリプトの所有者は個人アカウントだが、トリガー（`processAutoReplies` 等）は puriliang が作成しており、顧客への返信はそこから送られる。個人アカウントで認可・手動実行すると個人の Gmail から顧客へ送られうる。Web アプリのデプロイは「デプロイを管理 → 鉛筆 → 新バージョン」（「新しいデプロイ」は別 URL を作る）。
- **GASコードの管理**: GAS上のコードを変更する場合は、リポジトリ内の `gas-booking-automation/src` も合わせて同期・更新すること。
- **GAS 失敗通知（`Summary of failures for Google Apps Script: 無題のプロジェクト`）の判定**: 本文の表（Function / Error Message / 行数）で判定する。`Service Spreadsheets failed while accessing document` が**単発**なら一過性で対応不要、**連続**なら共有・削除・認可失効を疑う。判定表は `gas-booking-automation/README.md`「失敗通知メールの読み方」。件名だけで「要対応」と判定しない。

## デプロイ / 環境

- Vercel: shun-projects-workspace / Hobby / リポ **Public**
- 本番URL: `https://puri-liang-residence.vercel.app`
- プレビュー: ブランチ自動デプロイ（Deployment Protection 有効）
- 環境変数: `GAS_WEBHOOK_URL`（新規必須） / `GAS_WEBHOOK_SECRET`（必須・GAS のスクリプト プロパティ `WEBHOOK_SECRET` と同値・32 文字以上） / `NEXT_PUBLIC_BASE_URL`。ブラウザへ配る変数は `scripts/check-public-baseline.mjs` の allowlist で宣言

---

- **最終更新日時**: 2026-09-24（WO-PB-3 の本番反映・GAS 反映方法）
- **更新したエージェント名**: Claude (claude-opus-5-5)
