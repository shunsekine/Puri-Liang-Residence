# Puri Liang Residence - Booking Automation (GAS & Webhook)

Webサイトからの予約問い合わせをプロキシ経由で受信し、ステータス管理・一次自動送信・WhatsApp文面生成・下書き作成・リマインダー通知を行う Google Apps Script (GAS) システムです。

## 全体アーキテクチャ

1. **予約フォーム** (`ReserveForm.tsx`) ➔ Next.js API Route (`app/api/reserve/route.ts`)
2. **API Route** ➔ GAS Webhook (`doPost`) （※安全なサーバー間通信でCORS回避＆URL保護）
3. **GAS (`doPost`)** ➔ スプレッドシート (`Inquiries`) へ記録
4. **GAS 定期トリガー (10〜15分おき)** ➔ 受信から15分経過した正常な問い合わせへ一次自動送信（フラグありの場合は下書き作成）
5. **担当者ステータス変更 (onEdit)** ➔ 「空室」「満室」「キャンセル待ち」の最終回答メールを「新規下書き」作成
6. **日次トリガー** ➔ 宿泊30前になったキャンセル待ち顧客を担当者へメールリマインド通知

---

## 環境変数の設定 (Next.js側)

`.env.local` または Vercelの環境変数に以下を設定してください。

```env
GAS_WEBHOOK_URL=https://script.google.com/macros/s/<YOUR_SCRIPT_ID>/exec
```

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
* L列: `IrregularFlag` (`なし` / `定員超過...` / `規約外キーワード...`)
* M列: `Status` (`1次送信待ち`, `1次送信済`, `空室`, `満室`, `キャンセル待ち`, `最終送信待ち`)
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
