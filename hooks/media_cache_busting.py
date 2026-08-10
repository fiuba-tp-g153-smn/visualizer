"""Stamp a content hash onto every screenshot and video reference.

Screenshots and clips are not content-hashed by MkDocs the way Material hashes
its own bundle, so replacing `main-ui.png` in place left every reader who
already had it holding the old one until their cache entry expired — and no
redeploy can reach a browser that isn't asking.

This appends `?v=<sha256[:8]>` to each reference at build time. The bytes decide
the URL, so a replaced file is a URL the browser has never seen and is fetched
at once, while an unchanged file keeps its URL and stays cached. That is what
lets nginx serve `imgs/` and `videos/` as immutable.

A query string rather than a renamed file: MkDocs writes those paths relative to
each page's own URL depth, and renaming the file would mean rewriting every
reference to match. The URL is what caches key on either way.
"""

import hashlib
import posixpath
import re
from pathlib import Path

# Only these trees get the long TTL in nginx, so only these need the stamp.
HASHED_ROOTS = ("imgs/", "videos/")
MEDIA_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".webm", ".mp4"}

# `src` covers Markdown images and <source>; `poster` covers the video posters,
# which live in raw HTML that MkDocs passes through untouched.
_REFERENCE = re.compile(r'(?P<attr>\b(?:src|poster)=")(?P<url>[^"]+)"')

_hashes: dict[str, str] = {}


def on_files(files, config):
    """Hash every media file once, keyed by its path inside docs/."""
    _hashes.clear()
    for file in files:
        src_uri = file.src_uri
        if not file.abs_src_path or not src_uri.startswith(HASHED_ROOTS):
            continue
        if Path(src_uri).suffix.lower() not in MEDIA_SUFFIXES:
            continue
        digest = hashlib.sha256(Path(file.abs_src_path).read_bytes()).hexdigest()
        _hashes[src_uri] = digest[:8]
    return files


def on_post_page(output, page, config):
    """Rewrite this page's media references to carry their file's hash."""
    if not _hashes:
        return output

    page_dir = posixpath.dirname(page.file.dest_uri)

    def stamp(match: re.Match) -> str:
        url = match.group("url")
        # Absolute, external, inline or already-stamped URLs are not ours.
        if url.startswith(("http://", "https://", "//", "data:", "/")) or "?" in url:
            return match.group(0)

        target = posixpath.normpath(posixpath.join(page_dir, url))
        digest = _hashes.get(target)
        if digest is None:
            return match.group(0)

        return f'{match.group("attr")}{url}?v={digest}"'

    return _REFERENCE.sub(stamp, output)
