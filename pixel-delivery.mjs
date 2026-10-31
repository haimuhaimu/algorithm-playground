import {inspectPacket} from './pixel-core.mjs?v=recipient-1';

// A fixed parcel, not a second codec: every boundary comes from the real parser.
export function createDelivery(packet, count) {
  const copy = new Uint8Array(packet), parsed = inspectPacket(copy, count);
  return Object.freeze({
    bits: [...copy].map(byte => byte.toString(2).padStart(8, '0')).join(''),
    treeBits: parsed.treeBits,
    payloadEnd: parsed.treeBits + parsed.payloadBits,
    entries: Object.freeze(parsed.entries.map(entry => Object.freeze(entry))),
    pixels: Object.freeze(parsed.pixels),
  });
}

export function deliveryAt(trace, value) {
  const sent = Number.isFinite(value) ? Math.max(0, Math.min(trace.bits.length, Math.floor(value))) : 0;
  const decoded = trace.entries.filter(entry => entry.endBit <= sent).length;
  const phase = sent < trace.treeBits ? 'tree' : sent < trace.payloadEnd ? 'pixel' : sent < trace.bits.length ? 'padding' : 'complete';
  const next = trace.entries[decoded];
  // At a leaf boundary, keep the pixel that just appeared visible in the explanation.
  const focus = sent >= trace.treeBits
    ? (decoded && (!next || sent === next.startBit) ? trace.entries[decoded - 1] : next)
    : null;
  const prefix = focus ? trace.bits.slice(focus.startBit, Math.min(sent, focus.endBit)) : '';
  return {
    sent, decoded, phase, focus, prefix, complete: sent === trace.bits.length,
    pixels: trace.pixels.map((color, index) => index < decoded ? color : null),
  };
}
