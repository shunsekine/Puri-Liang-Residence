# WO-PB-3 攻撃者役レビュー（AGENTS.md §11 ④）

最終更新日時: 2026-09-24（F1・F2 の状態） / 更新エージェント: Claude (Opus 5.5)

- **誰が**: Claude Fable 5.1（別セッション・読み取り専用）。実装は Opus 5.5。**いつ**: 2026-09-23。
- **対象**: 作業ツリー（共有秘密の追加後・コミット前）。本番への通信はしていない。
- **一次情報の照合**: F1〜F3 の根拠行は Opus 5.5 が読み直して一致を確認した（下記「ファイル:行」は 2026-09-23 時点）。F4〜F8 は未照合。
- **前提の注意**: 今回の共有秘密は「GAS の URL を知る者が直接記帳する」経路だけを塞ぐ。公開 API `/api/reserve` は誰でも叩けるので、F1・F2 は秘密の有無に関係なく残る。

| ID | 深刻度 | 内容 | 経路（ファイル:行） | 直し方（レビュー案） | 状態 |
|---|---|---|---|---|---|
| F1 | 高 | スパム踏み台: 任意のメールアドレスで `/api/reserve` に POST すると、15 分後にオーナーの Gmail から一次返信が自動送信される。`{Name}` に攻撃者の文言を差し込める。Gmail の日次上限を使い切られると正規の返信も止まる | メール検証はクライアントのみ `components/pages/ReserveForm.tsx:111` → `app/api/reserve/route.ts` は無検証で転送 → `gas-booking-automation/src/WebhookParser.ts:40` → `EmailService.ts:108` `GmailApp.sendEmail` | route でスキーマ検証（email 形式・長さ上限・`room_id` の列挙・日付）、IP 単位のレート制限、Turnstile のサーバー検証。GAS 側でも同一アドレス・短時間の件数上限 | **コード対応済み・本番未反映**（WO-PB-3F・ブランチ `wo-pb-3f-reserve-abuse`）: route で形式検証（違反は 400・転送しない）、GAS で自動送信の上限（同じアドレスは 24 時間に 1 通・1 日 `DAILY_AUTO_REPLY_CAP`＝既定 20）、超えた分は下書き＋担当者へ 1 実行 1 通。メール形式不正・氏名の URL は旗→下書き。IP 単位のレート制限・Turnstile は入れない（害は上限で止める。WO §5） |
| F2 | 高 | 記帳の偽造: 任意フィールドが透過し、`submitted_at` を過去にすると 15 分の遅延を飛ばして即時送信できる | `route.ts`（`{...body}`）→ `WebhookParser.ts:38` → `EmailService.ts:26` | 許可したフィールドだけ組み立て直して転送。受信時刻はサーバー時刻 | **コード対応済み・本番未反映**（WO-PB-3F）: route は GAS が読む 9 項目だけを組み立て直す（`submitted_at` を送らない・`room` は `room_id` と言語から作る）。GAS の受信時刻は `new Date()` |
| F3 | 中 | Sheets の数式インジェクション（`=HYPERLINK(...)`・`=IMPORTXML(...)`） | `SpreadsheetService.ts:100` `appendRow` に `name`・`remarks`・`roomType` を生で渡す | 先頭が `= + - @ \t` の値に `'` を前置（WhatsApp テキスト列も） | 未対応 |
| F4 | 中 | 担当者通知・WhatsApp テキストへの偽装行（改行込みの `name`・`remarks`） | `EmailService.ts:125-136`、`SpreadsheetService.ts:150` | 改行除去・長さ上限・値を引用符で囲む | 未対応 |
| F5 | 中 | レート制限・サイズ上限なし（GAS の実行枠と Sheets の行を消費される） | `route.ts` | F1 の対策で兼ねる | 未対応 |
| F6 | 低 | エラーメッセージの漏れ（`error.message` をそのまま返す） | `route.ts`・`Main.ts` の catch | 固定文言を返し、詳細はログのみ | 未対応 |
| F7 | 低 | ID 採番の競合（`getLastRow` ベース・ロック無し） | `SpreadsheetService.ts:70-71` | `LockService.getScriptLock()` か UUID | 未対応 |
| F8 | 低 | 秘密が本文に平文で載る（HTTPS 内。ログに本文を残す設定なら露出） [推測] | `route.ts`・`Main.ts` | 本文をログに出さない（検査 C で担保済み）。Preview 環境には `GAS_WEBHOOK_URL` を置かない（mock） | 受け入れ（検査 C で担保） |

**問題なしと判断された観点**: git 履歴に実 GAS URL・キー値・`.env*` 無し／秘密の上書き順（`tests/reserve-route.test.mjs`）／GAS の fail-closed・定数時間比較・秘密を行に残さない（`doPost.test.js`）／クライアントへの env 露出（検査 B・D）／他人のデータの読み出し経路無し（GET・`doGet` 無し）／`onEdit`・`sendReminders` は外部入力なし／ログの PII（検査 C）。

**次の一手**: F1・F2 の本番反映（`docs/2026-09-24-WO-PB-3F-reserve-abuse.md` §3）。同 WO の残り（F3 の `'` 前置・F5 のサイズ上限・F6 の固定文言・段階 A の GAS 変換スクリプト化と秘密の空白除去）は未着手。
