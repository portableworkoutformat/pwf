# Portable Workout Format (PWF), v0.1 draft

[![CI](https://github.com/portableworkoutformat/pwf/actions/workflows/ci.yml/badge.svg)](https://github.com/portableworkoutformat/pwf/actions/workflows/ci.yml)

PWF is a proposed open JSON format for describing, sharing and running workouts across apps. This repository holds the v0.1 draft: the [specification](SPEC.md), its JSON Schema and a conformance suite. Everything here may change before 1.0.

## What is PWF?

One PWF file describes one workout, completely enough for any app to show it and run it:

- **What it is:** name, description, goals, level, the equipment needed, authors and licence.
- **How it runs:** timed intervals, rests, rounds and loops, time caps, self-paced AMRAP, For Time and EMOM work, and group classes where people rotate around stations.
- **What you do:** exercises with reps, sets, loads, distances, calories and intensity targets such as effort, heart rate, power and pace.

The smallest valid file names a workout and its exercises:

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

A timed workout adds an `end` to each step, such as `{ "time": 40 }`. The cases in [conformance/cases](conformance/cases) show circuits, strength sets, AMRAP, EMOM, For Time, running intervals and group stations.

PWF's timing rules are written down precisely, and a shared test suite checks them, so two apps playing the same file produce the same timeline, second for second.

## Why PWF?

- **Workouts are locked into the app that made them.** Coaches rebuild the same session in every app they use, gyms can't take their library with them, and nobody can share a workout that runs anywhere.
- **Existing formats each cover only part of the job.** Garmin FIT and Zwift `.zwo` handle timed endurance intervals but not group classes. Apple WorkoutKit and Android Health Connect are platform APIs rather than files people can share. schema.org's `ExercisePlan` describes a workout but can't run one. Strength-focused formats track sets and reps but have no timing. None covers time-based classes, rep-based strength and scored workouts in one model, and none describes group workouts where people move around a room.
- **The same file should run the same way everywhere.** Other formats leave details such as "is there a rest after the last interval?" to each app. PWF writes every rule down and tests it.
- **AI models now write workouts.** A published schema with clear, fixable errors lets them produce files any app can run.

PWF is meant to be a neutral format that no single vendor owns, with open tools (a validator, a reference player and converters to existing formats) so that adopting it is cheap.

## Sponsor

PWF is sponsored by [CloudFit](https://cloudfit.tv), which is also its first integration partner. Decisions are made in the open and recorded in [DECISIONS.md](DECISIONS.md).

## What's here

| Path | What it is |
| --- | --- |
| [SPEC.md](SPEC.md) | The specification |
| [DECISIONS.md](DECISIONS.md) | Decisions made so far, format limits and open questions |
| `schema/pwf-0.1.schema.json` | JSON Schema (draft 2020-12) for a PWF document |
| `conformance/` | Documents with the timelines a player must produce, and documents that must fail validation |
| `demo/` | A small workout builder and player (see below) |
| `lib/timeline.js` | Draft expander: turns a document into the timeline one participant sees. The player uses it too |
| `tools/` | Command-line tools: `check.mjs` runs the conformance suite, `timeline.mjs` prints a timeline, `serve.mjs` serves the demo |

## Running the checks

```bash
npm install
npm run check
```

To print one workout's timeline:

```bash
node tools/timeline.mjs conformance/cases/003-circuit-defaults.pwf.json
```

## Demo

`demo/` holds a small builder and player that show PWF in use. Run `npm run demo` and open http://localhost:8080/demo/.

- **Builder:** sections with rounds, a rest between rounds and an optional skipped final rest, holding timed or rep-based exercises and rests. It exports a `.pwf.json` file, copies a share link, or opens the workout in the player.
- **Player:** opens a file, pasted JSON, an example or a shared link, and plays it with a countdown, round and set counts, what's up next, beeps and keyboard controls. It plays anything the expander supports, including tasks and group stations, but not parallel lanes.

The builder covers a small part of PWF on purpose. Shared links keep the whole workout in the URL fragment, which browsers never send to a server.

## The schema

The schema is strict: an unknown field is an error, so typos such as `skipLastrest` are caught. Readers must still ignore fields they don't know, so documents from later versions keep working.

Some rules can't be expressed in JSON Schema, and a few limits need a validator. [DECISIONS.md](DECISIONS.md#limits) lists them; the reference validator will check them.

The `$id` is a placeholder URN until the project has a home. A variant for AI structured output, using only the object forms and no `if`/`then`, is still to come.

## Status

Draft v0.1, for comment. [DECISIONS.md](DECISIONS.md) tracks what's decided and what's still open.

## Contributing

Questions and ideas go in [Discussions](https://github.com/portableworkoutformat/pwf/discussions). Changes to the format start as a proposal issue. [CONTRIBUTING.md](CONTRIBUTING.md) explains the process, including the sign-off every commit needs. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report security issues privately, as described in [SECURITY.md](SECURITY.md).

## Licence

Copyright 2026 The PWF Authors.

- The specification, schema, conformance suite and tools are licensed under the [Apache License 2.0](LICENSE).
- The exercise and equipment registries, still to come, are dedicated to the public domain under [CC0 1.0](LICENSES/CC0-1.0.txt), so any app can embed them without credit.
- Workouts written in PWF carry whatever licence their author sets in the `license` field.
