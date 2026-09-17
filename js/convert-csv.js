import { escapeHtml, renderCell, documentShell } from './html-util.js';

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
    .map((r) => `<tr>${r.map((c) => `<td>${renderCell(c)}</td>`).join('')}</tr>`)
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
