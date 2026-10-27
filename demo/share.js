// Puts a workout in a URL fragment, so the builder can hand it to the player
// and anyone can share a link. Fragments never reach a server.

export const MAX_BYTES = 1024 * 1024; // SPEC.md section 10: 1 MiB per document
// Link data longer than this can't hold a workout within the limit, even
// uncompressed: base64 adds a third.
const MAX_LINK_DATA = Math.ceil((MAX_BYTES * 4) / 3) + 16;
const TOO_LARGE = 'This workout is larger than PWF allows (1 MiB).';

/** Throws if text is larger than PWF allows. Call it before parsing. */
export function checkSize(text) {
  if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error(TOO_LARGE);
}

export async function encodeWorkout(doc) {
  const json = new TextEncoder().encode(JSON.stringify(doc));
  if (typeof CompressionStream === 'function') {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return `z.${toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
  }
  return `j.${toBase64Url(json)}`;
}

export async function decodeWorkout(text) {
  const [kind, data] = [text.slice(0, 2), text.slice(2)];
  if (kind !== 'z.' && kind !== 'j.') throw new Error('This link doesn’t hold a workout.');
  if (data.length > MAX_LINK_DATA) throw new Error(TOO_LARGE);
  let bytes = fromBase64Url(data);
  if (kind === 'z.') bytes = await inflate(bytes);
  if (bytes.length > MAX_BYTES) throw new Error(TOO_LARGE);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Decompresses, stopping as soon as the output passes the size limit, so a
// small link can't expand into gigabytes.
async function inflate(bytes) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error(TOO_LARGE);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

// The workout in the current page's fragment, if any.
export async function workoutFromLocation() {
  const match = location.hash.match(/^#w=(.+)$/);
  return match ? decodeWorkout(match[1]) : null;
}

function toBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
