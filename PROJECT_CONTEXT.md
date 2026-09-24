# PROJECT_CONTEXT — Puri Liang Residence Website

コンテキスト予算: soft=9000 hard=12000 history=2000

> VM 共用（Gemini / Antigravity / Claude）。作業前に本ファイルを読み、③ の in_flight を確認すること。
> 固定値（価格・版・件数）はここに書かない。正本を指す（AGENTS.md §6）。

---

## ① 安定情報（更新＝ユーザーの明確な指示時のみ）

最終更新: 2026-09-24 / Claude (claude-opus-5-5) / 基準 SHA `c81039b`（main）

### 概要とオーナーとのスタンス

- **目的**: バリ島デンパサール南部シダカルヤの長期滞在・リモートワーク向けレジデンス「Puri Liang Residence」の公式サイト（ja/en/id）。本番 `https://puri-liang-residence.vercel.app`（2026-06-06 公開）。
- **ターゲットと提供価値**: 主な客はインドネシア国外。当方が外国人客との予約調整を担い、オーナー（母親）の言語的・実務的負担を減らす。
- **ブラックボックス化**: システムは当方の善意による専有資産。悪用・無断複製を防ぐため、オーナー側（息子含む）には裏側の仕組み（GAS 連携等）を明かさない。
- **無償支援と保守費用**: 制作・基本保守は無償。本サイト経由の予約に限り、直接契約時の基本価格との差額を保守費用として受け取る。
- **撤退の権利**: 共同ビジネスではないため、当方の判断でいつでもサイトを閉鎖できる。外部への権限要求や連絡には個人ではなく `puriliangresidence.bali@gmail.com` を使う。

### 事業ルール（オーナー確認 2026-09-24）

サイトの文言（`messages/*.json` の FAQ・Terms・Reserve・Privacy）、`lib/data.ts`、GAS の Templates シート（リポジトリ外）の 3 か所がこれに従う。**どれかを変えるときは 3 か所を揃える**（2026-09 に 3 か所の食い違い＝キャンセル 3 通り・電気代 2 通りが見つかった）。

- **部屋**: 3 タイプ。Villa は 1F に 2 室・2F に 2 室の計 4 室（借りるのはその 1 室）。King・Twin の階と仕様は `lib/data.ts`／`RoomData`。
- **料金**: IDR が基準。JPY/USD は `lib/data.ts` に手で入れた概算（為替連動ではない）。
- **支払い**: 家賃の全額前払い（銀行振込・Wise 可）で予約確定。チェックイン時はデポジット Rp 2,000,000 のみ。
- **キャンセル**: チェックイン 7 日前まで全額返金（返金時の振込手数料の実費を除く）。以降は返金不可。
- **電気**: プリペイド（トークン）式。滞在中にゲストがスタッフへ代金を渡し、チャージを代行してもらう。前払いには含めない。目安は 1 名あたり月 Rp 300,000。
- **コンロ**: Villa・King Studio で 1 ヶ月以上の滞在なら無料貸出。それ以外は有料。
- **対応言語**: 英語・インドネシア語（サイト表示は ja/en/id）。
- **個人情報**: 電話・国籍・滞在目的は任意入力で、シートに記録する。保存は 2 年（問い合わせ日・チェックアウト日の遅い方から）、その後シートは自動で匿名化・Gmail は手で削除。Google Analytics と Microsoft Clarity は残す。ポリシーは `/privacy`（内容を変えたら route の転送項目・GAS の保存と揃える）。
- **口コミ**: `ReviewPlaceholders` は仮置きのまま（オーナー判断）。

### 技術と構成

- Next.js 16（App Router）/ React 19 / next-intl 4 / Tailwind 4 / TypeScript。正確な版は `package.json`。
- 予約: フォーム → `app/api/reserve/route.ts`（許可した項目だけを検証して転送。GAS の URL を隠す）→ GAS Webhook（`doPost`・共有秘密）→ Google Sheets。GAS のソースと運用は `gas-booking-automation/README.md`。
- 設計の要点: 予約は月 1 回程度のため、メール監視（Pull）ではなく Webhook（Push）。一次返信は 15 分後に自動送信。最終回答（空室・満室等）は担当者がシートの状態を変えると下書きを作るだけ（最終確認は人が行う半自動）。
- 表示通貨は locale で切替（ja→JPY / en→USD / id→IDR）。ヘルパーは `lib/data.ts`。
- ディレクトリ: `app/[locale]/*`（ページ）・`components/`・`lib/data.ts`・`messages/`・`gas-booking-automation/{src,test}`・`tests/`・`scripts/`・`docs/`（WO とレビュー）。

### 検証手段

| 対象 | コマンド（プロジェクトルート） | 期待 exit code |
|---|---|---|
| 型チェック | `npx tsc --noEmit` | 0 |
| ビルド（postbuild で成果物の秘密検査） | `npm run build` | 0 |
| Lint | `npm run lint` | 現状 **1**（既存のエラー 2 件。増やさない） |
| GAS | `npm run gas:check`（型チェック＋スタブ付き合成テスト） | 0 |
| 公開物の最低ライン（§11 ③⑤）と翻訳の契約 | `npm run check:public`（検出力の自己テスト・秘密・env allowlist・ログの PII・route の契約テスト・翻訳のキー一致／ICU 構文／空リンク `href="#"`／プライバシーポリシーへの導線） | 0 |
| モデル層監査 | `python3 /home/ubuntu/agent-global-rules/audit_model_layer.py . --gate` | 0 |

- GAS の**実機**への反映を検証する手段は無い。反映手順と反映後の確認は `gas-booking-automation/README.md`。

### 不変条件と担保場所

無い（データは Google Sheets が保持。書込は GAS `SpreadsheetService.ts` の 1 モジュール＋人手の状態変更。route は値を持たない proxy）
- §11 ①②: **該当なし**（ログイン・会員データ・ブラウザから読める DB が無い。Sheets への外部書込口 `doPost` は共有秘密で fail-closed。担保＝`gas:check` の `doPost.test.js`）。ログインや読み出し API を足した時点で実テストが要る

### コーディング規約

- 捏造しない（AGENTS.md §8）。URL・アドレス・仕様は裏付けを取るか質問する。
- **連絡先非掲載**: Email/WhatsApp 等の直接連絡先はサイトに載せない。
- 多言語: `app/[locale]/...`、`proxy.ts`（Next 16。旧 middleware）の matcher `/(ja|en|id)/:path*`。対応外の先頭セグメントは layout で 404（`tests/messages.test.mjs` ⑥）。

### 既知の問題・触ってはいけない箇所

- **フォーム**: `GAS_WEBHOOK_URL` 未設定ならモック成功を返す（Preview 用）。URL があって `GAS_WEBHOOK_SECRET` が無ければ 503。
- **§11 ④ 攻撃者役レビュー**: 状態は `docs/2026-09-23-WO-PB-3-attacker-review.md` の表が正本。
- **§11 ⑤ ログ**: route と GAS は本文・個人情報をログに書かない（検査 C）。
- **GAS のトリガーとデプロイは `puriliangresidence.bali@gmail.com` で行う**: スクリプトとシートの所有者は個人アカウントだが、顧客への送信はトリガーを作ったアカウントから出る。個人アカウントで認可・手動実行すると個人の Gmail から顧客へ送られうる。
- **GAS のコードはリポジトリが正本**: エディタで直接直したら `gas-booking-automation/src` にも反映する。Templates シートの文面はリポジトリ外（上の事業ルールと揃える）。
- **GAS 失敗通知**は件名でなく本文の表で判定する（`gas-booking-automation/README.md`「失敗通知メールの読み方」）。
- **本番の GAS プロジェクト**は `1dEFqku0rLFM34SWz-8Sn7cjCX_aYCQf6gbKTmI79YTrL1349CXIi1lFn`（予約管理表_v1.0 に紐づく「無題のプロジェクト」）。同じシートに紐づく 2026-07-25 作成の同名プロジェクトは未使用（トリガー・実行なし）。触らない。
- **`Inquiries` の空行は意図したもの**: テスト行は行を消さず中身だけ消す（ID が `getLastRow` 採番のため、行を消すと ID が再利用される。最終行を消すときは A 列の ID だけ残す）。2026-09-24 に `INQ-001`〜`004`（7/25 のテスト）と、本番確認用の `INQ-006`（一次返信）・`INQ-007`（`onStatusEdit` の最終回答の下書き）をこの方法で片付けた。
- **VM 共用**: 他エージェントのプロセス・作業を予告なく止めない・上書きしない。

### デプロイ / 環境

- Vercel（shun-projects-workspace / owner puriliangresidence.bali@gmail.com / Hobby / リポ **Public**）。main へのマージ＝本番反映（マージはユーザーが行う）。プレビューはブランチごと（Deployment Protection 有効）。
- 環境変数: `GAS_WEBHOOK_URL` / `GAS_WEBHOOK_SECRET`（GAS のスクリプト プロパティ `WEBHOOK_SECRET` と同値・32 文字以上）/ `NEXT_PUBLIC_BASE_URL` / `NEXT_PUBLIC_GA_ID` / `NEXT_PUBLIC_CLARITY_ID`。ブラウザへ配る変数は `scripts/check-public-baseline.mjs` の allowlist で宣言。

## ② 揮発状態

ここには書かない。ブランチ・最終コミット・デプロイ状況は `git status` / `git log` / Vercel から都度取得する。

## ③ 引継ぎ・作業状態（随時更新）

最終更新: 2026-09-24 / Claude (claude-opus-5-5) / 基準 SHA `c81039b`

### in_flight

- （なし）

### 次にやること（優先順）

1. **WO-PB-3F の残り（F3・F5・F6・秘密の空白除去）の本番反映**: コードは済み。main へのマージ・GAS の貼り付け・「デプロイを管理 → 鉛筆 → 新バージョン」（`docs/2026-09-24-WO-PB-3F-reserve-abuse.md` §3）。
2. **Templates の文面をリポジトリで管理するか検討**（今はシートにしかなく、2026-09 に事業ルールとずれていた）。
3. Google Search Console で再インデックス申請（`/privacy` 追加を含む）。

### 経緯の所在

- 変更履歴は `git log`。設計判断の経緯は各 WO・レビュー（`docs/`）と GAS README「障害時の挙動」。
