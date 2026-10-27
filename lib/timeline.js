// Draft PWF v0.1 timeline expander. It turns a valid document into the
// ordered segments one participant sees, following the timing rules in
// SPEC.md section 6. It generates and checks the conformance timelines, and
// the reference library will replace it. Parallel lanes are not supported yet.
// It has no Node-only imports, so the demo player runs the same code in the
// browser. tools/timeline.mjs is the command-line wrapper.

const MANUAL = Object.freeze({ manual: true });
const MAX_ROUNDS = 1000;

// SPEC.md section 10: one pass of the timeline has at most 100,000 segments
// and lasts at most 24 hours.
export const MAX_SEGMENTS = 100000;
export const MAX_PASS_SECONDS = 86400;

/** A document beyond the limits in SPEC.md section 10. */
export class LimitError extends Error {}

// Segments made so far in this expansion. Some are dropped later (trailing
// rests), so expansion stops at twice the limit: enough for any document
// within it, and early enough that a huge document can't run away.
let made = 0;

export function expandTimeline(doc) {
  made = 0;
  const segments = expandNode(doc.plan, '/plan', {}, {});
  return finalize(segments, doc);
}

function expandNode(node, path, inherited, iteration) {
  switch (node.type) {
    case 'exercise':
      return expandExercise(node, path, inherited, iteration);
    case 'work':
      return [segment({ type: 'work', path, end: node.end ?? MANUAL, phase: node.phase, iteration })];
    case 'rest':
      return [segment({ type: 'rest', from: 'node', kind: node.kind ?? 'rest', path, end: node.end ?? MANUAL, iteration })];
    case 'note':
      return [segment({ type: 'note', path, end: node.end ?? MANUAL, iteration })];
    case 'block':
      return expandBlock(node, path, inherited, iteration);
    case 'task':
      return expandTask(node, path, iteration);
    case 'stations':
      return expandStations(node, path, inherited, iteration);
    case 'parallel':
      throw new Error(`${path}: parallel lanes are not supported by this draft expander`);
    default:
      throw new Error(`${path}: unknown node type ${node.type}`);
  }
}

// Sets and sides expand here. `rest` follows every set, including the last,
// unless the step sets skipLastRest (rules 3, 4 and 6).
function expandExercise(node, path, inherited, iteration) {
  const end = node.end ?? inherited.end ?? MANUAL;
  const rest = node.rest ?? inherited.rest;
  const sets = node.sets ?? inherited.sets ?? 1;
  const side = node.side ?? inherited.side ?? 'both';
  const setList = typeof sets === 'number' ? Array.from({ length: sets }, () => ({})) : sets;
  const sides = side === 'each' ? ['left', 'right'] : [side];
  const exercise = typeof node.exercise === 'string' ? node.exercise : { name: node.exercise.name };

  const segs = [];
  setList.forEach((override, i) => {
    const it = setList.length > 1 ? { ...iteration, [path]: i + 1 } : iteration;
    for (const s of sides) {
      segs.push(segment({
        type: 'exercise',
        exercise,
        side: s === 'both' ? undefined : s,
        phase: node.phase,
        path,
        end: override.end ?? end,
        iteration: it,
      }));
    }
    const setRest = override.rest ?? rest;
    if (setRest) segs.push(restSegment(setRest, 'rest', path, it));
  });
  if (node.skipLastRest) dropTrailingRest(segs);
  return segs;
}

// Rounds, rests between rounds, skipLastRest and fixed lengths (rules 5-8).
function expandBlock(node, path, inherited, iteration) {
  const inh = node.defaults ? { ...inherited, ...node.defaults } : inherited;
  const rounds = node.rounds ?? 1;
  const repeating = rounds === 'max' || rounds > 1;
  const between = asList(node.restBetweenRounds);
  const fixed = node.end?.time;

  const segs = [];
  for (let r = 1; ; r++) {
    if (r > MAX_ROUNDS) throw new Error(`${path}: more than ${MAX_ROUNDS} rounds`);
    const it = repeating ? { ...iteration, [path]: r } : iteration;
    node.children.forEach((child, i) => {
      segs.push(...expandNode(child, `${path}/children/${i}`, inh, it));
    });
    const more = rounds === 'max' ? knownTotal(segs, path) < fixed : r < rounds;
    if (!more) break;
    if (between.length) {
      placeRest(segs, restSegment(between[(r - 1) % between.length], 'restBetweenRounds', path, it));
    }
  }

  if (node.skipLastRest) dropTrailingRest(segs);
  if (fixed != null) fitToLength(segs, fixed, path, iteration);
  else if (node.timeCap != null) capLength(segs, node.timeCap);
  return segs;
}

// A task is one self-paced segment, unless a clock drives it (rule 9).
function expandTask(node, path, iteration) {
  if (node.clock) {
    const segs = expandNode(node.clock, `${path}/clock`, {}, iteration);
    for (const s of segs) s.task = path;
    return segs;
  }
  let end = node.end ?? MANUAL;
  if (!node.end && node.timeCap != null) end = { manual: true, timeCap: node.timeCap };
  return [segment({ type: 'task', path, end, iteration })];
}

// One participant's path through rotating stations, starting at the first
// (rule 10). Every station period lasts as long as the longest station.
function expandStations(node, path, inherited, iteration) {
  const children = node.children;
  const rotations = node.rotations ?? 1;
  const transitions = asList(node.transition);
  const cue = children.some((c) => c.type === 'stations') ? 'move-zone' : 'move';
  const longest = Math.max(
    ...children.map((c, i) => knownTotal(expandNode(c, `${path}/children/${i}`, inherited, iteration), path)),
  );

  const segs = [];
  const periods = rotations * children.length;
  for (let p = 0; p < periods; p++) {
    const r = Math.floor(p / children.length) + 1;
    const i = p % children.length;
    const it = rotations > 1 ? { ...iteration, [path]: r } : iteration;
    const stationPath = `${path}/children/${i}`;
    const s = expandNode(children[i], stationPath, inherited, it);
    for (const seg of s) if (seg.type === 'rest' && !seg.cue) seg.cue = 'stay';
    const len = knownTotal(s, path);
    if (len < longest) {
      s.push(segment({ type: 'rest', from: 'fill', kind: 'rest', cue: 'stay', path: stationPath, end: { time: longest - len }, iteration: it }));
    }
    segs.push(...s);

    if (p < periods - 1) {
      if (transitions.length) {
        const move = restSegment(transitions[p % transitions.length], 'transition', path, it);
        move.cue = cue;
        placeRest(segs, move);
      } else if (segs.at(-1)?.type === 'rest') {
        segs.at(-1).cue = cue;
      }
    }
  }
  if (node.skipLastRest) dropTrailingRest(segs);
  return segs;
}

function segment(fields) {
  made += 1;
  if (made > MAX_SEGMENTS * 2) throw tooManySegments();
  return { ...fields, iteration: fields.iteration ?? {} };
}

function tooManySegments() {
  return new LimitError(`one pass plays more than ${MAX_SEGMENTS.toLocaleString('en')} segments`);
}

// A transition's kind defaults to "transition"; every other rest's to "rest".
function restSegment(spec, from, path, iteration) {
  const { kind, ...end } = spec;
  const fallback = from === 'transition' ? 'transition' : 'rest';
  return segment({ type: 'rest', from, kind: kind ?? fallback, path, end, iteration });
}

function asList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

// A rest that ends the round (or station) is replaced; otherwise the new rest
// is appended.
function placeRest(segs, rest) {
  if (segs.at(-1)?.type === 'rest') segs[segs.length - 1] = rest;
  else segs.push(rest);
}

function dropTrailingRest(segs) {
  if (segs.at(-1)?.type === 'rest') segs.pop();
}

function durationOf(seg) {
  if (seg.cut != null) return seg.cut;
  return typeof seg.end?.time === 'number' ? seg.end.time : null;
}

function knownTotal(segs, path) {
  let total = 0;
  for (const s of segs) {
    const d = durationOf(s);
    if (d == null) throw new Error(`${path}: needs timed content to work out its length`);
    total += d;
  }
  return total;
}

// Rule 7: pad with rest, or cut what runs past the end.
function fitToLength(segs, length, path, iteration) {
  const total = knownTotal(segs, path);
  if (total < length) {
    segs.push(segment({ type: 'rest', from: 'fill', kind: 'rest', path, end: { time: length - total }, iteration }));
  } else if (total > length) {
    cutAt(segs, length);
  }
}

// Rule 8: a cap only matters when the content is known to run past it.
function capLength(segs, cap) {
  let total = 0;
  for (const s of segs) {
    const d = durationOf(s);
    if (d == null) return;
    total += d;
  }
  if (total > cap) cutAt(segs, cap);
}

function cutAt(segs, length) {
  let t = 0;
  let keep = 0;
  for (const s of segs) {
    if (t >= length) break;
    const d = durationOf(s);
    if (t + d > length) s.cut = length - t;
    t += d;
    keep++;
  }
  segs.length = keep;
}

function finalize(segments, doc) {
  let t = 0;
  let known = true;
  const out = segments.map((s) => {
    const duration = durationOf(s);
    const o = { start: known ? t : null, duration, type: s.type };
    if (s.from) o.from = s.from;
    if (s.kind) o.kind = s.kind;
    if (s.cue) o.cue = s.cue;
    if (s.exercise !== undefined) o.exercise = s.exercise;
    if (s.side) o.side = s.side;
    if (s.phase && s.phase !== 'work') o.phase = s.phase;
    o.end = s.end;
    if (s.cut != null) o.cut = true;
    o.path = s.path;
    if (s.task) o.task = s.task;
    if (Object.keys(s.iteration).length) o.iteration = s.iteration;
    if (duration == null) known = false;
    else t += duration;
    return o;
  });
  if (out.length > MAX_SEGMENTS) throw tooManySegments();
  if (t > MAX_PASS_SECONDS) throw new LimitError('one pass lasts more than 24 hours');
  const timeline = { pwf: '0.1', totalSeconds: known ? t : null };
  if (doc.loop) timeline.loop = true;
  timeline.segments = out;
  return timeline;
}
