// 貼り付けと同じ形（build-gs.sh の出力を全ファイル 1 つのグローバル空間に読み込む）で既存テストを動かすためのローダー。
// test/run.sh が GAS_BUILD_DIR をこのディレクトリの shim に向けて使う。GAS_DIST_DIR に build-gs.sh の出力、
// GAS_ORDER=reverse でファイルの読み込み順を逆にする（Apps Script はファイル順に依存しないコードでないと壊れる）。
const vm = require('vm');
const fs = require('fs');
const path = require('path');

if (!globalThis.__gasBag) {
  const dir = process.env.GAS_DIST_DIR;
  let files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  if (process.env.GAS_ORDER === 'reverse') files = files.reverse();
  const names = new Set();
  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    // ファイルごとに別スクリプトとして同じ realm で実行（トップレベルの const/class は共有され、重複は SyntaxError）
    vm.runInThisContext(code, { filename: f });
    for (const m of code.matchAll(/^(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  }
  globalThis.__gasBag = vm.runInThisContext(`({ ${[...names].join(', ')} })`);
}
module.exports = globalThis.__gasBag;
