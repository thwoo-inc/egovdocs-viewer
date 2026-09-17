import { unzip } from './zip.js';

/** dropイベントのDataTransferを [{path, bytes}] に変換する */
export async function collectDropped(dataTransfer) {
  // webkitGetAsEntry/getAsFileはawaitを挟む前に同期的に全item分呼び出す必要がある
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
