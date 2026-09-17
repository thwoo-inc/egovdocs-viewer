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
