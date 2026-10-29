---
name: portable-workout-format
description: Write, change, check and share workouts in the Portable Workout Format (PWF), an open JSON format any app can play, and give a link that plays them in the browser. Use when someone asks for a workout, training session, interval timer, HIIT, Tabata, EMOM, AMRAP, circuit, strength sets or group class, wants to change one, or shares a .pwf.json file.
license: Apache-2.0
---

# Portable Workout Format (PWF)

PWF describes one workout as JSON, precisely enough that any app can play it with the same timing. The PWF player at https://portableworkout.org/play/ plays it in a browser.

## Steps

1. Before writing your first workout in a conversation, read [references/guide.md](references/guide.md). It covers the format, choosing exercises that suit where the person trains, patterns for common workout styles and the mistakes to avoid.
2. Work out what the person wants. Ask at most one or two short questions, such as how long, where they'll train, what equipment and what level. Otherwise choose, and say what you assumed.
3. Write the document to a file named after the workout, such as `tabata.pwf.json`.
4. Run `python3 scripts/pwf.py link tabata.pwf.json`. It checks the workout and prints a link that plays it. If it lists problems instead, fix every one and run it again.
5. Reply with two or three lines on the structure and total time, and the link. Share the file too if you can. Give the JSON in the reply only if the person asks for it.

To change a workout, edit the existing document and keep everything the person didn't ask to change, including names and `id`s. Then run the link command again and say in one line what changed.

If the person pastes problems from the player, fix exactly those and send a new link.

If you can't run code, write the link yourself, as the guide's "Playing the workout" shows.

## Files

- `references/guide.md`: the format, worked patterns, a field reference and a checklist.
- `references/pwf-0.1.schema.json`: the JSON Schema.
- `scripts/pwf.py`: `link` checks a workout and prints its link; `check` only checks it. It needs only the Python standard library. The schema check also uses the `jsonschema` package when it's installed. Without it, the player checks the schema when it opens the link.
