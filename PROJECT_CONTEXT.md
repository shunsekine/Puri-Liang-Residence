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

## 完了済みタスク（直近 / 2026-09-05・予約データ整合性と通知ギャップの是正）

- **過去日付での予約送信を防止**: ReserveFormのチェックイン初期値が固定文字列（`'2026-06-15'`）でメンテされておらず、日付欄を一度も触らず送信すると常に過去日付になる欠陥を修正（本日基準の動的初期値＋`min`属性＋`validate()`でのJSチェック。`<form noValidate>`のためJS側チェックが実質の防御）。GAS側（`WebhookParser.detectIrregularities`）にも同種の検知を追加し、フォームを経由しない直接POSTにも対応。3言語に`Reserve.errors.checkinPast`を追加。
  - 発端: INQ-005で「送信日時7/30・チェックイン/アウトが過去日付」という不自然なレコードを検知。オーナー側関係者（ユニ氏の息子）によるテスト操作と推定、当該レコードへの特別対応は不要と判断。
- **問い合わせ発生時の担当者通知を追加**: 一次返信の自動送信/下書き作成時（`EmailService.sendInitialReply`）に、既存の`Settings.NOTIFICATION_EMAIL`へ通知メールを送信するよう変更。従来は問い合わせが来ても担当者（あなた）に通知が飛ばず、スプレッドシートを自分で開かない限り気づけない設計だった。
- コミット `767b6db`（origin/main push済み）。**GAS側（`WebhookParser.ts`/`EmailService.ts`）はリポジトリのソース更新のみで、Google Apps Scriptへの実デプロイ（`clasp push`+再デプロイ）は別途手動対応が必要**（本VM環境にclaspが未セットアップのため代行不可）。

## 完了済みタスク（以前）

- **2026-07-30**: 最低滞在期間を1ヶ月→2週間に短縮（0.5ヶ月選択・専用料金ロジック追加）。支払い・キャンセルポリシー文言の整理。ja/en/id翻訳の自然化。Roomsページ UI微調整。
- **2026-07-25**: GASバックエンド連携（Web3Formsから自前Next.js API Route + GAS WebhookへのPush型設計への移行、遅延自動返信の実装）。
- **2026-07-02**: 利用規約（T&C）のサイト統合、同意チェックの1本化。
- **2026-06-10**: Featureページの改良、Location方位ダイヤルへの改良。
- **2026-06-08**: 全ページ遷移ローディングアニメーションの追加。

## 次にやること（公開後 / 優先順）

1. **【要対応】GAS側の再デプロイ**: `gas-booking-automation/src/WebhookParser.ts`・`EmailService.ts`の変更（過去日付検知・担当者通知メール）を`clasp push`し、Apps Scriptエディタで再デプロイする。リポジトリのソースは更新済みだが、実際のスプレッドシート/メール挙動には未反映（本VMにclasp未セットアップのためエージェント側からは代行不可）。
2. **Vercel本番環境への環境変数登録と再デプロイ**: お客様にて `GAS_WEBHOOK_URL` を本番環境へ設定し、ビルドを通す（これをもって自動化の本番稼働が開始）。
3. **Google Search Console で再インデックス申請**。
4. King Studio 写真差し込み。
5. 旧スキーマキー削除（V2 安定後、別PR）。
6. Next.js 16 `middleware.ts` → `proxy.ts` 移行（廃止予定警告）。

## 既知の問題・触ってはいけない箇所

- **フォーム**: 環境変数 `GAS_WEBHOOK_URL` 未設定時はモック成功レスポンスを返す安全設計。Vercel設定忘れに注意。
- **VM共用**: 他エージェント（Gemini/Antigravity/Claude）のプロセス・作業を予告なく停止/上書きしない。
- **GASコードの管理**: GAS上のコードを変更する場合は、リポジトリ内の `gas-booking-automation/src` も合わせて同期・更新すること。

## デプロイ / 環境

- Vercel: shun-projects-workspace / Hobby / リポ **Public**
- 本番URL: `https://puri-liang-residence.vercel.app`
- プレビュー: ブランチ自動デプロイ（Deployment Protection 有効）
- 環境変数: `GAS_WEBHOOK_URL`（新規必須） / `NEXT_PUBLIC_BASE_URL`

---

- **最終更新日時**: 2026-09-05（過去日付予約の防止・問い合わせ担当者通知の追加）
- **更新したエージェント名**: Claude (claude-sonnet-5)
