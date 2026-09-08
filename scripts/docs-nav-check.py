#!/usr/bin/env python3
"""Check the numbered navigation of the docs site for the things MkDocs cannot.

There is no numbering plugin: chapter numbers are literal text that must agree
in three places — the `nav:` label in mkdocs.yml, the page's frontmatter
`title:` and its `# H1`. `mkdocs build --strict` checks none of that, and a
page missing from `nav:` is INFO-level only. This script fails on:

  1. a page under docs/ that is not in `nav:`, or listed more than once,
  2. a `nav:` entry whose file does not exist,
  3. nav nesting deeper than 3 levels (section → chapter → sub-chapter),
  4. a nav label, frontmatter title and H1 that do not carry the same number,
  5. chapter numbers that are not contiguous in nav order (gaps or repeats),
     including the x.1, x.2 … sub-chapter sequence under each chapter.

Usage:  python3 scripts/docs-nav-check.py [mkdocs.yml]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    print("docs-nav-check: PyYAML is required (python3 -m pip install pyyaml)")
    sys.exit(2)


class _Loader(yaml.SafeLoader):
    """mkdocs.yml carries `!!python/name:` tags; we only need `nav`, so ignore them."""


_Loader.add_multi_constructor("tag:yaml.org,2002:python/", lambda loader, suffix, node: None)
_Loader.add_multi_constructor("!", lambda loader, suffix, node: None)

# "4. Título" for chapters (trailing dot), "4.1 Título" for sub-chapters.
NUMBER = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+")


def leaves(nav, depth=1, path=()):
    """Yield (label, file, depth, path) for every page; label is None for section index pages."""
    for item in nav:
        if isinstance(item, str):
            yield None, item, depth, path
        elif isinstance(item, dict):
            (label, value), = item.items()
            if isinstance(value, str):
                yield label, value, depth, path
            else:
                yield from leaves(value, depth + 1, path + (label,))


def number_of(text: str | None) -> str | None:
    if not text:
        return None
    match = NUMBER.match(text.strip().strip('"'))
    return match.group(1) if match else None


def page_number(md: Path) -> tuple[str | None, str | None]:
    text = md.read_text(encoding="utf-8")
    title = None
    if text.startswith("---"):
        head = text.split("---", 2)[1]
        for line in head.splitlines():
            if line.startswith("title:"):
                title = line.split(":", 1)[1].strip().strip('"').strip("'")
    h1 = next((line[2:] for line in text.splitlines() if line.startswith("# ")), None)
    return title, h1


def main(argv: list[str]) -> int:
    cfg = Path(argv[1] if len(argv) > 1 else "mkdocs.yml")
    root = cfg.parent
    data = yaml.load(cfg.read_text(encoding="utf-8"), Loader=_Loader)
    docs = root / data.get("docs_dir", "docs")
    problems: list[str] = []

    entries = list(leaves(data["nav"]))
    listed = [entry[1] for entry in entries]
    for file in sorted(set(listed)):
        if listed.count(file) > 1:
            problems.append(f"LISTED TWICE  {file}")
        if not (docs / file).is_file():
            problems.append(f"MISSING FILE  {file}")
    on_disk = {p.relative_to(docs).as_posix() for p in docs.rglob("*.md")}
    for file in sorted(on_disk - set(listed)):
        problems.append(f"NOT IN NAV  {file}")

    sequence: list[tuple[str, str]] = []
    for label, file, depth, path in entries:
        if label is None and path:
            # A bare `- dir/index.md` inside a section is that section's own page
            # (navigation.indexes): Material shows it under the section label.
            label, depth = path[-1], depth - 1
        if depth > 3:
            problems.append(f"DEPTH {depth}  {' > '.join(path)} > {label}")
        if not (docs / file).is_file():
            continue
        title, h1 = page_number(docs / file)
        nav_num, title_num, h1_num = number_of(label), number_of(title), number_of(h1)
        if not (nav_num == title_num == h1_num):
            problems.append(
                f"NUMBER MISMATCH  {file}: nav={nav_num!r} title={title_num!r} h1={h1_num!r}"
            )
        if title and label and title.strip() != label.strip():
            problems.append(f"LABEL/TITLE DIFFER  {file}: nav={label!r} title={title!r}")
        if nav_num:
            sequence.append((nav_num, file))

    expected_chapter = 1
    sub_expected = 0
    for num, file in sequence:
        parts = num.split(".")
        if len(parts) == 1:
            if int(parts[0]) != expected_chapter:
                problems.append(f"CHAPTER GAP  expected {expected_chapter}, got {num} at {file}")
                expected_chapter = int(parts[0])
            expected_chapter += 1
            sub_expected = 1
        elif len(parts) == 2:
            chapter = int(parts[0])
            if chapter != expected_chapter - 1:
                problems.append(f"SUB-CHAPTER OF WRONG CHAPTER  {num} at {file}")
            if int(parts[1]) != sub_expected:
                problems.append(f"SUB-CHAPTER GAP  expected {chapter}.{sub_expected}, got {num} at {file}")
                sub_expected = int(parts[1])
            sub_expected += 1
        else:
            problems.append(f"TOO DEEP  {num} at {file}")

    print(f"docs-nav-check: {len(entries)} nav entries, {len(on_disk)} pages, {len(sequence)} numbered")
    for line in problems:
        print("  " + line)
    if problems:
        print(f"docs-nav-check: FAILED with {len(problems)} problem(s)")
        return 1
    print("docs-nav-check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
