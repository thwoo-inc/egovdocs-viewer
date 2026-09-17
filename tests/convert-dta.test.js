import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDta, dtaToHtml } from '../js/convert-dta.js';

const SAMPLE = [
  'HEADER-INFO 20251201',
  'A1,B2,C3,123,4567,東京都千代田区,株式会社テスト,山田太郎,03-1234-5678,備考',
  'short,line', // フィールド5未満はスキップ
  'no-comma-line-with-,x,y,z,w', // 5フィールドあれば採用
].join('\r\n');

test('parseDta は1行目をヘッダー、5フィールド以上の行をデータとして返す', () => {
  const { headerLine, rows } = parseDta(SAMPLE);
  assert.equal(headerLine, 'HEADER-INFO 20251201');
  assert.equal(rows.length, 2);
  assert.equal(rows[0][5], '東京都千代田区');
});

test('dtaToHtml は11列テーブルを含むHTMLを返し、セルをエスケープする', () => {
  const html = dtaToHtml('H\r\n<b>,x,y,z,w', 'SHFD0039.DTA');
  assert.ok(html.includes('<th>コード1</th>'));
  assert.ok(html.includes('<td>&lt;b&gt;</td>'));
  assert.ok(!html.includes('<td><b></td>'));
  assert.ok(html.includes('SHFD0039.DTA'));
});
