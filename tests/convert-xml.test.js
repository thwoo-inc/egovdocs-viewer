import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractXslHref, xmlSourceHtml } from '../js/convert-xml.js';

test('extractXslHref はxml-stylesheet PIからhrefを取り出す', () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="kagami.xsl" ?><DOC/>';
  assert.equal(extractXslHref(xml), 'kagami.xsl');
});

test('extractXslHref はPIがなければnullを返す', () => {
  assert.equal(extractXslHref('<?xml version="1.0"?><DOC/>'), null);
});

test('xmlSourceHtml はエスケープしたXMLソースをpreで包む', () => {
  const html = xmlSourceHtml('<DOC a="1"/>', 'x.xml');
  assert.ok(html.includes('&lt;DOC a=&quot;1&quot;/&gt;'));
  assert.ok(html.includes('x.xml'));
});
