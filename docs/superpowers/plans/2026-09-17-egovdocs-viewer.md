# e-Gov通知文書ビューア（Web版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** e-GovのZIP/フォルダ/ファイルをブラウザにドロップすると、XML(XSLT)/DTA/CSVを変換してツリー＋プレビューで表示する、通信ゼロの静的Webアプリを作る。

**Architecture:** ビルドなしのESモジュール構成。純粋関数（エンコーディング、ZIP解析、DTA/CSV/XML変換、種別判定）を個別モジュールに分け `node --test` でテストし、ブラウザ依存部（XSLTProcessor、drag&drop、UI）は手動検証する。外部ライブラリゼロ（ZIPはDecompressionStreamで自前展開）。

**Tech Stack:** 素のHTML/CSS/JS（ESM）、DecompressionStream('deflate-raw')、XSLTProcessor、TextDecoder('shift_jis')、node --test（Node 21以上、deflateテストにCompressionStreamを使用）。

**Spec:** `docs/superpowers/specs/2026-09-17-egovdocs-viewer-design.md`

**検証用サンプル:** `~/git/github.com/thwoo-inc/egovdocs-conv2html/samples/`（本リポジトリにはコミットしない）

---

### Task 1: リポジトリ骨組み

**Files:**
- Create: `package.json`
- Create: `.nojekyll`
- Create: `.gitignore`
- Create: `index.html`
- Create: `css/app.css`
- Create: `js/app.js`（空に近いプレースホルダ）

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "egovdocs-viewer",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: .nojekyll（空ファイル）と .gitignore を作成**

`.gitignore`:

```text
.DS_Store
node_modules/
```

- [ ] **Step 3: index.html を作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src about: blob:; base-uri 'none'; form-action 'none'">
<title>e-Gov通知文書ビューア</title>
<link rel="stylesheet" href="css/app.css">
<script type="module" src="js/app.js"></script>
</head>
<body>
<header>
  <h1>e-Gov通知文書ビューア</h1>
  <p class="privacy-note">すべての処理はブラウザ内で完結します。ファイルが外部に送信されることはありません。</p>
  <button id="clear-btn" hidden>クリア</button>
</header>
<main id="dropzone" class="empty">
  <div id="drop-hint">
    <p class="drop-main">e-GovからダウンロードしたZIPファイルをここにドロップ</p>
    <p class="drop-sub">展開済みのフォルダや個別ファイル（XML/DTA/CSVなど）も受け付けます</p>
    <label class="file-select">ファイルを選択<input type="file" id="file-input" multiple hidden></label>
  </div>
  <div id="viewer" hidden>
    <nav id="file-tree"></nav>
    <section id="preview">
      <div id="preview-placeholder">左の一覧からファイルを選択してください</div>
      <iframe id="preview-frame" sandbox="" hidden title="変換結果プレビュー"></iframe>
    </section>
  </div>
</main>
</body>
</html>
```

CSPの意図: `connect-src` は `default-src 'none'` により全面禁止（fetch/XHR/WebSocket不可）。`style-src 'unsafe-inline'` はiframe srcdoc内の変換済みHTMLの `<style>` に必要。iframeは `sandbox=""`（スクリプト実行・同一オリジン扱いとも不可）。

- [ ] **Step 4: css/app.css を作成**

```css
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;
  display: flex; flex-direction: column;
  background: #f5f5f5; color: #333;
}
header {
  display: flex; align-items: baseline; gap: 16px;
  padding: 10px 20px; background: #2e7d32; color: white;
}
header h1 { font-size: 18px; margin: 0; }
.privacy-note { font-size: 12px; margin: 0; opacity: 0.9; flex: 1; }
#clear-btn {
  border: 1px solid rgba(255,255,255,0.7); background: transparent; color: white;
  border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 13px;
}
#clear-btn:hover { background: rgba(255,255,255,0.15); }
main { flex: 1; min-height: 0; }
main.empty { display: flex; align-items: center; justify-content: center; }
main.dragging { outline: 3px dashed #2e7d32; outline-offset: -12px; }
#drop-hint { text-align: center; color: #555; }
.drop-main { font-size: 20px; }
.drop-sub { font-size: 13px; color: #888; }
.file-select {
  display: inline-block; margin-top: 12px; padding: 8px 20px;
  background: #2e7d32; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;
}
#viewer { display: flex; height: 100%; }
#file-tree {
  width: 320px; min-width: 200px; overflow: auto; background: white;
  border-right: 1px solid #ddd; padding: 8px; font-size: 13px;
}
#file-tree details { margin-left: 8px; }
#file-tree summary { cursor: pointer; padding: 3px 4px; font-weight: bold; }
#file-tree button {
  display: block; width: 100%; text-align: left; border: none; background: none;
  padding: 4px 6px 4px 24px; cursor: pointer; font-size: 13px; border-radius: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#file-tree button:hover { background: #e8f5e9; }
#file-tree button.selected { background: #c8e6c9; }
#preview { flex: 1; min-width: 0; display: flex; }
#preview-frame { flex: 1; border: none; background: white; }
#preview-placeholder { margin: auto; color: #888; }
#preview-placeholder a { color: #2e7d32; }
```

- [ ] **Step 5: js/app.js プレースホルダを作成**

```javascript
// UI制御。Task 9で実装する。
console.log('egovdocs-viewer');
```

- [ ] **Step 6: 表示確認**

Run: `cd ~/git/github.com/thwoo-inc/egovdocs-viewer && python3 -m http.server 8765` を起動し、ブラウザで `http://localhost:8765` を開く。
Expected: ヘッダーとドロップゾーンの文言が表示され、コンソールにCSPエラーがない。確認後サーバーは止める。

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: 静的ページの骨組み（CSP・レイアウト）を追加"
```

---

### Task 2: encoding.js（文字コード判定・デコード）

**Files:**
- Create: `js/encoding.js`
- Test: `tests/encoding.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeAuto, decodeShiftJis } from '../js/encoding.js';

test('decodeShiftJis はCP932バイト列をデコードする', () => {
  // "テスト" のCP932表現
  const bytes = new Uint8Array([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]);
  assert.equal(decodeShiftJis(bytes), 'テスト');
});

test('decodeAuto は正しいUTF-8をUTF-8としてデコードする', () => {
  const bytes = new TextEncoder().encode('社会保険');
  assert.equal(decodeAuto(bytes), '社会保険');
});

test('decodeAuto はUTF-8として不正ならshift_jisにフォールバックする', () => {
  const bytes = new Uint8Array([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]); // テスト(CP932)
  assert.equal(decodeAuto(bytes), 'テスト');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... js/encoding.js`）

- [ ] **Step 3: js/encoding.js を実装**

```javascript
export function decodeShiftJis(bytes) {
  return new TextDecoder('shift_jis').decode(bytes);
}

export function decodeAuto(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decodeShiftJis(bytes);
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（3件）

- [ ] **Step 5: Commit**

```bash
git add js/encoding.js tests/encoding.test.js
git commit -m "feat: 文字コード判定・デコード（UTF-8厳密→shift_jisフォールバック）"
```

---

### Task 3: html-util.js（エスケープ・共通ドキュメント枠）

**Files:**
- Create: `js/html-util.js`
- Test: `tests/html-util.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, documentShell } from '../js/html-util.js';

test('escapeHtml は特殊文字をエスケープする', () => {
  assert.equal(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});

test('documentShell はタイトルと本文を含む完全なHTMLを返す', () => {
  const html = documentShell('テスト<title>', '<p>本文</p>');
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('<title>テスト&lt;title&gt;</title>'));
  assert.ok(html.includes('<p>本文</p>'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... js/html-util.js`）

- [ ] **Step 3: js/html-util.js を実装**

dta2html.pyのスタイルを踏襲した共通枠。本文（bodyHtml）は呼び出し側がエスケープ済みマークアップを渡す。

```javascript
export function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function documentShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; padding: 20px; background: #f5f5f5; max-width: 1400px; margin: 0 auto; }
h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; font-size: 22px; }
h2 { font-size: 18px; }
.info { background: #e3f2fd; padding: 12px 15px; border-radius: 5px; margin: 16px 0; }
.info p { margin: 4px 0; }
table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 16px; }
th { background: #4CAF50; color: white; padding: 10px 8px; text-align: left; font-size: 13px; position: sticky; top: 0; }
td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px; }
tbody tr:nth-child(even) { background: #fafafa; }
tbody tr:hover { background: #f0f0f0; }
pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; font-family: 'Courier New', monospace; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/html-util.js tests/html-util.test.js
git commit -m "feat: HTMLエスケープと共通ドキュメント枠"
```

---

### Task 4: zip.js（自前ZIPリーダー）

**Files:**
- Create: `js/zip.js`
- Test: `tests/zip.test.js`

- [ ] **Step 1: 失敗するテストを書く**

テスト内で無圧縮（stored）ZIPをバイト列から組み立てるヘルパーを使う。CRCは検証しないため0で埋めてよい。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzip } from '../js/zip.js';

const le16 = (n) => [n & 255, (n >> 8) & 255];
const le32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

// entries: [{ nameBytes, data, utf8Flag?, method? (0=stored, 8=deflate。dataは既に圧縮済みとして格納) , rawSize? }]
function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const method = e.method ?? 0;
    const rawSize = e.rawSize ?? e.data.length;
    const flags = e.utf8Flag ? 0x800 : 0;
    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, ...le16(20), ...le16(flags), ...le16(method),
      ...le16(0), ...le16(0), ...le32(0), ...le32(e.data.length), ...le32(rawSize),
      ...le16(e.nameBytes.length), ...le16(0), ...e.nameBytes,
    ]);
    central.push({ e, flags, method, rawSize, localOffset: offset });
    chunks.push(local, e.data);
    offset += local.length + e.data.length;
  }
  const centralStart = offset;
  for (const { e, flags, method, rawSize, localOffset } of central) {
    const cd = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, ...le16(20), ...le16(20), ...le16(flags), ...le16(method),
      ...le16(0), ...le16(0), ...le32(0), ...le32(e.data.length), ...le32(rawSize),
      ...le16(e.nameBytes.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0),
      ...le32(0), ...le32(localOffset), ...e.nameBytes,
    ]);
    chunks.push(cd);
    offset += cd.length;
  }
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, ...le16(0), ...le16(0), ...le16(entries.length), ...le16(entries.length),
    ...le32(offset - centralStart), ...le32(centralStart), ...le16(0),
  ]);
  chunks.push(eocd);
  const total = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let pos = 0;
  for (const c of chunks) { total.set(c, pos); pos += c.length; }
  return total;
}

test('無圧縮エントリを展開できる', async () => {
  const data = new TextEncoder().encode('hello');
  const zip = buildZip([{ nameBytes: new TextEncoder().encode('a.txt'), data, utf8Flag: true }]);
  const files = await unzip(zip);
  assert.deepEqual([...files.keys()], ['a.txt']);
  assert.equal(new TextDecoder().decode(files.get('a.txt')), 'hello');
});

test('UTF-8フラグなしのファイル名はCP932としてデコードする', async () => {
  // "テスト.xml" のCP932表現
  const nameBytes = new Uint8Array([0x83, 0x65, 0x83, 0x58, 0x83, 0x67, 0x2e, 0x78, 0x6d, 0x6c]);
  const zip = buildZip([{ nameBytes, data: new Uint8Array([0x41]) }]);
  const files = await unzip(zip);
  assert.deepEqual([...files.keys()], ['テスト.xml']);
});

test('deflate圧縮エントリを展開できる', async () => {
  const raw = new TextEncoder().encode('あいうえお'.repeat(100));
  const cs = new CompressionStream('deflate-raw');
  const compressed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(cs)).arrayBuffer());
  const zip = buildZip([{ nameBytes: new TextEncoder().encode('b.txt'), data: compressed, utf8Flag: true, method: 8, rawSize: raw.length }]);
  const files = await unzip(zip);
  assert.equal(new TextDecoder().decode(files.get('b.txt')), 'あいうえお'.repeat(100));
});

test('ディレクトリエントリは無視される', async () => {
  const zip = buildZip([
    { nameBytes: new TextEncoder().encode('dir/'), data: new Uint8Array(0), utf8Flag: true },
    { nameBytes: new TextEncoder().encode('dir/c.txt'), data: new TextEncoder().encode('x'), utf8Flag: true },
  ]);
  const files = await unzip(zip);
  assert.deepEqual([...files.keys()], ['dir/c.txt']);
});

test('ZIPでないバイト列はエラーになる', async () => {
  await assert.rejects(() => unzip(new Uint8Array([1, 2, 3, 4, 5])), /ZIP/);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... js/zip.js`）

- [ ] **Step 3: js/zip.js を実装**

```javascript
import { decodeShiftJis } from './encoding.js';

const EOCD_SIG = 0x06054b50;
const CDFH_SIG = 0x02014b50;

function findEocd(view) {
  const min = Math.max(0, view.byteLength - 22 - 65535);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  throw new Error('ZIPファイルとして読み取れません（End of Central Directoryが見つかりません）');
}

function listEntries(bytes, view) {
  const eocd = findEocd(view);
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CDFH_SIG) {
      throw new Error('ZIPのCentral Directoryが壊れています');
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLen);
    const name = (flags & 0x800) !== 0
      ? new TextDecoder('utf-8').decode(nameBytes)
      : decodeShiftJis(nameBytes);
    entries.push({ name, method, compressedSize, localOffset, encrypted: (flags & 1) !== 0 });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function entryData(bytes, view, entry) {
  const lo = entry.localOffset;
  const nameLen = view.getUint16(lo + 26, true);
  const extraLen = view.getUint16(lo + 28, true);
  const start = lo + 30 + nameLen + extraLen;
  return bytes.subarray(start, start + entry.compressedSize);
}

async function inflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

/** ZIPバイト列を Map<パス, Uint8Array> に展開する */
export async function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map();
  for (const entry of listEntries(bytes, view)) {
    if (entry.name.endsWith('/')) continue;
    if (entry.encrypted) throw new Error(`パスワード付きZIPには対応していません: ${entry.name}`);
    const data = entryData(bytes, view, entry);
    if (entry.method === 0) {
      files.set(entry.name, data.slice());
    } else if (entry.method === 8) {
      files.set(entry.name, await inflateRaw(data));
    } else {
      throw new Error(`対応していない圧縮方式(${entry.method})です: ${entry.name}`);
    }
  }
  return files;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（zip関連5件を含む全件）。Nodeが21未満で `CompressionStream is not defined` になる場合はNodeを更新する。

- [ ] **Step 5: Commit**

```bash
git add js/zip.js tests/zip.test.js
git commit -m "feat: 自前ZIPリーダー（DecompressionStream・CP932ファイル名対応）"
```

---

### Task 5: convert-dta.js（DTA→テーブルHTML）

**Files:**
- Create: `js/convert-dta.js`
- Test: `tests/convert-dta.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDta, dtaToHtml } from '../js/convert-dta.js';

const SAMPLE = [
  'HEADER-INFO 20251201',
  'A1,B2,C3,123,4567,東京都千代田区,株式会社テスト,山田太郎,03-1234-5678,備考',
  'short,line', // フィールド5未満はスキップ
  'no-comma-line-with-,x,y,z,w', // 5フィールドあれば採用
].join('\r\n');

test('parseDta は1行目をヘッダー、5フィールド以上の行をデータとして返す', () => {
  const { headerLine, rows } = parseDta(SAMPLE);
  assert.equal(headerLine, 'HEADER-INFO 20251201');
  assert.equal(rows.length, 2);
  assert.equal(rows[0][5], '東京都千代田区');
});

test('dtaToHtml は11列テーブルを含むHTMLを返し、セルをエスケープする', () => {
  const html = dtaToHtml('H\r\n<b>,x,y,z,w', 'SHFD0039.DTA');
  assert.ok(html.includes('<th>コード1</th>'));
  assert.ok(html.includes('<td>&lt;b&gt;</td>'));
  assert.ok(!html.includes('<td><b></td>'));
  assert.ok(html.includes('SHFD0039.DTA'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... js/convert-dta.js`）

- [ ] **Step 3: js/convert-dta.js を実装**

dta2html.pyのロジック移植: 1行目=ヘッダー情報、2行目以降のカンマを含む行を分割し5フィールド以上なら採用。表は10列＋No.列、超過フィールドは切り捨て、不足は空セル。

```javascript
import { escapeHtml, documentShell } from './html-util.js';

const COLUMNS = ['コード1', 'コード2', 'コード3', '郵便番号1', '郵便番号2', '住所', '会社名', '氏名', '電話番号', 'その他'];

export function parseDta(text) {
  const lines = text.split(/\r?\n/);
  const headerLine = (lines[0] ?? '').trim();
  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line.includes(',')) continue;
    const fields = line.trim().split(',');
    if (fields.length >= 5) rows.push(fields.map((f) => f.trim()));
  }
  return { headerLine, rows };
}

export function dtaToHtml(text, fileName) {
  const { headerLine, rows } = parseDta(text);
  const bodyRows = rows.map((fields, idx) => {
    const cells = [`<td>${idx + 1}</td>`];
    for (let i = 0; i < COLUMNS.length; i++) {
      cells.push(`<td>${escapeHtml(fields[i] ?? '')}</td>`);
    }
    return `<tr>${cells.join('')}</tr>`;
  }).join('\n');
  const body = `<h1>DTAデータ表示</h1>
<div class="info">
<p><strong>ファイル名:</strong> <code>${escapeHtml(fileName)}</code></p>
<p><strong>データ行数:</strong> ${rows.length}行</p>
</div>
<h2>ヘッダー情報</h2>
<pre>${escapeHtml(headerLine)}</pre>
<h2>データ</h2>
<table>
<thead><tr><th>No.</th>${COLUMNS.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
<tbody>
${bodyRows}
</tbody>
</table>`;
  return documentShell(`DTAデータ表示 - ${fileName}`, body);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/convert-dta.js tests/convert-dta.test.js
git commit -m "feat: DTA→テーブルHTML変換（dta2html.pyの移植＋エスケープ改善）"
```

---

### Task 6: convert-csv.js（CSV→テーブルHTML）

**Files:**
- Create: `js/convert-csv.js`
- Test: `tests/convert-csv.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, csvToHtml } from '../js/convert-csv.js';

test('parseCsv はCRLF・引用符・引用符内カンマ/改行を扱える', () => {
  const rows = parseCsv('a,b,c\r\n"x,1","y""q",z\r\n"multi\nline",2,3\r\n');
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['x,1', 'y"q', 'z'],
    ['multi\nline', '2', '3'],
  ]);
});

test('parseCsv は末尾の空行を無視する', () => {
  assert.deepEqual(parseCsv('a,b\n\n'), [['a', 'b']]);
});

test('csvToHtml は1行目をヘッダー行としてテーブルを生成しエスケープする', () => {
  const html = csvToHtml('名前,<注意>\n山田,"a&b"', '明細.csv');
  assert.ok(html.includes('<th>名前</th>'));
  assert.ok(html.includes('<th>&lt;注意&gt;</th>'));
  assert.ok(html.includes('<td>a&amp;b</td>'));
  assert.ok(html.includes('明細.csv'));
});

test('csvToHtml は空のCSVでもエラーにならない', () => {
  const html = csvToHtml('', 'empty.csv');
  assert.ok(html.includes('empty.csv'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... js/convert-csv.js`）

- [ ] **Step 3: js/convert-csv.js を実装**

```javascript
import { escapeHtml, documentShell } from './html-util.js';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

export function csvToHtml(text, fileName) {
  const rows = parseCsv(text);
  const [header = [], ...dataRows] = rows;
  const thead = `<tr>${header.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
  const tbody = dataRows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('\n');
  const body = `<h1>CSVデータ表示</h1>
<div class="info">
<p><strong>ファイル名:</strong> <code>${escapeHtml(fileName)}</code></p>
<p><strong>データ行数:</strong> ${dataRows.length}行</p>
</div>
<table>
<thead>${thead}</thead>
<tbody>
${tbody}
</tbody>
</table>`;
  return documentShell(`CSVデータ表示 - ${fileName}`, body);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/convert-csv.js tests/convert-csv.test.js
git commit -m "feat: CSV→テーブルHTML変換（RFC4180引用符対応）"
```

---

### Task 7: convert-xml.js（XSL参照抽出とXSLT変換）

**Files:**
- Create: `js/convert-xml.js`
- Test: `tests/convert-xml.test.js`

`transformXml` はブラウザ専用API（DOMParser/XSLTProcessor）を使うためユニットテスト対象外（Task 10で手動検証）。`extractXslHref` と `xmlSourceHtml` をテストする。

- [ ] **Step 1: 失敗するテストを書く**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractXslHref, xmlSourceHtml } from '../js/convert-xml.js';

test('extractXslHref はxml-stylesheet PIからhrefを取り出す', () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="kagami.xsl" ?><DOC/>';
  assert.equal(extractXslHref(xml), 'kagami.xsl');
});

test('extractXslHref はPIがなければnullを返す', () => {
  assert.equal(extractXslHref('<?xml version="1.0"?><DOC/>'), null);
});

test('xmlSourceHtml はエスケープしたXMLソースをpreで包む', () => {
  const html = xmlSourceHtml('<DOC a="1"/>', 'x.xml');
  assert.ok(html.includes('&lt;DOC a=&quot;1&quot;/&gt;'));
  assert.ok(html.includes('x.xml'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... js/convert-xml.js`）

- [ ] **Step 3: js/convert-xml.js を実装**

```javascript
import { escapeHtml, documentShell } from './html-util.js';

export function extractXslHref(xmlText) {
  const m = xmlText.match(/<\?xml-stylesheet[^?]*href="([^"]+\.xsl)"[^?]*\?>/i);
  return m ? m[1] : null;
}

/** XSLが見つからない場合のフォールバック表示 */
export function xmlSourceHtml(xmlText, fileName) {
  const body = `<h1>XMLソース表示</h1>
<div class="info">
<p><strong>ファイル名:</strong> <code>${escapeHtml(fileName)}</code></p>
<p>対応するXSLスタイルシートが見つからないため、ソースを表示しています。</p>
</div>
<pre>${escapeHtml(xmlText)}</pre>`;
  return documentShell(`XMLソース - ${fileName}`, body);
}

/** ブラウザ専用: XSLT 1.0でXMLをHTML化する */
export function transformXml(xmlText, xslText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const xslDoc = parser.parseFromString(xslText, 'application/xml');
  if (xmlDoc.querySelector('parsererror')) throw new Error('XMLの解析に失敗しました');
  if (xslDoc.querySelector('parsererror')) throw new Error('XSLの解析に失敗しました');
  const proc = new XSLTProcessor();
  proc.importStylesheet(xslDoc);
  const result = proc.transformToDocument(xmlDoc);
  if (!result) throw new Error('XSLT変換に失敗しました');
  return new XMLSerializer().serializeToString(result);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/convert-xml.js tests/convert-xml.test.js
git commit -m "feat: XSL参照抽出・XSLT変換・XMLソースフォールバック"
```

---

### Task 8: pipeline.js（種別判定・XSL解決・変換ディスパッチ）

**Files:**
- Create: `js/pipeline.js`
- Test: `tests/pipeline.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`convertFile` のxml成功パスはブラウザ専用のため、Nodeテストではdta/csv/other/XSL欠落フォールバックを検証する。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, resolveXslPath, convertFile } from '../js/pipeline.js';

test('classify は拡張子で種別を判定する（大文字小文字を無視）', () => {
  assert.equal(classify('a/b.xml'), 'xml');
  assert.equal(classify('SHFD0039.DTA'), 'dta');
  assert.equal(classify('明細.csv'), 'csv');
  assert.equal(classify('doc.pdf'), 'other');
  assert.equal(classify('kagami.xsl'), 'other');
});

test('resolveXslPath は同じフォルダ内のXSLを解決する', () => {
  const paths = ['box/a.xml', 'box/kagami.xsl', 'kagami.xsl'];
  assert.equal(resolveXslPath('box/a.xml', 'kagami.xsl', paths), 'box/kagami.xsl');
  assert.equal(resolveXslPath('b.xml', 'kagami.xsl', paths), 'kagami.xsl');
  assert.equal(resolveXslPath('box/a.xml', 'missing.xsl', paths), null);
});

test('convertFile はDTAをshift_jisで読んで変換する', () => {
  // "H\nあ,い,う,え,お" のCP932表現
  const sjis = new Uint8Array([
    0x48, 0x0a,
    0x82, 0xa0, 0x2c, 0x82, 0xa2, 0x2c, 0x82, 0xa4, 0x2c, 0x82, 0xa6, 0x2c, 0x82, 0xa8,
  ]);
  const files = new Map([['SHFD0039.DTA', sjis]]);
  const r = convertFile('SHFD0039.DTA', sjis, files);
  assert.equal(r.status, 'ok');
  assert.ok(r.html.includes('<td>あ</td>'));
});

test('convertFile はXSLが見つからないXMLをwarnでソース表示する', () => {
  const xml = new TextEncoder().encode('<?xml-stylesheet href="missing.xsl"?><DOC>秘</DOC>');
  const files = new Map([['a.xml', xml]]);
  const r = convertFile('a.xml', xml, files);
  assert.equal(r.status, 'warn');
  assert.ok(r.message.includes('missing.xsl'));
  assert.ok(r.html.includes('&lt;DOC&gt;'));
});

test('convertFile は未対応拡張子をotherとして返す', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const r = convertFile('doc.pdf', bytes, new Map([['doc.pdf', bytes]]));
  assert.equal(r.status, 'other');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... js/pipeline.js`）

- [ ] **Step 3: js/pipeline.js を実装**

```javascript
import { decodeAuto, decodeShiftJis } from './encoding.js';
import { dtaToHtml } from './convert-dta.js';
import { csvToHtml } from './convert-csv.js';
import { extractXslHref, transformXml, xmlSourceHtml } from './convert-xml.js';

export function classify(path) {
  const name = path.split('/').pop();
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (ext === 'xml') return 'xml';
  if (ext === 'dta') return 'dta';
  if (ext === 'csv') return 'csv';
  return 'other';
}

export function resolveXslPath(xmlPath, href, allPaths) {
  const slash = xmlPath.lastIndexOf('/');
  const dir = slash >= 0 ? xmlPath.slice(0, slash + 1) : '';
  const candidate = dir + href;
  return allPaths.includes(candidate) ? candidate : null;
}

/**
 * 1ファイルを変換する。
 * @param {string} path 仮想ツリー内のパス
 * @param {Uint8Array} bytes ファイル内容
 * @param {Map<string, Uint8Array>} files 全ファイル（XSL解決に使用）
 * @returns {{kind: string, status: 'ok'|'warn'|'error'|'other', html?: string, message?: string}}
 */
export function convertFile(path, bytes, files) {
  const kind = classify(path);
  const name = path.split('/').pop();
  try {
    if (kind === 'dta') {
      return { kind, status: 'ok', html: dtaToHtml(decodeShiftJis(bytes), name) };
    }
    if (kind === 'csv') {
      return { kind, status: 'ok', html: csvToHtml(decodeAuto(bytes), name) };
    }
    if (kind === 'xml') {
      const text = decodeAuto(bytes);
      const href = extractXslHref(text);
      const xslPath = href ? resolveXslPath(path, href, [...files.keys()]) : null;
      if (!xslPath) {
        const message = href ? `XSLファイルが見つかりません: ${href}` : 'XSL参照がありません';
        return { kind, status: 'warn', html: xmlSourceHtml(text, name), message };
      }
      return { kind, status: 'ok', html: transformXml(text, decodeAuto(files.get(xslPath))) };
    }
    return { kind, status: 'other' };
  } catch (e) {
    return { kind, status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全タスク累計）

- [ ] **Step 5: Commit**

```bash
git add js/pipeline.js tests/pipeline.test.js
git commit -m "feat: 種別判定・XSL解決・変換ディスパッチ"
```

---

### Task 9: intake.js と app.js（受け入れ・UI）

**Files:**
- Create: `js/intake.js`
- Modify: `js/app.js`（プレースホルダを全置換）

ブラウザ専用（drag&drop API・DOM）のためユニットテストなし。Task 10で手動検証する。

- [ ] **Step 1: js/intake.js を実装**

注意: `webkitGetAsEntry()` はdropイベントのハンドラ内で**同期的に**全item分呼び出してから非同期処理に入ること（awaitを挟むとDataTransferItemが無効になる）。

```javascript
import { unzip } from './zip.js';

/** dropイベントのDataTransferを [{path, bytes}] に変換する */
export async function collectDropped(dataTransfer) {
  const items = [...dataTransfer.items];
  const entries = items.map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null));
  const files = items.map((item) => item.getAsFile());
  const out = [];
  for (let i = 0; i < items.length; i++) {
    if (entries[i]) {
      await walkEntry(entries[i], '', out);
    } else if (files[i]) {
      out.push({ path: files[i].name, bytes: new Uint8Array(await files[i].arrayBuffer()) });
    }
  }
  return out;
}

async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    out.push({ path: prefix + entry.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let batch;
    do {
      batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      for (const child of batch) await walkEntry(child, `${prefix}${entry.name}/`, out);
    } while (batch.length > 0);
  }
}

/** input[type=file] のFileListを [{path, bytes}] に変換する */
export async function filesFromInput(fileList) {
  return Promise.all(
    [...fileList].map(async (f) => ({ path: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
  );
}

/** .zipを再帰的に展開する。壊れたZIPはerrorプロパティ付きでそのまま残す */
export async function expandZips(list) {
  const out = [];
  for (const item of list) {
    if (!/\.zip$/i.test(item.path)) {
      out.push(item);
      continue;
    }
    const stem = item.path.replace(/\.zip$/i, '');
    try {
      const inner = await unzip(item.bytes);
      const innerList = [...inner].map(([p, bytes]) => ({ path: `${stem}/${p}`, bytes }));
      out.push(...(await expandZips(innerList)));
    } catch (e) {
      out.push({ ...item, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
```

- [ ] **Step 2: js/app.js を実装（全置換）**

```javascript
import { collectDropped, filesFromInput, expandZips } from './intake.js';
import { convertFile } from './pipeline.js';

const state = {
  files: new Map(),   // path -> Uint8Array
  results: new Map(), // path -> {kind, status, html?, message?}
  blobUrls: [],
};

const el = {
  dropzone: document.getElementById('dropzone'),
  dropHint: document.getElementById('drop-hint'),
  viewer: document.getElementById('viewer'),
  tree: document.getElementById('file-tree'),
  frame: document.getElementById('preview-frame'),
  placeholder: document.getElementById('preview-placeholder'),
  clearBtn: document.getElementById('clear-btn'),
  fileInput: document.getElementById('file-input'),
};

const STATUS_ICON = { ok: '📄', warn: '⚠️', error: '❌', other: '📎' };

el.dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  el.dropzone.classList.add('dragging');
});
el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('dragging'));
el.dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  el.dropzone.classList.remove('dragging');
  addFiles(await collectDropped(e.dataTransfer));
});
el.fileInput.addEventListener('change', async () => {
  addFiles(await filesFromInput(el.fileInput.files));
  el.fileInput.value = '';
});
el.clearBtn.addEventListener('click', clearAll);

async function addFiles(list) {
  const expanded = await expandZips(list);
  for (const item of expanded) {
    if (item.path.split('/').pop().startsWith('.')) continue; // .DS_Store等を除外
    state.files.set(item.path, item.bytes);
    if (item.error) state.results.set(item.path, { kind: 'other', status: 'error', message: item.error });
  }
  if (state.files.size === 0) return;
  convertAll();
  renderTree();
  showViewer();
}

function convertAll() {
  for (const [path, bytes] of state.files) {
    const pre = state.results.get(path);
    if (pre && pre.status === 'error' && pre.kind === 'other') continue; // ZIP展開失敗を保持
    state.results.set(path, convertFile(path, bytes, state.files));
  }
}

function showViewer() {
  el.dropzone.classList.remove('empty');
  el.dropHint.hidden = true;
  el.viewer.hidden = false;
  el.clearBtn.hidden = false;
}

function clearAll() {
  for (const url of state.blobUrls) URL.revokeObjectURL(url);
  state.blobUrls.length = 0;
  state.files.clear();
  state.results.clear();
  el.tree.replaceChildren();
  el.frame.removeAttribute('srcdoc');
  el.frame.hidden = true;
  el.placeholder.textContent = '左の一覧からファイルを選択してください';
  el.placeholder.hidden = false;
  el.viewer.hidden = true;
  el.dropHint.hidden = false;
  el.dropzone.classList.add('empty');
  el.clearBtn.hidden = true;
}

function buildTree(paths) {
  const root = { dirs: new Map(), files: [] };
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    }
    node.files.push(path);
  }
  return root;
}

function renderTree() {
  el.tree.replaceChildren(renderNode(buildTree([...state.files.keys()].sort())));
}

function renderNode(node) {
  const frag = document.createDocumentFragment();
  for (const [name, child] of node.dirs) {
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = `📁 ${name}`;
    details.append(summary, renderNode(child));
    frag.append(details);
  }
  for (const path of node.files) {
    const result = state.results.get(path);
    const btn = document.createElement('button');
    btn.dataset.path = path;
    btn.textContent = `${STATUS_ICON[result?.status] ?? '📄'} ${path.split('/').pop()}`;
    btn.title = path + (result?.message ? `\n${result.message}` : '');
    btn.addEventListener('click', () => selectFile(path));
    frag.append(btn);
  }
  return frag;
}

function selectFile(path) {
  for (const b of el.tree.querySelectorAll('button')) {
    b.classList.toggle('selected', b.dataset.path === path);
  }
  const result = state.results.get(path);
  const name = path.split('/').pop();
  if (result?.html) {
    el.frame.srcdoc = result.html;
    el.frame.hidden = false;
    el.placeholder.hidden = true;
    return;
  }
  el.frame.hidden = true;
  el.placeholder.hidden = false;
  if (result?.status === 'other') {
    const url = URL.createObjectURL(new Blob([state.files.get(path)]));
    state.blobUrls.push(url);
    el.placeholder.replaceChildren();
    const p = document.createElement('p');
    p.textContent = 'このファイル形式は表示に対応していません。';
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.textContent = `${name} をダウンロード`;
    el.placeholder.append(p, a);
  } else {
    el.placeholder.textContent = `変換に失敗しました: ${result?.message ?? '不明なエラー'}`;
  }
}
```

- [ ] **Step 3: 全テストが引き続き通ることを確認**

Run: `npm test`
Expected: PASS（app.js/intake.jsはテスト対象外だが、既存テストが壊れていないこと）

- [ ] **Step 4: Commit**

```bash
git add js/intake.js js/app.js
git commit -m "feat: ドロップ受け入れ・ZIP再帰展開・ツリー＋プレビューUI"
```

---

### Task 10: サンプルデータによる手動E2E検証

**Files:** なし（検証のみ。不具合があれば該当モジュールを修正してテスト追加）

- [ ] **Step 1: ローカルサーバーを起動**

Run: `cd ~/git/github.com/thwoo-inc/egovdocs-viewer && python3 -m http.server 8765`
ブラウザで `http://localhost:8765` を開く。

- [ ] **Step 2: 展開済みフォルダのドロップを検証**

`~/git/github.com/thwoo-inc/egovdocs-conv2html/samples/9876543210123456/` フォルダをドロップ。
Expected:
- かがみXML（202511140728500500.xml）→「日本年金機構からのお知らせ」が整形表示される
- 社会保険料額情報XML → yoshiki_04_shakai_003.xslで帳票風に表示される
- 明細CSV（CP932）→ 文字化けなくテーブル表示される
- kagami.xsl等 → 📎アイコンでダウンロードリンクになる

- [ ] **Step 3: DTAの検証**

`samples/9876543210123458/` をドロップ（追加ドロップになることも確認）。
Expected: SHFD0039.DTA が11列テーブルで文字化けなく表示される。

- [ ] **Step 4: ZIPの検証**

Run（CP932ファイル名のZIPを作成。macOSのzipはUTF-8フラグを立てないファイル名になる場合があるため、確実にCP932にするなら `-fz` なしで確認）:

```bash
cd ~/git/github.com/thwoo-inc/egovdocs-conv2html/samples && zip -r /tmp/egov-test.zip 9876543210123457 -x '*.html' -x '*.DS_Store'
```

`/tmp/egov-test.zip` をドロップ。
Expected: ZIP内の増減内訳書XML・CSV群がツリーに展開され、日本語ファイル名が文字化けせず、各ファイルが表示される。

- [ ] **Step 5: エラーパスの検証**

- XSLなしの単体XML（適当なXMLファイル1個だけ）をドロップ → ⚠️アイコン＋ソース表示
- テキストファイルを `.zip` にリネームしてドロップ → エラー表示（❌）で他ファイルの処理は継続
- 「クリア」ボタン → 初期画面に戻る

- [ ] **Step 6: 通信ゼロの確認**

DevToolsのNetworkタブを開いたままSteps 2-5を再実行。
Expected: ページ自身のアセット（index.html/app.css/js群）以外のリクエストが一切発生しない。

- [ ] **Step 7: 不具合修正があればテストを追加して修正し、コミット**

```bash
git add -A && git commit -m "fix: 手動検証で見つかった不具合の修正"
```

（不具合がなければこのステップはスキップ）

---

### Task 11: README・GitHub Pages公開

**Files:**
- Create: `README.md`

- [ ] **Step 1: README.md を作成**

```markdown
# e-Gov通知文書ビューア

e-Govの通知文書送達でダウンロードしたZIPファイルを、ブラウザにドラッグ＆ドロップするだけで読みやすいHTMLに変換・表示するWebアプリです。

## 特徴

- **通信ゼロ**: すべての処理はブラウザ内のJavaScriptで完結します。ファイルの内容が外部に送信されることはありません（Content-Security-Policyで通信を構造的に禁止しています）
- **外部依存ゼロ**: サードパーティライブラリを使用していません。ZIP展開もブラウザ標準APIで行います
- **インストール不要**: GitHub Pagesにアクセスするだけで使えます

## 使い方

1. 公開ページを開く
2. e-GovからダウンロードしたZIPファイル（または展開済みフォルダ・個別ファイル）をドラッグ＆ドロップ
3. 左の一覧からファイルを選ぶと右側に変換結果が表示される

## 対応ファイル

| 種類 | 処理 |
| --- | --- |
| XML（XSL参照あり） | 同梱XSLをXSLT 1.0で適用して表示 |
| XML（XSL参照なし） | ソースを整形表示 |
| DTA | CP932でデコードしてテーブル表示 |
| CSV | UTF-8/CP932を自動判定してテーブル表示 |
| その他（PDF等） | ダウンロードリンク |

## 対応ブラウザ

Chrome 103+ / Edge 103+ / Safari 16.4+ / Firefox 113+（DecompressionStream対応が必要）

## 開発

ビルド工程はありません。ローカル確認は任意の静的サーバーで:

​```bash
python3 -m http.server 8765
​```

テスト（Node 21以上）:

​```bash
npm test
​```

## 関連

CLI版: [egovdocs-conv2html](https://github.com/thwoo-inc/egovdocs-conv2html)
```

（コードブロック内の ​``` は実際にはバッククォート3つで書く）

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: READMEを追加"
```

- [ ] **Step 3: GitHubリポジトリ作成とpush**

リポジトリの公開/非公開はユーザーに確認する（Pagesは無料プランではpublicリポジトリのみ）。

```bash
cd ~/git/github.com/thwoo-inc/egovdocs-viewer
gh repo create thwoo-inc/egovdocs-viewer --public --source=. --push
```

- [ ] **Step 4: GitHub Pagesを有効化**

```bash
gh api -X POST repos/thwoo-inc/egovdocs-viewer/pages -f 'source[branch]=main' -f 'source[path]=/'
```

Expected: `https://thwoo-inc.github.io/egovdocs-viewer/` が数分以内に配信開始。

- [ ] **Step 5: 公開ページで最終確認**

公開URLを開き、Task 10のStep 2とStep 6（Networkタブ確認）を再実行。
Expected: ローカルと同一の動作、外部リクエストなし。
