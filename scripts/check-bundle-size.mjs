// ビルド後に実行し、クライアントへ配信されるJS/CSSのgzip合計を計測する。
// 依存追加などで静かに肥大化するのを検知するのが目的で、
// SOFT超過はCIに警告注釈だけ、HARD超過はCIを失敗させる。
// 閾値の根拠：導入時点の実測に対して SOFT=約+20%、HARD=約+40%。
// 正当な機能追加で超えた場合は、このファイルの閾値を理由付きで更新する。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const STATIC_DIR = join(process.cwd(), ".next", "static");
const SOFT_LIMIT_KB = 380;
const HARD_LIMIT_KB = 450;

const collectAssets = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      files.push(...collectAssets(path));
    } else if (/\.(js|css)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
};

let assets;
try {
  assets = collectAssets(STATIC_DIR);
} catch {
  console.error("::error::.next/static がありません。先に npm run build を実行してください。");
  process.exit(1);
}

const sized = assets
  .map((path) => ({
    path: relative(STATIC_DIR, path).replaceAll("\\", "/"),
    gzipBytes: gzipSync(readFileSync(path)).length,
  }))
  .sort((a, b) => b.gzipBytes - a.gzipBytes);

const totalKb = sized.reduce((sum, file) => sum + file.gzipBytes, 0) / 1024;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

console.log(`クライアント配信アセット（JS/CSS ${sized.length}ファイル）gzip合計: ${totalKb.toFixed(1)} KB`);
console.log(`閾値: 警告 ${SOFT_LIMIT_KB} KB / 失敗 ${HARD_LIMIT_KB} KB`);
console.log("上位10ファイル:");
for (const file of sized.slice(0, 10)) {
  console.log(`  ${kb(file.gzipBytes).padStart(9)}  ${file.path}`);
}

if (totalKb > HARD_LIMIT_KB) {
  console.error(`::error::バンドルサイズ ${totalKb.toFixed(1)} KB が上限 ${HARD_LIMIT_KB} KB を超えました。原因の依存・チャンクを確認してください。`);
  process.exit(1);
}
if (totalKb > SOFT_LIMIT_KB) {
  console.warn(`::warning::バンドルサイズ ${totalKb.toFixed(1)} KB が警告値 ${SOFT_LIMIT_KB} KB を超えました。肥大化の原因を確認してください。`);
}
