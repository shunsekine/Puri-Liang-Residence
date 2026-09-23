# Puri Liang Residence - Booking Automation (GAS & Webhook)

Webサイトからの予約問い合わせをプロキシ経由で受信し、ステータス管理・一次自動送信・WhatsApp文面生成・下書き作成・リマインダー通知を行う Google Apps Script (GAS) システムです。

## 全体アーキテクチャ

1. **予約フォーム** (`ReserveForm.tsx`) ➔ Next.js API Route (`app/api/reserve/route.ts`)
2. **API Route** ➔ GAS Webhook (`doPost`) （※安全なサーバー間通信でCORS回避＆URL保護）
3. **GAS (`doPost`)** ➔ スプレッドシート (`Inquiries`) へ記録
4. **GAS 定期トリガー (10〜15分おき)** ➔ 受信から15分経過した正常な問い合わせへ一次自動送信(フラグありの場合は下書き作成)。いずれの場合も `Settings.NOTIFICATION_EMAIL` へ担当者通知メールを送信。行ごとに隔離して処理し、失敗した行は `エラー` に退避して担当者へまとめて通知（後述「障害時の挙動」）
5. **担当者ステータス変更 (onEdit)** ➔ 「空室」「満室」「キャンセル待ち」の最終回答メールを「新規下書き」作成
6. **日次トリガー** ➔ 宿泊30前になったキャンセル待ち顧客を担当者へメールリマインド通知

---

## 環境変数の設定 (Next.js側)

`.env.local` または Vercelの環境変数に以下を設定してください。

```env
GAS_WEBHOOK_URL=https://script.google.com/macros/s/<YOUR_SCRIPT_ID>/exec
GAS_WEBHOOK_SECRET=<openssl rand -hex 32 の出力。GAS のスクリプト プロパティ WEBHOOK_SECRET と同じ値>
```

### Webhook の共有秘密（2026-09-23 追加・WO-PB-3）

Web アプリは「全員（匿名）」に公開されるため、URL を知っているだけで誰でも `Inquiries` に記帳でき、15 分後にはその宛先へ一次返信メールが自動送信されてしまう。これを塞ぐため、プロキシ（`app/api/reserve/route.ts`）が本文に `webhook_secret` を付け、`doPost` がスクリプト プロパティ `WEBHOOK_SECRET` と比較してから記帳する（`doPost` は HTTP ヘッダーを読めないため本文で渡す）。

- **fail-closed**: GAS はプロパティが未設定・32 文字未満なら全件拒否（`{"success":false,"error":"unauthorized"}`）。Next は URL 設定済みで秘密が未設定なら 503 で転送しない。
- 秘密はシート（`Settings`）に置かない（オーナー側に見えるため）。スクリプト プロパティは「プロジェクトの設定 → スクリプト プロパティ」。
- **反映順**（逆にすると本番フォームが止まる）: Vercel に `GAS_WEBHOOK_SECRET` → Next をデプロイ → GAS にプロパティ → GAS を再デプロイ（「デプロイを管理 → 編集 → 新バージョン」で URL を変えない）→ 本番フォームから 1 件送って記帳を確認。
- 秘密を替えるときも同じ順（両側に同値を入れてから GAS を再デプロイ）。検証は `npm run gas:check`（`test/doPost.test.js`）と `npm run check:public`（`tests/reserve-route.test.mjs`）。

---

## セットアップ手順 (clasp を使用)

1. ご自身の Google Drive で新規スプレッドシートを作成します。
2. スプレッドシートのメニューから「拡張機能」>「Apps Script」を開きます。
3. Apps Script のプロジェクト設定から「スクリプトID」をコピーします。
4. ターミナルで `gas-booking-automation` ディレクトリに移動し、以下のコマンドを実行します。
   ```bash
   npm install -g @google/clasp
   clasp login
   clasp clone <YOUR_SCRIPT_ID>
   ```
5. `clasp push` でデプロイ後、GASエディタで「デプロイ」>「新しいデプロイ」を開き、以下のように設定してデプロイします。
   * **種類**: Web アプリ
   * **次のユーザーとして実行**: 自分 (Me)
   * **アクセスできるユーザー**: 全員 (Anyone)
6. 発行された Web アプリ URL を Next.js の環境変数 `GAS_WEBHOOK_URL` に設定します。
   併せて「Webhook の共有秘密」の手順でスクリプト プロパティ `WEBHOOK_SECRET` と `GAS_WEBHOOK_SECRET` を設定します（未設定だと全件拒否）。
7. GASエディタで以下の2つのトリガーを設置します。
   * **`processAutoReplies`**: 時間主導型 / 分単位のタイマー / 10分〜15分おき
   * **`sendReminders`**: 時間主導型 / 日付ベースのタイマー / 毎日午前8時〜9時など

---

## スプレッドシート構成

### 1. Inquiries シート（シート名: `Inquiries`）
* A列: `ID` (例: INQ-001)
* B列: `Timestamp` (受信日時)
* C列: `Name` (顧客名)
* D列: `Email` (顧客メールアドレス)
* E列: `Language` (言語: `ja`, `en`)
* F列: `CheckIn` (チェックイン日)
* G列: `CheckOut` (チェックアウト日)
* H列: `RoomType` (部屋タイプ)
* I列: `Guests` (人数)
* J列: `Remarks` (備考)
* K列: `PeriodCategory` (`1ヶ月以内` / `1ヶ月以上先`)
* L列: `IrregularFlag` (`なし` / `定員超過...` / `規約外キーワード...` / `過去日付検知...`)
* M列: `Status` (`1次送信待ち`, `1次送信済`, `空室`, `満室`, `キャンセル待ち`, `最終送信待ち`, `エラー`)
* N列: `WhatsAppText` (自動生成されるオーナー向け英語テキスト)
* O列: `MessageId` (リクエスト追跡ID)

### 2. Settings シート（シート名: `Settings`）
* A列: `Key` / B列: `Value`
* `NG_KEYWORDS`: `cancel, refund, terms, 規約, discount`
* `NOTIFICATION_EMAIL`: `(担当者のメールアドレス)`

### 3. Templates シート（シート名: `Templates`）
* A列: `TemplateID` (例: `1MonthLater_ja`, `1MonthLater_en`, `1MonthWithin_ja`, `Available_ja`, `Full_ja`, `AcceptWaiting_ja`)
* B列: `Subject` (メール件名)
* C列: `Body` (メール本文 - プレースホルダー `{Name}`, `{CheckIn}`, `{CheckOut}`, `{ID}` 等が使用可能)

---

## 障害時の挙動（2026-09-10 追加）

背景: 2026-09-09 に `processAutoReplies` が Google 側の一過性エラー
`Service Spreadsheets failed while accessing document with id …` で1回失敗した（自己回復済み・実害なし）。
このクラスのエラーは GAS 運用で周期的に起きるため、以下の構造で吸収する。

* **リトライ（`src/Retry.ts`）**: スプレッドシートの読み書きは指数バックオフ付きで最大4回試行する（待機 1s→2s→4s）。
  `GmailApp.sendEmail` / `createDraft` は二重送信を避けるためリトライしない。
* **行単位の隔離（`EmailService.sendAutoReplies`）**: 1行の失敗で後続の問い合わせが止まらない。
  失敗した行は Status を `エラー` に変更し、`NOTIFICATION_EMAIL` へ「行番号・ID・エラー文」を1通にまとめて通知する。
  担当者が原因を修正して Status を `1次送信待ち` に戻すと次回トリガーで再処理される。
* **残存リスク**: `sendEmail` 成功直後の `updateStatus` がリトライ後も失敗した場合のみ、次回実行で一次返信が二重送信されうる。

### 失敗通知メール（`Summary of failures for Google Apps Script`）の読み方

| 本文の特徴 | 判定 |
|---|---|
| `Service Spreadsheets failed while accessing document` が **単発**（表の行が1〜数件で、以後の実行は成功） | Google 側の一過性エラー。**対応不要** |
| 同じエラーが **連続**（表の行が多数、または翌日も届く） | スプレッドシートの共有解除・削除・認可失効を疑う。要対応 |
| `Invalid email: …` | 顧客メール（`…`が顧客アドレス）または `NOTIFICATION_EMAIL` が不正。該当行を修正 |
| `Authorization is required` / `SyntaxError: Cannot use import statement` | 再認可、またはトランスパイル前の `.ts` を push した疑い。要対応 |
| `You do not have permission to call GmailApp…`（Function: `onEdit`） | `onEdit` がシンプルトリガーのまま。インストール型トリガーとして登録し直す |

---

## 検証（リポジトリ側）

```bash
npm run gas:check   # 型チェック + スタブ付き合成テスト（test/sendAutoReplies.test.js）。期待 exit 0
```

GAS 本体への反映は `clasp push` → Apps Script エディタで再デプロイ（`src/Retry.ts` を含めること）。
