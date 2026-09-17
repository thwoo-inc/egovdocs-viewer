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
