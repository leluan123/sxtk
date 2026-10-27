"""Build compact, ordered transition counts from datas/*.json and *.jsonl."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "datas"
OUTPUT = ROOT / "dist" / "data.json"
TARGET_MINUTES = (29, 35, 41, 47, 53)
KNOWN_DAY_STARTS = {"2026-10-28": 193354}  # User-confirmed: draw 0193354 at 06:05.


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
        draw_date = record["date"]
        date.fromisoformat(draw_date)
        return {"id": identifier, "date": draw_date, "result": tuple(sorted(faces))}
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError(f"Invalid record in {path}: {error}") from error


def infer_minutes(rows: list[dict]) -> dict[int, int]:
    """Infer draw minutes only when the daily first draw ID is unambiguous.

    Bingo18 has 159 six-minute draws from 06:05 to 21:53 on a full day.
    An incomplete day is anchored by adjacent complete days. If both
    anchors disagree, an exact boundary with the preceding full day resolves
    the start; otherwise that day is omitted from minute-specific statistics.
    """
    by_date: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        by_date[row["date"]].append(row["id"])

    complete = {
        day: ids[0]
        for day, ids in by_date.items()
        if len(ids) == 159 and ids[-1] - ids[0] == 158
    }
    for day, known_id in KNOWN_DAY_STARTS.items():
        if day in complete and complete[day] != known_id:
            raise ValueError(f"Known first draw ID for {day} conflicts with the data")
    anchors = {**complete, **KNOWN_DAY_STARTS}
    if not anchors:
        return {}
    anchor_days = sorted(anchors)
    minutes: dict[int, int] = {}

    for day, ids in by_date.items():
        if day in anchors:
            first_id = anchors[day]
        else:
            earlier = next((candidate for candidate in reversed(anchor_days) if candidate < day), None)
            later = next((candidate for candidate in anchor_days if candidate > day), None)
            candidates = set()
            for anchor in (earlier, later):
                if anchor is None:
                    continue
                expected = anchors[anchor] + (date.fromisoformat(day) - date.fromisoformat(anchor)).days * 159
                if ids[0] >= expected and ids[-1] <= expected + 158:
                    candidates.add(expected)
            if len(candidates) == 1:
                first_id = candidates.pop()
            else:
                previous_day = (date.fromisoformat(day) - timedelta(days=1)).isoformat()
                if previous_day in complete and ids[0] == by_date[previous_day][-1] + 1:
                    first_id = ids[0]
                else:
                    continue

        for identifier in ids:
            ordinal = identifier - first_id
            if 0 <= ordinal < 159:
                minutes[identifier] = (5 + 6 * ordinal) % 60
    return minutes


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
    face_counts = Counter(face for row in rows for face in row["result"])
    draw_minutes = infer_minutes(rows)
    counts: dict[int, dict[str, Counter[str]]] = {
        1: defaultdict(Counter),
        2: defaultdict(Counter),
    }
    minute_stats: dict[int, dict[str, dict[str, dict]]] = {1: {}, 2: {}}
    totals = {1: 0, 2: 0}

    def record_minute(periods: int, context: str, current: dict, outcome: str) -> None:
        minute = draw_minutes.get(current["id"])
        if minute not in TARGET_MINUTES:
            return
        bucket = minute_stats[periods].setdefault(context, {}).setdefault(str(minute), {"sample": 0, "hoa": Counter()})
        bucket["sample"] += 1
        if current["result"][0] == current["result"][2]:
            bucket["hoa"][outcome] += 1

    for i in range(1, len(rows)):
        current, prior = rows[i], rows[i - 1]
        if current["id"] != prior["id"] + 1:
            continue
        outcome = ",".join(map(str, current["result"]))
        one = ",".join(map(str, prior["result"]))
        counts[1][one][outcome] += 1
        totals[1] += 1
        record_minute(1, one, current, outcome)
        if i >= 2 and prior["id"] == rows[i - 2]["id"] + 1:
            two = ",".join(map(str, rows[i - 2]["result"])) + "|" + one
            counts[2][two][outcome] += 1
            totals[2] += 1
            record_minute(2, two, current, outcome)

    payload = {
        "generated_from": len(paths),
        "records": len(rows),
        "latest_id": str(rows[-1]["id"]),
        "latest_date": rows[-1]["date"],
        "face_counts": {str(face): face_counts[face] for face in range(1, 7)},
        "transitions": totals,
        "minute_coverage": {"mapped_records": len(draw_minutes), "unmapped_records": len(rows) - len(draw_minutes)},
        "minute_stats": {str(k): contexts for k, contexts in minute_stats.items()},
        "counts": {str(k): {key: dict(value) for key, value in contexts.items()} for k, contexts in counts.items()},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {OUTPUT.relative_to(ROOT)} from {len(rows)} records; {OUTPUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
