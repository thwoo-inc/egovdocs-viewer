import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, documentShell, renderCell } from '../js/html-util.js';

test('escapeHtml は特殊文字をエスケープする', () => {
  assert.equal(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});

test('renderCell は<br/>を改行として復元する', () => {
  assert.equal(renderCell('1行目<br/>2行目<br>3行目'), '1行目<br>2行目<br>3行目');
});

test('renderCell はhttp(s)リンクを新しいタブで開くaタグとして復元する', () => {
  const html = renderCell('案内<br/><a href="https://www.nenkin.go.jp/x?a=1&b=2">https://www.nenkin.go.jp/x</a>');
  assert.equal(html, '案内<br><a href="https://www.nenkin.go.jp/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">https://www.nenkin.go.jp/x</a>');
});

test('renderCell はscriptや危険なスキームのリンクを復元しない', () => {
  assert.equal(renderCell('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(renderCell('<a href="javascript:alert(1)">x</a>'), '&lt;a href=&quot;javascript:alert(1)&quot;&gt;x&lt;/a&gt;');
  assert.equal(renderCell('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('renderCell はリンクテキスト内のタグをエスケープしたままにする', () => {
  const html = renderCell('<a href="https://example.com"><b>太字</b></a>');
  assert.equal(html, '<a href="https://example.com" target="_blank" rel="noopener noreferrer">&lt;b&gt;太字&lt;/b&gt;</a>');
});

test('documentShell はタイトルと本文を含む完全なHTMLを返す', () => {
  const html = documentShell('テスト<title>', '<p>本文</p>');
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('<title>テスト&lt;title&gt;</title>'));
  assert.ok(html.includes('<p>本文</p>'));
});
