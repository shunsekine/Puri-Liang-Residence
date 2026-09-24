# WO-PB-3F: 予約フォームの悪用対策（攻撃者役レビュー F1・F2 ほか）

最終更新: 2026-09-24（F3・F5・F6・秘密の空白除去） / 作成: Claude (Opus 5.5) / 起点: `docs/2026-09-23-WO-PB-3-attacker-review.md` の F1・F2（高）

> **目的**: 誰でも叩ける `/api/reserve` を使って、(F1) オーナーの Gmail から任意のアドレスへ自動返信を送らせる、(F2) 受信時刻を偽って 15 分の待ちを飛ばす、を止める。
> **推奨モデル**: Opus 5（GAS の送信判定と本番反映の順序を含むため）。
> 本番に触る操作（GAS の貼り付け・デプロイ、main へのマージ）はユーザーが行う。エージェントはブランチ push まで。

## 0. 前提（2026-09-24 に確認した事実）

- `app/api/reserve/route.ts` は本文をそのまま GAS へ転送している（`{...body, webhook_secret}`）。サーバー側の検証は無い。メール形式の検証はブラウザ側（`components/pages/ReserveForm.tsx` の `validate()`）だけ。
- GAS が使う項目は `WebhookParser.parsePayload` の 9 つだけ: `name` `email` `language` `checkin` `checkout` `room`/`room_id` `guests` `notes` `submitted_at`。フォームが送る他の項目（`phone` `nationality` 金額など）はシートに記録されていない（下記「範囲外の気づき」）。
- 受信時刻は `payload.submitted_at` をそのまま採用している（`WebhookParser.ts` の `timestamp:`）。これが F2 の入口。
- 自動送信は `EmailService.sendAutoReplies` → `sendInitialReply` の `GmailApp.sendEmail(inquiry.email, …)`。件数の上限は無い。
- **Vercel のサーバー関数はインスタンス間でメモリを共有しない**。route の中に「IP ごとの回数」を持っても効かない [推測・一般的な性質]。件数を数える状態は Sheets（GAS 側）に置く。
- GAS は `clasp push` では反映できない（`src/*.ts` が import/export を含む）。反映は「変換→貼り付け→新バージョン」（`gas-booking-automation/README.md`「反映手順」）。

## 1. 設計判断（守りを置く場所）

**害（メールが出ること）が起きる場所＝GAS の送信判定に上限を置く**。route の検証は入口を狭めるが、単独では破られうる（正しい形式の宛先を大量に送れば通る）。

| 層 | 置くもの | 理由 |
|---|---|---|
| route（入口） | 項目の allowlist・形式検証・サイズ上限・`submitted_at` を転送しない・エラー文を固定 | 不正な形を GAS へ届けない。F2・F5・F6 の入口 |
| GAS `doPost`（記帳） | 受信時刻＝サーバー時刻。`email` 形式・長さの再検証。数式の無害化（F3） | GAS の URL を知る者は秘密で止まるが、判定は 1 か所に置く（MODEL_LAYER の考え方） |
| GAS `sendAutoReplies`（送信） | **1 日の自動送信上限**・**同じアドレスは 24 時間に 1 通**。超えたら送らず下書き＋担当者へ通知 | F1 の害を上限で止める。攻撃が成功しても最悪「下書きとシートの行が増える」まで |

## 2. やること

### 段階 A: GAS の変換をスクリプトにする（前提作業）

- `gas-booking-automation/build-gs.sh`: import 行と `export` を外し、`tsc --target ES2019 --module none` で `gas-booking-automation/dist/*.js` を作る（2026-09-24 に手で行った手順）。`dist/` は `.gitignore`。（2026-09-24 済み。`test/run.sh` の 1 スコープ検査も済み）
- `test/run.sh` に「dist を 1 つのグローバル空間に読み込んで、既存テストを通す」を追加する（2026-09-24 に手で確認した方法）。今の CommonJS ビルドでのテストは残す。
- README の「`clasp push`」の手順を、実態（変換→貼り付け→「デプロイを管理 → 鉛筆 → 新バージョン」→フォームから 1 件）に直す。（2026-09-24 済み: GAS README「反映手順」）
- 共有秘密の照合前に、前後の空白を取り除く（route と `WebhookParser.isAuthorized` の両方）。テストを 1 ケース足す。（2026-09-24 済み。空白だけの値は除いた後の長さで未設定と同じ＝fail-closed）

### 段階 B: route（F2・F5・F6）

- 本文のサイズ上限（例 16 KB。超えたら 413）。
- **allowlist で組み立て直して転送する**。`submitted_at` は送らない。
- 検証（失敗は 400。`message` は返さない。フォームは `message` が無いと各言語の文言を出すため）:
  - `email`: 形式・254 文字以内 / `name`: 1〜100 文字・改行や制御文字なし / `notes`: 2,000 文字以内
  - `room_id` ∈ `villa|king|twin` / `guests`: 整数 1〜10 / `language` ∈ `ja|en|id`
  - `checkin`・`checkout`: `YYYY-MM-DD`。`checkout > checkin`。`checkin` は今日（UTC）の前日以降（バリとの時差の分だけ余裕を持たせる）
- catch 節は固定文言にする（F6。`error.message` を返さない）。
- （2026-09-24 済み: サイズ上限 16 KB・壊れた JSON は 400・エラーの応答は `{ success: false }` だけ。GAS の応答も透過せず、成功時の問い合わせ ID も返さない。GAS への通信失敗と GAS の失敗応答は 502。GAS の `doPost` の例外は `error: 'internal'`）
- テスト（`tests/reserve-route.test.mjs` に追加）: 上記の各違反が 400 で GAS を呼ばないこと／余分な項目と `submitted_at` が転送されないこと／正常系は従来どおり転送されること。

### 段階 C: GAS（F1・F2・F3）

- `parsePayload`: `timestamp = new Date()`（`submitted_at` を無視）。
- `doPost`: `email` の形式が不正なら記帳はするが `IRREGULAR_FLAG` を立てる（→自動送信せず下書き）。`name` に URL らしき文字列（`http` `www.` `://`）があれば同じく旗を立てる（`{Name}` 経由の文面の差し込み対策）。
- `sendAutoReplies`: 自動送信の直前に次を判定し、当たれば送らずに下書き＋`IRREGULAR_FLAG` 追記＋担当者への通知（既存の失敗通知と同じく 1 実行 1 通）:
  - 同じアドレスへ 24 時間以内に `1次送信済` がある
  - 今日（スクリプトのタイムゾーン）の自動送信が `Settings.DAILY_AUTO_REPLY_CAP`（**既定 20**・未設定なら 20）に達している
- `appendInquiry`: 文字列の値が `= + - @` やタブで始まるなら `'` を前置する（F3。N 列の WhatsApp テキストも）。（2026-09-24 済み。CR も対象。テストは `test/hardening.test.js`）
- テスト（`test/` に追加）: 過去の `submitted_at` を送っても受信時刻が現在になる／同じアドレス 2 件目は下書き／上限の次の 1 件は下書き／`=HYPERLINK(...)` の名前が `'` 付きで記帳される。

### 共通

- **検出力を先に確かめる**（AGENTS.md §7-2）: 追加するテストを変更前のコードに対して実行し、落ちることを確認してから実装する。結果をテストの冒頭に書く。
- `docs/2026-09-23-WO-PB-3-attacker-review.md` の状態欄を更新する（F1・F2・F3・F5・F6）。

## 3. 本番反映の順序（ユーザー作業）

どちらを先に反映しても送信は止まらない（route が `submitted_at` を送らなくても GAS は現在時刻を使う。GAS が先でも route は従来どおり届く）。

1. Apps Script の `Settings` シートに `DAILY_AUTO_REPLY_CAP` を追加する（任意。無ければ 20）。
2. ブランチを main へマージ → Vercel の Production が Ready になるのを待つ。**マージ後、エージェントが `origin/main` に入ったことを確認する**。
3. `build-gs.sh` の出力を Apps Script に貼る → 「デプロイを管理 → 鉛筆 → 新バージョン」。
4. 本番フォームから 1 件送って `success:true` と記帳を確認し、テスト行を消す。

## 4. 完了条件

- `npm run check:public`・`npm run gas:check`・`npx tsc --noEmit`・`npm run build` が 0。lint は既存の 4 件から増えない。
- 追加テストが変更前のコードで落ちることを確認済み（テスト冒頭に記録）。
- レビュー文書の状態欄と `PROJECT_CONTEXT.md` の「次にやること」を更新。
- 報告は AGENTS.md §7-1 の形（exit code・コミット SHA・push 先）。

## 5. ユーザーに決めてほしいこと（着手前）

- **1 日の自動送信上限の既定値**（案: 20。通常の問い合わせ件数より十分多く、Gmail の送信上限より十分少ない値）。
- **Cloudflare Turnstile（人間確認）を入れるか**: 入れればロボットの大量送信を入口で止められるが、外部サービスの登録とフォームの見た目の変更が要る。本 WO では**入れない**（上限で害は止まるため）。件数が増えたら別 WO。

## 範囲外の気づき（本 WO では直さない）

- ~~フォームが送る `phone`・`nationality`・料金は GAS で記録されていない~~ → 2026-09-24 オーナー決定で電話・国籍・滞在目的は任意入力にして P〜R 列に記帳（料金は記録しない）。
- route は GAS の応答が JSON として読めないとき成功扱いにしている（`gasRes.json().catch(() => ({ success: true }))`）。GAS がスクリプトの読み込み自体で失敗して HTML のエラーページを返すと、フォームには成功と出るが記帳されない [推測・本番で起きた記録は無い]。成功時に GAS が JSON 以外を返す場合があるかを確かめてから、失敗扱いに変えるか決める。
- F4（通知文への改行差し込み）は、段階 B の `name` の改行禁止で入口は狭まる。`notes` の改行はそのまま（正当な用途があるため）。F7（ID 採番の競合）は件数が少ないうちは実害が小さいので見送る。
