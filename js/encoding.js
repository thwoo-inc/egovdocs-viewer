export function decodeShiftJis(bytes) {
  return new TextDecoder('shift_jis').decode(bytes);
}

export function decodeAuto(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decodeShiftJis(bytes);
  }
}
