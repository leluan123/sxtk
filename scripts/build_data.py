"""Build compact, ordered transition counts from datas/*.json and *.jsonl."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "datas"
OUTPUT = ROOT / "dist" / "data.json"


def records(path: Path):
    with path.open("r", encoding="utf-8-sig") as source:
        first = source.read(1)
        source.seek(0)
        if first == "[":
            yield from json.load(source)
        else:
            for line_number, line in enumerate(source, 1):
                if line.strip():
                    try:
                        yield json.loads(line)
                    except json.JSONDecodeError as error:
                        raise ValueError(f"{path}:{line_number}: {error}") from error


def normalize(record: dict, path: Path) -> dict:
    try:
        identifier = int(record["id"])
        faces = record["result"]
        if len(faces) != 3 or any(type(face) is not int or not 1 <= face <= 6 for face in faces):
            raise ValueError("result must contain three integers from 1 to 6")
        if record.get("total") != sum(faces):
            raise ValueError("total does not equal the sum of result")
        return {"id": identifier, "date": record["date"], "result": tuple(sorted(faces))}
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError(f"Invalid record in {path}: {error}") from error


def main() -> None:
    paths = sorted((*DATA_DIR.glob("*.json"), *DATA_DIR.glob("*.jsonl")))
    if not paths:
        raise SystemExit("No .json or .jsonl files found in datas/")

    by_id: dict[int, dict] = {}
    for path in paths:
        for raw in records(path):
            row = normalize(raw, path)
            previous = by_id.get(row["id"])
            if previous is not None and previous != row:
                raise ValueError(f"Conflicting records for id {row['id']}")
            by_id[row["id"]] = row

    rows = [by_id[key] for key in sorted(by_id)]
    counts: dict[int, dict[str, Counter[str]]] = {
        1: defaultdict(Counter),
        2: defaultdict(Counter),
    }
    totals = {1: 0, 2: 0}

    for i in range(1, len(rows)):
        current, prior = rows[i], rows[i - 1]
        if current["id"] != prior["id"] + 1:
            continue
        outcome = ",".join(map(str, current["result"]))
        one = ",".join(map(str, prior["result"]))
        counts[1][one][outcome] += 1
        totals[1] += 1
        if i >= 2 and prior["id"] == rows[i - 2]["id"] + 1:
            two = ",".join(map(str, rows[i - 2]["result"])) + "|" + one
            counts[2][two][outcome] += 1
            totals[2] += 1

    payload = {
        "generated_from": len(paths),
        "records": len(rows),
        "latest_id": str(rows[-1]["id"]),
        "latest_date": rows[-1]["date"],
        "transitions": totals,
        "counts": {str(k): {key: dict(value) for key, value in contexts.items()} for k, contexts in counts.items()},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {OUTPUT.relative_to(ROOT)} from {len(rows)} records; {OUTPUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
