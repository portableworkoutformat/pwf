# Writing workouts in PWF: a guide for AI assistants

The Portable Workout Format (PWF) is an open JSON format for one workout: what to do, in what order, and when each step ends. It is precise enough that any app can play the workout with the same timing. This guide teaches an AI assistant to write PWF documents from plain language, change them, check them and give the person a link to play them.

PWF is a draft (version 0.1). The full specification is at https://portableworkout.org/spec.md and the JSON Schema at https://portableworkout.org/schema/pwf-0.1.schema.json. This guide is enough to write valid documents without them.

## What to do

When someone asks for a workout:

1. **Work out what they want.** If you can't make a sensible choice, ask one or two short questions, usually how long it should be, what equipment they have and their level. Otherwise choose, and say what you assumed.
2. **Write one PWF document** using the patterns below.
3. **Check it** against "Before you answer". If you can run code, also validate it (see "Checking a document").
4. **Reply with:**
   - two or three lines on the structure and the total time;
   - the document in a `json` code block;
   - a link to play it (see "Playing the workout"). If you can create files, also offer it as a `.pwf.json` file named after the workout.

When they ask for a change, change only what they asked for and keep everything else, including names and `id`s. Give back the whole updated document and a new link, and say in one line what changed. If they paste problems from the player, fix exactly those and send the whole document again.

## The format on one screen

```text
document   { "pwf": "0.1", "name": "...", "plan": <node>, ...optional fields }
plan       one node, usually a "block"
steps      exercise  do an exercise until its end
           work      a work phase with no set exercise (timers, task clocks)
           rest      rest; "kind" says what sort
           note      show text: a briefing or a cue
containers block     plays its children in order, "rounds" times (guided)
           task      a list done at your own pace against one clock (AMRAP, For Time, EMOM minutes)
           stations  group workouts only: people rotate between stations
           parallel  lanes that play at the same time
end        how a step ends: exactly one of time | reps | distance | calories | heartRateBelow | manual
target     what to aim for: reps, load, rpe, rir, tempo, heartRate, power, pace, speed, cadence, incline, resistance
```

Everything is optional except `pwf`, `name` and `plan`. All times are whole seconds. A step with no `end` waits for the person to press Done.

## Patterns

Each pattern shows a request and a complete, valid document.

### Intervals: "5 rounds of 1 minute hard, 30 seconds easy"

`rounds` on a block repeats its children. `rest` on an exercise step plays after each set. `skipLastRest` drops the rest that would end the workout. Total: 7 minutes.

```json
{
  "pwf": "0.1",
  "name": "Bike intervals",
  "activity": "cycle",
  "plan": {
    "type": "block",
    "rounds": 5,
    "skipLastRest": true,
    "children": [
      {
        "type": "exercise",
        "exercise": { "name": "Hard effort" },
        "end": { "time": 60 },
        "rest": { "time": 30 }
      }
    ]
  }
}
```

### Circuit with a break between rounds

`restBetweenRounds` plays between rounds in place of the round's last rest, so the 20-second rest and the minute don't add up. `defaults` sets `end` and `rest` for every exercise inside. A 10-second `prepare` rest gives time to get ready. Total: 13 minutes 10 seconds.

```json
{
  "pwf": "0.1",
  "name": "Bodyweight circuit",
  "activity": "hiit",
  "plan": {
    "type": "block",
    "children": [
      { "type": "rest", "kind": "prepare", "end": { "time": 10 } },
      {
        "type": "block",
        "name": "Circuit",
        "format": "circuit",
        "rounds": 3,
        "restBetweenRounds": { "time": 60 },
        "skipLastRest": true,
        "defaults": { "end": { "time": 40 }, "rest": { "time": 20 } },
        "children": [
          { "type": "exercise", "exercise": { "name": "Air squat" } },
          { "type": "exercise", "exercise": { "name": "Push-up" } },
          {
            "type": "exercise",
            "exercise": { "name": "Reverse lunge" },
            "side": "alternating"
          },
          { "type": "exercise", "exercise": { "name": "Plank" } }
        ]
      }
    ]
  }
}
```

Tabata is the same shape: `"rounds": 8`, `"end": { "time": 20 }`, `"rest": { "time": 10 }` and `"skipLastRest": true`.

### Strength: sets, reps and loads

Use the `exercises` and `equipment` maps when an exercise repeats or needs kit, and refer to them by key. `sets` is a count, or a list with one entry per set that can change `end`, `target` and `rest`. `"reps": "max"` means as many as possible. Steps that end on reps have no fixed length, so the total time depends on the person.

```json
{
  "pwf": "0.1",
  "name": "Squat and bench",
  "activity": "strength",
  "equipment": {
    "barbell": { "name": "Barbell" },
    "rack": { "name": "Squat rack" },
    "bench": { "name": "Flat bench" }
  },
  "exercises": {
    "squat": { "name": "Back squat", "equipment": ["barbell", "rack"] },
    "bench": {
      "name": "Bench press",
      "equipment": ["barbell", "bench"]
    }
  },
  "plan": {
    "type": "block",
    "children": [
      {
        "type": "exercise",
        "exercise": "squat",
        "sets": 3,
        "end": { "reps": 5 },
        "target": { "load": { "value": 100, "unit": "kg" } },
        "rest": { "time": 120 }
      },
      {
        "type": "exercise",
        "exercise": "bench",
        "sets": [
          {
            "end": { "reps": 10 },
            "target": { "load": { "value": 60, "unit": "kg" } }
          },
          {
            "end": { "reps": 8 },
            "target": { "load": { "value": 70, "unit": "kg" } }
          },
          {
            "end": { "reps": "max" },
            "target": { "load": { "value": 75, "unit": "kg" } }
          }
        ],
        "rest": { "time": 90 },
        "skipLastRest": true
      }
    ]
  }
}
```

### Superset, one side at a time

Two exercises alternate for 3 rounds. `label` shows A1 and A2. `"side": "each"` plays every set on the left, then the right. Reps can be a range.

```json
{
  "pwf": "0.1",
  "name": "Dumbbell superset",
  "activity": "strength",
  "plan": {
    "type": "block",
    "name": "Superset",
    "format": "superset",
    "rounds": 3,
    "restBetweenRounds": { "time": 90 },
    "children": [
      {
        "type": "exercise",
        "label": "A1",
        "exercise": { "name": "Dumbbell row" },
        "side": "each",
        "end": { "reps": 10 },
        "target": { "rir": 2 }
      },
      {
        "type": "exercise",
        "label": "A2",
        "exercise": { "name": "Dumbbell floor press" },
        "end": { "reps": { "min": 8, "max": 12 } },
        "target": { "tempo": "3-1-1-0" }
      }
    ]
  }
}
```

### EMOM: "every minute on the minute"

Each minute is a `task` with `"end": { "time": 60 }`: do the work, then rest for the rest of the minute. Here odd minutes are swings and even minutes are burpees. Total: 10 minutes.

```json
{
  "pwf": "0.1",
  "name": "10-minute EMOM",
  "activity": "hiit",
  "plan": {
    "type": "block",
    "format": "emom",
    "rounds": 5,
    "children": [
      {
        "type": "task",
        "end": { "time": 60 },
        "children": [
          {
            "type": "exercise",
            "exercise": { "name": "Kettlebell swing" },
            "end": { "reps": 15 }
          }
        ]
      },
      {
        "type": "task",
        "end": { "time": 60 },
        "children": [
          {
            "type": "exercise",
            "exercise": { "name": "Burpee" },
            "end": { "reps": 10 }
          }
        ]
      }
    ]
  }
}
```

### AMRAP: "as many rounds as possible in 12 minutes"

A `task` with `"rounds": "max"` and an `end` time. `score` says what to record. Total: 12 minutes.

```json
{
  "pwf": "0.1",
  "name": "12-minute AMRAP",
  "activity": "hiit",
  "plan": {
    "type": "task",
    "format": "amrap",
    "rounds": "max",
    "end": { "time": 720 },
    "score": "rounds-reps",
    "children": [
      {
        "type": "exercise",
        "exercise": { "name": "Pull-up" },
        "end": { "reps": 5 }
      },
      {
        "type": "exercise",
        "exercise": { "name": "Push-up" },
        "end": { "reps": 10 }
      },
      {
        "type": "exercise",
        "exercise": { "name": "Air squat" },
        "end": { "reps": 15 }
      }
    ]
  }
}
```

### For Time, with a time cap

A `task` with no `end` counts up until the person finishes, or until `timeCap`.

```json
{
  "pwf": "0.1",
  "name": "21-15-9",
  "activity": "hiit",
  "plan": {
    "type": "task",
    "format": "for-time",
    "timeCap": 600,
    "score": "time",
    "children": [
      {
        "type": "exercise",
        "exercise": { "name": "Thruster" },
        "end": { "reps": 21 }
      },
      {
        "type": "exercise",
        "exercise": { "name": "Pull-up" },
        "end": { "reps": 21 }
      },
      {
        "type": "exercise",
        "exercise": { "name": "Thruster" },
        "end": { "reps": 15 }
      },
      {
        "type": "exercise",
        "exercise": { "name": "Pull-up" },
        "end": { "reps": 15 }
      },
      {
        "type": "exercise",
        "exercise": { "name": "Thruster" },
        "end": { "reps": 9 }
      },
      {
        "type": "exercise",
        "exercise": { "name": "Pull-up" },
        "end": { "reps": 9 }
      }
    ]
  }
}
```

### A full session: briefing, warm-up, main set, cool-down

Nest blocks for the parts of a session. `phase` marks warm-up and cool-down steps. A `note` with a `time` end shows a message for that long. A rest's `kind` can be `rest`, `recovery`, `transition`, `hydrate` or `prepare`.

```json
{
  "pwf": "0.1",
  "name": "Full-body session",
  "description": "Warm up, three rounds of strength work, then stretch.",
  "activity": "mixed",
  "level": "beginner",
  "plan": {
    "type": "block",
    "children": [
      {
        "type": "note",
        "text": "Clear some space and grab a water bottle.",
        "end": { "time": 10 }
      },
      {
        "type": "block",
        "name": "Warm-up",
        "defaults": { "end": { "time": 30 } },
        "children": [
          {
            "type": "exercise",
            "exercise": { "name": "Jumping jacks" },
            "phase": "warmup"
          },
          {
            "type": "exercise",
            "exercise": { "name": "Arm circles" },
            "phase": "warmup"
          },
          {
            "type": "exercise",
            "exercise": { "name": "Bodyweight squat" },
            "phase": "warmup"
          }
        ]
      },
      {
        "type": "block",
        "name": "Main set",
        "rounds": 3,
        "restBetweenRounds": { "time": 60, "kind": "hydrate" },
        "children": [
          {
            "type": "exercise",
            "exercise": { "name": "Goblet squat" },
            "end": { "reps": 12 },
            "rest": { "time": 30 }
          },
          {
            "type": "exercise",
            "exercise": { "name": "Push-up" },
            "end": { "reps": 10 },
            "rest": { "time": 30 }
          }
        ]
      },
      {
        "type": "block",
        "name": "Cool-down",
        "children": [
          {
            "type": "exercise",
            "exercise": { "name": "Hamstring stretch" },
            "side": "each",
            "end": { "time": 30 },
            "phase": "cooldown"
          },
          {
            "type": "exercise",
            "exercise": { "name": "Child's pose" },
            "end": { "time": 60 },
            "phase": "cooldown"
          }
        ]
      }
    ]
  }
}
```

### Running intervals with distance and pace

`distance` ends a step when the distance is done. `estimate` only feeds time estimates. Paces are in seconds per unit: 220 s/km is 3:40 per km.

```json
{
  "pwf": "0.1",
  "name": "400 m repeats",
  "activity": "run",
  "plan": {
    "type": "block",
    "children": [
      {
        "type": "exercise",
        "exercise": { "name": "Easy run" },
        "end": { "time": 600 },
        "phase": "warmup",
        "target": { "heartRate": { "zone": 2 } }
      },
      {
        "type": "block",
        "rounds": 6,
        "skipLastRest": true,
        "children": [
          {
            "type": "exercise",
            "exercise": { "name": "Run" },
            "end": {
              "distance": { "value": 400, "unit": "m" },
              "estimate": 90
            },
            "target": {
              "pace": { "min": 220, "max": 230, "unit": "s/km" }
            },
            "rest": { "time": 90, "kind": "recovery" }
          }
        ]
      },
      {
        "type": "exercise",
        "exercise": { "name": "Easy run" },
        "end": { "time": 600 },
        "phase": "cooldown"
      }
    ]
  }
}
```

### Group class with stations

Only documents with `"mode": "group"` may use `stations`. Each child is a station with a fixed length, and everyone moves to the next station at the same time. `transition` is the time to move. `rotations` counts full cycles. Total: 7 minutes 45 seconds.

```json
{
  "pwf": "0.1",
  "name": "Four-station class",
  "mode": "group",
  "activity": "hiit",
  "plan": {
    "type": "stations",
    "rotations": 2,
    "transition": { "time": 15 },
    "skipLastRest": true,
    "children": [
      {
        "type": "exercise",
        "name": "Station 1",
        "exercise": { "name": "Kettlebell swing" },
        "end": { "time": 45 }
      },
      {
        "type": "exercise",
        "name": "Station 2",
        "exercise": { "name": "Row" },
        "end": { "time": 45 }
      },
      {
        "type": "exercise",
        "name": "Station 3",
        "exercise": { "name": "Box step-up" },
        "end": { "time": 45 }
      },
      {
        "type": "exercise",
        "name": "Station 4",
        "exercise": { "name": "Battle ropes" },
        "end": { "time": 45 }
      }
    ]
  }
}
```

## Field reference

### Document

| Field | Type | Notes |
| --- | --- | --- |
| `pwf` | `"0.1"` | Required |
| `name` | text, 1 to 200 characters | Required |
| `plan` | node | Required |
| `mode` | `individual` (default) or `group` | `group` only for `stations` |
| `description` | text | Markdown allowed, no HTML |
| `activity` | `strength`, `hiit`, `run`, `cycle`, `row`, `swim`, `yoga`, `mobility`, `mixed`, `other` | |
| `goals` | list of text | For example `strength`, `endurance`, `mobility` |
| `level` | `beginner`, `intermediate`, `advanced` | |
| `exercises` | map of key to exercise definition | |
| `equipment` | map of key to equipment definition | The kit list |
| `tags` | list of text | |
| `language` | language tag such as `en` or `de` | One language per document |
| `loop` | `true` or `false` | `true` repeats the whole plan until stopped |

Keys use letters, digits, `_`, `.` and `-`, start with a letter or digit, and are up to 64 characters.

### Exercises and equipment

An exercise is an inline definition, `{ "name": "Push-up" }`, or a key into the `exercises` map. A definition has `name` (required) and optionally `equipment` (keys or inline definitions), `description`, `instructions` (a list of text) and `media`. Equipment definitions have `name` and optionally `quantity`, `notes` (such as "16 kg or 24 kg") and `optional`.

Use clear, common exercise names in the document's language. Leave out `ref`: the registry of standard exercise IDs isn't published yet.

### Fields on every node

`type` (required), `id` (a key, unique in the document), `name`, `notes` (coaching notes, Markdown).

### Exercise steps

| Field | Default | Notes |
| --- | --- | --- |
| `exercise` | | Required: inline definition or key |
| `end` | `{ "manual": true }` | How each set ends |
| `target` | | What to aim for |
| `sets` | 1 | A count, or a list of `{ end?, target?, rest? }` |
| `rest` | | Rest after each set: an end plus optional `kind`, such as `{ "time": 60 }` |
| `skipLastRest` | `false` | `true` drops the rest after the last set |
| `side` | `both` | `both`, `each`, `left`, `right`, `alternating` |
| `label` | | Short label such as `A1` |
| `phase` | `work` | `warmup`, `work`, `recovery`, `cooldown` |
| `equipment` | | Which kit this step uses, when the exercise allows several |
| `alternatives` | | Easier or harder versions: `{ label?, exercise, end?, target? }` |

`work` steps have `end`, `label` and `phase`. `rest` steps have `end` and `kind`. `note` steps have `text`, `media` and `end`.

### Blocks and tasks

| Field | On | Notes |
| --- | --- | --- |
| `children` | both | Required, at least one node |
| `rounds` | both | Total plays, 1 to 1,000, or `"max"`. Default 1 |
| `restBetweenRounds` | block | Rest between rounds, replacing the round's last rest. One rest, or a list used in turn |
| `skipLastRest` | block | Drops a rest that would end the block |
| `end` | both | `{ "time": n }`: the container lasts exactly n seconds |
| `timeCap` | both | Ends the container at n seconds if it hasn't finished |
| `defaults` | both | `end`, `rest`, `sets`, `target` or `side` for every exercise step inside that doesn't set its own |
| `format` | both | A label only: `straight-sets`, `superset`, `giant-set`, `circuit`, `intervals`, `tabata`, `emom`, `amrap`, `for-time`, `chipper`, `ladder`, `pyramid`, `stations`, `flow`, `timebox`, `steady-state`, `other` |
| `clock` | task | A block of `work` and `rest` steps that runs the task's clock |
| `score` | task | `time`, `rounds-reps`, `reps`, `load` or `none` |

A block with `"rounds": "max"` needs `end`. A task with `"rounds": "max"` needs `end` or `clock`. A task can't have both `clock` and `end`.

### Stations and parallel lanes

`stations` (group only) has `children` (the stations), `rotations` (default 1), `transition` (one rest or a list, default kind `transition`) and `skipLastRest`. A station may list its `equipment` and `capacity` (people). Stations inside stations are zones.

`parallel` has `children` (1 to 10 lanes, played at the same time) and `primary` (the lane whose end ends the node, default 0). A lane with `"loop": true` repeats until then. The web player doesn't play parallel lanes yet.

### End conditions

| Field | Example |
| --- | --- |
| `time` | `{ "time": 40 }` moves on automatically |
| `reps` | `{ "reps": 10 }`, `{ "reps": { "min": 8, "max": 12 } }`, `{ "reps": "max" }` |
| `distance` | `{ "distance": { "value": 400, "unit": "m" } }`: `m`, `km`, `mi`, `yd` |
| `calories` | `{ "calories": 20 }` |
| `heartRateBelow` | `{ "heartRateBelow": 120 }` |
| `manual` | `{ "manual": true }` waits for Done |

Every end except `time` may add `timeCap` (seconds) to end it early, and `estimate` (seconds) for time estimates.

### Targets

| Field | Example |
| --- | --- |
| `reps` | `15`: a rep goal inside a timed step |
| `load` | `{ "value": 60, "unit": "kg" }` (`kg` or `lb`), `{ "percent1RM": 75 }`, `{ "bodyweight": true }` |
| `rpe` | `8` (1 to 10) |
| `rir` | `2` |
| `tempo` | `"3-1-X-0"` |
| `heartRate` | `145`, `{ "min": 140, "max": 155 }`, `{ "zone": 2 }` |
| `power` | `250`, `{ "percentFTP": 90 }` |
| `pace` | `{ "min": 225, "max": 235, "unit": "s/km" }`: also `s/mi`, `s/500m`, `s/100m` |
| `speed` | `{ "value": 12, "unit": "km/h" }`: also `mph`, `m/s` |
| `cadence` | `{ "value": 90, "unit": "rpm" }`: also `spm` |
| `incline` | `{ "value": 2, "unit": "%" }` |
| `resistance` | `{ "value": 8, "unit": "level" }`: also `%` |

Numbers in targets can be a range: `{ "min": a, "max": b }`.

## Before you answer

These are the mistakes that make a document invalid or play wrongly:

- **No invented fields.** The schema is strict. There is no `duration`, `seconds`, `weight`, `title` or `steps`. Timing goes in `end`, weights in `target.load`, the title in `name`, nested nodes in `children`. Put anything else in `notes` or `description`.
- **`end` holds exactly one field.** `{ "time": 40 }`, not `{ "time": 40, "reps": 10 }`. For "40 seconds, aim for 15 reps", use `"end": { "time": 40 }` and `"target": { "reps": 15 }`.
- **Whole seconds.** "1:30" is `90`. "2 minutes" is `120`.
- **`rounds` and `sets` are totals.** "Repeat 3 times" is `3`.
- **Rests at the end.** A step's `rest` plays after every set, including the last. Add `"skipLastRest": true` to the block, or the exercise step, when the workout shouldn't end on a rest.
- **Rest between rounds replaces, not adds.** With `restBetweenRounds`, the round's last rest doesn't also play.
- **Exercises as text are keys.** `"exercise": "Push-up"` only works if `"Push-up"` is a key in the `exercises` map. Otherwise write `"exercise": { "name": "Push-up" }`.
- **Every key resolves.** Equipment and exercise keys must exist in their maps, and `id`s must be unique.
- **Container `end` is time only.** A block or task can only use `{ "time": n }`.
- **`format` doesn't change timing.** It's a label. The structure decides how the workout plays.
- **Stations need group mode.** `stations` only in documents with `"mode": "group"`, and every station needs a fixed length.
- **Plain text.** No HTML in any text field.
- **Limits.** At most 1,000 rounds, sets or children; 16 levels of nesting; times up to 86,400 seconds.

## Playing the workout

The PWF player at https://portableworkout.org/play/ plays any valid PWF 0.1 workout except `parallel` lanes. It shows the total time and checks the document first.

Give the person a link that opens the player with the workout in it. The link is:

```text
https://portableworkout.org/play/#w=z.<data>
```

where `<data>` is the document as compact UTF-8 JSON, compressed with raw DEFLATE (no zlib header), then base64url-encoded without `=` padding. If you can run code, build it like this:

```python
import base64, json, zlib

def play_link(doc):
    data = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    deflate = zlib.compressobj(9, zlib.DEFLATED, -15)
    packed = deflate.compress(data) + deflate.flush()
    return "https://portableworkout.org/play/#w=z." + base64.urlsafe_b64encode(packed).decode().rstrip("=")
```

Never build the link by hand or guess its data. If you can't run code, give the document in a code block and tell the person: copy it, open https://portableworkout.org/play/ and paste it in.

If the player can't open a workout, it lists the problems and offers to copy them. When the person pastes them back, fix each one and send the whole document and a new link.

The builder at https://portableworkout.org/build/ edits simple workouts by hand.

## Checking a document

If you can run Python with the `jsonschema` package and have network access, validate against the schema:

```python
import json, urllib.request
from jsonschema import Draft202012Validator

url = "https://portableworkout.org/schema/pwf-0.1.schema.json"
schema = json.load(urllib.request.urlopen(url))
for error in Draft202012Validator(schema).iter_errors(doc):
    print("/" + "/".join(map(str, error.absolute_path)), error.message)
```

The schema can't check everything: also make sure keys resolve, `id`s are unique and `stations` only appear in group workouts. The player checks all of this when it opens the link.

## More

- Specification: https://portableworkout.org/spec.md
- JSON Schema: https://portableworkout.org/schema/pwf-0.1.schema.json
- Skill for Claude and ChatGPT, with scripts to check documents and build links: https://portableworkout.org/skill/portable-workout-format.zip
- Source and issues: https://github.com/portableworkoutformat/pwf
