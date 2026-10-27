# Portable Workout Format (PWF)

[![CI](https://github.com/portableworkoutformat/pwf/actions/workflows/ci.yml/badge.svg)](https://github.com/portableworkoutformat/pwf/actions/workflows/ci.yml)

**Workouts your AI can write and any app can play.** PWF is an open JSON format for workouts. Describe a workout to Claude or ChatGPT in plain words, then play it with timers, share it, and ask for changes. Website: [portableworkout.org](https://portableworkout.org).

This repository holds the v0.1 draft: the [specification](SPEC.md), its JSON Schema, a conformance suite, the AI guide and skill, and the website with its player. Everything may change before 1.0.

## Try it with AI

**[Try with Claude](https://claude.ai/new?q=Help%20me%20make%20a%20workout%20in%20the%20Portable%20Workout%20Format%20%28PWF%29.%20First%20read%20https%3A%2F%2Fportableworkout.org%2Fllms-full.txt.%20Then%20ask%20me%20what%20I%E2%80%99d%20like.%20When%20it%E2%80%99s%20ready%2C%20give%20me%20the%20PWF%20JSON%20and%20a%20link%20to%20play%20it.)** · **[Try with ChatGPT](https://chatgpt.com/?q=Help%20me%20make%20a%20workout%20in%20the%20Portable%20Workout%20Format%20%28PWF%29.%20First%20read%20https%3A%2F%2Fportableworkout.org%2Fllms-full.txt.%20Then%20ask%20me%20what%20I%E2%80%99d%20like.%20When%20it%E2%80%99s%20ready%2C%20give%20me%20the%20PWF%20JSON%20and%20a%20link%20to%20play%20it.)**

1. **Start a chat.** The links open a new chat with a short prompt that points your assistant at the PWF guide. With any other assistant, paste the prompt below.
2. **Describe your workout.** How long, what kit, how hard: "30 minutes, kettlebell and a mat, finish with core". Ask for changes as you go.
3. **Play it.** Your assistant gives you a link that opens the workout in the [PWF player](https://portableworkout.org/play/), with timers, rounds and what's next. If it can't make a link, paste its JSON into the player.

```text
Help me make a workout in the Portable Workout Format (PWF). First read https://portableworkout.org/llms-full.txt. Then ask me what I'd like. When it's ready, give me the PWF JSON and a link to play it.
```

### Make your assistant fluent in PWF

- **Skill for Claude and ChatGPT.** Download [portable-workout-format.zip](https://portableworkout.org/skill/portable-workout-format.zip) and upload it in your assistant's skills settings. It teaches the format and adds scripts that check each workout and build its play link. The source is in [`skills/portable-workout-format`](skills/portable-workout-format).
- **Claude Code.** Install the same skill as a plugin:

  ```text
  /plugin install pwf --marketplace portableworkoutformat/pwf
  ```

  Before Claude Code 2.1.275, add the marketplace first with `/plugin marketplace add portableworkoutformat/pwf`, then run `/plugin install pwf@pwf`.

- **Any AI tool.** Point it at [`llms.txt`](https://portableworkout.org/llms.txt) or the full guide, [`llms-full.txt`](https://portableworkout.org/llms-full.txt).
- **Coming soon: a PWF connector.** An MCP server that checks workouts and plays them inside the chat.

## What is PWF?

One PWF file describes one workout, completely enough for any app to show it and run it:

- **What it is:** name, description, goals, level, the equipment needed, authors and licence.
- **How it runs:** timed intervals, rests, rounds and loops, time caps, self-paced AMRAP, For Time and EMOM work, and group classes where people rotate around stations.
- **What you do:** exercises with reps, sets, loads, distances, calories and intensity targets such as effort, heart rate, power and pace.

This is Tabata, eight rounds of 20 seconds on and 10 off:

```json
{
  "pwf": "0.1",
  "name": "Tabata",
  "plan": {
    "type": "block",
    "rounds": 8,
    "skipLastRest": true,
    "children": [
      {
        "type": "exercise",
        "exercise": { "name": "Burpee" },
        "end": { "time": 20 },
        "rest": { "time": 10 }
      }
    ]
  }
}
```

PWF's timing rules are written down precisely, and a shared test suite checks them, so two apps playing the same file produce the same timeline, second for second. Exercises are plain names, so nothing breaks when an app doesn't recognise one.

## Why PWF?

- **People now ask AI for workouts.** The answer is usually a wall of text that no app can run. A published format with a guide written for AI, and errors that say how to fix them, turns that answer into a workout you can play.
- **Workouts are locked into the app that made them.** Coaches rebuild the same session in every app they use, gyms can't take their library with them, and nobody can share a workout that runs anywhere.
- **Existing formats each cover only part of the job.** Garmin FIT and Zwift `.zwo` handle timed endurance intervals but not group classes. Apple WorkoutKit and Android Health Connect are platform APIs rather than files people can share. schema.org's `ExercisePlan` describes a workout but can't run one. Strength-focused formats track sets and reps but have no timing. None covers time-based classes, rep-based strength and scored workouts in one model, and none describes group workouts where people move around a room.
- **The same file should run the same way everywhere.** Other formats leave details such as "is there a rest after the last interval?" to each app. PWF writes every rule down and tests it.

PWF is meant to be a neutral format that no single vendor owns, with open tools so that adopting it is cheap.

## For developers

| Path | What it is |
| --- | --- |
| [SPEC.md](SPEC.md) | The specification |
| [DECISIONS.md](DECISIONS.md) | Decisions made so far, format limits and open questions |
| `schema/pwf-0.1.schema.json` | JSON Schema (draft 2020-12) for a PWF document, served at its `$id`, https://portableworkout.org/schema/pwf-0.1.schema.json |
| `conformance/` | Documents with the timelines a player must produce, and documents that must fail validation |
| `skills/portable-workout-format/` | The Agent Skill: `SKILL.md`, the AI guide (`references/guide.md`, served as `llms-full.txt`) and `scripts/pwf.py` to check workouts and build play links |
| `site/` | The website's home page and `llms.txt` |
| `demo/` | The player and builder |
| `lib/` | `timeline.js`, the draft expander that turns a document into the timeline one participant sees, and `validate.js`, which checks a document and explains each problem in plain words |
| `tools/` | `check.mjs` runs the checks, `build.mjs` compiles the schema for the browser, `site.mjs` builds the website, `serve.mjs` serves it, `timeline.mjs` prints a timeline |
| `.claude-plugin/` | The Claude Code plugin and marketplace manifests |

### Running the checks

```bash
npm install
npm run check
```

The checks run the conformance suite, and also check that every workout in the AI guide is valid, that the skill's script builds links the player opens, and that the browser validator agrees with the schema.

To print one workout's timeline:

```bash
node tools/timeline.mjs conformance/cases/003-circuit-defaults.pwf.json
```

### The website

`npm run demo` builds the website into `_site/` and serves it at http://localhost:8080/. GitHub Pages publishes it to [portableworkout.org](https://portableworkout.org) from `main`.

- **Player** (`/play/`): opens a link, pasted JSON, a file or an example. It checks the workout first and lists any problems in plain words, ready to paste back to the AI. It plays everything the expander supports, including tasks and group stations, but not parallel lanes. Its "Change it with AI" buttons open Claude or ChatGPT with the workout.
- **Builder** (`/build/`): sections with rounds, a rest between rounds and an optional skipped final rest, holding timed or rep-based exercises and rests. It covers a small part of PWF on purpose.

Player links keep the whole workout in the URL fragment, which browsers never send to a server: `https://portableworkout.org/play/#w=z.` followed by the compact JSON, compressed with raw DEFLATE and base64url-encoded.

### The schema

The schema is strict: an unknown field is an error, so typos such as `skipLastrest` are caught. Readers must still ignore fields they don't know, so documents from later versions keep working.

Some rules can't be expressed in JSON Schema. `lib/validate.js` and the skill's script check them, and [DECISIONS.md](DECISIONS.md#limits) lists them. A variant for AI structured output, using only the object forms and no `if`/`then`, is still to come.

## Status

Draft v0.1, for comment. [DECISIONS.md](DECISIONS.md) tracks what's decided and what's still open.

## Sponsor

PWF is sponsored by [CloudFit](https://cloudfit.tv), which is also its first integration partner. Decisions are made in the open and recorded in [DECISIONS.md](DECISIONS.md).

## Contributing

Questions and ideas go in [Discussions](https://github.com/portableworkoutformat/pwf/discussions). Changes to the format start as a proposal issue. [CONTRIBUTING.md](CONTRIBUTING.md) explains the process, including the sign-off every commit needs. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report security issues privately, as described in [SECURITY.md](SECURITY.md).

## Licence

Copyright 2026 The PWF Authors.

- The specification, schema, conformance suite, AI guide, skill, website and tools are licensed under the [Apache License 2.0](LICENSE).
- The exercise and equipment registries, still to come, are dedicated to the public domain under [CC0 1.0](LICENSES/CC0-1.0.txt), so any app can embed them without credit.
- Workouts written in PWF carry whatever licence their author sets in the `license` field.
