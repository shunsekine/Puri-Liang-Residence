# Puri Liang Residence - Booking Automation (GAS & Webhook)

Webサイトからの予約問い合わせをプロキシ経由で受信し、ステータス管理・一次自動送信・WhatsApp文面生成・下書き作成・リマインダー通知を行う Google Apps Script (GAS) システムです。

## 全体アーキテクチャ

1. **予約フォーム** (`ReserveForm.tsx`) ➔ Next.js API Route (`app/api/reserve/route.ts`)
2. **API Route** ➔ GAS Webhook (`doPost`) （※安全なサーバー間通信でCORS回避＆URL保護）
3. **GAS (`doPost`)** ➔ スプレッドシート (`Inquiries`) へ記録（受信時刻はサーバー時刻。送り手の `submitted_at` は使わない）
4. **GAS 定期トリガー (10〜15分おき)** ➔ 受信から15分経過した正常な問い合わせへ一次自動送信(フラグありの場合は下書き作成)。いずれの場合も `Settings.NOTIFICATION_EMAIL` へ担当者通知メールを送信。行ごとに隔離して処理し、失敗した行は `エラー` に退避して担当者へまとめて通知（後述「障害時の挙動」）
   * **送信上限（WO-PB-3F）**: 自動送信の直前に「同じアドレスへ24時間以内に自動返信済み」「今日（スクリプトのタイムゾーン）の自動返信が `DAILY_AUTO_REPLY_CAP` 件に到達」を判定し、当たれば送らずに下書き＋`IrregularFlag` に理由を追記＋担当者へ1実行1通で通知（行ごとの通知は出さない）。件数はシートの行（旗なしで、`1次送信待ち`・`エラー` 以外の状態＝自動返信を経た行）の受信日時で数える
5. **担当者ステータス変更 (onEdit)** ➔ 「空室」「満室」「キャンセル待ち」の最終回答メールを「新規下書き」作成
6. **日次トリガー** ➔ 宿泊30前になったキャンセル待ち顧客を担当者へメールリマインド通知
7. **月次トリガー（2026-09-24 追加）** ➔ 保存期間（約 2 年）を過ぎた問い合わせの個人データを消す（行は残す。後述「個人データの保存期間」）

* **テンプレートの言語（2026-09-24 追加）**: 一次返信・最終回答とも `Templates` の `${種類}_${言語}` を使い、無ければ `${種類}_en` で代用する（件名か本文が空の行は「無い」扱い）。代用したときは担当者に伝える（一次返信: 担当者通知メールに 1 行、最終回答: ステータスのセルのメモに日付付きで 1 行）。どちらも無ければ黙って止めない: 一次返信は行を `エラー` にして失敗通知、最終回答は下書きを作らずステータスのセルに理由をメモしてエラーにする

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
7. GASエディタで以下のトリガーを設置します。**トリガーは作成したアカウントで実行される**ため、必ず `puriliangresidence.bali@gmail.com` でログインして作成します（個人アカウントで作ると個人の Gmail から顧客・担当者へ送られうる）。
   * **`processAutoReplies`**: 時間主導型 / 分単位のタイマー / 10分〜15分おき
   * **`sendReminders`**: 時間主導型 / 日付ベースのタイマー / 毎日午前8時〜9時など
   * **`anonymizeExpiredInquiries`**（2026-09-24 追加）: 時間主導型 / 月ベースのタイマー / 毎月 1 日・午前 3 時〜4 時など（後述「個人データの保存期間」）

---

## スプレッドシート構成

### 1. Inquiries シート（シート名: `Inquiries`）
* A列: `ID` (例: INQ-001)
* B列: `Timestamp` (受信日時)
* C列: `Name` (顧客名)
* D列: `Email` (顧客メールアドレス)
* E列: `Language` (言語: `ja`, `en`, `id`)
* F列: `CheckIn` (チェックイン日)
* G列: `CheckOut` (チェックアウト日)
* H列: `RoomType` (部屋タイプ)
* I列: `Guests` (人数)
* J列: `Remarks` (備考)
* K列: `PeriodCategory` (`1ヶ月以内` / `1ヶ月以上先`)
* L列: `IrregularFlag` (`なし` / `定員超過...` / `規約外キーワード...` / `過去日付検知...` / `メール形式不正` / `氏名にURL` / `電話番号形式不正` / `国籍形式不正` / `滞在目的形式不正` / `同一アドレスへ24時間以内に自動返信済み` / `1日の自動返信上限(N件)に到達`)
* M列: `Status` (`1次送信待ち`, `1次送信済`, `空室`, `満室`, `キャンセル待ち`, `最終送信待ち`, `エラー`)
* N列: `WhatsAppText` (自動生成されるオーナー向け英語テキスト)
* O列: `MessageId` (リクエスト追跡ID)
* P列: `Phone` (WhatsApp / 電話。任意。先頭に `'` を付けて文字列として記帳するので、`0812…` や `+62…` がそのまま表示される)
* Q列: `Nationality` (国籍のキー: `JP` `ID` `US` `SG` `other`。任意・未回答は空)
* R列: `StayPurposes` (滞在目的。フォームの言語のラベルを `, ` で連結。任意・未選択は空)
* S列: `AnonymizedAt` (保存期間を過ぎて個人データを消した日時。空なら未処理。`anonymizeExpiredInquiries` が書く)

P〜S 列（2026-09-24 追加）の**見出しは自動では入らない**ので、1 行目に手で `Phone` `Nationality` `StayPurposes` `AnonymizedAt` と入力する（見出しが無くても記帳はされるが、見た目で分からない）。電話・国籍・滞在目的は任意項目で、担当者への一次返信通知メールにも載る（WhatsApp 文面＝N列には入れない）。フォームを通らない直接の POST で不正な値が来たときは空欄で記帳し、L列に `…形式不正` の旗を立てる（旗付きは自動送信せず下書き）。

### 2. Settings シート（シート名: `Settings`）
* A列: `Key` / B列: `Value`
* `NG_KEYWORDS`: `cancel, refund, terms, 規約, discount`
* `NOTIFICATION_EMAIL`: `(担当者のメールアドレス)`
* `DAILY_AUTO_REPLY_CAP`: `20`（任意。1日の自動返信の上限。未設定・数でなければ 20、`0` で自動送信を止めてすべて下書き）
* `RETENTION_DAYS`: `730`（任意。個人データの保存日数。空・未設定なら 730。**365 未満や数でない値は入力ミスとみなし、何も消さずにエラーで止まる**）

### 3. Templates シート（シート名: `Templates`）
* A列: `TemplateID` (例: `1MonthLater_ja`, `1MonthLater_en`, `1MonthWithin_ja`, `Available_ja`, `Full_ja`, `AcceptWaiting_ja`)
  * 種類は `1MonthLater` `1MonthWithin` `Available` `Full` `AcceptWaiting` の 5 つ、言語は `ja` `en` `id`。`_id`（インドネシア語）の行が無い間は `_en` で代用される。**`_en` は 5 種類とも必ず置く**（代用先が無いと一次返信は `エラー` になる）
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

## 個人データの保存期間（2026-09-24 追加）

オーナー決定: 個人データは約 2 年保存し、その後は消す。`anonymizeExpiredInquiries`（`src/Retention.ts`）を月 1 回の定期トリガーで実行する。

* **対象**: `Inquiries` の行のうち、受信日時（B列）とチェックアウト日（G列）の**遅い方**から `RETENTION_DAYS`（既定 730）日を過ぎた行（スクリプトのタイムゾーンの暦日で 731 日目以降）。先のチェックアウトがある予約は、それが過ぎるまで残る。月 1 回の実行なので、実際に消えるのは最大で約 1 か月遅れる
* **消す列**: C 氏名・D メール・J 備考・N WhatsApp 文面・P 電話・Q 国籍・R 滞在目的（ゲストが入力した値と、それを含む文面）。S列 `AnonymizedAt` に実行日時を入れる
* **残す列**: ID・受信日時・言語・チェックイン/アウト・部屋・人数・期間区分・旗・ステータス・MessageId（帳簿として）
* **行は削除しない**: ID は `getLastRow` で採番するので、行を消すと ID が再利用される
* **触らない行**: `AnonymizedAt` が入っている行（匿名化済み）・一次返信前（`1次送信待ち` `エラー` 等）の行・ID が空の行・日付が読めない行。書く直前に A列の ID を読み直し、読み取り後に並べ替え等で行がずれていたら次回に回す
* **通知**: 匿名化した行があったときだけ、`NOTIFICATION_EMAIL` へ件数と ID を 1 通（個人データは書かない）。一次返信前のため触らなかった期限切れの行があれば、同じメールに ID を載せる
* **対象外**: Gmail に残っている送受信メール・下書き・担当者通知メール（シートの外のため）
* 手動で試すときも、エディタの右上が `puriliangresidence.bali@gmail.com` であることを確認してから実行する

---

## 検証（リポジトリ側）

```bash
npm run gas:check   # 型チェック + スタブ付き合成テスト（test/*.test.js）。期待 exit 0
```

| テスト | 見ているもの |
|---|---|
| `test/sendAutoReplies.test.js` | リトライ・行単位の隔離 |
| `test/doPost.test.js` | Webhook の共有秘密 |
| `test/abuse.test.js` | WO-PB-3F（受信時刻・メール形式・自動返信の上限） |
| `test/optionalFields.test.js` | 電話・国籍・滞在目的の記帳と再検証（電話の規則が `lib/phone.ts` と同じこと） |
| `test/templates.test.js` | テンプレートの `_en` 代用と、無いときに止まらずエラーにすること |
| `test/retention.test.js` | 保存期間の匿名化（境界 730/731 日・触らない行・まとめ書き・ID の照合） |

GAS 本体への反映は `clasp push` では行えない（`src/*.ts` が `import`/`export` を含む）。`import` 行と `export` を外して `tsc --target ES2019 --module none` で変換し、Apps Script エディタに貼って「デプロイを管理 → 鉛筆 → 新バージョン」（詳細はリポジトリ直下の `PROJECT_CONTEXT.md`「検証手段」）。ファイルを足したとき（2026-09-24 の `Retention.ts` 等）はエディタにもファイルを足す。
