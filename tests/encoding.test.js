import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeAuto, decodeShiftJis } from '../js/encoding.js';

test('decodeShiftJis はCP932バイト列をデコードする', () => {
  // "テスト" のCP932表現
  const bytes = new Uint8Array([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]);
  assert.equal(decodeShiftJis(bytes), 'テスト');
});

test('decodeAuto は正しいUTF-8をUTF-8としてデコードする', () => {
  const bytes = new TextEncoder().encode('社会保険');
  assert.equal(decodeAuto(bytes), '社会保険');
});

test('decodeAuto はUTF-8として不正ならshift_jisにフォールバックする', () => {
  const bytes = new Uint8Array([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]); // テスト(CP932)
  assert.equal(decodeAuto(bytes), 'テスト');
});
