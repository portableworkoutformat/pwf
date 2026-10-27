# Conformance suite

Each case pairs a document with the timeline a conforming player must produce for one participant. Invalid cases must fail validation at a given path. Most break the schema; those marked `"by": "validator"` in the manifest pass the schema but break a rule only a validator can check, such as the limits in SPEC.md section 10.

| File | Contents |
| --- | --- |
| `cases/NNN-name.pwf.json` | A valid document |
| `cases/NNN-name.timeline.json` | Its expected timeline |
| `invalid/NNN-name.pwf.json` | A document that must fail validation |
| `manifest.json` | Every case's description, the timing rules it covers and its total worked out by hand. For invalid cases, the path where validation must fail |

## Timeline format

```json
{
  "pwf": "0.1",
  "totalSeconds": 790,
  "segments": [
    {
      "start": 0, "duration": 10, "type": "rest", "from": "node", "kind": "prepare",
      "end": { "time": 10 }, "path": "/plan/children/0"
    },
    {
      "start": 10, "duration": 40, "type": "exercise", "exercise": "squat",
      "end": { "time": 40 }, "path": "/plan/children/1/children/0",
      "iteration": { "/plan/children/1": 1 }
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `totalSeconds` | Length of one pass, or `null` when any segment has no fixed length |
| `loop` | `true` when the document repeats until stopped |
| `start` | Seconds from the start, or `null` once an earlier segment has no fixed length |
| `duration` | Seconds, or `null` for a segment that ends on reps, distance, calories, heart rate or the athlete |
| `type` | `exercise`, `work`, `rest`, `note` or `task` |
| `from` | For rests: `node` (a rest step), `rest` (a step's rest after a set), `restBetweenRounds`, `transition`, or `fill` (padding a fixed-length container or a shorter station) |
| `kind` | For rests: `rest`, `recovery`, `transition`, `hydrate` or `prepare` |
| `cue` | Inside stations: `stay`, `move` or `move-zone` |
| `exercise` | The exercise key, or `{ "name": … }` for an inline exercise |
| `side` | `left`, `right` or `alternating`, when not both |
| `phase` | `warmup`, `recovery` or `cooldown`, when not work |
| `end` | The end condition, as written or inherited |
| `cut` | `true` when a fixed length or time cap cut the segment short. `duration` is the time it actually plays |
| `path` | JSON Pointer to the node that produced the segment |
| `task` | For segments of a task's clock, the task's path |
| `iteration` | Which round, set or rotation each repeating ancestor is on, keyed by its path |

Timelines are compared for equality; field order doesn't matter.

## Coverage

| Case | Covers |
| --- | --- |
| 001 | Required fields only; steps with no end |
| 002 | A loop as a block and as sets, with the final rest skipped |
| 003 | Defaults, get-ready, rest between rounds replacing the round's last rest |
| 004 | Rep-based sets, per-set targets, one side at a time, rest between rounds appended |
| 005 | Per-set end and rest |
| 006 | Nested loops; outer flags acting on the inner loop's last rest |
| 007 | `restBetweenRounds` as a repeating list |
| 008 | AMRAP, EMOM and For Time tasks |
| 009 | `rounds: "max"` cut at a fixed length; a short block padded with rest |
| 010 | A task driven by a clock |
| 011 | Group stations in two zones, with movement cues |
| 012 | `transition` as a repeating list across two rotations |

Not covered yet: parallel lanes, time caps on blocks, notes and previews, `estimate`, and documents with `loop`.

## Adding a case

1. Add `NNN-name.pwf.json` to `cases/`, and an entry to `manifest.json` with a total worked out by hand.
2. Run `npm run write-timelines` to generate the expected timeline.
3. Read the generated timeline segment by segment against the timing rules. The expander is a draft, so its output is not proof.
4. Run `npm run check`.
