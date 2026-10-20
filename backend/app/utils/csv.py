import csv
import io
import re
from collections.abc import Sequence

FORMULA_PREFIX = re.compile(r"^[=+\-@\t\r]")


def escape_csv_field(value: object, *, numeric: bool = False) -> str:
    text = "" if value is None else str(value)
    if not numeric and FORMULA_PREFIX.match(text):
        text = f"'{text}"
    if any(character in text for character in '",\r\n'):
        return '"' + text.replace('"', '""') + '"'
    return text


def to_csv(header: Sequence[object], rows: Sequence[Sequence[object]]) -> str:
    lines = [",".join(escape_csv_field(cell) for cell in row) for row in [header, *rows]]
    return "\r\n".join(lines) + "\r\n"


def parse_csv(text: str) -> list[list[str]]:
    cleaned = text.removeprefix("\ufeff")
    return [row for row in csv.reader(io.StringIO(cleaned, newline=""))]
