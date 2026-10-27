#!/usr/bin/env python3
"""Check PWF workouts and build links that open them in the PWF player.

Usage:
  python3 pwf.py check workout.pwf.json   Print "valid", or the problems and exit 1
  python3 pwf.py link workout.pwf.json    Print a link that opens the workout in the player

Use "-" instead of a file name to read the workout from standard input.

Only the Python standard library is needed. The schema check also needs the
jsonschema package (pip install jsonschema); without it, `check` runs the
other checks and says the schema wasn't checked.
"""

import base64
import json
import sys
import zlib
from pathlib import Path

PLAYER = "https://portableworkout.org/play/"
SCHEMA = Path(__file__).resolve().parent.parent / "references" / "pwf-0.1.schema.json"
MAX_BYTES = 1024 * 1024  # SPEC.md section 10


def load(name):
    text = sys.stdin.read() if name == "-" else Path(name).read_text(encoding="utf-8")
    if len(text.encode("utf-8")) > MAX_BYTES:
        sys.exit("The workout is larger than PWF allows (1 MiB).")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        sys.exit(f"Not valid JSON: {e.msg} at line {e.lineno}, column {e.colno}.")


def link(doc):
    """The player link for a document: compact JSON, raw DEFLATE, base64url."""
    data = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    deflate = zlib.compressobj(9, zlib.DEFLATED, -15)
    packed = deflate.compress(data) + deflate.flush()
    return PLAYER + "#w=z." + base64.urlsafe_b64encode(packed).decode("ascii").rstrip("=")


def pointer(parts):
    return "".join("/" + str(p).replace("~", "~0").replace("/", "~1") for p in parts)


def schema_problems(doc):
    try:
        from jsonschema import Draft202012Validator
        from jsonschema.exceptions import best_match
    except ImportError:
        return None
    validator = Draft202012Validator(json.loads(SCHEMA.read_text(encoding="utf-8")))
    problems = []
    for error in validator.iter_errors(doc):
        # For "one of" errors, report the alternative that came closest.
        if error.context:
            error = best_match(error.context)
        problems.append((pointer(error.absolute_path), error.message))
    return sorted(set(problems))


def semantic_problems(doc):
    """Rules from SPEC.md section 11 that the schema can't check."""
    problems = []
    if not isinstance(doc, dict) or not isinstance(doc.get("plan"), dict):
        return problems
    exercises = doc.get("exercises") or {}
    equipment = doc.get("equipment") or {}
    ids = set()
    previews = []

    def check_equipment(items, path):
        for i, item in enumerate(items or []):
            if isinstance(item, str) and item not in equipment:
                problems.append((f"{path}/{i}", f'refers to equipment "{item}", which isn\'t in the "equipment" map.'))

    def check_exercise(value, path):
        if isinstance(value, str) and value not in exercises:
            problems.append((path, f'refers to exercise "{value}", which isn\'t in the "exercises" map. '
                                   f'Add it there, or write it inline as {{ "name": "{value}" }}.'))

    for key, definition in exercises.items():
        if isinstance(definition, dict):
            check_equipment(definition.get("equipment"), f"/exercises/{key}/equipment")

    def visit(node, path):
        if not isinstance(node, dict):
            return
        if "id" in node:
            if node["id"] in ids:
                problems.append((f"{path}/id", f'uses the id "{node["id"]}", which another node already has.'))
            ids.add(node["id"])
        if node.get("type") == "stations" and doc.get("mode") != "group":
            problems.append((path, 'is "stations", which only group workouts can have. Add "mode": "group" or use a block.'))
        if node.get("type") == "exercise":
            check_exercise(node.get("exercise"), f"{path}/exercise")
            for i, alt in enumerate(node.get("alternatives") or []):
                if isinstance(alt, dict):
                    check_exercise(alt.get("exercise"), f"{path}/alternatives/{i}/exercise")
        check_equipment(node.get("equipment"), f"{path}/equipment")
        if node.get("type") == "note" and "previews" in node:
            previews.append((node["previews"], f"{path}/previews"))
        for key, value in node.items():
            if isinstance(value, dict) and "min" in value and "max" in value:
                if isinstance(value["min"], (int, float)) and isinstance(value["max"], (int, float)) and value["min"] > value["max"]:
                    problems.append((f"{path}/{key}", 'has "min" larger than "max".'))
        if "clock" in node:
            visit(node["clock"], f"{path}/clock")
        for i, child in enumerate(node.get("children") or []):
            visit(child, f"{path}/children/{i}")

    visit(doc["plan"], "/plan")
    for value, path in previews:
        for node_id in value if isinstance(value, list) else [value]:
            if node_id not in ids:
                problems.append((path, f'previews "{node_id}", but no node has that id.'))
    return problems


def check(doc):
    schema = schema_problems(doc)
    problems = (schema or []) + semantic_problems(doc)
    for path, message in problems:
        print(f"{path or '(document)'}: {message}")
    if schema is None:
        print("Note: the JSON Schema wasn't checked because the jsonschema package isn't installed "
              "(pip install jsonschema). The PWF player checks it when it opens the link.")
    if not problems:
        print("valid")
    return 1 if problems else 0


def main(argv):
    if len(argv) != 3 or argv[1] not in ("check", "link"):
        sys.exit(__doc__.strip())
    doc = load(argv[2])
    if argv[1] == "link":
        print(link(doc))
        return 0
    return check(doc)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
