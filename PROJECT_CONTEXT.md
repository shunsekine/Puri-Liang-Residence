# PROJECT_CONTEXT — Puri Liang Residence Website

> グローバルルールに基づくプロジェクトコンテキスト。VM共用（Gemini / Antigravity / Claude）のため、作業前に本ファイルを確認すること。

---

## プロジェクト概要

- **目的**: バリ島 デンパサール南部シダカルヤ（Sidakarya, Denpasar Selatan）の長期滞在・リモートワーク向けレジデンス「Puri Liang Residence」公式ウェブサイト
- **方向性**: V2 Bohemian Natural リデザイン（Forest 緑系パレット / Docked nav / 3言語 / FAQ / 実送信連携 / IDRベース価格）
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

## 完了済みタスク（直近 / 2026-07-25・GASバックエンド連携）

- **アーキテクチャのPush型化**: Web3Formsを廃止し、自前のNext.js API Routeから直接GAS WebhookエンドポイントへデータをPOSTする設計を構築。
- **GASバックエンドの実装**:
  - `doPost` によるデータ受付およびスプレッドシートへの記録処理。
  - `WebhookParser` による、サイト規定（キャンセルポリシー、部屋定員、NGワード）に基づくイレギュラー検知ロジック。
  - 定期トリガーによる、15分遅延の自動送信機能および、キャンセル待ち顧客への30日前リマインダー機能。
  - ステータス手動変更時の `onEdit` をトリガーとした「新規メール下書き作成」処理。
- **E2Eテスト**: GASへのコードデプロイ、トリガー設定、Next.jsの `.env.local` 設定を完了し、エンドツーエンドでの実証テスト（INQ-004の自動発番など）に100%成功。

## 完了済みタスク（以前）

- 2026-07-02: 利用規約（T&C）のサイト統合、キャンセル条項の単純化（チェックイン7日前100%、3日前50%、以降返金不可へ後日さらに更新済）、同意チェックの1本化。
- 2026-06-10: Featureページの改良、Location方位ダイヤル（コンパス）への改良とGoogleマップ座標修正。
- 2026-06-08: 全ページ遷移ローディングアニメーションの追加。

## 次にやること（公開後 / 優先順）

1. **Vercel本番環境への環境変数登録と再デプロイ**: お客様にて `GAS_WEBHOOK_URL` を本番環境へ設定し、ビルドを通す（これをもって自動化の本番稼働が開始）。
2. **文言（コピー）の加筆・修正フェーズ**（進行中）。
3. **Google Search Console で再インデックス申請**。
4. en/id 翻訳のネイティブレビュー。
5. King Studio 写真差し込み。
6. 旧スキーマキー削除（V2 安定後、別PR）。
7. Next.js 16 `middleware.ts` → `proxy.ts` 移行（廃止予定警告）。

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

- **最終更新日時**: 2026-07-25（GAS半自動化バックエンド実装および疎通確認完了）
- **更新したエージェント名**: Antigravity (Gemini)
