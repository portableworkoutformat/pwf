---
name: portable-workout-format
description: Write, change, check and share workouts in the Portable Workout Format (PWF), an open JSON format any app can play, and give a link that plays them in the browser. Use when someone asks for a workout, training session, interval timer, HIIT, Tabata, EMOM, AMRAP, circuit, strength sets or group class, wants to change one, or shares a .pwf.json file.
license: Apache-2.0
---

# Portable Workout Format (PWF)

PWF describes one workout as JSON, precisely enough that any app can play it with the same timing. The PWF player at https://portableworkout.org/play/ plays it in a browser.

## Steps

1. Before writing your first workout in a conversation, read [references/guide.md](references/guide.md). It covers the format, patterns for common workout styles and the mistakes to avoid.
2. Work out what the person wants. Ask at most one or two short questions, such as how long, what equipment and what level. Otherwise choose, and say what you assumed.
3. Write the document to a file named after the workout, such as `tabata.pwf.json`.
4. Check it with `python3 scripts/pwf.py check tabata.pwf.json`. Fix every problem it lists and check again until it prints `valid`. If it says `not checked`, the `jsonschema` package is missing: run `pip install jsonschema` and check again, or, if you can't, go through the guide's checklist before you continue.
5. Build the link with `python3 scripts/pwf.py link tabata.pwf.json`.
6. Reply with two or three lines on the structure and total time, the JSON in a code block and the link. Share the file too if you can.

To change a workout, edit the existing document and keep everything the person didn't ask to change, including names and `id`s. Then check it, build a new link, and say in one line what changed.

If the person pastes problems from the player, fix exactly those, check again and send a new link.

If you can't run code, follow the checklist in the guide, give the JSON in a code block, and tell the person to open https://portableworkout.org/play/ and paste it in. Never build a link by hand.

## Files

- `references/guide.md`: the format, worked patterns, a field reference and a checklist.
- `references/pwf-0.1.schema.json`: the JSON Schema.
- `scripts/pwf.py`: `check` and `link`. It needs only the Python standard library. The schema check also uses the `jsonschema` package when it's installed.
