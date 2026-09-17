import { collectDropped, filesFromInput, expandZips } from './intake.js';
import { convertFile } from './pipeline.js';
import { debugLog, initDebug } from './debug.js';

initDebug();

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
  debugLog('drop:', `items=${e.dataTransfer.items.length}`, [...e.dataTransfer.items].map((i) => `${i.kind}/${i.type}`).join(','));
  addFiles(await collectDropped(e.dataTransfer));
});
el.fileInput.addEventListener('change', async () => {
  debugLog('file-input:', `files=${el.fileInput.files.length}`);
  addFiles(await filesFromInput(el.fileInput.files));
  el.fileInput.value = '';
});
el.frame.addEventListener('load', () => {
  debugLog('iframe load:', `srcdocLen=${(el.frame.getAttribute('srcdoc') ?? '').length}`, `hidden=${el.frame.hidden}`);
});
el.clearBtn.addEventListener('click', clearAll);

async function addFiles(list) {
  debugLog('addFiles入力:', list.map((i) => `${i.path}(${i.bytes.length}B)`).join(', '));
  const expanded = await expandZips(list);
  debugLog('展開後:', expanded.map((i) => `${i.path}(${i.bytes.length}B${i.error ? ` error:${i.error}` : ''})`).join(', '));
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
    const result = convertFile(path, bytes, state.files);
    state.results.set(path, result);
    debugLog('convert:', path, `status=${result.status}`, `htmlLen=${result.html?.length ?? 0}`, result.message ?? '');
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
  debugLog('select:', path, `status=${result?.status}`, `htmlLen=${result?.html?.length ?? 0}`);
  if (result?.html) {
    el.frame.srcdoc = result.html;
    el.frame.hidden = false;
    el.placeholder.hidden = true;
    debugLog('srcdoc設定直後:', `attrLen=${(el.frame.getAttribute('srcdoc') ?? '').length}`);
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
