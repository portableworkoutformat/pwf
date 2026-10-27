# Portable Workout Format (PWF) 0.1

**Status:** draft for comment. Anything in this document may change before 1.0.

PWF is a JSON format for one workout. A PWF document says what the workout is, how it runs and which exercises it uses, precisely enough that any app can show it and play it with the same timing as every other app.

The machine-readable parts of this specification are the JSON Schema in [`schema/pwf-0.1.schema.json`](schema/pwf-0.1.schema.json) and the conformance suite in [`conformance/`](conformance/). [DECISIONS.md](DECISIONS.md) records why each choice was made.

## Contents

1. [Conventions](#1-conventions)
2. [Document](#2-document)
3. [Exercises and equipment](#3-exercises-and-equipment)
4. [The plan](#4-the-plan)
5. [Ending steps and targets](#5-ending-steps-and-targets)
6. [Timing rules](#6-timing-rules)
7. [Group workouts](#7-group-workouts)
8. [Timelines and normal form](#8-timelines-and-normal-form)
9. [Extensions and versioning](#9-extensions-and-versioning)
10. [Limits and security](#10-limits-and-security)
11. [Conformance](#11-conformance)
12. [Files and media type](#12-files-and-media-type)

## 1. Conventions

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, RECOMMENDED, MAY and OPTIONAL are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

| Term | Meaning |
| --- | --- |
| Document | One PWF JSON object, describing one workout |
| Renderer | An app that shows or plays a document |
| Validator | A tool that checks a document against this specification |
| Node | An object in the plan tree: a step or a container |
| Step | A leaf node the athlete does: `exercise`, `work`, `rest` or `note` |
| Container | A node that holds other nodes: `block`, `task`, `stations` or `parallel` |
| Segment | One entry in a timeline: a step as it actually plays, after expansion |
| Key | A local identifier matching `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$` |

All times are whole seconds. Text fields are plain text unless this specification says they accept CommonMark, and CommonMark fields MUST NOT contain raw HTML.

## 2. Document

A document is a JSON object (RFC 8259) encoded as UTF-8. Only `pwf`, `name` and `plan` are required. Every optional field has a default given here, so a document with only the required fields can be played.

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `pwf` | Yes | `"0.1"` | Format version |
| `name` | Yes | string, 1–200 characters | Title shown to people |
| `plan` | Yes | node | The root of the plan tree (section 4) |
| `mode` | No | `individual` (default) or `group` | Whether people can do different things at the same moment (section 7) |
| `id` | No | string | Stable identifier for sharing and de-duplication, such as a URL or `urn:uuid:` |
| `description` | No | CommonMark | What the workout is |
| `activity` | No | `strength`, `hiit`, `run`, `cycle`, `row`, `swim`, `yoga`, `mobility`, `mixed`, `other` | Main activity |
| `goals` | No | array of strings | Open list. Suggested: `strength`, `hypertrophy`, `power`, `endurance`, `conditioning`, `mobility`, `skill`, `recovery` |
| `level` | No | `beginner`, `intermediate`, `advanced` | Intended level |
| `equipment` | No | map of key → equipment definition | The kit list (section 3) |
| `exercises` | No | map of key → exercise definition | Exercise definitions (section 3) |
| `tags` | No | array of strings | Free-text labels |
| `language` | No | BCP 47 tag | Language of the document's text. One language per document |
| `authors` | No | array of `{ name, url? }` | Who wrote the workout |
| `license` | No | SPDX identifier or expression | Licence of the workout itself |
| `source` | No | `{ url?, derivedFrom? }` | Where it was published, and what it was adapted from |
| `created`, `updated` | No | RFC 3339 date-time | Timestamps |
| `loop` | No | boolean, default `false` | `true` repeats the whole plan until stopped |
| `extensions` | No | object | Vendor data (section 9) |
| `$schema` | No | string | URI of the schema, for editors and tools |

A document's duration is never stored. Renderers compute it from the plan (section 8).

The smallest valid document:

```json
{
  "pwf": "0.1",
  "name": "Quick legs",
  "plan": {
    "type": "block",
    "children": [
      { "type": "exercise", "exercise": { "name": "Squats" } },
      { "type": "exercise", "exercise": { "name": "Lunges" } }
    ]
  }
}
```

## 3. Exercises and equipment

### 3.1 Exercise definitions

An exercise definition describes one exercise. Steps refer to a definition by its key in the document's `exercises` map, or carry an inline definition.

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | Yes | What people see, in the document's language. A renderer MUST be able to show and play the workout using the name alone |
| `ref` | No | A core registry ID (section 3.3) |
| `ids` | No | IDs in other vocabularies, keyed by namespace: `fit`, `healthconnect`, or a vendor's reverse-DNS name such as `com.example` |
| `equipment` | No | The equipment it usually uses, as equipment references |
| `description` | No | CommonMark |
| `instructions` | No | Coaching steps, in order |
| `media` | No | Images or videos (section 3.4) |
| `extensions` | No | Vendor data |

### 3.2 Equipment definitions

Equipment works the same way as exercises. The document's `equipment` map is the kit list.

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | Yes | What people see |
| `ref` | No | A core registry ID |
| `ids` | No | IDs in other vocabularies |
| `quantity` | No | How many one person needs. Default 1 |
| `notes` | No | Sizes and weights, such as "16 kg or 24 kg" |
| `optional` | No | `true` when the workout runs without it. Default `false` |
| `media` | No | Images |
| `extensions` | No | Vendor data |

An equipment reference is a key into the document's `equipment` map, or an inline equipment definition.

### 3.3 Core registries

PWF maintains two registries, one of exercises and one of equipment. Each is versioned separately from this specification.

- A registry ID is `pwf:` followed by a lower-case kebab-case slug, such as `pwf:goblet-squat`.
- IDs are unique across both registries, never change meaning and are never reused. A retired ID points to its replacement.
- A `ref` a renderer doesn't recognise is not an error. Validators SHOULD report it as a warning.

When an app imports a document, it SHOULD match each exercise in this order: by `ref`, by any `ids` entry in a vocabulary it knows, then by name and registry aliases as a suggestion the user confirms. An exercise that matches nothing is kept with its given name. A renderer MUST NOT refuse a workout because it doesn't recognise an exercise.

### 3.4 Media

A media item is `{ type, url, license?, caption? }`, where `type` is `image` or `video` and `url` MUST use `https`. Media is untrusted: loading it is OPTIONAL, and renderers MUST NOT send credentials with media requests.

## 4. The plan

The plan is a tree. Containers decide how the workout runs; steps say what to do and when each one ends.

### 4.1 Fields on every node

| Field | Meaning |
| --- | --- |
| `type` | Required. One of `exercise`, `work`, `rest`, `note`, `block`, `task`, `stations`, `parallel` |
| `id` | A key, unique in the document. Used by note previews and for editing one node at a time |
| `name` | A name to show, such as "Circuit A" or, for a station, "Station 3" |
| `notes` | Coaching notes, in CommonMark |
| `display` | Presentation hints (section 4.6) |
| `equipment` | On an exercise step, the equipment it uses when the exercise allows several. On a station, the equipment the station holds |
| `capacity` | People per station. Only meaningful on a direct child of `stations` |
| `loop` | `true` repeats this lane until the primary lane ends. Only meaningful on a lane of `parallel` |
| `extensions` | Vendor data |

### 4.2 Steps

| Type | What it does | Fields |
| --- | --- | --- |
| `exercise` | Do one exercise until its end condition | `exercise` (required), `end`, `target`, `sets`, `rest`, `skipLastRest`, `side`, `label`, `phase`, `alternatives` |
| `work` | A work phase with no set exercise, for timer-only workouts and task clocks | `end`, `label`, `phase` |
| `rest` | Rest | `kind`, `end` |
| `note` | Show text or media: a briefing, a whiteboard, a cue, or a preview of upcoming exercises | `text`, `media`, `previews`, `end` |

Exercise step fields:

| Field | Default | Meaning |
| --- | --- | --- |
| `exercise` | | A key into `exercises`, or an inline exercise definition |
| `end` | `{ "manual": true }` | How each set ends (section 5) |
| `target` | | What to aim for (section 5.2) |
| `sets` | 1 | A count of identical sets, or a list with one entry per set. Each entry MAY override `end`, `target` and `rest` |
| `rest` | | The rest after each set: an end condition with an optional `kind` |
| `skipLastRest` | `false` | `true` drops the rest after the final set |
| `side` | `both` | `both`, `each`, `left`, `right` or `alternating` |
| `label` | | A short display label, such as `A1` |
| `phase` | `work` | `warmup`, `work`, `recovery` or `cooldown` |
| `alternatives` | | Scaled or substitute versions, each `{ label?, exercise, end?, target?, equipment? }`. The main version plays by default |

A rest step's `kind` is `rest` (default), `recovery`, `transition`, `hydrate` or `prepare` (get ready). A note's `previews` is the `id` of one node, or a list of them, whose exercises the note shows.

### 4.3 Guided and self-paced containers

| Type | What it does | Fields |
| --- | --- | --- |
| `block` | Plays its children in order, guiding the athlete through each one | `children` (required, at least one), `rounds`, `restBetweenRounds`, `skipLastRest`, `end`, `timeCap`, `defaults`, `format` |
| `task` | A self-paced list the athlete works through against one clock | `children`, `rounds`, `end`, `timeCap`, `clock`, `score`, `defaults`, `format` |

A `block` tells the athlete what to do now and moves on when each step ends. A `task` shows its whole list and runs a clock while the athlete works through it at their own pace. Straight sets and circuits are blocks. AMRAP, For Time, chippers and the work inside an EMOM minute are tasks.

- `rounds` is the total number of plays, from 1 to 1,000, or `"max"`. Default 1.
- A `block` with `rounds: "max"` MUST have `end`. A `task` with `rounds: "max"` MUST have `end` or `clock`.
- `end`, on a container, is `{ "time": n }`: the container lasts exactly `n` seconds.
- A task's `clock` is a `block` of `work` and `rest` steps that runs the task's clock. A task MUST NOT have both `clock` and `end`.
- A task's `score` says what to record: `time`, `rounds-reps`, `reps`, `load` or `none` (default).

### 4.4 Group containers

| Type | What it does | Fields |
| --- | --- | --- |
| `stations` | Stations that different people use at the same time, rotating between them. Only allowed in group workouts | `children` (the stations, at least one), `rotations` (default 1), `transition`, `skipLastRest`, `format` |
| `parallel` | Lanes that play at the same time: screens, tracks or partners | `children` (1–10 lanes), `primary` (default 0) |

### 4.5 Defaults

`defaults` on a `block` or `task` holds any of `end`, `rest`, `sets`, `target` and `side`. Each applies to every exercise step below the container that doesn't set that field itself. The nearest ancestor wins.

### 4.6 Formats and display hints

`format` names a workout style for display and search: `straight-sets`, `superset`, `giant-set`, `circuit`, `intervals`, `tabata`, `emom`, `amrap`, `for-time`, `chipper`, `ladder`, `pyramid`, `stations`, `flow`, `timebox`, `steady-state` or `other`. A renderer MAY show it but MUST NOT infer behaviour from it: the structure alone decides how a workout plays.

`display` holds presentation hints: `layout` (`single`, `list` or `grid`), `upNext` (how many upcoming exercises to show, 0–20), `showTimer` and `timerStyle` (`countdown` or `countup`). Hints never change timing, and renderers MAY ignore them.

## 5. Ending steps and targets

### 5.1 End conditions

An end condition says when a step is over. It holds exactly one of these fields:

| Field | Example | Who moves on |
| --- | --- | --- |
| `time` | `{ "time": 40 }` | The renderer, automatically, after that many seconds |
| `reps` | `{ "reps": 10 }`, `{ "reps": { "min": 8, "max": 12 } }`, `{ "reps": "max" }` | The athlete, or a rep-counting sensor |
| `distance` | `{ "distance": { "value": 400, "unit": "m" } }` (`m`, `km`, `mi`, `yd`) | GPS or a machine, otherwise the athlete |
| `calories` | `{ "calories": 20 }` | A machine, otherwise the athlete |
| `heartRateBelow` | `{ "heartRateBelow": 120 }` (bpm) | A heart rate sensor, otherwise the athlete |
| `manual` | `{ "manual": true }` | The athlete |

Any end other than `time` MAY add `timeCap` (seconds), which ends the step early, and `estimate` (seconds), which only feeds duration estimates. A renderer MUST NOT move on because an estimate ran out.

A rest specification, used by `rest`, `restBetweenRounds` and `transition`, is an end condition plus an optional `kind`, such as `{ "time": 30, "kind": "hydrate" }`.

### 5.2 Targets

`target` says what to aim for while doing a step. Any number in a target MAY be a single value or a `{ "min": a, "max": b }` range.

| Field | Example | Notes |
| --- | --- | --- |
| `reps` | `15` | A rep goal inside a timed step |
| `load` | `{ "value": 60, "unit": "kg" }`, `{ "percent1RM": 75 }`, `{ "bodyweight": true }` | `kg` or `lb` |
| `rpe` | `8` | Rate of perceived exertion, 1–10 |
| `rir` | `2` | Reps in reserve |
| `tempo` | `"3-1-X-0"` | Seconds lowering, pausing, lifting and pausing. `X` means explosive |
| `heartRate` | `145`, `{ "min": 140, "max": 155 }`, `{ "zone": 2 }` | bpm, or zones 1–5 |
| `power` | `250`, `{ "min": 200, "max": 220 }`, `{ "percentFTP": 90 }` | Watts |
| `pace` | `{ "min": 225, "max": 235, "unit": "s/km" }` | Also `s/mi`, `s/500m`, `s/100m` |
| `speed` | `{ "value": 12, "unit": "km/h" }` | Also `mph`, `m/s` |
| `cadence` | `{ "value": 90, "unit": "rpm" }` | Also `spm` |
| `incline` | `{ "value": 2, "unit": "%" }` | |
| `resistance` | `{ "value": 8, "unit": "level" }` | Also `%` |

Relative targets (`percent1RM`, `percentFTP` and heart rate zones) need athlete data a document doesn't hold. A renderer that has it SHOULD show the resulting number; one that doesn't shows the percentage or zone.

## 6. Timing rules

A renderer plays the plan depth-first, from the root, following these rules. The conformance suite checks them.

1. **Nothing implicit.** A renderer MUST play only what the document contains. It MUST NOT add get-ready time, rests or countdowns that take time. It MAY wait for the user to press start before the first step.
2. **Steps.** A step ends by its `end`. A `time` end advances automatically, and a step with no end waits for the athlete. Every other end advances when the athlete, or a sensor, says so, or at `timeCap`.
3. **Sets.** `sets: n` plays the step `n` times. A list of sets plays one set per entry, and each entry can override the step's `end`, `target` and `rest`. `rest` follows every set, including the last, unless the step sets `skipLastRest`.
4. **Sides.** With `side: "each"`, every set plays once per side, left then right, each lasting the full `end`. `rest` follows the pair.
5. **Blocks.** A block plays its children in order, `rounds` times. Between rounds, `restBetweenRounds` plays in place of any rest that ends the round, however deeply nested, so "20 s off, 60 s between rounds" never stacks into 80 s. It never plays after the last round. One rest applies to every gap between rounds; a list gives each gap its own, in order, and starts again from the top if it runs out.
6. **Skip last rest.** `skipLastRest: true` on a container, or on an exercise step with sets, drops a rest that would be its final segment, however deeply nested.
7. **Fixed-length containers.** `end: { "time": n }` makes a block or task last exactly `n` seconds. With `rounds: "max"` it repeats its content until the time is up. Otherwise, content that finishes early is followed by rest until the time is up, and content still running at the end is cut off.
8. **Time caps.** `timeCap` ends a container when its content completes or at the cap, whichever comes first.
9. **Tasks.** A task shows all its children together. Its clock is `clock` if given; otherwise a countdown of `end.time`; otherwise a count-up (to `timeCap`, if set) that stops when the athlete finishes. The athlete MAY mark each round complete, and `score` says what to record. Progress carries across the clock's work phases.
10. **Stations (group workouts only).** All stations share one clock, so each MUST have a fixed duration. A station period lasts as long as the longest station. After each period everyone moves to the next station, wrapping round, and `transition` plays in place of any rest that ends the station. `rotations` counts full cycles. One transition applies to every move; a list gives each move its own, in order, and starts again from the top if it runs out. A transition's `kind` defaults to `transition`. A single-person renderer plays the stations in order from the first.
11. **Parallel lanes.** Lanes start together, and the node ends when the `primary` lane ends. The other lanes stop there; a lane with `loop: true` repeats until then.
12. **Defaults.** `defaults` on a block or task applies to every exercise step below it that doesn't set that field. The nearest ancestor wins.
13. **Loop.** `loop: true` on the document repeats the whole plan until stopped.
14. **Units.** Times are whole seconds.

## 7. Group workouts

`mode` says whether everyone does the same thing at the same time.

- **`individual`** (default): one person, or a whole class following along together, doing the same thing at every moment. A document in individual mode MUST NOT contain `stations`.
- **`group`**: people can do different things at the same moment, such as starting at different stations.

Any group workout can be played for one person, who follows one path through it, starting at the first station.

A `stations` container lists its stations in rotation order. Each child is one station: its `name` is the label people look for, and it MAY list its `equipment` and `capacity`. Zones are stations nested inside stations: people rotate through the stations in their zone, then each zone's group moves to the next zone.

Renderers derive movement cues from the structure:

| Moment | Cue |
| --- | --- |
| A rest between sets at the same station | Stay |
| A transition after a station | Move |
| A transition between outer stations (zones) | Move zone |
| Any rest or transition with `kind: hydrate` | Drink |

## 8. Timelines and normal form

### 8.1 Normal form

Every document can be rewritten without shorthand: `defaults` copied into steps, `sets` and `side` expanded, and `rest` fields turned into `rest` steps. Renderers MAY work on the normal form only.

### 8.2 Timeline

A timeline is the ordered list of segments one participant sees during one pass of the plan. The conformance suite expresses expected behaviour as timelines in this form:

```json
{
  "pwf": "0.1",
  "totalSeconds": 790,
  "segments": [
    {
      "start": 0, "duration": 10, "type": "rest", "from": "node", "kind": "prepare",
      "end": { "time": 10 }, "path": "/plan/children/0"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `totalSeconds` | Length of one pass, or `null` when any segment has no fixed length |
| `loop` | `true` when the document repeats until stopped |
| `start` | Seconds from the start, or `null` once an earlier segment has no fixed length |
| `duration` | Seconds, or `null` for a segment that doesn't end on time |
| `type` | `exercise`, `work`, `rest`, `note` or `task` |
| `from` | For rests: `node` (a rest step), `rest` (a step's rest after a set), `restBetweenRounds`, `transition`, or `fill` (padding a fixed-length container or a shorter station) |
| `kind` | For rests: the rest kind |
| `cue` | Inside stations: `stay`, `move` or `move-zone` |
| `exercise` | The exercise key, or `{ "name": … }` for an inline exercise |
| `side` | `left`, `right` or `alternating`, when not both |
| `phase` | `warmup`, `recovery` or `cooldown`, when not work |
| `end` | The end condition, as written or inherited |
| `cut` | `true` when a fixed length or time cap cut the segment short; `duration` is the time it actually plays |
| `path` | JSON Pointer (RFC 6901) to the node that produced the segment |
| `task` | For segments of a task's clock, the task's path |
| `iteration` | Which round, set or rotation each repeating ancestor is on, keyed by its path |

A task without a clock is one segment. A task with a clock produces its clock's segments, each carrying `task`.

## 9. Extensions and versioning

### 9.1 Extensions

`extensions` MAY appear on the document, an exercise or equipment definition, or any node. It is an object keyed by reverse-DNS names, such as `com.example`.

- Extensions MUST NOT change playback. Anything that changes the timeline belongs in the core format.
- Renderers MUST ignore extensions they don't know, and SHOULD keep them when re-saving a document.

### 9.2 Versioning

- `pwf` holds the format version. During 0.x, any minor release MAY break documents.
- From 1.0, minor versions only add optional fields and enum values. Readers MUST ignore fields they don't know, SHOULD warn on enum values they don't know, and MUST refuse a document whose major version is higher than they support.
- The registries have their own versions and only ever add IDs.
- The schema is strict, so validators report unknown fields as errors. This catches mistakes when writing documents; it does not change the rule that readers ignore unknown fields.

## 10. Limits and security

PWF documents are shared between apps and MUST be treated as untrusted input. Validators MUST reject, and renderers MUST refuse to play, documents beyond these limits:

| Limit | Value |
| --- | --- |
| File size | 1 MiB |
| Nesting depth | 16 levels |
| Nodes | 5,000 |
| `rounds`, `sets`, `rotations` | 1,000 each |
| Children per container | 1,000 |
| Parallel lanes | 10 |
| One pass of the timeline | 24 hours and 100,000 segments |
| `name` | 200 characters |
| Other text fields | 10,000 characters |
| Time values | 0 to 86,400 seconds |

- Nesting depth counts the plan as level 1. Each child, and a task's `clock`, is one level below its parent. Nodes are the plan and everything under it through `children` and `clock`.
- Renderers MUST build timelines as segments, never second by second. They MUST check every limit except those on one pass of the timeline before expanding anything. Those two can only be checked while expanding, so renderers MUST stop expanding once a pass can no longer stay within them, and refuse the document.
- Expanding makes segments before a fixed length or time cap cuts them (section 6, rules 7 and 8), so a renderer MAY refuse a document whose content passes the segment limit before it is cut short.
- Renderers MUST NOT execute or inject markup from text fields.
- Media URLs MUST use `https`. Loading them is OPTIONAL, and renderers MUST NOT send credentials with them.

## 11. Conformance

A **conforming document** validates against the schema and also meets these rules, which the schema can't express:

- Only documents with `"mode": "group"` contain `stations`.
- Node `id`s are unique, and every exercise key, equipment key and `previews` id resolves.
- Every range has `min` ≤ `max`, and `primary` names an existing lane.
- Stations have fixed durations, and blocks with `rounds: "max"` have timed content.
- It stays within the limits in section 10.

Renderers conform at one of three levels:

1. **Viewer:** validates documents and displays every node type.
2. **Player:** also plays blocks and steps with every end type, producing the conformance suite's timelines.
3. **Full player:** also plays tasks, stations and parallel lanes, and records scores.

The [conformance suite](conformance/) pairs documents with their expected timelines, and lists documents that MUST fail validation.

## 12. Files and media type

A PWF document is stored in a file ending `.pwf.json`. The provisional media type is `application/vnd.pwf+json`; it is not yet registered.
