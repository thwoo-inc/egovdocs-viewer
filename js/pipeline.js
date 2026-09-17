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
