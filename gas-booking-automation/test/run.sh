#!/usr/bin/env bash
# GAS ソースの検証: 型チェック → CommonJS へ一時ビルド → スタブ付き合成テスト
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
