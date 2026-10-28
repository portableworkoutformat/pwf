<picture>
  <source media="(prefers-color-scheme: dark)" srcset="site/brand/pwf-mark-on-dark.svg">
  <img src="site/brand/pwf-mark.svg" width="72" height="72" alt="PWF logo">
</picture>

# Portable Workout Format (PWF)

[![CI](https://github.com/portableworkoutformat/pwf/actions/workflows/ci.yml/badge.svg)](https://github.com/portableworkoutformat/pwf/actions/workflows/ci.yml)

**An open format for defining workouts.** Write a workout down once, then build on it, share it and run it anywhere. A yoga flow, 5 × 5 squats, boxing rounds or a track session: one small JSON file describes it exactly, and every PWF app plays it the same way.

**[Website](https://portableworkout.org)** · **[Examples](https://portableworkout.org/#examples)** · **[Player](https://portableworkout.org/play/)** · **[Builder](https://portableworkout.org/build/)** · **[Specification](SPEC.md)**

This repository holds the v0.1 draft: the specification, its JSON Schema, a conformance suite, example workouts, the AI guide and skill, and the website with its player and builder. Everything may change before 1.0.

## Why a workout format?

Workouts are everywhere: in coaching notes, on gym whiteboards, in forum posts and videos, and now in AI chats. But there's no standard way to write one down so that an app can run it.

- **Sharing means retyping.** Post a workout, send it to a friend or answer a question online, and it travels as text or a screenshot. To run it, someone copies it into an app by hand, one exercise and one timer at a time.
- **Every app has its own format.** Coaches rebuild the same session in every app they use, and gyms can't take their library with them. A workout made in one app can't be played in another.
- **AI writes workouts nobody can run.** Ask an AI for a workout and you get a wall of text, laid out differently every time. There's no consistent way to build a workout with AI and then actually do it, with timers and rounds.

PWF is one open file for any workout:

- **Precise enough to run.** Every timing rule is written down and tested, so a workout plays the same in every app, second for second.
- **Easy to share.** A workout is a small file or a link. Post it, send it or attach it, and anyone can open it and press play.
- **Made for people and AI.** Readable JSON with plain exercise names, and a guide that teaches AI assistants to write it reliably.
- **Open to everyone.** Free to use and build on, developed in the open, and not owned by any one app.

## What a PWF workout looks like

One PWF file describes one workout, completely enough for any app to show it and run it:

- **What it is:** name, description, goals, level, the equipment needed, authors and licence.
- **How it runs:** timed intervals, rests, rounds and loops, time caps, self-paced AMRAP, For Time and EMOM work, and group classes where people rotate around stations.
- **What you do:** exercises with reps, sets, loads, distances, calories and targets such as effort, heart rate, power and pace.

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

Exercises are plain names, so nothing breaks when an app doesn't recognise one.

## Examples

One format for every kind of workout. [Play any of them on the website](https://portableworkout.org/#examples), or open the files here to see how they're written.

| Workout | Type | Length | Level |
| --- | --- | --- | --- |
| [Morning sun salutations](examples/sun-salutations.pwf.json) | Yoga | 14 min | Beginner |
| [Barbell 5 × 5](examples/strength-5x5.pwf.json) | Strength | Self-paced | Intermediate |
| [Boxing bag rounds](examples/boxing-bag-rounds.pwf.json) | Boxing | Self-paced | Intermediate |
| [First run: walk-run intervals](examples/first-run.pwf.json) | Running | 30 min | Beginner |
| [30/30 HIIT](examples/hiit-30-30.pwf.json) | HIIT | 16 min | Intermediate |
| [Pilates mat core](examples/pilates-mat-core.pwf.json) | Pilates | Self-paced | Beginner |
| [Sweet spot ride](examples/sweet-spot-ride.pwf.json) | Cycling | 55 min | Intermediate |
| [Kickboxing conditioning](examples/kickboxing-rounds.pwf.json) | Kickboxing | 19 min | Intermediate |
| [Six-station circuit class](examples/six-station-class.pwf.json) | Group class | 12 min | Intermediate |
| [Pool session, 1,500 m](examples/swim-1500.pwf.json) | Swimming | Self-paced | Intermediate |
| [20-minute EMOM](examples/emom-20.pwf.json) | EMOM | 20 min | Intermediate |
| [Dumbbell strength and conditioning](examples/dumbbell-strength-conditioning.pwf.json) | Strength and conditioning | Self-paced | Intermediate |
| [Jiu-jitsu movement drills](examples/jiu-jitsu-drills.pwf.json) | Jiu-jitsu | Self-paced | Beginner |
| [Rowing 5 × 500 m](examples/rowing-500s.pwf.json) | Rowing | Self-paced | Intermediate |
| [Double Tabata](examples/tabata-double.pwf.json) | Tabata | 9 min | Advanced |
| [Desk-break mobility](examples/desk-break-mobility.pwf.json) | Mobility | 8 min | Beginner |
| [Tempo run](examples/tempo-run.pwf.json) | Running | 43 min | Intermediate |
| [Chipper for time](examples/for-time-chipper.pwf.json) | For Time | Self-paced | Advanced |
| [Seated strength for beginners](examples/seated-strength.pwf.json) | Low impact | Self-paced | Beginner |

"Self-paced" workouts include steps that end on reps, a distance or when you're done, so their length depends on you.

## Make workouts with AI

Describe a workout in plain words. Your AI writes it in PWF and gives you a link that plays it. Ask for changes as you go.

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

  If your version of Claude Code doesn't know `--marketplace`, add the marketplace first with `/plugin marketplace add portableworkoutformat/pwf`, then run `/plugin install pwf@pwf`.

- **Any AI tool.** Point it at [`llms.txt`](https://portableworkout.org/llms.txt) or the full guide, [`llms-full.txt`](https://portableworkout.org/llms-full.txt).
- **Coming soon: a PWF connector.** An MCP server that checks workouts and plays them inside the chat.

## Play and build in your browser

- **[Player](https://portableworkout.org/play/):** open a link, paste a workout or open a `.pwf.json` file. It runs the timers, counts the rounds and shows what's next, on a phone, a laptop or a TV.
- **[Builder](https://portableworkout.org/build/):** sections, rounds, timed or rep-based exercises and rests. Save the file, share a link, or play it straight away.

## Questions and answers

**What kinds of workouts can PWF describe?** All of them: that's the aim. PWF covers strength training with sets, reps and loads; HIIT, Tabata, EMOM, AMRAP and For Time; yoga flows and Pilates; boxing and martial-arts rounds; running, cycling, rowing and swimming with distances and pace, heart-rate or power targets; mobility and stretching; and group classes where people move between stations. If you find a workout PWF can't describe, [open an issue](https://github.com/portableworkoutformat/pwf/issues).

**Is PWF free to use?** Yes. The specification, schema and tools are open source under the Apache License 2.0, and the exercise and equipment lists, when they're published, will be in the public domain.

**Do I need AI to use PWF?** No. Build a workout by hand in the builder, write the JSON yourself, or export it from any app that supports PWF. AI just makes it quick.

**Does a workout link send my data anywhere?** No. The whole workout is in the part of the link after the `#`, which browsers never send to a server. The player runs entirely in your browser.

**How is PWF different from FIT, ZWO or Apple WorkoutKit?** Each covers part of the picture. Garmin FIT and Zwift `.zwo` files describe timed endurance intervals, but not strength sets or group classes. Apple WorkoutKit and Android Health Connect are platform APIs rather than files people can share. schema.org's `ExercisePlan` describes a workout but can't run one, and strength apps track sets and reps but have no timing. Other formats also leave details such as "is there a rest after the last interval?" to each app. PWF covers all of these in one file, and writes every timing rule down and tests it.

**Can PWF record results?** Not yet. Version 0.1 describes the workout itself. Results, multi-week programs and athlete profiles are left for later versions.

More questions are answered [on the website](https://portableworkout.org/#faq).

## For developers

| Path | What it is |
| --- | --- |
| [SPEC.md](SPEC.md) | The specification |
| [DECISIONS.md](DECISIONS.md) | Decisions made so far, format limits and open questions |
| `schema/pwf-0.1.schema.json` | JSON Schema (draft 2020-12) for a PWF document, served at its `$id`, https://portableworkout.org/schema/pwf-0.1.schema.json |
| `conformance/` | Documents with the timelines a player must produce, and documents that must fail validation |
| `examples/` | Example workouts for the website's gallery, from yoga and Pilates to strength, boxing, running and group classes |
| `skills/portable-workout-format/` | The Agent Skill: `SKILL.md`, the AI guide (`references/guide.md`, served as `llms-full.txt`) and `scripts/pwf.py` to check workouts and build play links |
| `site/` | The website's home page, `llms.txt`, and the logo and icons in `site/brand/` |
| `demo/` | The player and builder |
| `lib/` | `timeline.js`, the draft expander that turns a document into the timeline one participant sees, and `validate.js`, which checks a document and explains each problem in plain words |
| `tools/` | `check.mjs` runs the checks, `build.mjs` compiles the schema for the browser, `site.mjs` builds the website, `serve.mjs` serves it, `timeline.mjs` prints a timeline |
| `.claude-plugin/` | The Claude Code plugin and marketplace manifests |

### Running the checks

```bash
npm install
npm run check
```

The checks run the conformance suite, and also check that every example workout and every workout in the AI guide is valid and plays, that the skill's script builds links the player opens, and that the browser validator agrees with the schema.

To print one workout's timeline:

```bash
node tools/timeline.mjs conformance/cases/003-circuit-defaults.pwf.json
```

### The website

`npm run demo` builds the website into `_site/` and serves it at http://localhost:8080/. GitHub Pages publishes it to [portableworkout.org](https://portableworkout.org) from `main`. `tools/site.mjs` builds the home page's examples gallery, with a play link for each workout, from `examples/examples.json`.

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
- The photo in `site/img/` is © CloudFit and isn't covered by these licences. See [NOTICE](NOTICE).
