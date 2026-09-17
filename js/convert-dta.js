import { escapeHtml, renderCell, documentShell } from './html-util.js';

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
      cells.push(`<td>${renderCell(fields[i] ?? '')}</td>`);
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
