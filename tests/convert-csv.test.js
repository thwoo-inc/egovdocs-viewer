import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, csvToHtml } from '../js/convert-csv.js';

test('parseCsv はCRLF・引用符・引用符内カンマ/改行を扱える', () => {
  const rows = parseCsv('a,b,c\r\n"x,1","y""q",z\r\n"multi\nline",2,3\r\n');
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['x,1', 'y"q', 'z'],
    ['multi\nline', '2', '3'],
  ]);
});

test('parseCsv は末尾の空行を無視する', () => {
  assert.deepEqual(parseCsv('a,b\n\n'), [['a', 'b']]);
});

test('csvToHtml は1行目をヘッダー行としてテーブルを生成しエスケープする', () => {
  const html = csvToHtml('名前,<注意>\n山田,"a&b"', '明細.csv');
  assert.ok(html.includes('<th>名前</th>'));
  assert.ok(html.includes('<th>&lt;注意&gt;</th>'));
  assert.ok(html.includes('<td>a&amp;b</td>'));
  assert.ok(html.includes('明細.csv'));
});

test('csvToHtml は空のCSVでもエラーにならない', () => {
  const html = csvToHtml('', 'empty.csv');
  assert.ok(html.includes('empty.csv'));
});
