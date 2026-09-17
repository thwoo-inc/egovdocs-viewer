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
