import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, resolveXslPath, convertFile } from '../js/pipeline.js';

test('classify は拡張子で種別を判定する（大文字小文字を無視）', () => {
  assert.equal(classify('a/b.xml'), 'xml');
  assert.equal(classify('SHFD0039.DTA'), 'dta');
  assert.equal(classify('明細.csv'), 'csv');
  assert.equal(classify('doc.pdf'), 'other');
  assert.equal(classify('kagami.xsl'), 'other');
});

test('resolveXslPath は同じフォルダ内のXSLを解決する', () => {
  const paths = ['box/a.xml', 'box/kagami.xsl', 'kagami.xsl'];
  assert.equal(resolveXslPath('box/a.xml', 'kagami.xsl', paths), 'box/kagami.xsl');
  assert.equal(resolveXslPath('b.xml', 'kagami.xsl', paths), 'kagami.xsl');
  assert.equal(resolveXslPath('box/a.xml', 'missing.xsl', paths), null);
});

test('convertFile はDTAをshift_jisで読んで変換する', () => {
  // "H\nあ,い,う,え,お" のCP932表現
  const sjis = new Uint8Array([
    0x48, 0x0a,
    0x82, 0xa0, 0x2c, 0x82, 0xa2, 0x2c, 0x82, 0xa4, 0x2c, 0x82, 0xa6, 0x2c, 0x82, 0xa8,
  ]);
  const files = new Map([['SHFD0039.DTA', sjis]]);
  const r = convertFile('SHFD0039.DTA', sjis, files);
  assert.equal(r.status, 'ok');
  assert.ok(r.html.includes('<td>あ</td>'));
});

test('convertFile はXSLが見つからないXMLをwarnでソース表示する', () => {
  const xml = new TextEncoder().encode('<?xml-stylesheet href="missing.xsl"?><DOC>秘</DOC>');
  const files = new Map([['a.xml', xml]]);
  const r = convertFile('a.xml', xml, files);
  assert.equal(r.status, 'warn');
  assert.ok(r.message.includes('missing.xsl'));
  assert.ok(r.html.includes('&lt;DOC&gt;'));
});

test('convertFile は未対応拡張子をotherとして返す', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const r = convertFile('doc.pdf', bytes, new Map([['doc.pdf', bytes]]));
  assert.equal(r.status, 'other');
});
