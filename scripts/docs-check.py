#!/usr/bin/env python3
"""Crawl the built docs site and fail on what `mkdocs build --strict` cannot see.

`--strict` validates Markdown-syntax links and image targets, and nothing else.
Measured against the pinned squidfunk/mkdocs-material image, it lets through:

  - a page missing from `nav:` (INFO only — built, deployed, unreachable),
  - a broken in-page anchor `[x](#no-existe)` (INFO only),
  - a broken raw-HTML `src=` / `poster=` — the <video> clips (no message at all).

This script serves the built site on a local http.server, walks every `href`,
`src` and `poster` reachable from the mount point, and exits non-zero on:

  1. any same-origin URL that does not answer 200,
  2. any same-origin URL that escapes the mount point (`/docs-site/`),
  3. any `#fragment` with no matching `id=` (or `<a name=>`) on the target page,
  4. any HTML page under the site directory the crawl never reached (an orphan).

External URLs (http/https to other hosts) are counted, not fetched: the check
is about the site's own integrity and must pass offline.

Usage:  python3 scripts/docs-check.py <served-root> <mount>
        python3 scripts/docs-check.py public /docs-site
"""

from __future__ import annotations

import functools
import http.server
import os
import posixpath
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from html.parser import HTMLParser
from pathlib import Path

HOST = "127.0.0.1"
SKIP_SCHEMES = ("mailto:", "tel:", "javascript:", "data:", "blob:")


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class _Links(HTMLParser):
    """Collect outgoing references and the set of anchor targets on one page."""

    def __init__(self) -> None:
        super().__init__()
        self.refs: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "a" and a.get("name"):
            self.ids.add(a["name"])
        for key in ("href", "src", "poster"):
            value = a.get(key)
            if value and tag not in ("link",) or (tag == "link" and key == "href"):
                if value:
                    self.refs.append(value)


class _Server(http.server.ThreadingHTTPServer):
    """A crawler that stops reading a large video early leaves the handler with a
    closed socket; that is expected, not a problem worth a traceback."""

    def handle_error(self, request, client_address):  # noqa: ANN001
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError)):
            return
        super().handle_error(request, client_address)


def serve(root: Path) -> tuple[http.server.ThreadingHTTPServer, str]:
    handler = functools.partial(_Quiet, directory=str(root))
    server = _Server((HOST, 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://{HOST}:{server.server_address[1]}"


def fetch(url: str) -> tuple[int, str, str]:
    """Return (status, final_url, body-if-html)."""
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            ctype = resp.headers.get("Content-Type", "")
            body = resp.read().decode("utf-8", "replace") if "text/html" in ctype else ""
            return resp.status, resp.geturl(), body
    except urllib.error.HTTPError as err:
        return err.code, url, ""
    except (urllib.error.URLError, OSError) as err:  # pragma: no cover
        return 0, url, str(err)


def crawl(base: str, mount: str) -> tuple[list[str], set[str], int]:
    start = f"{base}{mount.rstrip('/')}/"
    origin = urllib.parse.urlsplit(base).netloc
    queue: deque[tuple[str, str]] = deque([(start, "<start>")])
    seen: set[str] = set()
    ids_by_page: dict[str, set[str]] = {}
    fragment_checks: list[tuple[str, str, str]] = []
    problems: list[str] = []
    external = 0

    while queue:
        url, referrer = queue.popleft()
        split = urllib.parse.urlsplit(url)
        bare = urllib.parse.urlunsplit((split.scheme, split.netloc, split.path, "", ""))
        if split.fragment:
            fragment_checks.append((bare, split.fragment, referrer))
        if bare in seen:
            continue
        seen.add(bare)

        if not split.path.startswith(mount.rstrip("/") + "/") and split.path != mount.rstrip("/"):
            problems.append(f"ESCAPES MOUNT  {split.path}  (from {referrer})")
            continue

        status, final, body = fetch(bare)
        if status != 200:
            problems.append(f"HTTP {status}  {split.path}  (from {referrer})")
            continue
        if final != bare and not final.startswith(bare):
            # http.server answers a directory without a trailing slash with 301.
            problems.append(f"REDIRECT  {split.path} -> {urllib.parse.urlsplit(final).path}  (from {referrer})")

        if not body:
            continue
        parser = _Links()
        parser.feed(body)
        ids_by_page[bare] = parser.ids
        page_path = urllib.parse.urlsplit(final).path
        for ref in parser.refs:
            if ref.startswith(SKIP_SCHEMES):
                continue
            target = urllib.parse.urljoin(f"{base}{page_path}", ref)
            tsplit = urllib.parse.urlsplit(target)
            if tsplit.netloc != origin:
                external += 1
                continue
            queue.append((target, page_path))

    for page, fragment, referrer in fragment_checks:
        wanted = urllib.parse.unquote(fragment)
        if not wanted:
            continue
        ids = ids_by_page.get(page)
        if ids is None:
            continue  # the page itself already failed above
        if wanted not in ids:
            problems.append(
                f"BROKEN ANCHOR  {urllib.parse.urlsplit(page).path}#{wanted}  (from {referrer})"
            )

    return problems, {urllib.parse.urlsplit(u).path for u in seen}, external


def orphans(root: Path, mount: str, reached: set[str]) -> list[str]:
    site = root / mount.strip("/")
    missing = []
    for html in sorted(site.rglob("*.html")):
        rel = html.relative_to(root).as_posix()
        url = "/" + rel
        if html.name == "index.html":
            url = "/" + posixpath.dirname(rel) + "/"
            url = url.replace("//", "/")
        if url == f"{mount.rstrip('/')}/404.html" or html.name == "404.html":
            continue
        if url not in reached:
            missing.append(url)
    return missing


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    root = Path(argv[1]).resolve()
    mount = "/" + argv[2].strip("/")
    if not (root / mount.strip("/")).is_dir():
        print(f"docs-check: {root / mount.strip('/')} does not exist — run `make docs` first")
        return 2

    server, base = serve(root)
    try:
        problems, reached, external = crawl(base, mount)
    finally:
        server.shutdown()

    for url in orphans(root, mount, reached):
        problems.append(f"ORPHAN PAGE  {url}  (not reachable from {mount}/)")

    pages = sorted(p for p in reached if p.endswith("/"))
    print(f"docs-check: {len(pages)} pages, {len(reached)} URLs, {external} external references skipped")
    for line in problems:
        print("  " + line)
    if problems:
        print(f"docs-check: FAILED with {len(problems)} problem(s)")
        return 1
    print("docs-check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
