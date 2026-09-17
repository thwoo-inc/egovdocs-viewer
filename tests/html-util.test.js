import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, documentShell } from '../js/html-util.js';

test('escapeHtml は特殊文字をエスケープする', () => {
  assert.equal(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});

test('documentShell はタイトルと本文を含む完全なHTMLを返す', () => {
  const html = documentShell('テスト<title>', '<p>本文</p>');
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('<title>テスト&lt;title&gt;</title>'));
  assert.ok(html.includes('<p>本文</p>'));
});
