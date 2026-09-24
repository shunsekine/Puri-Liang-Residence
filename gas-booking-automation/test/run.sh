#!/usr/bin/env bash
# GAS ソースの検証: 型チェック → CommonJS へ一時ビルド → スタブ付き合成テスト → 貼り付けと同じ形（build-gs.sh の出力・
# 全ファイル 1 つのグローバル空間・ファイル順は正逆）でも同じテスト
# 使い方: npm run gas:check（プロジェクトルートから）。期待 exit code: 0
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
../node_modules/.bin/tsc -p tsconfig.json
../node_modules/.bin/tsc -p tsconfig.json --noEmit false --module commonjs --moduleResolution node10 --rootDir src --outDir "$OUT"
GAS_BUILD_DIR="$OUT" node test/sendAutoReplies.test.js
GAS_BUILD_DIR="$OUT" node test/doPost.test.js
GAS_BUILD_DIR="$OUT" node test/abuse.test.js
GAS_BUILD_DIR="$OUT" node test/optionalFields.test.js
GAS_BUILD_DIR="$OUT" node test/templates.test.js
GAS_BUILD_DIR="$OUT" node test/retention.test.js
GAS_BUILD_DIR="$OUT" node test/hardening.test.js

# 貼り付けと同じ形でも通すこと（build-gs.sh の出力を 1 つのグローバル空間に読み込み、ファイル順を正逆で 2 回）
GLOBAL="$(mktemp -d)"
trap 'rm -rf "$OUT" "$GLOBAL"' EXIT
bash build-gs.sh "$GLOBAL/dist" > /dev/null
mkdir -p "$GLOBAL/shim"
for m in Main EmailService Retry WebhookParser SpreadsheetService Retention Config Types Templates; do
  echo "module.exports = require('$PWD/test/global-loader.js');" > "$GLOBAL/shim/$m.js"
done
for order in forward reverse; do
  for t in sendAutoReplies doPost abuse optionalFields templates retention hardening; do
    GAS_ORDER="$order" GAS_DIST_DIR="$GLOBAL/dist" GAS_BUILD_DIR="$GLOBAL/shim" node "test/$t.test.js" > "$GLOBAL/out.txt" 2>&1 \
      || { cat "$GLOBAL/out.txt"; echo "global scope ($order): $t FAILED"; exit 1; }
  done
done
echo "global scope (paste form, both file orders): ALL PASSED"
