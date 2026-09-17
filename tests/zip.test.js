import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzip } from '../js/zip.js';

const le16 = (n) => [n & 255, (n >> 8) & 255];
const le32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

// entries: [{ nameBytes, data, utf8Flag?, method? (0=stored, 8=deflate。dataは圧縮済みとして格納), rawSize? }]
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

test('UTF-8フラグなしでも有効なUTF-8名ならUTF-8としてデコードする（macOS zip対策）', async () => {
  const nameBytes = new TextEncoder().encode('増減内訳書.xml');
  const zip = buildZip([{ nameBytes, data: new Uint8Array([0x41]) }]);
  const files = await unzip(zip);
  assert.deepEqual([...files.keys()], ['増減内訳書.xml']);
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
