# Decisions, limits and open questions

This is the running record of what PWF v0.1 has decided, the limits it sets and what is still open. The proposal document holds the full design. When a decision changes, update this file in the same change.

## Decisions

All decided on 2026-10-27 unless noted.

### Format and scope

| ID | Decision | Why |
| --- | --- | --- |
| D1 | One JSON file describes one workout. Results, multi-week programs, athlete profiles, scheduling and media hosting are out of scope for v0.1 | Keep the first version small enough to finish and implement |
| D2 | ~~The name is OWF (Open Workout Format)~~. Superseded by D35 | The original choice. Known overlaps then: "Open workout" is the CrossFit Open's everyday term, OWF is also the Open Web Foundation's acronym, and `github.com/owf` and the npm package `owf` are taken. Dropped after finding OpenWorkout's OWL (Q13) |
| D3 | The plan is a tree of containers (`block`, `task`, `stations`, `parallel`) and steps (`exercise`, `work`, `rest`, `note`) | One recursive model covers every workout style, instead of a type per style |
| D4 | A `block` guides the athlete step by step. A `task` is a self-paced list on one clock: AMRAP, For Time, EMOM minutes, timeboxes | This one distinction covers most workout styles |
| D5 | `format` is a label for display and search. It never changes playback | Behaviour comes from structure alone, so renderers can't disagree about it |
| D6 | Every step ends by exactly one condition: time, reps, distance, calories, heart rate below a value, or manual. A step with no `end` ends manually | Supports time-based and goal-based workouts in the same model |
| D7 | A file with only the required fields runs. Every optional field has a default in the spec | Minimal files are easy for people and AI to write |
| D8 | Nothing is implicit: a renderer plays only what the file contains and adds no get-ready time, rests or countdowns that take time | Two apps must produce the same timeline from the same file |
| D9 | Times are whole seconds | Enough for the workouts considered so far. Allowing decimals later won't break existing files |
| D10 | One language per file | Simple. Translations can be added later without breaking files |
| D11 | Extensions live under reverse-DNS keys (such as `com.example`) and never change playback | Vendors keep their data without forking the format |
| D12 | The project lives in its own repo, separate from any vendor's codebase | It is meant to become a neutral industry format |
| D33 | PWF's sponsor and first integration partner is named publicly in the README | Be open about who funds PWF and implements it first |
| D34 | The spec, schema, conformance suite and tools are licensed under Apache-2.0, and the exercise and equipment registries under CC0 1.0. Copyright is held by "The PWF Authors" | Apache-2.0's patent grant tells other apps the sponsor can't later make patent claims against them. CC0 lets any app embed the registries without credit. While contributors are few, moving the spec to the Community Specification License later stays easy |
| D35 | The name is PWF, the Portable Workout Format. The version field is `pwf`, registry IDs start with `pwf:`, files end in `.pwf.json`, and the planned media type is `application/vnd.pwf+json`. Renamed from OWF on 2026-10-27 | "Portable" says what the format is for. It stays clearly separate from OpenWorkout's OWL, and the GitHub names and a .org domain looked free (see the candidates under Q13) |

### Exercises and equipment

| ID | Decision | Why |
| --- | --- | --- |
| D13 | Every exercise has a free-text `name`, which is always enough to run the workout. `ref` (a core registry ID) and `ids` (other vocabularies such as FIT) are optional | Any exercise can be written, and apps that share an ID can match exactly |
| D14 | Equipment works the same way as exercises. The document's `equipment` map doubles as the kit list | One pattern to learn |
| D15 | The exercise and equipment registries are versioned separately from the spec. IDs never change meaning and are never reused, and they are unique across both registries | The lists grow without spec releases, and an ID is never ambiguous |
| D16 | An unknown `ref` is a warning, not an error | A made-up or newer ID can't break a workout |
| D17 | One ID per distinct movement, with equipment as an attribute where only the implement changes (a goblet squat with a dumbbell or a kettlebell) | Draft choice. See Q1 |

### Timing

| ID | Decision | Why |
| --- | --- | --- |
| D18 | Loops are a `block` with `rounds`, which counts total plays, not extra repeats: `5` plays five times. `sets` loops a single exercise | Avoids the "repeat 1 means play twice" ambiguity |
| D19 | `rounds: "max"` needs a fixed length: `end.time` on a block, or `end.time` or a `clock` on a task | Otherwise it never ends |
| D20 | `restBetweenRounds` plays in place of any rest that ends the round, and never after the last round | "20 s off, 60 s between rounds" never stacks into 80 s. It matches how coaches describe circuits |
| D21 | `skipLastRest` works on every container and on an exercise with sets. It drops a rest that would be the final segment, however deeply nested. It defaults to `false` | A very common case, and one flag on the outer loop is enough |
| D22 | `restBetweenRounds` and `transition` take one value for every gap, or a list with one entry per gap, in order. A shorter list repeats from the start | Covers "60, 90, 120 s" rests and "15 s moves, 60 s water after each circuit" |
| D23 | A transition's `kind` defaults to `transition`; every other rest's defaults to `rest` | A player can label the move without extra fields |
| D24 | Keep the `defaults` shorthand. The reference library expands it into the normal form | Shorter files for people and AI; renderers can work on the normal form only |

### Group workouts

| ID | Decision | Why |
| --- | --- | --- |
| D25 | `mode` is `individual` (default) or `group`. Only group workouts may contain `stations` | Individual means everyone does the same thing at every moment; group allows different things at once |
| D26 | Movement cues (stay, move, move zone, drink) are derived from the structure, not written in the file | Less to write, and cues stay consistent with the timing |
| D27 | Zones are stations nested inside stations | No new node type needed |
| D28 | Any group workout can be played for one person, starting at the first station | Single-person apps can still run group workouts |

### Schema and AI

| ID | Decision | Why |
| --- | --- | --- |
| D29 | The schema is strict: unknown fields are errors. Readers still ignore unknown fields | Catches typos such as `skipLastrest` when authoring, while keeping later versions readable |
| D30 | The format is designed for AI authoring: the schema works as a structured-output schema, units are explicit, and validator errors say how to fix them | AI models increasingly write workouts |
| D31 | ~~The schema's `$id` is the placeholder `urn:pwf:schema:0.1` until the project has a home~~ | Superseded by D36 |
| D32 | The check script turns off Ajv's `strictRequired` option | It rejects `required` inside `oneOf` branches, which the schema uses to mean "exactly one of these" |
| D36 | The schema's `$id` is `https://portableworkout.org/schema/pwf-0.1.schema.json`, where the website serves it | The project now owns the domain, and tools can fetch the schema from its ID |
| D37 | Using PWF through AI assistants is the main way in: the website and README lead with it. The AI guide (`llms-full.txt`) and an Agent Skill for Claude and ChatGPT live in the repo next to the spec, and CI validates every workout in the guide | Most people will first meet PWF by asking an AI for a workout. Keeping the guide beside the spec, and testing it, stops it drifting from the format |
| D38 | A player link carries the whole workout in the URL fragment: `#w=z.` plus the compact JSON, compressed with raw DEFLATE and base64url-encoded. AIs build links with code, never by hand; without code they hand over the JSON to paste | Fragments never reach a server, so links need no backend and share nothing. Models can't compress or encode reliably in their heads |
| D39 | The player checks every workout before playing it: the schema, the limits in SPEC.md section 10, and the section 11 rules that don't need a timeline (keys, `id`s, ranges, `stations` only in group mode). It lists problems in plain words that can be pasted back to the AI. Links, pasted text and files are capped at 1 MiB before parsing, and links stop inflating at 1 MiB | Closes the loop when an AI writes an invalid workout, and keeps untrusted input bounded |

## Limits

### Format limits

These are normative in v0.1. Validators reject documents beyond them, and renderers refuse to play them.

| Limit | Value | Checked by |
| --- | --- | --- |
| File size | 1 MiB | Whoever reads the file: the player, the builder and `pwf.py` |
| Nesting depth | 16 levels | Validator: `lib/validate.js` and `pwf.py` |
| Nodes | 5,000 | Validator: `lib/validate.js` and `pwf.py` |
| `rounds`, `sets`, `rotations` | 1,000 each | Schema |
| Children per container | 1,000 | Schema |
| Parallel lanes | 10 | Schema |
| One pass of the timeline | 24 hours and 100,000 segments | Expander (`lib/timeline.js`), reported by `lib/validate.js`. `pwf.py` doesn't check it |
| `name` | 200 characters | Schema |
| Other text fields | 10,000 characters | Schema |
| Time values | 0 to 86,400 whole seconds | Schema |
| Text | Plain text or CommonMark without raw HTML. Renderers never execute or inject markup | Renderer |
| Media URLs | https only, untrusted, sent without credentials | Schema (https) and renderer |

### Rules the schema can't express

`lib/validate.js` and the skill's `pwf.py` check all but the last. The expander reports the last when it can't work out a length, and the player then says it can't play the workout:

- Only documents with `"mode": "group"` may contain `stations`.
- Node `id`s are unique, and every exercise key, equipment key and `previews` id resolves.
- Every range has `min` ≤ `max`, and `primary` names an existing lane.
- Stations have fixed durations, and blocks with `rounds: "max"` have timed content.

### Limits of this draft's tools

- The expander doesn't support parallel lanes.
- The expander needs fully timed content for fixed-length containers and stations, and applies a block's time cap only when its content is fully timed.
- `lib/validate.js` explains problems in plain words, with fixes for common mistakes, but its errors have no stable codes yet. The skill's Python script reports the `jsonschema` package's messages. Without that package it skips the schema check and says so, never printing `valid`.
- There is no strict variant of the schema for AI structured output yet.
- Conformance cases don't yet cover parallel lanes, block time caps, notes and previews, `estimate` or documents with `loop`.

## Open questions

| ID | Question | Notes |
| --- | --- | --- |
| Q1 | Registry granularity: one ID per movement with equipment as an attribute (D17), or one ID per variant, as FIT does? | Affects the registry, not the schema |
| Q2 | Task clocks: does progress carry across work phases (the draft), or reset at each one? | Needed before more task conformance cases |
| Q3 | Parallel lanes: cut other lanes off when the primary ends (the draft), or require equal lengths? | Check what existing multi-screen players do with lanes of different lengths |
| Q4 | Results: should a companion format for scores and actual reps and loads come before 1.0, or after? | |
| Q5 | Programs: write a companion format for multi-week plans, or align with openweight's Program schema? | |
| Q6 | Text notation: add a compact notation such as `3 × (40 s squat / 20 s rest)` that compiles to PWF? | For people typing workouts and for chat |
| Q7 | Partner and team workouts ("you go, I go", split reps): model them in v0.2? | Stations don't cover them |
| Q8 | Registry seeds: who picks the first ~150 exercises and ~60 pieces of equipment, and from which sources? | |
| Q9 | ~~Licences~~ | Decided: see D34 |
| Q10 | ~~The sponsor's role~~ | Decided: see D33 |
| Q11 | Registration: when to register the `.pwf.json` extension and an `application/vnd.pwf+json` media type? | Needed before 1.0 |
| Q13 | ~~Keep the OWF name or rename?~~ | Decided: renamed to PWF (D35). Background, found 2026-10-27: the `open-workout` GitHub org (openworkout.org, created April 2026) builds an open-source workout tracker and OWL, an "Open Workout Language" for workout programs including EMOM, AMRAP and For Time, with its own spec and conformance suite. `openworkoutformat.org` and `.com` were registered in March 2026 by an unknown party, with no site. Free: GitHub `openworkoutformat` and `open-workout-format`, and `openworkoutformat.dev` |
| Q14 | Contact OpenWorkout? | OWL is a language for writing multi-week programs; PWF is a format for running one session. OWL could compile to PWF, which would make OpenWorkout a second implementer |

### Name candidates for Q13

Checked 2026-10-27. "Looks free" means the domain has no DNS records; confirm with a registrar. None of these has had a trademark search.

| Name | GitHub | Domains | Clashes found |
| --- | --- | --- | --- |
| Portable Workout Format (PWF) | `portableworkoutformat` and `portable-workout-format` free | `portableworkout.org`, `portableworkout.dev` and `portableworkoutformat.org` look free; `pwf.dev` registered | No workout format. `.pwf` is used by a few unrelated files, which `.pwf.json` avoids |
| TrainSpec | `trainspec` free | `trainspec.com`, `.org` and `.dev` look free | None in fitness; "train" also reads as railways |
| WorkoutSpec | `workoutspec` taken; `workout-spec` free | `.org` and `.com` registered; `.dev` looks free | None found |
| Universal Workout Format (UWF) | `universalworkoutformat` free | `universalworkout.org` looks free | UWF is a wrestling federation, and "universal" overclaims |
| Gymfile | `gymfile` free | `.dev` and `.org` look free; `.com` registered | An iOS workout-tracker app is called Gymfile |
| FitSpec | `fitspec` free | `.org` and `.dev` look free | Reads as Garmin's FIT specification |
