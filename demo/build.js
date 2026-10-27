import { expandTimeline } from '../lib/timeline.js';
import {
  COMMON_EXERCISES,
  REST_KINDS,
  UnsupportedError,
  documentFromState,
  formatDuration,
  newExercise,
  newRest,
  newSection,
  newState,
  problems,
  stateFromDocument,
} from './model.js';
import { MAX_BYTES, encodeWorkout, workoutFromLocation } from './share.js';

const DRAFT_KEY = 'pwf-demo-builder';
const TEMPLATES = { tabata: 'Tabata', circuit: 'Bodyweight circuit', strength: 'Upper-body strength' };
const $ = (id) => document.getElementById(id);

let state = newState();

init();

async function init() {
  $('exercise-names').append(...COMMON_EXERCISES.map((e) => new Option(e.name)));
  for (const [file, label] of Object.entries(TEMPLATES)) $('template').append(new Option(label, file));
  wireEvents();
  try {
    const linked = await workoutFromLocation();
    if (linked) {
      history.replaceState(null, '', location.pathname);
      await load(linked);
    } else {
      state = loadDraft() ?? newState();
    }
  } catch (error) {
    showMessage(error.message, true);
    state = loadDraft() ?? newState();
  }
  render();
}

// Loads a document into the builder, or explains why it can't.
async function load(doc) {
  try {
    state = stateFromDocument(doc);
    hideMessage();
    return true;
  } catch (error) {
    if (!(error instanceof UnsupportedError)) throw error;
    const link = el('a', { href: `play.html#w=${await encodeWorkout(doc)}` }, 'Play it in the player instead');
    showMessage(`The builder can’t edit this workout. ${error.message} `, true, link);
    return false;
  }
}

function render() {
  $('name').value = state.name;
  $('description').value = state.description;
  renderSections();
  update();
}

function renderSections() {
  $('sections').replaceChildren(...state.sections.map(sectionCard));
}

function sectionCard(section, si) {
  const id = (name) => `s${si}-${name}`;
  return el('section', { class: 'card', 'data-section': si },
    el('div', { class: 'row', style: 'justify-content: space-between; margin-bottom: 0.6rem' },
      el('h2', { style: 'margin: 0' }, `Section ${si + 1}`),
      el('div', { class: 'section-actions' },
        iconButton('↑', 'section-up', 'Move section up', si === 0),
        iconButton('↓', 'section-down', 'Move section down', si === state.sections.length - 1),
        iconButton('⧉', 'section-copy', 'Duplicate section'),
        iconButton('✕', 'section-remove', 'Remove section', false, 'danger'))),
    el('div', { class: 'section-head' },
      field(id('name'), 'Name', input(id('name'), { value: section.name, 'data-field': 'name', placeholder: 'e.g. Circuit A', maxlength: 200 })),
      field(id('rounds'), 'Rounds', input(id('rounds'), { type: 'number', min: 1, max: 100, value: section.rounds, 'data-field': 'rounds' })),
      field(id('between'), 'Rest between rounds (s)', input(id('between'), {
        type: 'number', min: 0, max: 3600, value: section.restBetweenRounds, 'data-field': 'restBetweenRounds',
        disabled: section.rounds < 2,
      })),
      el('label', { class: 'checkbox' },
        el('input', { type: 'checkbox', 'data-field': 'skipLastRest', checked: section.skipLastRest }),
        'Skip final rest')),
    el('ol', { class: 'steps' }, ...section.steps.map((step, ti) => stepRow(step, si, ti, section.steps.length))),
    el('div', { class: 'row' },
      el('button', { type: 'button', 'data-action': 'add-exercise' }, '+ Exercise'),
      el('button', { type: 'button', 'data-action': 'add-rest' }, '+ Rest')));
}

function stepRow(step, si, ti, count) {
  const id = (name) => `s${si}-t${ti}-${name}`;
  const actions = el('div', { class: 'step-actions' },
    iconButton('↑', 'step-up', 'Move step up', ti === 0),
    iconButton('↓', 'step-down', 'Move step down', ti === count - 1),
    iconButton('✕', 'step-remove', 'Remove step', false, 'danger'));
  if (step.kind === 'rest') {
    return el('li', { class: 'step rest', 'data-step': ti },
      field(id('kind'), 'Rest', el('select', { id: id('kind'), 'data-field': 'restKind' },
        ...Object.entries(REST_KINDS).map(([value, label]) => el('option', { value, selected: step.restKind === value }, label)))),
      field(id('seconds'), 'Seconds', input(id('seconds'), { type: 'number', min: 1, max: 3600, value: step.seconds, 'data-field': 'seconds' })),
      actions);
  }
  return el('li', { class: 'step', 'data-step': ti },
    field(id('name'), 'Exercise', input(id('name'), {
      value: step.name, 'data-field': 'name', list: 'exercise-names', placeholder: 'e.g. Burpee', maxlength: 200,
    })),
    field(id('mode'), 'Ends after', el('select', { id: id('mode'), 'data-field': 'mode' },
      el('option', { value: 'time', selected: step.mode === 'time' }, 'Time'),
      el('option', { value: 'reps', selected: step.mode === 'reps' }, 'Reps'))),
    field(id('amount'), step.mode === 'reps' ? 'Reps' : 'Seconds',
      input(id('amount'), { type: 'number', min: 1, max: step.mode === 'reps' ? 1000 : 3600, value: step.amount, 'data-field': 'amount' })),
    field(id('rest'), 'Rest after (s)', input(id('rest'), { type: 'number', min: 0, max: 3600, value: step.rest, 'data-field': 'rest' })),
    actions);
}

function wireEvents() {
  $('name').addEventListener('input', (e) => { state.name = e.target.value; update(); });
  $('description').addEventListener('input', (e) => { state.description = e.target.value; update(); });
  $('add-section').addEventListener('click', () => {
    state.sections.push(newSection());
    renderSections();
    update();
  });

  const sections = $('sections');
  sections.addEventListener('input', onFieldChange);
  sections.addEventListener('change', onFieldChange);
  sections.addEventListener('click', onAction);

  $('template').addEventListener('change', async (e) => {
    const file = e.target.value;
    e.target.value = '';
    if (!file || (hasContent() && !confirm('Replace the current workout with this template?'))) return;
    const doc = await (await fetch(`examples/${file}.pwf.json`)).json();
    if (await load(doc)) render();
  });
  $('new').addEventListener('click', () => {
    if (hasContent() && !confirm('Start a new workout? The current one will be cleared.')) return;
    state = newState();
    hideMessage();
    render();
  });
  $('open-file').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      showMessage('That file is larger than PWF allows (1 MiB).', true);
      return;
    }
    try {
      if (await load(JSON.parse(await file.text()))) render();
    } catch {
      showMessage('That file isn’t valid JSON.', true);
    }
  });

  $('try').addEventListener('click', async () => {
    location.href = `play.html#w=${await encodeWorkout(documentFromState(state))}`;
  });
  $('export').addEventListener('click', () => {
    const doc = documentFromState(state);
    const blob = new Blob([`${JSON.stringify(doc, null, 2)}\n`], { type: 'application/json' });
    const link = el('a', { href: URL.createObjectURL(blob), download: `${slug(doc.name)}.pwf.json` });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  $('copy-link').addEventListener('click', async (e) => {
    // Share the short /play/ address. document.baseURI is the demo folder.
    const url = new URL(`../play/#w=${await encodeWorkout(documentFromState(state))}`, document.baseURI).href;
    try {
      await navigator.clipboard.writeText(url);
      flash(e.currentTarget, 'Link copied');
    } catch {
      prompt('Copy this link:', url);
    }
  });
}

function onFieldChange(e) {
  const fieldName = e.target.dataset.field;
  if (!fieldName) return;
  const section = state.sections[Number(e.target.closest('[data-section]').dataset.section)];
  const stepEl = e.target.closest('[data-step]');
  const target = stepEl ? section.steps[Number(stepEl.dataset.step)] : section;
  switch (fieldName) {
    case 'name':
      target.name = e.target.value;
      break;
    case 'skipLastRest':
      target.skipLastRest = e.target.checked;
      break;
    case 'restKind':
      target.restKind = e.target.value;
      break;
    case 'mode':
      if (e.type !== 'change') return;
      target.mode = e.target.value;
      target.amount = target.mode === 'reps' ? 10 : 40;
      renderSections();
      break;
    default: {
      const value = clampInt(e.target.value, Number(e.target.min), Number(e.target.max));
      if (value === null) return;
      target[fieldName] = value;
      if (fieldName === 'rounds') {
        e.target.closest('.section-head').querySelector('[data-field="restBetweenRounds"]').disabled = value < 2;
      }
    }
  }
  update();
}

function onAction(e) {
  const button = e.target.closest('[data-action]');
  if (!button) return;
  const si = Number(button.closest('[data-section]').dataset.section);
  const section = state.sections[si];
  const ti = Number(button.closest('[data-step]')?.dataset.step);
  switch (button.dataset.action) {
    case 'section-up': swap(state.sections, si, si - 1); break;
    case 'section-down': swap(state.sections, si, si + 1); break;
    case 'section-copy': state.sections.splice(si + 1, 0, structuredClone(section)); break;
    case 'section-remove': state.sections.splice(si, 1); break;
    case 'add-exercise': section.steps.push(newExercise()); break;
    case 'add-rest': section.steps.push(newRest()); break;
    case 'step-up': swap(section.steps, ti, ti - 1); break;
    case 'step-down': swap(section.steps, ti, ti + 1); break;
    case 'step-remove': section.steps.splice(ti, 1); break;
    default: return;
  }
  renderSections();
  update();
}

// Recomputes the summary from the document the builder would export.
function update() {
  saveDraft();
  const issues = problems(state);
  const doc = documentFromState(state);
  $('json').textContent = JSON.stringify(doc, null, 2);
  $('problems').replaceChildren(...issues.map((text) => el('li', {}, text)));
  $('problems-box').classList.toggle('hidden', issues.length === 0);
  for (const id of ['try', 'export', 'copy-link']) $(id).disabled = issues.length > 0;
  if (issues.length) {
    $('total').textContent = '–';
    $('total-note').textContent = '';
    return;
  }
  const { segments, totalSeconds } = expandTimeline(doc);
  const timed = segments.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  const open = segments.filter((s) => s.duration === null).length;
  $('total').textContent = formatDuration(totalSeconds ?? timed);
  $('total-note').textContent = open
    ? `plus ${open} rep-based ${open === 1 ? 'step' : 'steps'} at your own pace`
    : `${segments.length} steps`;
}

function hasContent() {
  return Boolean(state.name.trim() || state.sections.some((s) => s.steps.some((t) => t.kind === 'exercise' && t.name.trim())));
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
    return saved?.sections ? saved : null;
  } catch {
    return null;
  }
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private windows); the draft just isn't kept.
  }
}

function showMessage(text, isError, ...extra) {
  const box = $('message');
  box.replaceChildren(text, ...extra);
  box.classList.toggle('error', isError);
  box.classList.remove('hidden');
}

function hideMessage() {
  $('message').classList.add('hidden');
}

function flash(button, text) {
  const original = button.textContent;
  button.textContent = text;
  setTimeout(() => { button.textContent = original; }, 1500);
}

function clampInt(text, min, max) {
  const n = Number.parseInt(text, 10);
  return Number.isNaN(n) ? null : Math.min(max, Math.max(min, n));
}

function swap(list, i, j) {
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workout';
}

function field(id, labelText, control) {
  return el('div', {}, el('label', { for: id }, labelText), control);
}

function input(id, attrs) {
  return el('input', { id, ...attrs });
}

function iconButton(text, action, label, disabled = false, extraClass = '') {
  return el('button', {
    type: 'button', class: `icon ${extraClass}`.trim(), 'data-action': action, 'aria-label': label, title: label, disabled,
  }, text);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'value' || key === 'checked' || key === 'selected') node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children);
  return node;
}
