#!/usr/bin/env bash
# GAS の src/*.ts を、Apps Script エディタにそのまま貼れる JS（dist/<名前>.js）に変換する（WO-PB-3F 段階 A）。
# Apps Script は全ファイルを 1 つのグローバル空間で読むので、import 行を消し、行頭の export を外してから
# 全ファイルを 1 回の tsc（--module none）に渡す（トップレベルの名前の衝突もここで型エラーになる）。
# 使い方: bash gas-booking-automation/build-gs.sh [出力先]（既定 gas-booking-automation/dist）。期待 exit 0
# 貼り方は README「反映手順」。型だけのファイル（Types）は出力しない。
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:-dist}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/src" "$TMP/out"

for f in src/*.ts; do
  sed -E -e '/^import .* from .*;$/d' -e 's/^export //' "$f" > "$TMP/src/$(basename "$f")"
done
if grep -n '^import \|^export ' "$TMP"/src/*.ts; then
  echo "build-gs: import/export が残った（1 行に収まらない import 等）。変換規則を見直すこと" >&2
  exit 1
fi

../node_modules/.bin/tsc --target ES2019 --module none --lib es2019 --strict \
  --types google-apps-script --typeRoots ../node_modules/@types \
  --outDir "$TMP/out" "$TMP"/src/*.ts

rm -rf "$OUT"
mkdir -p "$OUT"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
for f in "$TMP"/out/*.js; do
  name="$(basename "$f" .js)"
  # 型だけのファイルは中身が "use strict" だけになる。貼る必要が無いので出さない
  if [ -z "$(grep -v '^"use strict";$' "$f" | tr -d '[:space:]')" ]; then continue; fi
  {
    echo "// Apps Script ファイル「${name}」に貼る。生成元 gas-booking-automation/src/${name}.ts（${SHA}）。ここを直接直さない"
    cat "$f"
  } > "$OUT/${name}.js"
done
ls "$OUT"
