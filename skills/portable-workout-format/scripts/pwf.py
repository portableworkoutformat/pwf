#!/usr/bin/env python3
"""Check PWF workouts and build links that open them in the PWF player.

Usage:
  python3 pwf.py check workout.pwf.json   Print "valid", or the problems and exit 1
  python3 pwf.py link workout.pwf.json    Check the workout, then print a link that opens it in
                                          the player, or the problems and exit 1

Use "-" instead of a file name to read the workout from standard input.

Only the Python standard library is needed, except for the schema check,
which needs the jsonschema package (pip install jsonschema). Without it,
`check` runs the other checks, never prints "valid", and exits 2, while `link`
runs the other checks and leaves the schema to the player.

The player also checks the limits on one pass of the timeline (24 hours and
100,000 segments), which this script doesn't.
"""

import base64
import json
import sys
import zlib
from pathlib import Path

PLAYER = "https://portableworkout.org/play/"
SCHEMA = Path(__file__).resolve().parent.parent / "references" / "pwf-0.1.schema.json"
# SPEC.md section 10
MAX_BYTES = 1024 * 1024
MAX_DEPTH = 16
MAX_NODES = 5000
MAX_CHILDREN = 1000


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


def size_problems(doc):
    """Nesting depth, node count and children per container, walked without
    recursion and stopping at the first limit passed."""
    if not isinstance(doc, dict):
        return []
    stack = [(doc.get("plan"), "/plan", 1)]
    nodes = 0
    while stack:
        node, path, depth = stack.pop()
        if not isinstance(node, dict):
            continue
        nodes += 1
        if depth > MAX_DEPTH:
            return [(path, f"is nested {depth} levels deep. PWF allows at most {MAX_DEPTH} levels.")]
        if nodes > MAX_NODES:
            return [("/plan", f"has more than {MAX_NODES:,} nodes, the most PWF allows.")]
        if "clock" in node:
            stack.append((node["clock"], f"{path}/clock", depth + 1))
        children = node.get("children")
        if isinstance(children, list):
            if len(children) > MAX_CHILDREN:
                return [(f"{path}/children", f"has {len(children)} children. PWF allows at most {MAX_CHILDREN:,}.")]
            stack.extend((child, f"{path}/children/{i}", depth + 1) for i, child in enumerate(children))
    return []


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


def problems_in(doc):
    """Prints the document's problems. Returns them, and whether the schema was checked."""
    problems = size_problems(doc)
    schema = None
    if not problems:
        schema = schema_problems(doc)
        problems = (schema or []) + semantic_problems(doc)
    for path, message in problems:
        print(f"{path or '(document)'}: {message}")
    return problems, schema is not None


def check(doc):
    problems, schema_checked = problems_in(doc)
    if problems:
        return 1
    if not schema_checked:
        print("not checked: the jsonschema package isn't installed, so the schema wasn't checked. "
              "Run pip install jsonschema and check again. If you can't install it, go through the "
              "guide's checklist; the PWF player checks the schema when it opens the link.")
        return 2
    print("valid")
    return 0


def main(argv):
    if len(argv) != 3 or argv[1] not in ("check", "link"):
        sys.exit(__doc__.strip())
    doc = load(argv[2])
    if argv[1] == "link":
        if problems_in(doc)[0]:
            return 1
        print(link(doc))
        return 0
    return check(doc)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
