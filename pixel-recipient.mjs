import { encode, inspectPacket } from './pixel-core.mjs?v=recipient-1';

export function createRecipientLesson(pixels) {
  if (!Array.isArray(pixels) || pixels.length !== 256) throw new TypeError('Expected 256 postcard pixels');
  return createRecipientLessonFromPacket(encode(pixels).packet);
}

export function createRecipientLessonFromPacket(packet) {
  if (!(packet instanceof Uint8Array)) throw new TypeError('Expected postcard packet bytes');
  const bytes = Uint8Array.from(packet), trace = inspectPacket(bytes, 256);
  const snapshot = Object.freeze([...trace.pixels]);
  const counts = [0, 0, 0, 0];
  for (const color of snapshot) counts[color]++;
  // Pick one contiguous half-row, preferring varied colors. This is selection,
  // never new encoding: codes and offsets still belong to the entire postcard.
  let start = 0, diversity = 0;
  for (let i = 0; i < 256; i += 8) {
    const score = new Set(snapshot.slice(i, i + 8)).size;
    if (score > diversity) { start = i; diversity = score; }
  }
  return Object.freeze({
    snapshot, start,
    codes: Object.freeze(trace.codes),
    counts: Object.freeze(counts),
    entries: Object.freeze(trace.entries.slice(start, start + 8).map(Object.freeze)),
    packetBytes: bytes.length,
    treeBits: trace.treeBits, payloadBits: trace.payloadBits, paddingBits: trace.paddingBits,
    restored: Object.freeze([]), prefix: '', readBits: 0, feedback: 'ready',
  });
}

export function readRecipientBit(state) {
  const entry = state.entries[state.restored.length];
  if (!entry || state.prefix.length === entry.code.length) return state;
  return Object.freeze({
    ...state, prefix: entry.code.slice(0, state.prefix.length + 1),
    readBits: state.readBits + 1, feedback: 'reading',
  });
}

export function chooseRecipientColor(state, color) {
  const entry = state.entries[state.restored.length];
  if (!entry) return state;
  if (state.prefix !== entry.code) return Object.freeze({ ...state, feedback: 'incomplete' });
  if (color !== entry.color) return Object.freeze({ ...state, feedback: 'wrong' });
  return Object.freeze({
    ...state, restored: Object.freeze([...state.restored, color]),
    prefix: '', feedback: 'correct',
  });
}
