// 調査用ログパネル。URLに ?debug=1 を付けたときだけ有効。
const params = new URLSearchParams(location.search);
export const debugEnabled = params.has('debug');
let box;

function panel() {
  if (box) return box;
  const wrap = document.createElement('div');
  wrap.id = 'debug-panel';
  const head = document.createElement('div');
  head.id = 'debug-head';
  const title = document.createElement('span');
  title.textContent = '調査ログ（?debug=1）';
  const copy = document.createElement('button');
  copy.textContent = 'コピー';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(box.value);
      copy.textContent = 'コピーしました';
    } catch {
      box.select();
      document.execCommand('copy');
      copy.textContent = 'コピーしました';
    }
    setTimeout(() => { copy.textContent = 'コピー'; }, 1500);
  });
  head.append(title, copy);
  box = document.createElement('textarea');
  box.readOnly = true;
  wrap.append(head, box);
  document.body.append(wrap);
  return box;
}

export function debugLog(...parts) {
  if (!debugEnabled) return;
  const t = new Date();
  const ts = `${t.toTimeString().slice(0, 8)}.${String(t.getMilliseconds()).padStart(3, '0')}`;
  const line = `${ts} | ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}`;
  const el = panel();
  el.value += line + '\n';
  el.scrollTop = el.scrollHeight;
}

export function initDebug() {
  if (!debugEnabled) return;
  debugLog('UA:', navigator.userAgent);
  debugLog('機能:', {
    DecompressionStream: typeof DecompressionStream !== 'undefined',
    XSLTProcessor: typeof XSLTProcessor !== 'undefined',
    webkitGetAsEntry: typeof DataTransferItem !== 'undefined' && 'webkitGetAsEntry' in DataTransferItem.prototype,
  });
  window.addEventListener('error', (e) => debugLog('window.onerror:', e.message, `${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => debugLog('unhandledrejection:', String(e.reason && e.reason.stack || e.reason)));
  document.addEventListener('securitypolicyviolation', (e) => debugLog('CSP違反:', e.violatedDirective, e.blockedURI, e.sourceFile ?? ''));
}
