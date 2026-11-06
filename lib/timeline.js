// Draft PWF v0.1 timeline expander. It turns a valid document into the
// ordered segments one participant sees, following the timing rules in
// SPEC.md section 6. It generates and checks the conformance timelines, and
// the reference library will replace it.
// It has no Node-only imports, so the demo player runs the same code in the
// browser. tools/timeline.mjs is the command-line wrapper.

const MANUAL = Object.freeze({ manual: true });
const MAX_ROUNDS = 1000;
const PRIMARY_LOOP = 'is on the primary lane, which decides when the lanes end, so they would never end. Take it off, or make another lane primary.';

// SPEC.md section 10: one pass of the timeline has at most 100,000 segments
// and lasts at most 24 hours.
export const MAX_SEGMENTS = 100000;
export const MAX_PASS_SECONDS = 86400;

/** A document beyond the limits in SPEC.md section 10. */
export class LimitError extends Error {}

/**
 * A document that breaks a rule only expanding can show, because it depends on
 * how long things last. Any other error from the expander is about what this
 * draft can work out, not about the document.
 */
export class DocumentError extends Error {
  constructor(path, message) {
    super(message);
    this.path = path;
  }
}

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
      return expandParallel(node, path, inherited, iteration);
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
      append(segs, expandNode(child, `${path}/children/${i}`, inh, it));
    });
    let more = r < rounds;
    if (rounds === 'max') {
      const total = knownTotal(segs);
      if (total === null) throw new DocumentError(path, 'has "rounds": "max", so everything in it needs a fixed length. Give each step a "time" end.');
      more = total < fixed;
    }
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
    ...children.map((c, i) => {
      const total = knownTotal(expandNode(c, `${path}/children/${i}`, inherited, iteration));
      if (total === null) throw new DocumentError(`${path}/children/${i}`, 'is a station, so it needs a fixed length. Give each step a "time" end.');
      return total;
    }),
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
    const len = knownTotal(s);
    if (len < longest) {
      s.push(segment({ type: 'rest', from: 'fill', kind: 'rest', cue: 'stay', path: stationPath, end: { time: longest - len }, iteration: it }));
    }
    append(segs, s);

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

// Lanes start together, and the primary lane alone decides when the node ends
// (rule 11). A lane with no fixed length, or one that repeats in a node with
// none, can only be stopped while the workout plays.
function expandParallel(node, path, inherited, iteration) {
  const primary = node.primary ?? 0;
  const lanePath = (i) => `${path}/children/${i}`;
  if (node.children[primary].loop) {
    throw new DocumentError(`${lanePath(primary)}/loop`, PRIMARY_LOOP);
  }
  const main = expandNode(node.children[primary], lanePath(primary), inherited, iteration);
  const length = knownTotal(main);
  if (length > MAX_PASS_SECONDS) throw tooLong();
  const lanes = node.children.map((child, i) => (i === primary
    ? { lane: i, primary: true, segments: main }
    : { lane: i, ...expandLane(child, lanePath(i), inherited, iteration, length) }));
  return [segment({ type: 'parallel', path, length, lanes, iteration })];
}

function expandLane(node, path, inherited, iteration, length) {
  if (!node.loop) {
    const segments = expandNode(node, path, inherited, iteration);
    if (length !== null) cutAt(segments, length);
    return { segments };
  }
  // A lane that is a block has its own rounds under its path, so a repeat of
  // the lane is counted under the path of its "loop" field.
  const pass = (n) => expandNode(node, path, inherited, { ...iteration, [`${path}/loop`]: n });
  const segments = pass(1);
  const passLength = knownTotal(segments);
  if (passLength === 0) {
    throw new DocumentError(path, 'repeats until the primary lane ends, but plays for zero seconds, so it would repeat forever. Give it some length, or take off "loop".');
  }
  if (length !== null && passLength !== null) {
    for (let n = 2; n <= Math.ceil(length / passLength); n++) append(segments, pass(n));
    cutAt(segments, length);
    return { segments };
  }
  if (length !== null) cutAt(segments, length);
  return { loop: true, segments };
}

function segment(fields) {
  made += 1;
  if (made > MAX_SEGMENTS * 2) throw tooManySegments();
  return { ...fields, iteration: fields.iteration ?? {} };
}

function tooManySegments() {
  return new LimitError(`one pass plays more than ${MAX_SEGMENTS.toLocaleString('en')} segments`);
}

function tooLong() {
  return new LimitError('one pass lasts more than 24 hours');
}

// One push per item: a spread of a long list runs out of call stack.
function append(segs, more) {
  for (const s of more) segs.push(s);
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
  if (seg.type === 'parallel') return seg.length;
  return typeof seg.end?.time === 'number' ? seg.end.time : null;
}

// The total length of these segments, or null if any has no fixed length.
function knownTotal(segs) {
  let total = 0;
  for (const s of segs) {
    const d = durationOf(s);
    if (d === null) return null;
    total += d;
  }
  return total;
}

// Rule 7: pad with rest, or cut what runs past the end.
function fitToLength(segs, length, path, iteration) {
  const total = knownTotal(segs);
  if (total === null) throw new Error(`${path}: needs timed content to work out its length`);
  if (total < length) {
    segs.push(segment({ type: 'rest', from: 'fill', kind: 'rest', path, end: { time: length - total }, iteration }));
  } else if (total > length) {
    cutAt(segs, length);
  }
}

// Rule 8: a cap only matters when the content is known to run past it.
function capLength(segs, cap) {
  const total = knownTotal(segs);
  if (total !== null && total > cap) cutAt(segs, cap);
}

// Cuts the list at a length. Past a segment with no fixed length, nothing can
// say where the cut falls, so the rest stays and stops while the workout plays.
function cutAt(segs, length) {
  let t = 0;
  let keep = 0;
  for (const s of segs) {
    if (t >= length) break;
    const d = durationOf(s);
    if (d === null) return;
    if (t + d > length) {
      s.cut = length - t;
      for (const lane of s.lanes ?? []) cutAt(lane.segments, s.cut);
    }
    t += d;
    keep++;
  }
  segs.length = keep;
}

function finalize(segments, doc) {
  const { out, t, known } = place(segments, 0, true);
  if (countSegments(out) > MAX_SEGMENTS) throw tooManySegments();
  if (t > MAX_PASS_SECONDS) throw tooLong();
  const timeline = { pwf: '0.1', totalSeconds: known ? t : null };
  if (doc.loop) timeline.loop = true;
  timeline.segments = out;
  return timeline;
}

// Works out each segment's start and writes it in the timeline's form. A lane's
// segments count from the start of the timeline, like all the others.
function place(segments, from, knownAtStart) {
  let t = from;
  let known = knownAtStart;
  const out = segments.map((s) => {
    const duration = durationOf(s);
    const o = { start: known ? t : null, duration, type: s.type };
    if (s.from) o.from = s.from;
    if (s.kind) o.kind = s.kind;
    if (s.cue) o.cue = s.cue;
    if (s.exercise !== undefined) o.exercise = s.exercise;
    if (s.side) o.side = s.side;
    if (s.phase && s.phase !== 'work') o.phase = s.phase;
    if (s.end) o.end = s.end;
    if (s.cut != null) o.cut = true;
    o.path = s.path;
    if (s.task) o.task = s.task;
    if (Object.keys(s.iteration).length) o.iteration = s.iteration;
    if (s.lanes) {
      o.lanes = s.lanes.map(({ segments: list, ...lane }) => ({ ...lane, segments: place(list, t, known).out }));
    }
    if (duration === null) known = false;
    else t += duration;
    return o;
  });
  return { out, t, known };
}

function countSegments(segments) {
  let count = segments.length;
  for (const s of segments) {
    for (const lane of s.lanes ?? []) count += countSegments(lane.segments);
  }
  return count;
}

/**
 * What one person sees following one lane, as one ordered list. `lane` is a
 * lane number, or null for the primary lane; a node without that lane plays its
 * primary lane. When the lane finishes before the node ends, a segment of type
 * "wait" covers the time left, which isn't known if `duration` is null. Lanes
 * that repeat with no fixed length show one pass. The timeline format has no
 * "wait": it exists only for a player that follows one lane at a time.
 */
export function followLane(segments, lane = null) {
  const out = [];
  for (const s of segments) {
    if (s.type !== 'parallel') {
      out.push(s);
      continue;
    }
    const chosen = s.lanes.find((l) => l.lane === lane) ?? s.lanes.find((l) => l.primary);
    append(out, followLane(chosen.segments, lane));
    if (chosen.primary) continue;
    const played = chosen.loop || chosen.segments.some((seg) => seg.duration === null)
      ? null
      : chosen.segments.reduce((sum, seg) => sum + seg.duration, 0);
    const left = s.duration === null || played === null ? null : s.duration - played;
    if (left === 0) continue;
    const wait = { start: left === null || s.start === null ? null : s.start + played, duration: left, type: 'wait', path: s.path };
    if (s.iteration) wait.iteration = s.iteration;
    out.push(wait);
  }
  return out;
}
