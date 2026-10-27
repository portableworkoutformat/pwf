// The builder's model. It edits a deliberately small subset of PWF: a list
// of sections, each a block with rounds, a rest between rounds and an
// optional final-rest skip, holding timed or rep-based exercises and rests.
// It has no browser-only code, so tools/check.mjs tests it in Node too.

// A few common exercises. The refs are illustrative: the core registry
// isn't published yet.
export const COMMON_EXERCISES = [
  { name: 'Air squat', ref: 'pwf:air-squat' },
  { name: 'Back squat', ref: 'pwf:back-squat' },
  { name: 'Bear crawl', ref: 'pwf:bear-crawl' },
  { name: 'Bench press', ref: 'pwf:bench-press' },
  { name: 'Box jump', ref: 'pwf:box-jump' },
  { name: 'Burpee', ref: 'pwf:burpee' },
  { name: 'Deadlift', ref: 'pwf:deadlift' },
  { name: 'Dumbbell row', ref: 'pwf:dumbbell-row' },
  { name: 'Dumbbell shoulder press', ref: 'pwf:dumbbell-shoulder-press' },
  { name: 'Glute bridge', ref: 'pwf:glute-bridge' },
  { name: 'Goblet squat', ref: 'pwf:goblet-squat' },
  { name: 'High knees', ref: 'pwf:high-knees' },
  { name: 'Jump rope', ref: 'pwf:jump-rope' },
  { name: 'Jumping jack', ref: 'pwf:jumping-jack' },
  { name: 'Kettlebell swing', ref: 'pwf:kettlebell-swing' },
  { name: 'Mountain climber', ref: 'pwf:mountain-climber' },
  { name: 'Plank', ref: 'pwf:plank' },
  { name: 'Pull-up', ref: 'pwf:pull-up' },
  { name: 'Push-up', ref: 'pwf:push-up' },
  { name: 'Reverse lunge', ref: 'pwf:reverse-lunge' },
  { name: 'Romanian deadlift', ref: 'pwf:romanian-deadlift' },
  { name: 'Row', ref: 'pwf:row' },
  { name: 'Run', ref: 'pwf:run' },
  { name: 'Russian twist', ref: 'pwf:russian-twist' },
  { name: 'Side plank', ref: 'pwf:side-plank' },
  { name: 'Sit-up', ref: 'pwf:sit-up' },
  { name: 'Thruster', ref: 'pwf:thruster' },
  { name: 'Walking lunge', ref: 'pwf:walking-lunge' },
  { name: 'Wall ball', ref: 'pwf:wall-ball' },
];

export class UnsupportedError extends Error {}

export function newExercise() {
  return { kind: 'exercise', name: '', mode: 'time', amount: 40, rest: 20 };
}

// Rest kinds the builder offers, by their PWF names.
export const REST_KINDS = { rest: 'Rest', prepare: 'Get ready', hydrate: 'Water break' };

export function newRest() {
  return { kind: 'rest', restKind: 'rest', seconds: 30 };
}

export function newSection(name = '') {
  return { name, rounds: 1, restBetweenRounds: 0, skipLastRest: false, steps: [newExercise()] };
}

export function newState() {
  return { name: '', description: '', sections: [newSection()] };
}

function findExercise(name) {
  const wanted = name.trim().toLowerCase();
  return COMMON_EXERCISES.find((e) => e.name.toLowerCase() === wanted);
}

// What stops the state from becoming a valid document, in words.
export function problems(state) {
  const list = [];
  if (!state.sections.length) list.push('Add at least one section.');
  state.sections.forEach((section, i) => {
    const label = section.name.trim() || `Section ${i + 1}`;
    if (!section.steps.length) list.push(`${label} has no steps.`);
    if (section.steps.some((s) => s.kind === 'exercise' && !s.name.trim())) {
      list.push(`Every exercise in ${label} needs a name.`);
    }
  });
  return list;
}

export function documentFromState(state) {
  const doc = { pwf: '0.1', name: state.name.trim() || 'Untitled workout' };
  if (state.description.trim()) doc.description = state.description.trim();
  doc.plan = { type: 'block', children: state.sections.map(blockFromSection) };
  return doc;
}

function blockFromSection(section) {
  const block = { type: 'block' };
  if (section.name.trim()) block.name = section.name.trim();
  if (section.rounds > 1) {
    block.rounds = section.rounds;
    if (section.restBetweenRounds > 0) block.restBetweenRounds = { time: section.restBetweenRounds };
  }
  if (section.skipLastRest) block.skipLastRest = true;
  block.children = section.steps.map(nodeFromStep);
  return block;
}

function nodeFromStep(step) {
  if (step.kind === 'rest') {
    const node = { type: 'rest' };
    if (step.restKind !== 'rest') node.kind = step.restKind;
    node.end = { time: step.seconds };
    return node;
  }
  const exercise = { name: step.name.trim() };
  const known = findExercise(step.name);
  if (known) exercise.ref = known.ref;
  const node = {
    type: 'exercise',
    exercise,
    end: step.mode === 'reps' ? { reps: step.amount } : { time: step.amount },
  };
  if (step.rest > 0) node.rest = { time: step.rest };
  return node;
}

// The inverse of documentFromState. Anything outside the builder's subset
// throws UnsupportedError, so the caller can suggest the player instead.
export function stateFromDocument(doc) {
  if (!doc || typeof doc !== 'object' || doc.pwf !== '0.1') {
    throw new UnsupportedError('This isn’t a PWF 0.1 file.');
  }
  const root = doc.plan;
  if (root?.type !== 'block' || !onlyKeys(root, ['type', 'children']) || !Array.isArray(root.children)) {
    throw new UnsupportedError('The builder only edits workouts made of sections.');
  }
  return {
    name: doc.name ?? '',
    description: doc.description ?? '',
    sections: root.children.map((block) => sectionFromBlock(doc, block)),
  };
}

function sectionFromBlock(doc, block) {
  const allowed = ['type', 'name', 'rounds', 'restBetweenRounds', 'skipLastRest', 'children'];
  if (block?.type !== 'block' || !onlyKeys(block, allowed) || !Array.isArray(block.children)) {
    throw new UnsupportedError('The builder only edits sections of exercises and rests.');
  }
  const rounds = block.rounds ?? 1;
  if (!Number.isInteger(rounds)) throw new UnsupportedError('The builder can’t edit "max" rounds.');
  const between = block.restBetweenRounds;
  if (between !== undefined && !isTimeOnly(between)) {
    throw new UnsupportedError('The builder only edits a single timed rest between rounds.');
  }
  return {
    name: block.name ?? '',
    rounds,
    restBetweenRounds: between?.time ?? 0,
    skipLastRest: block.skipLastRest === true,
    steps: block.children.map((node) => stepFromNode(doc, node)),
  };
}

function stepFromNode(doc, node) {
  if (node?.type === 'rest' && onlyKeys(node, ['type', 'kind', 'end']) && isTimeOnly(node.end)) {
    const restKind = node.kind ?? 'rest';
    if (!(restKind in REST_KINDS)) throw new UnsupportedError(`The builder can’t edit "${restKind}" rests.`);
    return { kind: 'rest', restKind, seconds: node.end.time };
  }
  if (node?.type !== 'exercise' || !onlyKeys(node, ['type', 'exercise', 'end', 'rest'])) {
    throw new UnsupportedError('The builder only edits exercises and rests.');
  }
  const exercise = typeof node.exercise === 'string' ? doc.exercises?.[node.exercise] : node.exercise;
  if (!exercise?.name) throw new UnsupportedError('An exercise has no name the builder can find.');
  const end = node.end ?? {};
  let mode;
  let amount;
  if (isTimeOnly(end)) {
    mode = 'time';
    amount = end.time;
  } else if (onlyKeys(end, ['reps']) && Number.isInteger(end.reps)) {
    mode = 'reps';
    amount = end.reps;
  } else {
    throw new UnsupportedError('The builder only edits exercises that end on time or a set number of reps.');
  }
  if (node.rest !== undefined && !isTimeOnly(node.rest)) {
    throw new UnsupportedError('The builder only edits timed rests after an exercise.');
  }
  return { kind: 'exercise', name: exercise.name, mode, amount, rest: node.rest?.time ?? 0 };
}

function onlyKeys(object, allowed) {
  return Object.keys(object).every((k) => allowed.includes(k));
}

function isTimeOnly(end) {
  return end && typeof end === 'object' && onlyKeys(end, ['time']) && Number.isInteger(end.time);
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}
