// Puts a workout in a URL fragment, so the builder can hand it to the player
// and anyone can share a link. Fragments never reach a server.

const MAX_BYTES = 1024 * 1024; // SPEC.md section 10: 1 MiB per document

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
  let bytes = fromBase64Url(data);
  if (kind === 'z.') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else if (kind !== 'j.') {
    throw new Error('This link doesn’t hold a workout.');
  }
  if (bytes.length > MAX_BYTES) throw new Error('This workout is larger than PWF allows.');
  return JSON.parse(new TextDecoder().decode(bytes));
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
