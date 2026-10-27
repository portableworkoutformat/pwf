import { expandTimeline } from '../lib/timeline.js';
import { describeProblems, validateDocument } from '../lib/validate.js';
import { assistantButtons, changePrompt, copyText, fixPrompt } from './ai.js';
import { formatDuration, stateFromDocument } from './model.js';
import { MAX_BYTES, checkSize, encodeWorkout, workoutFromLocation } from './share.js';

const EXAMPLES = [
  ['Tabata', 'examples/tabata.pwf.json'],
  ['Bodyweight circuit', 'examples/circuit.pwf.json'],
  ['Upper-body strength', 'examples/strength.pwf.json'],
  ['AMRAP, EMOM and For Time', '../conformance/cases/008-tasks.pwf.json'],
  ['Two-zone group class', '../conformance/cases/011-stations-two-zones.pwf.json'],
];
const FORMAT_LABELS = {
  amrap: 'AMRAP', emom: 'EMOM', 'for-time': 'For time', tabata: 'Tabata', timebox: 'Timebox',
  circuit: 'Circuit', superset: 'Superset', intervals: 'Intervals', chipper: 'Chipper',
};
const CONTAINERS = ['block', 'task', 'stations', 'parallel'];
const $ = (id) => document.getElementById(id);

let doc = null;
let timeline = null;
let run = null;
let muted = false;
let audio = null;
let wakeLock = null;
let problems = '';
let toastTimer = null;

// A workout that fails validation, with its problems in plain words.
class InvalidWorkout extends Error {
  constructor(found) {
    super(found.length === 1 ? 'This workout has a problem:' : `This workout has ${found.length} problems:`);
    this.problems = found;
  }
}

init();

async function init() {
  for (const [label, url] of EXAMPLES) {
    const button = el('button', { type: 'button' }, label);
    button.addEventListener('click', () => loadFrom(async () => (await fetch(url)).json()));
    $('examples').append(button);
  }
  wireEvents();
  try {
    const linked = await workoutFromLocation();
    if (linked) {
      openDocument(linked);
      return;
    }
  } catch (error) {
    showLoadError(error);
  }
  show('load-screen');
}

async function loadFrom(read) {
  try {
    openDocument(await read());
    // The full path, because /play/ sets <base> to the demo folder.
    history.replaceState(null, '', `${location.pathname}#w=${await encodeWorkout(doc)}`);
  } catch (error) {
    showLoadError(error instanceof SyntaxError ? new Error(`That isn’t valid JSON: ${error.message}`) : error);
  }
}

// Reads pasted text, allowing for the code fences chat apps copy along with it.
function parseWorkout(text) {
  checkSize(text);
  return JSON.parse(text.trim().replace(/^```[a-z]*\s*/i, '').replace(/```$/, ''));
}

// Checks a document enough to play it, then shows its overview.
function openDocument(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || !('pwf' in candidate)) {
    throw new Error('That isn’t a PWF document: it has no "pwf" version.');
  }
  if (candidate.pwf !== '0.1') throw new Error(`This player reads PWF 0.1, and this file is version ${candidate.pwf}.`);
  const checked = validateDocument(candidate);
  if (!checked.valid) throw new InvalidWorkout(checked.problems);
  let expanded;
  try {
    expanded = expandTimeline(candidate);
  } catch (error) {
    const reason = error.message.replace(/^\/\S*: /, '');
    throw new Error(`The player can’t play this workout (${reason}).`);
  }
  if (!expanded.segments.length) throw new Error('This workout has nothing to play.');
  doc = candidate;
  timeline = expanded;
  $('load-error').classList.add('hidden');
  renderOverview();
  show('overview');
}

function renderOverview() {
  const kicker = [doc.activity, doc.level, doc.mode === 'group' ? 'group workout' : null].filter(Boolean);
  $('ov-kicker').textContent = kicker.join(' · ');
  $('ov-name').textContent = doc.name;
  $('ov-description').textContent = doc.description ?? '';
  const { segments, totalSeconds } = timeline;
  const timed = segments.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  const open = segments.filter((s) => s.duration === null).length;
  $('ov-total').textContent = formatDuration(totalSeconds ?? timed);
  $('ov-total-note').textContent = open
    ? `plus ${open} ${open === 1 ? 'step' : 'steps'} at your own pace`
    : `${segments.length} steps`;
  $('ov-group').textContent = 'This is a group workout. The player follows one person’s path, starting at the first station.';
  $('ov-group').classList.toggle('hidden', doc.mode !== 'group');

  const equipment = Object.values(doc.equipment ?? {}).map((e) => e.name);
  $('ov-equipment').textContent = equipment.join(', ');
  $('ov-equipment-box').classList.toggle('hidden', equipment.length === 0);

  const counts = new Map();
  for (const segment of segments) {
    const task = segment.type === 'task' ? nodeAt(segment.path)
      : segment.type === 'work' && segment.task ? nodeAt(segment.task) : null;
    const names = segment.type === 'exercise' ? [exerciseName(segment.exercise)]
      : task ? taskItems(task).filter((item) => item.name !== 'Rest').map((item) => item.name) : [];
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const copyPrompt = el('button', { type: 'button' }, 'Copy prompt');
  copyPrompt.addEventListener('click', async () => {
    notify(await copyText(changePrompt(doc)) ? 'Copied. Paste it into any AI assistant.' : 'Your browser didn’t allow copying.');
  });
  $('ai-buttons').replaceChildren(...assistantButtons(() => changePrompt(doc), notify), copyPrompt);

  $('ov-exercises').replaceChildren(...[...counts].map(([name, n]) => el('li', {}, n > 1 ? `${name} × ${n}` : name)));

  try {
    stateFromDocument(doc);
    encodeWorkout(doc).then((code) => { $('edit').href = `build.html#w=${code}`; });
    $('edit').classList.remove('hidden');
  } catch {
    $('edit').classList.add('hidden');
  }
}

// Playback

function start() {
  run = { index: 0, segmentStart: 0, pausedAt: null, pausedInSegment: 0, workoutStart: performance.now(), pausedTotal: 0, lastCount: null, timer: null };
  ensureAudio();
  keepAwake();
  show('run');
  goTo(0);
  run.timer = setInterval(tick, 200);
}

function goTo(index, carryMs = 0) {
  if (index >= timeline.segments.length) {
    finish();
    return;
  }
  run.index = Math.max(0, index);
  const now = performance.now();
  run.segmentStart = now - carryMs;
  run.pausedInSegment = 0;
  if (run.pausedAt !== null) run.pausedAt = now;
  run.lastCount = null;
  renderSegment();
  tick();
}

function tick() {
  if (!run) return;
  const segment = timeline.segments[run.index];
  const now = run.pausedAt ?? performance.now();
  const elapsed = (now - run.segmentStart - run.pausedInSegment) / 1000;
  // Timed segments count down. Everything else counts up (rule 9), and a
  // time cap ends it early.
  const limit = segment.duration ?? segment.end?.timeCap ?? null;
  const remaining = limit === null ? null : limit - elapsed;
  if (remaining !== null && remaining <= 0 && run.pausedAt === null) {
    beep(990, 0.25);
    goTo(run.index + 1, (elapsed - limit) * 1000);
    return;
  }
  if (segment.duration !== null) {
    const count = Math.ceil(remaining);
    if (count !== run.lastCount && count >= 1 && count <= 3 && run.lastCount !== null) beep(660, 0.1);
    run.lastCount = count;
    $('run-timer').textContent = formatDuration(Math.max(0, count));
  } else {
    $('run-timer').textContent = formatDuration(elapsed);
  }

  const workoutElapsed = ((run.pausedAt ?? performance.now()) - run.workoutStart - run.pausedTotal) / 1000;
  const total = timeline.totalSeconds;
  $('run-clock').textContent = total === null
    ? formatDuration(workoutElapsed)
    : `${formatDuration(workoutElapsed)} / ${formatDuration(total)}`;
  const progress = total
    ? ((segment.start ?? 0) + Math.min(elapsed, segment.duration ?? 0)) / total
    : run.index / timeline.segments.length;
  $('run-progress').style.width = `${Math.min(100, progress * 100)}%`;
}

function renderSegment() {
  const segment = timeline.segments[run.index];
  const view = describe(segment);
  $('run').dataset.tone = view.tone;
  $('run-title').textContent = doc.name;
  $('run-kicker').textContent = view.kicker.toLowerCase() === view.name.toLowerCase() ? '' : view.kicker;
  $('run-name').textContent = view.name;
  $('run-goal').textContent = view.goal ?? '';
  $('run-details').textContent = view.details ?? '';
  $('run-task').replaceChildren(...(view.items ?? []).map((item) => el('li', {}, `${item.amount}  ${item.name}`.trim())));
  $('run-timer').classList.toggle('small-timer', segment.duration === null);
  $('done').classList.toggle('hidden', segment.duration !== null);
  const next = timeline.segments[run.index + 1];
  $('run-next').replaceChildren(...(next
    ? ['Up next: ', el('strong', {}, describe(next).name), next.duration !== null ? ` · ${formatDuration(next.duration)}` : '']
    : ['Last step']));
}

function togglePause() {
  if (!run) return;
  const now = performance.now();
  if (run.pausedAt === null) {
    run.pausedAt = now;
    $('pause').textContent = '▶ Resume';
  } else {
    run.pausedInSegment += now - run.pausedAt;
    run.pausedTotal += now - run.pausedAt;
    run.pausedAt = null;
    $('pause').textContent = '⏸ Pause';
    keepAwake();
  }
  tick();
}

function back() {
  const elapsed = ((run.pausedAt ?? performance.now()) - run.segmentStart - run.pausedInSegment) / 1000;
  goTo(elapsed > 3 ? run.index : run.index - 1);
}

function stop() {
  if (run) clearInterval(run.timer);
  run = null;
  releaseWakeLock();
  $('pause').textContent = '⏸ Pause';
}

function finish() {
  const elapsed = (performance.now() - run.workoutStart - run.pausedTotal) / 1000;
  stop();
  beep(1320, 0.4);
  $('fin-name').textContent = doc.name;
  $('fin-time').textContent = formatDuration(elapsed);
  show('finished');
}

// Turning segments into words

function describe(segment) {
  const node = nodeAt(segment.path);
  const context = contextFor(segment);
  switch (segment.type) {
    case 'exercise': {
      const setIndex = segment.iteration?.[segment.path];
      const override = Array.isArray(node.sets) && setIndex ? node.sets[setIndex - 1] : null;
      const side = { left: 'Left side', right: 'Right side', alternating: 'Alternate sides' }[segment.side];
      return {
        tone: segment.phase === 'recovery' ? 'rest' : segment.phase ? 'prepare' : 'work',
        kicker: [node.label, ...context, side].filter(Boolean).join(' · '),
        name: exerciseName(segment.exercise),
        goal: segment.duration === null ? endText(segment.end) : null,
        details: [targetText(override?.target ?? node.target), node.notes].filter(Boolean).join('\n'),
      };
    }
    case 'work': {
      const task = segment.task ? nodeAt(segment.task) : null;
      return {
        tone: segment.phase === 'recovery' ? 'rest' : segment.phase ? 'prepare' : 'work',
        kicker: context.join(' · '),
        name: task ? taskName(task, segment.task) : node.label ?? 'Work',
        goal: segment.duration === null ? endText(segment.end) : null,
        items: task ? taskItems(task) : [],
      };
    }
    case 'rest':
      return {
        tone: segment.kind === 'prepare' ? 'prepare' : 'rest',
        kicker: context.join(' · '),
        name: restName(segment),
        goal: segment.duration === null ? endText(segment.end) : null,
        details: restDetails(segment),
        items: segment.task ? taskItems(nodeAt(segment.task)) : [],
      };
    case 'note':
      return { tone: 'note', kicker: context.join(' · '), name: node.name ?? 'Note', details: node.text ?? '' };
    case 'task': {
      const rounds = node.rounds === 'max' ? 'As many rounds as you can'
        : node.rounds > 1 ? `${node.rounds} rounds` : null;
      const cap = segment.end?.timeCap ? `Time cap ${formatDuration(segment.end.timeCap)}` : null;
      return {
        tone: 'work',
        kicker: context.join(' · '),
        name: taskName(node, segment.path),
        goal: rounds,
        details: [cap, segment.duration === null ? 'Tap Done when you finish.' : null].filter(Boolean).join('\n'),
        items: taskItems(node),
      };
    }
    default:
      return { tone: 'work', kicker: '', name: segment.type };
  }
}

// Names of the sections and stations around the segment, then round, set and
// rotation counts. A step's own name is its title, except on an exercise
// step, where it names a station.
function contextFor(segment) {
  const parts = [];
  const steps = segment.path.split('/').slice(1);
  for (let i = 1; i <= steps.length; i++) {
    const path = `/${steps.slice(0, i).join('/')}`;
    const node = nodeAt(path);
    if (!node?.type || !node.name || path === segment.task) continue;
    const own = i === steps.length;
    if (own && (segment.type === 'task' || (node.type !== 'exercise' && !CONTAINERS.includes(node.type)))) continue;
    parts.push(node.name);
  }
  for (const [path, n] of Object.entries(segment.iteration ?? {})) {
    const node = nodeAt(path);
    if (node.type === 'exercise') {
      const total = Array.isArray(node.sets) ? node.sets.length : node.sets;
      parts.push(`Set ${n} of ${total}`);
    } else if (node.type === 'stations') {
      parts.push(`Rotation ${n} of ${node.rotations}`);
    } else {
      parts.push(node.rounds === 'max' ? `Round ${n}` : `Round ${n} of ${node.rounds}`);
    }
  }
  return parts;
}

function restName(segment) {
  if (segment.kind === 'prepare') return 'Get ready';
  if (segment.kind === 'hydrate') return 'Water break';
  if (segment.kind === 'recovery') return 'Recover';
  if (segment.cue === 'move-zone') return 'Move to the next zone';
  if (segment.cue === 'move' || segment.kind === 'transition') return 'Move to the next station';
  if (segment.from === 'restBetweenRounds') return 'Rest between rounds';
  return 'Rest';
}

function restDetails(segment) {
  if (segment.cue === 'stay') return 'Stay at your station.';
  if (segment.kind !== 'hydrate') return null;
  if (segment.cue === 'move-zone') return 'Then move to the next zone.';
  if (segment.cue === 'move') return 'Then move to the next station.';
  return null;
}

// A task's name, or the label of the nearest workout format around it, such as
// EMOM for the tasks inside an EMOM block.
function taskName(task, path) {
  if (task.name) return task.name;
  const steps = path.split('/').slice(1);
  for (let i = steps.length; i >= 1; i--) {
    const label = FORMAT_LABELS[nodeAt(`/${steps.slice(0, i).join('/')}`)?.format];
    if (label) return label;
  }
  return 'Work through the list';
}

function taskItems(task) {
  return (task.children ?? []).map((child) => ({
    name: child.type === 'exercise' ? exerciseName(child.exercise) : child.type === 'rest' ? 'Rest' : child.name ?? child.type,
    amount: child.end ? endText(child.end) : '',
  }));
}

function exerciseName(exercise) {
  if (typeof exercise === 'string') return doc.exercises?.[exercise]?.name ?? exercise;
  return exercise?.name ?? 'Exercise';
}

function endText(end) {
  if (!end) return 'At your own pace';
  if (end.reps !== undefined) {
    if (end.reps === 'max') return 'Max reps';
    return typeof end.reps === 'object' ? `${end.reps.min}–${end.reps.max} reps` : `${end.reps} reps`;
  }
  if (end.distance) return `${end.distance.value} ${end.distance.unit}`;
  if (end.calories !== undefined) return `${end.calories} cal`;
  if (end.heartRateBelow !== undefined) return `Until heart rate is under ${end.heartRateBelow} bpm`;
  if (end.time !== undefined) return formatDuration(end.time);
  return 'At your own pace';
}

function targetText(target) {
  if (!target) return '';
  const parts = [];
  const range = (v, unit = '') => (typeof v === 'object' ? `${v.min}–${v.max}${unit}` : `${v}${unit}`);
  if (target.reps !== undefined) parts.push(`Aim for ${range(target.reps)} reps`);
  if (target.load?.unit) parts.push(range(target.load.value, ` ${target.load.unit}`));
  if (target.load?.percent1RM !== undefined) parts.push(`${range(target.load.percent1RM, '%')} of 1RM`);
  if (target.load?.bodyweight) parts.push('Bodyweight');
  if (target.rpe !== undefined) parts.push(`RPE ${range(target.rpe)}`);
  if (target.rir !== undefined) parts.push(`${range(target.rir)} reps in reserve`);
  if (target.tempo) parts.push(`Tempo ${target.tempo}`);
  if (target.heartRate?.zone !== undefined) parts.push(`Heart rate zone ${range(target.heartRate.zone)}`);
  return parts.join(' · ');
}

function nodeAt(path) {
  let node = doc;
  for (const part of path.split('/').slice(1)) node = node?.[part];
  return node;
}

// Sound and screen

function ensureAudio() {
  try {
    audio ??= new AudioContext();
    audio.resume();
  } catch {
    audio = null;
  }
}

function beep(frequency, seconds) {
  if (muted || !audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.2, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + seconds);
}

async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

// Screens and events

function show(id) {
  for (const screen of ['load-screen', 'overview', 'run', 'finished']) $(screen).classList.toggle('hidden', screen !== id);
  $('header').classList.toggle('hidden', id === 'run');
}

function showLoadError(error) {
  $('load-error-text').textContent = error.message;
  const found = error.problems ?? [];
  $('load-problems').replaceChildren(...found.map((p) => el('li', {}, el('code', {}, p.path || '(document)'), ` ${p.message}`)));
  problems = found.length ? describeProblems(found) : error.message;
  $('copy-problems').classList.remove('hidden');
  $('load-error').classList.remove('hidden');
  show('load-screen');
}

async function readFile(file) {
  if (file.size > MAX_BYTES) throw new Error('This file is larger than PWF allows (1 MiB).');
  return parseWorkout(await file.text());
}

function notify(text) {
  $('toast').textContent = text;
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 5000);
}

function saveFile() {
  const blob = new Blob([`${JSON.stringify(doc, null, 2)}\n`], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `${slug(doc.name)}.pwf.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function slug(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workout';
}

function openAnother() {
  stop();
  history.replaceState(null, '', location.pathname);
  show('load-screen');
}

function wireEvents() {
  $('choose').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) loadFrom(() => readFile(file));
  });
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (file) loadFrom(() => readFile(file));
  });
  $('paste-load').addEventListener('click', () => loadFrom(async () => parseWorkout($('paste').value)));
  $('paste-clipboard').addEventListener('click', async () => {
    try {
      $('paste').value = await navigator.clipboard.readText();
    } catch {
      notify('Your browser didn’t allow reading the clipboard. Paste into the box instead.');
      return;
    }
    loadFrom(async () => parseWorkout($('paste').value));
  });
  $('copy-problems').addEventListener('click', async () => {
    notify(await copyText(fixPrompt(problems)) ? 'Copied. Paste it into your AI chat.' : 'Your browser didn’t allow copying.');
  });
  $('save').addEventListener('click', saveFile);
  $('copy-json').addEventListener('click', async () => {
    notify(await copyText(JSON.stringify(doc, null, 2)) ? 'JSON copied.' : 'Your browser didn’t allow copying.');
  });

  $('start').addEventListener('click', start);
  $('load-another').addEventListener('click', openAnother);
  $('fin-another').addEventListener('click', openAnother);
  $('again').addEventListener('click', start);
  $('pause').addEventListener('click', togglePause);
  $('skip').addEventListener('click', () => goTo(run.index + 1));
  $('back').addEventListener('click', back);
  $('done').addEventListener('click', () => goTo(run.index + 1));
  $('exit').addEventListener('click', () => {
    if (!confirm('Stop this workout?')) return;
    stop();
    show('overview');
  });
  $('mute').addEventListener('click', (e) => {
    muted = !muted;
    e.currentTarget.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
    e.currentTarget.setAttribute('aria-pressed', String(muted));
  });

  // Clicked controls give up focus, so Space and Enter keep meaning pause and
  // done rather than pressing the last button again.
  for (const button of document.querySelectorAll('.controls button, #done')) {
    button.addEventListener('click', () => button.blur());
  }
  document.addEventListener('keydown', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!run || target?.closest('input, textarea, select')) return;
    if (target?.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'ArrowRight') goTo(run.index + 1);
    else if (e.key === 'ArrowLeft') back();
    else if (e.key === 'Enter' && timeline.segments[run.index].duration === null) goTo(run.index + 1);
  });
  // Following another workout link while the player is open only changes the
  // fragment, so load it here. replaceState in loadFrom doesn't fire this.
  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#w=')) return;
    if (run) stop();
    loadFrom(async () => (await workoutFromLocation()) ?? Promise.reject(new Error('This link doesn’t hold a workout.')));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && run && run.pausedAt === null) keepAwake();
  });
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}
