/**
 * Prisma `Bytes` columns are typed as `Uint8Array<ArrayBuffer>`, while Node's
 * `Buffer` is backed by `ArrayBufferLike` (possibly shared) — this pair of
 * helpers converts in both directions so uploaded files can round-trip through
 * Postgres and back out as HTTP response bodies.
 */

export function toBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(buf);
}

export function fromBytes(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}
